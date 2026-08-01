// notify-message
// ─────────────────────────────────────────────────────────────────────────
// Notificación push dirigida a UN destinatario puntual cuando le llega un
// mensaje nuevo. A diferencia de notify-subscribers (que manda un broadcast
// fijo a la lista global `suscriptores`), esta función:
//   - recibe conversacionId / mensajeId / remitenteId por body
//   - resuelve quién es el/los otro/s participante/s de la conversación
//   - les manda push solo a ELLOS, por DOS canales según qué tengan
//     registrado:
//       · Web Push (navegador) -> perfil_push_subscriptions
//       · FCM (APK Android vía Tauri) -> perfil_fcm_tokens
//
// Pensada para invocarse desde `enviarMensaje` en el cliente (fire-and-forget)
// o, mejor todavía, desde un trigger de Postgres en `mensajes` (AFTER INSERT)
// vía pg_net, para que funcione incluso si el remitente cierra la app antes
// de que la promesa del fetch termine. Documentado abajo.
//
// Variables de entorno requeridas (Supabase secrets, NO hardcodear):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ya provistas por la plataforma)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  -> Web Push, setear con:
//     supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
//   FIREBASE_SERVICE_ACCOUNT_JSON -> FCM (APK), el JSON completo de la
//     Service Account de Firebase (Project Settings → Service accounts →
//     Generate new private key), como un solo string:
//     supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import WebPush from "https://esm.sh/web-push@3.6.6?target=deno&no-check"
import { create as crearJwt, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts"

interface NotifyMessageBody {
  conversacionId: string;
  mensajeId: string;
  remitenteId: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

// Cachea el access_token de Google entre invocaciones "calientes" de la
// función (el runtime de Deno de Supabase reusa la instancia entre
// requests seguidos), para no pedir un token OAuth nuevo en cada mensaje.
let cacheAccessToken: { token: string; expiraEn: number } | null = null;

async function obtenerAccessTokenFcm(serviceAccount: ServiceAccount): Promise<string> {
  if (cacheAccessToken && cacheAccessToken.expiraEn > Date.now() + 30_000) {
    return cacheAccessToken.token;
  }

  // Firma un JWT con la private key de la Service Account y lo canjea por
  // un access_token OAuth2 de Google — es el mecanismo estándar de la API
  // HTTP v1 de FCM (reemplazó a la vieja "server key" legacy).
  const privateKeyPem = serviceAccount.private_key.replace(/\\n/g, "\n");
  const keyData = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const jwt = await crearJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(60 * 55),
      iat: getNumericDate(0),
    },
    cryptoKey,
  );

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    throw new Error(`No se pudo obtener access_token de Google: ${await resp.text()}`);
  }
  const data = await resp.json();
  cacheAccessToken = { token: data.access_token, expiraEn: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}

/** Manda un push FCM a un solo token. Devuelve false si el token está inválido/expirado. */
async function enviarFcm(
  serviceAccount: ServiceAccount,
  accessToken: string,
  token: string,
  titulo: string,
  cuerpo: string,
  url: string,
): Promise<boolean> {
  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: titulo, body: cuerpo },
          data: { url },
          android: { priority: "high" },
        },
      }),
    },
  );
  if (resp.ok) return true;

  const textoError = await resp.text();
  // UNREGISTERED / INVALID_ARGUMENT con token = el token ya no sirve (app
  // desinstalada, token rotado) — se limpia de la tabla más abajo.
  if (resp.status === 404 || textoError.includes("UNREGISTERED")) return false;
  console.error("Error enviando FCM individual:", textoError);
  return true; // error transitorio: no lo tratamos como token muerto
}

serve(async (req) => {
  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en los secrets del proyecto.");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<NotifyMessageBody>;
    const { conversacionId, mensajeId, remitenteId } = body;
    if (!conversacionId || !mensajeId || !remitenteId) {
      return new Response(
        JSON.stringify({ error: "Faltan conversacionId, mensajeId o remitenteId." }),
        { status: 400 },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Destinatarios: todos los participantes de la conversación excepto quien mandó.
    const { data: participantes, error: errPart } = await supabase
      .from("conversacion_participantes")
      .select("perfil_id, perfiles!inner(username)")
      .eq("conversacion_id", conversacionId)
      .neq("perfil_id", remitenteId);
    if (errPart) throw errPart;

    const destinatarioIds = (participantes ?? []).map((p: any) => p.perfil_id);
    if (destinatarioIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0 }), { status: 200 });
    }

    const { data: mensaje } = await supabase
      .from("mensajes")
      .select("contenido, adjunto_tipo")
      .eq("id", mensajeId)
      .maybeSingle();

    const { data: remitente } = await supabase
      .from("perfiles")
      .select("username")
      .eq("id", remitenteId)
      .maybeSingle();

    const cuerpo = mensaje?.contenido?.trim()
      ? mensaje.contenido
      : mensaje?.adjunto_tipo === "imagen"
        ? "📷 Foto"
        : mensaje?.adjunto_tipo === "audio"
          ? "🎤 Audio"
          : mensaje?.adjunto_tipo === "archivo"
            ? "📎 Archivo"
            : "Nuevo mensaje";

    const titulo = remitente?.username ? `${remitente.username}` : "Nuevo mensaje";
    // Ruta real de la conversación en la app (ver detalleConversacion.tsx:
    // usa ?id=... vía useSearchParams, misma ruta estática web/APK). Antes
    // esto apuntaba a /personal/mensajes/${conversacionId}, una ruta que no
    // existe — se corrige de paso acá.
    const urlDestino = `/personal/mensajes/detalle?id=${conversacionId}`;

    let enviadosWebPush = 0;
    let enviadosFcm = 0;

    // ── Canal 1: Web Push (navegador) ──────────────────────────────────
    const { data: subs, error: errSubs } = await supabase
      .from("perfil_push_subscriptions")
      .select("subscription_data, endpoint")
      .in("perfil_id", destinatarioIds);
    if (errSubs) throw errSubs;

    if (subs && subs.length > 0) {
      WebPush.setVapidDetails("mailto:fran@ateliervirtual.art", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

      const payload = JSON.stringify({ title: titulo, body: cuerpo, url: urlDestino });
      const expirados: string[] = [];

      await Promise.all(
        subs.map(async (sub: any) => {
          try {
            await WebPush.sendNotification(sub.subscription_data, payload);
            enviadosWebPush++;
          } catch (err: any) {
            // 404/410 = la suscripción ya no existe del lado del browser; la limpiamos.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              expirados.push(sub.endpoint);
            } else {
              console.error("Error enviando push individual:", err?.message ?? err);
            }
          }
        }),
      );

      if (expirados.length > 0) {
        await supabase.from("perfil_push_subscriptions").delete().in("endpoint", expirados);
      }
    }

    // ── Canal 2: FCM (APK Android vía Tauri) ────────────────────────────
    const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (FIREBASE_SERVICE_ACCOUNT_JSON) {
      const { data: tokensFcm, error: errTokens } = await supabase
        .from("perfil_fcm_tokens")
        .select("token")
        .in("perfil_id", destinatarioIds);
      if (errTokens) throw errTokens;

      if (tokensFcm && tokensFcm.length > 0) {
        const serviceAccount: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
        const accessToken = await obtenerAccessTokenFcm(serviceAccount);
        const tokensMuertos: string[] = [];

        await Promise.all(
          tokensFcm.map(async (row: any) => {
            const vivo = await enviarFcm(
              serviceAccount,
              accessToken,
              row.token,
              titulo,
              cuerpo,
              urlDestino,
            );
            if (vivo) enviadosFcm++;
            else tokensMuertos.push(row.token);
          }),
        );

        if (tokensMuertos.length > 0) {
          await supabase.from("perfil_fcm_tokens").delete().in("token", tokensMuertos);
        }
      }
    }
    // Si no está seteado FIREBASE_SERVICE_ACCOUNT_JSON, simplemente no se
    // manda por FCM (no rompe Web Push) — útil mientras se termina de
    // configurar Firebase del lado servidor.

    return new Response(
      JSON.stringify({ ok: true, enviados: enviadosWebPush + enviadosFcm, enviadosWebPush, enviadosFcm }),
      { status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
})

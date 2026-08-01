/**
 * pushEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Registro de suscripción a Web Push del usuario logueado, para poder
 * notificarle mensajes nuevos cuando la app está cerrada/en background.
 * Reutiliza el mismo Service Worker (`custom-sw.js` → `sw.js`) que ya tiene
 * el handler de `push` genérico armado; acá solo nos suscribimos y guardamos
 * la subscription en `perfil_push_subscriptions`, atada al perfil (a
 * diferencia de `suscriptores`, que es la lista global/anónima usada para el
 * broadcast de "nuevo dibujo").
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "@/infra/supabase/supabase";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Pide permiso de notificaciones (si hace falta) y registra la suscripción
 * push del usuario actual. No hace nada si el browser no soporta push, si el
 * usuario no dio permiso, o si no hay sesión. Pensado para llamarse una vez
 * al loguearse / abrir la app (por ejemplo desde un provider raíz), no hace
 * falta llamarlo por cada mensaje.
 */
export async function registrarPushSubscription(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    let permiso = Notification.permission;
    if (permiso === "default") {
      permiso = await Notification.requestPermission();
    }
    if (permiso !== "granted") return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    await supabase.from("perfil_push_subscriptions").upsert(
      {
        perfil_id: user.id,
        endpoint: subscription.endpoint,
        subscription_data: subJson,
      },
      { onConflict: "endpoint" },
    );
  } catch (err) {
    console.warn("No se pudo registrar la suscripción push:", err);
  }
}

/**
 * Guarda el token FCM del dispositivo actual (APK Android vía Tauri). Se
 * llama desde el puente nativo cuando Firebase entrega/renueva el token —
 * ver FirebaseMessagingService.kt, que expone el token al WebView.
 */
export async function guardarTokenFcm(token: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("perfil_fcm_tokens").upsert(
    { perfil_id: user.id, token },
    { onConflict: "token" },
  );
}

/** Da de baja el token FCM del dispositivo actual (p. ej. al hacer logout). */
export async function darDeBajaTokenFcm(token: string): Promise<void> {
  await supabase.from("perfil_fcm_tokens").delete().eq("token", token);
}
export async function darDeBajaPushSubscription(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await supabase
      .from("perfil_push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    console.warn("No se pudo dar de baja la suscripción push:", err);
  }
}

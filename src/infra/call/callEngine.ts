/**
 * callEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica de llamadas de voz/video usando LiveKit. Se apoya en la Edge Function
 * `generar-token-llamada` para obtener el token de acceso a la sala, y en
 * Supabase Realtime (broadcast) para avisar al otro usuario que hay una
 * llamada entrante, sin depender de que ya esté conectado a la sala LiveKit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase, realtimeAuthListo } from "@/infra/supabase/supabase";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface TokenLlamada {
  token: string;
  url: string; // URL del servidor LiveKit (wss://...)
  roomName: string;
}

export interface SenalLlamada {
  tipo: "oferta" | "aceptada" | "rechazada" | "colgada";
  conversacionId: string;
  llamadaId: string;
  roomName: string;
  deId: string;
  deNombre: string | null;
  deAvatar: string | null;
  paraId: string;
}

// ─── Pedido de token a la Edge Function ────────────────────────────────────

/**
 * Pide un token de acceso a la sala de LiveKit para una llamada existente.
 *
 * IMPORTANTE: la Edge Function `generar-token-llamada` (ya deployada en
 * Supabase) espera un `llamada_id` que referencia una fila en la tabla
 * `llamadas` — no un `conversacion_id` suelto — y valida server-side que el
 * usuario sea participante de la conversación asociada a esa llamada antes
 * de emitir el token. Además, en esta fase el grant solo habilita
 * publicación de audio (`canPublishSources: ["microphone"]"`), así que la
 * cámara todavía no funciona contra esta función tal cual está deployada
 * (ver nota al final de este archivo).
 *
 * roomName se pasa junto porque ya lo tenemos del lado cliente (evita un
 * segundo round-trip) y sirve para pasárselo a LiveKit al conectar.
 */
export async function pedirTokenLlamada(llamadaId: string): Promise<TokenLlamada> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No hay sesión activa.");

  const { data, error } = await supabase.functions.invoke("generar-token-llamada", {
    body: { llamada_id: llamadaId },
  });

  if (error) throw error;
  if (!data?.token || !data?.url) {
    throw new Error("Respuesta inválida del servidor al pedir el token de llamada.");
  }

  return {
    token: data.token,
    url: data.url,
    roomName: data.roomName ?? "",
  };
}

/**
 * Crea la fila en `llamadas` que la Edge Function necesita para emitir el
 * token. Se llama una sola vez, del lado de quien inicia la llamada; el
 * roomName generado se propaga al otro usuario vía la señal de "oferta".
 */
export async function crearLlamada(
  conversacionId: string,
  tipo: "audio" | "video" = "audio",
): Promise<{ id: string; roomName: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const roomName = `conv-${conversacionId}-${Date.now()}`;
  const { data, error } = await supabase
    .from("llamadas")
    .insert({
      conversacion_id: conversacionId,
      iniciada_por: user.id,
      room_name: roomName,
      tipo,
      // estado tiene default 'sonando' en la tabla; lo dejamos implícito.
    })
    .select("id, room_name")
    .single();
  if (error || !data) throw error ?? new Error("No se pudo crear la llamada.");
  return { id: data.id, roomName: data.room_name };
}

// ─── Actualización de estado en la tabla `llamadas` ────────────────────────

/**
 * Actualiza el estado de la llamada en la tabla `llamadas`. Antes, ningún
 * lugar del código hacía este UPDATE después de crear la fila (quedaba
 * "sonando" para siempre, incluso en llamadas que sí se contestaron), así
 * que `limpiar_llamadas_sin_responder()` terminaba marcando como "perdida"
 * llamadas que en realidad se habían atendido normalmente.
 */
export async function marcarEstadoLlamada(
  llamadaId: string,
  estado: "aceptada" | "rechazada" | "colgada",
): Promise<void> {
  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = { estado };
  if (estado === "aceptada") cambios.contestada_at = ahora;
  if (estado === "rechazada" || estado === "colgada") cambios.finalizada_at = ahora;
  await supabase.from("llamadas").update(cambios).eq("id", llamadaId);
}

// ─── Señalización (avisar llamada entrante / colgar) ───────────────────────

/**
 * Se suscribe al canal de señales de llamada del usuario actual. Cualquier
 * llamada entrante, aceptación, rechazo o corte se recibe acá. Un solo canal
 * por usuario (no por conversación), así funciona sin importar en qué
 * pantalla esté.
 */
export function suscribirseASenalesDeLlamada(
  perfilId: string,
  onSenal: (senal: SenalLlamada) => void,
): RealtimeChannel {
  // private: true es lo que hace que Realtime evalúe las policies de RLS
  // sobre realtime.messages para este canal (ver migración
  // habilitar_broadcast_senales_llamada). Sin esto, aunque existan las
  // policies correctas, el canal se trata como público y el broadcast se
  // descarta en silencio del lado del servidor — que era exactamente lo
  // que pasaba: quien contestaba se conectaba bien a LiveKit de su lado,
  // pero la señal nunca le llegaba a quien llamó.
  const canal = supabase.channel(`llamadas:${perfilId}`, {
    config: { broadcast: { self: false }, private: true },
  });

  canal.on("broadcast", { event: "senal" }, (payload) => {
    onSenal(payload.payload as SenalLlamada);
  });

  // Esperamos a que el JWT de Realtime ya esté sincronizado con la sesión
  // ANTES de suscribirnos — si el subscribe() sale con el anon key todavía
  // puesto, el canal queda pegado a esa autenticación y el servidor
  // rechaza cada broadcast con "Unauthorized" indefinidamente, sin
  // reintentar la autenticación solo (confirmado en logs de Realtime).
  void realtimeAuthListo.then(() => {
    canal.subscribe();
  });

  return canal;
}

/** Envía una señal de llamada al canal del otro usuario. */
async function enviarSenal(senal: SenalLlamada): Promise<void> {
  // Misma razón que en suscribirseASenalesDeLlamada: si nos suscribimos
  // antes de que el JWT de Realtime esté sincronizado, el canal queda
  // pegado al anon key y el envío falla con "Unauthorized" sin recuperarse
  // solo, aunque el JWT se corrija después.
  await realtimeAuthListo;

  const canal = supabase.channel(`llamadas:${senal.paraId}`, {
    config: { broadcast: { self: false, ack: true }, private: true },
  });
  // Un canal recién creado necesita suscribirse antes de poder emitir.
  await new Promise<void>((resolve, reject) => {
    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        reject(new Error(`No se pudo suscribir el canal de señalización (${status}).`));
      }
    });
  });

  // send() con ack:true devuelve "ok" recién cuando el servidor de Realtime
  // confirma haber recibido el broadcast (no solo cuando se despachó desde
  // acá) — sin ack, la promesa podía resolver antes de que el mensaje
  // llegara a destino, y cerrábamos el canal (removeChannel, más abajo)
  // antes de que la entrega se completara, perdiendo la señal en silencio
  // sin ningún error. Esto era la causa más probable de que las llamadas
  // entrantes no llegaran al otro usuario.
  const resultado = await canal.send({ type: "broadcast", event: "senal", payload: senal });
  if (resultado !== "ok") {
    await supabase.removeChannel(canal);
    throw new Error(`No se pudo enviar la señal de llamada (${resultado}).`);
  }

  await supabase.removeChannel(canal);
}

export async function ofrecerLlamada(params: {
  conversacionId: string;
  llamadaId: string;
  roomName: string;
  paraId: string;
  deId: string;
  deNombre: string | null;
  deAvatar: string | null;
}): Promise<void> {
  await enviarSenal({
    tipo: "oferta",
    conversacionId: params.conversacionId,
    llamadaId: params.llamadaId,
    roomName: params.roomName,
    deId: params.deId,
    deNombre: params.deNombre,
    deAvatar: params.deAvatar,
    paraId: params.paraId,
  });
}

/**
 * Avisa a quien inició la llamada que fue aceptada, para que su lado
 * también pase a "conectada" y se conecte a LiveKit. Antes esta señal
 * nunca se enviaba: quien aceptaba se conectaba bien de su lado, pero
 * quien llamó se quedaba para siempre viendo "Llamando…" porque nada le
 * avisaba que ya podía conectarse.
 */
export async function aceptarLlamada(params: {
  conversacionId: string;
  llamadaId: string;
  roomName: string;
  paraId: string;
  deId: string;
}): Promise<void> {
  await enviarSenal({
    tipo: "aceptada",
    conversacionId: params.conversacionId,
    llamadaId: params.llamadaId,
    roomName: params.roomName,
    deId: params.deId,
    deNombre: null,
    deAvatar: null,
    paraId: params.paraId,
  });
}

export async function rechazarLlamada(params: {
  conversacionId: string;
  llamadaId: string;
  roomName: string;
  paraId: string;
  deId: string;
}): Promise<void> {
  await enviarSenal({
    tipo: "rechazada",
    conversacionId: params.conversacionId,
    llamadaId: params.llamadaId,
    roomName: params.roomName,
    deId: params.deId,
    deNombre: null,
    deAvatar: null,
    paraId: params.paraId,
  });
}

export async function colgarLlamada(params: {
  conversacionId: string;
  llamadaId: string;
  roomName: string;
  paraId: string;
  deId: string;
}): Promise<void> {
  await enviarSenal({
    tipo: "colgada",
    conversacionId: params.conversacionId,
    llamadaId: params.llamadaId,
    roomName: params.roomName,
    deId: params.deId,
    deNombre: null,
    deAvatar: null,
    paraId: params.paraId,
  });
}

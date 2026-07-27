/**
 * presenceEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Estado "en línea" y "escribiendo…", al estilo WhatsApp. Todo vive en
 * Supabase Realtime (Presence + Broadcast), sin tablas nuevas:
 *
 *   - "En línea": un único canal global (`presencia:global`) donde cada
 *     usuario logueado hace `track()` mientras tiene la app abierta. El
 *     estado de presencia de Realtime ya resuelve la desconexión sola
 *     (cuando se cierra la pestaña / se cae la conexión, Supabase lo saca
 *     del `presenceState()` automáticamente).
 *
 *   - "Escribiendo…": un broadcast efímero por conversación, sobre el mismo
 *     canal `mensajes:<conversacion_id>` que ya usa chatEngine para las
 *     inserciones. No se persiste en ningún lado — si el que lee no está
 *     conectado en ese momento, simplemente no lo ve, e igual que en
 *     WhatsApp el indicador tiene un timeout corto por si el evento de
 *     "paró de escribir" se pierde (typing se apaga solo a los 4s).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/infra/supabase/supabase";
import {
  _obtenerCanalConversacion,
  _liberarCanalConversacion,
  _usarCanalConversacionSinRef,
} from "@/infra/call/chatEngine";

// ─── Presencia global ("en línea") ─────────────────────────────────────────

let canalPresenciaGlobal: RealtimeChannel | null = null;
let subscriptoresPresencia = 0;

/**
 * Se conecta al canal de presencia global y empieza a trackear al usuario
 * actual como "en línea". Se debe llamar una sola vez (desde un componente
 * montado siempre, como el layout raíz) y se limpia con la función que
 * devuelve. Si se llama más de una vez, reutiliza el mismo canal.
 */
export function conectarPresencia(perfilId: string): () => void {
  subscriptoresPresencia++;

  if (!canalPresenciaGlobal) {
    canalPresenciaGlobal = supabase.channel("presencia:global", {
      config: { presence: { key: perfilId } },
    });
    canalPresenciaGlobal.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await canalPresenciaGlobal?.track({
          online_at: new Date().toISOString(),
        });
      }
    });
  }

  return () => {
    subscriptoresPresencia--;
    if (subscriptoresPresencia <= 0 && canalPresenciaGlobal) {
      supabase.removeChannel(canalPresenciaGlobal);
      canalPresenciaGlobal = null;
      subscriptoresPresencia = 0;
    }
  };
}

/**
 * Suscribe un callback a cambios en quién está en línea. Devuelve una
 * función de limpieza. Requiere que `conectarPresencia` ya se haya llamado
 * (si no, el set siempre viene vacío).
 */
export function suscribirseAPresencia(
  onCambio: (idsEnLinea: Set<string>) => void,
): () => void {
  if (!canalPresenciaGlobal) {
    onCambio(new Set());
    return () => {};
  }

  const leerEstado = () => {
    const estado = canalPresenciaGlobal?.presenceState() ?? {};
    onCambio(new Set(Object.keys(estado)));
  };

  canalPresenciaGlobal.on("presence", { event: "sync" }, leerEstado);
  canalPresenciaGlobal.on("presence", { event: "join" }, leerEstado);
  canalPresenciaGlobal.on("presence", { event: "leave" }, leerEstado);

  // Estado inicial, por si ya había datos al momento de suscribirse.
  leerEstado();

  return () => {
    // Para limpiar listeners en Supabase sin destruir el canal global,
    // volvemos a evaluar el estado o removemos la suscripción si corresponde.
    if (canalPresenciaGlobal && subscriptoresPresencia <= 0) {
      supabase.removeChannel(canalPresenciaGlobal);
      canalPresenciaGlobal = null;
    }
  };
}

// ─── "Escribiendo…" por conversación ───────────────────────────────────────

interface SenalEscribiendo {
  perfilId: string;
  escribiendo: boolean;
}

/**
 * Se suscribe a los eventos de "escribiendo" de una conversación puntual.
 * Usa el mismo canal compartido `mensajes:<conversacionId>` que chatEngine
 * (vía `_obtenerCanalConversacion`, reference-counted), así no duplicamos
 * el join al topic — antes cada módulo abría su propio canal con el mismo
 * nombre, lo que generaba conexiones que competían entre sí.
 *
 * Devuelve una función de limpieza; llamarla en el cleanup del efecto en
 * vez de `supabase.removeChannel`.
 */
export function suscribirseAEscribiendo(
  conversacionId: string,
  onCambio: (senal: SenalEscribiendo) => void,
): () => void {
  const entrada = _obtenerCanalConversacion(conversacionId);
  entrada.canal.on("broadcast", { event: "escribiendo" }, (payload) => {
    onCambio(payload.payload as SenalEscribiendo);
  });
  return () => _liberarCanalConversacion(conversacionId);
}

/**
 * Avisa a la conversación que el usuario actual está (o dejó de estar)
 * escribiendo. NO usa `_obtenerCanalConversacion`/`_liberarCanalConversacion`
 * — esta es una operación fugaz de una sola vez, y pisar el contador de refs
 * del canal compartido en cada tecleo podía destruir el canal mientras el
 * componente seguía montado (ver comentario en
 * `_usarCanalConversacionSinRef` en chatEngine.ts). Si todavía no hay una
 * suscripción real activa para esta conversación, no hay canal al que
 * mandarle nada — se ignora en silencio (no vale la pena crear un canal
 * solo para esto).
 */
export async function emitirEscribiendo(
  conversacionId: string,
  perfilId: string,
  escribiendo: boolean,
): Promise<void> {
  const entrada = _usarCanalConversacionSinRef(conversacionId);
  if (!entrada) return;
  try {
    await entrada.listo;
    await entrada.canal.send({
      type: "broadcast",
      event: "escribiendo",
      payload: { perfilId, escribiendo } as SenalEscribiendo,
    });
  } catch (err) {
    console.warn("No se pudo emitir la señal de 'escribiendo':", err);
  }
}

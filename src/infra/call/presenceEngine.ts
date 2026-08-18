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
  _agregarBindingYResuscribirSiHaceFalta,
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
 *
 * IMPORTANTE: esta función es solo LECTORA del canal global de presencia —
 * a diferencia del canal reference-counted por conversación de chatEngine,
 * el canal de presencia global vive y muere exclusivamente a través de
 * `conectarPresencia` / su función de limpieza (llamado una sola vez desde
 * `<PresenciaActivator />` en el layout raíz). Antes, el cleanup de acá
 * evaluaba `subscriptoresPresencia <= 0` y, si daba true, destruía
 * `canalPresenciaGlobal` con `supabase.removeChannel` — pero
 * `subscriptoresPresencia` es el contador de `conectarPresencia`, esta
 * función nunca lo incrementaba. Como `useUsuariosEnLinea` (que llama a
 * esta función) se monta y desmonta en cada pantalla que muestra el
 * indicador "en línea" (lista de mensajes, detalle de conversación, etc.),
 * cualquiera de esos desmontajes podía terminar destruyendo el canal
 * global compartido mientras otras pantallas seguían usándolo — y como
 * `canalPresenciaGlobal` quedaba en `null` sin que nada lo recreara (salvo
 * que cambie `user?.id`), el estado de "en línea" quedaba muerto para toda
 * la sesión hasta un refresh completo (F5). Ahora el cleanup solo remueve
 * los listeners que esta suscripción puntual agregó, y nunca toca el ciclo
 * de vida del canal en sí.
 */
export function suscribirseAPresencia(
  onCambio: (idsEnLinea: Set<string>) => void,
): () => void {
  if (!canalPresenciaGlobal) {
    onCambio(new Set());
    return () => {};
  }

  const canal = canalPresenciaGlobal;

  // RealtimeChannel no expone una forma pública de desregistrar un único
  // listener puntual (no hay `.off(event, cb)`) — la única API soportada
  // para "dejar de escuchar" es unsubscribe/removeChannel del canal
  // entero, que acá NO nos corresponde tocar (ver comentario arriba). Por
  // eso usamos un flag local: el listener queda colgado del canal para
  // siempre (mismo costo que tenía antes), pero deja de propagar eventos
  // en cuanto el componente se desmonta.
  let activo = true;

  const leerEstado = () => {
    if (!activo) return;
    const estado = canal.presenceState() ?? {};
    onCambio(new Set(Object.keys(estado)));
  };

  canal.on("presence", { event: "sync" }, leerEstado);
  canal.on("presence", { event: "join" }, leerEstado);
  canal.on("presence", { event: "leave" }, leerEstado);

  // Estado inicial, por si ya había datos al momento de suscribirse.
  leerEstado();

  return () => {
    // Nunca tocamos el canal en sí acá — ver nota arriba y en el docstring
    // de esta función. Solo dejamos de reenviar eventos a este callback.
    activo = false;
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
  // BUG que esto arregla: antes se llamaba `entrada.canal.on(...)`
  // directamente. Si el canal ya estaba `joined` (típico: chatEngine ya lo
  // dejó unido con sus bindings de `postgres_changes` antes de que este
  // efecto monte), el servidor nunca se enteraba de este binding de
  // `broadcast` nuevo — mismo bug de mismatch de bindings que
  // agregarBindingYResuscribirSiHaceFalta arregla para mensajes/lecturas/
  // reacciones, pero acá faltaba pasar por esa misma función. Resultado:
  // "escribiendo…" nunca llegaba, sin ningún error visible (el canal sigue
  // "joined" y postgres_changes sigue andando normal).
  _agregarBindingYResuscribirSiHaceFalta(conversacionId, entrada, (canal) => {
    canal.on("broadcast", { event: "escribiendo" }, (payload) => {
      onCambio(payload.payload as SenalEscribiendo);
    });
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

// ─── Explosión de emojis (mantener presionado un emoji del picker) ────────

interface SenalExplosionEmoji {
  perfilId: string;
  mensajeId: string;
  emoji: string;
  /** Identificador único por disparo, para poder distinguir dos explosiones
   *  seguidas del mismo emoji sobre el mismo mensaje (si no, React podría
   *  no darse cuenta de que hay que reanimar si el payload es idéntico). */
  disparoId: string;
}

/**
 * Se suscribe a las "explosiones" de emoji de una conversación — el efecto
 * estilo Instagram de mantener presionado un emoji del picker de reacciones
 * para mandar una lluvia grande de ese emoji, visible también para el otro
 * participante. Broadcast efímero puro (no se persiste ni cuenta como
 * reacción real, ver reaccionarAMensaje para eso) sobre el mismo canal
 * compartido que ya usa chatEngine.
 */
export function suscribirseAExplosionEmoji(
  conversacionId: string,
  onExplosion: (senal: SenalExplosionEmoji) => void,
): () => void {
  const entrada = _obtenerCanalConversacion(conversacionId);
  // Mismo bug y mismo fix que suscribirseAEscribiendo arriba: hay que pasar
  // por agregarBindingYResuscribirSiHaceFalta para que el binding de
  // broadcast se renegocie con el servidor si el canal ya estaba joined.
  _agregarBindingYResuscribirSiHaceFalta(conversacionId, entrada, (canal) => {
    canal.on("broadcast", { event: "explosion_emoji" }, (payload) => {
      onExplosion(payload.payload as SenalExplosionEmoji);
    });
  });
  return () => _liberarCanalConversacion(conversacionId);
}

/**
 * Dispara una explosión de emoji hacia la conversación (para el otro
 * participante) — el propio disparador ya la anima localmente al toque,
 * sin esperar el viaje de ida y vuelta por el canal (ver
 * `handleLongPressEmoji` en detalleConversacion.tsx).
 */
export async function emitirExplosionEmoji(
  conversacionId: string,
  perfilId: string,
  mensajeId: string,
  emoji: string,
): Promise<void> {
  const entrada = _usarCanalConversacionSinRef(conversacionId);
  if (!entrada) return;
  try {
    await entrada.listo;
    await entrada.canal.send({
      type: "broadcast",
      event: "explosion_emoji",
      payload: {
        perfilId,
        mensajeId,
        emoji,
        disparoId: `${perfilId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      } as SenalExplosionEmoji,
    });
  } catch (err) {
    console.warn("No se pudo emitir la explosión de emoji:", err);
  }
}

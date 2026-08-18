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
  _suscribirCanalDedicado,
  _obtenerCanalDedicadoParaEnviar,
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
 *
 * BUG que esto arregla: antes vivía en el canal compartido
 * `mensajes:<conversacionId>` (vía `_obtenerCanalConversacion`,
 * reference-counted), el mismo mecanismo que causaba el mismatch de
 * bindings en chatEngine. Cuando chatEngine migró sus suscripciones
 * críticas a canales dedicados (ver `suscribirseAMensajes` y compañía en
 * chatEngine.ts), ese canal compartido dejó de tener ningún
 * `postgres_changes` bind — pero "escribiendo" seguía dependiendo de él
 * igual, y sin nadie más manteniéndolo vivo de forma confiable, el
 * broadcast dejó de llegar (a nadie: ni emisor ni receptor lo veían).
 *
 * El fix: mismo patrón simple que ya usa el resto — canal PROPIO y
 * dedicado (topic `escribiendo:<id>`), con un solo `.on("broadcast", ...)`
 * seguido de un `.subscribe()` inmediato. Nada compartido, nada que
 * renegociar.
 */
export function suscribirseAEscribiendo(
  conversacionId: string,
  onCambio: (senal: SenalEscribiendo) => void,
): () => void {
  return _suscribirCanalDedicado("escribiendo", conversacionId, (canal) =>
    canal.on("broadcast", { event: "escribiendo" }, (payload) => {
      onCambio(payload.payload as SenalEscribiendo);
    }),
  );
}

/**
 * Avisa a la conversación que el usuario actual está (o dejó de estar)
 * escribiendo. Manda el broadcast por el canal dedicado `escribiendo:<id>`
 * que ya debe estar vivo porque este mismo componente llamó a
 * `suscribirseAEscribiendo` al montar. Si por algún motivo ese canal
 * todavía no existe (por ejemplo, se llama antes de que el efecto de
 * suscripción corra), se ignora en silencio — no vale la pena crear un
 * canal solo para esto.
 */
export async function emitirEscribiendo(
  conversacionId: string,
  perfilId: string,
  escribiendo: boolean,
): Promise<void> {
  const canal = _obtenerCanalDedicadoParaEnviar("escribiendo", conversacionId);
  if (!canal) return;
  try {
    await canal.send({
      type: "broadcast",
      event: "escribiendo",
      payload: { perfilId, escribiendo } as SenalEscribiendo,
    });
  } catch (err) {
    console.warn("No se pudo emitir la señal de 'escribiendo':", err);
  }
}

// ─── Explosión de emojis (mantener presionado un emoji del picker) ────────
//
// NOTA: la explosión en sí (la animación de "lluvia" de emojis) sigue
// siendo un efecto puramente visual y efímero — eso vive acá, como
// broadcast, para que se vea la animación en vivo mientras la otra persona
// tiene el chat abierto. Pero el RESULTADO de la explosión (cuántos
// corazones/emojis quedaron "pegados" al mensaje) ahora SÍ se persiste, en
// la tabla `mensaje_explosiones` (ver chatEngine.ts: `dispararExplosion`,
// `cargarExplosiones`, `suscribirseAExplosiones`) — así, si el otro
// participante no estaba con el chat abierto en el momento exacto de la
// explosión, igual la ve como una "pill" con varios emojis apilados al
// entrar a la conversación, en vez de perderse el evento para siempre.
//
// BUG que esto arregla (mismo que "escribiendo" arriba): vivía en el canal
// compartido `mensajes:<id>` que ya no tiene ningún binding activo del
// lado de chatEngine — ahora usa su propio canal dedicado.

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
 * Se suscribe a las "explosiones" de emoji EN VIVO de una conversación —
 * solo la animación efímera, para verla en el momento si el chat está
 * abierto. El resultado persistido (la "pill" con el conteo) llega por
 * `suscribirseAExplosiones` (postgres_changes sobre `mensaje_explosiones`,
 * en chatEngine.ts), no por acá.
 */
export function suscribirseAExplosionEmoji(
  conversacionId: string,
  onExplosion: (senal: SenalExplosionEmoji) => void,
): () => void {
  return _suscribirCanalDedicado("explosion", conversacionId, (canal) =>
    canal.on("broadcast", { event: "explosion_emoji" }, (payload) => {
      onExplosion(payload.payload as SenalExplosionEmoji);
    }),
  );
}

/**
 * Dispara la animación de explosión de emoji EN VIVO hacia la conversación
 * (para que el otro participante, si tiene el chat abierto, vea la lluvia
 * en el momento) — el propio disparador ya la anima localmente al toque,
 * sin esperar el viaje de ida y vuelta por el canal. Esto es puramente
 * cosmético y no persiste nada; para que la explosión quede guardada como
 * una "pill" de reacciones múltiples, ver `dispararExplosion` en
 * chatEngine.ts, que se llama en paralelo desde la UI.
 */
export async function emitirExplosionEmoji(
  conversacionId: string,
  perfilId: string,
  mensajeId: string,
  emoji: string,
): Promise<void> {
  const canal = _obtenerCanalDedicadoParaEnviar("explosion", conversacionId);
  if (!canal) return;
  try {
    await canal.send({
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

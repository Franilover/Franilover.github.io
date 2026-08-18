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
 *   - "Escribiendo…" y "explosión de emoji": broadcast efímero, cada uno con
 *     su propio canal dedicado por conversación (ver `_suscribirCanalDedicado`
 *     en chatEngine.ts). No se persisten (salvo el resultado final de la
 *     explosión, que sí queda guardado — ver `mensaje_explosiones` en
 *     chatEngine.ts) — si el que lee no está conectado en ese momento,
 *     simplemente no ve la animación en vivo, e igual que en WhatsApp el
 *     indicador de "escribiendo" tiene un timeout corto por si el evento de
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

/** @internal callbacks de `suscribirseAPresencia` que llegaron ANTES de que
 *  `conectarPresencia` creara el canal (o antes de que hubiera terminado de
 *  unirse) — se registran igual apenas el canal exista. */
type ListenerPresencia = () => void;
const listenersPresenciaPendientes = new Set<ListenerPresencia>();

/** @internal serializa los re-subscribes de `suscribirseAPresencia` cuando
 *  se engancha tarde a un canal ya `joined` (ver comentario en
 *  `registrar` más abajo) — mismo motivo que `entrada.listo` en
 *  chatEngine.ts: nunca dos `.subscribe()` en vuelo al mismo tiempo para el
 *  mismo canal. */
let colaResubscribePresencia: Promise<void> = Promise.resolve();

/**
 * Se conecta al canal de presencia global y empieza a trackear al usuario
 * actual como "en línea". Se debe llamar una sola vez (desde un componente
 * montado siempre, como el layout raíz) y se limpia con la función que
 * devuelve. Si se llama más de una vez, reutiliza el mismo canal.
 *
 * BUG que esto arregla: nadie veía nunca a nadie "en línea". El canal se
 * creaba acá y se hacía `.subscribe()` de inmediato — pero
 * `suscribirseAPresencia` (llamado por los hooks `useUsuariosEnLinea`/
 * `useEstaEnLinea` desde componentes que montan más tarde, como la lista de
 * conversaciones o el chat abierto) agregaba sus `.on("presence", ...)`
 * DESPUÉS de ese primer `.subscribe()`, sobre un canal que ya estaba
 * `joined`. Mismo mecanismo que el mismatch de bindings que ya arreglamos
 * en chatEngine.ts para postgres_changes: Phoenix/Realtime negocia qué
 * eventos escucha el cliente en el momento del join, así que un `.on()`
 * agregado después de esa negociación nunca le llega al servidor sin un
 * segundo `.subscribe()` — el canal seguía "joined" sin ningún error
 * visible, pero los eventos `sync`/`join`/`leave` jamás disparaban.
 *
 * El fix: los `.on("presence", ...)` de `suscribirseAPresencia` ahora se
 * cuelgan del canal ANTES de su primer `.subscribe()` (acá, en
 * `conectarPresencia`) en vez de después. Como el orden de montaje entre
 * `<PresenciaActivator />` (que llama a esto) y los hooks que leen presencia
 * no está garantizado, `suscribirseAPresencia` puede llegar antes o después
 * de que este canal exista — por eso hay una cola (`listenersPresenciaPendientes`)
 * de callbacks "quiero que me registres apenas el canal esté armado", que
 * se vacía acá mismo antes de suscribir.
 */
export function conectarPresencia(perfilId: string): () => void {
  subscriptoresPresencia++;

  if (!canalPresenciaGlobal) {
    canalPresenciaGlobal = supabase.channel("presencia:global", {
      config: { presence: { key: perfilId } },
    });
    // Enganchamos TODOS los listeners que ya estaban esperando, antes del
    // primer subscribe — así el servidor los conoce desde el join inicial.
    listenersPresenciaPendientes.forEach((registrar) => registrar());
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
 * función de limpieza.
 *
 * Si `canalPresenciaGlobal` todavía no existe (este hook montó antes que
 * `<PresenciaActivator />`, o antes de que `conectarPresencia` corriera),
 * encolamos el registro de los listeners para que `conectarPresencia` los
 * cuelgue del canal en el momento correcto (antes de su `.subscribe()`) en
 * cuanto lo cree — ver el comentario largo ahí para el porqué. Si el canal
 * ya existe, nos enganchamos directo (esto puede pasar si el canal ya
 * estaba `joined` de una sesión anterior sin haberse limpiado del todo,
 * pero es el caso raro; el flujo normal siempre pasa por la cola porque
 * `<PresenciaActivator />` vive en el layout raíz y monta antes que
 * cualquier pantalla que use este hook).
 */
export function suscribirseAPresencia(
  onCambio: (idsEnLinea: Set<string>) => void,
): () => void {
  let activo = true;
  let canalEnganchado: RealtimeChannel | null = null;

  const leerEstado = () => {
    if (!activo || !canalEnganchado) return;
    const estado = canalEnganchado.presenceState() ?? {};
    onCambio(new Set(Object.keys(estado)));
  };

  const registrar = () => {
    if (!canalPresenciaGlobal) return;
    const yaEstabaJoined =
      canalPresenciaGlobal.state === "joined" || canalPresenciaGlobal.state === "joining";
    canalEnganchado = canalPresenciaGlobal;
    canalEnganchado.on("presence", { event: "sync" }, leerEstado);
    canalEnganchado.on("presence", { event: "join" }, leerEstado);
    canalEnganchado.on("presence", { event: "leave" }, leerEstado);
    // Si el canal ya estaba unido antes de que este listener se agregara
    // (caso: `<PresenciaActivator />` montó y ya terminó su `.subscribe()`
    // antes de que este hook llegara a registrarse — el mismo escenario que
    // el bug original, solo que acá ya lo esperamos), hace falta un
    // re-subscribe para que el servidor renegocie la lista de eventos de
    // presence con este nuevo binding incluido. Si todavía no estaba
    // joined, no hace falta: quedará incluido en el primer subscribe.
    if (yaEstabaJoined) {
      const canalActual = canalEnganchado;
      colaResubscribePresencia = colaResubscribePresencia
        .catch(() => {})
        .then(() => {
          canalActual.subscribe();
        });
    }
    leerEstado();
  };

  if (canalPresenciaGlobal) {
    registrar();
  } else {
    listenersPresenciaPendientes.add(registrar);
    onCambio(new Set());
  }

  return () => {
    // Nunca tocamos el canal en sí acá — solo dejamos de reenviar eventos a
    // este callback puntual y sacamos el registro pendiente si nunca llegó
    // a engancharse (ej: el componente se desmontó antes de que
    // conectarPresencia creara el canal).
    activo = false;
    listenersPresenciaPendientes.delete(registrar);
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

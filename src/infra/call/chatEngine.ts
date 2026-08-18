/**
 * chatEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica de mensajería: conversaciones, mensajes, adjuntos y suscripciones
 * en tiempo real.
 *
 * Los mensajes ahora sí usan un caché local (Dexie/IndexedDB, tabla
 * `mensajes_cache`) para la carga inicial: `cargarMensajesConCache` devuelve
 * primero lo que ya está guardado del último visitado a esa conversación
 * (instantáneo, sin esperar red) y en paralelo dispara la query real contra
 * Supabase para revalidar — igual que el patrón que ya usa el resto de la
 * app (ver useSupabaseData). Realtime sigue siendo la fuente de verdad para
 * mensajes nuevos mientras el chat está abierto; el caché solo acelera el
 * primer pintado al entrar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface PerfilResumen {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

/** Diseño visual de la burbuja del mensaje. null/undefined = burbuja normal. */
export type EstiloBurbuja = "pensamiento" | "grito" | "experimental" | "kaomoji";

/** Animación aplicada a la burbuja. Hoy solo tiene efecto con estilo "kaomoji". */
export type AnimacionBurbuja = "flotar" | "latido" | "parpadeo";

export interface Mensaje {
  id: string;
  conversacion_id: string;
  remitente_id: string;
  contenido: string | null;
  adjunto_url: string | null;
  adjunto_tipo: "imagen" | "audio" | "archivo" | null;
  created_at: string;
  editado: boolean;
  eliminado: boolean;
  respuesta_a: string | null;
  estilo: EstiloBurbuja | null;
  animacion: AnimacionBurbuja | null;
}

export interface MensajeReaccion {
  id: string;
  mensaje_id: string;
  perfil_id: string;
  emoji: string;
  created_at: string;
}

export interface ConversacionResumen {
  id: string;
  es_grupo: boolean;
  nombre: string | null;
  ultimo_mensaje_at: string;
  otroParticipante: PerfilResumen | null; // solo relevante si !es_grupo
  ultimoMensaje: string | null;
  noLeidos: number;
}

// ─── Conversaciones ───────────────────────────────────────────────────────────

/**
 * Trae o crea una conversación 1 a 1 entre el usuario actual y `otroPerfilId`.
 * Evita duplicar conversaciones si ya existe una entre ambos.
 */
export async function obtenerOCrearConversacion1a1(
  otroPerfilId: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");
  if (user.id === otroPerfilId) {
    throw new Error("No podés iniciar una conversación con vos mismo.");
  }

  // Buscar conversaciones 1 a 1 donde participo, y ver si el otro también está.
  const { data: misConvs } = await supabase
    .from("conversacion_participantes")
    .select("conversacion_id, conversaciones!inner(es_grupo)")
    .eq("perfil_id", user.id)
    .eq("conversaciones.es_grupo", false);

  if (misConvs && misConvs.length > 0) {
    const ids = misConvs.map((c: any) => c.conversacion_id);
    const { data: coincidencia } = await supabase
      .from("conversacion_participantes")
      .select("conversacion_id")
      .in("conversacion_id", ids)
      .eq("perfil_id", otroPerfilId)
      .limit(1)
      .maybeSingle();

    if (coincidencia) return coincidencia.conversacion_id;
  }

  // No existe: crear conversación nueva + agregar ambos participantes.
  const { data: nuevaConv, error: errConv } = await supabase
    .from("conversaciones")
    .insert({ es_grupo: false, creado_por: user.id })
    .select("id")
    .single();
  if (errConv || !nuevaConv) throw errConv ?? new Error("No se pudo crear la conversación.");

  const { error: errPart } = await supabase.from("conversacion_participantes").insert([
    { conversacion_id: nuevaConv.id, perfil_id: user.id },
    { conversacion_id: nuevaConv.id, perfil_id: otroPerfilId },
  ]);
  if (errPart) throw errPart;

  return nuevaConv.id;
}

/**
 * Lista las conversaciones del usuario actual, ordenadas por actividad
 * reciente, con datos resumidos para pintar la lista (nombre del otro
 * participante, último mensaje, no leídos).
 */
export async function listarConversaciones(): Promise<ConversacionResumen[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: misParticipaciones } = await supabase
    .from("conversacion_participantes")
    .select(
      "conversacion_id, ultimo_leido_at, conversaciones!inner(id, es_grupo, nombre, ultimo_mensaje_at)",
    )
    .eq("perfil_id", user.id)
    .order("conversaciones(ultimo_mensaje_at)", { ascending: false });

  if (!misParticipaciones || misParticipaciones.length === 0) return [];

  const convIds = misParticipaciones.map((p: any) => p.conversacion_id);

  // Traer al "otro" participante de cada conversación 1 a 1, en un solo query.
  const { data: otrosParticipantes } = await supabase
    .from("conversacion_participantes")
    .select("conversacion_id, perfil_id, perfiles!inner(id, username, avatar_url)")
    .in("conversacion_id", convIds)
    .neq("perfil_id", user.id);

  const otroPorConv = new Map<string, PerfilResumen>();
  (otrosParticipantes ?? []).forEach((p: any) => {
    otroPorConv.set(p.conversacion_id, {
      id: p.perfiles.id,
      username: p.perfiles.username,
      avatar_url: p.perfiles.avatar_url,
    });
  });

  // Último mensaje + conteo de no leídos por conversación.
  const { data: ultimosMensajes } = await supabase
    .from("mensajes")
    .select("conversacion_id, contenido, created_at, remitente_id")
    .in("conversacion_id", convIds)
    .order("created_at", { ascending: false });

  const ultimoPorConv = new Map<string, { contenido: string | null; created_at: string }>();
  const noLeidosPorConv = new Map<string, number>();

  const leidoPorConv = new Map<string, string>();
  misParticipaciones.forEach((p: any) => leidoPorConv.set(p.conversacion_id, p.ultimo_leido_at));

  (ultimosMensajes ?? []).forEach((m: any) => {
    if (!ultimoPorConv.has(m.conversacion_id)) {
      ultimoPorConv.set(m.conversacion_id, { contenido: m.contenido, created_at: m.created_at });
    }
    const leido = leidoPorConv.get(m.conversacion_id);
    if (
      m.remitente_id !== user.id &&
      (!leido || new Date(m.created_at) > new Date(leido))
    ) {
      noLeidosPorConv.set(m.conversacion_id, (noLeidosPorConv.get(m.conversacion_id) ?? 0) + 1);
    }
  });

  return misParticipaciones
    .map((p: any) => {
      const conv = p.conversaciones;
      return {
        id: conv.id,
        es_grupo: conv.es_grupo,
        nombre: conv.nombre,
        ultimo_mensaje_at: conv.ultimo_mensaje_at,
        otroParticipante: otroPorConv.get(conv.id) ?? null,
        ultimoMensaje: ultimoPorConv.get(conv.id)?.contenido ?? null,
        noLeidos: noLeidosPorConv.get(conv.id) ?? 0,
      } as ConversacionResumen;
    })
    .sort(
      (a, b) => new Date(b.ultimo_mensaje_at).getTime() - new Date(a.ultimo_mensaje_at).getTime(),
    );
}

// ─── Mensajes ───────────────────────────────────────────────────────────────

/**
 * Trae los últimos `limite` mensajes de la conversación (por defecto 50).
 * Antes traía TODO el historial sin límite, lo cual es la causa principal
 * de que abrir un chat con mucha actividad tardara: en conversaciones
 * largas eso podía ser miles de filas en un solo `select("*")`. Pedimos los
 * más recientes en orden descendente (así el índice por created_at se usa
 * bien) y los damos vuelta para pintar de más viejo a más nuevo.
 */
export async function cargarMensajes(
  conversacionId: string,
  limite = 50,
  antesDe?: string,
): Promise<Mensaje[]> {
  let query = supabase
    .from("mensajes")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: false })
    .limit(limite);

  // Paginación "cargar mensajes anteriores": si viene un cursor, pedimos
  // los que son estrictamente más viejos que el primer mensaje que ya
  // tenemos pintado en pantalla.
  if (antesDe) {
    query = query.lt("created_at", antesDe);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Mensaje[]).reverse();
}

// ─── Caché local (Dexie) para carga inicial rápida ─────────────────────────

/** Lee del caché local los últimos `limite` mensajes de una conversación,
 *  ya ordenados de más viejo a más nuevo (mismo formato que cargarMensajes). */
async function leerMensajesDeCache(
  conversacionId: string,
  limite: number,
): Promise<Mensaje[]> {
  try {
    if (!db) return [];
    const rows = await (db as any).mensajes_cache
      .where("conversacion_id")
      .equals(conversacionId)
      .toArray();
    return (rows as Mensaje[])
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-limite);
  } catch {
    return [];
  }
}

/** Guarda/actualiza en caché los mensajes traídos de Supabase, sin bloquear
 *  el flujo principal (falla en silencio si Dexie no está disponible). */
async function guardarMensajesEnCache(mensajes: Mensaje[]): Promise<void> {
  if (mensajes.length === 0) return;
  try {
    if (!db) return;
    await (db as any).mensajes_cache.bulkPut(mensajes);
  } catch {}
}

async function borrarMensajeDeCache(mensajeId: string): Promise<void> {
  try {
    if (!db) return;
    await (db as any).mensajes_cache.delete(mensajeId);
  } catch {}
}

/**
 * Carga "cache-first" pensada para el montaje inicial del chat: devuelve
 * primero lo que ya tengamos en Dexie (si hay algo, instantáneo — sin
 * esperar red) y llama a `onRevalidado` cuando la respuesta real de
 * Supabase esté lista, con los datos frescos ya sincronizados al caché.
 *
 * Si no hay nada en caché todavía (primera vez que se abre esa conversación
 * en este dispositivo), `mensajesIniciales` viene vacío y hay que esperar
 * igual a `onRevalidado` — no hay forma de evitar ese primer round-trip.
 */
export async function cargarMensajesConCache(
  conversacionId: string,
  onRevalidado: (mensajes: Mensaje[]) => void,
  limite = 50,
): Promise<{ mensajesIniciales: Mensaje[]; desdeCache: boolean }> {
  const cacheados = await leerMensajesDeCache(conversacionId, limite);

  // Dispara la query real en paralelo, sin esperarla si ya teníamos algo
  // que mostrar. Si el caché estaba vacío, esta promesa es la única fuente
  // de datos y el llamador debe esperarla igual.
  void cargarMensajes(conversacionId, limite)
    .then((frescos) => {
      void guardarMensajesEnCache(frescos);
      onRevalidado(frescos);
    })
    .catch(() => {
      // Si falla la revalidación y no había caché, el error ya lo maneja
      // el llamador vía cargarMensajes() directo (ver detalleConversacion).
    });

  return { mensajesIniciales: cacheados, desdeCache: cacheados.length > 0 };
}

export async function enviarMensaje(
  conversacionId: string,
  contenido: string,
  adjunto?: { url: string; tipo: "imagen" | "audio" | "archivo" },
  respuestaAId?: string | null,
  estilo?: EstiloBurbuja | null,
  animacion?: AnimacionBurbuja | null,
): Promise<Mensaje> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");
  if (!contenido.trim() && !adjunto) throw new Error("El mensaje está vacío.");

  const { data: nuevoMensaje, error } = await supabase
    .from("mensajes")
    .insert({
      conversacion_id: conversacionId,
      remitente_id: user.id,
      contenido: contenido.trim() || null,
      adjunto_url: adjunto?.url ?? null,
      adjunto_tipo: adjunto?.tipo ?? null,
      respuesta_a: respuestaAId ?? null,
      estilo: estilo ?? null,
      animacion: animacion ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Push al/los destinatario/s. Fire-and-forget: si falla, no queremos que
  // el envío del mensaje (que ya se guardó bien) aparezca como error para
  // quien está escribiendo. La función decide del lado servidor a quién
  // pushear; acá no filtramos por "está en línea" porque el browser mismo
  // no muestra la notificación si la pestaña está enfocada y visible.
  if (nuevoMensaje?.id) {
    void dispararNotificacionMensaje(conversacionId, nuevoMensaje.id, user.id);
    void guardarMensajesEnCache([nuevoMensaje as Mensaje]);
  }

  return nuevoMensaje as Mensaje;
}

/**
 * Invoca la Edge Function `notify-message` para pushear a los demás
 * participantes de la conversación. No usa el patrón de `notify-subscribers`
 * (broadcast a todos) porque acá necesitamos targetear puntualmente a quien
 * corresponde; ver supabase/functions/notify-message/index.ts.
 */
async function dispararNotificacionMensaje(
  conversacionId: string,
  mensajeId: string,
  remitenteId: string,
): Promise<void> {
  try {
    await supabase.functions.invoke("notify-message", {
      body: { conversacionId, mensajeId, remitenteId },
    });
  } catch (err) {
    console.warn("No se pudo disparar la notificación push del mensaje:", err);
  }
}

/**
 * Edita el contenido de un mensaje propio. RLS en `mensajes` ya restringe
 * el UPDATE a `remitente_id = auth.uid()`, así que un intento de editar el
 * mensaje de otro simplemente no afecta filas (Supabase no tira error, pero
 * tampoco cambia nada) — igual chequeamos acá para dar mejor feedback.
 */
export async function editarMensaje(mensajeId: string, contenido: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");
  if (!contenido.trim()) throw new Error("El mensaje no puede quedar vacío.");

  const { error, count } = await supabase
    .from("mensajes")
    .update({ contenido: contenido.trim(), editado: true }, { count: "exact" })
    .eq("id", mensajeId)
    .eq("remitente_id", user.id);
  if (error) throw error;
  if (!count) throw new Error("No se pudo editar el mensaje.");

  try {
    if (db) {
      const fila = await (db as any).mensajes_cache.get(mensajeId);
      if (fila) {
        await (db as any).mensajes_cache.put({ ...fila, contenido: contenido.trim(), editado: true });
      }
    }
  } catch {}
}

/**
 * Elimina el mensaje de verdad (DELETE), no un borrado suave. El mensaje
 * desaparece por completo del hilo para todos — no queda ningún rastro tipo
 * "Mensaje eliminado". Si algún otro mensaje lo citaba con "responder a",
 * ese reply queda sin cita (respuesta_a se limpia solo por el ON DELETE SET
 * NULL de la FK) en vez de romperse.
 */
export async function eliminarMensaje(mensajeId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const { error, count } = await supabase
    .from("mensajes")
    .delete({ count: "exact" })
    .eq("id", mensajeId)
    .eq("remitente_id", user.id);
  if (error) throw error;
  if (!count) throw new Error("No se pudo eliminar el mensaje.");

  void borrarMensajeDeCache(mensajeId);
}

export async function marcarComoLeido(conversacionId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("conversacion_participantes")
    .update({ ultimo_leido_at: new Date().toISOString() })
    .eq("conversacion_id", conversacionId)
    .eq("perfil_id", user.id);
}

// ─── Canal compartido por conversación ─────────────────────────────────────
//
// ANTES: chatEngine (mensajes nuevos) y presenceEngine ("escribiendo…")
// creaban CADA UNO su propio `supabase.channel(\`mensajes:${id}\`)` con el
// mismo topic. Realtime/Phoenix permite tener dos joins distintos al mismo
// topic desde el mismo socket, pero en la práctica eso generaba joins que
// competían entre sí y se traducía en reconexiones erráticas y eventos que
// a veces no llegaban. Ahora hay un único canal por conversación,
// reference-counted, y ambos módulos cuelgan sus listeners del mismo canal
// antes de que se haga el `.subscribe()` (que se dispara recién en un
// microtask, dando tiempo a que todos los `.on()` ya estén registrados).

interface EntradaCanalConversacion {
  canal: RealtimeChannel;
  refs: number;
  listo: Promise<void>;
}

const canalesConversacion = new Map<string, EntradaCanalConversacion>();

/**
 * Fuerza la reconexión del socket de Realtime si se cayó (típico en mobile:
 * el browser suspende/mata el WebSocket cuando la pestaña pasa a background
 * o la pantalla se bloquea, y no siempre dispara un evento que el código
 * pueda escuchar para reaccionar solo). Pensado para llamarse al volver la
 * pestaña a primer plano (`visibilitychange` → "visible").
 *
 * IMPORTANTE: reconectar el socket no revive automáticamente los channels
 * que ya estaban unidos — hay que volver a unirlos. Como acá los canales
 * son reference-counted y viven en `canalesConversacion`, re-unimos todos
 * los que sigan activos.
 */
export function reconectarRealtimeSiHaceFalta(): void {
  if (supabase.realtime.isConnected()) return;
  supabase.realtime.connect();
  canalesConversacion.forEach((entrada) => {
    if (entrada.canal.state !== "joined" && entrada.canal.state !== "joining") {
      entrada.canal.subscribe();
    }
  });
}

/**
 * @internal Acceso al canal SIN tocar el contador de referencias. Pensado
 * para operaciones puntuales de una sola vez (como un `send` de broadcast)
 * que necesitan que el canal ya exista y esté vivo, pero que NO deben
 * afectar cuánto tiempo vive el canal — a diferencia de una suscripción
 * persistente, que sí debe pasar por `_obtenerCanalConversacion` /
 * `_liberarCanalConversacion` en su ciclo de vida (mount/unmount).
 *
 * BUG que esto arregla: `emitirEscribiendo` (en presenceEngine.ts) llamaba
 * a obtener/liberar en cada tecleo. Eso comparte el mismo contador que usan
 * las suscripciones reales del componente montado; si esa llamada fugaz
 * hacía bajar el contador a 0 en el momento equivocado (por ejemplo, justo
 * cuando el otro participante recién está montando sus propios listeners),
 * el canal entero se destruía con `supabase.removeChannel` aunque el
 * componente siguiera vivo y con handlers colgados de él — dejando a ese
 * usuario sin recibir más eventos realtime hasta que refrescaba la página
 * (remount total, que vuelve a pedir el canal desde cero).
 */
export function _usarCanalConversacionSinRef(conversacionId: string): EntradaCanalConversacion | null {
  const topic = `mensajes:${conversacionId}`;
  return canalesConversacion.get(topic) ?? null;
}

/** @internal usado también por presenceEngine.ts para "escribiendo…" */
export function _obtenerCanalConversacion(conversacionId: string): EntradaCanalConversacion {
  const topic = `mensajes:${conversacionId}`;
  let entrada = canalesConversacion.get(topic);
  if (!entrada) {
    const canal = supabase.channel(topic);
    const listo = suscribirCanal(canal, topic);
    entrada = { canal, refs: 0, listo };
    canalesConversacion.set(topic, entrada);
  }
  entrada.refs++;
  return entrada;
}

/**
 * BUG que esto arregla: Realtime/Phoenix negocia la lista de bindings
 * (los `.on("postgres_changes", ...)`) con el servidor en el momento del
 * primer `.subscribe()` de ese join. Si después de ese `.subscribe()`
 * alguien llama a `.on()` de nuevo sobre el MISMO canal ya `joined` (por
 * ejemplo: distintos hooks/efectos con distintas dependencias —
 * `suscribirseAMensajes` corre en un efecto que depende de
 * `[conversacionId]`, pero `suscribirseALecturas` corre en OTRO efecto que
 * además depende de `otroParticipante`, que suele resolverse un render
 * más tarde), el cliente termina con bindings que el servidor nunca
 * confirmó — de ahí el "mismatch between server and client bindings for
 * postgres changes" en consola, y ese canal queda roto para esa sesión sin
 * ningún error visible más allá del warning.
 *
 * El fix: cada vez que se agrega un `.on()` a un canal que ya está
 * `joined` (o a medio unir), se vuelve a suscribir para que el cliente
 * renegocie la lista completa de bindings con el servidor. `channel.on()`
 * ya devuelve el mismo channel con el binding agregado; solo hace falta
 * volver a llamar `.subscribe()` para que viaje al servidor.
 */
function suscribirCanal(canal: RealtimeChannel, topic: string): Promise<void> {
  return new Promise<void>((resolve) => {
    queueMicrotask(() => {
      canal.subscribe((status, err) => {
        // Diagnóstico: si el canal no llega a "SUBSCRIBED" (por ejemplo
        // CHANNEL_ERROR o TIMED_OUT), acá queda registrado en consola.
        // CHANNEL_ERROR suele significar que la policy de RLS de Realtime
        // sobre la tabla está rechazando al usuario actual (no puede leer
        // esa fila/conversación), no un problema de red — conviene mirar
        // la consola de quien reporta no ver mensajes.
        if (status === "SUBSCRIBED") {
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn(
            `[chatEngine] Canal "${topic}" no se pudo suscribir (status: ${status}).`,
            err ?? "",
          );
        }
      });
    });
  });
}

/**
 * @internal Registra un binding (`.on("postgres_changes", ...)`) en el
 * canal de la conversación y, si el canal ya estaba `joined`/`joining`,
 * fuerza un re-subscribe para que el servidor reciba la lista actualizada
 * de bindings. Todas las funciones `suscribirseA*` de este archivo deben
 * pasar por acá en vez de llamar `entrada.canal.on(...)` directamente —
 * ver el comentario de `suscribirCanal` arriba para el bug que esto evita.
 */
function agregarBindingYResuscribirSiHaceFalta(
  conversacionId: string,
  entrada: EntradaCanalConversacion,
  registrarBinding: (canal: RealtimeChannel) => void,
): void {
  const yaEstabaUnido = entrada.canal.state === "joined" || entrada.canal.state === "joining";
  registrarBinding(entrada.canal);
  if (yaEstabaUnido) {
    const topic = `mensajes:${conversacionId}`;
    entrada.listo = suscribirCanal(entrada.canal, topic);
  }
}

/** @internal contraparte de _obtenerCanalConversacion
 *
 * BUG que esto arregla: `supabase.removeChannel()` es asíncrono (devuelve
 * una Promise que se resuelve cuando el servidor confirma el cierre), pero
 * acá se llamaba sin esperarla (`supabase.removeChannel(entrada.canal)`
 * sin `await`, dentro de una función `void`). El `delete` del mapa local
 * pasaba en el mismo tick — así que un nuevo `_obtenerCanalConversacion`
 * para la MISMA conversación (típico: el usuario sale y vuelve a entrar al
 * chat rápido) creaba un canal completamente nuevo mientras el anterior
 * todavía estaba a medio cerrar del lado del servidor de Realtime. Con uso
 * normal (entrar/salir de conversaciones seguido) esto acumulaba canales
 * huérfanos sin que el cliente se enterara, hasta pegar contra el límite
 * del servidor ("ChannelRateLimitReached: Too many channels") — momento en
 * el que CUALQUIER usuario que intentara abrir una suscripción nueva se
 * quedaba sin poder unirse (ni siquiera ver sus propios mensajes), aunque
 * otro usuario con un canal más viejo ya "enganchado" siguiera funcionando
 * con normalidad. Ahora la entrada se saca del mapa de forma síncrona
 * (para que nadie más pueda reengancharse a un canal que ya está cerrando)
 * pero se espera la promesa de `removeChannel` antes de dar el cierre por
 * completo, y se loguea si el servidor no confirma un cierre limpio.
 */
export function _liberarCanalConversacion(conversacionId: string): void {
  const topic = `mensajes:${conversacionId}`;
  const entrada = canalesConversacion.get(topic);
  if (!entrada) return;
  entrada.refs--;
  if (entrada.refs <= 0) {
    // Sacamos la entrada YA (síncrono): así, si alguien vuelve a pedir este
    // mismo topic mientras el removeChannel de abajo sigue en curso,
    // _obtenerCanalConversacion ve el mapa vacío y crea un canal nuevo
    // limpio, en vez de reengancharse a uno que está a medio morir.
    canalesConversacion.delete(topic);
    void supabase.removeChannel(entrada.canal).then((resultado) => {
      if (resultado !== "ok") {
        console.warn(
          `[chatEngine] El canal "${topic}" no se cerró limpiamente (resultado: ${resultado}). ` +
            "Si esto se repite seguido, revisar el server de Realtime por acumulación de canales.",
        );
      }
    });
  }
}

/**
 * Suscripción en vivo a mensajes nuevos de una conversación.
 * Devuelve una función de limpieza (ya NO un RealtimeChannel crudo) —
 * llamarla en el cleanup del efecto en vez de `supabase.removeChannel`.
 */
export function suscribirseAMensajes(
  conversacionId: string,
  onNuevoMensaje: (mensaje: Mensaje) => void,
): () => void {
  const entrada = _obtenerCanalConversacion(conversacionId);
  agregarBindingYResuscribirSiHaceFalta(conversacionId, entrada, (canal) => {
    canal.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "mensajes",
        filter: `conversacion_id=eq.${conversacionId}`,
      },
      (payload) => onNuevoMensaje(payload.new as Mensaje),
    );
  });
  return () => _liberarCanalConversacion(conversacionId);
}

/**
 * Suscripción en vivo a ediciones de mensajes existentes de la conversación
 * (columna `editado`). Comparte el mismo canal reference-counted que el
 * resto.
 */
export function suscribirseAMensajesEditados(
  conversacionId: string,
  onMensajeActualizado: (mensaje: Mensaje) => void,
): () => void {
  const entrada = _obtenerCanalConversacion(conversacionId);
  agregarBindingYResuscribirSiHaceFalta(conversacionId, entrada, (canal) => {
    canal.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "mensajes",
        filter: `conversacion_id=eq.${conversacionId}`,
      },
      (payload) => onMensajeActualizado(payload.new as Mensaje),
    );
  });
  return () => _liberarCanalConversacion(conversacionId);
}

/**
 * Suscripción en vivo a mensajes eliminados de la conversación. Como
 * eliminarMensaje ahora borra la fila de verdad (no soft-delete), esto es
 * lo que le avisa al otro participante que el mensaje desapareció, para
 * sacarlo de su pantalla también en tiempo real.
 */
export function suscribirseAMensajesEliminados(
  conversacionId: string,
  onMensajeEliminado: (mensajeId: string) => void,
): () => void {
  const entrada = _obtenerCanalConversacion(conversacionId);
  agregarBindingYResuscribirSiHaceFalta(conversacionId, entrada, (canal) => {
    canal.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "mensajes",
        filter: `conversacion_id=eq.${conversacionId}`,
      },
      (payload) => onMensajeEliminado((payload.old as Mensaje).id),
    );
  });
  return () => _liberarCanalConversacion(conversacionId);
}

/**
 * Suscripción en vivo a cambios de `ultimo_leido_at` de los participantes de
 * la conversación — es lo que dispara el doble check / "visto" en la UI.
 * No filtra por perfil porque el filtro de postgres_changes no puede andar
 * sobre `conversacion_id` de esta tabla combinado con excluir al usuario
 * propio; el callback filtra eso del lado del cliente.
 */
export function suscribirseALecturas(
  conversacionId: string,
  onLectura: (participacion: { perfil_id: string; ultimo_leido_at: string | null }) => void,
): () => void {
  const entrada = _obtenerCanalConversacion(conversacionId);
  agregarBindingYResuscribirSiHaceFalta(conversacionId, entrada, (canal) => {
    canal.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversacion_participantes",
        filter: `conversacion_id=eq.${conversacionId}`,
      },
      (payload) => {
        const fila = payload.new as { perfil_id: string; ultimo_leido_at: string | null };
        onLectura(fila);
      },
    );
  });
  return () => _liberarCanalConversacion(conversacionId);
}

/** Suscripción en vivo a nuevas conversaciones/actividad, para la lista general. */
export function suscribirseAConversaciones(
  perfilId: string,
  onCambio: () => void,
): RealtimeChannel {
  return supabase
    .channel(`conversaciones:${perfilId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "mensajes" },
      () => onCambio(),
    )
    .subscribe();
}

// ─── Adjuntos ───────────────────────────────────────────────────────────────

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const TIPOS_AUDIO = ["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm"];
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB, igual al límite del bucket

export async function subirAdjunto(
  conversacionId: string,
  file: File,
): Promise<{ url: string; tipo: "imagen" | "audio" | "archivo" }> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("El archivo supera el límite de 25MB.");
  }

  const tipo: "imagen" | "audio" | "archivo" = TIPOS_IMAGEN.includes(file.type)
    ? "imagen"
    : TIPOS_AUDIO.includes(file.type)
      ? "audio"
      : "archivo";

  const extension = file.name.split(".").pop() ?? "bin";
  const nombreArchivo = `${crypto.randomUUID()}.${extension}`;
  const path = `${conversacionId}/${nombreArchivo}`;

  const { error } = await supabase.storage.from("mensajes-adjuntos").upload(path, file);
  if (error) throw error;

  // Bucket privado: generamos una URL firmada de larga duración (7 días).
  const { data, error: errUrl } = await supabase.storage
    .from("mensajes-adjuntos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (errUrl || !data) throw errUrl ?? new Error("No se pudo generar la URL del adjunto.");

  return { url: data.signedUrl, tipo };
}

// ─── Bloqueos ───────────────────────────────────────────────────────────────

export async function bloquearUsuario(perfilId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("bloqueos").insert({ bloqueador_id: user.id, bloqueado_id: perfilId });
}

export async function desbloquearUsuario(perfilId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("bloqueos")
    .delete()
    .eq("bloqueador_id", user.id)
    .eq("bloqueado_id", perfilId);
}

export async function estaBloqueado(perfilId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("bloqueos")
    .select("bloqueador_id")
    .eq("bloqueador_id", user.id)
    .eq("bloqueado_id", perfilId)
    .maybeSingle();
  return !!data;
}

// ─── Doble check / visto ────────────────────────────────────────────────────

/** Trae el `ultimo_leido_at` actual del otro participante de una conversación 1 a 1. */
export async function obtenerUltimoLeidoDeOtro(
  conversacionId: string,
  otroPerfilId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("conversacion_participantes")
    .select("ultimo_leido_at")
    .eq("conversacion_id", conversacionId)
    .eq("perfil_id", otroPerfilId)
    .maybeSingle();
  return data?.ultimo_leido_at ?? null;
}

// ─── Reacciones ─────────────────────────────────────────────────────────────

export async function reaccionarAMensaje(
  mensajeId: string,
  emoji: string,
  conversacionId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");
  // upsert: si el usuario ya puso ese mismo emoji, no duplica (unique de la tabla).
  // conversacion_id es NOT NULL en la tabla y además lo exige la policy RLS
  // de INSERT (es_participante(conversacion_id)) — sin mandarlo, Postgres
  // rechaza el insert con 400 antes de siquiera evaluar el conflicto.
  const { error } = await supabase
    .from("mensaje_reacciones")
    .upsert(
      { mensaje_id: mensajeId, perfil_id: user.id, emoji, conversacion_id: conversacionId },
      { onConflict: "mensaje_id,perfil_id,emoji", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function quitarReaccion(mensajeId: string, emoji: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("mensaje_reacciones")
    .delete()
    .eq("mensaje_id", mensajeId)
    .eq("perfil_id", user.id)
    .eq("emoji", emoji);
}

/** Trae todas las reacciones de los mensajes visibles actualmente (para el load inicial). */
export async function cargarReacciones(mensajeIds: string[]): Promise<MensajeReaccion[]> {
  if (mensajeIds.length === 0) return [];
  const { data, error } = await supabase
    .from("mensaje_reacciones")
    .select("*")
    .in("mensaje_id", mensajeIds);
  if (error) throw error;
  return (data ?? []) as MensajeReaccion[];
}

/**
 * Suscripción en vivo a reacciones nuevas/borradas de la conversación.
 * Comparte el mismo canal reference-counted que el resto de chatEngine.
 */
export function suscribirseAReacciones(
  conversacionId: string,
  onCambio: (evento: "INSERT" | "DELETE", reaccion: MensajeReaccion) => void,
): () => void {
  const entrada = _obtenerCanalConversacion(conversacionId);
  agregarBindingYResuscribirSiHaceFalta(conversacionId, entrada, (canal) => {
    canal
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensaje_reacciones" },
        (payload) => onCambio("INSERT", payload.new as MensajeReaccion),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "mensaje_reacciones" },
        (payload) => onCambio("DELETE", payload.old as MensajeReaccion),
      );
  });
  return () => _liberarCanalConversacion(conversacionId);
}

// ─── Búsqueda de usuarios (para iniciar conversación) ────────────────────────

export async function buscarPerfiles(query: string): Promise<PerfilResumen[]> {
  if (!query.trim()) return [];
  const { data } = await supabase
    .from("perfiles")
    .select("id, username, avatar_url")
    .ilike("username", `%${query.trim()}%`)
    .limit(10);
  return (data ?? []) as PerfilResumen[];
}

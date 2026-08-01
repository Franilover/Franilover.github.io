"use client";

import { ArrowLeft, Check, CheckCheck, Paperclip, Phone, Reply, Send, SmilePlus, Trash2, X } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { Loading } from "@/ui";
import { SmartImage } from "@/ui/SmartImage";
import { useLlamadaStore } from "@/infra/realtime/useLlamadaStore";
import { useEstaEnLinea } from "@/infra/realtime/useEnLinea";
import {
  cargarMensajes,
  cargarReacciones,
  editarMensaje,
  eliminarMensaje,
  enviarMensaje,
  marcarComoLeido,
  obtenerUltimoLeidoDeOtro,
  quitarReaccion,
  reaccionarAMensaje,
  reconectarRealtimeSiHaceFalta,
  subirAdjunto,
  suscribirseALecturas,
  suscribirseAMensajes,
  suscribirseAMensajesEditados,
  suscribirseAMensajesEliminados,
  suscribirseAReacciones,
  type Mensaje,
  type MensajeReaccion,
  type PerfilResumen,
} from "@/infra/call/chatEngine";
import { crearLlamada, ofrecerLlamada } from "@/infra/call/callEngine";
import {
  emitirEscribiendo,
  suscribirseAEscribiendo,
} from "@/infra/call/presenceEngine";
import { supabase } from "@/infra/supabase/supabase";
import { useAuth } from "@/providers/AuthProvider";

/** Texto corto para mostrar como preview de un mensaje citado (reply). */
function previsualizarMensaje(m: Mensaje): string {
  if (m.contenido) return m.contenido;
  if (m.adjunto_tipo === "imagen") return "📷 Foto";
  if (m.adjunto_tipo === "audio") return "🎵 Audio";
  if (m.adjunto_tipo === "archivo") return "📎 Archivo";
  return "Mensaje";
}

export default function DetalleConversacion() {
  const searchParams = useSearchParams();
  // El id real de la conversación viaja siempre como ?id=..., leído con
  // useSearchParams (misma ruta estática en web y en el APK de Tauri).
  const conversacionId = searchParams.get("id") ?? "";

  const router = useRouter();
  const { user } = useAuth() as { user: any };

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otroParticipante, setOtroParticipante] = useState<PerfilResumen | null>(null);
  const [otroEscribiendo, setOtroEscribiendo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const escribiendoOffRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otroEscribiendoOffRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Doble check / visto ──────────────────────────────────────────────
  const [otroUltimoLeido, setOtroUltimoLeido] = useState<string | null>(null);

  // ── Reacciones ───────────────────────────────────────────────────────
  const [reacciones, setReacciones] = useState<MensajeReaccion[]>([]);
  const [pickerAbiertoPara, setPickerAbiertoPara] = useState<string | null>(null);
  const EMOJIS_RAPIDOS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

  // ── Editar / eliminar mensaje propio ────────────────────────────────
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");
  const [menuAbiertoPara, setMenuAbiertoPara] = useState<string | null>(null);

  // ── Responder a un mensaje (quote/reply) ────────────────────────────
  const [respondiendoA, setRespondiendoA] = useState<Mensaje | null>(null);

  // ── Paginación "cargar mensajes anteriores" ─────────────────────────
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [hayMasAnteriores, setHayMasAnteriores] = useState(true);
  const scrollHeightPrevioRef = useRef<number | null>(null);

  const otroEnLinea = useEstaEnLinea(otroParticipante?.id);

  const iniciarLlamando = useLlamadaStore((s) => s.iniciarLlamando);
  const estadoLlamada = useLlamadaStore((s) => s.estado);

  // Traemos los datos del otro participante para el header y para poder
  // ofrecerle la llamada (nombre/avatar que se muestran en su pantalla).
  useEffect(() => {
    if (!conversacionId || !user) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("conversacion_participantes")
        .select("perfil_id, perfiles!inner(id, username, avatar_url)")
        .eq("conversacion_id", conversacionId)
        .neq("perfil_id", user.id)
        .maybeSingle();
      if (mounted && data) {
        const p: any = (data as any).perfiles;
        setOtroParticipante({ id: p.id, username: p.username, avatar_url: p.avatar_url });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [conversacionId, user]);

  const handleLlamar = async () => {
    if (!user || !otroParticipante || estadoLlamada !== "inactiva") return;
    try {
      const { id: llamadaId, roomName } = await crearLlamada(conversacionId, "audio");
      iniciarLlamando({
        conversacionId,
        llamadaId,
        roomName,
        otro: {
          id: otroParticipante.id,
          nombre: otroParticipante.username,
          avatar: otroParticipante.avatar_url,
        },
      });
      await ofrecerLlamada({
        conversacionId,
        llamadaId,
        roomName,
        paraId: otroParticipante.id,
        deId: user.id,
        deNombre: user.user_metadata?.username ?? user.email ?? null,
        deAvatar: user.user_metadata?.avatar_url ?? null,
      });
    } catch {
      setError("No se pudo iniciar la llamada.");
    }
  };

  useEffect(() => {
    if (!conversacionId) return;
    let mounted = true;
    setHayMasAnteriores(true);

    (async () => {
      setLoading(true);
      try {
        const data = await cargarMensajes(conversacionId);
        if (mounted) {
          setMensajes(data);
          setHayMasAnteriores(data.length >= 50);
        }
        void marcarComoLeido(conversacionId);
        if (data.length > 0) {
          const reacc = await cargarReacciones(data.map((m) => m.id));
          if (mounted) setReacciones(reacc);
        }
      } catch {
        if (mounted) setError("No se pudo cargar la conversación.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const desuscribirMensajes = suscribirseAMensajes(conversacionId, (m) => {
      setMensajes((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
      void marcarComoLeido(conversacionId);
    });

    const desuscribirEditados = suscribirseAMensajesEditados(conversacionId, (m) => {
      setMensajes((prev) => prev.map((p) => (p.id === m.id ? m : p)));
    });

    // Ahora que eliminar borra la fila de verdad (no soft-delete), esto es
    // lo que le avisa al otro participante en tiempo real para sacar el
    // mensaje de su pantalla también. Si algún mensaje lo estaba citando
    // como reply, le limpiamos la cita en vez de dejarla colgada.
    const desuscribirEliminados = suscribirseAMensajesEliminados(conversacionId, (mensajeId) => {
      setMensajes((prev) =>
        prev
          .filter((p) => p.id !== mensajeId)
          .map((p) => (p.respuesta_a === mensajeId ? { ...p, respuesta_a: null } : p)),
      );
      setReacciones((prev) => prev.filter((r) => r.mensaje_id !== mensajeId));
      setRespondiendoA((prev) => (prev?.id === mensajeId ? null : prev));
    });

    const desuscribirReacciones = suscribirseAReacciones(conversacionId, (evento, r) => {
      setReacciones((prev) => {
        if (evento === "INSERT") {
          return prev.some((p) => p.id === r.id) ? prev : [...prev, r];
        }
        return prev.filter(
          (p) => !(p.mensaje_id === r.mensaje_id && p.perfil_id === r.perfil_id && p.emoji === r.emoji),
        );
      });
    });

    return () => {
      mounted = false;
      desuscribirMensajes();
      desuscribirEditados();
      desuscribirEliminados();
      desuscribirReacciones();
    };
  }, [conversacionId]);

  // Doble check / visto: leemos el estado inicial y escuchamos cambios en
  // `conversacion_participantes` (ultimo_leido_at del otro participante),
  // sobre el mismo canal compartido de la conversación.
  useEffect(() => {
    if (!conversacionId || !otroParticipante) return;
    let mounted = true;

    void obtenerUltimoLeidoDeOtro(conversacionId, otroParticipante.id).then((valor) => {
      if (mounted) setOtroUltimoLeido(valor);
    });

    const desuscribirLecturas = suscribirseALecturas(conversacionId, (participacion) => {
      if (participacion.perfil_id !== otroParticipante.id) return;
      setOtroUltimoLeido(participacion.ultimo_leido_at);
    });

    return () => {
      mounted = false;
      desuscribirLecturas();
    };
  }, [conversacionId, otroParticipante]);

  // ── Recuperación al volver de background (clave en mobile) ─────────────
  // En mobile es común que el browser suspenda o mate el WebSocket de
  // Realtime cuando la pestaña/PWA pasa a segundo plano o se bloquea la
  // pantalla, sin que el código reciba ningún evento para reaccionar solo.
  // Sin este handler, la sesión queda con el canal "colgado" — se ve como
  // si el chat funcionara pero no llegara nada nuevo — hasta que se fuerza
  // un remount con F5. Al volver a "visible": forzamos la reconexión del
  // socket + re-join de los canales activos, y además hacemos un refetch
  // completo como red de seguridad (por si igual se perdió algún evento
  // mientras el canal se estaba reenganchando).
  useEffect(() => {
    if (!conversacionId) return;

    const handleVisibilidad = () => {
      if (document.visibilityState !== "visible") return;
      reconectarRealtimeSiHaceFalta();

      (async () => {
        try {
          const data = await cargarMensajes(conversacionId);
          setMensajes((prev) => {
            // Si mientras tanto el usuario scrolleó y cargó mensajes más
            // viejos que los últimos 50, no los pisamos: solo refrescamos
            // los últimos 50 y dejamos el resto del historial ya cargado.
            const idsNuevos = new Set(data.map((m) => m.id));
            const previosNoTraidos = prev.filter((p) => !idsNuevos.has(p.id));
            return [...previosNoTraidos, ...data].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );
          });
          void marcarComoLeido(conversacionId);
          if (data.length > 0) {
            const reacc = await cargarReacciones(data.map((m) => m.id));
            setReacciones((prev) => {
              const idsMensajesRefrescados = new Set(data.map((m) => m.id));
              const previasFueraDelRango = prev.filter(
                (p) => !idsMensajesRefrescados.has(p.mensaje_id),
              );
              return [...previasFueraDelRango, ...reacc];
            });
          }
        } catch {
          // Silencioso: si esto falla, las suscripciones realtime (ya
          // reconectadas arriba) deberían seguir trayendo lo que falte.
        }
      })();
    };

    document.addEventListener("visibilitychange", handleVisibilidad);
    window.addEventListener("focus", handleVisibilidad);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilidad);
      window.removeEventListener("focus", handleVisibilidad);
    };
  }, [conversacionId]);

  /** Pide los siguientes 50 mensajes más viejos que el primero que ya tenemos. */
  const handleCargarAnteriores = async () => {
    if (cargandoAnteriores || !hayMasAnteriores || mensajes.length === 0) return;
    setCargandoAnteriores(true);
    scrollHeightPrevioRef.current = scrollRef.current?.scrollHeight ?? null;
    try {
      const masViejos = await cargarMensajes(conversacionId, 50, mensajes[0].created_at);
      if (masViejos.length === 0) {
        setHayMasAnteriores(false);
      } else {
        setMensajes((prev) => [...masViejos, ...prev]);
        if (masViejos.length < 50) setHayMasAnteriores(false);
        const reacc = await cargarReacciones(masViejos.map((m) => m.id));
        setReacciones((prev) => [...prev, ...reacc]);
      }
    } catch {
      setError("No se pudieron cargar los mensajes anteriores.");
    } finally {
      setCargandoAnteriores(false);
    }
  };

  // Mantiene la posición de scroll al insertar mensajes viejos arriba (sin
  // esto, el navegador salta al tope de golpe al crecer el contenido).
  useEffect(() => {
    if (scrollHeightPrevioRef.current == null || !scrollRef.current) return;
    const nuevoAlto = scrollRef.current.scrollHeight;
    scrollRef.current.scrollTop = nuevoAlto - scrollHeightPrevioRef.current;
    scrollHeightPrevioRef.current = null;
  }, [mensajes]);

  // Autoscroll al fondo. Al abrir el chat (o cambiar de conversación) el
  // salto es instantáneo — nadie quiere ver la animación subiendo desde
  // arriba cada vez que entra a un chat con historial. Para mensajes nuevos
  // que llegan mientras ya está abierto, el scroll es suave.
  const scrolleoInicialHechoRef = useRef(false);

  useEffect(() => {
    scrolleoInicialHechoRef.current = false;
  }, [conversacionId]);

  useEffect(() => {
    if (!scrollRef.current || mensajes.length === 0) return;
    // Si el cambio vino de "cargar anteriores", el otro efecto ya se encarga
    // de reposicionar el scroll — no lo pisamos saltando al fondo.
    if (scrollHeightPrevioRef.current != null) return;

    const esInicial = !scrolleoInicialHechoRef.current;
    const irAlFondo = (comportamiento: ScrollBehavior) => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: comportamiento });
    };

    if (esInicial) {
      // El contenedor de mensajes recién se montó en este mismo commit (antes
      // se mostraba <Loading /> en su lugar), así que el navegador puede no
      // haber terminado el layout todavía — hacer scrollTo ya mismo a veces
      // calcula contra un scrollHeight incompleto y el chat queda "a medias"
      // arriba, obligando a scrollear a mano. Un solo rAF no alcanza porque
      // el layout puede seguir cambiando por imágenes (avatares, adjuntos)
      // que todavía no bajaron su primer frame; usamos dos rAF encadenados
      // para asegurarnos de correr después de un paint real ya estabilizado.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => irAlFondo("auto"));
      });
      scrolleoInicialHechoRef.current = true;
    } else {
      // Mensajes nuevos con el chat ya abierto: si el usuario está cerca del
      // fondo (leyendo la conversación al día), lo seguimos bajando en
      // automático con scroll suave — como WhatsApp. Si se fue a leer
      // mensajes viejos más arriba, no le interrumpimos la lectura
      // saltándole el scroll cada vez que llega algo nuevo del otro.
      // Excepción: si el mensaje nuevo es propio (uno mismo lo acaba de
      // enviar), siempre bajamos — no tendría sentido no ver lo que uno
      // mismo escribió, aunque estuviera leyendo historial más arriba.
      const contenedor = scrollRef.current;
      const distanciaAlFondo = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight;
      const ultimoMensaje = mensajes[mensajes.length - 1];
      const esMio = ultimoMensaje?.remitente_id === user?.id;
      if (esMio || distanciaAlFondo <= 150) irAlFondo("smooth");
    }
  }, [mensajes.length]);

  // Al aparecer la burbuja de "escribiendo…", la acercamos a la vista con
  // scroll suave — pero solo si el usuario ya estaba cerca del fondo (si
  // está leyendo mensajes viejos más arriba, no le interrumpimos la lectura
  // solo porque el otro empezó a tipear).
  useEffect(() => {
    if (!otroEscribiendo || !scrollRef.current) return;
    const contenedor = scrollRef.current;
    const distanciaAlFondo = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight;
    if (distanciaAlFondo > 150) return;
    contenedor.scrollTo({ top: contenedor.scrollHeight, behavior: "smooth" });
  }, [otroEscribiendo]);

  // Red de seguridad adicional para el caso más común de layout tardío:
  // avatares y adjuntos de imagen que terminan de cargar después del salto
  // inicial y empujan el contenido, dejando el scroll corto. Mientras seguimos
  // en la carga inicial de esta conversación, cualquier <img> que termine de
  // cargar dentro del contenedor vuelve a fijar el scroll al fondo.
  useEffect(() => {
    const contenedor = scrollRef.current;
    if (!contenedor || mensajes.length === 0) return;

    let yaLlego = false;
    const reforzarScroll = () => {
      if (yaLlego || !contenedor) return;
      // Si el usuario ya scrolleó manualmente hacia arriba, no lo interrumpimos.
      const distanciaAlFondo =
        contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight;
      if (distanciaAlFondo > 150) return;
      contenedor.scrollTop = contenedor.scrollHeight;
    };
    const marcarLlegada = () => {
      yaLlego = true;
    };

    const imgs = Array.from(contenedor.querySelectorAll("img"));
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", reforzarScroll);
    });
    // Si el usuario scrollea a mano mientras las imágenes siguen cargando,
    // dejamos de "pelearle" el scroll.
    contenedor.addEventListener("wheel", marcarLlegada, { passive: true });
    contenedor.addEventListener("touchmove", marcarLlegada, { passive: true });

    return () => {
      imgs.forEach((img) => img.removeEventListener("load", reforzarScroll));
      contenedor.removeEventListener("wheel", marcarLlegada);
      contenedor.removeEventListener("touchmove", marcarLlegada);
    };
    // Solo re-evaluamos cuando cambia la conversación o llega un mensaje
    // nuevo (nuevo adjunto potencial) — no en cada re-render por otros estados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacionId, mensajes.length]);

  // ── Indicador "escribiendo…" del otro participante ──────────────────────
  useEffect(() => {
    if (!conversacionId || !user) return;

    const desuscribirEscribiendo = suscribirseAEscribiendo(conversacionId, (senal) => {
      if (senal.perfilId === user.id) return; // ignorar nuestras propias señales

      if (otroEscribiendoOffRef.current) clearTimeout(otroEscribiendoOffRef.current);

      if (senal.escribiendo) {
        setOtroEscribiendo(true);
        // Salvavidas: si nunca llega la señal de "paró de escribir" (se
        // cerró la app, se cayó la conexión), lo apagamos solos a los 4s,
        // igual que hace WhatsApp.
        otroEscribiendoOffRef.current = setTimeout(() => setOtroEscribiendo(false), 4000);
      } else {
        setOtroEscribiendo(false);
      }
    });

    return () => {
      desuscribirEscribiendo();
      if (otroEscribiendoOffRef.current) clearTimeout(otroEscribiendoOffRef.current);
    };
  }, [conversacionId, user]);

  // Avisa "escribiendo" mientras el usuario tipea, y "paró" 1.5s después de
  // la última tecla. Debounce local, no manda un broadcast por cada letra.
  const handleCambioTexto = (valor: string) => {
    setTexto(valor);
    if (!conversacionId || !user) return;

    if (!escribiendoOffRef.current) {
      void emitirEscribiendo(conversacionId, user.id, true);
    } else {
      clearTimeout(escribiendoOffRef.current);
    }

    escribiendoOffRef.current = setTimeout(() => {
      void emitirEscribiendo(conversacionId, user.id, false);
      escribiendoOffRef.current = null;
    }, 1500);
  };

  const handleEnviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const contenido = texto;
    const respuestaAId = respondiendoA?.id ?? null;
    setTexto("");
    setRespondiendoA(null);
    if (escribiendoOffRef.current) {
      clearTimeout(escribiendoOffRef.current);
      escribiendoOffRef.current = null;
      void emitirEscribiendo(conversacionId, user.id, false);
    }
    try {
      const enviado = await enviarMensaje(conversacionId, contenido, undefined, respuestaAId);
      // Optimista: lo agregamos ya mismo al estado local en vez de esperar
      // a que vuelva por la suscripción realtime. Antes, quien enviaba
      // dependía 100% de ver su propio INSERT reflejado por Realtime — si
      // esa suscripción no estaba sana (canal caído, problema de RLS del
      // lado del servidor, etc.), la persona ni siquiera veía los mensajes
      // que ella misma acababa de escribir. El dedupe por id en
      // suscribirseAMensajes evita que se duplique si el evento realtime
      // también termina llegando.
      setMensajes((prev) => (prev.some((p) => p.id === enviado.id) ? prev : [...prev, enviado]));
    } catch {
      setError("No se pudo enviar el mensaje.");
      setTexto(contenido);
      setRespondiendoA(respondiendoA);
    } finally {
      setEnviando(false);
    }
  };

  const handleScrollMensajes = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop < 80) void handleCargarAnteriores();
  };

  const handleIniciarEdicion = (m: Mensaje) => {
    setEditandoId(m.id);
    setTextoEdicion(m.contenido ?? "");
    setMenuAbiertoPara(null);
  };

  const handleResponder = (m: Mensaje) => {
    setRespondiendoA(m);
    setMenuAbiertoPara(null);
    setPickerAbiertoPara(null);
  };

  const handleConfirmarEdicion = async () => {
    if (!editandoId) return;
    try {
      await editarMensaje(editandoId, textoEdicion);
      setEditandoId(null);
      setTextoEdicion("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo editar el mensaje.");
    }
  };

  const handleEliminarMensaje = async (mensajeId: string) => {
    setMenuAbiertoPara(null);
    // Optimista: lo sacamos ya mismo de la pantalla propia (antes decía
    // "Mensaje eliminado"; ahora directamente desaparece de la lista) en
    // vez de esperar a que vuelva el evento DELETE por Realtime.
    setMensajes((prev) =>
      prev
        .filter((p) => p.id !== mensajeId)
        .map((p) => (p.respuesta_a === mensajeId ? { ...p, respuesta_a: null } : p)),
    );
    setRespondiendoA((prev) => (prev?.id === mensajeId ? null : prev));
    try {
      await eliminarMensaje(mensajeId);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo eliminar el mensaje.");
      // Si falló en el servidor, refrescamos desde la fuente de verdad en
      // vez de intentar reconstruir el mensaje a mano.
      void cargarMensajes(conversacionId).then(setMensajes);
    }
  };

  const handleToggleReaccion = async (mensajeId: string, emoji: string) => {
    setPickerAbiertoPara(null);
    const yaReaccione = reacciones.some(
      (r) => r.mensaje_id === mensajeId && r.perfil_id === user.id && r.emoji === emoji,
    );
    try {
      if (yaReaccione) {
        await quitarReaccion(mensajeId, emoji);
      } else {
        await reaccionarAMensaje(mensajeId, emoji);
      }
    } catch {
      setError("No se pudo actualizar la reacción.");
    }
  };

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoArchivo(true);
    try {
      const adjunto = await subirAdjunto(conversacionId, file);
      await enviarMensaje(conversacionId, "", adjunto);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo subir el archivo.");
    } finally {
      setSubiendoArchivo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen md:min-h-0 md:h-full bg-bg-main flex items-center justify-center">
        <p className="text-primary/40 font-black uppercase text-xs tracking-widest italic">
          Necesitás iniciar sesión
        </p>
      </div>
    );
  }

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen md:min-h-0 md:h-full bg-bg-main flex flex-col">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
        style={{
          background: "color-mix(in srgb, var(--bg-main) 92%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
      >
        {/* La flecha "volver" solo hace falta en mobile: en desktop la
            sidebar de conversaciones ya está siempre visible al costado. */}
        <button
          className="md:hidden"
          onClick={() => router.push("/personal/mensajes")}
          aria-label="Volver"
        >
          <ArrowLeft className="text-primary/50" size={18} />
        </button>

        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
          <SmartImage
            alt={otroParticipante?.username ?? "Usuario"}
            className="w-full h-full"
            src={otroParticipante?.avatar_url || "/icon.jpg"}
          />
          {otroEnLinea && (
            <span
              className="absolute bottom-0 right-0 rounded-full"
              style={{
                width: 9,
                height: 9,
                background: "#22c55e",
                border: "2px solid var(--bg-main)",
              }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-primary uppercase tracking-wide truncate">
            {otroParticipante?.username ?? "Conversación"}
          </p>
          <p className="text-micro font-bold leading-none mt-0.5">
            {otroEscribiendo ? (
              <span style={{ color: "var(--primary)" }} className="italic">
                escribiendo…
              </span>
            ) : otroEnLinea ? (
              <span style={{ color: "#22c55e" }}>en línea</span>
            ) : (
              <span className="text-primary/30">&nbsp;</span>
            )}
          </p>
        </div>

        <button
          disabled={!otroParticipante || estadoLlamada !== "inactiva"}
          onClick={() => void handleLlamar()}
          aria-label="Llamar"
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 34,
            height: 34,
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
            opacity: !otroParticipante || estadoLlamada !== "inactiva" ? 0.4 : 1,
          }}
        >
          <Phone className="text-primary" size={15} />
        </button>
      </div>

      {/* ── Mensajes ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2"
        onScroll={handleScrollMensajes}
      >
        {cargandoAnteriores && (
          <p className="text-center text-primary/30 text-micro italic py-2">Cargando mensajes anteriores…</p>
        )}
        {mensajes.length === 0 ? (
          <p className="text-center text-primary/30 text-micro italic py-10">
            Todavía no hay mensajes. ¡Decí hola!
          </p>
        ) : (
          mensajes.map((m, idx) => {
            const esMio = m.remitente_id === user.id;
            const esUltimoPropio =
              esMio && !mensajes.slice(idx + 1).some((s) => s.remitente_id === user.id);
            const visto =
              esUltimoPropio &&
              !!otroUltimoLeido &&
              new Date(otroUltimoLeido) >= new Date(m.created_at);
            const reaccionesDelMensaje = reacciones.filter((r) => r.mensaje_id === m.id);
            const reaccionesAgrupadas = reaccionesDelMensaje.reduce<Record<string, number>>(
              (acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] ?? 0) + 1 }),
              {},
            );
            const enEdicion = editandoId === m.id;
            const mensajeCitado = m.respuesta_a
              ? mensajes.find((c) => c.id === m.respuesta_a) ?? null
              : null;

            return (
              <div key={m.id} className={`flex flex-col ${esMio ? "items-end" : "items-start"} group`}>
                <div
                  className="max-w-[75%] px-4 py-2.5 rounded-[var(--radius-btn)] relative"
                  style={{
                    background: esMio
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 6%, transparent)",
                    color: esMio ? "var(--btn-text)" : "var(--foreground)",
                  }}
                >
                  {/* Preview del mensaje citado, si este mensaje es una
                      respuesta a otro. Si el citado ya no está entre los
                      mensajes cargados (se borró, o quedó fuera de la
                      página actual), simplemente no se muestra nada acá. */}
                  {mensajeCitado && (
                    <div
                      className="mb-1.5 px-2 py-1 rounded text-micro"
                      style={{
                        background: "color-mix(in srgb, var(--bg-main) 35%, transparent)",
                        borderLeft: "2px solid currentColor",
                        opacity: 0.85,
                      }}
                    >
                      <p className="font-black opacity-80">
                        {mensajeCitado.remitente_id === user.id
                          ? "Vos"
                          : (otroParticipante?.username ?? "Usuario")}
                      </p>
                      <p className="truncate opacity-70">{previsualizarMensaje(mensajeCitado)}</p>
                    </div>
                  )}

                  {m.adjunto_tipo === "imagen" && m.adjunto_url && (
                    <div className="w-48 rounded-[var(--radius-btn)] overflow-hidden mb-1">
                      <SmartImage alt="Adjunto" className="w-full h-full" src={m.adjunto_url} />
                    </div>
                  )}
                  {m.adjunto_tipo === "audio" && m.adjunto_url && (
                    <audio className="mb-1" controls src={m.adjunto_url} />
                  )}
                  {m.adjunto_tipo === "archivo" && m.adjunto_url && (
                    <a
                      className="underline text-sm font-bold block mb-1"
                      href={m.adjunto_url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      📎 Archivo adjunto
                    </a>
                  )}

                  {enEdicion ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="flex-1 bg-transparent outline-none text-sm font-medium border-b border-current/30"
                        value={textoEdicion}
                        onChange={(e) => setTextoEdicion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleConfirmarEdicion();
                          if (e.key === "Escape") setEditandoId(null);
                        }}
                      />
                      <button
                        className="text-micro font-black underline flex-shrink-0"
                        onClick={() => void handleConfirmarEdicion()}
                      >
                        Listo
                      </button>
                    </div>
                  ) : (
                    m.contenido && (
                      <p className="text-sm font-medium">
                        {m.contenido}
                        {m.editado && (
                          <span className="text-micro italic opacity-60 ml-1">(editado)</span>
                        )}
                      </p>
                    )
                  )}

                  {/* Menú de opciones (responder/reaccionar/eliminar), solo visible al hover/tap */}
                  <div
                    className={`absolute top-1 ${esMio ? "-left-24" : "-right-24"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}
                  >
                    <button
                      aria-label="Responder"
                      onClick={() => handleResponder(m)}
                      className="p-1 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                    >
                      <Reply className="text-primary/60" size={13} />
                    </button>
                    <button
                      aria-label="Reaccionar"
                      onClick={() => setPickerAbiertoPara(pickerAbiertoPara === m.id ? null : m.id)}
                      className="p-1 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                    >
                      <SmilePlus className="text-primary/60" size={13} />
                    </button>
                    {esMio && (
                      <button
                        aria-label="Más opciones"
                        onClick={() => setMenuAbiertoPara(menuAbiertoPara === m.id ? null : m.id)}
                        className="p-1 rounded-full"
                        style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                      >
                        <Trash2 className="text-primary/60" size={13} />
                      </button>
                    )}
                  </div>

                  {/* Picker de emojis rápidos */}
                  {pickerAbiertoPara === m.id && (
                    <div
                      className={`absolute -top-9 ${esMio ? "right-0" : "left-0"} flex gap-1 px-2 py-1 rounded-full z-10`}
                      style={{ background: "var(--bg-main)", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}
                    >
                      {EMOJIS_RAPIDOS.map((emoji) => (
                        <button
                          key={emoji}
                          className="text-sm hover:scale-125 transition-transform"
                          onClick={() => void handleToggleReaccion(m.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Menú editar/eliminar (solo mensajes propios) */}
                  {menuAbiertoPara === m.id && esMio && (
                    <div
                      className={`absolute -top-16 ${esMio ? "right-0" : "left-0"} flex flex-col rounded-[var(--radius-btn)] overflow-hidden z-10`}
                      style={{ background: "var(--bg-main)", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}
                    >
                      <button
                        className="px-3 py-1.5 text-micro font-bold text-left text-primary hover:opacity-70"
                        onClick={() => handleIniciarEdicion(m)}
                      >
                        Editar
                      </button>
                      <button
                        className="px-3 py-1.5 text-micro font-bold text-left text-red-400 hover:opacity-70"
                        onClick={() => void handleEliminarMensaje(m.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {/* Reacciones puestas al mensaje */}
                {Object.keys(reaccionesAgrupadas).length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {Object.entries(reaccionesAgrupadas).map(([emoji, cantidad]) => {
                      const propia = reaccionesDelMensaje.some(
                        (r) => r.perfil_id === user.id && r.emoji === emoji,
                      );
                      return (
                        <button
                          key={emoji}
                          onClick={() => void handleToggleReaccion(m.id, emoji)}
                          className="text-micro px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                          style={{
                            background: propia
                              ? "color-mix(in srgb, var(--primary) 20%, transparent)"
                              : "color-mix(in srgb, var(--primary) 6%, transparent)",
                            border: propia ? "1px solid var(--primary)" : "1px solid transparent",
                          }}
                        >
                          <span>{emoji}</span>
                          {cantidad > 1 && <span className="text-primary/60">{cantidad}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Doble check / visto, solo en el último mensaje propio */}
                {esUltimoPropio && (
                  <span className="mt-0.5 flex items-center gap-0.5 text-primary/30">
                    {visto ? (
                      <CheckCheck size={12} style={{ color: "var(--primary)" }} />
                    ) : (
                      <Check size={12} />
                    )}
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* ── Burbuja "escribiendo…" — mismo lugar donde aparecería el
            próximo mensaje del otro participante, con el mismo estilo de
            burbuja que sus mensajes normales. Los puntos usan la utilidad
            `animate-bounce` de Tailwind (incluida por defecto, sin
            configuración extra) con un delay escalonado por punto para que
            reboten en cascada en vez de todos juntos. */}
        {otroEscribiendo && (
          <div className="flex flex-col items-start">
            <div
              className="px-4 py-3 rounded-[var(--radius-btn)] flex items-center gap-1"
              style={{
                background: "color-mix(in srgb, var(--primary) 6%, transparent)",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="rounded-full animate-bounce"
                  style={{
                    width: 6,
                    height: 6,
                    background: "color-mix(in srgb, var(--primary) 50%, transparent)",
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 flex items-center justify-between text-micro text-red-400 italic">
          {error}
          <button onClick={() => setError(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Preview de "respondiendo a…" arriba del input ── */}
      {respondiendoA && (
        <div
          className="flex items-center gap-2 px-4 py-2 mx-4 mt-2 rounded-[var(--radius-btn)]"
          style={{
            background: "color-mix(in srgb, var(--primary) 6%, transparent)",
            borderLeft: "3px solid var(--primary)",
          }}
        >
          <Reply className="text-primary/50 flex-shrink-0" size={14} />
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black text-primary/70 uppercase tracking-wide">
              {respondiendoA.remitente_id === user.id
                ? "Vos"
                : (otroParticipante?.username ?? "Usuario")}
            </p>
            <p className="text-micro text-primary/50 truncate italic">
              {previsualizarMensaje(respondiendoA)}
            </p>
          </div>
          <button onClick={() => setRespondiendoA(null)} aria-label="Cancelar respuesta">
            <X className="text-primary/40" size={14} />
          </button>
        </div>
      )}

      {/* ── Input ── */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)" }}
      >
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          onChange={handleArchivo}
        />
        <button
          disabled={subiendoArchivo}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Adjuntar archivo"
        >
          <Paperclip
            className={subiendoArchivo ? "text-primary/20 animate-pulse" : "text-primary/50"}
            size={18}
          />
        </button>
        <input
          autoFocus={!!respondiendoA}
          className="flex-1 px-4 py-2.5 rounded-[var(--radius-btn)] bg-transparent outline-none text-sm font-medium text-primary placeholder:text-primary/30"
          placeholder={respondiendoA ? "Escribí tu respuesta…" : "Escribí un mensaje…"}
          style={{
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
          }}
          value={texto}
          onChange={(e) => handleCambioTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleEnviar();
            }
            if (e.key === "Escape" && respondiendoA) {
              setRespondiendoA(null);
            }
          }}
        />
        <button
          className="flex items-center justify-center rounded-full flex-shrink-0"
          disabled={!texto.trim() || enviando}
          style={{
            width: 36,
            height: 36,
            background: "var(--primary)",
            color: "var(--btn-text)",
            opacity: !texto.trim() || enviando ? 0.4 : 1,
          }}
          onClick={() => void handleEnviar()}
          aria-label="Enviar"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

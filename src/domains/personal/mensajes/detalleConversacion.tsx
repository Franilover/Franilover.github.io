"use client";

import { ArrowLeft, Check, CheckCheck, Cloud, Heart, Megaphone, MessageSquareText, Mic, NotebookPen, Paperclip, Pencil, Phone, Plus, Reply, Send, Sparkle, Trash2, Waves, X } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Loading } from "@/ui";
import { SmartImage } from "@/ui/SmartImage";
import { useLlamadaStore } from "@/infra/realtime/useLlamadaStore";
import { useEstaEnLinea } from "@/infra/realtime/useEnLinea";
import {
  cargarExplosiones,
  cargarMensajes,
  cargarMensajesConCache,
  cargarReacciones,
  dispararExplosion,
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
  suscribirseAExplosiones,
  suscribirseAReacciones,
  type AnimacionBurbuja,
  type EstiloBurbuja,
  type Mensaje,
  type MensajeExplosion,
  type MensajeReaccion,
  type PerfilResumen,
} from "@/infra/call/chatEngine";
import { crearLlamada, ofrecerLlamada } from "@/infra/call/callEngine";
import {
  emitirEscribiendo,
  emitirExplosionEmoji,
  suscribirseAEscribiendo,
  suscribirseAExplosionEmoji,
} from "@/infra/call/presenceEngine";
import { supabase } from "@/infra/supabase/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { ExplosionEmoji } from "./ExplosionEmoji";
import { formatearDuracion, useGrabadorAudio } from "./useGrabadorAudio";
import { useMensajesStore } from "./useMensajesStore";

/** Texto corto para mostrar como preview de un mensaje citado (reply). */
function previsualizarMensaje(m: Mensaje): string {
  if (m.contenido) return m.contenido;
  if (m.adjunto_tipo === "imagen") return "📷 Foto";
  if (m.adjunto_tipo === "audio") return "🎵 Audio";
  if (m.adjunto_tipo === "archivo") return "📎 Archivo";
  return "Mensaje";
}

/**
 * Detecta si un texto es "solo un kaomoji" — una carita hecha con
 * paréntesis/símbolos tipo (⁠◡⁠ ⁠ω⁠ ⁠◡⁠) o ʕ⁠·⁠ᴥ⁠·⁠ʔ — para poder mostrarlo sin
 * la caja de burbuja normal. No es una lista cerrada de caritas: en vez de
 * eso, rechaza el texto si contiene letras latinas "de verdad" (a-z, con
 * o sin tilde) fuera de las pocas que sí aparecen en kaomojis comunes
 * (ω, ᴥ, ಥ, etc. son símbolos, no letras latinas, así que pasan). Con eso
 * alcanza para separar "mensaje de texto normal" de "carita ASCII/Unicode".
 */
function esSoloKaomoji(texto: string): boolean {
  const limpio = texto.trim();
  if (!limpio) return false;
  // Si tiene letras latinas (a-z, con tildes/ñ) es texto normal, no kaomoji.
  if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(limpio)) return false;
  // Tiene que haber al menos un símbolo "de cara" típico (ojos/boca) para
  // no confundir un mensaje que es solo puntuación suelta con una carita.
  const tieneRasgoDeCara = /[◡ω⁠ᴥಥ•̀́^><≧≦｡ﾟ✧☆*＾｀´¯()ノシ੭]/.test(limpio);
  if (!tieneRasgoDeCara) return false;
  // El resto del contenido debe ser puramente símbolos/espacios (nada de
  // dígitos largos ni texto): esto ya lo cubre el chequeo de letras arriba,
  // así que si llegamos hasta acá es una carita.
  return limpio.length <= 40; // las caritas son cortas; esto evita falsos positivos con arte ASCII largo
}

/** Animaciones disponibles para aplicar a un kaomoji. */
const ANIMACIONES_KAOMOJI: { id: AnimacionBurbuja; label: string; Icono: typeof Waves }[] = [
  { id: "flotar", label: "Flotar", Icono: Waves },
  { id: "latido", label: "Latido", Icono: Heart },
  { id: "parpadeo", label: "Parpadeo", Icono: Sparkle },
];

/** className de la animación CSS (definida como keyframes globales más abajo). */
function claseAnimacion(animacion: AnimacionBurbuja | null | undefined): string {
  if (animacion === "flotar") return "animate-kaomoji-flotar";
  if (animacion === "latido") return "animate-kaomoji-latido";
  if (animacion === "parpadeo") return "animate-kaomoji-parpadeo";
  return "";
}

/**
 * clip-path en forma de estrella/explosión de cómic para el diseño "grito".
 * Generado a mano como polígono de puntas alternadas (16 puntos): da el
 * efecto de burbuja de grito sin depender de ninguna imagen o librería.
 */
const CLIP_PATH_GRITO =
  "polygon(50% 0%, 61% 12%, 75% 2%, 78% 18%, 93% 10%, 89% 27%, 100% 32%, 88% 42%, 98% 55%, 84% 58%, 88% 74%, 73% 68%, 72% 85%, 60% 74%, 52% 100%, 44% 76%, 30% 88%, 28% 70%, 12% 78%, 18% 60%, 2% 58%, 15% 45%, 0% 33%, 14% 27%, 8% 11%, 25% 18%, 28% 2%, 40% 13%)";

/**
 * Rotación pseudo-aleatoria pero determinística por mensaje (misma semilla
 * = mismo ángulo siempre, para que no "tiemble" entre renders): entre -3°
 * y 3°, derivada del id del mensaje.
 */
function rotacionManuscrita(mensajeId: string): number {
  let hash = 0;
  for (let i = 0; i < mensajeId.length; i++) {
    hash = (hash * 31 + mensajeId.charCodeAt(i)) | 0;
  }
  return ((Math.abs(hash) % 600) - 300) / 100; // entre -3 y 3 grados
}

/**
 * Devuelve className/style extra para aplicar sobre la burbuja del mensaje
 * según su diseño elegido. "pensamiento" y "grito" cambian la forma del
 * contenedor (nube / estallido de cómic); "experimental" simula una nota
 * escrita a mano (post-it), con la fuente Caveat ya cargada en el proyecto.
 * null/undefined = sin cambios (burbuja normal, ya maneja el caller).
 */
function estiloExtraBurbuja(
  estilo: EstiloBurbuja | null | undefined,
  esMio: boolean,
  mensajeId: string,
): { className: string; style: React.CSSProperties } {
  if (estilo === "pensamiento") {
    return {
      className: "",
      style: {
        borderRadius: "42% 46% 44% 40% / 55% 48% 52% 45%",
        border: `2px solid ${esMio ? "color-mix(in srgb, var(--btn-text) 35%, transparent)" : "color-mix(in srgb, var(--primary) 20%, transparent)"}`,
      },
    };
  }
  if (estilo === "grito") {
    return {
      className: "",
      style: {
        clipPath: CLIP_PATH_GRITO,
        padding: "1.75rem 2.25rem",
        fontWeight: 800,
      },
    };
  }
  if (estilo === "experimental") {
    // Nota a mano estilo post-it: fondo papel amarillento, rotación leve
    // (fija por mensaje, no cambia entre renders), tipografía manuscrita
    // Caveat, y una sombra dura para dar volumen de papel apoyado.
    return {
      className: "font-[family-name:var(--font-caveat)]",
      style: {
        background: esMio ? "#f5e6a8" : "#faf0c8",
        color: "#3a3226",
        borderRadius: "2px",
        transform: `rotate(${rotacionManuscrita(mensajeId)}deg)`,
        boxShadow: "2px 3px 6px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.4) inset",
        fontSize: "1.15rem",
        lineHeight: 1.3,
      },
    };
  }
  return { className: "", style: {} };
}

/** Lista de emojis por categoría para el selector completo (botón "+"). */
const CATEGORIAS_EMOJI: { nombre: string; emojis: string[] }[] = [
  {
    nombre: "Caritas",
    emojis: [
      "😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😍",
      "🥰", "😘", "😋", "😜", "🤪", "🤔", "🤨", "😐", "😑", "😶",
      "🙄", "😏", "😣", "😥", "😮", "🤐", "😯", "😪", "😫", "🥱",
      "😴", "😌", "😛", "😝", "😒", "😓", "😔", "😕", "🙁", "😖",
      "😞", "😟", "😤", "😢", "😭", "😦", "😧", "😨", "😩", "🤯",
      "😬", "😰", "😱", "🥵", "🥶", "😳", "🤗", "🤭", "🫡", "🤫",
    ],
  },
  {
    nombre: "Gestos",
    emojis: [
      "👍", "👎", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌",
      "👐", "🤲", "🙏", "💪", "🫶", "👋", "🤝", "✍️", "💅", "👊",
    ],
  },
  {
    nombre: "Corazones",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❤️‍🔥", "❤️‍🩹", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟",
    ],
  },
  {
    nombre: "Animales",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦋",
    ],
  },
  {
    nombre: "Comida",
    emojis: [
      "🍎", "🍕", "🍔", "🍟", "🌭", "🍿", "🍩", "🍪", "🎂", "🍰",
      "🍫", "🍬", "🍭", "☕", "🍺", "🍷", "🥂", "🍾", "🍉", "🍇",
    ],
  },
  {
    nombre: "Actividades",
    emojis: [
      "⚽", "🏀", "🎉", "🎊", "🎈", "🎁", "🏆", "🎮", "🎲", "🎸",
      "🎨", "📸", "🔥", "✨", "⭐", "🌟", "💯", "✅", "❌", "⚡",
    ],
  },
];

/**
 * Diseños de burbuja disponibles para elegir al escribir un mensaje.
 * "normal" (null) no aparece acá — es la opción implícita/por defecto.
 */
const DISENOS_BURBUJA: { id: EstiloBurbuja; label: string; Icono: typeof Cloud }[] = [
  { id: "pensamiento", label: "Pensamiento", Icono: Cloud },
  { id: "grito", label: "Grito", Icono: Megaphone },
  { id: "experimental", label: "Nota a mano", Icono: NotebookPen },
  { id: "kaomoji", label: "Kaomoji", Icono: Sparkle },
];

/**
 * Handlers de long-press reusables para un emoji dentro de cualquier picker
 * (rápido o completo): tap normal reacciona, mantener presionado dispara la
 * explosión. Unifica pointer+mouse en un solo lugar para no duplicar la
 * lógica entre el picker rápido y el selector completo.
 */
function useLongPressEmoji({
  onTap,
  onLongPress,
  ms = 350,
}: {
  onTap: (emoji: string) => void;
  onLongPress: (emoji: string) => void;
  ms?: number;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disparadoRef = useRef(false);

  const cancelar = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onDown = (emoji: string) => {
    disparadoRef.current = false;
    cancelar();
    timerRef.current = setTimeout(() => {
      disparadoRef.current = true;
      onLongPress(emoji);
    }, ms);
  };

  const onUp = (emoji: string) => {
    cancelar();
    if (disparadoRef.current) return;
    onTap(emoji);
  };

  return { onDown, onUp, onLeave: cancelar };
}

/**
 * Selector completo de emojis, agrupado por categorías, para cuando los 6
 * emojis rápidos no alcanzan. Se abre desde el botón "+" del picker rápido.
 * Ocupa buena parte de la pantalla (bottom-sheet en mobile, panel grande
 * centrado en desktop) para que los emojis sean cómodos de tocar. No
 * depende de ninguna librería externa: es una lista curada suficiente para
 * reacciones de chat (no un input de texto con emojis arbitrarios).
 * Soporta el mismo gesto de mantener-presionado que el picker rápido: tap
 * reacciona, long-press dispara la explosión.
 */
function SelectorEmojisCompleto({
  onSeleccionar,
  onExplosion,
  onCerrar,
}: {
  onSeleccionar: (emoji: string) => void;
  onExplosion: (emoji: string) => void;
  onCerrar: () => void;
}) {
  const lp = useLongPressEmoji({ onTap: onSeleccionar, onLongPress: onExplosion });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onCerrar}
    >
      <div
        data-mensaje-burbuja
        className="w-full md:w-[520px] rounded-t-[var(--radius-btn)] md:rounded-[var(--radius-btn)] overflow-hidden flex flex-col"
        style={{
          maxHeight: "80vh",
          background: "var(--bg-main)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.35)",
          border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)" }}
        >
          <p className="text-sm font-black uppercase tracking-wide text-primary/60">Reaccionar</p>
          <button className="p-1" onClick={onCerrar} aria-label="Cerrar selector de emojis">
            <X className="text-primary/40" size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-3 py-3">
          {CATEGORIAS_EMOJI.map((cat) => (
            <div key={cat.nombre} className="mb-4">
              <p className="text-micro font-bold text-primary/40 uppercase tracking-wide mb-2 px-1">
                {cat.nombre}
              </p>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="text-3xl leading-none py-2 rounded-[var(--radius-btn)] hover:scale-125 active:scale-95 transition-transform select-none"
                    onContextMenu={(e) => e.preventDefault()}
                    onMouseDown={() => lp.onDown(emoji)}
                    onMouseLeave={lp.onLeave}
                    onMouseUp={() => lp.onUp(emoji)}
                    onPointerDown={() => lp.onDown(emoji)}
                    onPointerLeave={lp.onLeave}
                    onPointerUp={() => lp.onUp(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Constructor de kaomojis por partes: elegís ojos, boca y brazos (opcional)
 * por separado y se arma el resultado en vivo en un preview grande. Al
 * confirmar, inserta el kaomoji armado en el input de texto — la detección
 * automática de "esto es un kaomoji" (`esSoloKaomoji`) ya se encarga de
 * mandarlo con el estilo/animación kaomoji sin que haga falta elegir nada
 * más a mano.
 */
/**
 * Constructor de kaomojis por partes: elegís ojos, boca y brazos (opcional)
 * por separado y se arma el resultado en vivo en un preview grande. Al
 * confirmar, inserta el kaomoji armado en el input de texto — la detección
 * automática de "esto es un kaomoji" (`esSoloKaomoji`) ya se encarga de
 * mandarlo con el estilo/animación kaomoji sin que haga falta elegir nada
 * más a mano.
 *
 * Cada ojo es un SÍMBOLO SUELTO (no un par ya armado con boca incluida):
 * el template arma `brazoIzq(ojo boca ojo)brazoDer`, así que si un ojo ya
 * traía boca adentro (como pasaba antes, ej. "◕‿◕") terminaba duplicando
 * la cara entera: "(◕‿◕ 3 ◕‿◕)" en vez de "(◕3◕)".
 *
 * Los brazos son solo el símbolo — nada de texto descriptivo (antes
 * "aplauso" insertaba literalmente "パチパチ" en el mensaje) ni el
 * paréntesis del rostro incluido (antes "abrazo" traía su propio "(" y ")"
 * y se sumaba a los del template, dando "((...))").
 */
const OJOS_KAOMOJI = [
  "⁠◕", "⁠•", "⁠^", "⁠´", "⁠>", "⁠╥", "⁠ಠ", "⁠✧", "⁠˘", "⁠ó",
  "⁠T", "⁠×", "⁠@", "⁠ʘ", "⁠¬", "⁠ゝ", "⁠★", "⁠⊙", "⁠¯", "⁠£",
];
const BOCAS_KAOMOJI = [
  "⁠‿", "⁠ω", "⁠▽", "⁠へ", "⁠3", "⁠o", "⁠д", "⁠_",
  "⁠∀", "⁠ロ", "⁠ｖ", "⁠人", "⁠皿", "⁠ｕ", "⁠∇", "⁠ｍ",
];
const BRAZOS_KAOMOJI: { id: string; label: string; izq: string; der: string }[] = [
  { id: "ninguno", label: "Sin brazos", izq: "", der: "" },
  { id: "festejo", label: "Festejo", izq: "⁠ヽ", der: "⁠ノ" },
  { id: "festejo2", label: "Festejo (doble)", izq: "⁠\\", der: "⁠/" },
  { id: "encogido", label: "Encogido de hombros", izq: "⁠¯\\_", der: "⁠_/¯" },
  { id: "abrazo", label: "Abrazo", izq: "⁠っ", der: "⁠っ" },
  { id: "aplauso", label: "Aplauso", izq: "⁠", der: "⁠👏" },
  { id: "flexion", label: "Flexión", izq: "⁠ᕙ", der: "⁠ᕗ" },
  { id: "vuelco", label: "Vuelco de mesa", izq: "⁠(╯°□°）╯︵ ", der: "⁠" },
  { id: "aprobacion", label: "Aprobación", izq: "⁠", der: "⁠✧" },
  { id: "timidez", label: "Timidez", izq: "⁠", der: "⁠;;" },
];

function ConstructorKaomoji({
  onInsertar,
  onCerrar,
}: {
  onInsertar: (kaomoji: string) => void;
  onCerrar: () => void;
}) {
  const [ojos, setOjos] = useState(OJOS_KAOMOJI[0]);
  const [boca, setBoca] = useState(BOCAS_KAOMOJI[0]);
  const [brazos, setBrazos] = useState(BRAZOS_KAOMOJI[0]);

  const kaomoji = `${brazos.izq}(${ojos}${boca}${ojos})${brazos.der}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onCerrar}
    >
      <div
        data-mensaje-burbuja
        className="w-full md:w-[420px] rounded-t-[var(--radius-btn)] md:rounded-[var(--radius-btn)] overflow-hidden flex flex-col"
        style={{
          maxHeight: "85vh",
          background: "var(--bg-main)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.35)",
          border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)" }}
        >
          <p className="text-sm font-black uppercase tracking-wide text-primary/60">
            Armar kaomoji
          </p>
          <button className="p-1" onClick={onCerrar} aria-label="Cerrar constructor de kaomojis">
            <X className="text-primary/40" size={18} />
          </button>
        </div>

        {/* Preview en vivo, grande, del kaomoji que se está armando */}
        <div
          className="flex items-center justify-center py-6 text-3xl flex-shrink-0"
          style={{ background: "color-mix(in srgb, var(--primary) 4%, transparent)" }}
        >
          {kaomoji}
        </div>

        <div className="overflow-y-auto px-4 py-3 flex flex-col gap-4">
          <div>
            <p className="text-micro font-bold text-primary/40 uppercase tracking-wide mb-2">
              Ojos
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {OJOS_KAOMOJI.map((o) => (
                <button
                  key={o}
                  onClick={() => setOjos(o)}
                  aria-label={`Ojo ${o}`}
                  className="text-sm py-2 rounded-[var(--radius-btn)] select-none"
                  style={{
                    background:
                      ojos === o
                        ? "color-mix(in srgb, var(--primary) 20%, transparent)"
                        : "color-mix(in srgb, var(--primary) 6%, transparent)",
                    border: ojos === o ? "1px solid var(--primary)" : "1px solid transparent",
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-micro font-bold text-primary/40 uppercase tracking-wide mb-2">
              Boca
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {BOCAS_KAOMOJI.map((b) => (
                <button
                  key={b}
                  onClick={() => setBoca(b)}
                  aria-label={`Boca ${b}`}
                  className="text-lg py-2 rounded-[var(--radius-btn)] select-none"
                  style={{
                    background:
                      boca === b
                        ? "color-mix(in srgb, var(--primary) 20%, transparent)"
                        : "color-mix(in srgb, var(--primary) 6%, transparent)",
                    border: boca === b ? "1px solid var(--primary)" : "1px solid transparent",
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-micro font-bold text-primary/40 uppercase tracking-wide mb-2">
              Brazos
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {BRAZOS_KAOMOJI.map((br) => (
                <button
                  key={br.id}
                  onClick={() => setBrazos(br)}
                  aria-label={br.label}
                  title={br.label}
                  className="text-sm py-2 rounded-[var(--radius-btn)] select-none"
                  style={{
                    background:
                      brazos.id === br.id
                        ? "color-mix(in srgb, var(--primary) 20%, transparent)"
                        : "color-mix(in srgb, var(--primary) 6%, transparent)",
                    border: brazos.id === br.id ? "1px solid var(--primary)" : "1px solid transparent",
                  }}
                >
                  {br.id === "ninguno" ? "—" : `${br.izq}‿${br.der}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="px-4 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)" }}
        >
          <button
            onClick={() => {
              onInsertar(kaomoji);
              onCerrar();
            }}
            className="w-full py-2.5 rounded-[var(--radius-btn)] text-sm font-black uppercase tracking-wide"
            style={{ background: "var(--primary)", color: "var(--btn-text)" }}
          >
            Usar este kaomoji
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DetalleConversacion() {
  const searchParams = useSearchParams();
  // El id real de la conversación viaja siempre como ?id=..., leído con
  // useSearchParams (misma ruta estática en web y en el APK de Tauri).
  const conversacionId = searchParams.get("id") ?? "";

  const router = useRouter();
  const { user } = useAuth() as { user: any };

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  // Espejo de `mensajes` en un ref: handleVisibilidad (más abajo) se
  // registra una sola vez por conversacionId y de otro modo quedaría con
  // un closure viejo del array de mensajes — necesitamos el valor más
  // reciente ahí sin tener que re-registrar el listener en cada mensaje
  // nuevo (eso reintroduciría el mismo problema de over-re-render que
  // tiene el efecto de refuerzo de scroll de más abajo).
  const mensajesRef = useRef<Mensaje[]>([]);
  useEffect(() => {
    mensajesRef.current = mensajes;
  }, [mensajes]);
  const [loading, setLoading] = useState(true);
  // Borrador no enviado: se hidrata del store persistido (localStorage) al
  // abrir la conversación, así que si el usuario escribió algo, cambió de
  // chat sin mandarlo (o cerró la app) y vuelve, el texto sigue ahí — ver
  // useMensajesStore.
  const setBorradorGuardado = useMensajesStore((s) => s.setBorrador);
  const limpiarBorradorGuardado = useMensajesStore((s) => s.limpiarBorrador);
  const [texto, setTexto] = useState(
    () => useMensajesStore.getState().borradores[conversacionId] ?? "",
  );
  useEffect(() => {
    setTexto(useMensajesStore.getState().borradores[conversacionId] ?? "");
  }, [conversacionId]);
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
  const [selectorCompletoAbiertoPara, setSelectorCompletoAbiertoPara] = useState<string | null>(null);
  const EMOJIS_RAPIDOS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

  // ── Explosión de emojis (mantener presionado un emoji del picker) ──────
  // Estilo Instagram: al mantener presionado (o hacer click sostenido en
  // desktop) sobre un emoji del picker rápido, en vez de solo reaccionar
  // se dispara una lluvia grande de ese emoji sobre el mensaje — tanto
  // localmente (al toque, sin esperar red) como para el otro participante
  // (vía broadcast efímero, ver presenceEngine.ts). Puede haber como mucho
  // una explosión visible por mensaje a la vez; una nueva reemplaza la
  // anterior en vez de acumularse.
  const [explosionPorMensaje, setExplosionPorMensaje] = useState<
    Record<string, { emoji: string; disparoId: string }>
  >({});
  const explosionLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const explosionDisparadaRef = useRef(false);
  const EXPLOSION_LONG_PRESS_MS = 350;

  // Explosiones PERSISTIDAS (la "pill" con varios emojis apilados, ej.
  // ❤️❤️❤️❤️❤️, que queda en el mensaje después de la lluvia). A diferencia
  // de `explosionPorMensaje` de arriba (la animación efímera en vivo), esto
  // se carga al entrar al chat y sobrevive aunque nadie haya estado mirando
  // en el momento exacto de la explosión.
  const [explosiones, setExplosiones] = useState<MensajeExplosion[]>([]);
  /** Tope de emojis repetidos en la pill, para que una explosión de 500 no
   *  rompa el layout — a partir de ahí se corta y se muestra "+N". */
  const MAX_EMOJIS_EN_PILL = 12;

  // ── Editar / eliminar mensaje propio ────────────────────────────────
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");
  const [menuAbiertoPara, setMenuAbiertoPara] = useState<string | null>(null);

  // ── Menú flotante en mobile (long-press) ────────────────────────────
  // En touch no existe :hover, así que el menú de acciones (responder/
  // reaccionar/editar/eliminar) nunca aparecía — y al no interceptar el
  // gesto, el navegador hacía su selección de texto nativa en su lugar.
  // Guardamos qué mensaje quedó "activo" por long-press para mostrarle
  // el menú fijo (sin depender de :hover) hasta que se toque afuera.
  const [menuTactilPara, setMenuTactilPara] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressDisparadoRef = useRef(false);

  const cancelarLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStartMensaje = (mensajeId: string) => {
    longPressDisparadoRef.current = false;
    cancelarLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressDisparadoRef.current = true;
      // El long-press abre directo el picker rápido de reacciones, en vez
      // de solo mostrar el menú con el ícono de carita — un paso menos.
      setMenuTactilPara(mensajeId);
      setPickerAbiertoPara(mensajeId);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 450);
  };

  const handleTouchEndMensaje = () => {
    cancelarLongPress();
  };

  const handleTouchMoveMensaje = () => {
    // Si el dedo se mueve (empieza a scrollear), no es un long-press: cancelamos.
    cancelarLongPress();
  };

  // En desktop no existe "mantener presionado" táctil: replicamos el mismo
  // gesto con el mouse para que también abra directo el picker.
  const handleMouseDownMensaje = (mensajeId: string) => {
    longPressDisparadoRef.current = false;
    cancelarLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressDisparadoRef.current = true;
      setMenuTactilPara(mensajeId);
      setPickerAbiertoPara(mensajeId);
    }, 450);
  };

  const handleMouseUpOrLeaveMensaje = () => {
    cancelarLongPress();
  };

  // ── Responder a un mensaje (quote/reply) ────────────────────────────
  const [respondiendoA, setRespondiendoA] = useState<Mensaje | null>(null);

  // ── Diseño de burbuja (pensamiento/grito/experimental) para el próximo
  //    mensaje de texto a enviar. Se elige desde un mini-selector en la
  //    barra de input y se resetea a "normal" después de cada envío.
  const [estiloSeleccionado, setEstiloSeleccionado] = useState<EstiloBurbuja | null>(null);
  const [animacionSeleccionada, setAnimacionSeleccionada] = useState<AnimacionBurbuja | null>(null);
  const [selectorDisenoAbierto, setSelectorDisenoAbierto] = useState(false);
  const [constructorKaomojiAbierto, setConstructorKaomojiAbierto] = useState(false);

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
    } catch (err) {
      console.error("handleLlamar:", err);
      setError("No se pudo iniciar la llamada.");
    }
  };

  useEffect(() => {
    if (!conversacionId) return;
    let mounted = true;
    setHayMasAnteriores(true);

    (async () => {
      try {
        // Cache-first: si ya visitamos esta conversación antes, tenemos los
        // últimos mensajes guardados en Dexie y podemos pintarlos ya mismo,
        // sin esperar el round-trip a Supabase — así el chat abre al
        // instante en vez de mostrar el spinner cada vez. La revalidación
        // real llega poco después vía onRevalidado y reemplaza los datos.
        const { mensajesIniciales, desdeCache } = await cargarMensajesConCache(
          conversacionId,
          (frescos) => {
            if (!mounted) return;
            setMensajes(frescos);
            setHayMasAnteriores(frescos.length >= 50);
            setLoading(false);
            if (frescos.length > 0) {
              void cargarReacciones(frescos.map((m) => m.id)).then((reacc) => {
                if (mounted) setReacciones(reacc);
              });
              void cargarExplosiones(frescos.map((m) => m.id)).then((expl) => {
                if (mounted) setExplosiones(expl);
              });
            }
          },
        );

        if (!mounted) return;

        if (desdeCache) {
          // Había caché: pintamos de inmediato y dejamos que onRevalidado
          // se encargue de refrescar cuando llegue la respuesta real.
          setMensajes(mensajesIniciales);
          setHayMasAnteriores(mensajesIniciales.length >= 50);
          setLoading(false);
          if (mensajesIniciales.length > 0) {
            const reacc = await cargarReacciones(mensajesIniciales.map((m) => m.id));
            if (mounted) setReacciones(reacc);
            const expl = await cargarExplosiones(mensajesIniciales.map((m) => m.id));
            if (mounted) setExplosiones(expl);
          }
        } else {
          // No había nada en caché (primera vez en este dispositivo): no
          // hay forma de evitar esperar la respuesta real, así que seguimos
          // mostrando el loading hasta que onRevalidado la resuelva arriba.
          setLoading(true);
        }

        void marcarComoLeido(conversacionId);
      } catch {
        if (mounted) {
          setError("No se pudo cargar la conversación.");
          setLoading(false);
        }
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
      setExplosiones((prev) => prev.filter((e) => e.mensaje_id !== mensajeId));
      setRespondiendoA((prev) => (prev?.id === mensajeId ? null : prev));
    });

    const desuscribirReacciones = suscribirseAReacciones(conversacionId, (evento, r) => {
      setReacciones((prev) => {
        if (evento === "INSERT") {
          // Reemplazamos por (mensaje_id, perfil_id, emoji) en vez de
          // filtrar solo por id: si esta reacción la pusimos nosotros
          // mismos, ya existe una fila "optimista" con un id temporal
          // distinto (ver handleToggleReaccion) — sin este reemplazo
          // quedaría duplicada (la optimista + la real) apenas llega el
          // evento realtime de vuelta.
          const sinDuplicada = prev.filter(
            (p) => !(p.mensaje_id === r.mensaje_id && p.perfil_id === r.perfil_id && p.emoji === r.emoji),
          );
          return [...sinDuplicada, r];
        }
        return prev.filter(
          (p) => !(p.mensaje_id === r.mensaje_id && p.perfil_id === r.perfil_id && p.emoji === r.emoji),
        );
      });
    });

    // Explosiones PERSISTIDAS (la pill con varios emojis apilados). Igual
    // patrón que reacciones: canal dedicado, INSERT/UPDATE actualizan o
    // reemplazan la fila local (por id, ya que acá no hay optimismo de id
    // temporal distinto — dispararExplosionEmoji ya actualiza el estado
    // local directo), DELETE la saca.
    const desuscribirExplosionesDb = suscribirseAExplosiones(conversacionId, (evento, e) => {
      setExplosiones((prev) => {
        if (evento === "DELETE") {
          return prev.filter((p) => p.id !== e.id);
        }
        const sinDuplicada = prev.filter((p) => p.id !== e.id);
        return [...sinDuplicada, e];
      });
    });

    return () => {
      mounted = false;
      desuscribirMensajes();
      desuscribirEditados();
      desuscribirEliminados();
      desuscribirReacciones();
      desuscribirExplosionesDb();
    };
  }, [conversacionId]);

  // Explosión de emojis mandada por el OTRO participante (la propia ya se
  // dispara al toque en dispararExplosionEmoji, sin pasar por acá).
  useEffect(() => {
    if (!conversacionId || !user) return;
    const desuscribirExplosion = suscribirseAExplosionEmoji(conversacionId, (senal) => {
      if (senal.perfilId === user.id) return; // la propia ya se animó localmente
      setExplosionPorMensaje((prev) => ({
        ...prev,
        [senal.mensajeId]: { emoji: senal.emoji, disparoId: senal.disparoId },
      }));
    });
    return () => desuscribirExplosion();
  }, [conversacionId, user]);

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
          const idsNuevos = new Set(data.map((m) => m.id));
          const posiblesViejos = mensajesRef.current.filter((p) => !idsNuevos.has(p.id));

          // BUG que esto arregla: antes se asumía que todo mensaje fuera del
          // rango de los últimos 50 frescos seguía vivo tal cual estaba en
          // pantalla. Si el canal realtime estuvo pausado mientras la
          // pestaña estaba en background (típico en mobile) y el otro
          // participante borró un mensaje viejo en ese lapso, el evento
          // DELETE nunca llegó — y como este refresh solo trae los últimos
          // 50, ese mensaje borrado quedaba "resucitado" en pantalla
          // indefinidamente. Ahora confirmamos contra el servidor cuáles de
          // esos mensajes viejos siguen existiendo antes de conservarlos.
          let viejosConfirmados = posiblesViejos;
          if (posiblesViejos.length > 0) {
            const { data: existentes } = await supabase
              .from("mensajes")
              .select("id")
              .in(
                "id",
                posiblesViejos.map((p) => p.id),
              );
            const idsVivos = new Set((existentes ?? []).map((m: any) => m.id as string));
            viejosConfirmados = posiblesViejos.filter((p) => idsVivos.has(p.id));
          }

          setMensajes(
            [...viejosConfirmados, ...data].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            ),
          );
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
            const expl = await cargarExplosiones(data.map((m) => m.id));
            setExplosiones((prev) => {
              const idsMensajesRefrescados = new Set(data.map((m) => m.id));
              const previasFueraDelRango = prev.filter(
                (p) => !idsMensajesRefrescados.has(p.mensaje_id),
              );
              return [...previasFueraDelRango, ...expl];
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
        const expl = await cargarExplosiones(masViejos.map((m) => m.id));
        setExplosiones((prev) => [...prev, ...expl]);
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
  //
  // CLAVE: esto usa useLayoutEffect (no useEffect). Con useEffect, React
  // pinta primero el frame con scrollTop=0 (arriba del todo) y RECIÉN
  // DESPUÉS corre el efecto que mueve el scroll — eso es exactamente el
  // "aparece arriba y después baja" que se veía, con o sin caché de por
  // medio: no era un problema de velocidad de datos, sino de en qué
  // momento del ciclo de render se movía el scroll. useLayoutEffect corre
  // sincrónicamente después de que el DOM se actualiza pero ANTES de que
  // el navegador pinte esa actualización en pantalla, así que alcanzamos a
  // corregir el scroll sin que el usuario llegue a ver el frame de arriba.
  //
  // Además, mientras no hicimos el primer scroll de esta conversación,
  // mantenemos el contenedor con visibility:hidden (ver el estilo del
  // contenedor más abajo) — así, si por lo que sea el layout todavía no
  // está listo en este primer pase y hace falta un frame extra, tampoco se
  // alcanza a ver ningún salto: simplemente no se ve nada hasta que el
  // scroll ya quedó bien posicionado.
  const scrolleoInicialHechoRef = useRef(false);
  const [scrollListo, setScrollListo] = useState(false);
  // Marca de tiempo de cuándo se abrió/cambió de conversación — usada para
  // distinguir "la revalidación del caché acaba de llegar" (mismo gesto de
  // abrir el chat) de "llegó un mensaje nuevo mientras leía" (ver más abajo).
  const momentoAperturaRef = useRef(0);

  useEffect(() => {
    scrolleoInicialHechoRef.current = false;
    setScrollListo(false);
    momentoAperturaRef.current = Date.now();
  }, [conversacionId]);

  useLayoutEffect(() => {
    if (!scrollRef.current || mensajes.length === 0) return;
    // Si el cambio vino de "cargar anteriores", el otro efecto ya se encarga
    // de reposicionar el scroll — no lo pisamos saltando al fondo.
    if (scrollHeightPrevioRef.current != null) return;

    const esInicial = !scrolleoInicialHechoRef.current;
    const irAlFondo = (comportamiento: ScrollBehavior) => {
      if (!scrollRef.current) return;
      if (comportamiento === "auto") {
        // Asignación directa (no scrollTo) para que el cambio sea parte del
        // mismo paso síncrono de layout — scrollTo con behavior:"auto" en
        // algunos navegadores igual difiere el efecto al siguiente frame.
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: comportamiento });
      }
    };

    if (esInicial) {
      irAlFondo("auto");
      scrolleoInicialHechoRef.current = true;
      // Recién ahora es seguro mostrar el contenedor: el scroll ya está
      // posicionado abajo antes de que el navegador pinte este frame.
      setScrollListo(true);
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
      // Si la revalidación contra Supabase llega justo después del pintado
      // inicial desde caché (menos de 1s), el usuario todavía no tuvo
      // tiempo de scrollear a propósito — tratamos ese refresh como parte
      // del "abrir el chat" y vamos al fondo sin animación, no con "smooth"
      // (evita un salto visible apenas se abre la conversación).
      const revalidacionRecienAbierto = Date.now() - momentoAperturaRef.current < 1000;
      if (revalidacionRecienAbierto) {
        irAlFondo("auto");
      } else if (esMio || distanciaAlFondo <= 150) {
        irAlFondo("smooth");
      }
    }
  }, [mensajes.length]);

  // Red de seguridad: si por algún motivo mensajes.length nunca cambió (por
  // ejemplo, la conversación no tiene ningún mensaje todavía) el efecto de
  // arriba nunca corre y scrollListo se quedaría en false para siempre,
  // dejando el chat invisible. En ese caso lo mostramos igual.
  useEffect(() => {
    if (mensajes.length === 0 && !loading) setScrollListo(true);
  }, [mensajes.length, loading]);

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
  //
  // RENDIMIENTO: antes este efecto dependía de [conversacionId,
  // mensajes.length], así que se desmontaba y volvía a montar en CADA
  // mensaje nuevo — y al montar, volvía a escanear con querySelectorAll
  // TODAS las <img> del contenedor (no solo la nueva), lo cual es trabajo
  // de layout repetido e innecesario en conversaciones activas con mucha
  // imagen. Ahora el efecto se registra una sola vez por conversación y
  // usa un MutationObserver para engancharse puntualmente solo a los
  // nodos <img> que se van agregando al DOM (mensajes nuevos), sin volver
  // a tocar las que ya estaban.
  useEffect(() => {
    const contenedor = scrollRef.current;
    if (!contenedor) return;

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
    const engancharSiEsImagenIncompleta = (nodo: Node) => {
      if (!(nodo instanceof HTMLImageElement)) return;
      if (!nodo.complete) nodo.addEventListener("load", reforzarScroll, { once: true });
    };

    // Imágenes que ya estaban en el DOM al montar (ej. al abrir el chat).
    contenedor.querySelectorAll("img").forEach(engancharSiEsImagenIncompleta);

    // Imágenes que se agreguen después (mensajes nuevos), sin re-escanear
    // el contenedor entero cada vez.
    const observer = new MutationObserver((mutaciones) => {
      for (const mutacion of mutaciones) {
        mutacion.addedNodes.forEach((nodo) => {
          engancharSiEsImagenIncompleta(nodo);
          if (nodo instanceof HTMLElement) {
            nodo.querySelectorAll("img").forEach(engancharSiEsImagenIncompleta);
          }
        });
      }
    });
    observer.observe(contenedor, { childList: true, subtree: true });

    // Si el usuario scrollea a mano mientras las imágenes siguen cargando,
    // dejamos de "pelearle" el scroll.
    contenedor.addEventListener("wheel", marcarLlegada, { passive: true });
    contenedor.addEventListener("touchmove", marcarLlegada, { passive: true });

    return () => {
      observer.disconnect();
      contenedor.removeEventListener("wheel", marcarLlegada);
      contenedor.removeEventListener("touchmove", marcarLlegada);
    };
  }, [conversacionId]);

  // Cierra cualquier menú/picker abierto al tocar o clickear fuera de una
  // burbuja de mensaje (afecta tanto al hover-menu de desktop como al menú
  // táctil de long-press en mobile, y a los pickers de emoji).
  useEffect(() => {
    const cerrarSiEsAfuera = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-mensaje-burbuja]")) return;
      setPickerAbiertoPara(null);
      setSelectorCompletoAbiertoPara(null);
      setMenuAbiertoPara(null);
      setMenuTactilPara(null);
    };
    document.addEventListener("mousedown", cerrarSiEsAfuera);
    document.addEventListener("touchstart", cerrarSiEsAfuera, { passive: true });
    return () => {
      document.removeEventListener("mousedown", cerrarSiEsAfuera);
      document.removeEventListener("touchstart", cerrarSiEsAfuera);
    };
  }, []);

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
  // Debounce separado del de "escribiendo…" (que es más corto, 1.5s): acá
  // no hace falta tanta inmediatez — persistir el borrador es solo para
  // sobrevivir un cambio de chat o un cierre de la app, no algo que otro
  // usuario vea. 400ms alcanza para no escribir a localStorage en cada
  // tecla sin que se note demora si se cierra la app rápido.
  const borradorOffRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCambioTexto = (valor: string) => {
    setTexto(valor);

    if (borradorOffRef.current) clearTimeout(borradorOffRef.current);
    if (conversacionId) {
      borradorOffRef.current = setTimeout(() => {
        setBorradorGuardado(conversacionId, valor);
      }, 400);
    }

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
    // Si el usuario no forzó un diseño a mano pero el mensaje es solo un
    // kaomoji tipo (⁠◡⁠ ⁠ω⁠ ⁠◡⁠) o ʕ⁠·⁠ᴥ⁠·⁠ʔ, lo mandamos como "kaomoji"
    // automáticamente (sin burbuja, con animación) — el selector manual
    // sigue pudiendo forzar cualquier otro diseño en su lugar.
    const esAutoKaomoji = !estiloSeleccionado && esSoloKaomoji(contenido);
    const estiloAEnviar: EstiloBurbuja | null = esAutoKaomoji ? "kaomoji" : estiloSeleccionado;
    const esKaomojiFinal = estiloAEnviar === "kaomoji";
    const animacionAEnviar = esKaomojiFinal
      ? (animacionSeleccionada ?? ANIMACIONES_KAOMOJI[Math.floor(Math.random() * ANIMACIONES_KAOMOJI.length)].id)
      : null;
    setTexto("");
    if (borradorOffRef.current) clearTimeout(borradorOffRef.current);
    limpiarBorradorGuardado(conversacionId);
    setRespondiendoA(null);
    setEstiloSeleccionado(null);
    setAnimacionSeleccionada(null);
    if (escribiendoOffRef.current) {
      clearTimeout(escribiendoOffRef.current);
      escribiendoOffRef.current = null;
      void emitirEscribiendo(conversacionId, user.id, false);
    }
    try {
      const enviado = await enviarMensaje(
        conversacionId,
        contenido,
        undefined,
        respuestaAId,
        estiloAEnviar,
        animacionAEnviar,
      );
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
      setEstiloSeleccionado(estiloSeleccionado);
      setAnimacionSeleccionada(animacionSeleccionada);
    } finally {
      setEnviando(false);
    }
  };

  const guardarPosicion = useMensajesStore((s) => s.guardarPosicion);
  const handleScrollMensajes = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop < 80) void handleCargarAnteriores();
  };

  // Al salir de la conversación (cambio de chat o desmontaje), guardamos
  // qué tan lejos del fondo se quedó y cuál fue el último mensaje visible.
  // No se usa para restaurar el scroll al reabrir (esta conversación
  // siempre abre en el fondo, a propósito — ver los comentarios del efecto
  // de scroll inicial más arriba); es una pista liviana para el futuro
  // (ej. saber si el usuario se fue a mitad de una lectura larga) sin
  // pelear contra ese diseño ya intencional.
  useEffect(() => {
    return () => {
      const contenedor = scrollRef.current;
      const ultimo = mensajesRef.current[mensajesRef.current.length - 1];
      if (!contenedor || !ultimo || !conversacionId) return;
      const proporcion =
        contenedor.scrollHeight > contenedor.clientHeight
          ? (contenedor.scrollTop + contenedor.clientHeight) / contenedor.scrollHeight
          : 1;
      guardarPosicion(conversacionId, {
        ultimoMensajeId: ultimo.id,
        scrollProporcion: Math.min(1, Math.max(0, proporcion)),
      });
    };
  }, [conversacionId, guardarPosicion]);

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

  /** Cuántos emojis "quedan pegados" en la pill por cada explosión — simula
   *  la lluvia sin tener que contar el detalle exacto de cada partícula
   *  animada. Si el mismo usuario dispara varias explosiones seguidas sobre
   *  el mismo mensaje+emoji, se van sumando (ver dispararExplosion en
   *  chatEngine.ts). */
  const EXPLOSION_INCREMENTO = 5;

  /** Dispara localmente la animación de explosión para un mensaje/emoji, la
   *  manda por broadcast al otro participante para que la vea en vivo si
   *  tiene el chat abierto, y en paralelo la PERSISTE (tabla
   *  mensaje_explosiones) para que quede como una pill con varios emojis
   *  apilados aunque el otro no haya estado mirando en el momento — tanto
   *  la animación como el broadcast son fire-and-forget (cosmético puro),
   *  pero la persistencia si falla sí queda logueada. */
  const dispararExplosionEmoji = (mensajeId: string, emoji: string) => {
    const disparoId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setExplosionPorMensaje((prev) => ({ ...prev, [mensajeId]: { emoji, disparoId } }));
    if (navigator.vibrate) navigator.vibrate(15);
    void emitirExplosionEmoji(conversacionId, user.id, mensajeId, emoji);

    // Optimista: actualizamos/creamos la pill local ya mismo, sin esperar
    // el round-trip — igual que reacciones. El evento realtime de vuelta
    // (suscribirseAExplosiones) reemplaza por la fila real cuando llega.
    setExplosiones((prev) => {
      const existente = prev.find(
        (e) => e.mensaje_id === mensajeId && e.perfil_id === user.id && e.emoji === emoji,
      );
      if (existente) {
        return prev.map((e) =>
          e.id === existente.id ? { ...e, cantidad: e.cantidad + EXPLOSION_INCREMENTO } : e,
        );
      }
      return [
        ...prev,
        {
          id: `optimista-${disparoId}`,
          mensaje_id: mensajeId,
          perfil_id: user.id,
          emoji,
          cantidad: EXPLOSION_INCREMENTO,
          created_at: new Date().toISOString(),
        },
      ];
    });

    void dispararExplosion(mensajeId, conversacionId, emoji, EXPLOSION_INCREMENTO).catch((err) => {
      console.warn("No se pudo persistir la explosión de emoji:", err);
    });
  };

  const cancelarExplosionLongPress = () => {
    if (explosionLongPressTimerRef.current) {
      clearTimeout(explosionLongPressTimerRef.current);
      explosionLongPressTimerRef.current = null;
    }
  };

  /** Se engancha en onPointerDown de cada emoji del picker rápido: si se
   *  suelta antes de EXPLOSION_LONG_PRESS_MS es un tap normal (reacciona
   *  como siempre); si se sostiene, dispara la explosión y NO reacciona
   *  además — son dos gestos distintos, igual que en Instagram. */
  const handlePointerDownEmojiPicker = (mensajeId: string, emoji: string) => {
    explosionDisparadaRef.current = false;
    cancelarExplosionLongPress();
    explosionLongPressTimerRef.current = setTimeout(() => {
      explosionDisparadaRef.current = true;
      setPickerAbiertoPara(null);
      dispararExplosionEmoji(mensajeId, emoji);
    }, EXPLOSION_LONG_PRESS_MS);
  };

  const handlePointerUpEmojiPicker = (mensajeId: string, emoji: string) => {
    cancelarExplosionLongPress();
    // Si ya se disparó la explosión durante este mismo gesto, no además
    // togglear la reacción al soltar — son mutuamente excluyentes.
    if (explosionDisparadaRef.current) return;
    void handleToggleReaccion(mensajeId, emoji);
  };

  const handleToggleReaccion = async (mensajeId: string, emoji: string) => {
    setPickerAbiertoPara(null);
    const yaReaccione = reacciones.some(
      (r) => r.mensaje_id === mensajeId && r.perfil_id === user.id && r.emoji === emoji,
    );

    // Optimista: la ponemos/sacamos ya mismo en el estado local, sin
    // esperar la vuelta de Supabase — antes esto tardaba ese tick de red
    // porque solo se actualizaba cuando llegaba el evento realtime de
    // vuelta. Guardamos la reacción/versión anterior para poder revertir
    // si la escritura real termina fallando.
    const reaccionesPrevias = reacciones;
    if (yaReaccione) {
      setReacciones((prev) =>
        prev.filter(
          (r) => !(r.mensaje_id === mensajeId && r.perfil_id === user.id && r.emoji === emoji),
        ),
      );
    } else {
      const reaccionOptimista: MensajeReaccion = {
        // id temporal (prefijo distinguible) — cuando llegue el INSERT real
        // por realtime con el id verdadero, el evento no matchea este id
        // así que técnicamente quedarían las dos; lo evitamos abajo
        // filtrando por (mensaje_id, perfil_id, emoji) antes de insertar.
        id: `optimista-${mensajeId}-${emoji}-${Date.now()}`,
        mensaje_id: mensajeId,
        perfil_id: user.id,
        emoji,
        created_at: new Date().toISOString(),
      };
      setReacciones((prev) => [
        ...prev.filter(
          (r) => !(r.mensaje_id === mensajeId && r.perfil_id === user.id && r.emoji === emoji),
        ),
        reaccionOptimista,
      ]);
    }

    try {
      if (yaReaccione) {
        await quitarReaccion(mensajeId, emoji);
      } else {
        await reaccionarAMensaje(mensajeId, emoji, conversacionId);
      }
    } catch {
      // Si falló de verdad (no solo lento), revertimos al estado anterior
      // y avisamos — no queremos dejar una reacción "fantasma" puesta en
      // pantalla que en realidad nunca se guardó.
      setReacciones(reaccionesPrevias);
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

  // ── Grabador de audio ────────────────────────────────────────────────
  const grabador = useGrabadorAudio();
  const [enviandoAudio, setEnviandoAudio] = useState(false);
  // Umbral corto de grabación: si soltaste antes de esto, lo tratamos como
  // un toque accidental y descartamos en vez de mandar un audio de medio
  // segundo — igual que WhatsApp con su "deslizá para cancelar".
  const DURACION_MINIMA_MS = 700;
  const inicioGrabacionRef = useRef(0);

  const handleIniciarGrabacion = async () => {
    inicioGrabacionRef.current = Date.now();
    await grabador.iniciar();
  };

  const handleDetenerYEnviarAudio = async () => {
    const duro = Date.now() - inicioGrabacionRef.current;
    const blob = await grabador.detenerYObtener();
    if (!blob || duro < DURACION_MINIMA_MS) return;

    setEnviandoAudio(true);
    try {
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      const archivo = new File([blob], `audio-${Date.now()}.${extension}`, { type: blob.type });
      const adjunto = await subirAdjunto(conversacionId, archivo);
      const enviado = await enviarMensaje(conversacionId, "", adjunto);
      setMensajes((prev) => (prev.some((p) => p.id === enviado.id) ? prev : [...prev, enviado]));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo enviar el audio.");
    } finally {
      setEnviandoAudio(false);
    }
  };

  const handleCancelarGrabacion = () => {
    grabador.cancelar();
  };

  useEffect(() => {
    if (grabador.errorMensaje) setError(grabador.errorMensaje);
  }, [grabador.errorMensaje]);

  // ── Datos derivados por mensaje, memoizados ──────────────────────────────
  // Antes esto se recalculaba DENTRO del .map() de cada mensaje en cada
  // render: reacciones.filter/explosiones.filter recorrían el array
  // COMPLETO de reacciones/explosiones por cada mensaje (O(n·m)), y
  // "esUltimoPropio" hacía mensajes.slice(idx+1).some(...) por mensaje
  // (O(n²)) — en una conversación de varios cientos de mensajes esto se
  // sentía en cada tecla de "escribiendo…" o cada reacción nueva, porque
  // cualquier cambio de estado disparaba TODO ese trabajo de nuevo para
  // TODA la lista, no solo para lo que cambió. Ahora se arma una sola vez
  // por render (y solo se recalcula si `mensajes`/`reacciones`/
  // `explosiones`/`otroUltimoLeido` realmente cambiaron) y el .map() de
  // abajo solo hace lookups O(1) en estos mapas.
  const reaccionesPorMensaje = useMemo(() => {
    const mapa = new Map<string, Record<string, number>>();
    for (const r of reacciones) {
      const acc = mapa.get(r.mensaje_id) ?? {};
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
      mapa.set(r.mensaje_id, acc);
    }
    return mapa;
  }, [reacciones]);

  const explosionesPorMensaje = useMemo(() => {
    const mapa = new Map<string, Record<string, number>>();
    for (const e of explosiones) {
      const acc = mapa.get(e.mensaje_id) ?? {};
      acc[e.emoji] = (acc[e.emoji] ?? 0) + e.cantidad;
      mapa.set(e.mensaje_id, acc);
    }
    return mapa;
  }, [explosiones]);

  // Id del último mensaje propio de toda la conversación — evita el
  // mensajes.slice(idx+1).some(...) por mensaje (antes O(n²) en total).
  const idUltimoMensajePropio = useMemo(() => {
    for (let i = mensajes.length - 1; i >= 0; i--) {
      if (mensajes[i].remitente_id === user?.id) return mensajes[i].id;
    }
    return null;
  }, [mensajes, user?.id]);

  // Lookup O(1) por id para resolver la burbuja citada (reply), en vez de
  // mensajes.find(...) — O(n) por cada mensaje que cita a otro.
  const mensajesPorId = useMemo(() => {
    const mapa = new Map<string, Mensaje>();
    for (const m of mensajes) mapa.set(m.id, m);
    return mapa;
  }, [mensajes]);

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
    <div className="h-dvh md:min-h-0 md:h-full flex flex-col overflow-hidden bg-bg-main">
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
      {/* visibility (no display:none) para que el contenedor SÍ tenga
          layout real y scrollHeight calculable mientras el useLayoutEffect
          de arriba decide dónde poner el scroll — con display:none el
          navegador no calcula nada y el primer scrollTo quedaría mal. Una
          vez que scrollListo es true (ya posicionado, mismo paso síncrono
          previo al paint) se revela sin que se haya visto ningún salto. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2"
        style={{ visibility: scrollListo ? "visible" : "hidden" }}
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
            const esUltimoPropio = esMio && m.id === idUltimoMensajePropio;
            const visto =
              esUltimoPropio &&
              !!otroUltimoLeido &&
              new Date(otroUltimoLeido) >= new Date(m.created_at);
            const reaccionesAgrupadas = reaccionesPorMensaje.get(m.id) ?? {};
            // Explosiones persistidas de este mensaje, agrupadas por emoji
            // (sumando la cantidad de todos los que la dispararon, sin
            // importar quién) para la pill "lluvia de corazones".
            const explosionesAgrupadas = explosionesPorMensaje.get(m.id) ?? {};
            const enEdicion = editandoId === m.id;
            const mensajeCitado = m.respuesta_a
              ? mensajesPorId.get(m.respuesta_a) ?? null
              : null;

            const disenoBurbuja = estiloExtraBurbuja(m.estilo, esMio, m.id);
            const esKaomoji = m.estilo === "kaomoji";

            return (
              <div key={m.id} className={`flex flex-col ${esMio ? "items-end" : "items-start"} group`}>
                <div
                  data-mensaje-burbuja
                  className={`max-w-[75%] relative select-none md:select-text ${
                    esKaomoji
                      ? `px-2 py-1 text-3xl ${claseAnimacion(m.animacion)}`
                      : `px-4 py-2.5 rounded-[var(--radius-btn)] ${disenoBurbuja.className}`
                  }`}
                  style={
                    esKaomoji
                      ? {
                          background: "transparent",
                          color: "var(--foreground)",
                          WebkitTouchCallout: "none",
                          lineHeight: 1,
                        }
                      : {
                          background: esMio
                            ? "var(--primary)"
                            : "color-mix(in srgb, var(--primary) 6%, transparent)",
                          color: esMio ? "var(--btn-text)" : "var(--foreground)",
                          WebkitTouchCallout: "none",
                          ...disenoBurbuja.style,
                        }
                  }
                  onTouchStart={() => handleTouchStartMensaje(m.id)}
                  onTouchEnd={handleTouchEndMensaje}
                  onTouchMove={handleTouchMoveMensaje}
                  onMouseDown={() => handleMouseDownMensaje(m.id)}
                  onMouseLeave={handleMouseUpOrLeaveMensaje}
                  onMouseUp={handleMouseUpOrLeaveMensaje}
                  onContextMenu={(e) => {
                    // Evita el menú contextual nativo (copiar/seleccionar) en
                    // mobile, que es lo que se disparaba en vez de nuestro menú.
                    e.preventDefault();
                  }}
                >
                  {/* Colita de burbujitas decrecientes para el diseño
                      "pensamiento", estilo nube de cómic clásica. */}
                  {m.estilo === "pensamiento" && (
                    <div
                      className={`absolute flex flex-col gap-0.5 ${esMio ? "items-end -right-1" : "items-start -left-1"}`}
                      style={{ bottom: -14, [esMio ? "right" : "left"]: 8 } as React.CSSProperties}
                    >
                      <span
                        className="rounded-full"
                        style={{
                          width: 9,
                          height: 9,
                          background: esMio
                            ? "var(--primary)"
                            : "color-mix(in srgb, var(--primary) 6%, transparent)",
                          border: "1.5px solid color-mix(in srgb, var(--primary) 20%, transparent)",
                        }}
                      />
                      <span
                        className="rounded-full"
                        style={{
                          width: 5,
                          height: 5,
                          background: esMio
                            ? "var(--primary)"
                            : "color-mix(in srgb, var(--primary) 6%, transparent)",
                          border: "1.5px solid color-mix(in srgb, var(--primary) 20%, transparent)",
                        }}
                      />
                    </div>
                  )}
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

                  {/* Menú de opciones (responder/reaccionar/editar/eliminar).
                      En desktop aparece con :hover (group-hover); en mobile
                      no existe hover, así que también se muestra cuando el
                      long-press marcó este mensaje como activo
                      (menuTactilPara), sin necesitar tocar y mantener. */}
                  <div
                    className={`absolute top-1 ${esMio ? "-left-32" : "-right-32"} transition-opacity flex items-center gap-1 ${
                      menuTactilPara === m.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <button
                      aria-label="Responder"
                      onClick={() => {
                        handleResponder(m);
                        setMenuTactilPara(null);
                      }}
                      className="p-1 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                    >
                      <Reply className="text-primary/60" size={13} />
                    </button>
                    {esMio && (
                      <>
                        <button
                          aria-label="Editar"
                          onClick={() => {
                            handleIniciarEdicion(m);
                            setMenuTactilPara(null);
                          }}
                          className="p-1 rounded-full"
                          style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                        >
                          <Pencil className="text-primary/60" size={13} />
                        </button>
                        <button
                          aria-label="Eliminar"
                          onClick={() => {
                            void handleEliminarMensaje(m.id);
                            setMenuTactilPara(null);
                          }}
                          className="p-1 rounded-full"
                          style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                        >
                          <Trash2 className="text-red-400/70" size={13} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Picker de emojis rápidos + botón "+" para el selector completo */}
                  {pickerAbiertoPara === m.id && (
                    <div
                      className={`absolute -top-12 ${esMio ? "right-0" : "left-0"} flex items-center gap-1.5 px-3 py-2 rounded-full z-10`}
                      style={{ background: "var(--bg-main)", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}
                    >
                      {EMOJIS_RAPIDOS.map((emoji) => (
                        <button
                          key={emoji}
                          className="text-2xl leading-none hover:scale-125 active:scale-95 transition-transform select-none"
                          onContextMenu={(e) => e.preventDefault()}
                          onMouseDown={() => handlePointerDownEmojiPicker(m.id, emoji)}
                          onMouseLeave={cancelarExplosionLongPress}
                          onMouseUp={() => handlePointerUpEmojiPicker(m.id, emoji)}
                          onPointerDown={() => handlePointerDownEmojiPicker(m.id, emoji)}
                          onPointerLeave={cancelarExplosionLongPress}
                          onPointerUp={() => handlePointerUpEmojiPicker(m.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        aria-label="Más emojis"
                        className="flex items-center justify-center rounded-full hover:scale-110 transition-transform"
                        style={{
                          width: 26,
                          height: 26,
                          background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                        }}
                        onClick={() => {
                          setPickerAbiertoPara(null);
                          setSelectorCompletoAbiertoPara(m.id);
                        }}
                      >
                        <Plus className="text-primary/60" size={16} />
                      </button>
                    </div>
                  )}

                  {/* Selector completo de emojis (todas las categorías) */}
                  {selectorCompletoAbiertoPara === m.id && (
                    <SelectorEmojisCompleto
                      onSeleccionar={(emoji) => {
                        void handleToggleReaccion(m.id, emoji);
                        setSelectorCompletoAbiertoPara(null);
                      }}
                      onExplosion={(emoji) => {
                        dispararExplosionEmoji(m.id, emoji);
                        setSelectorCompletoAbiertoPara(null);
                      }}
                      onCerrar={() => setSelectorCompletoAbiertoPara(null)}
                    />
                  )}

                  {/* Explosión de emojis (long-press estilo Instagram) —
                      propia o mandada por el otro participante */}
                  {explosionPorMensaje[m.id] && (
                    <ExplosionEmoji
                      emoji={explosionPorMensaje[m.id].emoji}
                      disparoId={explosionPorMensaje[m.id].disparoId}
                      onTerminar={() =>
                        setExplosionPorMensaje((prev) => {
                          const { [m.id]: _quitado, ...resto } = prev;
                          return resto;
                        })
                      }
                    />
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

                {/* Explosiones de emoji persistidas — pill con el emoji
                    repetido varias veces para simular la lluvia (ej.
                    ❤️❤️❤️❤️❤️), en vez de un simple contador numérico. Se ve
                    tanto para quien la mandó como para el otro participante,
                    incluso si no estaba con el chat abierto en el momento
                    (a diferencia de la animación en vivo de arriba, esto
                    queda guardado). Click también suma otra tanda. */}
                {Object.keys(explosionesAgrupadas).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5 max-w-[75%]">
                    {Object.entries(explosionesAgrupadas).map(([emoji, cantidad]) => (
                      <button
                        key={emoji}
                        onClick={() => dispararExplosionEmoji(m.id, emoji)}
                        title={`${cantidad} ${emoji}`}
                        className="text-micro px-1.5 py-0.5 rounded-full flex items-center flex-wrap gap-0"
                        style={{
                          background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                        }}
                      >
                        {emoji.repeat(Math.min(cantidad, MAX_EMOJIS_EN_PILL))}
                        {cantidad > MAX_EMOJIS_EN_PILL && (
                          <span className="text-primary/60 ml-0.5">+{cantidad - MAX_EMOJIS_EN_PILL}</span>
                        )}
                      </button>
                    ))}
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

        {grabador.estado === "grabando" ? (
          // ── Modo grabando: reemplaza el resto del input (texto, adjuntar)
          // mientras se está grabando — igual que WhatsApp: el foco pasa
          // por completo a "grabando... / cancelar / soltar para enviar".
          <div
            className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-btn)]"
            style={{ background: "color-mix(in srgb, var(--primary) 5%, transparent)" }}
          >
            <span
              className="rounded-full flex-shrink-0 animate-pulse"
              style={{ width: 10, height: 10, background: "#ef4444" }}
            />
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatearDuracion(grabador.duracionSegundos)}
            </span>
            <span className="flex-1 text-micro text-primary/40 italic">Grabando audio…</span>
            <button
              onClick={handleCancelarGrabacion}
              aria-label="Cancelar grabación"
              className="text-micro font-black uppercase tracking-wide text-primary/50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <>
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
            <button
              onClick={() => setConstructorKaomojiAbierto(true)}
              aria-label="Armar kaomoji"
              className="flex items-center justify-center flex-shrink-0"
            >
              <span className="text-primary/50 text-base leading-none select-none">⁠(⁠･⁠ω⁠･⁠)⁠</span>
            </button>
            <div className="relative flex-shrink-0">
              <button
                aria-label="Elegir diseño de burbuja"
                className="flex items-center justify-center"
                onClick={() => setSelectorDisenoAbierto((v) => !v)}
              >
                {(() => {
                  const activo = DISENOS_BURBUJA.find((d) => d.id === estiloSeleccionado);
                  const IconoActivo = activo?.Icono ?? MessageSquareText;
                  return (
                    <IconoActivo
                      className={estiloSeleccionado ? "text-primary" : "text-primary/50"}
                      size={18}
                    />
                  );
                })()}
              </button>
              {selectorDisenoAbierto && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSelectorDisenoAbierto(false)}
                  />
                  <div
                    className="absolute bottom-full left-0 mb-2 z-20 rounded-[var(--radius-btn)] overflow-hidden flex-shrink-0"
                    style={{
                      width: 180,
                      background: "var(--bg-main)",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
                      border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                    }}
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium"
                      style={{
                        background: !estiloSeleccionado
                          ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                          : "transparent",
                      }}
                      onClick={() => {
                        setEstiloSeleccionado(null);
                        setAnimacionSeleccionada(null);
                        setSelectorDisenoAbierto(false);
                      }}
                    >
                      <MessageSquareText className="text-primary/60 flex-shrink-0" size={16} />
                      Normal
                    </button>
                    {DISENOS_BURBUJA.map((d) => (
                      <button
                        key={d.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium"
                        style={{
                          background:
                            estiloSeleccionado === d.id
                              ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                              : "transparent",
                        }}
                        onClick={() => {
                          setEstiloSeleccionado(d.id);
                          // Para "kaomoji" dejamos el popover abierto: pasa
                          // a mostrar el submenú de animación en vez de
                          // cerrarse, así se elige todo en el mismo click.
                          if (d.id !== "kaomoji") setSelectorDisenoAbierto(false);
                        }}
                      >
                        <d.Icono className="text-primary/60 flex-shrink-0" size={16} />
                        {d.label}
                      </button>
                    ))}
                    {estiloSeleccionado === "kaomoji" && (
                      <div
                        style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)" }}
                      >
                        <p className="text-micro font-bold text-primary/40 uppercase tracking-wide px-3 pt-2 pb-1">
                          Animación
                        </p>
                        {ANIMACIONES_KAOMOJI.map((a) => (
                          <button
                            key={a.id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium"
                            style={{
                              background:
                                animacionSeleccionada === a.id
                                  ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                                  : "transparent",
                            }}
                            onClick={() => {
                              setAnimacionSeleccionada(a.id);
                              setSelectorDisenoAbierto(false);
                            }}
                          >
                            <a.Icono className="text-primary/60 flex-shrink-0" size={16} />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
          </>
        )}

        {/* Botón de acción principal: enviar texto si hay algo escrito,
            micrófono (mantener presionado para grabar) si el input está
            vacío — mismo patrón que WhatsApp/Instagram/Telegram. Con
            texto: comportamiento de siempre. Sin texto: mantener
            presionado arranca a grabar, soltar corta y manda el audio;
            soltar afuera del botón (pointerleave) también lo corta y
            manda, para no perder la grabación por accidente. */}
        {texto.trim() ? (
          <button
            className="flex items-center justify-center rounded-full flex-shrink-0"
            disabled={enviando}
            style={{
              width: 36,
              height: 36,
              background: "var(--primary)",
              color: "var(--btn-text)",
              opacity: enviando ? 0.4 : 1,
            }}
            onClick={() => void handleEnviar()}
            aria-label="Enviar"
          >
            <Send size={14} />
          </button>
        ) : (
          <button
            className="flex items-center justify-center rounded-full flex-shrink-0 select-none"
            disabled={enviandoAudio || grabador.estado === "pidiendo_permiso"}
            style={{
              width: 36,
              height: 36,
              background: grabador.estado === "grabando" ? "#ef4444" : "var(--primary)",
              color: "var(--btn-text)",
              opacity: enviandoAudio || grabador.estado === "pidiendo_permiso" ? 0.4 : 1,
              transform: grabador.estado === "grabando" ? "scale(1.1)" : "scale(1)",
              transition: "transform 0.15s ease, background 0.15s ease",
            }}
            onPointerDown={() => void handleIniciarGrabacion()}
            onPointerUp={() => void handleDetenerYEnviarAudio()}
            onPointerLeave={() => {
              if (grabador.estado === "grabando") void handleDetenerYEnviarAudio();
            }}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={grabador.estado === "grabando" ? "Soltar para enviar audio" : "Mantené presionado para grabar audio"}
          >
            <Mic size={14} />
          </button>
        )}
      </div>

      {constructorKaomojiAbierto && (
        <ConstructorKaomoji
          onInsertar={(kaomoji) => {
            // Insertamos al final de lo que ya haya escrito, con un espacio
            // separador solo si ya había texto — así se puede armar el
            // kaomoji solo, o pegarlo al final de una frase.
            handleCambioTexto(texto ? `${texto} ${kaomoji}` : kaomoji);
          }}
          onCerrar={() => setConstructorKaomojiAbierto(false)}
        />
      )}
    </div>
  );
}

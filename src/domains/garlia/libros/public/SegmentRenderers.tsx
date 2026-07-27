"use client";

/**
 * SegmentRenderers.tsx
 * ────────────────────
 * Todos los componentes de renderizado de segmentos en lectura.
 * Reemplaza los 6 archivos separados:
 *   - CitaVisual.tsx
 *   - ImgInline.tsx
 *   - SoundInline.tsx
 *   - FloatWord.tsx
 *   - DropWord.tsx
 *   - Interactivos.tsx (ChoiceButton + UseWord)
 *
 * Uso en ContenidoInteractivo.tsx:
 *   import { CitaVisual, ImgInline, SoundInline, FloatWord, DropWord, ChoiceButton, UseWord }
 *     from "./SegmentRenderers";
 */

import { AnimatePresence } from "framer-motion";
import {
  X,
  Music2,
  Sword,
  Package,
  Sparkles,
  Check,
  Loader2,
  User,
  ChevronRight as ChevronR,
  Feather,
} from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect, useRef } from "react";

import { BtnIcon } from "@/ui";
import { useConfirm } from "@/ui/ConfirmModal";
import { MotionDiv, MotionSpan, MotionButton } from "@/ui/Motion";
import { ToastContainer } from "@/ui/ToastContainer";
import { useToast } from "@/hooks/ui/useToast";
import { supabase } from "@/infra/supabase/supabase";
import { cn } from "@/lib/utils/index";

// ─────────────────────────────────────────────────────────────────────────────
// CitaVisual
// ─────────────────────────────────────────────────────────────────────────────

export function CitaVisual({ content }: { content: string }) {
  const dashIdx = content.lastIndexOf(" — ");
  const texto = dashIdx !== -1 ? content.slice(0, dashIdx) : content;
  const fuente = dashIdx !== -1 ? content.slice(dashIdx + 3) : null;

  const featherStyle: React.CSSProperties = {
    display: "inline",
    verticalAlign: "middle",
    color: "var(--color-primary, var(--primary))",
    opacity: 0.45,
    flexShrink: 0,
  };

  return (
    <div className="my-10 mx-0 text-center">
      {/* línea superior */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, color-mix(in srgb, var(--color-primary, var(--primary)) 40%, transparent), transparent)",
          marginBottom: "1.25rem",
        }}
      />

      <p
        className="font-serif italic leading-[1.95]"
        style={{
          fontSize: "clamp(1rem, 2.5vw, 1.1rem)",
          color: "var(--foreground)",
          opacity: 0.85,
        }}
      >
        <Feather
          aria-hidden
          size={12}
          style={{ ...featherStyle, marginRight: 10 }}
        />
        {texto}
        <Feather
          aria-hidden
          size={12}
          style={{ ...featherStyle, marginLeft: 10 }}
        />
      </p>

      {fuente && (
        <p
          className="mt-3 font-sans font-medium uppercase tracking-[0.2em]"
          style={{
            fontSize: 10,
            color: "var(--color-primary, var(--primary))",
            opacity: 0.55,
          }}
        >
          — {fuente}
        </p>
      )}

      {/* línea inferior */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right, transparent, color-mix(in srgb, var(--color-primary, var(--primary)) 40%, transparent), transparent)",
          marginTop: "1.25rem",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EpigrafeVisual — cita/epígrafe literario de inicio de capítulo. Distinto
// de CitaVisual (bibliográfica, centrada con líneas decorativas): este es
// el bloque en cursiva alineado a la izquierda, con la atribución en una
// línea aparte alineada a la derecha — el estilo clásico de epígrafe.
// ─────────────────────────────────────────────────────────────────────────────

export function EpigrafeVisual({
  texto,
  atribucion,
}: {
  texto: string;
  atribucion: string;
}) {
  return (
    <div className="my-10 mx-0" style={{ maxWidth: "32rem" }}>
      <p
        className="font-serif italic leading-[1.85]"
        style={{
          fontSize: "clamp(0.95rem, 2.2vw, 1.05rem)",
          color: "var(--foreground)",
          opacity: 0.85,
        }}
      >
        {texto}
      </p>
      {atribucion && (
        <p
          className="mt-3 font-sans font-medium uppercase tracking-[0.15em] text-right"
          style={{
            fontSize: 10,
            color: "var(--color-primary, var(--primary))",
            opacity: 0.6,
          }}
        >
          — {atribucion}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ImgInline
// ─────────────────────────────────────────────────────────────────────────────

export function ImgInline({ url, caption }: { url: string; caption?: string }) {
  return (
    <figure className="my-12 -mx-6 md:-mx-12">
      <div className="relative overflow-hidden rounded-[var(--radius-btn)] md:rounded-[var(--radius-card)] shadow-xl shadow-[var(--foreground)]/10">
        <Image
          alt={caption ?? ""}
          className="w-full object-cover"
          src={url}
          style={{ maxHeight: 520 }}
        />
        {caption && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-[var(--bg-menu)]/60 to-transparent" />
        )}
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-micro font-black uppercase tracking-[0.2em] text-primary/35">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SoundInline
// ─────────────────────────────────────────────────────────────────────────────

export function SoundInline({ url, volume }: { url: string; volume: number }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Bug 5 fix: al cambiar la URL, pausar y resetear el audio anterior
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
    }
  }, [url]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.loop = true;
      audioRef.current.volume = volume;
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const label =
    url
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "") ?? "sonido";

  return (
    <span
      className="inline-flex items-center gap-2 mx-1 my-2 px-3 py-1.5 rounded-[var(--radius-btn)] border align-middle transition-all select-none cursor-pointer"
      role="button"
      style={{
        background: playing
          ? "var(--color-primary, var(--primary))"
          : "rgba(var(--color-primary-rgb, 107,94,112), 0.06)",
        borderColor: playing
          ? "var(--color-primary, var(--primary))"
          : "rgba(var(--color-primary-rgb, 107,94,112), 0.15)",
        color: playing ? "white" : "rgba(107,94,112,0.6)",
      }}
      title={playing ? "Detener ambientación" : "Reproducir ambientación"}
      onClick={toggle}
    >
      {playing ? (
        <span className="inline-flex items-end gap-px h-3">
          {[0, 1, 2].map((i) => (
            <MotionSpan
              key={i}
              animate={{ height: ["4px", "10px", "5px", "12px", "4px"][i % 5] }}
              className="w-px rounded-full bg-white-custom"
              style={{ display: "inline-block" }}
              transition={{
                duration: 0.5 + i * 0.1,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            />
          ))}
        </span>
      ) : (
        <Music2 size={12} />
      )}
      <span className="text-micro font-black uppercase tracking-widest leading-none">
        {label}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FloatWord
// ─────────────────────────────────────────────────────────────────────────────

export function FloatWord({
  word,
  url,
  caption,
}: {
  word: string;
  url: string;
  caption?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        className="relative inline font-serif cursor-pointer group"
        onClick={handleClick}
      >
        <span
          style={{
            backgroundImage: "linear-gradient(var(--accent), var(--accent))",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 1px",
            backgroundPosition: "0 100%",
            paddingBottom: "1px",
          }}
        >
          {word}
        </span>
        <span className="absolute -top-1.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-accent/60 group-hover:bg-accent transition-colors" />
      </button>

      <AnimatePresence>
        {open && pos && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[55]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed z-[56] pointer-events-auto"
              exit={{ opacity: 0, scale: 0.88, y: 8 }}
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              style={{
                left: Math.min(
                  Math.max(pos.x - 160, 12),
                  (typeof window !== "undefined" ? window.innerWidth : 800) -
                    332,
                ),
                // Bug 4 fix: guard SSR para window.scrollY
                top: Math.max(
                  pos.y -
                    280 -
                    (typeof window !== "undefined" ? window.scrollY : 0),
                  12,
                ),
                width: 320,
              }}
              transition={{ type: "spring", damping: 24, stiffness: 340 }}
            >
              <div
                className="rounded-[var(--radius-btn)] overflow-hidden shadow-2xl"
                style={{
                  boxShadow:
                    "0 24px 64px rgba(44,38,46,0.22), 0 4px 16px rgba(44,38,46,0.12)",
                }}
              >
                <div className="relative">
                  <Image
                    alt={caption ?? word}
                    className="w-full object-cover"
                    src={url}
                    style={{ maxHeight: 260 }}
                  />
                  <BtnIcon onClick={() => setOpen(false)}>
                    <X size={13} />
                  </BtnIcon>
                </div>
                {caption && (
                  <div className="bg-white-custom px-4 py-3">
                    <p className="text-micro font-black uppercase tracking-widest text-primary/50 text-center">
                      {caption}
                    </p>
                  </div>
                )}
              </div>
              <div
                className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0"
                style={{
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                  borderTop: caption
                    ? "8px solid white"
                    : "8px solid var(--foreground)",
                }}
              />
            </MotionDiv>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DropWord
// ─────────────────────────────────────────────────────────────────────────────

type DropState =
  | "idle"
  | "loading"
  | "success"
  | "already"
  | "error"
  | "no_auth";

interface DropWordProps {
  word: string;
  tipo: "item" | "criatura" | "personaje";
  entidadId: string;
  entidadNombre: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function DropWord({
  word,
  tipo,
  entidadId,
  entidadNombre,
}: DropWordProps) {
  // Defensa contra datos viejos: algunos drops guardados antes del fix de
  // FormDrop tienen el UUID en la posición de "palabra" en vez del texto
  // legible. En vez de mostrar el UUID crudo, mostramos el nombre real
  // de la entidad si lo tenemos, o un texto genérico como último recurso.
  const displayWord = UUID_RE.test(word.trim())
    ? entidadNombre?.trim() || "esto"
    : word;

  const [state, setState] = useState<DropState>("idle");
  const [open, setOpen] = useState(false);
  // Bug 1 fix: guard para evitar doble inserción por doble click o re-render
  const insertandoRef = useRef(false);

  const handleClick = async () => {
    if (state === "success" || state === "already") return;
    // Bug 1 fix: bloquear si ya hay una inserción en curso
    if (insertandoRef.current) return;
    insertandoRef.current = true;
    setOpen(true);
    setState("loading");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState("no_auth");
        return;
      }

      const tablaMap: Record<string, { tabla: string; col: string }> = {
        item: { tabla: "descubrimientos_items", col: "item_id" },
        criatura: { tabla: "descubrimientos_criaturas", col: "criatura_id" },
        personaje: { tabla: "descubrimientos_personajes", col: "personaje_id" },
      };
      // Bug 2 fix: tipo no mapeado ya no explota — falla graciosamente
      const mapping = tablaMap[tipo];
      if (!mapping) {
        console.error("[DropWord] tipo desconocido:", tipo);
        setState("error");
        return;
      }
      const { tabla, col } = mapping;

      const { data: existing, error: checkError } = await supabase
        .from(tabla)
        .select("id")
        .eq("perfil_id", user.id)
        .eq(col, entidadId)
        .maybeSingle();
      if (checkError) throw checkError;
      if (existing) {
        setState("already");
        return;
      }

      const { error: insertError } = await supabase
        .from(tabla)
        .insert({ perfil_id: user.id, [col]: entidadId });
      if (insertError) throw insertError;

      setState("success");
    } catch (err) {
      console.error("[DropWord Error]", err);
      setState("error");
    } finally {
      // Bug 1 fix: liberar el guard siempre, incluso en error
      insertandoRef.current = false;
    }
  };

  // Bug 3 fix: cerrar automáticamente el modal cuando el estado es terminal
  useEffect(() => {
    if (state === "success" || state === "already") {
      const t = setTimeout(() => setOpen(false), 2200);
      return () => clearTimeout(t);
    }
  }, [state]);

  const IconMap = { item: Package, criatura: Sword, personaje: User } as const;
  const Icon = IconMap[tipo] ?? Sparkles;

  const messages: Record<
    DropState,
    { title: string; sub: string; color: string }
  > = {
    idle: { title: "", sub: "", color: "" },
    loading: { title: "Sellando...", sub: "", color: "text-primary" },
    success: {
      title:
        tipo === "item"
          ? "¡Item obtenido!"
          : tipo === "criatura"
            ? "¡Criatura descubierta!"
            : "¡Personaje conocido!",
      sub: `${entidadNombre} ha sido añadido a tu perfil`,
      color: "text-emerald-500",
    },
    already: {
      title: "Ya lo tienes",
      sub: `${entidadNombre} ya está en tu perfil`,
      color: "text-primary/60",
    },
    error: {
      title: "Error",
      sub: "No se pudo registrar",
      color: "text-red-400",
    },
    no_auth: {
      title: "Inicia sesión",
      sub: "Necesitas una cuenta para guardar este hallazgo",
      color: "text-amber-500",
    },
  };

  return (
    <>
      <button
        className={cn(
          "relative inline font-serif cursor-pointer group",
          (state === "success" || state === "already") && "cursor-default",
        )}
        onClick={handleClick}
      >
        <span
          style={{
            backgroundImage:
              state === "success"
                ? "linear-gradient(#10b981, #10b981)"
                : "linear-gradient(var(--color-primary, var(--primary)), var(--color-primary, var(--primary)))",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 1px",
            backgroundPosition: "0 100%",
            paddingBottom: "1px",
            fontStyle: "italic",
            opacity: state === "already" ? 0.5 : 1,
          }}
        >
          {displayWord}
        </span>
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5 w-1.5 h-1.5 rounded-full transition-colors",
            state === "success" ? "bg-emerald-400" : "animate-pulse",
          )}
          style={
            state !== "success"
              ? {
                  background:
                    "color-mix(in srgb, var(--color-primary, var(--primary)) 50%, transparent)",
                }
              : {}
          }
        />
      </button>

      <AnimatePresence>
        {open && state !== "idle" && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[80] bg-black/5 backdrop-blur-[2px]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => {
                if (state !== "loading") setOpen(false);
              }}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed z-[81] left-1/2 -translate-x-1/2 top-1/3 w-72 rounded-2xl shadow-2xl overflow-hidden"
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              initial={{ opacity: 0, scale: 0.85, y: -8 }}
              style={{
                background: "var(--bg-menu, var(--background))",
                border:
                  "1px solid color-mix(in srgb, var(--color-primary, var(--primary)) 20%, transparent)",
                boxShadow: "0 24px 64px rgba(44,38,46,0.22)",
              }}
              transition={{ type: "spring", damping: 24, stiffness: 340 }}
            >
              <div
                className="h-1 w-full"
                style={{
                  background:
                    "linear-gradient(to right, transparent, var(--color-primary, var(--primary)), transparent)",
                  opacity: 0.5,
                }}
              />
              <div className="p-6 flex flex-col items-center text-center gap-4">
                {state === "loading" ? (
                  <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                    <Loader2
                      className="text-primary/40 animate-spin"
                      size={24}
                    />
                  </div>
                ) : (
                  <>
                    <MotionDiv
                      animate={{ scale: 1 }}
                      className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center border",
                        state === "success"
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-primary/5 border-primary/5",
                      )}
                      initial={{ scale: 0 }}
                      transition={{
                        type: "spring",
                        damping: 16,
                        stiffness: 300,
                        delay: 0.1,
                      }}
                    >
                      {state === "already" ? (
                        <Check className="text-primary/40" size={24} />
                      ) : (
                        <Icon className={messages[state].color} size={24} />
                      )}
                    </MotionDiv>
                    <div>
                      <p
                        className={cn(
                          "font-black uppercase text-micro tracking-widest",
                          messages[state].color,
                        )}
                      >
                        {messages[state].title}
                      </p>
                      {messages[state].sub && (
                        <p className="text-micro text-primary/40 mt-1 font-medium italic">
                          {messages[state].sub}
                        </p>
                      )}
                    </div>
                    {(state === "success" || state === "already") && (
                      <MotionDiv
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full"
                        initial={{ opacity: 0, y: 4 }}
                        transition={{ delay: 0.2 }}
                      >
                        <Icon className="text-primary/50" size={11} />
                        <span className="text-micro font-black text-primary/60 uppercase tracking-widest">
                          {entidadNombre}
                        </span>
                      </MotionDiv>
                    )}
                    <button
                      className="text-micro font-black uppercase tracking-widest text-primary/25 hover:text-primary/50 transition-colors mt-1"
                      onClick={() => setOpen(false)}
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChoiceButton
// ─────────────────────────────────────────────────────────────────────────────

export function ChoiceButton({
  label,
  onSelect,
}: {
  label: string;
  onSelect: () => void;
}) {
  return (
    <MotionButton
      className="inline-flex items-center justify-between gap-3 my-1 px-4 py-2.5 rounded-[var(--radius-btn)] border transition-all group"
      style={{
        background:
          "color-mix(in srgb, var(--color-primary, var(--primary)) 8%, transparent)",
        borderColor:
          "color-mix(in srgb, var(--color-primary, var(--primary)) 20%, transparent)",
        color: "var(--color-primary, var(--primary))",
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
    >
      <span className="font-sans font-medium text-xs">{label}</span>
      <ChevronR
        className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0"
        size={14}
      />
    </MotionButton>
  );
}

// Wrapper que pone los ChoiceButton lado a lado con wrapping
// Se usa desde RenderSegmentos agrupando choices consecutivos.
// Por ahora cada ChoiceButton se renderiza inline-flex y el flujo natural
// los agrupa en fila gracias al display inline-flex del botón.

// ─────────────────────────────────────────────────────────────────────────────
// UseWord
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bug 6 fix: ToastContainer y ConfirmModal se mueven fuera de UseWord.
 * Si hay varios UseWord en el capítulo se montaban N veces en el DOM
 * causando colisiones de z-index y toasts duplicados.
 * UseWordPortal se monta UNA sola vez en ContenidoInteractivo (o en el padre
 * que corresponda), igual que ToastPortal en leerLibro.tsx.
 */

type UseWordSharedContext = {
  toast: ReturnType<typeof useToast>["toast"];
  confirm: ReturnType<typeof useConfirm>["confirm"];
};

// Ref global para que UseWord pueda llamar a toast/confirm sin montar su propio portal
let _useWordCtx: UseWordSharedContext | null = null;

export function UseWordPortal() {
  const { toasts, toast, dismiss } = useToast();
  const { confirm, ConfirmModal } = useConfirm();

  useEffect(() => {
    _useWordCtx = { toast, confirm };
    return () => {
      _useWordCtx = null;
    };
  }, [toast, confirm]);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <ConfirmModal />
    </>
  );
}

export function UseWord({
  word,
  itemId: _itemId,
  targetSuccess,
  targetFail,
  onNavigate,
}: {
  word: string;
  itemId: string;
  targetSuccess: string;
  targetFail?: string;
  onNavigate: (capId: string) => void;
}) {
  const handleUse = async () => {
    if (!_useWordCtx) return;
    const { confirm, toast } = _useWordCtx;
    const ok = await confirm({
      title: "Usar objeto",
      message: `¿Quieres usar "${word}"?`,
      confirmLabel: "Usar",
    });
    if (ok) {
      onNavigate(targetSuccess);
    } else {
      if (targetFail) {
        onNavigate(targetFail);
      } else {
        toast.warning("No tienes el objeto necesario o decidiste no usarlo.");
      }
    }
  };

  return (
    <button
      className="relative inline font-serif cursor-pointer group text-amber-600 hover:text-amber-700 font-bold transition-colors"
      onClick={handleUse}
    >
      <span style={{ borderBottom: "2px dotted currentColor" }}>{word}</span>
    </button>
  );
}

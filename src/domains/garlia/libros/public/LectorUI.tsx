"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, RotateCcw, Type } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { CapituloScrollItem } from "@/domains/garlia/libros/capitulos/types";
import { useLectorAjustes } from "@/domains/garlia/libros/public/useLectorAjustes";


/* ─────────────────────────────────────────────
   Vignette — sombra perimetral tipo pergamino
   ───────────────────────────────────────────── */
export function Vignette() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[45]"
      style={{
        background: `radial-gradient(ellipse at center, transparent 50%, var(--bg-main) 100%)`,
        opacity: 0.55,
      }}
    />
  );
}


/* ─────────────────────────────────────────────
   Separador ornamentado al final de cada capítulo
   Las líneas "se dibujan" desde el centro hacia afuera
   cuando el elemento entra en viewport
   ───────────────────────────────────────────── */
export function FinCapituloSeparador({ cap, onVisible, ocultar = false }: {
  cap: CapituloScrollItem;
  onVisible: () => void;
  ocultar?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const onVisibleRef = useRef(onVisible);
  const [visible, setVisible] = useState(false);

  // Mantener ref actualizada sincrónicamente para que el observer llame siempre
  // a la versión más reciente sin recrear el observer.
  onVisibleRef.current = onVisible;

  // Reset si cambia el capítulo (el mismo componente puede reutilizarse en modo extra)
  const capIdRef = useRef(cap.id);
  if (capIdRef.current !== cap.id) {
    capIdRef.current = cap.id;
    firedRef.current = false;
    // No resetear `visible` aquí — está en render, se maneja en el efecto de abajo
  }

  useEffect(() => {
    // Resetear animación si el cap cambió (modo extra)
    setVisible(false);
    firedRef.current = false;
  }, [cap.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let observer: IntersectionObserver | null = null;

    const montar = () => {
      const scrollContainer = document.getElementById("lector-scroll-container");
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (!firedRef.current) {
              firedRef.current = true;
              onVisibleRef.current();
            }
          }
        },
        {
          root: scrollContainer ?? null,
          threshold: 0.1,
          rootMargin: "0px 0px -20px 0px",
        }
      );
      observer.observe(el);
    };

    // Si el container aún no está en el DOM, esperar un tick antes de montar
    if (document.getElementById("lector-scroll-container")) {
      montar();
    } else {
      const t = setTimeout(montar, 100);
      return () => { clearTimeout(t); observer?.disconnect(); };
    }

    return () => observer?.disconnect();
  }, [cap.id]); // se recrea si cambia el cap (modo extra)

  return (
    <div ref={ref} className="mt-20 mb-4 flex flex-col items-center gap-3" style={{ minHeight: "20px", visibility: ocultar ? "hidden" : undefined, height: ocultar ? 0 : undefined, marginTop: ocultar ? 0 : undefined, overflow: ocultar ? "hidden" : undefined }}>
      <div className="flex items-center gap-4 w-full max-w-xs">
        <motion.div
          animate={visible ? { scaleX: 1 } : { scaleX: 0 }}
          className="flex-1 h-px"
          initial={{ scaleX: 0, originX: 0 }}
          style={{ background: "linear-gradient(to right, transparent, color-mix(in srgb, var(--primary) 20%, transparent))" }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        />
        <motion.span
          animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          className="font-serif text-sm select-none"
          initial={{ opacity: 0, scale: 0.7 }}
          style={{ color: "color-mix(in srgb, var(--accent) 70%, transparent)" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.35 }}
        >
          ❧
        </motion.span>
        <motion.div
          animate={visible ? { scaleX: 1 } : { scaleX: 0 }}
          className="flex-1 h-px"
          initial={{ scaleX: 0, originX: 1 }}
          style={{ background: "linear-gradient(to left, transparent, color-mix(in srgb, var(--primary) 20%, transparent))" }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Ornamento de apertura de capítulo
   Contraparte de FinCapituloSeparador — no necesita IntersectionObserver
   porque siempre está en la parte superior del capítulo, ya visible al
   montar. Se anima una sola vez al aparecer (aparición del capítulo).
   ───────────────────────────────────────────── */
export function InicioCapituloSeparador() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mb-8 flex items-center justify-center gap-4 w-full max-w-[140px] mx-auto" aria-hidden>
      <motion.div
        animate={visible ? { scaleX: 1 } : { scaleX: 0 }}
        className="flex-1 h-px"
        initial={{ scaleX: 0, originX: 1 }}
        style={{ background: "linear-gradient(to left, transparent, color-mix(in srgb, var(--primary) 20%, transparent))" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.span
        animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
        className="font-serif text-sm select-none"
        initial={{ opacity: 0, scale: 0.7 }}
        style={{ color: "color-mix(in srgb, var(--accent) 70%, transparent)" }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
      >
        ❧
      </motion.span>
      <motion.div
        animate={visible ? { scaleX: 1 } : { scaleX: 0 }}
        className="flex-1 h-px"
        initial={{ scaleX: 0, originX: 0 }}
        style={{ background: "linear-gradient(to right, transparent, color-mix(in srgb, var(--primary) 20%, transparent))" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   AjustesLectura — control de tamaño de fuente persistente
   ───────────────────────────────────────────────────────────────────────────
   Popover chico con A- / A+ / reset. El valor se guarda en localStorage vía
   useLectorAjustes y se aplica como --lector-font-scale en el contenedor del
   lector (ver leerLibro.tsx), que CapituloScrollBlock multiplica sobre su
   clamp() fluido existente.
   ───────────────────────────────────────────── */
export function AjustesLectura({
  compact = false,
}: {
  /** Versión compacta (solo ícono) para la topbar mobile. */
  compact?: boolean;
}) {
  const {
    fontScale, incrementarFuente, decrementarFuente, resetFuente, minScale, maxScale,
    texturaPapel, toggleTexturaPapel,
  } = useLectorAjustes();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [abierto]);

  const pct = Math.round(
    ((fontScale - minScale) / (maxScale - minScale)) * 100,
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        aria-label="Ajustes de lectura"
        className="flex items-center gap-1.5 text-primary/40 hover:text-primary transition-colors font-black text-micro uppercase tracking-widest"
        onClick={() => setAbierto((v) => !v)}
      >
        <Type size={compact ? 13 : 14} />
        {!compact && "Aa"}
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute z-50 right-0 mt-2 rounded-xl border p-4"
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            style={{
              width: 220,
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
              boxShadow: "0 8px 30px color-mix(in srgb, var(--primary) 15%, transparent)",
            }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-micro font-black uppercase tracking-widest text-primary/50">
                Tamaño de texto
              </span>
              <button
                aria-label="Restablecer tamaño"
                className="text-primary/30 hover:text-primary transition-colors"
                onClick={resetFuente}
              >
                <RotateCcw size={12} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                aria-label="Reducir tamaño de texto"
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-primary/50 hover:text-primary transition-colors"
                disabled={fontScale <= minScale}
                style={{
                  background: "color-mix(in srgb, var(--primary) 6%, transparent)",
                  opacity: fontScale <= minScale ? 0.35 : 1,
                }}
                onClick={decrementarFuente}
              >
                <Minus size={13} />
              </button>

              <div
                className="flex-1 h-1.5 rounded-full relative"
                style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: "var(--accent, var(--primary))",
                  }}
                />
              </div>

              <button
                aria-label="Aumentar tamaño de texto"
                className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-primary/50 hover:text-primary transition-colors"
                disabled={fontScale >= maxScale}
                style={{
                  background: "color-mix(in srgb, var(--primary) 6%, transparent)",
                  opacity: fontScale >= maxScale ? 0.35 : 1,
                }}
                onClick={incrementarFuente}
              >
                <Plus size={13} />
              </button>
            </div>

            <div
              className="mt-4 pt-3 text-primary/70 italic"
              style={{
                borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                fontFamily: "var(--lector-font-family, ui-serif, Georgia, 'Times New Roman', serif)",
                fontSize: `calc(var(--lector-font-scale, 1) * 0.95rem)`,
              }}
            >
              Así se ve el texto.
            </div>

            <button
              aria-pressed={texturaPapel}
              className="flex items-center justify-between w-full mt-4 pt-3"
              style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
              onClick={toggleTexturaPapel}
            >
              <span className="text-micro font-black uppercase tracking-widest text-primary/50">
                Textura de papel
              </span>
              <span
                className="relative inline-flex items-center rounded-full transition-colors"
                style={{
                  width: 32,
                  height: 18,
                  background: texturaPapel
                    ? "var(--accent, var(--primary))"
                    : "color-mix(in srgb, var(--primary) 15%, transparent)",
                }}
              >
                <motion.span
                  animate={{ x: texturaPapel ? 15 : 2 }}
                  className="absolute rounded-full"
                  style={{ width: 14, height: 14, background: "var(--bg-main)" }}
                  transition={{ duration: 0.15 }}
                />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
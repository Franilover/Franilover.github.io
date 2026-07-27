"use client";
import { motion } from "framer-motion";
import React, { useEffect, useState, useRef } from "react";

import type { CapituloScrollItem } from "@/domains/garlia/libros/capitulos/types";


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
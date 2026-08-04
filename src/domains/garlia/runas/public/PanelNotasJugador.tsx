"use client";

/**
 * PanelNotasJugador.tsx
 * ────────────────────────────────────────────────────────────────────
 * Bloque lateral de /garlia/runas: notas en texto libre para que el
 * jugador anote lo que va descubriendo (qué runa es cuál, combinaciones
 * que sospecha, etc.). Sin backend — persistidas en localStorage, por
 * navegador/dispositivo, igual que "runas logradas" (ver
 * PanelRunasLogradas.tsx). Autoguardado con debounce corto mientras
 * escribe, sin botón de guardar.
 */

import { NotebookPen } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const CLAVE_NOTAS = "garlia_runas_notas_jugador";

export function PanelNotasJugador() {
  const [texto, setTexto] = useState("");
  const [cargado, setCargado] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga inicial desde localStorage — solo en cliente, después del
  // primer render, para evitar mismatch de SSR/hidratación.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_NOTAS);
      if (guardado !== null) setTexto(guardado);
    } catch {
      // localStorage puede fallar (modo privado, cuota, etc.) — sin
      // notas persistidas no es crítico, se sigue funcionando en memoria.
    }
    setCargado(true);
  }, []);

  const onChange = (nuevo: string) => {
    setTexto(nuevo);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(CLAVE_NOTAS, nuevo);
      } catch {
        // Ver comentario arriba.
      }
    }, 400);
  };

  return (
    <div className="w-full rounded-2xl border border-primary/15 bg-white-custom/60 p-3 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/40">
        <NotebookPen size={12} /> Mis notas
      </div>
      <textarea
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Anotá acá lo que vayas descubriendo…"
        disabled={!cargado}
        rows={8}
        className="w-full resize-y min-h-[140px] rounded-xl border border-primary/10 bg-white-custom p-2.5 text-sm text-primary placeholder:text-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      />
      <p className="text-micro text-primary/25 text-right">
        Se guarda solo en este dispositivo
      </p>
    </div>
  );
}

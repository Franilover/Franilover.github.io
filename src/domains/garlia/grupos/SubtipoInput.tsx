"use client";

/**
 * SubtipoInput.tsx
 * ───────────────────
 * Campo de texto con autocompletado de subtipos, combinando sugerencias
 * por defecto (según el tipo de grupo) con subtipos ya usados por el
 * usuario. Extraído de EditorGrupo.tsx.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/grupos/SubtipoInput.tsx
 */

import React, { useEffect, useMemo, useRef, useState } from "react";

import { GRUPO_TIPO_CONFIG, type GrupoTipo } from "@/domains/garlia/grupos/useGrupos";

export function SubtipoInput({
  value,
  onChange,
  tipo,
  sugerencias,
}: {
  value: string;
  onChange: (v: string) => void;
  tipo: GrupoTipo;
  sugerencias: string[]; // ya filtradas para este tipo
}) {
  const cfg = GRUPO_TIPO_CONFIG[tipo];
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Merge default suggestions with user-created ones, deduplicated
  const allSugerencias = useMemo(() => {
    const defaults = cfg.sugerenciasDefault;
    const custom = sugerencias.filter(
      (s) => !defaults.some((d) => d.toLowerCase() === s.toLowerCase()),
    );
    return [...custom, ...defaults];
  }, [cfg.sugerenciasDefault, sugerencias]);

  const filtered = useMemo(() => {
    const q = value.toLowerCase().trim();
    if (!q) return allSugerencias;
    return allSugerencias.filter((s) => s.toLowerCase().includes(q));
  }, [allSugerencias, value]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Igual que en SelectorMiembros: decide hacia dónde abrir según espacio
  // disponible en viewport (lista max-h-44 + header + bordes).
  useEffect(() => {
    if (!open || !inputRef.current) return;
    const DROPDOWN_ESTIMATE_PX = 220;
    const rect = inputRef.current.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - rect.bottom;
    const espacioArriba = rect.top;
    setDropUp(
      espacioAbajo < DROPDOWN_ESTIMATE_PX && espacioArriba > espacioAbajo,
    );
  }, [open]);

  const select = (s: string) => {
    onChange(s);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={ref} className="relative">
      <input
        ref={inputRef}
        className="w-full bg-primary/[0.03] border border-primary/10 rounded-lg px-2.5 py-1 text-micro text-primary outline-none focus:border-primary/25 placeholder:text-primary/25 transition-colors"
        placeholder={cfg.ejemplo}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-50 left-0 right-0 rounded-xl border shadow-xl overflow-hidden ${
              dropUp ? "bottom-full mb-1" : "top-full mt-1"
            }`}
            style={{
              background: "var(--bg-main)",
              borderColor:
                "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            {/* Header de la lista */}
            <div
              className="px-3 py-1.5 border-b flex items-center gap-1.5"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
                background:
                  "color-mix(in srgb, var(--primary) 3%, transparent)",
              }}
            >
              <cfg.Icon
                size={8}
                style={{
                  color: `color-mix(in srgb, ${cfg.color} 55%, transparent)`,
                }}
              />
              <span
                className="text-micro font-black uppercase tracking-[0.25em]"
                style={{
                  color: `color-mix(in srgb, ${cfg.color} 45%, transparent)`,
                }}
              >
                Tipos de {cfg.labelPlural.toLowerCase()}
              </span>
            </div>
            <div className="max-h-44 overflow-y-auto p-1">
              {filtered.map((s) => {
                const isCustom =
                  sugerencias.some(
                    (c) => c.toLowerCase() === s.toLowerCase(),
                  ) &&
                  !cfg.sugerenciasDefault.some(
                    (d) => d.toLowerCase() === s.toLowerCase(),
                  );
                return (
                  <button
                    key={s}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg text-left transition-colors hover:bg-primary/6"
                    type="button"
                    onMouseDown={() => select(s)}
                  >
                    <span className="text-micro font-black uppercase tracking-wide text-primary/65">
                      {s}
                    </span>
                    {isCustom && (
                      <span
                        className="text-micro font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                        style={{
                          background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
                          color: `color-mix(in srgb, ${cfg.color} 60%, transparent)`,
                        }}
                      >
                        usado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

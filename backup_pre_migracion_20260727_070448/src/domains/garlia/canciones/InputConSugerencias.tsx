"use client";

import { X, Check, Plus } from "lucide-react";
import React, { useState, useEffect, useRef, useMemo } from "react";

import { useValoresUnicos } from "@/domains/garlia/canciones/useValoresUnicos";

export const InputConSugerencias = ({
  label, value, onChange, placeholder, tabla, columna,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tabla: string;
  columna: string;
}) => {
  const sugerencias = useValoresUnicos(tabla, columna);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtradas = useMemo(
    () => sugerencias.filter(s => s.toLowerCase().includes(value.toLowerCase().trim())),
    [sugerencias, value]
  );

  const esNuevo = value.trim() && !sugerencias.includes(value.trim());

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="space-y-1.5">
      <label className="text-micro font-black uppercase text-primary/30 tracking-widest">{label}</label>
      <div className="relative">
        <input
          className="w-full bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5 text-sm font-medium text-primary outline-none focus:border-primary/40 transition-colors placeholder:text-primary/20"
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/20 hover:text-primary/60 transition-colors"
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
          >
            <X size={13} />
          </button>
        )}

        {open && (filtradas.length > 0 || esNuevo) && (
          <div
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-primary/15 shadow-xl overflow-hidden max-h-48 overflow-y-auto"
            style={{ background: "var(--white-custom)" }}
          >
            {filtradas.map(s => (
              <button
                key={s}
                className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-primary/8 transition-colors flex items-center justify-between ${
                  value === s ? "text-primary" : "text-primary/70"
                }`}
                type="button"
                onClick={() => { onChange(s); setOpen(false); }}
              >
                <span>{s}</span>
                {value === s && <Check className="text-primary shrink-0" size={11} />}
              </button>
            ))}
            {esNuevo && (
              <>
                {filtradas.length > 0 && <div className="h-px bg-primary/8 mx-3" />}
                <button
                  className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-primary/8 transition-colors flex items-center gap-2 text-primary/50"
                  type="button"
                  onClick={() => { onChange(value.trim()); setOpen(false); }}
                >
                  <Plus size={11} /> Usar «{value.trim()}»
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

"use client";

/**
 * PersonajeImagePickers.tsx
 * ───────────────────────────
 * Botones de selección de imagen específicos del editor de personajes
 * (cara y cuerpo). Componentes puros que reciben value/onChange por
 * props — no conocen de dónde viene el personaje.
 *
 * Ruta: src/features/editorGarlia/components/personajes/PersonajeImagePickers.tsx
 */

import { Camera, X } from "lucide-react";
import { useState } from "react";

import SimpleImagePicker from "@/ui/SimpleImagePicker";

// ─── Picker genérico (modal con título + icono configurable) ─────────────────

export function PickerImagen({
  onChange,
  titulo,
  icon,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  titulo: string;
  icon: React.ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white-custom rounded-2xl shadow-2xl border border-primary/15 w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
                {icon} {titulo}
              </h3>
              <button
                className="text-primary/30 hover:text-primary transition-colors"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <SimpleImagePicker
              onClose={() => setOpen(false)}
              onSelect={(url) => {
                onChange(url);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/15 text-micro font-black uppercase tracking-widest text-primary/50 hover:text-primary hover:border-primary/30 transition-all"
        onClick={() => setOpen(true)}
      >
        {icon} {label}
      </button>
    </>
  );
}

// ─── Botón circular flotante para la cara (mobile) ────────────────────────────

export function PickerCaraBtn({
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white-custom rounded-2xl shadow-2xl border border-primary/15 w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
                <Camera size={11} /> Imagen de perfil
              </h3>
              <button
                className="text-primary/30 hover:text-primary transition-colors"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <SimpleImagePicker
              onClose={() => setOpen(false)}
              onSelect={(url) => {
                onChange(url);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
      <button
        className="flex items-center justify-center w-8 h-8 rounded-full bg-bg-main/80 backdrop-blur-sm border border-primary/20 text-primary/50 hover:text-primary hover:bg-bg-main transition-all shadow-md"
        title="Cambiar imagen"
        onClick={() => setOpen(true)}
      >
        <Camera size={13} />
      </button>
    </>
  );
}

"use client";

/**
 * PickerImagenRunaBtn.tsx
 * ─────────────────────────
 * Botón mobile para cambiar la imagen de un hechizo/don/runa.
 * Solo recibe value/onChange por props.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/PickerImagenRunaBtn.tsx
 */

import { Camera, X } from "lucide-react";
import React, { useState } from "react";

import SimpleImagePicker from "@/components/ui/SimpleImagePicker";

export function PickerImagenRunaBtn({
  value: _value,
  onChange,
  color: _color,
  Icon,
}: {
  value: string;
  onChange: (url: string) => void;
  color: string;
  Icon: React.ElementType;
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
                <Camera size={11} /> Imagen de la runa
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

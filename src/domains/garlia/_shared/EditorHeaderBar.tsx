"use client";

/**
 * EditorHeaderBar
 * ───────────────────────────────────────────────────────────────────────────
 * Barra superior compartida por todos los editores de entidad (Item,
 * Personaje, Criatura, Reino, Flora, Mineral). Antes cada editor tenía su
 * propia copia casi idéntica de este bloque; ahora viven en un solo lugar
 * y se alimentan de EditorHeaderControls.
 *
 * Se usa en dos contextos:
 *  1. Dentro de PanelFlotanteGlobal, que la renderiza UNA vez en su propia
 *     barra usando los controles publicados por el editor activo (evita la
 *     barra duplicada de la vista rápida).
 *  2. En cualquier lugar donde el editor se use a pantalla completa (fuera
 *     del panel flotante), donde sigue haciendo falta la barra — se monta
 *     igual, con los mismos controles.
 */

import { Save, Trash2 } from "lucide-react";

import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";

import { type EditorHeaderControls } from "./useEditorHeaderControls";

export function EditorHeaderBar({ controls }: { controls: EditorHeaderControls }) {
  const {
    imagenUrl,
    IconoFallback,
    prefix,
    nombre,
    placeholderNombre,
    onChangeNombre,
    onBlurNombre,
    status,
    onGuardar,
    onEliminar,
    extra,
  } = controls;

  return (
    <div
      className="shrink-0 flex items-center gap-2 px-3 py-2 border-b"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        background: "color-mix(in srgb, var(--primary) 3%, transparent)",
      }}
    >
      {prefix}

      {(imagenUrl || IconoFallback) && (
        <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-primary/15 bg-primary/5 flex items-center justify-center">
          {imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={nombre} className="w-full h-full object-cover" src={imagenUrl} />
          ) : IconoFallback ? (
            <IconoFallback className="text-primary/25" size={16} />
          ) : null}
        </div>
      )}

      <input
        className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
        placeholder={placeholderNombre}
        value={nombre ?? ""}
        onChange={(e) => onChangeNombre(e.target.value)}
        onBlur={onBlurNombre}
      />

      {extra}

      <div className="shrink-0 flex items-center gap-1.5">
        <SaveIndicator status={status} />
        <button
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
          type="button"
          onClick={onEliminar}
        >
          <Trash2 size={10} />
        </button>
        <button
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          disabled={status === "saving"}
          type="button"
          onClick={onGuardar}
        >
          <Save size={10} /> Guardar
        </button>
      </div>
    </div>
  );
}

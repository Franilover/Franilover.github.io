"use client";

/**
 * PanelTiposMoneda
 * ───────────────────────────────────────────────────────────────────────────
 * Panel de admin para definir las monedas propias de tu mundo (nombre +
 * símbolo), en vez de forzar oro/plata/electro/cobre genéricos. La lista es
 * global — fichas_dnd no está separada por reino — y ordenable con las
 * flechas, las fichas referencian estos tipos por id (fichas_dnd.monedas).
 *
 * Uso: envolver con <AdminOnly>.
 *   <AdminOnly><PanelTiposMoneda /></AdminOnly>
 */

import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useTiposMoneda } from "../hooks/useFichasDnd";

export function PanelTiposMoneda() {
  const { tipos, loading, crear, renombrar, eliminar } = useTiposMoneda();
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [simboloNuevo, setSimboloNuevo] = useState("");
  const [creando, setCreando] = useState(false);

  const inputClase =
    "h-9 px-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-sm text-primary/80 placeholder:text-primary/30 focus:border-primary/30 transition-colors";

  const agregar = async () => {
    if (!nombreNuevo.trim()) return;
    setCreando(true);
    try {
      await crear({ nombre: nombreNuevo.trim(), simbolo: simboloNuevo.trim() || null });
      setNombreNuevo("");
      setSimboloNuevo("");
    } finally {
      setCreando(false);
    }
  };

  const mover = async (id: string, direccion: -1 | 1) => {
    const idx = tipos.findIndex((t) => t.id === id);
    const otro = tipos[idx + direccion];
    if (!otro) return;
    // Intercambia el orden de los dos tipos vecinos.
    await Promise.all([
      renombrar(id, { orden: otro.orden }),
      renombrar(otro.id, { orden: tipos[idx].orden }),
    ]);
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div>
        <h3 className="font-serif italic text-lg text-primary mb-1">Monedas del mundo</h3>
        <p className="text-xs text-primary/40">
          Define las monedas propias de tu mundo. Cada personaje llevará su cantidad de cada
          una en su ficha.
        </p>
      </div>

      {loading ? (
        <Loader2 size={16} className="animate-spin text-primary/30" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {tipos.length === 0 && (
            <p className="text-xs text-primary/30 italic">
              Todavía no definiste ninguna moneda para este mundo.
            </p>
          )}
          {tipos.map((tipo, i) => (
            <div
              key={tipo.id}
              className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/10 bg-primary/[0.02]"
            >
              <div className="flex flex-col shrink-0 text-primary/25">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => mover(tipo.id, -1)}
                  className="disabled:opacity-20 hover:text-primary/60 transition-colors"
                  title="Subir"
                >
                  <GripVertical size={12} />
                </button>
              </div>
              <input
                type="text"
                defaultValue={tipo.nombre}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== tipo.nombre) renombrar(tipo.id, { nombre: v });
                }}
                className={`flex-1 min-w-0 ${inputClase}`}
                placeholder="Nombre (ej. Corona de oro)"
              />
              <input
                type="text"
                defaultValue={tipo.simbolo ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (tipo.simbolo ?? "")) renombrar(tipo.id, { simbolo: v || null });
                }}
                className={`w-20 shrink-0 text-center ${inputClase}`}
                placeholder="Símbolo"
              />
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar "${tipo.nombre}"? Las fichas que ya tengan cantidad guardada la conservarán, pero dejará de mostrarse.`)) {
                    eliminar(tipo.id);
                  }
                }}
                className="shrink-0 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 text-primary/30 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-primary/10">
        <input
          type="text"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre de la nueva moneda"
          className={`flex-1 min-w-0 ${inputClase}`}
        />
        <input
          type="text"
          value={simboloNuevo}
          onChange={(e) => setSimboloNuevo(e.target.value)}
          placeholder="Símbolo"
          className={`w-20 shrink-0 text-center ${inputClase}`}
        />
        <button
          type="button"
          disabled={!nombreNuevo.trim() || creando}
          onClick={agregar}
          className="shrink-0 h-9 px-3 flex items-center gap-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-40 transition-opacity"
        >
          {creando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Agregar
        </button>
      </div>
    </div>
  );
}

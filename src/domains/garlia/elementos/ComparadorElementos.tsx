"use client";

/**
 * ComparadorElementos.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Modal para comparar 2-3 elementos lado a lado: sus 3 capas (núcleo/media/
 * externa) en columnas alineadas, más la afinidad entre cada par — mismo
 * cálculo que calcularAfinidadElementos (afinidad.ts), para ayudar a elegir
 * qué elementos combinar antes de armar un compuesto.
 */

import { GitCompare, X } from "lucide-react";
import { useMemo, useState } from "react";

import { calcularAfinidadElementos, calcularParticulaDominante } from "./afinidad";
import {
  AFINIDAD_LABEL,
  formatLayer,
  LAYER_LABEL,
  type Elemento,
  type LayerName,
  type TipoAfinidad,
} from "./types";

const LAYERS: LayerName[] = ["nucleo", "media", "externa"];

const AFINIDAD_COLOR: Record<TipoAfinidad, string> = {
  complementa: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  compite: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  saturado: "text-primary/40 bg-primary/5 border-primary/10",
  estable: "text-primary/30 bg-primary/[0.02] border-primary/10",
};

export function ComparadorElementosModal({
  elementos,
  onCerrar,
}: {
  elementos: Elemento[];
  onCerrar: () => void;
}) {
  const [ids, setIds] = useState<string[]>(
    elementos.slice(0, 2).map((e) => e.id),
  );

  const seleccionados = ids
    .map((id) => elementos.find((e) => e.id === id))
    .filter((e): e is Elemento => !!e);

  function setSlot(index: number, id: string) {
    setIds((prev) => {
      const next = [...prev];
      next[index] = id;
      return next;
    });
  }

  function agregarSlot() {
    if (ids.length >= 3) return;
    const disponible = elementos.find((e) => !ids.includes(e.id));
    if (disponible) setIds((prev) => [...prev, disponible.id]);
  }

  function quitarSlot(index: number) {
    setIds((prev) => prev.filter((_, i) => i !== index));
  }

  // Pares únicos entre los seleccionados, con su afinidad.
  const pares = useMemo(() => {
    const resultado: { a: Elemento; b: Elemento; afinidad: ReturnType<typeof calcularAfinidadElementos> }[] = [];
    for (let i = 0; i < seleccionados.length; i++) {
      for (let j = i + 1; j < seleccionados.length; j++) {
        resultado.push({
          a: seleccionados[i],
          b: seleccionados[j],
          afinidad: calcularAfinidadElementos(seleccionados[i], seleccionados[j]),
        });
      }
    }
    return resultado;
  }, [seleccionados]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm" onClick={onCerrar} />
      <div
        className="relative z-10 flex flex-col w-full max-w-2xl max-h-[calc(100vh-2rem)] rounded-[var(--radius-card)] border shadow-2xl overflow-hidden"
        style={{
          background: "var(--white-custom, var(--bg-main))",
          borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
      >
        <div
          style={{ background: "var(--bg-main)" }}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
        >
          <GitCompare size={12} className="text-primary/40" />
          <p className="flex-1 min-w-0 text-micro font-black uppercase tracking-widest text-primary/70">
            Comparar elementos
          </p>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto">
          {elementos.length < 2 ? (
            <p className="text-micro text-primary/25 text-center py-4">
              Necesitás al menos 2 elementos cargados para comparar.
            </p>
          ) : (
            <>
              {/* Selectores por columna */}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))` }}
              >
                {ids.map((id, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <select
                      value={id}
                      onChange={(e) => setSlot(i, e.target.value)}
                      className="flex-1 min-w-0 bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
                    >
                      {elementos.map((el) => (
                        <option key={el.id} value={el.id}>
                          {el.simbolo || "??"} · {el.nombre}
                        </option>
                      ))}
                    </select>
                    {ids.length > 2 && (
                      <button
                        type="button"
                        onClick={() => quitarSlot(i)}
                        title="Quitar de la comparación"
                        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
                {ids.length < 3 && (
                  <button
                    type="button"
                    onClick={agregarSlot}
                    className="flex items-center justify-center px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/40 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
                  >
                    + Elemento
                  </button>
                )}
              </div>

              {/* Capas lado a lado */}
              <div className="rounded-lg border border-primary/10 overflow-hidden">
                {LAYERS.map((layer, i) => (
                  <div
                    key={layer}
                    className={`grid gap-2 px-2 py-1.5 bg-primary/[0.02] ${
                      i > 0 ? "border-t border-primary/10" : ""
                    }`}
                    style={{ gridTemplateColumns: `56px repeat(${seleccionados.length}, minmax(0, 1fr))` }}
                  >
                    <span className="text-micro font-bold text-primary/60 self-center">
                      {LAYER_LABEL[layer]}
                    </span>
                    {seleccionados.map((el) => (
                      <span
                        key={el.id}
                        className="text-micro text-primary/50 truncate self-center"
                      >
                        {formatLayer(el[layer])}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              {/* Partícula dominante por columna */}
              <div
                className="grid gap-2 px-1"
                style={{ gridTemplateColumns: `repeat(${seleccionados.length}, minmax(0, 1fr))` }}
              >
                {seleccionados.map((el) => {
                  const dominantes = calcularParticulaDominante(el);
                  return (
                    <span
                      key={el.id}
                      className="text-micro font-bold text-accent/70 bg-accent/10 rounded px-1.5 py-0.5 truncate text-center"
                    >
                      {dominantes.length > 0
                        ? dominantes.map((d) => d.particula).join(" / ")
                        : "—"}
                    </span>
                  );
                })}
              </div>

              {/* Afinidad entre cada par */}
              {pares.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
                    Afinidad entre pares
                  </p>
                  {pares.map(({ a, b, afinidad }) => (
                    <div
                      key={`${a.id}-${b.id}`}
                      className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md border ${AFINIDAD_COLOR[afinidad.tipo]}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-micro font-black truncate">
                          {a.simbolo || "??"} + {b.simbolo || "??"}
                        </span>
                        <span className="shrink-0 text-micro font-black uppercase tracking-wide">
                          {AFINIDAD_LABEL[afinidad.tipo]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

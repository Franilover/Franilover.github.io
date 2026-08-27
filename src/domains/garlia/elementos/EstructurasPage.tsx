"use client";

import { Box, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { useEstructuras } from "./useEstructuras";
import { useEstructuraComposicion } from "./useEstructuraComposicion";
import type { Estructura } from "./types";

const text = (value: unknown, fallback = ""): string => value == null ? fallback : String(value);

function Editor({ estructura, onClose }: { estructura: Estructura; onClose: () => void }) {
  const { items, loading } = useEstructuraComposicion(estructura.id);
  const row = estructura as unknown as Record<string, unknown>;
  const props = (row.propiedades_calculadas ?? {}) as Record<string, unknown>;
  const descripcion = text(row.descripcion);
  const estadoCalculo = text(row.estado_calculo, "calculada");
  const propiedades = ["masa", "rigidez", "estabilidad", "flexibilidad", "dureza", "conductividad"]
    .filter((key) => props[key] !== undefined && props[key] !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/15 bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Box className="h-5 w-5 shrink-0 text-primary/50" /><h2 className="truncate text-lg font-bold">{estructura.nombre}</h2></div>
            <p className="mt-1 text-xs text-primary/40">Estructura · {estadoCalculo}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-primary/50 hover:bg-primary/10 hover:text-primary"><X className="h-4 w-4" /></button>
        </div>
        {descripcion && <p className="mb-4 text-sm leading-relaxed text-primary/55">{descripcion}</p>}
        <div className="space-y-3">
          <section className="rounded-xl border border-primary/10 p-3">
            <p className="mb-2 text-micro font-black uppercase tracking-widest text-primary/40">Propiedades</p>
            {propiedades.length ? propiedades.map((key) => <div key={key} className="flex justify-between border-b border-primary/10 py-1.5 text-xs last:border-0"><span className="capitalize text-primary/50">{key.replaceAll("_", " ")}</span><span>{typeof props[key] === "number" ? Number(props[key]).toFixed(3) : text(props[key])}</span></div>) : <p className="text-xs text-primary/40">Sin propiedades calculadas.</p>}
          </section>
          <section className="rounded-xl border border-primary/10 p-3">
            <p className="mb-2 text-micro font-black uppercase tracking-widest text-primary/40">Compuestos</p>
            {loading ? <p className="text-xs text-primary/40">Cargando…</p> : items.length ? items.map((item) => <div key={item.vinculo_id} className="flex items-center justify-between gap-3 border-b border-primary/10 py-2 text-xs last:border-0"><span>{item.compuesto.nombre}</span><span className="text-primary/40">{item.rol ?? ""}{item.proporcion != null ? ` · ${item.proporcion}` : ""}</span></div>) : <p className="text-xs text-primary/40">Sin compuestos asociados.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function EstructurasPage() {
  const { items, loading } = useEstructuras();
  const [selected, setSelected] = useState<Estructura | null>(null);
  return (
    <div className="px-3 pb-4 pt-2">
      {loading ? <p className="py-5 text-center text-micro text-primary/35">Cargando…</p> : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((estructura) => <button key={estructura.id} type="button" onClick={() => setSelected(estructura)} title={estructura.nombre} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/15 px-2.5 py-1 text-micro font-bold tracking-wide text-primary/70 transition-colors hover:border-primary/30 hover:bg-primary/10"><span className="truncate">{estructura.nombre}</span><ChevronRight className="h-3 w-3 shrink-0 opacity-35" /></button>)}
        </div>
      )}
      {selected && <Editor estructura={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

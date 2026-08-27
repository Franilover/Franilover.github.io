"use client";

import { Box, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
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
  const propiedades = ["masa", "rigidez", "estabilidad", "flexibilidad", "dureza", "conductividad"].filter((key) => props[key] !== undefined && props[key] !== null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previous; };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6" style={{ background: "color-mix(in srgb, var(--primary) 35%, transparent)", backdropFilter: "blur(8px)" }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: "var(--bg-main)", border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)", animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)" }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)", background: "color-mix(in srgb, var(--primary) 3%, transparent)" }}>
          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)" }}><Box className="text-primary/50" size={12} /></div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-primary">{estructura.nombre}</p><p className="text-micro text-primary/35">Estructura · {estadoCalculo}</p></div>
          <button type="button" onClick={onClose} title="Cerrar (Esc)" className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {descripcion && <p className="mb-5 max-w-4xl text-sm leading-relaxed text-primary/55">{descripcion}</p>}
          <div className="space-y-3 max-w-4xl">
            <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4"><p className="mb-3 text-micro font-black uppercase tracking-widest text-primary/40">Propiedades</p>{propiedades.length ? propiedades.map((key) => <div key={key} className="flex justify-between border-b border-primary/10 py-2 text-xs last:border-0"><span className="capitalize text-primary/50">{key.replaceAll("_", " ")}</span><span>{typeof props[key] === "number" ? Number(props[key]).toFixed(3) : text(props[key])}</span></div>) : <p className="text-xs text-primary/40">Sin propiedades calculadas.</p>}</section>
            <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4"><p className="mb-3 text-micro font-black uppercase tracking-widest text-primary/40">Compuestos</p>{loading ? <p className="text-xs text-primary/40">Cargando…</p> : items.length ? items.map((item) => <div key={item.vinculo_id} className="flex items-center justify-between gap-3 border-b border-primary/10 py-2 text-xs last:border-0"><span>{item.compuesto.nombre}</span><span className="text-primary/40">{item.rol ?? ""}{item.proporcion != null ? ` · ${item.proporcion}` : ""}</span></div>) : <p className="text-xs text-primary/40">Sin compuestos asociados.</p>}</section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function EstructurasPage() {
  const { items, loading } = useEstructuras();
  const [selected, setSelected] = useState<Estructura | null>(null);
  return <div className="px-3 pb-4 pt-2">{loading ? <p className="py-5 text-center text-micro text-primary/35">Cargando…</p> : <div className="flex flex-wrap gap-1.5">{items.map((estructura) => <button key={estructura.id} type="button" onClick={() => setSelected(estructura)} title={estructura.nombre} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/15 px-2.5 py-1 text-micro font-bold tracking-wide text-primary/70 transition-colors hover:border-primary/30 hover:bg-primary/10"><span className="truncate">{estructura.nombre}</span><ChevronRight className="h-3 w-3 shrink-0 opacity-35" /></button>)}</div>}{selected && <Editor estructura={selected} onClose={() => setSelected(null)} />}</div>;
}

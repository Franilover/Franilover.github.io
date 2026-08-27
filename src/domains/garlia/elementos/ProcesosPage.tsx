"use client";

import { Activity, X } from "lucide-react";
import { useState } from "react";
import { useProcesos } from "./useProcesos";

type Item = Record<string, unknown> & { id: string };
const label = (item: Item) => String(item.nombre ?? item.titulo ?? item.tipo ?? "Proceso");

export default function ProcesosPage() {
  const { items, loading } = useProcesos();
  const [selected, setSelected] = useState<Item | null>(null);
  return <div className="px-3 pb-4 pt-2">
    {loading ? <p className="py-5 text-center text-micro text-primary/35">Cargando…</p> : <div className="flex flex-wrap gap-1.5">{(items as unknown as Item[]).map((item) => <button key={item.id} type="button" onClick={() => setSelected(item)} title={label(item)} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/15 px-2.5 py-1 text-micro font-bold tracking-wide text-primary/70 transition-colors hover:border-primary/30 hover:bg-primary/10"><Activity className="h-3 w-3 shrink-0 opacity-45"/><span className="truncate">{label(item)}</span></button>)}</div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm" onMouseDown={() => setSelected(null)}><div className="w-full max-w-lg rounded-2xl border border-primary/15 bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-micro font-black uppercase tracking-widest text-primary/40">Proceso</p><h2 className="mt-1 text-lg font-bold">{label(selected)}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-full p-2 hover:bg-primary/10"><X className="h-4 w-4"/></button></div><div className="mt-4 rounded-xl border border-primary/10 bg-primary/[0.02] p-3"><p className="mb-2 text-micro font-black uppercase tracking-widest text-primary/40">Datos</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-primary/60">{JSON.stringify(selected, null, 2)}</pre></div></div></div>}
  </div>;
}

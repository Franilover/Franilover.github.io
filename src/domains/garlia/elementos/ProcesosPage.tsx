"use client";

import { Activity, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useProcesos } from "./useProcesos";

type Item = Record<string, unknown> & { id: string };
const label = (item: Item) => String(item.nombre ?? item.titulo ?? item.tipo ?? "Proceso");
const json = (value: unknown) => JSON.stringify(value, null, 2);

function Editor({ item, onClose }: { item: Item; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previous; };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6" style={{ background: "color-mix(in srgb, var(--primary) 35%, transparent)", backdropFilter: "blur(8px)" }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: "var(--bg-main)", border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)", animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)" }} onMouseDown={(event) => event.stopPropagation()}><div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)", background: "color-mix(in srgb, var(--primary) 3%, transparent)" }}><div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)" }}><Activity className="text-primary/50" size={12} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-primary">{label(item)}</p><p className="text-micro text-primary/35">Proceso</p></div><button type="button" onClick={onClose} title="Cerrar (Esc)" className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"><X size={16} /></button></div><div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6"><section className="max-w-4xl rounded-xl border border-primary/10 bg-primary/[0.02] p-4"><p className="mb-3 text-micro font-black uppercase tracking-widest text-primary/40">Datos</p><pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-primary/60">{json(item)}</pre></section></div></div></div>, document.body);
}

export default function ProcesosPage() {
  const { items, loading } = useProcesos();
  const [selected, setSelected] = useState<Item | null>(null);
  return <div className="px-3 pb-4 pt-2">{loading ? <p className="py-5 text-center text-micro text-primary/35">Cargando…</p> : <div className="flex flex-wrap gap-1.5">{(items as unknown as Item[]).map((item) => <button key={item.id} type="button" onClick={() => setSelected(item)} title={label(item)} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/15 px-2.5 py-1 text-micro font-bold tracking-wide text-primary/70 transition-colors hover:border-primary/30 hover:bg-primary/10"><Activity className="h-3 w-3 shrink-0 opacity-45"/><span className="truncate">{label(item)}</span></button>)}</div>}{selected && <Editor item={selected} onClose={() => setSelected(null)} />}</div>;
}

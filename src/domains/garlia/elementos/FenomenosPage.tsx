"use client";

import { Sparkles, Loader2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { useElementos } from "./useElementos";
import { useFenomenos } from "./useFenomenos";
import { useFenomenoElementos } from "./useFenomenoElementos";
import { useFenomenoProcesos } from "./useFenomenoProcesos";
import { useProcesos } from "./useProcesos";
import type { Fenomeno } from "./types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  return String(value);
}

function FenomenoDetail({ fenomeno }: { fenomeno: Fenomeno }) {
  const { items: relacionesProcesos, loading: loadingProcesos } = useFenomenoProcesos(fenomeno.id);
  const { items: procesos } = useProcesos();
  const { items: relacionesElementos, loading: loadingElementos } = useFenomenoElementos(fenomeno.id);
  const { items: elementos } = useElementos();

  return (
    <div className="flex flex-col gap-3">
      {fenomeno.simbolo && (
        <header className="flex items-start gap-2">
          <span className="rounded px-1.5 py-0.5 bg-primary/5 text-micro font-bold text-primary/40">
            {fenomeno.simbolo}
          </span>
        </header>
      )}

      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="flex flex-col gap-1.5 min-w-0 p-2">
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Procesos
          </span>
          <p className="text-micro text-primary/35 -mt-1">Procesos que intervienen en este fenómeno</p>
          {loadingProcesos ? (
            <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
              <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
            </div>
          ) : relacionesProcesos.length === 0 ? (
            <p className="py-1 text-micro text-primary/30">Sin procesos asociados.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {relacionesProcesos.map((relacion) => {
                const proceso = procesos.find((item) => item.id === relacion.proceso_id);
                return (
                  <div
                    key={relacion.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-primary/10 px-2 py-1"
                  >
                    <span className="text-micro font-bold text-primary/70 truncate">
                      {proceso?.nombre ?? relacion.proceso_id.slice(0, 8)}
                    </span>
                    {relacion.rol && <span className="text-micro text-primary/45 shrink-0">{relacion.rol}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 min-w-0 p-2">
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Elementos
          </span>
          <p className="text-micro text-primary/35 -mt-1">Elementos involucrados en este fenómeno</p>
          {loadingElementos ? (
            <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
              <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
            </div>
          ) : relacionesElementos.length === 0 ? (
            <p className="py-1 text-micro text-primary/30">Sin elementos asociados.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {relacionesElementos.map((relacion) => {
                const elemento = elementos.find((item) => item.id === relacion.elemento_id);
                return (
                  <div key={relacion.id} className="rounded-md border border-primary/10 px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-micro font-bold text-primary/70 truncate">
                        {elemento?.nombre ?? relacion.elemento_id.slice(0, 8)}
                      </span>
                      <span className="text-micro text-primary/45 shrink-0">× {formatValue(relacion.cantidad)}</span>
                    </div>
                    {relacion.rol && <div className="mt-0.5 text-micro text-primary/35">{relacion.rol}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {fenomeno.notas && (
        <div className="flex flex-col gap-1.5 min-w-0 p-2">
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Notas
          </span>
          <p className="whitespace-pre-wrap text-micro leading-relaxed text-primary/50">{fenomeno.notas}</p>
        </div>
      )}
    </div>
  );
}

function Editor({ fenomeno, onClose }: { fenomeno: Fenomeno; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "color-mix(in srgb, var(--primary) 35%, transparent)", backdropFilter: "blur(8px)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            }}
          >
            <Sparkles className="text-primary/50" size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-primary">{fenomeno.nombre}</p>
            <p className="text-micro text-primary/35">Fenómeno · solo lectura</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          <FenomenoDetail fenomeno={fenomeno} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function FenomenosPage() {
  const { items, loading } = useFenomenos();
  const [selected, setSelected] = useState<Fenomeno | null>(null);

  return (
    <div className="px-3 pb-4 pt-2">
      {loading ? (
        <p className="py-5 text-center text-micro text-primary/35">Cargando…</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              title={item.nombre}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/15 px-2.5 py-1 text-micro font-bold tracking-wide text-primary/70 transition-colors hover:border-primary/30 hover:bg-primary/10"
            >
              <Sparkles className="h-3 w-3 shrink-0 opacity-45" />
              <span className="truncate">{item.nombre}</span>
            </button>
          ))}
        </div>
      )}
      {selected && <Editor fenomeno={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

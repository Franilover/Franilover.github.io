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
    <div className="space-y-4">
      <header className="border-b border-primary/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-primary/15 bg-primary/5 p-2">
            <Sparkles className="h-5 w-5 text-primary/70" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-primary">{fenomeno.nombre}</h2>
            {fenomeno.simbolo && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary/45">
                <span>{fenomeno.simbolo}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <h3 className="text-sm font-semibold text-primary">Procesos</h3>
        <p className="mt-1 text-xs text-primary/45">Procesos que intervienen en este fenómeno</p>
        {loadingProcesos ? (
          <div className="flex items-center gap-2 py-5 text-sm text-primary/45">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando procesos…
          </div>
        ) : relacionesProcesos.length === 0 ? (
          <p className="py-4 text-sm text-primary/40">Este fenómeno no tiene procesos asociados.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {relacionesProcesos.map((relacion) => {
              const proceso = procesos.find((item) => item.id === relacion.proceso_id);
              return (
                <div
                  key={relacion.id}
                  className="flex items-center justify-between rounded-lg border border-primary/10 px-3 py-2"
                >
                  <span className="text-sm text-primary">
                    {proceso?.nombre ?? relacion.proceso_id.slice(0, 8)}
                  </span>
                  {relacion.rol && <span className="text-xs text-primary/50">{relacion.rol}</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <h3 className="text-sm font-semibold text-primary">Elementos</h3>
        <p className="mt-1 text-xs text-primary/45">Elementos involucrados en este fenómeno</p>
        {loadingElementos ? (
          <div className="flex items-center gap-2 py-5 text-sm text-primary/45">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando elementos…
          </div>
        ) : relacionesElementos.length === 0 ? (
          <p className="py-4 text-sm text-primary/40">Este fenómeno no tiene elementos asociados.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {relacionesElementos.map((relacion) => {
              const elemento = elementos.find((item) => item.id === relacion.elemento_id);
              return (
                <div key={relacion.id} className="rounded-lg border border-primary/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-primary">
                      {elemento?.nombre ?? relacion.elemento_id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-primary/50">× {formatValue(relacion.cantidad)}</span>
                  </div>
                  {relacion.rol && <div className="mt-1 text-xs text-primary/40">{relacion.rol}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {fenomeno.notas && (
        <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
          <h3 className="text-sm font-semibold text-primary">Notas</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary/55">{fenomeno.notas}</p>
        </section>
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-4xl">
            <FenomenoDetail fenomeno={fenomeno} />
          </div>
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

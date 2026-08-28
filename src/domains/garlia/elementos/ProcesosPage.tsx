"use client";

import { Activity, Loader2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { useProcesos } from "./useProcesos";
import { useProcesoReacciones } from "./useProcesoReacciones";
import { useReacciones } from "./useReacciones";
import type { Proceso } from "./types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  return String(value);
}

/** Misma fila label/valor que usan Elemento/Compuesto/Material para sus
 *  secciones de solo lectura. */
function PropertyRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-primary/10 py-2 last:border-b-0">
      <span className="shrink-0 text-sm text-primary/55">{label}</span>
      <span className="text-right text-sm font-medium leading-relaxed text-primary">{formatValue(value)}</span>
    </div>
  );
}

/** Bloque de texto largo (párrafo), para campos como entrada/transformación/
 *  salida que suelen ser oraciones en vez de valores cortos — evita
 *  aplastarlos en una fila de dos columnas. */
function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="border-b border-primary/10 py-2 last:border-b-0">
      <p className="mb-1 text-sm text-primary/55">{label}</p>
      <p className="text-sm leading-relaxed text-primary">{value}</p>
    </div>
  );
}

function ProcesoDetail({ proceso }: { proceso: Proceso }) {
  const { items: relaciones, loading: loadingRelaciones } = useProcesoReacciones(proceso.id);
  const { items: reacciones } = useReacciones();

  const receta = [
    ["regla_clave", "Regla clave", proceso.regla_clave],
    ["entrada", "Entrada", proceso.entrada],
    ["transformacion", "Transformación", proceso.transformacion],
    ["salida", "Salida", proceso.salida],
    ["conservacion", "Conservación", proceso.conservacion],
    ["estado_fundamento", "Fundamento", proceso.estado_fundamento],
  ] as const;
  const recetaVisible = receta.filter(([, , value]) => value);

  return (
    <div className="space-y-4">
      <header className="border-b border-primary/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-primary/15 bg-primary/5 p-2">
            <Activity className="h-5 w-5 text-primary/70" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-primary">{proceso.nombre}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary/45">
              <span>{proceso.tipo || "sin tipo"}</span>
            </div>
          </div>
        </div>
        {proceso.descripcion && (
          <p className="mt-4 text-sm leading-relaxed text-primary/60">{proceso.descripcion}</p>
        )}
      </header>

      {recetaVisible.length > 0 && (
        <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-primary">Receta del proceso</h3>
            <p className="mt-1 text-xs text-primary/45">Entrada → transformación → salida</p>
          </div>
          <div>
            {recetaVisible.map(([key, label, value]) =>
              key === "regla_clave" ? (
                <PropertyRow key={key} label={label} value={value} />
              ) : (
                <TextBlock key={key} label={label} value={value} />
              ),
            )}
          </div>
        </section>
      )}

      {proceso.condiciones && (
        <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
          <h3 className="text-sm font-semibold text-primary">Condiciones</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary/60">{proceso.condiciones}</p>
        </section>
      )}

      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <h3 className="text-sm font-semibold text-primary">Reacciones</h3>
        <p className="mt-1 text-xs text-primary/45">Reacciones que componen este proceso</p>
        {loadingRelaciones ? (
          <div className="flex items-center gap-2 py-5 text-sm text-primary/45">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando reacciones…
          </div>
        ) : relaciones.length === 0 ? (
          <p className="py-4 text-sm text-primary/40">Este proceso no tiene reacciones asociadas.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {relaciones.map((relacion) => {
              const reaccion = reacciones.find((item) => item.id === relacion.reaccion_id);
              return (
                <div key={relacion.id} className="rounded-lg border border-primary/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-primary">
                      {reaccion?.nombre ?? relacion.reaccion_id.slice(0, 8)}
                    </span>
                    {relacion.orden !== null && (
                      <span className="text-xs text-primary/50">#{relacion.orden}</span>
                    )}
                  </div>
                  {relacion.rol && <div className="mt-1 text-xs text-primary/40">{relacion.rol}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {proceso.notas && (
        <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
          <h3 className="text-sm font-semibold text-primary">Notas</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary/55">{proceso.notas}</p>
        </section>
      )}
    </div>
  );
}

function Editor({ proceso, onClose }: { proceso: Proceso; onClose: () => void }) {
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
            <Activity className="text-primary/50" size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-primary">{proceso.nombre}</p>
            <p className="text-micro text-primary/35">Proceso · solo lectura</p>
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
            <ProcesoDetail proceso={proceso} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ProcesosPage() {
  const { items, loading } = useProcesos();
  const [selected, setSelected] = useState<Proceso | null>(null);

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
              <Activity className="h-3 w-3 shrink-0 opacity-45" />
              <span className="truncate">{item.nombre}</span>
            </button>
          ))}
        </div>
      )}
      {selected && <Editor proceso={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

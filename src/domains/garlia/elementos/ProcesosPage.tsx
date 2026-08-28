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
    <div className="flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {proceso.tipo && (
            <span className="inline-block rounded px-1.5 py-0.5 bg-primary/5 text-micro font-bold text-primary/40">
              {proceso.tipo}
            </span>
          )}
          {proceso.descripcion && (
            <p className="mt-1.5 text-xs leading-relaxed text-primary/55">{proceso.descripcion}</p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="flex flex-col gap-2 min-w-0">
          {recetaVisible.length > 0 && (
            <div className="flex flex-col gap-1.5 min-w-0 p-2">
              <div className="flex items-center gap-1.5">
                <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                  Receta del proceso
                </span>
              </div>
              <p className="text-micro text-primary/35 -mt-1">Entrada → transformación → salida</p>
              <div className="flex flex-col gap-1">
                {recetaVisible.map(([key, label, value]) =>
                  key === "regla_clave" ? (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-md border border-primary/10 px-2 py-1"
                    >
                      <span className="text-micro font-bold text-primary/50 truncate">{label}</span>
                      <span className="text-micro font-black text-primary/70 text-right">{formatValue(value)}</span>
                    </div>
                  ) : (
                    <div key={key} className="rounded-md border border-primary/10 px-2 py-1">
                      <span className="text-micro font-bold text-primary/45">{label}</span>
                      <p className="mt-0.5 text-micro leading-relaxed text-primary/65">{value}</p>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {proceso.condiciones && (
            <div className="flex flex-col gap-1.5 min-w-0 p-2">
              <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                Condiciones
              </span>
              <p className="whitespace-pre-wrap text-micro leading-relaxed text-primary/55">
                {proceso.condiciones}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-col gap-1.5 min-w-0 p-2">
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Reacciones
            </span>
            <p className="text-micro text-primary/35 -mt-1">
              Opcional: transformación material específica asociada a este proceso, si existe.
            </p>
            {loadingRelaciones ? (
              <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
              </div>
            ) : relaciones.length === 0 ? (
              <p className="py-1 text-micro text-primary/30">
                Sin reacción asociada — no todo proceso tiene una, y eso no es un dato faltante.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {relaciones.map((relacion) => {
                  const reaccion = reacciones.find((item) => item.id === relacion.reaccion_id);
                  return (
                    <div key={relacion.id} className="rounded-md border border-primary/10 px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-micro font-bold text-primary/70 truncate">
                          {reaccion?.nombre ?? relacion.reaccion_id.slice(0, 8)}
                        </span>
                        {relacion.orden !== null && (
                          <span className="text-micro text-primary/40 shrink-0">#{relacion.orden}</span>
                        )}
                      </div>
                      {relacion.rol && <div className="mt-0.5 text-micro text-primary/35">{relacion.rol}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {proceso.notas && (
            <div className="flex flex-col gap-1.5 min-w-0 p-2">
              <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                Notas
              </span>
              <p className="whitespace-pre-wrap text-micro leading-relaxed text-primary/50">{proceso.notas}</p>
            </div>
          )}
        </div>
      </div>
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
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          <ProcesoDetail proceso={proceso} />
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

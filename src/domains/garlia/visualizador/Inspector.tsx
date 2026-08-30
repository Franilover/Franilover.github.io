"use client";

/**
 * Inspector.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Panel contextual puramente presentacional. No calcula, no consulta, no
 * infiere: recibe una entidad ya resuelta (título, subtítulo, campos) y la
 * muestra. Dos modos de profundidad:
 *   - "hover": tarjeta breve (descubrir).
 *   - "selected": panel completo fijado (inspeccionar).
 *
 * Reutilizable para cualquier entidad del Visualizador (Partícula, IUM,
 * Oris, Elemento, Compuesto, ...) — el llamador decide qué campos mostrar.
 */

import React from "react";

export interface InspectorField {
  label: string;
  /** Texto ya formateado por el llamador. Null/undefined → se muestra "—". */
  value: string | number | null | undefined;
}

export interface InspectorEntity {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  visual?: React.ReactNode;
  fields?: InspectorField[];
  /** Nota corta libre (ej. descripción, dominio). */
  note?: string | null;
  /** Bloque libre adicional, debajo de los fields (ej. Ficha con pills,
   *  Valores derivados reales) — el llamador decide qué renderizar; el
   *  Inspector solo le da el espacio y el separador. */
  extra?: React.ReactNode;
}

export function InspectorHoverCard({ entity }: { entity: InspectorEntity }) {
  return (
    <div className="pointer-events-none rounded-xl border border-primary/15 bg-[var(--bg-main)]/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      {entity.eyebrow ? (
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary/40">{entity.eyebrow}</p>
      ) : null}
      <p className="mt-1 text-xs font-black text-primary/85">{entity.title}</p>
      {entity.subtitle ? <p className="mt-1 text-[11px] text-primary/50">{entity.subtitle}</p> : null}
    </div>
  );
}

export function Inspector({
  entity,
  emptyLabel = "Seleccioná un elemento para inspeccionarlo.",
  bordered = true,
}: {
  entity: InspectorEntity | null;
  emptyLabel?: string;
  /** Borde del panel contenedor. Default true (comportamiento previo) —
   *  se puede desactivar por llamador (ej. Rutas, pedido explícito de
   *  quitar el borde del bloque del Oris) sin afectar a los demás usos de
   *  este componente compartido. */
  bordered?: boolean;
}) {
  if (!entity) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-primary/12 p-8 text-center text-xs leading-5 text-primary/35">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-5 ${bordered ? "border border-primary/10" : ""}`}>
      {entity.eyebrow ? (
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/35">{entity.eyebrow}</p>
      ) : null}
      <div className="mt-2 flex items-center gap-4">
        {entity.visual ? <div className="shrink-0">{entity.visual}</div> : null}
        <div>
          <p className="text-base font-black text-primary/90">{entity.title}</p>
          {entity.subtitle ? <p className="mt-1 text-xs text-primary/50">{entity.subtitle}</p> : null}
        </div>
      </div>

      {entity.note ? (
        <p className="mt-5 text-xs leading-5 text-primary/45">{entity.note}</p>
      ) : null}

      {entity.fields && entity.fields.length > 0 ? (
        <div className="mt-5 space-y-3 border-t border-primary/10 pt-4">
          {entity.fields.map((f) => (
            <div key={f.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="font-black uppercase tracking-widest text-primary/35">{f.label}</span>
              <span className="text-right text-primary/70">
                {f.value === null || f.value === undefined || f.value === "" ? "—" : f.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {entity.extra ? (
        <div className="mt-5 border-t border-primary/10 pt-4">{entity.extra}</div>
      ) : null}
    </div>
  );
}

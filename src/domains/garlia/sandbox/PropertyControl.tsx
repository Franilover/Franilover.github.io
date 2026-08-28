"use client";

/**
 * PropertyControl.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Componente genérico para mostrar (y, cuando aplica, editar) una propiedad
 * calculada de cualquier entidad de Garlia — Elemento, Compuesto, Material,
 * Estructura, o una entidad de Sandbox.
 *
 * REGLA DE ORIGEN (ver decisión de equipo, prompt del laboratorio visual):
 * El componente NUNCA decide su modo por el nombre de la propiedad
 * (`clave === "rigidez"`). Decide exclusivamente por la FORMA del dato que
 * ya entrega el backend:
 *
 *   - `proporcion` (0–1) presente  → índice confirmado → modo SLIDER.
 *     Este campo ya lo calcula propiedadesCalculadasGenerico /
 *     propiedadesCalculadasDeElemento / DeCompuesto (elementos/types.ts) —
 *     no es una inferencia nueva de este archivo, es el mismo contrato que
 *     ya usa TarjetaPropiedadesFisicas.
 *   - `proporcion` ausente → magnitud abierta (masa, volumen, temperatura,
 *     lo que sea) → modo INPUT NUMÉRICO, sin rango dibujado porque no
 *     existe metadata de min/max en ningún lado de Supabase todavía.
 *   - valor no numérico (string/boolean) → modo SOLO LECTURA, mismo formato
 *     que TarjetaPropiedad en SandboxPage.tsx.
 *
 * Cuando Supabase entregue metadata oficial de rango/unidad para una
 * magnitud abierta, este componente debe poder recibirla vía las props
 * opcionales `unidad`/`min`/`max` y pasar automáticamente a modo slider —
 * sin que el caller tenga que reescribir nada. Hasta entonces, NO se
 * inventa un rango (ni siquiera "estimado, no oficial" — decisión de
 * equipo explícita).
 *
 * MODOS DE EDICIÓN:
 *   - `onChange` ausente → siempre solo lectura, sin importar el resto.
 *   - `onChange` presente → editable. El caller decide CUÁNDO pasar
 *     onChange: según la decisión del equipo, debe ser solo mientras la
 *     propiedad vive en `estado_inicial` (antes de crear la entidad en
 *     Sandbox), nunca directo sobre `estado_actual` de una simulación ya
 *     corriendo — ese respeta la causalidad del motor. Este componente no
 *     impone esa regla por sí mismo (no tiene forma de saber si el caller
 *     está en estado_inicial o estado_actual); es responsabilidad del
 *     caller no pasar onChange en el segundo caso.
 *
 * COMPATIBILIDAD FUTURA: todas las props son nombradas (un solo objeto),
 * `onChange` es opcional y va al final solo por legibilidad, no por
 * posición fija. Cuando se necesite edición completa (fórmula/dependencias/
 * procedencia/gráfico — ver roadmap del laboratorio visual), esa
 * información se agrega como props nuevas opcionales sin tocar las
 * existentes: ningún consumidor actual (PropertyControlGrid, SandboxPage)
 * se rompe. No se implementa nada de eso todavía — solo se deja la puerta
 * abierta.
 *
 * Visual: mismas clases que TarjetaPropiedad (SandboxPage.tsx) y
 * TarjetaPropiedadesFisicas (GridPropiedadesCalculadas.tsx) — no introduce
 * un cuarto lenguaje visual de tarjeta.
 */

import React from "react";

import type { PropiedadCalculada } from "@/domains/garlia/elementos/types";
import { InfoFormulasPopover } from "@/domains/garlia/elementos/InfoFormulasPopover";

export interface PropertyControlMeta {
  /** Unidad legible, ej. "kg", "m³", "°C". Ausente = sin unidad conocida. */
  unidad?: string;
  /** Rango oficial, si Supabase ya lo entrega. Ausente = no dibujar rango. */
  min?: number;
  max?: number;
  step?: number;
}

export function PropertyControl({
  propiedad,
  meta,
  onChange,
}: {
  propiedad: PropiedadCalculada;
  /** Metadata opcional de unidad/rango — hoy casi siempre ausente. Ver
   *  nota de archivo: no se inventa si no viene del backend. */
  meta?: PropertyControlMeta;
  /** Si se pasa, la propiedad es editable. Recibe el nuevo valor numérico
   *  crudo (no formateado) — el caller decide dónde persistirlo. */
  onChange?: (nuevoValor: number) => void;
}) {
  const valorNumerico =
    propiedad.valor !== null && propiedad.valor !== "" && !Number.isNaN(Number(propiedad.valor))
      ? Number(propiedad.valor)
      : null;

  const esIndiceConfirmado = propiedad.proporcion !== undefined;
  const esEditable = onChange !== undefined && valorNumerico !== null;

  return (
    <div className="flex flex-col gap-1 min-w-0 px-2 py-1.5 bg-primary/5 rounded-md border border-primary/10">
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/35 truncate">
            {propiedad.label}
          </span>
          {propiedad.formula && (
            <InfoFormulasPopover propiedades={[propiedad]} />
          )}
        </div>
        {!esEditable && (
          <span className="text-micro font-black text-primary/80 tabular-nums shrink-0 truncate max-w-[7rem] text-right">
            {propiedad.valor ?? "—"}
            {meta?.unidad ? ` ${meta.unidad}` : ""}
          </span>
        )}
      </div>

      {/* Sin valor numérico: solo lectura, texto tal cual (string/boolean/objeto ya formateado aguas arriba). */}
      {valorNumerico === null && (
        <p className="text-micro text-primary/25 italic">Sin valor calculado.</p>
      )}

      {/* Índice [0,1] confirmado por el backend → slider. Editable solo si
          el caller pasó onChange (ver regla de estado_inicial en cabecera). */}
      {valorNumerico !== null && esIndiceConfirmado && (
        <div className="flex flex-col gap-0.5">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={valorNumerico}
            disabled={!esEditable}
            onChange={(e) => onChange?.(Number(e.target.value))}
            className="w-full h-1 accent-primary disabled:opacity-40"
          />
          <div className="flex items-center justify-between text-[9px] text-primary/30 tabular-nums">
            <span>0.00</span>
            {esEditable && (
              <span className="text-primary/60 font-bold">{valorNumerico.toFixed(2)}</span>
            )}
            <span>1.00</span>
          </div>
        </div>
      )}

      {/* Magnitud abierta, sin proporcion → input numérico, sin rango
          dibujado salvo que meta.min/max venga confirmado del backend. */}
      {valorNumerico !== null && !esIndiceConfirmado && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={valorNumerico}
            step={meta?.step ?? "any"}
            min={meta?.min}
            max={meta?.max}
            disabled={!esEditable}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) onChange?.(n);
            }}
            className="w-full bg-input-bg text-input-text border border-primary/15 rounded-md px-2 py-1 text-micro font-black tabular-nums outline-none focus:border-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {meta?.unidad && (
            <span className="text-micro text-primary/40 shrink-0">{meta.unidad}</span>
          )}
        </div>
      )}

      {propiedad.descripcion && (
        <p className="text-[10px] text-primary/30 leading-snug">{propiedad.descripcion}</p>
      )}
    </div>
  );
}

/**
 * Grid de PropertyControl — reemplazo drop-in de TarjetaPropiedadesFisicas
 * cuando se necesita edición; si `onChange` no se pasa para ninguna, el
 * resultado visual es equivalente a la tarjeta de solo lectura existente.
 */
export function PropertyControlGrid({
  propiedades,
  metaPorClave,
  onChangeClave,
  columnas = 2,
}: {
  propiedades: PropiedadCalculada[];
  /** Metadata por clave — casi siempre vacío hoy, ver nota de archivo. */
  metaPorClave?: Record<string, PropertyControlMeta>;
  /** Si se pasa, cada propiedad se vuelve editable y esto recibe
   *  (clave, nuevoValor). Ausente = grid completo en solo lectura. */
  onChangeClave?: (clave: string, nuevoValor: number) => void;
  columnas?: 2 | 3 | 4;
}) {
  const conValor = propiedades.filter((p) => p.valor !== null);
  if (conValor.length === 0) {
    return <p className="text-micro text-primary/25 italic py-1">Sin propiedades calculadas todavía.</p>;
  }

  const gridCols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columnas];

  return (
    <div className={`grid ${gridCols} gap-1.5 min-w-0`}>
      {conValor.map((p) => (
        <PropertyControl
          key={p.clave}
          propiedad={p}
          meta={metaPorClave?.[p.clave]}
          onChange={onChangeClave ? (v) => onChangeClave(p.clave, v) : undefined}
        />
      ))}
    </div>
  );
}

"use client";

/**
 * AuditoriaDerivacionPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Dos tablas de solo lectura:
 *   1. Compuestos — semáforo POR PROPIEDAD (masa/carga/estabilidad/rigidez/
 *      flexibilidad), comparando almacenado vs derivado. NO se usa
 *      estado_derivacion de la vista como veredicto único: hoy marca
 *      "discrepancia" en 90/90 filas, pero la discrepancia real NO está
 *      acotada a estabilidad/energía. Re-verificado (2026) tras el cambio
 *      de fórmula de rigidez/flexibilidad en estado_proyecto v141-v142
 *      (ahora incorpora enlaces): masa/carga SÍ coinciden siempre
 *      (0/90 diffs), pero estabilidad (89/90), rigidez (87/90) y
 *      flexibilidad (90/90) también discrepan hoy. Mostrar la columna
 *      estado_derivacion sola pintaría el 100% de rojo de forma engañosa;
 *      por eso el semáforo se calcula por propiedad, individualmente.
 *   2. Elementos — tabla de valores planos, SIN semáforo: la vista no trae
 *      columna de veredicto usable. fuente_propiedades/metodo_propiedades
 *      ya no están NULL (67/67 filas tienen ahora un valor constante de
 *      procedencia), pero al ser el mismo valor para toda la tabla siguen
 *      sin ser una señal por fila, así que no se modela semáforo con ellas.
 *
 * Click en una fila de compuesto/elemento navega al editor real ya
 * existente (ElementosPage vía ElementosSection) usando
 * useMundoNavigation().openEntity — nunca se duplica esa UI acá.
 * Compuestos usan compuestoIdParaNavegacion() (ver ElementosSection.tsx)
 * porque openEntity("elementos", id) por sí solo abre un ELEMENTO; el
 * prefijo es lo que permite distinguir el caso compuesto sin crear una
 * SectionKey nueva.
 */

import React, { useMemo, useState } from "react";

import { Badge, EmptyState, Loading } from "@/ui/Feedback";
import { Text } from "@/ui/Tipografia";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { compuestoIdParaNavegacion } from "@/domains/garlia/elementos/ElementosSection";

import { useAuditoriaCompuestos } from "./useAuditoriaCompuestos";
import { useAuditoriaElementos } from "./useAuditoriaElementos";
import { PROPIEDADES_COMPUESTO_COMPARABLES, type AuditoriaCompuestoRow } from "./types";

/** Tolerancia de redondeo — ver estado_proyecto: discrepancias de hasta
 *  ±0.0001 son solo redondeo, no un error real de derivación. */
const TOLERANCIA = 0.0005;

function coincide(a: number, b: number) {
  return Math.abs(a - b) <= TOLERANCIA;
}

function FilaCompuesto({ row }: { row: AuditoriaCompuestoRow }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  const resultados = PROPIEDADES_COMPUESTO_COMPARABLES.map((p) => ({
    label: p.label,
    ok: coincide(Number(row[p.campo]), Number(row[p.campoDerivado])),
  }));
  const okCount = resultados.filter((r) => r.ok).length;
  const total = resultados.length;

  return (
    <button
      type="button"
      onClick={() => openEntity("elementos", compuestoIdParaNavegacion(row.id))}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-primary/[0.04] transition-colors cursor-pointer border-b border-primary/5 text-left"
    >
      <Text variant="sm" className="text-primary/80 truncate min-w-0 flex-1">
        {row.nombre}
      </Text>
      <div className="flex items-center gap-1 shrink-0">
        {resultados.map((r) => (
          <span
            key={r.label}
            title={`${r.label}: ${r.ok ? "coincide" : "discrepancia"}`}
            className={`w-2 h-2 rounded-full ${r.ok ? "bg-green-500/70" : "bg-red-500/70"}`}
          />
        ))}
      </div>
      <Badge variant={okCount === total ? "success" : okCount === 0 ? "danger" : "warning"}>
        {okCount}/{total}
      </Badge>
    </button>
  );
}

function TablaCompuestos() {
  const { items, loading } = useAuditoriaCompuestos();
  const [soloConDiscrepancias, setSoloConDiscrepancias] = useState(false);

  const filtrados = useMemo(() => {
    if (!soloConDiscrepancias) return items;
    return items.filter((row) =>
      PROPIEDADES_COMPUESTO_COMPARABLES.some(
        (p) => !coincide(Number(row[p.campo]), Number(row[p.campoDerivado])),
      ),
    );
  }, [items, soloConDiscrepancias]);

  if (loading) return <Loading text="Cargando auditoría de compuestos..." fullScreen={false} />;
  if (items.length === 0) return <EmptyState label="Sin compuestos en la vista de auditoría" />;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <Text variant="lbl">
          Compuestos ({filtrados.length}/{items.length})
        </Text>
        <Badge
          active={soloConDiscrepancias}
          variant="default"
          onClick={() => setSoloConDiscrepancias((v) => !v)}
        >
          Solo con discrepancias
        </Badge>
      </div>
      <div className="border border-primary/10 rounded-lg overflow-hidden">
        {filtrados.map((row) => (
          <FilaCompuesto key={row.id} row={row} />
        ))}
      </div>
      <Text variant="xs" className="text-primary/30 mt-1.5 px-1">
        Cada punto = masa / carga / estabilidad / rigidez / flexibilidad. Verde = valor
        almacenado coincide con el derivado (tolerancia ±{TOLERANCIA}). Click abre el
        compuesto en su editor real.
      </Text>
    </div>
  );
}

function TablaElementos() {
  const { items, loading } = useAuditoriaElementos();
  const openEntity = useMundoNavigation((s) => s.openEntity);

  if (loading) return <Loading text="Cargando auditoría de elementos..." fullScreen={false} />;
  if (items.length === 0) return <EmptyState label="Sin elementos en la vista de auditoría" />;

  return (
    <div>
      <Text variant="lbl" className="mb-2 px-1 block">
        Elementos ({items.length}) — valores de referencia, sin semáforo propio
      </Text>
      <div className="border border-primary/10 rounded-lg overflow-hidden">
        {items.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => openEntity("elementos", row.id)}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-primary/[0.04] transition-colors cursor-pointer border-b border-primary/5 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Text variant="xs" className="text-primary/30 tabular-nums w-6 shrink-0">
                #{row.numero_atomico}
              </Text>
              <Text variant="sm" className="text-primary/80 truncate">
                {row.nombre}
              </Text>
            </div>
            <Text variant="xs" className="text-primary/40 shrink-0">
              estabilidad {Number(row.estabilidad).toFixed(2)} · rigidez{" "}
              {Number(row.rigidez).toFixed(2)}
            </Text>
          </button>
        ))}
      </div>
      <Text variant="xs" className="text-primary/30 mt-1.5 px-1">
        Esta vista no trae columna de veredicto por fila (fuente_propiedades/
        metodo_propiedades son el mismo valor de procedencia para toda la tabla)
        — se muestra como referencia. Click abre el elemento en su editor real.
      </Text>
    </div>
  );
}

export function AuditoriaDerivacionPanel() {
  return (
    <div className="space-y-6">
      <TablaCompuestos />
      <TablaElementos />
    </div>
  );
}

"use client";

/**
 * AfinidadEntreEntidadesPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * "¿Con qué otro mineral/planta se complementa este?" — reusa
 * ordenarPorAfinidadDeMezclas (afinidad.ts) sobre la mezcla agregada de
 * TODAS las Formaciones/Órganos de cada entidad del catálogo
 * (useMezclasAfinidadCatalogo), mismo criterio de "complementa/compite/
 * saturado/estable" que ya existe para Compuestos sueltos — acá aplicado
 * cruzando Mineral↔Flora↔Mineral, porque ambos comparten el mismo
 * lenguaje `{compuesto_id, cantidad}[]`.
 *
 * Solo muestra los "complementa" (top N) — es una sugerencia de diseño,
 * no un listado exhaustivo de todas las relaciones.
 */

import { Sparkles } from "lucide-react";
import React, { useMemo } from "react";

import { ordenarPorAfinidadDeMezclas, type ComponenteCompuestoEnMezcla } from "@/domains/garlia/elementos/afinidad";
import type { Compuesto, Elemento } from "@/domains/garlia/elementos/types";
import { useMezclasAfinidadCatalogo, type EntidadConMezcla } from "./useMezclasAfinidadCatalogo";

const TIPO_ICONO: Record<EntidadConMezcla["tipo"], string> = {
  mineral: "Mineral",
  flora: "Flora",
};

export function AfinidadEntreEntidadesPanel({
  entidadId,
  nombreEntidad,
  mezcla,
  compuestos,
  elementos,
  maxResultados = 5,
}: {
  /** Id de la entidad actual (Mineral o Flora), para excluirse a sí misma. */
  entidadId: string;
  nombreEntidad: string;
  /** Mezcla agregada actual (todas sus Formaciones/Órganos juntos) — se
   *  recalcula en vivo desde lo que ya está editado en pantalla, no desde
   *  lo último guardado en la DB. */
  mezcla: ComponenteCompuestoEnMezcla[];
  compuestos: Compuesto[];
  elementos: Elemento[];
  maxResultados?: number;
}) {
  const { entidades, loading } = useMezclasAfinidadCatalogo();

  const resultados = useMemo(() => {
    if (mezcla.length === 0) return [];
    const candidatos = entidades
      .filter((e) => e.id !== entidadId)
      .map((e) => ({ item: e, mezcla: e.mezcla, nombre: e.nombre }));
    return ordenarPorAfinidadDeMezclas(mezcla, candidatos, compuestos, elementos, nombreEntidad)
      .filter((r) => r.afinidad.tipo === "complementa")
      .slice(0, maxResultados);
  }, [entidades, entidadId, mezcla, compuestos, elementos, nombreEntidad, maxResultados]);

  if (mezcla.length === 0) return null;
  if (loading) {
    return (
      <p className="text-micro text-primary/25 italic py-1">Calculando afinidades…</p>
    );
  }
  if (resultados.length === 0) return null;

  return (
    <div className="mt-2 p-2 rounded-lg border border-primary/10 bg-primary/[0.02]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={11} className="text-accent/60 shrink-0" />
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
          Se complementa con
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {resultados.map(({ item, afinidad }) => (
          <div key={item.id} className="flex items-start gap-1.5 py-0.5">
            <span className="shrink-0 text-micro font-black text-accent/60 uppercase tracking-wide mt-px">
              {TIPO_ICONO[item.tipo]}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-primary/80">{item.nombre}</span>
              <p className="text-micro text-primary/45 leading-snug">{afinidad.motivo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

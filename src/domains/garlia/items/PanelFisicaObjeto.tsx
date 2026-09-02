"use client";

import { Loader2, Pencil, X } from "lucide-react";
import React, { useState } from "react";

import { useMateriales } from "@/domains/garlia/materiales/useMateriales";

import { useItemMateriales } from "./useItemMateriales";
import { SelectorMaterialesItem } from "./SelectorMaterialesItem";
import { EditorGeometriaItem } from "./EditorGeometriaItem";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Tarjeta compacta de una propiedad — mismo lenguaje visual que
 *  TarjetaPropiedadesFisicas de Química (elementos/GridPropiedadesCalculadas):
 *  sin borde ni fondo propios, solo tipografía micro y separación por
 *  espaciado, apoyándose en el contenedor exterior para el límite visual. */
function PropertyCell({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-1 min-w-0 px-2 py-1.5">
      <span className="text-micro font-bold text-primary/50 truncate">{label}</span>
      <span className="text-micro font-black text-primary/70 tabular-nums shrink-0">
        {formatValue(value)}
      </span>
    </div>
  );
}

function SubGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-primary/25 px-2">
      {children}
    </span>
  );
}

const MAGNITUDES_OBJETO = [
  ["masa", "Masa"], ["densidad", "Densidad"], ["volumen", "Volumen"],
] as const;

const GEOMETRIA_OBJETO = [
  ["factor_geometrico", "Factor geométrico"],
] as const;

const PROPIEDADES_OBJETO = [
  ["rigidez", "Rigidez"], ["estabilidad", "Estabilidad"], ["flexibilidad", "Flexibilidad"],
  ["dureza", "Dureza"], ["conductividad", "Conductividad"], ["transparencia", "Transparencia"],
  ["resistencia_efectiva", "Resistencia efectiva"],
] as const;

const ESTADO_LABEL: Record<string, string> = {
  calculable: "Calculado",
  sin_materiales: "Sin materiales",
  incompleto_geometria: "Falta geometría",
};

/**
 * Física canónica de un Objeto (documentacion_sistema "Modelo físico
 * canónico v218", orden 1001-1002).
 *
 * Un objeto no hereda propiedades de forma pasiva: Supabase las deriva de
 * item_materiales (fuente principal) + geometria_fisica del propio objeto.
 * `items.compuesto_id` es solo compatibilidad secundaria y nunca se suma a
 * esto.
 *
 * La sección "Física del objeto" es de SOLO LECTURA: no recalcula
 * masa/densidad/etc, solo muestra lo que ya viene en
 * items.propiedades_fisicas. La composición (SelectorMaterialesItem, más
 * abajo) sí es editable — pero solo edita la CAUSA (qué material, cuánta
 * cantidad/proporción), nunca el resultado. El frontend nunca calcula
 * propiedades físicas.
 *
 * Si el estado es "sin_materiales" o "incompleto_geometria", eso es falta
 * de datos constructivos del objeto — no un error del motor — y se muestra
 * así explícitamente, sin inventar valores ni tratarlo como cero.
 *
 * Diseño: minimalista, sin tarjetas anidadas con fondo/borde propio — cada
 * bloque (Física / Geometría / Materiales) es solo un título micro-label +
 * contenido, separado por gap-3 dentro de la tarjeta exterior que ya pone
 * EditorItem. Mismo criterio que ElementoEditor/CompuestoEditor de Química:
 * el contorno vive en el contenedor, no en cada sub-sección.
 */
export function PanelFisicaObjeto({
  itemId,
  propiedadesFisicas,
  estadoFisico,
  geometriaFisica,
  onRefrescarItem,
}: {
  itemId: string;
  propiedadesFisicas?: (Record<string, unknown> & { estado?: string; fuente_fisica?: string }) | null;
  estadoFisico?: string | null;
  geometriaFisica?: Record<string, unknown> | null;
  /** Llamado tras agregar/editar/quitar un material. Supabase ya recalculó
   *  y persistió items.propiedades_fisicas (trigger trg_objeto_propiedades →
   *  recalcular_objeto_propiedades, verificado contra el proyecto real).
   *  Este panel no lo relee solo: el padre (EditorItem) decide cómo volver
   *  a pedir el `item` — misma query que ya usa para cargarlo la primera
   *  vez. Sin esto, la sección de física quedaría mostrando el valor
   *  anterior hasta recargar el editor entero. */
  onRefrescarItem?: () => void;
}) {
  const { items: materialesCatalogo, loading: loadingCatalogo } = useMateriales();
  const { items: composicion, loading: loadingComposicion } = useItemMateriales(itemId);
  const [editandoComposicion, setEditandoComposicion] = useState(false);

  const propiedades = propiedadesFisicas ?? {};
  const estado = estadoFisico ?? (propiedades.estado as string | undefined) ?? "sin_materiales";
  const esCalculable = estado === "calculable";
  const fuente = propiedades.fuente_fisica;

  return (
    <div className="flex flex-col gap-3">
      {/* Física — solo lectura, derivada de materiales + geometría. */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Física del objeto
          </span>
          <span
            className={`shrink-0 text-micro font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
              esCalculable ? "text-primary/40" : "text-amber-600/70"
            }`}
            title={
              fuente
                ? `Fuente física: ${fuente === "materiales" ? "materiales asociados" : fuente}`
                : undefined
            }
          >
            {ESTADO_LABEL[estado] ?? estado}
          </span>
        </div>

        {!esCalculable ? (
          <p className="text-micro text-primary/35 italic py-1">
            {estado === "incompleto_geometria"
              ? "Tiene materiales asociados pero falta geometría (volumen) para derivar densidad."
              : "Todavía no tiene composición material suficiente para derivar propiedades físicas."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Izquierda: Magnitudes + Geometría apiladas */}
            <div className="flex flex-col gap-2">
              {MAGNITUDES_OBJETO.some(([key]) => propiedades[key] !== undefined) && (
                <div className="flex flex-col gap-0.5">
                  <SubGroupLabel>Magnitudes</SubGroupLabel>
                  {MAGNITUDES_OBJETO.filter(([key]) => propiedades[key] !== undefined).map(
                    ([key, label]) => (
                      <PropertyCell key={key} label={label} value={propiedades[key]} />
                    ),
                  )}
                </div>
              )}
              {GEOMETRIA_OBJETO.some(([key]) => propiedades[key] !== undefined) && (
                <div className="flex flex-col gap-0.5">
                  <SubGroupLabel>Geometría</SubGroupLabel>
                  {GEOMETRIA_OBJETO.filter(([key]) => propiedades[key] !== undefined).map(
                    ([key, label]) => (
                      <PropertyCell key={key} label={label} value={propiedades[key]} />
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Derecha: Propiedades */}
            {PROPIEDADES_OBJETO.some(([key]) => propiedades[key] !== undefined) && (
              <div className="flex flex-col gap-0.5">
                <SubGroupLabel>Propiedades</SubGroupLabel>
                {PROPIEDADES_OBJETO.filter(([key]) => propiedades[key] !== undefined).map(
                  ([key, label]) => (
                    <PropertyCell key={key} label={label} value={propiedades[key]} />
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Geometría — hoy el motor solo lee geometria_fisica.volumen (+
          unidad_volumen) para compararlo contra el volumen que deriva de
          materiales/estructura. Editable acá; el resultado de la
          comparación (volumen_comparacion) es solo lectura, viene de
          propiedades_fisicas. */}
      <EditorGeometriaItem
        geometriaFisica={geometriaFisica}
        itemId={itemId}
        volumenComparacion={
          propiedades.volumen_comparacion as
            | { estado?: string; diferencia_si?: number | null; diferencia_relativa?: number | null }
            | undefined
        }
        onGuardado={onRefrescarItem}
      />

      {/* Materiales — composición declarada, origen de la física de arriba. */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Materiales
          </span>
          <button
            className="shrink-0 flex items-center gap-1 text-micro font-bold text-primary/40 hover:text-primary transition-colors"
            type="button"
            onClick={() => setEditandoComposicion((v) => !v)}
          >
            {editandoComposicion ? (
              <>
                <X size={11} /> Cerrar
              </>
            ) : (
              <>
                <Pencil size={11} /> Editar
              </>
            )}
          </button>
        </div>

        {/* Capa 1: composición declarada, solo lectura, compacta. Distinta
            conceptualmente de "Editar composición" — esta es la lectura de
            la causa ya guardada, no un formulario. Filas separadas por un
            divisor sutil en vez de bordes/fondo por fila. */}
        {!editandoComposicion && (
          loadingComposicion ? (
            <div className="flex items-center gap-2 py-2 text-micro text-primary/40">
              <Loader2 className="h-3 w-3 animate-spin" /> Cargando materiales…
            </div>
          ) : composicion.length === 0 ? (
            <p className="text-micro text-primary/35 italic py-1">
              Sin materiales asociados todavía.
            </p>
          ) : (
            <div className="flex flex-col">
              {composicion.map((fila) => {
                const material = materialesCatalogo.find((m) => m.id === fila.material_id);
                return (
                  <div
                    key={fila.id}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-primary/8 last:border-b-0"
                  >
                    <span className="text-xs font-bold text-primary/75 truncate">
                      {loadingCatalogo ? "…" : material?.nombre ?? fila.material_id.slice(0, 8)}
                    </span>
                    <div className="shrink-0 flex items-center gap-2 text-micro text-primary/40">
                      <span className="tabular-nums">× {formatValue(fila.cantidad)}</span>
                      {fila.proporcion !== null && (
                        <span className="tabular-nums">prop. {formatValue(fila.proporcion)}</span>
                      )}
                      {fila.rol && <span className="text-primary/30">{fila.rol}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Capa 2: edición — la CAUSA, nunca el resultado. Al cambiar algo
            acá, Supabase ya recalculó vía trigger; solo avisamos al padre
            para que vuelva a pedir el `item`. */}
        {editandoComposicion && (
          <SelectorMaterialesItem itemId={itemId} onComposicionCambiada={onRefrescarItem} />
        )}
      </section>
    </div>
  );
}

export default PanelFisicaObjeto;

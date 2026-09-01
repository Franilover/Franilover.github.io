"use client";

import { Loader2, Pencil, Weight, X } from "lucide-react";
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

function PropertyRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-primary/10 py-2 last:border-b-0">
      <span className="text-sm text-primary/55">{label}</span>
      <span className="text-sm font-medium text-primary">{formatValue(value)}</span>
    </div>
  );
}

const PROPIEDADES_FISICAS_OBJETO = [
  ["masa", "Masa"], ["densidad", "Densidad"], ["volumen", "Volumen"],
  ["rigidez", "Rigidez"], ["estabilidad", "Estabilidad"], ["flexibilidad", "Flexibilidad"],
  ["dureza", "Dureza"], ["conductividad", "Conductividad"], ["transparencia", "Transparencia"],
  ["resistencia_efectiva", "Resistencia efectiva"], ["factor_geometrico", "Factor geométrico"],
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
    <div className="space-y-4">
      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Weight className="h-4 w-4 text-primary/50" />
            <div>
              <h3 className="text-sm font-semibold text-primary">Física del objeto</h3>
              <p className="mt-1 text-xs text-primary/45">
                Derivada de composición material · solo lectura
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-micro font-semibold ${
              esCalculable
                ? "border-primary/15 bg-primary/5 text-primary/60"
                : "border-amber-500/25 bg-amber-500/5 text-amber-600/80"
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
          <p className="py-2 text-sm text-primary/40">
            {estado === "incompleto_geometria"
              ? "Este objeto tiene materiales asociados pero le falta geometría física (volumen) para derivar densidad."
              : "Este objeto todavía no tiene composición material suficiente para derivar propiedades físicas. Es una falta de datos constructivos, no un error del motor."}
          </p>
        ) : (
          <div>
            {PROPIEDADES_FISICAS_OBJETO.filter(([key]) => propiedades[key] !== undefined).map(
              ([key, label]) => (
                <PropertyRow key={key} label={label} value={propiedades[key]} />
              ),
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

      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-primary">Materiales</h3>
            <p className="mt-1 text-xs text-primary/45">
              Composición declarada del objeto — origen de la física de arriba
            </p>
          </div>
          <button
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-primary/15 px-2.5 py-1 text-xs font-medium text-primary/60 hover:text-primary hover:border-primary/35 transition-all"
            type="button"
            onClick={() => setEditandoComposicion((v) => !v)}
          >
            {editandoComposicion ? (
              <>
                <X size={12} /> Cerrar
              </>
            ) : (
              <>
                <Pencil size={12} /> Editar composición
              </>
            )}
          </button>
        </div>

        {/* Capa 1: composición declarada, solo lectura, compacta. Distinta
            conceptualmente de "Editar composición" — esta es la lectura de
            la causa ya guardada, no un formulario. */}
        {!editandoComposicion && (
          loadingComposicion ? (
            <div className="flex items-center gap-2 py-3 text-sm text-primary/45">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando materiales…
            </div>
          ) : composicion.length === 0 ? (
            <p className="py-2 text-sm text-primary/40">
              Este objeto no tiene materiales asociados todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {composicion.map((fila) => {
                const material = materialesCatalogo.find((m) => m.id === fila.material_id);
                return (
                  <div key={fila.id} className="rounded-lg border border-primary/10 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-primary">
                        {loadingCatalogo ? "…" : material?.nombre ?? fila.material_id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-primary/50">
                        × {formatValue(fila.cantidad)}
                        {fila.proporcion !== null ? ` · prop. ${formatValue(fila.proporcion)}` : ""}
                      </span>
                    </div>
                    {fila.rol && <div className="mt-1 text-xs text-primary/40">{fila.rol}</div>}
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

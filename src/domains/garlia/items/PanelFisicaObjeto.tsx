"use client";

import { Loader2, Ruler, Weight } from "lucide-react";
import React from "react";

import { useMateriales } from "@/domains/garlia/materiales/useMateriales";

import { useItemMateriales } from "./useItemMateriales";

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
 * esto. Este panel es de SOLO LECTURA: no recalcula masa/densidad/etc, solo
 * muestra lo que ya viene en items.propiedades_fisicas.
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
}: {
  itemId: string;
  propiedadesFisicas?: (Record<string, unknown> & { estado?: string; fuente_fisica?: string }) | null;
  estadoFisico?: string | null;
  geometriaFisica?: Record<string, unknown> | null;
}) {
  const { items: materialesCatalogo } = useMateriales();
  const { items: composicion, loading: loadingComposicion } = useItemMateriales(itemId);

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

      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary/50" />
          <div>
            <h3 className="text-sm font-semibold text-primary">Geometría</h3>
            <p className="mt-1 text-xs text-primary/45">Volumen y forma declarados de la instancia</p>
          </div>
        </div>
        {!geometriaFisica || Object.keys(geometriaFisica).length === 0 ? (
          <p className="py-2 text-sm text-primary/40">Sin geometría física declarada.</p>
        ) : (
          <div>
            {Object.entries(geometriaFisica).map(([key, value]) => (
              <PropertyRow key={key} label={key} value={value} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <h3 className="text-sm font-semibold text-primary">Materiales</h3>
        <p className="mt-1 text-xs text-primary/45">
          Composición vía item_materiales — fuente principal de la física del objeto
        </p>
        {loadingComposicion ? (
          <div className="flex items-center gap-2 py-5 text-sm text-primary/45">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando materiales…
          </div>
        ) : composicion.length === 0 ? (
          <p className="py-4 text-sm text-primary/40">
            Este objeto no tiene materiales asociados todavía.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {composicion.map((fila) => {
              const material = materialesCatalogo.find((m) => m.id === fila.material_id);
              return (
                <div key={fila.id} className="rounded-lg border border-primary/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-primary">
                      {material?.nombre ?? fila.material_id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-primary/50">
                      × {formatValue(fila.cantidad)}
                      {fila.proporcion !== null ? ` · prop. ${formatValue(fila.proporcion)}` : ""}
                    </span>
                  </div>
                  {fila.rol && (
                    <div className="mt-1 text-xs text-primary/40">{fila.rol}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default PanelFisicaObjeto;

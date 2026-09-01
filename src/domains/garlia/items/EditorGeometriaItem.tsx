"use client";

/**
 * EditorGeometriaItem.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Edita items.geometria_fisica — específicamente `volumen` (numérico) y
 * `unidad_volumen` (texto), que son las únicas dos claves que el motor lee
 * de ahí (verificado leyendo calcular_propiedades_objeto en Supabase: usa
 * geometria_fisica->>'volumen' y geometria_fisica->>'unidad_volumen' para
 * comparar contra el volumen que el propio motor deriva de materiales +
 * estructura).
 *
 * Esto es un VOLUMEN DECLARADO, no una fórmula de longitud×ancho×grosor —
 * no existe ese esquema (forma/longitud/ancho/grosor) en el backend real
 * hoy; era una idea de mockup, no el contrato actual. El motor compara
 * este valor declarado contra su propio cálculo (volumen_comparacion,
 * dentro de propiedades_fisicas) y expone un estado — literales exactos
 * leídos del código fuente real de la función, no inventados acá:
 *   sin_volumen | declarado_no_verificable | calculado_sin_declarado |
 *   requiere_tolerancia | unidades_incompatibles
 *
 * Este componente NUNCA calcula el volumen ni decide si "está bien" — solo
 * declara la causa (geometria_fisica) y muestra el veredicto que ya trae
 * Supabase en propiedades_fisicas.volumen_comparacion.
 */

import { Loader2 } from "lucide-react";
import React, { useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { useUnidadVolumen } from "./useUnidadVolumen";

const ESTADO_COMPARACION_LABEL: Record<string, string> = {
  sin_volumen: "Sin volumen declarado ni calculado todavía",
  declarado_no_verificable: "Declarado, pero el motor no tiene con qué verificarlo aún",
  calculado_sin_declarado: "El motor ya calculó un volumen — falta declarar el tuyo para comparar",
  requiere_tolerancia: "Comparado contra el volumen del motor",
  unidades_incompatibles: "La unidad declarada no es compatible con la que usa el motor",
  no_verificable: "No verificable todavía",
};

function formatNumero(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "number") return String(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(4);
}

export function EditorGeometriaItem({
  itemId,
  geometriaFisica,
  volumenComparacion,
  onGuardado,
}: {
  itemId: string;
  geometriaFisica?: Record<string, unknown> | null;
  /** propiedades_fisicas.volumen_comparacion — resultado del motor, solo
   *  lectura. No se calcula ni se interpreta acá más allá de mostrar el
   *  estado y las diferencias tal cual vienen. */
  volumenComparacion?: {
    estado?: string;
    diferencia_si?: number | null;
    diferencia_relativa?: number | null;
  } | null;
  /** Se llama después de guardar geometria_fisica. Igual que
   *  SelectorMaterialesItem.onComposicionCambiada: la causa ya quedó
   *  persistida y Supabase ya recalculó vía el mismo trigger de
   *  item_materiales — esto solo avisa al padre para que vuelva a pedir el
   *  `item` si quiere reflejar el nuevo volumen_comparacion. */
  onGuardado?: () => void;
}) {
  const { unidad: unidadVolumen, loading: loadingUnidad } = useUnidadVolumen();

  const volumenGuardado = geometriaFisica?.volumen;
  const [volumenTexto, setVolumenTexto] = useState(
    typeof volumenGuardado === "number" ? String(volumenGuardado) : "",
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    let nuevoVolumen: number | null;
    if (volumenTexto.trim() === "") {
      nuevoVolumen = null;
    } else {
      const n = Number(volumenTexto);
      if (Number.isNaN(n) || n < 0) {
        setError("El volumen debe ser un número mayor o igual a 0.");
        setVolumenTexto(typeof volumenGuardado === "number" ? String(volumenGuardado) : "");
        return;
      }
      nuevoVolumen = n;
    }

    setGuardando(true);
    try {
      const geometriaActual = { ...(geometriaFisica ?? {}) };
      if (nuevoVolumen === null) {
        delete geometriaActual.volumen;
        delete geometriaActual.unidad_volumen;
      } else {
        geometriaActual.volumen = nuevoVolumen;
        // Se declara siempre en la unidad canónica real del catálogo — no
        // se ofrece otra porque hoy no existe otra dada de alta (ver
        // useUnidadVolumen). Si el motor agrega más adelante, este
        // componente debe volver a leerlas, no asumir cuál usar.
        if (unidadVolumen) geometriaActual.unidad_volumen = unidadVolumen.clave;
      }

      const { error: errorSupabase } = await supabase
        .from("items")
        .update({ geometria_fisica: geometriaActual })
        .eq("id", itemId);

      if (errorSupabase) {
        console.error("[EditorGeometriaItem] error guardando geometría:", errorSupabase);
        setError("No se pudo guardar. Intenta de nuevo.");
        setVolumenTexto(typeof volumenGuardado === "number" ? String(volumenGuardado) : "");
        return;
      }
      onGuardado?.();
    } finally {
      setGuardando(false);
    }
  }

  const estado = volumenComparacion?.estado;

  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-primary">Volumen declarado</h3>
        <p className="mt-1 text-xs text-primary/45">
          Causa geométrica del objeto — el motor la compara contra el volumen que deriva de materiales y estructura.
        </p>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-primary/50">Volumen</span>
          <input
            className="w-full rounded-lg border border-primary/15 bg-transparent px-2.5 py-1.5 text-sm text-primary"
            min={0}
            placeholder="Sin declarar"
            step="any"
            type="number"
            value={volumenTexto}
            onChange={(e) => setVolumenTexto(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <span className="pb-2 text-xs text-primary/40">
          {loadingUnidad ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            unidadVolumen?.simbolo ?? "—"
          )}
        </span>
        {guardando && <Loader2 className="mb-2 h-3.5 w-3.5 shrink-0 animate-spin text-primary/40" />}
      </div>

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}

      {/* Veredicto del motor — solo lectura, nunca reinterpretado. */}
      {estado && (
        <div className="mt-3 rounded-lg border border-primary/10 px-3 py-2">
          <p className="text-xs text-primary/60">
            {ESTADO_COMPARACION_LABEL[estado] ?? estado}
          </p>
          {estado === "requiere_tolerancia" && (
            <div className="mt-1.5 flex gap-4 text-xs text-primary/40">
              <span>Diferencia: {formatNumero(volumenComparacion?.diferencia_si)}</span>
              <span>
                Relativa:{" "}
                {volumenComparacion?.diferencia_relativa != null
                  ? `${(volumenComparacion.diferencia_relativa * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EditorGeometriaItem;

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
 *
 * Diseño: minimalista, sin tarjeta con fondo/borde propio — mismo criterio
 * que PanelFisicaObjeto (el contorno vive en el contenedor exterior de
 * EditorItem, no en cada sub-sección). El input usa solo un subrayado en
 * vez de una caja completa, y el veredicto del motor es una línea de texto
 * en vez de una tarjeta anidada.
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
    <section className="flex flex-col gap-1.5">
      <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
        Volumen declarado
      </span>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          <input
            className="w-20 bg-transparent px-0 py-1 text-sm font-black text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={volumenTexto}
            onChange={(e) => setVolumenTexto(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <span className="text-micro font-bold text-primary/35">
            {loadingUnidad ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              unidadVolumen?.simbolo ?? "—"
            )}
          </span>
        </label>
        {guardando && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary/40" />}
      </div>

      {error && <p className="text-micro text-red-500">{error}</p>}

      {/* Veredicto del motor — solo lectura, nunca reinterpretado. Línea de
          texto sin tarjeta anidada. */}
      {estado && (
        <div className="text-micro text-primary/45">
          <p>{ESTADO_COMPARACION_LABEL[estado] ?? estado}</p>
          {estado === "requiere_tolerancia" && (
            <div className="mt-0.5 flex gap-3 text-primary/35">
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
    </section>
  );
}

export default EditorGeometriaItem;

"use client";

/**
 * useCompuestosConElementos.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Fase 2 del rediseño 1.0 — Compuestos.
 *
 * Reemplaza a useCompuestos() como fuente de lectura del catálogo: en vez
 * de confiar en compuestos.componentes (jsonb, ahora @deprecated), trae
 * compuesto_elementos (tabla relacional normalizada, ver migración
 * fase2_1_compuesto_elementos) y RECONSTRUYE el campo componentes con esos
 * datos antes de devolver cada Compuesto.
 *
 * Por qué reconstruir en vez de reescribir afinidad.ts:
 * afinidad.ts tiene 21+ funciones que leen compuesto.componentes
 * directamente (calcularPerfilAtomico, calcularPeso, calcularReactividad,
 * combinarComponentes, calcularEstequiometriaExacta, etc.), varias de las
 * cuales además se auto-construyen objetos Compuesto temporales solo para
 * reusar esa lógica (ver calcularCancelacionCargaElementos y hermanas).
 * Tocar cada función individualmente es 21 puntos de riesgo. Reconstruir
 * "componentes" en el punto de carga es 1 punto de riesgo, y dado que la
 * migración fase2_1 verificó 226/226 filas exactas, el resultado es
 * idéntico al que había en el jsonb — afinidad.ts no necesita saber que
 * la fuente cambió.
 *
 * componentes (jsonb) NO se toca ni se lee más desde acá — queda como
 * respaldo crudo en Supabase hasta que se confirme el rollout completo.
 * Las mutaciones de composición (agregar/quitar elemento de un compuesto)
 * deben escribir en compuesto_elementos, no en la columna jsonb — ver
 * useCompuestoElementosMutations más abajo.
 */

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { useCompuestos } from "./useCompuestos";
import {
  CONFIG_COMPUESTO_ELEMENTOS,
  type Compuesto,
  type CompuestoElementoRow,
  type ComponenteCompuesto,
} from "./types";

export function useCompuestosConElementos() {
  const { items: compuestosBase, setItems: setCompuestosBase, loading: loadingBase } = useCompuestos();
  const [filas, setFilas] = useState<CompuestoElementoRow[]>([]);
  const [loadingFilas, setLoadingFilas] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoadingFilas(true);
      const { data, error } = await supabase
        .from(CONFIG_COMPUESTO_ELEMENTOS.tabla)
        .select(CONFIG_COMPUESTO_ELEMENTOS.select);
      if (!cancelado) {
        if (error) {
          console.error("[useCompuestosConElementos] error cargando compuesto_elementos:", error);
          setFilas([]);
        } else {
          setFilas((data ?? []) as unknown as CompuestoElementoRow[]);
        }
        setLoadingFilas(false);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  // Índice compuesto_id → componentes[], reconstruido desde la tabla
  // relacional con el mismo shape que antes vivía en el jsonb.
  const componentesPorCompuesto = useMemo(() => {
    const mapa = new Map<string, ComponenteCompuesto[]>();
    for (const fila of filas) {
      const lista = mapa.get(fila.compuesto_id) ?? [];
      lista.push({ elemento_id: fila.elemento_id, cantidad: fila.cantidad });
      mapa.set(fila.compuesto_id, lista);
    }
    return mapa;
  }, [filas]);

  const items = useMemo<Compuesto[]>(() => {
    return compuestosBase.map((c) => ({
      ...c,
      componentes: componentesPorCompuesto.get(c.id) ?? [],
    }));
  }, [compuestosBase, componentesPorCompuesto]);

  return {
    items,
    setItems: setCompuestosBase,
    loading: loadingBase || loadingFilas,
  };
}

// ─── Mutaciones de composición ─────────────────────────────────────────────
// Reemplazan a "actualizar compuestos.componentes (jsonb)" — a partir de
// Fase 2, agregar/quitar/editar un elemento de un compuesto escribe en
// compuesto_elementos. El caller es responsable de refrescar su copia
// local de componentes (ej. releyendo con useCompuestosConElementos, o
// actualizando el estado local igual que antes).

export async function agregarElementoACompuesto(
  compuestoId: string,
  elementoId: string,
  cantidad: number,
) {
  const { error } = await supabase.from(CONFIG_COMPUESTO_ELEMENTOS.tabla).upsert(
    { compuesto_id: compuestoId, elemento_id: elementoId, cantidad },
    { onConflict: "compuesto_id,elemento_id" },
  );
  if (error) console.error("[agregarElementoACompuesto] error:", error);
  return !error;
}

export async function quitarElementoDeCompuesto(compuestoId: string, elementoId: string) {
  const { error } = await supabase
    .from(CONFIG_COMPUESTO_ELEMENTOS.tabla)
    .delete()
    .eq("compuesto_id", compuestoId)
    .eq("elemento_id", elementoId);
  if (error) console.error("[quitarElementoDeCompuesto] error:", error);
  return !error;
}

export async function actualizarCantidadElemento(
  compuestoId: string,
  elementoId: string,
  cantidad: number,
) {
  const { error } = await supabase
    .from(CONFIG_COMPUESTO_ELEMENTOS.tabla)
    .update({ cantidad })
    .eq("compuesto_id", compuestoId)
    .eq("elemento_id", elementoId);
  if (error) console.error("[actualizarCantidadElemento] error:", error);
  return !error;
}

/**
 * Reemplaza el set COMPLETO de componentes de un compuesto por el nuevo,
 * calculando el diff (agregar / actualizar cantidad / quitar) en vez de
 * borrar-todo-e-insertar — evita destruir y recrear filas (y su id) por
 * cada guardado, que es como se comportaba antes al pisar el jsonb entero.
 * Usado por CompuestoEditor.persist() cada vez que cambia local.componentes
 * (autocompletar, agregar elemento a mano, editar cantidad, quitar, etc.).
 */
export async function sincronizarComponentesCompuesto(
  compuestoId: string,
  nuevosComponentes: ComponenteCompuesto[],
): Promise<boolean> {
  const { data: actuales, error: errorLectura } = await supabase
    .from(CONFIG_COMPUESTO_ELEMENTOS.tabla)
    .select("elemento_id, cantidad")
    .eq("compuesto_id", compuestoId);

  if (errorLectura) {
    console.error("[sincronizarComponentesCompuesto] error leyendo estado actual:", errorLectura);
    return false;
  }

  const actualesPorElemento = new Map((actuales ?? []).map((r) => [r.elemento_id, r.cantidad]));
  const nuevosPorElemento = new Map(nuevosComponentes.map((c) => [c.elemento_id, c.cantidad]));

  const aQuitar = [...actualesPorElemento.keys()].filter((id) => !nuevosPorElemento.has(id));
  const aUpsertear = nuevosComponentes.filter(
    (c) => actualesPorElemento.get(c.elemento_id) !== c.cantidad,
  );

  if (aQuitar.length > 0) {
    const { error } = await supabase
      .from(CONFIG_COMPUESTO_ELEMENTOS.tabla)
      .delete()
      .eq("compuesto_id", compuestoId)
      .in("elemento_id", aQuitar);
    if (error) {
      console.error("[sincronizarComponentesCompuesto] error quitando:", error);
      return false;
    }
  }

  if (aUpsertear.length > 0) {
    const { error } = await supabase.from(CONFIG_COMPUESTO_ELEMENTOS.tabla).upsert(
      aUpsertear.map((c) => ({
        compuesto_id: compuestoId,
        elemento_id: c.elemento_id,
        cantidad: c.cantidad,
      })),
      { onConflict: "compuesto_id,elemento_id" },
    );
    if (error) {
      console.error("[sincronizarComponentesCompuesto] error upserteando:", error);
      return false;
    }
  }

  return true;
}

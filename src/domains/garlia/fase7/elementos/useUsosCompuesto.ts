"use client";

/**
 * useUsosCompuesto.ts
 * ───────────────────────────────────────────────────────────────────────────
 * FASE 7 — reescrito por completo. Trae, de una sola pasada, quién usa cada
 * Compuesto del catálogo — para mostrar debajo de la fórmula de elementos en
 * CompuestoEditor "Usado en: Item X, Mineral Y, Flora Z". Mismo espíritu que
 * "Usado en compuestos" dentro del panel de Elemento (ElementoEditor), pero
 * un nivel más arriba: acá el compuesto es el que se busca, y lo que se
 * encuentra son las entidades (Item/Mineral/Flora) que lo referencian.
 *
 * La versión anterior leía columnas legadas por entidad (compuesto_id,
 * componentes[]/composicion[] JSONB) y una tabla "grupos_compuestos" que ya
 * no existe (reemplazada por "formaciones"/"organos" hace varias fases) —
 * estaba efectivamente rota antes de esta reescritura (incluso leía
 * items.composicion, columna que nunca existió). Ahora todo se resuelve
 * desde una sola fuente: estructura_componentes.
 *
 * Un Compuesto puede alcanzarse desde una entidad por DOS caminos distintos,
 * ambos vía estructura_componentes:
 *   1. Directo:    padre_tipo=<item|mineral|planta>, hijo_tipo='compuesto'
 *                  (reemplaza compuesto_id/componentes[] legado)
 *   2. Indirecto:  padre_tipo=<item|mineral>, hijo_tipo='formacion' — esa
 *                  Formación tiene su fórmula completa (Veta→Grano→
 *                  Compuesto) resuelta por useFormacionVetas, no acá. Este
 *                  hook es un resumen liviano para el panel de Compuesto,
 *                  así que no atraviesa esa cadena entera; deja la
 *                  Formación como uso documentado y el detalle geológico
 *                  fino para cuando se abra esa Formación en particular.
 *
 * Las Criaturas NO se incluyen como origen de "uso de Compuesto": su perfil
 * atómico (perfiles_atomicos_criatura.componentes) referencia Elementos
 * directamente, no Compuestos (ver ComponenteCompuesto en types.ts — es
 * elemento_id, no compuesto_id).
 *
 * Trae todo de una vez (igual que useCompuestos/useMinerales) en vez de una
 * query por compuesto, para que abrir cada panel de detalle sea instantáneo
 * — el join se arma en memoria.
 */

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

export type TipoUsoCompuesto = "item" | "mineral" | "flora";

export interface UsoCompuesto {
  tipo: TipoUsoCompuesto;
  id: string;
  nombre: string;
  imagen_url?: string | null;
  /** Dónde exactamente aparece el compuesto dentro de esa entidad, para
   *  contexto (ej. "veta", "hoja", "composición"). Null si es un vínculo
   *  directo sin rol/parte específica. */
  detalle?: string | null;
}

interface EntidadRow {
  id: string;
  nombre: string;
  imagen_url: string | null;
}

/** Fila cruda de estructura_componentes, solo los campos que usa este hook. */
interface VinculoRow {
  padre_tipo: string;
  padre_id: string;
  hijo_tipo: string;
  hijo_id: string;
  rol: string | null;
}

const TIPO_POR_PADRE: Record<string, TipoUsoCompuesto> = {
  item: "item",
  mineral: "mineral",
  planta: "flora",
};

export function useUsosCompuesto() {
  const [items, setItems] = useState<EntidadRow[]>([]);
  const [minerales, setMinerales] = useState<EntidadRow[]>([]);
  const [flora, setFlora] = useState<EntidadRow[]>([]);
  const [vinculos, setVinculos] = useState<VinculoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoading(true);
      const [
        { data: itemsData },
        { data: mineralesData },
        { data: floraData },
        { data: vinculosData },
      ] = await Promise.all([
        supabase.from("items").select("id, nombre, imagen_url"),
        supabase.from("minerales").select("id, nombre, imagen_url"),
        supabase.from("flora").select("id, nombre, imagen_url"),
        supabase
          .from("estructura_componentes")
          .select("padre_tipo, padre_id, hijo_tipo, hijo_id, rol")
          .eq("hijo_tipo", "compuesto"),
      ]);

      if (cancelado) return;
      setItems((itemsData as EntidadRow[]) ?? []);
      setMinerales((mineralesData as EntidadRow[]) ?? []);
      setFlora((floraData as EntidadRow[]) ?? []);
      setVinculos((vinculosData as VinculoRow[]) ?? []);
      setLoading(false);
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  /** Mapa compuesto_id → usos, calculado una sola vez para todo el catálogo. */
  const usosPorCompuesto = useMemo(() => {
    const mapa = new Map<string, UsoCompuesto[]>();
    const entidadesPorTipo: Record<TipoUsoCompuesto, Map<string, EntidadRow>> = {
      item: new Map(items.map((e) => [e.id, e])),
      mineral: new Map(minerales.map((e) => [e.id, e])),
      flora: new Map(flora.map((e) => [e.id, e])),
    };

    function agregar(compuestoId: string, uso: UsoCompuesto) {
      const lista = mapa.get(compuestoId) ?? [];
      // Evita duplicar la misma entidad+detalle si aparece dos veces
      // (no debería pasar con hijo_tipo='compuesto' fijo, pero es gratis).
      if (lista.some((u) => u.tipo === uso.tipo && u.id === uso.id && u.detalle === uso.detalle)) {
        return;
      }
      mapa.set(compuestoId, [...lista, uso]);
    }

    // Vínculos directos: padre_tipo en (item, mineral, planta), hijo_tipo
    // ya viene filtrado a 'compuesto' desde la query.
    for (const v of vinculos) {
      const tipo = TIPO_POR_PADRE[v.padre_tipo];
      if (!tipo) continue;
      const entidad = entidadesPorTipo[tipo].get(v.padre_id);
      if (!entidad) continue;
      agregar(v.hijo_id, {
        tipo,
        id: entidad.id,
        nombre: entidad.nombre,
        imagen_url: entidad.imagen_url,
        detalle: v.rol || null,
      });
    }

    return mapa;
  }, [items, minerales, flora, vinculos]);

  return { usosPorCompuesto, loading };
}

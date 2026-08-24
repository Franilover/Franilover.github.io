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

import { useMemo } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";

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
  // Fase 8: pasa por useSupabaseData → cache offline en Dexie (items ya
  // cacheaba desde antes; minerales/flora y estructura_componentes recién
  // entran a Dexie en v35/v36 — ver infra/supabase/db.ts).
  const { data: items, loading: loadingItems } = useSupabaseData<EntidadRow>(
    "items",
    { select: "id, nombre, imagen_url" },
  );
  const { data: minerales, loading: loadingMinerales } = useSupabaseData<EntidadRow>(
    "minerales",
    { select: "id, nombre, imagen_url" },
  );
  const { data: flora, loading: loadingFlora } = useSupabaseData<EntidadRow>(
    "flora",
    { select: "id, nombre, imagen_url" },
  );
  const { data: vinculosCrudos, loading: loadingVinculos } = useSupabaseData<VinculoRow>(
    "estructura_componentes",
    { select: "padre_tipo, padre_id, hijo_tipo, hijo_id, rol" },
  );

  // useSupabaseData no soporta filtrar server-side por hijo_tipo aquí (el
  // select es fijo por tabla, y estructura_componentes se comparte con
  // useFormacionVetas/useMineralFormacionesProcesos con otros filtros) —
  // se filtra en memoria, barato dado el tamaño de la tabla.
  const vinculos = useMemo(
    () => vinculosCrudos.filter((v) => v.hijo_tipo === "compuesto"),
    [vinculosCrudos],
  );

  const loading = loadingItems || loadingMinerales || loadingFlora || loadingVinculos;

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

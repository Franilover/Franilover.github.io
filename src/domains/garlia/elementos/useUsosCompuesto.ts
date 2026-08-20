"use client";

/**
 * useUsosCompuesto.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Trae, de una sola pasada, quién usa cada Compuesto del catálogo — para
 * mostrar debajo de la fórmula de elementos en CompuestoEditor "Usado en:
 * Item X, Mineral Y, Flora Z". Mismo espíritu que "Usado en compuestos"
 * dentro del panel de Elemento (ElementoEditor), pero un nivel más arriba:
 * acá el compuesto es el que se busca, y lo que se encuentra son las
 * entidades (Item/Mineral/Flora) que lo referencian.
 *
 * Fuentes revisadas por cada tipo de entidad (todas las formas en que un
 * compuesto puede estar referenciado en el catálogo):
 *   - Item:    compuesto_id (legado) + composicion[].compuesto_id
 *   - Mineral: compuesto_id (legado) + componentes[].compuesto_id (legado)
 *              + mineral_formaciones.componentes[].compuesto_id
 *   - Flora:   compuesto_id (legado) + componentes[].compuesto_id (legado)
 *              + planta_organos.componentes[].compuesto_id
 *              + planta_organos.compuesto_base_id
 *
 * Las Criaturas NO se incluyen: su perfil atómico (perfiles_atomicos_
 * criatura.componentes) referencia Elementos directamente, no Compuestos
 * (ver ComponenteCompuesto en types.ts — es elemento_id, no compuesto_id).
 *
 * Trae todo el catálogo de una vez (igual que useCompuestos/useMinerales)
 * en vez de una query por compuesto, para que abrir cada panel de detalle
 * sea instantáneo — el join se arma en memoria.
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
   *  contexto (ej. "veta", "hoja", "composición"). Null si es el
   *  compuesto_id legado plano (sin parte específica). */
  detalle?: string | null;
}

interface ItemRow {
  id: string;
  nombre: string;
  imagen_url: string | null;
  compuesto_id: string | null;
  composicion: { compuesto_id: string; tag: string }[] | null;
}

interface MineralRow {
  id: string;
  nombre: string;
  imagen_url: string | null;
  compuesto_id: string | null;
  componentes: { compuesto_id: string; tag: string }[] | null;
}

interface MineralFormacionRow {
  mineral_id: string;
  tipo_formacion: string;
  componentes: { compuesto_id: string; cantidad: number }[] | null;
}

interface FloraRow {
  id: string;
  nombre: string;
  imagen_url: string | null;
  compuesto_id: string | null;
  componentes: { compuesto_id: string; tag: string }[] | null;
}

interface PlantaOrganoRow {
  planta_id: string;
  tipo_organo: string;
  compuesto_base_id: string | null;
  componentes: { compuesto_id: string; cantidad: number }[] | null;
}

const TIPO_FORMACION_LABEL: Record<string, string> = {
  veta: "Veta",
  inclusion: "Inclusión",
  capa: "Capa",
  nucleo: "Núcleo",
  superficie: "Superficie",
  cristal: "Cristal",
  otro: "Formación",
};

const TIPO_ORGANO_LABEL: Record<string, string> = {
  hoja: "Hoja",
  petalo: "Pétalo",
  raiz: "Raíz",
  fruto: "Fruto",
  tallo: "Tallo",
  semilla: "Semilla",
  corteza: "Corteza",
  otro: "Órgano",
};

export function useUsosCompuesto() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [minerales, setMinerales] = useState<MineralRow[]>([]);
  const [mineralFormaciones, setMineralFormaciones] = useState<
    (MineralFormacionRow & { mineral: { id: string; nombre: string; imagen_url: string | null } | null })[]
  >([]);
  const [flora, setFlora] = useState<FloraRow[]>([]);
  const [plantaOrganos, setPlantaOrganos] = useState<
    (PlantaOrganoRow & { planta: { id: string; nombre: string; imagen_url: string | null } | null })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoading(true);
      const [
        { data: itemsData },
        { data: mineralesData },
        { data: floraData },
        { data: formacionesData },
        { data: organosData },
      ] = await Promise.all([
        supabase.from("items").select("id, nombre, imagen_url, compuesto_id, composicion"),
        supabase.from("minerales").select("id, nombre, imagen_url, compuesto_id, componentes"),
        supabase.from("flora").select("id, nombre, imagen_url, compuesto_id, componentes"),
        supabase
          .from("mineral_formaciones")
          .select("mineral_id, tipo_formacion, componentes, minerales(id, nombre, imagen_url)"),
        supabase
          .from("planta_organos")
          .select("planta_id, tipo_organo, compuesto_base_id, componentes, flora(id, nombre, imagen_url)"),
      ]);

      if (cancelado) return;
      setItems((itemsData as ItemRow[]) ?? []);
      setMinerales((mineralesData as MineralRow[]) ?? []);
      setFlora((floraData as FloraRow[]) ?? []);
      setMineralFormaciones(
        ((formacionesData as unknown[]) ?? []).map((f) => {
          const row = f as MineralFormacionRow & {
            minerales: { id: string; nombre: string; imagen_url: string | null } | null;
          };
          return { ...row, mineral: row.minerales };
        }),
      );
      setPlantaOrganos(
        ((organosData as unknown[]) ?? []).map((o) => {
          const row = o as PlantaOrganoRow & {
            flora: { id: string; nombre: string; imagen_url: string | null } | null;
          };
          return { ...row, planta: row.flora };
        }),
      );
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

    function agregar(compuestoId: string | null | undefined, uso: UsoCompuesto) {
      if (!compuestoId) return;
      const lista = mapa.get(compuestoId) ?? [];
      // Evita duplicar la misma entidad+detalle si aparece por dos caminos
      // (ej. compuesto_id legado Y composicion[] apuntando al mismo).
      if (lista.some((u) => u.tipo === uso.tipo && u.id === uso.id && u.detalle === uso.detalle)) {
        mapa.set(compuestoId, lista);
        return;
      }
      mapa.set(compuestoId, [...lista, uso]);
    }

    for (const item of items) {
      agregar(item.compuesto_id, {
        tipo: "item",
        id: item.id,
        nombre: item.nombre,
        imagen_url: item.imagen_url,
      });
      for (const c of item.composicion ?? []) {
        agregar(c.compuesto_id, {
          tipo: "item",
          id: item.id,
          nombre: item.nombre,
          imagen_url: item.imagen_url,
          detalle: c.tag || null,
        });
      }
    }

    for (const mineral of minerales) {
      agregar(mineral.compuesto_id, {
        tipo: "mineral",
        id: mineral.id,
        nombre: mineral.nombre,
        imagen_url: mineral.imagen_url,
      });
      for (const c of mineral.componentes ?? []) {
        agregar(c.compuesto_id, {
          tipo: "mineral",
          id: mineral.id,
          nombre: mineral.nombre,
          imagen_url: mineral.imagen_url,
          detalle: c.tag || null,
        });
      }
    }
    for (const formacion of mineralFormaciones) {
      if (!formacion.mineral) continue;
      for (const c of formacion.componentes ?? []) {
        agregar(c.compuesto_id, {
          tipo: "mineral",
          id: formacion.mineral.id,
          nombre: formacion.mineral.nombre,
          imagen_url: formacion.mineral.imagen_url,
          detalle: TIPO_FORMACION_LABEL[formacion.tipo_formacion] ?? formacion.tipo_formacion,
        });
      }
    }

    for (const planta of flora) {
      agregar(planta.compuesto_id, {
        tipo: "flora",
        id: planta.id,
        nombre: planta.nombre,
        imagen_url: planta.imagen_url,
      });
      for (const c of planta.componentes ?? []) {
        agregar(c.compuesto_id, {
          tipo: "flora",
          id: planta.id,
          nombre: planta.nombre,
          imagen_url: planta.imagen_url,
          detalle: c.tag || null,
        });
      }
    }
    for (const organo of plantaOrganos) {
      if (!organo.planta) continue;
      const etiqueta = TIPO_ORGANO_LABEL[organo.tipo_organo] ?? organo.tipo_organo;
      agregar(organo.compuesto_base_id, {
        tipo: "flora",
        id: organo.planta.id,
        nombre: organo.planta.nombre,
        imagen_url: organo.planta.imagen_url,
        detalle: etiqueta,
      });
      for (const c of organo.componentes ?? []) {
        agregar(c.compuesto_id, {
          tipo: "flora",
          id: organo.planta.id,
          nombre: organo.planta.nombre,
          imagen_url: organo.planta.imagen_url,
          detalle: etiqueta,
        });
      }
    }

    return mapa;
  }, [items, minerales, mineralFormaciones, flora, plantaOrganos]);

  return { usosPorCompuesto, loading };
}

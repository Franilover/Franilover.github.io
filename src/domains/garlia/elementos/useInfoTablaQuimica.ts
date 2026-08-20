"use client";

/**
 * useInfoTablaQuimica
 * ───────────────────────────────────────────────────────────────────────────
 * Contenido editable del modal de info ("Cómo funciona la Tabla Química") en
 * la sección Tabla. Antes era texto hardcodeado en InfoTablaQuimica
 * (ElementosPage.tsx); ahora vive en Supabase como una lista de secciones
 * {titulo, contenido}, editable desde el propio modal.
 *
 * Mismo patrón que useConfigRunas: tabla de una sola fila
 * (`config_info_tabla_quimica`, id fijo "singleton"), CRUD directo a
 * Supabase, sin Dexie/offline-sync porque es una tabla chica y aislada.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

const ID_SINGLETON = "singleton";
const TABLA = "config_info_tabla_quimica";

export interface SeccionInfoTablaQuimica {
  /** Id estable para la key de React / referencias al editar-borrar. */
  id: string;
  titulo: string;
  contenido: string;
}

export interface InfoTablaQuimica {
  id: string;
  secciones: SeccionInfoTablaQuimica[];
}

// Contenido de fábrica: lo que antes estaba hardcodeado en el componente.
// Se usa como default la primera vez que se crea la fila singleton, para no
// perder el texto ya existente al migrar a Supabase.
const SECCIONES_DEFAULT: SeccionInfoTablaQuimica[] = [
  {
    id: "numero-atomico",
    titulo: "Número atómico",
    contenido:
      "Es el total de partículas del elemento. Se reparten en 3 capas de capacidad creciente (2 / 4 / 6). En los elementos #1 y #2, Percepción y Voluntad ocupan temporalmente el núcleo — desde el #3 el núcleo se estabiliza con Masa/Cinética/Equilibrio.",
  },
  {
    id: "capas",
    titulo: "Las 3 capas",
    contenido:
      "Núcleo: Identidad y ancla gravitacional — Masa, Cinética, Equilibrio.\nMedia: Motor energético — Potencial, Información, Ciclo, Entropía.\nExterna: Reactividad y resonancia — Voluntad, Percepción, Transición, Catálisis.",
  },
  {
    id: "estabilidad",
    titulo: "Estabilidad y familias",
    contenido:
      "Capa externa completa → elemento Noble (inerte, raro, resistente a interferencia mágica). Incompleta, la familia depende de la proporción Catálisis/Transición: Rígido (Catálisis domina, enlace fuerte), Intermedio (equilibrados), Reactivo (Transición domina, enlace débil/metaestable) o Inerte (sin Catálisis ni Transición, no enlaza por esta vía).",
  },
  {
    id: "manifestaciones",
    titulo: "Manifestaciones naturales",
    contenido:
      "Cristalio (sólido): núcleo pesado, externa inerte. Fluxio (fluido): núcleo balanceado, externa dinámica. Nebulio (gaseoso): núcleo ligero, externa con Entropía/Transición. Plasmio (energético): externa saturada de Catálisis/Transición, reacciona violento a estímulos.",
  },
];

const INFO_DEFAULT: InfoTablaQuimica = {
  id: ID_SINGLETON,
  secciones: SECCIONES_DEFAULT,
};

export function useInfoTablaQuimica() {
  const [info, setInfo] = useState<InfoTablaQuimica>(INFO_DEFAULT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLA)
      .select("*")
      .eq("id", ID_SINGLETON)
      .maybeSingle();

    if (!error && data) {
      setInfo({
        id: data.id,
        secciones:
          Array.isArray(data.secciones) && data.secciones.length > 0
            ? data.secciones
            : SECCIONES_DEFAULT,
      });
    } else {
      // Primera vez: no existe la fila todavía, la creamos con los defaults.
      await supabase.from(TABLA).insert([INFO_DEFAULT]);
      setInfo(INFO_DEFAULT);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const guardarSecciones = useCallback(
    async (secciones: SeccionInfoTablaQuimica[]) => {
      setInfo((prev) => ({ ...prev, secciones }));
      const { error } = await supabase
        .from(TABLA)
        .update({ secciones })
        .eq("id", ID_SINGLETON);
      if (error) {
        console.error("[useInfoTablaQuimica] error guardando:", error);
        void load();
      }
    },
    [load],
  );

  return { info, loading, guardarSecciones };
}

"use client";

/**
 * useConfigRunas
 * ───────────────────────────────────────────────────────────────────────────
 * Config global y única del sistema de runas: las plantillas de trazo de
 * los 4 separadores (⟩⟩ ⟩ ⟨ |), editables por si el admin quiere
 * redibujarlas distinto a las de fábrica.
 *
 * La forma exterior y la rejilla (secciones × anillos) YA NO viven acá:
 * antes eran una config global única que el admin fijaba para todos los
 * jugadores; ahora cada `CombinacionRuna` define su propia forma+rejilla
 * (ver types.ts y EditorCombinacionesRunas.tsx), porque cada combinación
 * puede necesitar un tablero distinto.
 *
 * Es una tabla de una sola fila (`config_runas`, id fijo "singleton") en vez
 * de una tabla con muchas filas — más simple que modelar un "config activo"
 * entre varios. Igual que useSubsistemasMagia: CRUD directo a Supabase, sin
 * Dexie/offline-sync porque es una tabla chica y aislada.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import type { TipoSeparador } from "./separadores";
import type { Punto } from "./dollarOneRecognizer";

const ID_SINGLETON = "singleton";

export interface ConfigRunas {
  id: string;
  /** Plantillas custom de separador, por tipo — si falta un tipo, se usa el default de separadores.ts. */
  plantillas_separadores: Partial<Record<TipoSeparador, Punto[][]>> | null;
}

const CONFIG_DEFAULT: ConfigRunas = {
  id: ID_SINGLETON,
  plantillas_separadores: null,
};

export function useConfigRunas() {
  const [config, setConfig] = useState<ConfigRunas>(CONFIG_DEFAULT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("config_runas")
      .select("*")
      .eq("id", ID_SINGLETON)
      .maybeSingle();

    if (!error && data) {
      setConfig(data as ConfigRunas);
    } else {
      // Primera vez: no existe la fila todavía, la creamos con los defaults.
      await supabase.from("config_runas").insert([CONFIG_DEFAULT]);
      setConfig(CONFIG_DEFAULT);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const actualizar = useCallback(async (updates: Partial<ConfigRunas>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    const { error } = await supabase
      .from("config_runas")
      .update(updates)
      .eq("id", ID_SINGLETON);
    if (error) void load();
  }, [load]);

  return { config, loading, actualizar };
}

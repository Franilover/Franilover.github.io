"use client";

/**
 * useConfigRunas
 * ───────────────────────────────────────────────────────────────────────────
 * Config global y única del sistema de runas: la rejilla (secciones ×
 * anillos) y forma exterior que el admin define para TODOS los jugadores
 * (antes era un selector libre en la página pública — ver charla de diseño),
 * más las plantillas de trazo de los 4 separadores (⟩⟩ ⟩ ⟨ |), editables
 * por si el admin quiere redibujarlas distinto a las de fábrica.
 *
 * Es una tabla de una sola fila (`config_runas`, id fijo "singleton") en vez
 * de una tabla con muchas filas — más simple que modelar un "config activo"
 * entre varios. Igual que useSubsistemasMagia: CRUD directo a Supabase, sin
 * Dexie/offline-sync porque es una tabla chica y aislada.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { FORMA_CIRCULO, REJILLA_SIMPLE, type FormaLimite, type Rejilla } from "./formasLimite";
import type { TipoSeparador } from "./separadores";
import type { Punto } from "./dollarOneRecognizer";

const ID_SINGLETON = "singleton";

export interface ConfigRunas {
  id: string;
  rejilla: Rejilla;
  forma: FormaLimite;
  /** Plantillas custom de separador, por tipo — si falta un tipo, se usa el default de separadores.ts. */
  plantillas_separadores: Partial<Record<TipoSeparador, Punto[][]>> | null;
}

const CONFIG_DEFAULT: ConfigRunas = {
  id: ID_SINGLETON,
  rejilla: REJILLA_SIMPLE,
  forma: FORMA_CIRCULO,
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

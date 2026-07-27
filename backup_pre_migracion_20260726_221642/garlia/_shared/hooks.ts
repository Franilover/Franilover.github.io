/**
 * hooks.ts
 * ──────────
 * Este archivo alojaba 11 hooks de dominios distintos mezclados (reinos,
 * capítulos, mundo, grupos, personajes). Se partió por dominio:
 *
 *   - 6 hooks eran código muerto sin consumidores y se eliminaron:
 *     useUniqueValues, useCapitulosNarrados, useReinoDetalles,
 *     useCriaturaVariantes, usePersonajesDeEspecie, useGruposComoOpciones.
 *   - useNombresDeTabla       → hooks/misc/useNombresDeTabla.ts
 *   - usePersonajesDelReino   → hooks/personajes/usePersonajesDelReino.ts
 *   - useMundoSecciones       → hooks/mundo/useMundoSecciones.ts
 *   - useMembresiaGruposCriatura (+ GrupoMin) → hooks/grupos/useMembresiaGruposCriatura.ts
 *
 * Queda acá SOLO `useReinos`, a propósito: es una de las 3 implementaciones
 * duplicadas de "traer reinos" del proyecto (las otras viven en
 * `editorCapitulos/hooks/hooks.ts` (ahora hermano de components/, no anidado) y en
 * `hooks/ciudades/useCiudadCatalogos.ts`, que a su vez delega en
 * `syncEngine.loadReinos`). Unificar esas 3 en un solo hook es un paso aparte
 * pendiente — no se mezcló con esta reorganización para no arriesgar los dos
 * trabajos a la vez.
 *
 * Ruta: src/features/editorGarlia/hooks/hooks.ts
 */

import { useState, useEffect } from "react";

import { supabase } from "@/lib/api/client/supabase";
import { dexieReadAll as dexieRead } from "@/lib/utils/dexieHelpers";

// ─── useReinos ────────────────────────────────────────────────────────────────
// Trae TODOS los reinos (sin filtrar por oculto) para uso interno del editor.

export function useReinos() {
  const [reinos, setReinos] = useState<
    { id: string; nombre: string; oculto?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // 1. Caché local Dexie primero
      const local = await dexieRead<{
        id: string;
        nombre: string;
        oculto?: boolean;
      }>("reinos");
      if (local.length && !cancelled) {
        setReinos(local);
        setLoading(false);
      }
      if (!navigator.onLine) {
        if (!local.length) setLoading(false);
        return;
      }

      // 2. Fetch remoto — SIN filtrar por oculto para ver todos los reinos
      try {
        const { data } = await supabase
          .from("reinos")
          .select("id, nombre, oculto")
          .order("nombre");
        if (!data || cancelled) return;
        setReinos(data);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { reinos, loading };
}

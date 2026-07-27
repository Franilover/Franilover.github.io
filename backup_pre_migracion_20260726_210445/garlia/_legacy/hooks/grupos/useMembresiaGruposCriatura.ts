/**
 * useMembresiaGruposCriatura.ts
 * ───────────────────────────────
 * Dado el ID de una criatura, devuelve todos los grupos (tipo "criaturas")
 * que la tienen como miembro, y permite añadirla/quitarla de un grupo por
 * nombre.
 *
 * NOTA: este hook se llamaba antes `useGruposDeCriatura` — ese nombre
 * colisionaba con `hooks/grupos/useGruposDeCriatura.ts`, que resuelve grupos
 * a partir de un nombre de especie (solo lectura) y es una función
 * completamente distinta pese al nombre idéntico. Este hook, en cambio,
 * opera por ID de criatura y expone mutaciones (addToGrupo/removeFromGrupo).
 *
 * Extraído de `hooks/hooks.ts` (archivo cajón-de-sastre con 11 hooks
 * mezclados) al partirlo por dominio.
 *
 * NOTA sobre GrupoMin: existen otras 2 definiciones del mismo nombre en el
 * repo (`components/magia/types.ts` y `hooks/grupos/useGruposDelPersonaje.ts`),
 * con formas ligeramente distintas. No se unificaron en este paso para no
 * arriesgar una migración más grande — queda pendiente como su propio barrido.
 *
 * Ruta: src/features/editorGarlia/hooks/grupos/useMembresiaGruposCriatura.ts
 */

import { useState, useEffect, useCallback } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

import { type GrupoTipo } from "./useGrupos";

export type GrupoMin = {
  id: string;
  nombre: string;
  tipo: GrupoTipo;
  subtipo?: string | null;
  miembro_ids: string[];
};

export function useMembresiaGruposCriatura(criaturaId: string) {
  const [grupos, setGrupos] = useState<GrupoMin[]>([]);
  const [todosGrupos, setTodosGrupos] = useState<GrupoMin[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!criaturaId) return;
    setLoading(true);

    if (!navigator.onLine) {
      try {
        if (db && (db as any).grupos_mundo) {
          const all = (await (db as any).grupos_mundo.toArray()) as GrupoMin[];
          const deCriaturas = all.filter((g) => g.tipo === "criaturas");
          setTodosGrupos(deCriaturas);
          setGrupos(
            deCriaturas.filter((g) =>
              (g.miembro_ids ?? []).includes(criaturaId),
            ),
          );
        }
      } catch {}
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from("grupos_mundo")
        .select("id, nombre, tipo, subtipo, miembro_ids")
        .eq("tipo", "criaturas")
        .order("nombre");
      const todos = (data ?? []) as GrupoMin[];
      setTodosGrupos(todos);
      setGrupos(
        todos.filter((g) => (g.miembro_ids ?? []).includes(criaturaId)),
      );
    } catch {}
    setLoading(false);
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Añadir la criatura a un grupo por ID de grupo
  const addToGrupo = useCallback(
    async (grupoId: string) => {
      const grupo = todosGrupos.find((g) => g.id === grupoId);
      if (!grupo) return;
      if ((grupo.miembro_ids ?? []).includes(criaturaId)) return;

      const nuevosIds = [...(grupo.miembro_ids ?? []), criaturaId];

      // Optimista
      const actualizado = { ...grupo, miembro_ids: nuevosIds };
      setGrupos((prev) => [...prev, actualizado]);
      setTodosGrupos((prev) =>
        prev.map((g) => (g.id === grupoId ? actualizado : g)),
      );

      await supabase
        .from("grupos_mundo")
        .update({ miembro_ids: nuevosIds })
        .eq("id", grupoId);

      try {
        if (db) await (db as any).grupos_mundo?.put(actualizado);
      } catch {}
    },
    [criaturaId, todosGrupos],
  );

  // Quitar la criatura de un grupo
  const removeFromGrupo = useCallback(
    async (grupoId: string) => {
      const grupo = todosGrupos.find((g) => g.id === grupoId);
      if (!grupo) return;

      const nuevosIds = (grupo.miembro_ids ?? []).filter(
        (id) => id !== criaturaId,
      );

      // Optimista
      const actualizado = { ...grupo, miembro_ids: nuevosIds };
      setGrupos((prev) => prev.filter((g) => g.id !== grupoId));
      setTodosGrupos((prev) =>
        prev.map((g) => (g.id === grupoId ? actualizado : g)),
      );

      await supabase
        .from("grupos_mundo")
        .update({ miembro_ids: nuevosIds })
        .eq("id", grupoId);

      try {
        if (db) await (db as any).grupos_mundo?.put(actualizado);
      } catch {}
    },
    [criaturaId, todosGrupos],
  );

  return {
    grupos,
    todosGrupos,
    loading,
    addToGrupo,
    removeFromGrupo,
    reload: load,
  };
}

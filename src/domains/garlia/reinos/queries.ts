import { supabase } from "@/infra/supabase/supabase";

import { type Reino, type ReinoMin } from "./types";

// Todas las queries de supabase.from("reinos") / tablas de relación propias
// de reinos, extraídas de:
//   - _legacy/hooks/reinos/useReinosMin.ts
//   - _legacy/views/EditorReino.tsx
//   - _legacy/components/shared/LoreTab.tsx (secciones criatura_reinos)
// Antes vivían sueltas en cada hook/vista; acá quedan centralizadas, igual
// que domains/garlia/personajes/queries.ts.
export const reinosQueries = {
  listMin: async (): Promise<ReinoMin[]> => {
    const { data } = await supabase
      .from("reinos")
      .select("id, nombre")
      .order("nombre");
    return data ?? [];
  },

  update: async (id: string, form: Reino) => {
    const { error } = await supabase
      .from("reinos")
      .update({
        nombre: form.nombre,
        historia: form.historia,
        politica: form.politica,
        economia: form.economia,
        geografia: form.geografia,
        cultura: form.cultura,
        mapa_url: form.mapa_url,
        coord_x: form.coord_x,
        coord_y: form.coord_y,
      })
      .eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("reinos").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── Relación criaturas ↔ reino (tabla criatura_reinos) ──────────────────
  getCriaturasVinculadas: async (reinoId: string) => {
    const { data } = await supabase
      .from("criatura_reinos")
      .select("id, criatura_id, criaturas!criatura_id(id, nombre, imagen_url)")
      .eq("reino_id", reinoId);
    return data ?? [];
  },

  addCriaturaVinculada: async (reinoId: string, criaturaId: string) => {
    const { data, error } = await supabase
      .from("criatura_reinos")
      .insert([{ reino_id: reinoId, criatura_id: criaturaId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  removeCriaturaVinculada: async (rowId: string) => {
    const { error } = await supabase
      .from("criatura_reinos")
      .delete()
      .eq("id", rowId);
    if (error) throw error;
  },
};

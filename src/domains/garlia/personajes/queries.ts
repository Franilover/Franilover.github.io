import { supabase } from "@/infra/supabase/supabase";
import type { Inserts, PersonajeFull, Updates } from "@/lib/types/queries";
import { personajeFullQuery } from "@/lib/types/queries";

export const personajesQueries = {
  getAll: async (
    orden: { campo: string; asc: boolean } = { campo: "nombre", asc: true },
  ): Promise<PersonajeFull[]> => {
    const { data, error } = await personajeFullQuery().order(
      orden.campo as any,
      { ascending: orden.asc },
    );
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string): Promise<PersonajeFull | null> => {
    const { data, error } = await personajeFullQuery().eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Personajes cuyo campo `reino` (texto libre, no id) matchea `reinoNombre`.
   * Extraído de usePersonajesDelReino.ts, donde vivía como un supabase.from
   * suelto dentro del hook — la data-fetching va acá, el hook solo orquesta
   * estado + cache.
   */
  getByReinoNombre: async (reinoNombre: string) => {
    const { data, error } = await supabase
      .from("personajes")
      .select("id, nombre, img_url, img_cuerpo_url, especie, reino, sobre")
      .ilike("reino", `%${reinoNombre}%`)
      .order("nombre");
    if (error) throw error;
    return data || [];
  },

  create: async (nuevo: Inserts<"personajes">) => {
    const { data, error } = await supabase
      .from("personajes")
      .insert(nuevo)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, cambios: Updates<"personajes">) => {
    const { data, error } = await supabase
      .from("personajes")
      .update(cambios)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("personajes").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};

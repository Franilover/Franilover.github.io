import { supabase } from "@/lib/api/client/supabase";

import { type Ciudad, type CiudadMin } from "./model";

// Todas las queries de supabase.from("ciudades") / relaciones propias de
// ciudades, extraídas de:
//   - _legacy/hooks/ciudades/useCiudades.ts (listMin)
//   - _legacy/views/EditorCiudad.tsx (update, delete)
//   - _legacy/components/ciudades/FormularioCiudad.tsx (link/unlink de
//     personajes, criaturas e items a una ciudad)
// Antes vivían sueltas en cada hook/vista; acá quedan centralizadas, igual
// que domains/garlia/reinos/queries.ts.
export const ciudadesQueries = {
  listMin: async (): Promise<CiudadMin[]> => {
    const { data } = await supabase
      .from("ciudades")
      .select("id, nombre, reino_id")
      .order("nombre");
    return (data ?? []).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      reino_id: c.reino_id ?? null,
    }));
  },

  update: async (id: string, form: Ciudad) => {
    const { error } = await supabase
      .from("ciudades")
      .update({
        nombre: form.nombre,
        tipo: form.tipo || null,
        descripcion: form.descripcion || null,
        historia: form.historia || null,
        secretos: form.secretos || null,
        imagen_url: form.imagen_url || null,
        reino_id: form.reino_id || null,
      })
      .eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("ciudades").delete().eq("id", id);
    if (error) throw error;
  },

  // ─── Relación personajes ↔ ciudad (columna ciudad_id en personajes) ──────
  linkPersonaje: async (ciudadId: string, personajeId: string) => {
    const { error } = await supabase
      .from("personajes")
      .update({ ciudad_id: ciudadId })
      .eq("id", personajeId);
    if (error) throw error;
  },

  unlinkPersonaje: async (personajeId: string) => {
    const { error } = await supabase
      .from("personajes")
      .update({ ciudad_id: null })
      .eq("id", personajeId);
    if (error) throw error;
  },

  // ─── Relación criaturas ↔ ciudad (columna ciudad_id en criaturas) ────────
  linkCriatura: async (ciudadId: string, criaturaId: string) => {
    const { error } = await supabase
      .from("criaturas")
      .update({ ciudad_id: ciudadId })
      .eq("id", criaturaId);
    if (error) throw error;
  },

  unlinkCriatura: async (criaturaId: string) => {
    const { error } = await supabase
      .from("criaturas")
      .update({ ciudad_id: null })
      .eq("id", criaturaId);
    if (error) throw error;
  },

  // ─── Relación items ↔ ciudad (columna ciudad_id en items) ────────────────
  linkItem: async (ciudadId: string, itemId: string) => {
    const { error } = await supabase
      .from("items")
      .update({ ciudad_id: ciudadId })
      .eq("id", itemId);
    if (error) throw error;
  },

  unlinkItem: async (itemId: string) => {
    const { error } = await supabase
      .from("items")
      .update({ ciudad_id: null })
      .eq("id", itemId);
    if (error) throw error;
  },
};

import { supabase } from "@/infra/supabase/supabase";
import type { Receta, Inserts, Updates } from "@/lib/types/queries";
import { recetaFullQuery } from "@/lib/types/queries";

export const recetasQueries = {
  getAll: async (): Promise<Receta[]> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    // CORREGIDO: Se agregaron los paréntesis ()
    const { data, error } = await recetaFullQuery()
      .eq("autor_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  getById: async (id: string): Promise<Receta | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    // CORREGIDO: Se agregaron los paréntesis ()
    const { data, error } = await recetaFullQuery()
      .eq("id", id)
      .eq("autor_id", user.id)
      .single();
    if (error) throw error;
    return data;
  },

  getByCategoria: async (categoria: string): Promise<Receta[]> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    // CORREGIDO: Se agregaron los paréntesis ()
    const { data, error } = await recetaFullQuery()
      .eq("autor_id", user.id)
      .eq("categoria", categoria)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  search: async (query: string): Promise<Receta[]> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    // CORREGIDO: Se agregaron los paréntesis ()
    const { data, error } = await recetaFullQuery()
      .eq("autor_id", user.id)
      .ilike("nombre", `%${query}%`)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return data;
  },

  create: async (nueva: Inserts<"recetas">): Promise<Receta> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const recetaData = {
      ...nueva,
      autor_id: user.id,
      ingredientes:
        typeof nueva.ingredientes === "string"
          ? nueva.ingredientes
          : JSON.stringify(nueva.ingredientes),
      instrucciones:
        typeof nueva.instrucciones === "string"
          ? nueva.instrucciones
          : JSON.stringify(nueva.instrucciones),
    };

    const { data, error } = await supabase
      .from("recetas")
      .insert(recetaData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Updates<"recetas">): Promise<Receta> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const updateData = {
      ...updates,
      ...(updates.ingredientes && {
        ingredientes:
          typeof updates.ingredientes === "string"
            ? updates.ingredientes
            : JSON.stringify(updates.ingredientes),
      }),
      ...(updates.instrucciones && {
        instrucciones:
          typeof updates.instrucciones === "string"
            ? updates.instrucciones
            : JSON.stringify(updates.instrucciones),
      }),
    };

    const { data, error } = await supabase
      .from("recetas")
      .update(updateData)
      .eq("id", id)
      .eq("autor_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<true> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { error } = await supabase
      .from("recetas")
      .delete()
      .eq("id", id)
      .eq("autor_id", user.id);
    if (error) throw error;
    return true;
  },
};

import { supabase } from "@/infra/supabase/supabase";
import type {
  Ingrediente,
  Inserts,
  Updates} from "@/lib/types/queries";
import {
  ingredienteFullQuery
} from "@/lib/types/queries";

export const ingredientesQueries = {
  getAll: async (
    opciones: { campo?: string; asc?: boolean } = {},
  ): Promise<Ingrediente[]> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    let query = ingredienteFullQuery().eq("user_id", user.id);

    if (opciones.campo) {
      query = query.order(opciones.campo as any, {
        ascending: opciones.asc ?? true,
      });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  getById: async (id: string): Promise<Ingrediente | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data, error } = await ingredienteFullQuery()
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) throw error;
    return data;
  },

  create: async (nuevo: Inserts<"ingredientes">): Promise<Ingrediente> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data, error } = await supabase
      .from("ingredientes")
      .insert({ ...nuevo, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (
    id: string,
    updates: Updates<"ingredientes">,
  ): Promise<Ingrediente> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data, error } = await supabase
      .from("ingredientes")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
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
      .from("ingredientes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return true;
  },
};

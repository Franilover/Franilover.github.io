import { supabase } from "@/infra/supabase/supabase";

export interface CompraRow {
  id:                string;
  created_at:        string;
  ingrediente_id:    string;
  precio_pagado:     number | null;
  cantidad_comprada: string | null;
  lugar_compra:      string | null;
  user_id:           string | null;
}

export type NuevaCompra = Omit<CompraRow, "id" | "created_at">;

export const comprasQueries = {
  getAll: async (): Promise<CompraRow[]> => {
    const { data, error } = await supabase
      .from("compras")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  create: async (compra: NuevaCompra): Promise<CompraRow> => {
    const { data, error } = await supabase
      .from("compras")
      .insert([compra])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Partial<CompraRow>): Promise<CompraRow> => {
    const { data, error } = await supabase
      .from("compras")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("compras")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  deleteAll: async (): Promise<void> => {
    const { error } = await supabase
      .from("compras")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); 
    if (error) throw error;
  },

  deleteByIngrediente: async (ingredienteId: string): Promise<void> => {
    const { error } = await supabase
      .from("compras")
      .delete()
      .eq("ingrediente_id", ingredienteId);
    if (error) throw error;
  },

  deleteByLugar: async (lugar: string): Promise<void> => {
    const { error } = await supabase
      .from("compras")
      .delete()
      .eq("lugar_compra", lugar);
    if (error) throw error;
  },
};
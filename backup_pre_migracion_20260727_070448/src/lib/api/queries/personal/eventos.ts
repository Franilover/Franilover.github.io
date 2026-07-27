import { supabase } from "@/infra/supabase/supabase";
import type { Inserts, Tables } from "@/lib/types/queries";

const USERNAME = "franilover";
export const eventosQueries = {
  getAll: async (): Promise<Tables<'eventos'>[]> => {
    const { data, error } = await supabase
      .from("eventos")
      .select("*")
      .eq("username", USERNAME)
      .order("fecha");
    if (error) throw error;
    return data;
  },
  add: async (evento: Omit<Inserts<'eventos'>, 'username'>) => {
    return await supabase.from("eventos").insert({ ...evento, username: USERNAME }).select().single();
  },
  update: async (id: string, datos: Partial<Omit<Inserts<'eventos'>, 'username'>>) => {
    const { data, error } = await supabase
      .from("eventos")
      .update(datos)
      .eq("id", id)
      .eq("username", USERNAME)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  delete: async (id: string) => {
    const { error } = await supabase
      .from("eventos")
      .delete()
      .eq("id", id)
      .eq("username", USERNAME);
    if (error) throw error;
  }
};
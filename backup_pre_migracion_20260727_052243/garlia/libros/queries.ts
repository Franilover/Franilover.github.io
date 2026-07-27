import { supabase } from "@/lib/api/client/supabase";
import type { LibroFull, Inserts, Updates } from "@/lib/types/queries";
import { libroFullQuery } from "@/lib/types/queries";

export interface Capitulo {
  id: string;
  libro_id: string;
  orden: number;
  titulo_capitulo: string;
  contenido: string;
  fecha_publicacion: string;
  libros?: { titulo: string };
}

export const librosQueries = {
  getAll: async (options: { isAdmin?: boolean; order?: { campo: string; asc: boolean } } = {}): Promise<LibroFull[]> => {
    let query = libroFullQuery();

    if (!options.isAdmin) {
      query = query.eq("visibilidad", "publico");
    }

    if (options.order) {
      query = query.order(options.order.campo as any, { ascending: options.order.asc ?? false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  getById: async (id: string): Promise<LibroFull | null> => {
    const { data, error } = await libroFullQuery().eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  create: async (libro: Inserts<'libros'>) => {
    const { data, error } = await supabase.from("libros").insert(libro).select().single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, cambios: Updates<'libros'>) => {
    const { data, error } = await supabase.from("libros").update(cambios).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("libros").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  getCapituloParaLectura: async (capId: string) => {
    return await supabase
      .from("capitulos")
      .select("*, libros ( titulo )")
      .eq("id", capId)
      .single();
  },

  updateContenido: async (capId: string, contenido: string) => {
    const { data, error } = await supabase
      .from("capitulos")
      .update({ contenido })
      .eq("id", capId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
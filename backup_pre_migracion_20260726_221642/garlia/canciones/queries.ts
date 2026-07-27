// src/lib/api/canciones.ts
import { supabase } from '@/lib/api/client/supabase';
import type { Cancion, Inserts, Updates } from '@/lib/types/queries';

// Factory: crea un builder fresco en cada llamada para evitar que los
// filtros .eq() se acumulen entre invocaciones (causa del bug 406 / PGRST116).
const cancionQuery = () =>
  supabase
    .from('canciones')
    .select(
      `*, personaje:personajes(id, nombre, img_url), secciones:secciones_cancion(*)`
    );

export const cancionesQueries = {
  getAll: async (): Promise<Cancion[]> => {
    const { data, error } = await cancionQuery().order('titulo');
    if (error) throw error;
    return data as Cancion[];
  },

  getById: async (id: string): Promise<Cancion | null> => {
    const { data, error } = await cancionQuery().eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Cancion | null;
  },

  create: async (datos: Inserts<'canciones'>) => {
    const { data, error } = await supabase.from('canciones').insert(datos).select().single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, cambios: Updates<'canciones'>) => {
    const { data, error } = await supabase.from('canciones').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('canciones').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  secciones: {
    create: async (datos: Inserts<'secciones_cancion'>) => {
      const { data, error } = await supabase
        .from('secciones_cancion')
        .insert(datos)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: Updates<'secciones_cancion'>) => {
      const { data, error } = await supabase
        .from('secciones_cancion')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (id: string) => {
      const { error } = await supabase
        .from('secciones_cancion')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    },

    reorder: async (secciones: { id: string; orden: number }[]) => {
      const updates = secciones.map(({ id, orden }) =>
        supabase
          .from('secciones_cancion')
          .update({ orden })
          .eq('id', id)
      );
      await Promise.all(updates);
    },
  },
};
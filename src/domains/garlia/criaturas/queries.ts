import { supabase } from '@/lib/api/client/supabase';
import type { CriaturaFull, Inserts, Updates } from '@/lib/types/queries';
import { criaturaFullQuery } from '@/lib/types/queries';

export const criaturasQueries = {
  getAll: async (opciones: { campo?: string; asc?: boolean } = {}): Promise<CriaturaFull[]> => {
    const { data, error } = await criaturaFullQuery()
      .order(opciones.campo || 'nombre', { ascending: opciones.asc ?? true });
    if (error) throw error;
    return data;
  },

  getById: async (id: string): Promise<CriaturaFull | null> => {
    const { data, error } = await criaturaFullQuery().eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  createVariante: async (variante: Inserts<'criatura_variantes'>) => {
    return await supabase.from('criatura_variantes').insert(variante).select().single();
  },

  updateVariante: async (id: string, updates: Updates<'criatura_variantes'>) => {
    return await supabase.from('criatura_variantes').update(updates).eq('id', id).select().single();
  }
};
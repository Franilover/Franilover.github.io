import { supabase } from '@/infra/supabase/supabase';
import type { Dibujo, Inserts, Updates } from '@/lib/types/queries';
import { dibujoFullQuery } from '@/lib/types/queries';

export const dibujosQueries = {
  getAll: async (): Promise<Dibujo[]> => {
    const { data, error } = await dibujoFullQuery().order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getById: async (id: string): Promise<Dibujo | null> => {
    const { data, error } = await dibujoFullQuery().eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  create: async (dibujo: Inserts<'dibujos'>) => {
    const { data, error } = await supabase.from('dibujos').insert(dibujo).select().single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Updates<'dibujos'>) => {
    const { data, error } = await supabase.from('dibujos').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('dibujos').delete().eq('id', id);
    if (error) throw error;
  }
};
import { supabase } from '@/infra/supabase/supabase';
import type { Reino, Inserts, Updates } from '@/lib/types/queries';
import { reinoFullQuery } from '@/lib/types/queries';

export const reinosQueries = {
  getAll: async (): Promise<Reino[]> => {
    const { data, error } = await reinoFullQuery().order('orden', { ascending: true });
    if (error) throw error;
    return data;
  },

  getById: async (id: string): Promise<Reino | null> => {
    const { data, error } = await reinoFullQuery().eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  create: async (reino: Inserts<'reinos'>) => {
    const { data, error } = await supabase.from('reinos').insert(reino).select().single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Updates<'reinos'>) => {
    const { data, error } = await supabase.from('reinos').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
};
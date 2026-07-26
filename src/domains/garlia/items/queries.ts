import { supabase } from '@/lib/api/client/supabase';
import type { Item, Inserts, Updates } from '@/lib/types/queries';
import { itemFullQuery } from '@/lib/types/queries';

export const itemsQueries = {
  getAll: async (opt: { campo?: string; asc?: boolean } = {}): Promise<Item[]> => {
    let query = itemFullQuery();
    if (opt.campo) {
      query = query.order(opt.campo as any, { ascending: opt.asc ?? true });
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  getById: async (id: string): Promise<Item | null> => {
    const { data, error } = await itemFullQuery().eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  getFilterOptions: async () => {
    const { data, error } = await supabase.from('items').select('categoria');
    if (error) return { data: [], error };
    const unicos = [...new Set(data.map(i => i.categoria))].filter(Boolean).sort();
    return { data: unicos, error: null };
  },

  create: async (item: Inserts<'items'>) => {
    const { data, error } = await supabase.from('items').insert(item).select().single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, cambios: Updates<'items'>) => {
    const { data, error } = await supabase.from('items').update(cambios).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};
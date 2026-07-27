



import { supabase } from '@/infra/supabase/supabase';
import type { Inserts, Tarea } from '@/lib/types/queries';





export const tareasQueries = {
  getAll: async (): Promise<Tarea[]> => {
    const { data, error } = await supabase // Llama directamente a supabase aquí
      .from('tareas')
      .select('*') // O las columnas que necesites
      .order('completada', { ascending: true })
      .order('prioridad', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  toggleCompletada: async (id: string, estadoActual: boolean) => {
    return await supabase
      .from('tareas')
      .update({ completada: !estadoActual })
      .eq('id', id)
      .select()
      .single();
  },

  create: async (tarea: Inserts<'tareas'>) => {
    return await supabase.from('tareas').insert(tarea).select().single();
  },
  
delete: async (id: string) => {
  const { error } = await supabase.from('tareas').delete().eq('id', id);
  if (error) throw error;
  return true;
},
  
};
import { supabase } from "@/infra/supabase/supabase";

export const rutinasQueries = {

  
  getAll: async () => {
    const { data, error } = await supabase
      .from("rutinas")
      .select(`
        id,
        nombre,
        descripcion,
        tag,
        created_at,
        ejercicios_rutina (
          id,
          nombre,
          series,
          reps,
          descanso,
          musculo,
          notas,
          orden
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    
    return (data ?? []).map((r: any) => ({
      ...r,
      ejercicios: [...(r.ejercicios_rutina ?? [])].sort(
        (a: any, b: any) => a.orden - b.orden
      ),
    }));
  },

  
  add: async (rutina: {
    nombre: string;
    descripcion: string;
    tag: string;
  }) => {
    const { data, error } = await supabase
      .from("rutinas")
      .insert([rutina])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  
  delete: async (id: string) => {
    const { error } = await supabase
      .from("rutinas")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  
  update: async (
    id: string,
    campos: Partial<{ nombre: string; descripcion: string; tag: string }>
  ) => {
    const { data, error } = await supabase
      .from("rutinas")
      .update(campos)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const ejerciciosQueries = {

  
  add: async (ejercicio: {
    rutina_id: string;
    nombre: string;
    series: number;
    reps: string;
    descanso: number;
    musculo: string;
    notas?: string;
    orden?: number;
  }) => {
    const { data, error } = await supabase
      .from("ejercicios_rutina")
      .insert([ejercicio])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  
  delete: async (id: string) => {
    const { error } = await supabase
      .from("ejercicios_rutina")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  
  update: async (
    id: string,
    campos: Partial<{
      nombre: string;
      series: number;
      reps: string;
      descanso: number;
      musculo: string;
      notas: string;
      orden: number;
    }>
  ) => {
    const { data, error } = await supabase
      .from("ejercicios_rutina")
      .update(campos)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  
  reemplazar: async (
    rutinaId: string,
    ejercicios: {
      nombre: string;
      series: number;
      reps: string;
      descanso: number;
      musculo: string;
      notas?: string;
      orden: number;
    }[]
  ) => {
    
    const { error: delError } = await supabase
      .from("ejercicios_rutina")
      .delete()
      .eq("rutina_id", rutinaId);

    if (delError) throw delError;

    
    if (ejercicios.length === 0) return [];

    const { data, error } = await supabase
      .from("ejercicios_rutina")
      .insert(ejercicios.map((e) => ({ ...e, rutina_id: rutinaId })))
      .select();

    if (error) throw error;
    return data ?? [];
  },
};
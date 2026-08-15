import type { QueryData } from '@supabase/supabase-js';

import { supabase } from '@/infra/supabase/supabase';

import type { Database } from './supabase';

// --- HELPERS PARA CRUD ---
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

// --- QUERIES MAESTRAS (WIKI/GARLIA) ---
// Cada query es ahora una factory function para que el builder
// se cree fresco en cada llamada y los filtros nunca se acumulen.

export const cancionQuery = () =>
  supabase.from('canciones').select(`
    *,
    personaje:personajes (id, nombre, img_url),
    secciones:secciones_cancion (*)
  `);
export type Cancion = QueryData<ReturnType<typeof cancionQuery>>[number];

export const personajeFullQuery = () =>
  supabase.from('personajes').select(`
    *,
    canciones (id, titulo, portada_url)
  `);
export type PersonajeFull = QueryData<ReturnType<typeof personajeFullQuery>>[number];

export const criaturaFullQuery = () =>
  supabase.from('criaturas').select(`*, variantes:criatura_variantes (*)`);
export type CriaturaFull = QueryData<ReturnType<typeof criaturaFullQuery>>[number];

export const libroFullQuery = () =>
  supabase.from('libros').select(`*, capitulos (*)`);
export type LibroFull = QueryData<ReturnType<typeof libroFullQuery>>[number];

export const rutinaFullQuery = () =>
  supabase.from('rutinas').select(`*, ejercicios:ejercicios_rutina (*)`);
export type RutinaFull = QueryData<ReturnType<typeof rutinaFullQuery>>[number];

// --- DIBUJOS ---
export const dibujoFullQuery = () => supabase.from('dibujos').select('*');
export type Dibujo = QueryData<ReturnType<typeof dibujoFullQuery>>[number];

// --- REINOS ---
export const reinoFullQuery = () => supabase.from('reinos').select('*');
export type Reino = QueryData<ReturnType<typeof reinoFullQuery>>[number];

// --- ÁREAS DEL MAPA (círculo / rectángulo / polígono, vinculadas a reino o ciudad) ---
export const mapAreaFullQuery = () => supabase.from('map_areas').select('*');
export type MapArea = QueryData<ReturnType<typeof mapAreaFullQuery>>[number];

// --- ITEMS ---
export const itemFullQuery = () => supabase.from('items').select('*');
export type Item = QueryData<ReturnType<typeof itemFullQuery>>[number];

// --- EVENTOS ---
export const eventoFullQuery = () => supabase.from('eventos').select('*');
export type Evento = QueryData<ReturnType<typeof eventoFullQuery>>[number];

// --- PERSONAL ---

// Fotos
export const fotoFullQuery = () => supabase.from('fotos').select('*');
export type Foto = QueryData<ReturnType<typeof fotoFullQuery>>[number];

// Ropa (Inventario)
export const ropaFullQuery = () => supabase.from('ropa').select('*');
export type Ropa = QueryData<ReturnType<typeof ropaFullQuery>>[number];

// Tareas (To-Do List)
export const tareaFullQuery = () => supabase.from('tareas').select('*');
export type Tarea = QueryData<ReturnType<typeof tareaFullQuery>>[number];

// --- COCINA ---
export const ingredienteFullQuery = () => supabase.from('ingredientes').select('*');
export type Ingrediente = QueryData<ReturnType<typeof ingredienteFullQuery>>[number];

export const recetaFullQuery = () => supabase.from('recetas').select('*');
export type Receta = QueryData<ReturnType<typeof recetaFullQuery>>[number];

export const compraFullQuery = () => supabase.from('compras').select('*');
export type Compra = QueryData<ReturnType<typeof compraFullQuery>>[number];

export type RecetaCategoria = string;
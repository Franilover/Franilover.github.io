/**
 * useCiudadCatalogos.ts
 * ────────────────────────
 * Hooks de fetching extraídos de EditorCiudad.tsx (antes vivían dentro
 * del archivo de la view, mezclados con el JSX de FormularioCiudad).
 * Lógica copiada tal cual del original — sin cambios de comportamiento.
 *
 * Incluye:
 *   useReinos               → catálogo de reinos (para el selector de la ciudad)
 *   usePersonajesDelCiudad  → personajes vinculados a la ciudad (relación)
 *   useCriaturasDeCiudad    → criaturas vinculadas a la ciudad (relación)
 *   useItemsDelCiudad       → ítems vinculados a la ciudad (relación)
 *   useTodosPersonajes      → catálogo completo de personajes (para buscar/añadir)
 *   useTodasCriaturas       → catálogo completo de criaturas (para buscar/añadir)
 *   useTodosItems           → catálogo completo de ítems (para buscar/añadir)
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/useCiudadCatalogos.ts
 */

import { useCallback, useEffect, useState } from "react";

import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import {
  dexieAll,
  loadReinos,
  loadPersonajesPorCiudad,
  loadCriaturasPorCiudad,
  loadItemsPorCiudad,
  invalidatePersonajesPorCiudad,
  invalidateCriaturasPorCiudad,
  invalidateItemsPorCiudad,
} from "@/lib/api/client/syncEngine";

export type ReinoMin = { id: string; nombre: string };
export type PersonajeMin = { id: string; nombre: string; img_url?: string | null };
export type CriaturaMin = { id: string; nombre: string; imagen_url?: string | null };
export type ItemMin = { id: string; nombre: string; imagen_url?: string | null };

// ─── Hook: reinos ─────────────────────────────────────────────────────────────
export function useReinos() {
  const [reinos, setReinos] = useState<ReinoMin[]>([]);
  useEffect(() => {
    void loadReinos((data) => setReinos(data)).then(setReinos);
  }, []);
  return reinos;
}

// ─── Hook: personajes vinculados a la ciudad ─────────────────────────────────────
export function usePersonajesDelCiudad(ciudadId: string) {
  const [personajes, setPersonajes] = useState<PersonajeMin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadPersonajesPorCiudad(ciudadId, setPersonajes);
    setPersonajes(data);
    setLoading(false);
  }, [ciudadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await invalidatePersonajesPorCiudad(ciudadId);
    await load();
  }, [ciudadId, load]);

  return { personajes, loading, reload };
}

// ─── Hook: criaturas de la ciudad ────────────────────────────────────────────────
export function useCriaturasDeCiudad(ciudadId: string) {
  const [criaturas, setCriaturas] = useState<CriaturaMin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadCriaturasPorCiudad(ciudadId, setCriaturas);
    setCriaturas(data);
    setLoading(false);
  }, [ciudadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await invalidateCriaturasPorCiudad(ciudadId);
    await load();
  }, [ciudadId, load]);

  return { criaturas, loading, reload };
}

// ─── Hook: ítems de la ciudad ────────────────────────────────────────────────────
export function useItemsDelCiudad(ciudadId: string) {
  const [items, setItems] = useState<ItemMin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadItemsPorCiudad(ciudadId, setItems);
    setItems(data);
    setLoading(false);
  }, [ciudadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await invalidateItemsPorCiudad(ciudadId);
    await load();
  }, [ciudadId, load]);

  return { items, loading, reload };
}

// ─── Hook: todos los personajes (para búsqueda) ───────────────────────────────
export function useTodosPersonajes() {
  const [todos, setTodos] = useState<PersonajeMin[]>([]);
  useEffect(() => {
    const run = async () => {
      const local = await dexieAll<any>(db?.personajes);
      if (local.length)
        setTodos(
          local
            .filter((p) => !p.deleted)
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      if (!navigator.onLine) return;
      const { data } = await supabase
        .from("personajes")
        .select("id, nombre, img_url")
        .order("nombre");
      if (data) setTodos(data);
    };
    void run();
  }, []);
  return todos;
}

// ─── Hook: todas las criaturas (para búsqueda) ────────────────────────────────
export function useTodasCriaturas() {
  const [todas, setTodas] = useState<CriaturaMin[]>([]);
  useEffect(() => {
    const run = async () => {
      const local = await dexieAll<any>(db?.criaturas);
      if (local.length)
        setTodas(
          local
            .filter((c) => !c.deleted)
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      if (!navigator.onLine) return;
      const { data } = await supabase
        .from("criaturas")
        .select("id, nombre, imagen_url")
        .order("nombre");
      if (data) setTodas(data);
    };
    void run();
  }, []);
  return todas;
}

// ─── Hook: todos los ítems (para búsqueda) ────────────────────────────────────
export function useTodosItems() {
  const [todos, setTodos] = useState<ItemMin[]>([]);
  useEffect(() => {
    const run = async () => {
      const local = await dexieAll<any>(db?.items);
      if (local.length)
        setTodos(
          local
            .filter((i) => !i.deleted)
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      if (!navigator.onLine) return;
      const { data } = await supabase
        .from("items")
        .select("id, nombre, imagen_url")
        .order("nombre");
      if (data) setTodos(data);
    };
    void run();
  }, []);
  return todos;
}

"use client";

/**
 * useBiologia.ts
 * ───────────────────────────────────────────────────────────────────────────
 * CRUD directo (mismo molde simple que useSubsistemasMagia — sin
 * Dexie/offline-sync) para las tablas del módulo Biología: biomas, clados,
 * ecosistemas, cadenas_alimenticias y perfiles_atomicos_criatura.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import {
  type Bioma,
  type BiomaInput,
  type CadenaAlimenticia,
  type CadenaAlimenticiaInput,
  type Clado,
  type CladoInput,
  type Ecosistema,
  type EcosistemaInput,
  type PerfilAtomicoCriatura,
  type PerfilAtomicoCriaturaInput,
} from "./types";

// ─── Biomas ─────────────────────────────────────────────────────────────────

export function useBiomas() {
  const [biomas, setBiomas] = useState<Bioma[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("biomas")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setBiomas(data as Bioma[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crear = useCallback(async (nombre: string) => {
    setCreating(true);
    const { data, error } = await supabase
      .from("biomas")
      .insert([{ nombre, descripcion: "", afinidad: "", reino_ids: [] }])
      .select()
      .single();
    setCreating(false);
    if (error || !data) return null;
    setBiomas((prev) => [...prev, data as Bioma]);
    return data as Bioma;
  }, []);

  const actualizar = useCallback(
    async (id: string, updates: BiomaInput) => {
      setBiomas((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
      const { error } = await supabase.from("biomas").update(updates).eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminar = useCallback(async (id: string) => {
    // Los ecosistemas que apuntaban a este bioma quedan huérfanos
    // (bioma_id: null) en vez de borrarse en cascada — mismo criterio
    // conservador que el borrado de un Clado intermedio.
    setBiomas((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("ecosistemas").update({ bioma_id: null }).eq("bioma_id", id);
    await supabase.from("biomas").delete().eq("id", id);
  }, []);

  return { biomas, loading, creating, crear, actualizar, eliminar };
}

// ─── Clados (cladograma / árbol filogenético) ──────────────────────────────

export function useClados() {
  const [clados, setClados] = useState<Clado[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clados")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setClados(data as Clado[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crear = useCallback(
    async (nombre: string, padre_id: string | null = null) => {
      setCreating(true);
      const { data, error } = await supabase
        .from("clados")
        .insert([{ nombre, sinapomorfia: "", padre_id, descripcion: "", criatura_ids: [] }])
        .select()
        .single();
      setCreating(false);
      if (error || !data) return null;
      setClados((prev) => [...prev, data as Clado]);
      return data as Clado;
    },
    [],
  );

  const actualizar = useCallback(
    async (id: string, updates: CladoInput) => {
      setClados((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      const { error } = await supabase.from("clados").update(updates).eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminar = useCallback(async (id: string) => {
    // Reasignar hijos directos a raíz (padre_id null) para no dejar el
    // árbol con referencias colgantes, mismo criterio conservador que
    // usaríamos para cualquier borrado de nodo intermedio.
    setClados((prev) =>
      prev
        .filter((c) => c.id !== id)
        .map((c) => (c.padre_id === id ? { ...c, padre_id: null } : c)),
    );
    await supabase.from("clados").update({ padre_id: null }).eq("padre_id", id);
    await supabase.from("clados").delete().eq("id", id);
  }, []);

  return { clados, setClados, loading, creating, crear, actualizar, eliminar };
}

// ─── Ecosistemas ────────────────────────────────────────────────────────────

export function useEcosistemas() {
  const [ecosistemas, setEcosistemas] = useState<Ecosistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ecosistemas")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setEcosistemas(data as Ecosistema[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crear = useCallback(async (nombre: string) => {
    setCreating(true);
    const { data, error } = await supabase
      .from("ecosistemas")
      .insert([
        { nombre, bioma_id: null, clima: "", descripcion: "", criatura_ids: [], flora_ids: [], mineral_ids: [] },
      ])
      .select()
      .single();
    setCreating(false);
    if (error || !data) return null;
    setEcosistemas((prev) => [...prev, data as Ecosistema]);
    return data as Ecosistema;
  }, []);

  const actualizar = useCallback(
    async (id: string, updates: EcosistemaInput) => {
      setEcosistemas((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
      const { error } = await supabase.from("ecosistemas").update(updates).eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminar = useCallback(async (id: string) => {
    setEcosistemas((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("ecosistemas").delete().eq("id", id);
  }, []);

  return { ecosistemas, loading, creating, crear, actualizar, eliminar };
}

// ─── Cadenas alimenticias ───────────────────────────────────────────────────

export function useCadenasAlimenticias() {
  const [cadenas, setCadenas] = useState<CadenaAlimenticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cadenas_alimenticias")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) setCadenas(data as CadenaAlimenticia[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crear = useCallback(async (nombre: string, ecosistema_id: string | null = null) => {
    setCreating(true);
    const { data, error } = await supabase
      .from("cadenas_alimenticias")
      .insert([{ nombre, ecosistema_id, descripcion: "", eslabones: [] }])
      .select()
      .single();
    setCreating(false);
    if (error || !data) return null;
    setCadenas((prev) => [...prev, data as CadenaAlimenticia]);
    return data as CadenaAlimenticia;
  }, []);

  const actualizar = useCallback(
    async (id: string, updates: CadenaAlimenticiaInput) => {
      setCadenas((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
      const { error } = await supabase
        .from("cadenas_alimenticias")
        .update(updates)
        .eq("id", id);
      if (error) void load();
    },
    [load],
  );

  const eliminar = useCallback(async (id: string) => {
    setCadenas((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("cadenas_alimenticias").delete().eq("id", id);
  }, []);

  return { cadenas, loading, creating, crear, actualizar, eliminar };
}

// ─── Perfiles atómicos de criatura ───────────────────────────────────────────

export function usePerfilesAtomicosCriatura() {
  const [perfiles, setPerfiles] = useState<PerfilAtomicoCriatura[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("perfiles_atomicos_criatura")
      .select("*");

    if (!error && data) setPerfiles(data as PerfilAtomicoCriatura[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const obtenerOCrear = useCallback(
    async (criaturaId: string) => {
      const existente = perfiles.find((p) => p.criatura_id === criaturaId);
      if (existente) return existente;

      const { data, error } = await supabase
        .from("perfiles_atomicos_criatura")
        .insert([{ criatura_id: criaturaId, componentes: [], oris_ids: [], rasgos_evolutivos: [], notas: "" }])
        .select()
        .single();
      if (error || !data) return null;
      const nuevo = data as PerfilAtomicoCriatura;
      setPerfiles((prev) => [...prev, nuevo]);
      return nuevo;
    },
    [perfiles],
  );

  const actualizar = useCallback(
    async (id: string, updates: PerfilAtomicoCriaturaInput) => {
      setPerfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      const { error } = await supabase
        .from("perfiles_atomicos_criatura")
        .update(updates)
        .eq("id", id);
      if (error) void load();
    },
    [load],
  );

  return { perfiles, loading, obtenerOCrear, actualizar };
}

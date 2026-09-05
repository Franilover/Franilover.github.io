"use client";

/**
 * useBiologia.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Datos del módulo Biología: biomas, clados, ecosistemas, cadenas_alimenticias
 * y perfiles_atomicos_criatura. Antes cada hook tenía su propio fetch/CRUD
 * directo contra Supabase (sin caché ni offline); ahora todos corren sobre
 * useSupabaseData — mismo patrón que useElementos/useFisica — para que la
 * pestaña Biología cargue al instante desde Dexie al reabrir la app y
 * siga funcionando (lectura y, en las tablas marcadas OFFLINE_WRITABLE,
 * también escritura) sin conexión.
 *
 * La API pública de cada hook (nombres de campos: biomas/clados/
 * ecosistemas/cadenas/perfiles, más crear/actualizar/eliminar/
 * obtenerOCrear) se mantiene igual que antes para no tocar los
 * consumidores (BiologiaPage, CladisticaPage, etc.).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { supabase } from "@/infra/supabase/supabase";

import {
  type Bioma,
  type BiomaInput,
  type CadenaAlimenticia,
  type CadenaAlimenticiaInput,
  type Clado,
  type CladoInput,
  type Ecosistema,
  type EcosistemaCriatura,
  type EcosistemaInput,
  type PerfilAtomicoCriatura,
  type PerfilAtomicoCriaturaInput,
} from "./types";

// ─── Biomas ─────────────────────────────────────────────────────────────────

export function useBiomas() {
  const { data, setData, loading, addRow, updateRow, deleteRow } = useSupabaseData<Bioma>(
    "biomas",
    { order: { campo: "orden" } },
  );

  const biomas = useMemo(() => data, [data]);

  const crear = useCallback(
    async (nombre: string) => {
      const { data: creado } = await addRow({
        nombre,
        descripcion: "",
        afinidad: "",
        reino_ids: [],
      });
      return (creado as Bioma) ?? null;
    },
    [addRow],
  );

  const actualizar = useCallback(
    async (id: string, updates: BiomaInput) => {
      await updateRow(id, updates);
    },
    [updateRow],
  );

  const eliminar = useCallback(
    async (id: string) => {
      // Los ecosistemas que apuntaban a este bioma quedan huérfanos
      // (bioma_id: null) en vez de borrarse en cascada — mismo criterio
      // conservador que el borrado de un Clado intermedio. Esto sigue
      // pegando directo a Supabase (tabla ajena, ecosistemas); su propio
      // hook (useEcosistemas) revalida solo vía realtime/refetch.
      await supabase.from("ecosistemas").update({ bioma_id: null }).eq("bioma_id", id);
      await deleteRow(id);
    },
    [deleteRow],
  );

  return { biomas, setBiomas: setData, loading, creating: false, crear, actualizar, eliminar };
}

// ─── Clados (cladograma / árbol filogenético) ──────────────────────────────

export function useClados() {
  const { data, setData, loading, addRow, updateRow, deleteRow } = useSupabaseData<Clado>(
    "clados",
    { order: { campo: "orden" } },
  );

  const clados = useMemo(() => data, [data]);

  const crear = useCallback(
    async (nombre: string, padre_id: string | null = null) => {
      const { data: creado } = await addRow({
        nombre,
        sinapomorfia: "",
        padre_id,
        descripcion: "",
        criatura_ids: [],
      });
      return (creado as Clado) ?? null;
    },
    [addRow],
  );

  const actualizar = useCallback(
    async (id: string, updates: CladoInput) => {
      await updateRow(id, updates);
    },
    [updateRow],
  );

  const eliminar = useCallback(
    async (id: string) => {
      // Reasignar hijos directos a raíz (padre_id null) para no dejar el
      // árbol con referencias colgantes, mismo criterio conservador que
      // usaríamos para cualquier borrado de nodo intermedio.
      const hijos = data.filter((c) => c.padre_id === id);
      await Promise.all(hijos.map((c) => updateRow(c.id, { padre_id: null })));
      await deleteRow(id);
    },
    [data, updateRow, deleteRow],
  );

  return { clados, setClados: setData, loading, creating: false, crear, actualizar, eliminar };
}

// ─── Ecosistemas ────────────────────────────────────────────────────────────

export function useEcosistemas() {
  const { data, setData, loading, addRow, updateRow, deleteRow } = useSupabaseData<Ecosistema>(
    "ecosistemas",
    { order: { campo: "orden" } },
  );

  const ecosistemas = useMemo(() => data, [data]);

  const crear = useCallback(
    async (nombre: string) => {
      const { data: creado } = await addRow({
        nombre,
        bioma_id: null,
        clima: "",
        descripcion: "",
        flora_ids: [],
        mineral_ids: [],
      });
      return (creado as Ecosistema) ?? null;
    },
    [addRow],
  );

  const actualizar = useCallback(
    async (id: string, updates: EcosistemaInput) => {
      await updateRow(id, updates);
    },
    [updateRow],
  );

  const eliminar = useCallback(
    async (id: string) => {
      await deleteRow(id);
    },
    [deleteRow],
  );

  return {
    ecosistemas,
    setEcosistemas: setData,
    loading,
    creating: false,
    crear,
    actualizar,
    eliminar,
  };
}

// ─── Ecosistema ↔ Criatura (tabla puente, ruta canónica v226) ─────────────
// Reemplaza la antigua ecosistemas.criatura_ids. No usa useSupabaseData (sin
// caché offline por ahora) porque es una tabla puente pura sin PK propia
// simple ni "orden" — se lee/escribe directo contra Supabase, mismo patrón
// que useEntidadesDeCriatura.ts.

export function useEcosistemaCriaturas() {
  // No usa useSupabaseData: esa tabla puente tiene PK compuesta
  // (ecosistema_id, criatura_id), sin columna id/orden — fetch propio.
  const [filas, setData] = useState<EcosistemaCriatura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ecosistema_criaturas")
        .select("ecosistema_id, criatura_id, rol, abundancia");
      if (!cancelado) {
        setData((data as EcosistemaCriatura[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /** Ids de criatura que habitan un ecosistema dado. */
  const criaturaIdsDe = useCallback(
    (ecosistemaId: string) =>
      filas.filter((f) => f.ecosistema_id === ecosistemaId).map((f) => f.criatura_id),
    [filas],
  );

  /** true si alguna fila liga esta criatura a algún ecosistema. */
  const tieneEcosistema = useCallback(
    (criaturaId: string) => filas.some((f) => f.criatura_id === criaturaId),
    [filas],
  );

  /** Liga una criatura a un ecosistema (no-op si ya existe la fila). */
  const asignar = useCallback(
    async (criaturaId: string, ecosistemaId: string) => {
      if (filas.some((f) => f.ecosistema_id === ecosistemaId && f.criatura_id === criaturaId)) {
        return;
      }
      const fila: EcosistemaCriatura = {
        ecosistema_id: ecosistemaId,
        criatura_id: criaturaId,
        rol: null,
        abundancia: null,
      };
      setData((prev) => [...prev, fila]);
      const { error } = await supabase.from("ecosistema_criaturas").insert(fila);
      if (error) {
        // revertir el optimista si falló la escritura
        setData((prev) =>
          prev.filter(
            (f) => !(f.ecosistema_id === ecosistemaId && f.criatura_id === criaturaId),
          ),
        );
      }
    },
    [filas, setData],
  );

  /** Quita el vínculo entre una criatura y un ecosistema. */
  const desasignar = useCallback(
    async (criaturaId: string, ecosistemaId: string) => {
      const anterior = filas;
      setData((prev) =>
        prev.filter(
          (f) => !(f.ecosistema_id === ecosistemaId && f.criatura_id === criaturaId),
        ),
      );
      const { error } = await supabase
        .from("ecosistema_criaturas")
        .delete()
        .eq("ecosistema_id", ecosistemaId)
        .eq("criatura_id", criaturaId);
      if (error) setData(anterior);
    },
    [filas, setData],
  );

  return {
    ecosistemaCriaturas: filas,
    setEcosistemaCriaturas: setData,
    loading,
    criaturaIdsDe,
    tieneEcosistema,
    asignar,
    desasignar,
  };
}

// ─── Cadenas alimenticias ───────────────────────────────────────────────────

export function useCadenasAlimenticias() {
  const { data, setData, loading, addRow, updateRow, deleteRow } =
    useSupabaseData<CadenaAlimenticia>("cadenas_alimenticias", { order: { campo: "orden" } });

  const cadenas = useMemo(() => data, [data]);

  const crear = useCallback(
    async (nombre: string, ecosistema_id: string | null = null) => {
      const { data: creado } = await addRow({
        nombre,
        ecosistema_id,
        descripcion: "",
        eslabones: [],
      });
      return (creado as CadenaAlimenticia) ?? null;
    },
    [addRow],
  );

  const actualizar = useCallback(
    async (id: string, updates: CadenaAlimenticiaInput) => {
      await updateRow(id, updates);
    },
    [updateRow],
  );

  const eliminar = useCallback(
    async (id: string) => {
      await deleteRow(id);
    },
    [deleteRow],
  );

  return { cadenas, setCadenas: setData, loading, creating: false, crear, actualizar, eliminar };
}

// ─── Perfiles atómicos de criatura ───────────────────────────────────────────

export function usePerfilesAtomicosCriatura() {
  const { data, setData, loading, addRow, updateRow } = useSupabaseData<PerfilAtomicoCriatura>(
    "perfiles_atomicos_criatura",
  );

  const perfiles = useMemo(() => data, [data]);

  const obtenerOCrear = useCallback(
    async (criaturaId: string) => {
      const existente = perfiles.find((p) => p.criatura_id === criaturaId);
      if (existente) return existente;

      const { data: creado } = await addRow({
        criatura_id: criaturaId,
        componentes: [],
        oris_ids: [],
        rasgos_evolutivos: [],
        notas: "",
      });
      return (creado as PerfilAtomicoCriatura) ?? null;
    },
    [perfiles, addRow],
  );

  const actualizar = useCallback(
    async (id: string, updates: PerfilAtomicoCriaturaInput) => {
      await updateRow(id, updates);
    },
    [updateRow],
  );

  return { perfiles, setPerfiles: setData, loading, obtenerOCrear, actualizar };
}

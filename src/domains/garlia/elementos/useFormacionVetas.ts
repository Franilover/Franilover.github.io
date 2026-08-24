"use client";

/**
 * useFormacionVetas.ts
 * ───────────────────────────────────────────────────────────────────────────
 * FASE 4 — reescrito para N:M real. Cadena real en Supabase ahora:
 *   Formacion → formacion_vetas (proporcion) → Veta
 *             → estructura_componentes (padre=veta,  hijo=grano)  → Grano
 *             → estructura_componentes (padre=grano, hijo=compuesto) → Compuesto
 *
 * Antes (Fase 0-3): Veta.grano_id y Grano.compuesto_id eran FK 1:1 directas.
 * Eso asumía que una Veta tiene un único Grano y un Grano un único Compuesto
 * — falso en los datos reales (ver auditoría Fase 4). Ahora una Veta puede
 * tener varios Granos, y un Grano puede estar hecho de varios Compuestos,
 * cada vínculo con su propia cantidad/proporción/rol.
 *
 * Espejo de useOrganoTejidos.ts en la forma (cache-first vía Dexie), pero
 * con un nivel más de profundidad porque acá hay DOS tramos N:M en cadena
 * (Veta→Grano y Grano→Compuesto) en vez de uno solo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/infra/supabase/supabase";
import { db } from "@/infra/supabase/db";

import {
  CONFIG_ESTRUCTURA_COMPONENTES,
  CONFIG_GRANOS,
  CONFIG_VETAS,
  type EstructuraComponente,
  type FormacionVeta,
  type Grano,
  type Veta,
} from "@/domains/garlia/elementos/types";

// ── Cache-first: leer/escribir Dexie ───────────────────────────────────────
// db.estructura_componentes puede no existir todavía si el schema local de
// Dexie no fue regenerado (Fase 8 pendiente) — todo acceso a esa tabla está
// envuelto en try/catch y degrada a Supabase sin romper la pantalla.
async function leerVinculosDeDexie(formacionId: string): Promise<FormacionVeta[]> {
  try {
    if (!db) return [];
    const rows = await db.formacion_vetas
      .where("formacion_id")
      .equals(formacionId)
      .toArray();
    return rows as unknown as FormacionVeta[];
  } catch {
    return [];
  }
}

async function leerVetasDeDexie(ids: string[]): Promise<Record<string, Veta>> {
  const out: Record<string, Veta> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.vetas.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Veta).id] = r as unknown as Veta;
  } catch {}
  return out;
}

async function leerGranosDeDexie(ids: string[]): Promise<Record<string, Grano>> {
  const out: Record<string, Grano> = {};
  if (!db || ids.length === 0) return out;
  try {
    const rows = await db.granos.bulkGet(ids);
    for (const r of rows) if (r) out[(r as unknown as Grano).id] = r as unknown as Grano;
  } catch {}
  return out;
}

/** Trae de Dexie todas las filas estructura_componentes cuyo padre está en `padreIds`
 *  y cuyo padre_tipo coincide — usado tanto para veta→grano como grano→compuesto. */
async function leerComponentesDeDexie(
  padreTipo: "veta" | "grano",
  padreIds: string[],
): Promise<EstructuraComponente[]> {
  if (!db || padreIds.length === 0) return [];
  try {
    const idsSet = new Set(padreIds);
    const rows = await db.estructura_componentes
      .where("padre_tipo")
      .equals(padreTipo)
      .toArray();
    return (rows as unknown as EstructuraComponente[]).filter((r) =>
      idsSet.has(r.padre_id),
    );
  } catch {
    return [];
  }
}


async function guardarEnDexie(
  vinculos: FormacionVeta[],
  vetas: Veta[],
  granos: Grano[],
  componentes: EstructuraComponente[],
) {
  try {
    if (!db) return;
    if (vinculos.length) await db.formacion_vetas.bulkPut(vinculos as any[]);
    if (vetas.length) await db.vetas.bulkPut(vetas as any[]);
    if (granos.length) await db.granos.bulkPut(granos as any[]);
    if (componentes.length) await db.estructura_componentes.bulkPut(componentes as any[]);
  } catch (e) {
    console.warn("[useFormacionVetas] no se pudo guardar en Dexie:", e);
  }
}

/** Un Compuesto dentro de un Grano — antes era grano.compuesto_id (uno solo),
 *  ahora es una fila de estructura_componentes (pueden ser varios). */
export interface CompuestoDeGrano {
  /** Id de la fila estructura_componentes — necesario para editar/quitar. */
  vinculo_id: string;
  grano_id: string;
  compuesto_id: string;
  cantidad: number | null;
  proporcion: number | null;
  unidad: string | null;
  rol: string | null;
}

/** Un Grano dentro de una Veta — antes era veta.grano_id (uno solo), ahora
 *  es una fila de estructura_componentes (pueden ser varios), cada uno con
 *  su propia lista de Compuestos resuelta debajo. */
export interface GranoDeVeta {
  /** Id de la fila estructura_componentes (veta→grano) — necesario para desvincular. */
  vinculo_id: string;
  veta_id: string;
  grano_id: string;
  cantidad: number | null;
  proporcion: number | null;
  unidad: string | null;
  rol: string | null;
  nombre: string;
  funcion: string | null;
  notas: string | null;
  /** Todos los Compuestos que componen este Grano (antes: un solo compuesto_id). */
  compuestos: CompuestoDeGrano[];
}

/** Una fila de la fórmula de una Formación, ya resuelta: vínculo Formación→Veta
 *  más TODOS los Granos (y sus Compuestos) que componen esa Veta. */
export interface VetaDeFormacion {
  /** Id de la fila puente formacion_vetas — necesario para desvincular. */
  vinculo_id: string;
  formacion_id: string;
  veta_id: string;
  /** Alias de veta_id — mismo campo que espera FilaFormulaTejido para
   *  no reofrecer esta Veta en el picker de "usar existente". */
  tejido_o_veta_id: string;
  proporcion: string | null;
  nombre: string;
  funcion: string | null;
  notas: string | null;
  /** Todos los Granos que componen esta Veta (antes: veta.grano_id, uno solo). */
  granos: GranoDeVeta[];
}

export function useFormacionVetas(formacionId: string | null) {
  const [vinculos, setVinculos] = useState<FormacionVeta[]>([]);
  const [vetas, setVetas] = useState<Record<string, Veta>>({});
  const [granos, setGranos] = useState<Record<string, Grano>>({});
  /** Filas veta→grano de estructura_componentes. */
  const [vetaGranoLinks, setVetaGranoLinks] = useState<EstructuraComponente[]>([]);
  /** Filas grano→compuesto de estructura_componentes. */
  const [granoCompuestoLinks, setGranoCompuestoLinks] = useState<EstructuraComponente[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!formacionId) {
      setVinculos([]);
      setVetas({});
      setGranos({});
      setVetaGranoLinks([]);
      setGranoCompuestoLinks([]);
      setLoading(false);
      return;
    }

    // ── Paso 1: pintar de inmediato con lo que ya haya en Dexie ──────────
    const vinculosLocales = await leerVinculosDeDexie(formacionId);
    if (vinculosLocales.length > 0) {
      setVinculos(vinculosLocales);
      const vetaIdsLocales = vinculosLocales.map((v) => v.veta_id);
      const vetasLocales = await leerVetasDeDexie(vetaIdsLocales);
      setVetas(vetasLocales);

      const vgLocales = await leerComponentesDeDexie("veta", vetaIdsLocales);
      setVetaGranoLinks(vgLocales);

      const granoIdsLocales = Array.from(new Set(vgLocales.map((c) => c.hijo_id)));
      const granosLocales = await leerGranosDeDexie(granoIdsLocales);
      setGranos(granosLocales);

      const gcLocales = await leerComponentesDeDexie("grano", granoIdsLocales);
      setGranoCompuestoLinks(gcLocales);

      setLoading(false);
    } else {
      setLoading(true);
    }

    // ── Paso 2: revalidar contra Supabase en segundo plano ────────────────
    const { data: vinculoData, error: vinculoError } = await supabase
      .from("formacion_vetas")
      .select("*")
      .eq("formacion_id", formacionId)
      .order("created_at", { ascending: true });

    if (vinculoError || !vinculoData) {
      if (vinculosLocales.length === 0) setVinculos([]);
      setLoading(false);
      return;
    }
    setVinculos(vinculoData as FormacionVeta[]);

    const vetaIds = (vinculoData as FormacionVeta[]).map((v) => v.veta_id);
    if (vetaIds.length === 0) {
      setVetas({});
      setGranos({});
      setVetaGranoLinks([]);
      setGranoCompuestoLinks([]);
      setLoading(false);
      void guardarEnDexie(vinculoData as FormacionVeta[], [], [], []);
      return;
    }

    const { data: vetaData } = await supabase
      .from(CONFIG_VETAS.tabla)
      .select(CONFIG_VETAS.select)
      .in("id", vetaIds);

    const vetasPorId: Record<string, Veta> = {};
    for (const v of (vetaData ?? []) as unknown as Veta[]) vetasPorId[v.id] = v;
    setVetas(vetasPorId);

    // ── Tramo Veta→Grano: N:M vía estructura_componentes (padre=veta) ────
    const { data: vgData } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
      .eq("padre_tipo", "veta")
      .eq("hijo_tipo", "grano")
      .in("padre_id", vetaIds);

    const vgLinks = (vgData ?? []) as unknown as EstructuraComponente[];
    setVetaGranoLinks(vgLinks);

    const granoIds = Array.from(new Set(vgLinks.map((c) => c.hijo_id)));
    if (granoIds.length === 0) {
      setGranos({});
      setGranoCompuestoLinks([]);
      setLoading(false);
      void guardarEnDexie(vinculoData as FormacionVeta[], Object.values(vetasPorId), [], vgLinks);
      return;
    }

    const { data: granoData } = await supabase
      .from(CONFIG_GRANOS.tabla)
      .select(CONFIG_GRANOS.select)
      .in("id", granoIds);

    const granosPorId: Record<string, Grano> = {};
    for (const g of (granoData ?? []) as unknown as Grano[]) granosPorId[g.id] = g;
    setGranos(granosPorId);

    // ── Tramo Grano→Compuesto: N:M vía estructura_componentes (padre=grano) ─
    const { data: gcData } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
      .eq("padre_tipo", "grano")
      .eq("hijo_tipo", "compuesto")
      .in("padre_id", granoIds);

    const gcLinks = (gcData ?? []) as unknown as EstructuraComponente[];
    setGranoCompuestoLinks(gcLinks);

    setLoading(false);
    void guardarEnDexie(
      vinculoData as FormacionVeta[],
      Object.values(vetasPorId),
      Object.values(granosPorId),
      [...vgLinks, ...gcLinks],
    );
  }, [formacionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<VetaDeFormacion[]>(() => {
    return vinculos
      .map((v) => {
        const veta = vetas[v.veta_id];
        if (!veta) return null;

        const granosDeEstaVeta: GranoDeVeta[] = vetaGranoLinks
          .filter((link) => link.padre_id === v.veta_id)
          .map((link) => {
            const grano = granos[link.hijo_id];
            if (!grano) return null;
            const compuestos: CompuestoDeGrano[] = granoCompuestoLinks
              .filter((c) => c.padre_id === grano.id)
              .map((c) => ({
                vinculo_id: c.id,
                grano_id: grano.id,
                compuesto_id: c.hijo_id,
                cantidad: c.cantidad,
                proporcion: c.proporcion,
                unidad: c.unidad,
                rol: c.rol,
              }));
            return {
              vinculo_id: link.id,
              veta_id: v.veta_id,
              grano_id: grano.id,
              cantidad: link.cantidad,
              proporcion: link.proporcion,
              unidad: link.unidad,
              rol: link.rol,
              nombre: grano.nombre,
              funcion: grano.funcion,
              notas: grano.notas,
              compuestos,
            };
          })
          .filter((g): g is GranoDeVeta => g !== null);

        return {
          vinculo_id: v.id,
          formacion_id: v.formacion_id,
          veta_id: v.veta_id,
          tejido_o_veta_id: v.veta_id,
          proporcion: v.proporcion,
          nombre: veta.nombre,
          funcion: veta.funcion,
          notas: veta.notas,
          granos: granosDeEstaVeta,
        };
      })
      .filter((v): v is VetaDeFormacion => v !== null);
  }, [vinculos, vetas, granos, vetaGranoLinks, granoCompuestoLinks]);

  // ── Agregar un Compuesto: crea Grano nuevo (hecho de ese Compuesto) y lo
  // vincula a una Veta nueva, que a su vez se vincula a esta Formación.
  // Reemplaza la cadena rígida anterior por dos inserts en estructura_componentes. ─
  const agregarCompuesto = useCallback(
    async (compuestoId: string) => {
      if (!formacionId) return null;

      const { data: nuevoGrano, error: errorGrano } = await supabase
        .from(CONFIG_GRANOS.tabla)
        .insert([{ nombre: "", estructura: [] }])
        .select()
        .single();
      if (errorGrano || !nuevoGrano) return null;
      const grano = nuevoGrano as Grano;

      const { data: gcLink, error: errorGc } = await supabase
        .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
        .insert([{ padre_tipo: "grano", padre_id: grano.id, hijo_tipo: "compuesto", hijo_id: compuestoId, cantidad: 1 }])
        .select()
        .single();
      if (errorGc || !gcLink) return null;

      const { data: nuevaVeta, error: errorVeta } = await supabase
        .from(CONFIG_VETAS.tabla)
        .insert([{ nombre: "", estructura: [] }])
        .select()
        .single();
      if (errorVeta || !nuevaVeta) return null;
      const veta = nuevaVeta as Veta;

      const { data: vgLink, error: errorVg } = await supabase
        .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
        .insert([{ padre_tipo: "veta", padre_id: veta.id, hijo_tipo: "grano", hijo_id: grano.id, cantidad: 1 }])
        .select()
        .single();
      if (errorVg || !vgLink) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("formacion_vetas")
        .insert([{ formacion_id: formacionId, veta_id: veta.id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setVetas((prev) => ({ ...prev, [veta.id]: veta }));
      setGranos((prev) => ({ ...prev, [grano.id]: grano }));
      setVetaGranoLinks((prev) => [...prev, vgLink as EstructuraComponente]);
      setGranoCompuestoLinks((prev) => [...prev, gcLink as EstructuraComponente]);
      setVinculos((prev) => [...prev, vinculo as FormacionVeta]);
      void guardarEnDexie(
        [vinculo as FormacionVeta],
        [veta],
        [grano],
        [vgLink as EstructuraComponente, gcLink as EstructuraComponente],
      );
      return vinculo as FormacionVeta;
    },
    [formacionId],
  );

  // ── Crear una Veta nueva en el catálogo global (con nombre, sin Granos
  // todavía) y vincularla de una — flujo "Agregar" unificado con reutilizar. ──
  const crearYVincular = useCallback(
    async (nombre: string) => {
      if (!formacionId) return null;

      const { data: nuevaVeta, error: errorVeta } = await supabase
        .from(CONFIG_VETAS.tabla)
        .insert([{ nombre, estructura: [] }])
        .select()
        .single();
      if (errorVeta || !nuevaVeta) return null;

      const veta = nuevaVeta as Veta;
      setVetas((prev) => ({ ...prev, [veta.id]: veta }));
      void guardarEnDexie([], [veta], [], []);

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("formacion_vetas")
        .insert([{ formacion_id: formacionId, veta_id: veta.id }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      setVinculos((prev) => [...prev, vinculo as FormacionVeta]);
      void guardarEnDexie([vinculo as FormacionVeta], [], [], []);
      return vinculo as FormacionVeta;
    },
    [formacionId],
  );

  // ── Vincular una Veta YA EXISTENTE (de cualquier otra Formación) sin
  // crear Granos nuevos — reutilización real, contraparte de agregarCompuesto. ──
  const vincularExistente = useCallback(
    async (vetaId: string) => {
      if (!formacionId) return null;

      const { data: vinculo, error: errorVinculo } = await supabase
        .from("formacion_vetas")
        .insert([{ formacion_id: formacionId, veta_id: vetaId }])
        .select()
        .single();
      if (errorVinculo || !vinculo) return null;

      if (!vetas[vetaId]) {
        const { data: vetaData } = await supabase
          .from(CONFIG_VETAS.tabla)
          .select(CONFIG_VETAS.select)
          .eq("id", vetaId)
          .single();
        if (vetaData) {
          const veta = vetaData as unknown as Veta;
          setVetas((prev) => ({ ...prev, [veta.id]: veta }));
          void guardarEnDexie([], [veta], [], []);

          const { data: vgData } = await supabase
            .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
            .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
            .eq("padre_tipo", "veta")
            .eq("hijo_tipo", "grano")
            .eq("padre_id", vetaId);
          const vgLinks = (vgData ?? []) as unknown as EstructuraComponente[];
          if (vgLinks.length > 0) {
            setVetaGranoLinks((prev) => [...prev, ...vgLinks]);

            const granoIds = vgLinks.map((l) => l.hijo_id).filter((id) => !granos[id]);
            if (granoIds.length > 0) {
              const { data: granoData } = await supabase
                .from(CONFIG_GRANOS.tabla)
                .select(CONFIG_GRANOS.select)
                .in("id", granoIds);
              const nuevosGranos = (granoData ?? []) as unknown as Grano[];
              if (nuevosGranos.length > 0) {
                setGranos((prev) => {
                  const next = { ...prev };
                  for (const g of nuevosGranos) next[g.id] = g;
                  return next;
                });

                const { data: gcData } = await supabase
                  .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
                  .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
                  .eq("padre_tipo", "grano")
                  .eq("hijo_tipo", "compuesto")
                  .in("padre_id", granoIds);
                const gcLinks = (gcData ?? []) as unknown as EstructuraComponente[];
                setGranoCompuestoLinks((prev) => [...prev, ...gcLinks]);
                void guardarEnDexie([], [], nuevosGranos, [...vgLinks, ...gcLinks]);
              }
            }
          }
        }
      }

      setVinculos((prev) => [...prev, vinculo as FormacionVeta]);
      void guardarEnDexie([vinculo as FormacionVeta], [], [], []);
      return vinculo as FormacionVeta;
    },
    [formacionId, vetas, granos],
  );

  // ── Agregar un Compuesto adicional a un Grano ya existente (antes esto no
  // existía: un Grano solo podía tener un compuesto_id) ────────────────────
  const agregarCompuestoAGrano = useCallback(async (granoId: string, compuestoId: string) => {
    const { data: nuevoLink, error } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .insert([{ padre_tipo: "grano", padre_id: granoId, hijo_tipo: "compuesto", hijo_id: compuestoId, cantidad: 1 }])
      .select()
      .single();
    if (error || !nuevoLink) {
      console.error("[useFormacionVetas] error agregando compuesto a grano:", error);
      return null;
    }
    const link = nuevoLink as EstructuraComponente;
    setGranoCompuestoLinks((prev) => [...prev, link]);
    void guardarEnDexie([], [], [], [link]);
    return link;
  }, []);

  // ── Quitar un Compuesto de un Grano (borra la fila estructura_componentes,
  // no el Compuesto ni el Grano) ────────────────────────────────────────────
  const quitarCompuestoDeGrano = useCallback(async (vinculoId: string) => {
    setGranoCompuestoLinks((prev) => prev.filter((c) => c.id !== vinculoId));
    try {
      if (db) await db.estructura_componentes.delete(vinculoId);
    } catch {}
    const { error } = await supabase.from(CONFIG_ESTRUCTURA_COMPONENTES.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useFormacionVetas] error quitando compuesto de grano:", error);
  }, []);

  // ── Agregar un Grano adicional a una Veta ya existente (antes esto no
  // existía: una Veta solo podía tener un grano_id) ────────────────────────
  const agregarGranoAVeta = useCallback(async (vetaId: string, granoId: string) => {
    const { data: nuevoLink, error } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .insert([{ padre_tipo: "veta", padre_id: vetaId, hijo_tipo: "grano", hijo_id: granoId, cantidad: 1 }])
      .select()
      .single();
    if (error || !nuevoLink) {
      console.error("[useFormacionVetas] error agregando grano a veta:", error);
      return null;
    }
    const link = nuevoLink as EstructuraComponente;
    setVetaGranoLinks((prev) => [...prev, link]);
    void guardarEnDexie([], [], [], [link]);
    return link;
  }, []);

  // ── Quitar un Grano de una Veta (borra la fila estructura_componentes,
  // no el Grano ni sus Compuestos) ──────────────────────────────────────────
  const quitarGranoDeVeta = useCallback(async (vinculoId: string) => {
    setVetaGranoLinks((prev) => prev.filter((c) => c.id !== vinculoId));
    try {
      if (db) await db.estructura_componentes.delete(vinculoId);
    } catch {}
    const { error } = await supabase.from(CONFIG_ESTRUCTURA_COMPONENTES.tabla).delete().eq("id", vinculoId);
    if (error) console.error("[useFormacionVetas] error quitando grano de veta:", error);
  }, []);

  // ── Editar el nombre propio de la Veta (columna nombre de la tabla vetas,
  // distinta de los Compuestos/Granos que la componen) ─────────────────────
  const actualizarNombre = useCallback(async (vetaId: string, nombre: string) => {
    setVetas((prev) => {
      if (!prev[vetaId]) return prev;
      const actualizada = { ...prev[vetaId], nombre };
      void guardarEnDexie([], [actualizada], [], []);
      return { ...prev, [vetaId]: actualizada };
    });
    const { error } = await supabase
      .from(CONFIG_VETAS.tabla)
      .update({ nombre })
      .eq("id", vetaId);
    if (error) console.error("[useFormacionVetas] error actualizando nombre de la veta:", error);
  }, []);

  // ── Editar el nombre propio de un Grano ───────────────────────────────────
  const actualizarNombreGrano = useCallback(async (granoId: string, nombre: string) => {
    setGranos((prev) => {
      if (!prev[granoId]) return prev;
      const actualizado = { ...prev[granoId], nombre };
      void guardarEnDexie([], [], [actualizado], []);
      return { ...prev, [granoId]: actualizado };
    });
    const { error } = await supabase
      .from(CONFIG_GRANOS.tabla)
      .update({ nombre })
      .eq("id", granoId);
    if (error) console.error("[useFormacionVetas] error actualizando nombre del grano:", error);
  }, []);

  const actualizarProporcion = useCallback(async (vinculoId: string, proporcion: string) => {
    setVinculos((prev) => {
      const next = prev.map((v) => (v.id === vinculoId ? { ...v, proporcion } : v));
      const actualizado = next.find((v) => v.id === vinculoId);
      if (actualizado) void guardarEnDexie([actualizado], [], [], []);
      return next;
    });
    const { error } = await supabase
      .from("formacion_vetas")
      .update({ proporcion })
      .eq("id", vinculoId);
    if (error) console.error("[useFormacionVetas] error actualizando proporción:", error);
  }, []);

  /** Quitar una Veta completa de esta Formación (no borra la Veta ni sus Granos). */
  const quitarCompuesto = useCallback(async (vinculoId: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== vinculoId));
    try {
      if (db) await db.formacion_vetas.delete(vinculoId);
    } catch {}
    await supabase.from("formacion_vetas").delete().eq("id", vinculoId);
  }, []);

  return {
    items,
    loading,
    agregarCompuesto,
    vincularExistente,
    crearYVincular,
    agregarCompuestoAGrano,
    quitarCompuestoDeGrano,
    agregarGranoAVeta,
    quitarGranoDeVeta,
    actualizarNombre,
    actualizarNombreGrano,
    actualizarProporcion,
    quitarCompuesto,
    load,
  };
}

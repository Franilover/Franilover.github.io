"use client";

/**
 * CatalogoVetasFisica.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Espejo inerte de CatalogoTejidosBiologia.tsx: biblioteca global de Granos
 * y Vetas — dos grids navegables, cada una con su editor propio
 * (crear/editar/borrar), sin necesidad de pasar por ninguna Formación.
 * Nace del mismo pedido que dio origen al catálogo de Biología, ahora
 * aplicado a Física: mostrar arriba de Formaciones la jerarquía
 * Compuesto→Grano→Veta como catálogo de solo composición — separado de
 * "Usar existente" (que vive dentro de la fórmula de una Formación
 * puntual, ver useFormacionVetas.ts).
 *
 * FASE 4 — la cadena real (ver elementos/types.ts) ya NO es 1:1: Grano
 * puede estar hecho de VARIOS Compuestos, y Veta puede tener VARIOS
 * Granos, cada vínculo vía la tabla genérica `estructura_componentes`
 * (columnas legadas `compuesto_id`/`grano_id` ya no se leen ni escriben
 * desde acá). Por eso ambos paneles muestran una LISTA con botón
 * "agregar" en vez de un selector singular: el de Grano usa
 * useGranosDeUnCompuesto/agregarCompuestoAGrano (vía useFormacionVetas),
 * el de Veta usa useVetasDeUnGrano/agregarGranoAVeta.
 *
 * Breadcrumb Grano ⇄ Veta ⇄ Formación (espejo de BreadcrumbJerarquia de
 * Biología, componente genérico reutilizado tal cual — ver biologia/
 * BreadcrumbJerarquia.tsx): Grano→Veta ahora es N:M vía
 * estructura_componentes (useVetasDeUnGrano), Veta→Formación sigue siendo
 * M:N vía `formacion_vetas` (useFormacionesDeUnaVeta, sin cambios), y
 * Grano→Formación es transitivo, atravesando ambos tramos
 * (useFormacionesDeUnGrano).
 *
 * Mismo lenguaje visual que GridCatalogoGrupo (grid de 3 columnas, click
 * abre panel flotante centrado).
 */

import { Gem, Layers, Boxes, Plus, Trash2, X, Search } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useConfirm } from "@/ui/ConfirmModal";
import { useGranos } from "@/domains/garlia/elementos/useGranos";
import { useVetas } from "@/domains/garlia/elementos/useVetas";
import { useVetasDeUnGrano } from "@/domains/garlia/elementos/useVetasDeUnGrano";
import { useFormacionesDeUnaVeta } from "@/domains/garlia/elementos/useFormacionesDeUnaVeta";
import { useFormacionesDeUnGrano } from "@/domains/garlia/elementos/useFormacionesDeUnGrano";
import type { Grano, Compuesto, Veta } from "@/domains/garlia/elementos/types";
import { BreadcrumbJerarquia } from "../biologia/BreadcrumbJerarquia";
import { PillCatalogoItem } from "@/domains/garlia/_shared/PillCatalogoItem";

interface Props {
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
  /** Navegar a una Formación desde el breadcrumb de un Grano o una Veta —
   *  el padre (FisicaPage) decide cómo abrir su editor, ya que la
   *  Formación vive fuera de este catálogo (ver GridCatalogoGrupo). */
  onAbrirFormacion?: (formacionId: string) => void;
}

export function CatalogoVetasFisica({
  compuestos,
  loadingCompuestos,
  onCompuestoCreado,
  onAbrirCompuesto,
  onAbrirFormacion,
}: Props) {
  const granos = useGranos();
  const vetas = useVetas();

  const [granoSeleccionadoId, setGranoSeleccionadoId] = useState<string | null>(null);
  const [vetaSeleccionadaId, setVetaSeleccionadaId] = useState<string | null>(null);

  const granoActivo = granos.items.find((g) => g.id === granoSeleccionadoId) ?? null;
  const vetaActiva = vetas.items.find((v) => v.id === vetaSeleccionadaId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Granos ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Granos · {granos.items.length}
          </p>
        </div>

        <GridSimple
          items={granos.items}
          loading={granos.loading}
          icono={<Gem size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={granoSeleccionadoId}
          onSeleccionar={setGranoSeleccionadoId}
          labelVacio="granos"
        />

        {granoActivo && (
          <PanelEditorGrano
            item={granoActivo}
            compuestos={compuestos}
            loadingCompuestos={loadingCompuestos}
            onCerrar={() => setGranoSeleccionadoId(null)}
            onActualizar={granos.actualizar}
            onEliminar={async (id) => {
              const res = await granos.eliminar(id);
              if (res.ok) setGranoSeleccionadoId(null);
              return res;
            }}
            onCompuestoCreado={onCompuestoCreado}
            onAbrirCompuesto={
              onAbrirCompuesto
                ? (compuestoId) => {
                    // Cierra este panel de Grano antes de subir el id: si
                    // no, CompuestoPanelFlotante (montado por FisicaPage,
                    // portal aparte) queda apilado ENCIMA de este —  mismo
                    // z-[9999] fijo en ambos, así que un tercer nivel
                    // abierto desde el Compuesto (p.ej. otra Célula) podía
                    // terminar tapado por este panel de Grano que seguía
                    // vivo de fondo.
                    setGranoSeleccionadoId(null);
                    onAbrirCompuesto(compuestoId);
                  }
                : undefined
            }
            onAbrirVeta={(vetaId) => {
              setGranoSeleccionadoId(null);
              setVetaSeleccionadaId(vetaId);
            }}
            onAbrirFormacion={
              onAbrirFormacion
                ? (formacionId) => {
                    setGranoSeleccionadoId(null);
                    onAbrirFormacion(formacionId);
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* ── Vetas ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-primary/10 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Vetas · {vetas.items.length}
          </p>
        </div>

        <GridSimple
          items={vetas.items}
          loading={vetas.loading}
          icono={<Layers size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={vetaSeleccionadaId}
          onSeleccionar={setVetaSeleccionadaId}
          labelVacio="vetas"
        />

        {vetaActiva && (
          <PanelEditorVeta
            item={vetaActiva}
            granos={granos.items}
            loadingGranos={granos.loading}
            onCerrar={() => setVetaSeleccionadaId(null)}
            onActualizar={vetas.actualizar}
            onEliminar={async (id) => {
              const res = await vetas.eliminar(id);
              if (res.ok) setVetaSeleccionadaId(null);
              return res;
            }}
            onAbrirGrano={(granoId) => {
              setVetaSeleccionadaId(null);
              setGranoSeleccionadoId(granoId);
            }}
            onAbrirFormacion={
              onAbrirFormacion
                ? (formacionId) => {
                    setVetaSeleccionadaId(null);
                    onAbrirFormacion(formacionId);
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

// ─── Grid genérica (solo lista + click, sin lógica de edición) ─────────────

function GridSimple<T extends { id: string; nombre: string }>({
  items,
  loading,
  icono,
  seleccionadoId,
  onSeleccionar,
  labelVacio,
}: {
  items: T[];
  loading: boolean;
  icono: React.ReactNode;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  labelVacio: string;
}) {
  // Solo mostramos "Cargando…" si todavía no hay NADA que pintar — con
  // items ya presentes (llegados de Dexie o de un fetch anterior), un
  // `loading=true` de revalidación en segundo plano no debe tapar la
  // grid: eso es lo que causaba el parpadeo/"Cargando…" en cada cambio
  // de tab o remount, aunque los datos ya estuvieran en caché local
  // (useSupabaseData vuelve a poner loading=true en cada montaje porque
  // leer Dexie es async, así que el primer render nunca lo sabe todavía).
  if (loading && items.length === 0) {
    return <p className="text-micro text-primary/25 italic py-2">Cargando…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-4 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
        Sin {labelVacio} todavía
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <PillCatalogoItem
          key={item.id}
          nombre={item.nombre}
          icono={icono}
          seleccionado={seleccionadoId === item.id}
          onClick={() => onSeleccionar(item.id)}
        />
      ))}
    </div>
  );
}

// ─── Panel Grano: nombre, función, notas, Compuestos (N:M, Fase 4) ─────────
// Exportado: reutilizado directo desde SelectorFormulaTejidos (fila "hecho
// de" de una Veta en la fórmula de una Formación) — clickear ahí debe abrir
// ESTE panel (Grano), no el del Compuesto directo, misma cadena real que
// su espejo CatalogoTejidosBiologia.tsx.
//
// FASE 4: un Grano puede estar hecho de VARIOS Compuestos — se listan con
// su cantidad/proporción y se agregan/quitan uno a uno, en vez del
// SelectorCompuesto singular que escribía grano.compuesto_id.

export function PanelEditorGrano({
  item,
  compuestos,
  loadingCompuestos,
  onCerrar,
  onActualizar,
  onEliminar,
  onCompuestoCreado,
  onAbrirCompuesto,
  onAbrirVeta,
  onAbrirFormacion,
}: {
  item: Grano;
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Grano>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
  /** Cierra este panel y abre el de la Veta elegida — navegación hacia arriba. */
  onAbrirVeta?: (vetaId: string) => void;
  /** Cierra este panel y abre el de la Formación elegida — navegación
   *  transitiva (Grano → Veta → Formación, unión de todas las Formaciones
   *  alcanzables). */
  onAbrirFormacion?: (formacionId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const vetasQueUsanEsteGrano = useVetasDeUnGrano(item.id);
  const formacionesQueUsanEsteGrano = useFormacionesDeUnGrano(item.id);
  // Este panel es de catálogo global (no cuelga de ninguna Formación
  // puntual), así que consulta/edita estructura_componentes directo contra
  // Supabase en vez de pasar por useFormacionVetas (pensado para el flujo
  // "fórmula de una Formación"). No existe un "useCompuestosDeUnGrano"
  // dedicado todavía — se resuelve acá mismo con las filas crudas.
  const [vinculos, setVinculos] = useState<
    Array<{ vinculo_id: string; compuesto_id: string; cantidad: number | null; proporcion: number | null }>
  >([]);
  const [loadingVinculos, setLoadingVinculos] = useState(true);
  const [agregando, setAgregando] = useState(false);

  const cargarVinculos = React.useCallback(async () => {
    setLoadingVinculos(true);
    const { supabase } = await import("@/infra/supabase/supabase");
    const { CONFIG_ESTRUCTURA_COMPONENTES } = await import("@/domains/garlia/elementos/types");
    const { data } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
      .eq("padre_tipo", "grano")
      .eq("hijo_tipo", "compuesto")
      .eq("padre_id", item.id)
      .order("created_at", { ascending: true });
    setVinculos(
      (data ?? []).map((d: any) => ({
        vinculo_id: d.id,
        compuesto_id: d.hijo_id,
        cantidad: d.cantidad,
        proporcion: d.proporcion,
      })),
    );
    setLoadingVinculos(false);
  }, [item.id]);

  useEffect(() => {
    void cargarVinculos();
  }, [cargarVinculos]);

  async function agregarCompuesto(compuestoId: string) {
    setAgregando(true);
    const { supabase } = await import("@/infra/supabase/supabase");
    const { CONFIG_ESTRUCTURA_COMPONENTES } = await import("@/domains/garlia/elementos/types");
    const { data, error } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .insert([{ padre_tipo: "grano", padre_id: item.id, hijo_tipo: "compuesto", hijo_id: compuestoId, cantidad: 1 }])
      .select()
      .single();
    setAgregando(false);
    if (!error && data) {
      setVinculos((prev) => [
        ...prev,
        { vinculo_id: data.id, compuesto_id: data.hijo_id, cantidad: data.cantidad, proporcion: data.proporcion },
      ]);
    }
  }

  async function quitarCompuesto(vinculoId: string) {
    setVinculos((prev) => prev.filter((v) => v.vinculo_id !== vinculoId));
    const { supabase } = await import("@/infra/supabase/supabase");
    const { CONFIG_ESTRUCTURA_COMPONENTES } = await import("@/domains/garlia/elementos/types");
    await supabase.from(CONFIG_ESTRUCTURA_COMPONENTES.tabla).delete().eq("id", vinculoId);
  }

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar grano",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si alguna Veta lo usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente alguna Veta todavía lo usa. Quitalo de ahí primero.",
      );
    }
  }

  const compuestosUsados = new Set(vinculos.map((v) => v.compuesto_id));

  return (
    <PanelFlotanteBase onCerrar={onCerrar}>
      <ConfirmModal />
      <PanelFlotanteHeader
        icono={<Gem className="text-primary/50" size={12} />}
        nombre={item.nombre ?? ""}
        placeholder="Nombre…"
        onChangeNombre={(nombre) => onActualizar(item.id, { nombre })}
        onEliminar={handleEliminar}
        eliminando={eliminando}
        onCerrar={onCerrar}
      />

      <div className="shrink-0 px-3 pt-2">
        <BreadcrumbJerarquia
          niveles={[
            { label: "Grano", icono: <Gem size={10} />, activo: true },
            {
              label: "Veta",
              icono: <Layers size={10} />,
              activo: false,
              items: vetasQueUsanEsteGrano.items.map((v) => ({
                id: v.veta_id,
                nombre: v.veta.nombre,
              })),
              loading: vetasQueUsanEsteGrano.loading,
              onNavegar: onAbrirVeta,
            },
            {
              label: "Formación",
              icono: <Boxes size={10} />,
              activo: false,
              items: formacionesQueUsanEsteGrano.items.map((f) => ({
                id: f.id,
                nombre: f.nombre,
              })),
              loading: formacionesQueUsanEsteGrano.loading,
              onNavegar: onAbrirFormacion,
            },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {errorEliminar && <ErrorBanner texto={errorEliminar} />}

        <input
          className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none placeholder:text-primary/25"
          placeholder="Función…"
          value={item.funcion ?? ""}
          onChange={(e) => onActualizar(item.id, { funcion: e.target.value })}
        />

        <div>
          <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
            Compuestos · {vinculos.length}
          </p>
          <ListaCompuestosDeGrano
            vinculos={vinculos}
            loading={loadingVinculos}
            compuestos={compuestos}
            onQuitar={quitarCompuesto}
            onAbrirCompuesto={onAbrirCompuesto}
          />
          <div className="mt-2">
            <SelectorCompuestoParaAgregar
              compuestos={compuestos.filter((c) => !compuestosUsados.has(c.id))}
              loadingCompuestos={loadingCompuestos}
              agregando={agregando}
              onElegir={agregarCompuesto}
              onCompuestoCreado={onCompuestoCreado}
            />
          </div>
        </div>

        <NotasField
          value={item.notas ?? ""}
          onChange={(notas) => onActualizar(item.id, { notas })}
        />

        <NotaReutilizable />
      </div>
    </PanelFlotanteBase>
  );
}

/** Lista de Compuestos que componen un Grano — cada fila con nombre y botón quitar. */
function ListaCompuestosDeGrano({
  vinculos,
  loading,
  compuestos,
  onQuitar,
  onAbrirCompuesto,
}: {
  vinculos: Array<{ vinculo_id: string; compuesto_id: string; cantidad: number | null; proporcion: number | null }>;
  loading: boolean;
  compuestos: Compuesto[];
  onQuitar: (vinculoId: string) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  if (loading && vinculos.length === 0) {
    return <p className="text-micro text-primary/25 italic py-1">Cargando…</p>;
  }
  if (vinculos.length === 0) {
    return <p className="text-micro text-primary/25 italic py-1">Sin compuestos todavía</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {vinculos.map((v) => {
        const compuesto = compuestos.find((c) => c.id === v.compuesto_id);
        return (
          <div
            key={v.vinculo_id}
            className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/10"
          >
            <button
              type="button"
              onClick={() => onAbrirCompuesto?.(v.compuesto_id)}
              disabled={!onAbrirCompuesto}
              className="flex-1 min-w-0 truncate text-left text-micro font-bold text-primary/80 disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
            >
              {compuesto?.nombre ?? "(compuesto no encontrado)"}
            </button>
            <button
              type="button"
              onClick={() => onQuitar(v.vinculo_id)}
              title="Quitar"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Buscador simple para agregar un Compuesto nuevo a la lista de un Grano
 *  (no reemplaza, solo agrega — contraparte "agregar" del SelectorCompuesto
 *  singular que existía antes de Fase 4). */
function SelectorCompuestoParaAgregar({
  compuestos,
  loadingCompuestos,
  agregando,
  onElegir,
  onCompuestoCreado,
}: {
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  agregando?: boolean;
  onElegir: (compuestoId: string) => void;
  onCompuestoCreado?: (c: Compuesto) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return compuestos;
    return compuestos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [compuestos, busqueda]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={agregando}
        className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
      >
        <Plus size={10} /> Agregar compuesto
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/15">
        <Search size={12} className="text-primary/30 shrink-0" />
        <input
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          placeholder={loadingCompuestos ? "Cargando…" : "Buscar compuesto…"}
          className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
        />
        <button
          type="button"
          onMouseDown={() => setAbierto(false)}
          title="Cancelar"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/30 hover:text-primary transition-colors cursor-pointer"
        >
          <X size={10} />
        </button>
      </div>
      <div
        className="absolute z-20 mt-1 left-0 right-0 max-h-48 overflow-y-auto rounded-md border shadow-lg"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
        }}
      >
        {filtrados.length === 0 ? (
          <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
        ) : (
          filtrados.slice(0, 30).map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => {
                onElegir(c.id);
                setAbierto(false);
                setBusqueda("");
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate"
            >
              {c.nombre || "Sin nombre"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Panel Veta: nombre, función, notas, Granos (N:M, Fase 4) ──────────────
// Exportado: reutilizado directo desde SelectorFormulaTejidos/GruposCompuestosPage
// (editor de la fórmula de una Formación) para abrir el mismo editor completo
// al clickear el nombre de una fila — un solo editor de Veta en toda la app.
//
// FASE 4: una Veta puede tener VARIOS Granos — se listan y se
// agregan/quitan uno a uno, en vez del SelectorGrano singular que escribía
// veta.grano_id.

export function PanelEditorVeta({
  item,
  granos,
  loadingGranos,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirGrano,
  onAbrirFormacion,
}: {
  item: Veta;
  granos: Grano[];
  loadingGranos?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Veta>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  /** Cierra este panel y abre el del Grano elegido — navegación cruzada. */
  onAbrirGrano?: (granoId: string) => void;
  /** Cierra este panel y abre el de la Formación elegida — navegación hacia arriba. */
  onAbrirFormacion?: (formacionId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const formacionesQueUsanEstaVeta = useFormacionesDeUnaVeta(item.id);

  // Granos que componen esta Veta — N:M vía estructura_componentes.
  const [vinculos, setVinculos] = useState<
    Array<{ vinculo_id: string; grano_id: string; cantidad: number | null; proporcion: number | null }>
  >([]);
  const [loadingVinculos, setLoadingVinculos] = useState(true);
  const [agregando, setAgregando] = useState(false);

  const cargarVinculos = React.useCallback(async () => {
    setLoadingVinculos(true);
    const { supabase } = await import("@/infra/supabase/supabase");
    const { CONFIG_ESTRUCTURA_COMPONENTES } = await import("@/domains/garlia/elementos/types");
    const { data } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .select(CONFIG_ESTRUCTURA_COMPONENTES.select)
      .eq("padre_tipo", "veta")
      .eq("hijo_tipo", "grano")
      .eq("padre_id", item.id)
      .order("created_at", { ascending: true });
    setVinculos(
      (data ?? []).map((d: any) => ({
        vinculo_id: d.id,
        grano_id: d.hijo_id,
        cantidad: d.cantidad,
        proporcion: d.proporcion,
      })),
    );
    setLoadingVinculos(false);
  }, [item.id]);

  useEffect(() => {
    void cargarVinculos();
  }, [cargarVinculos]);

  async function agregarGrano(granoId: string) {
    setAgregando(true);
    const { supabase } = await import("@/infra/supabase/supabase");
    const { CONFIG_ESTRUCTURA_COMPONENTES } = await import("@/domains/garlia/elementos/types");
    const { data, error } = await supabase
      .from(CONFIG_ESTRUCTURA_COMPONENTES.tabla)
      .insert([{ padre_tipo: "veta", padre_id: item.id, hijo_tipo: "grano", hijo_id: granoId, cantidad: 1 }])
      .select()
      .single();
    setAgregando(false);
    if (!error && data) {
      setVinculos((prev) => [
        ...prev,
        { vinculo_id: data.id, grano_id: data.hijo_id, cantidad: data.cantidad, proporcion: data.proporcion },
      ]);
    }
  }

  async function quitarGrano(vinculoId: string) {
    setVinculos((prev) => prev.filter((v) => v.vinculo_id !== vinculoId));
    const { supabase } = await import("@/infra/supabase/supabase");
    const { CONFIG_ESTRUCTURA_COMPONENTES } = await import("@/domains/garlia/elementos/types");
    await supabase.from(CONFIG_ESTRUCTURA_COMPONENTES.tabla).delete().eq("id", vinculoId);
  }

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar veta",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si alguna Formación la usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente alguna Formación todavía la usa. Quitala de esa fórmula primero.",
      );
    }
  }

  const granosUsados = new Set(vinculos.map((v) => v.grano_id));

  return (
    <PanelFlotanteBase onCerrar={onCerrar}>
      <ConfirmModal />
      <PanelFlotanteHeader
        icono={<Layers className="text-primary/50" size={12} />}
        nombre={item.nombre ?? ""}
        placeholder="Nombre…"
        onChangeNombre={(nombre) => onActualizar(item.id, { nombre })}
        onEliminar={handleEliminar}
        eliminando={eliminando}
        onCerrar={onCerrar}
      />

      <div className="shrink-0 px-3 pt-2">
        <BreadcrumbJerarquia
          niveles={[
            {
              label: "Grano",
              icono: <Gem size={10} />,
              activo: false,
              items: vinculos
                .map((v) => granos.find((g) => g.id === v.grano_id))
                .filter((g): g is Grano => !!g)
                .map((g) => ({ id: g.id, nombre: g.nombre })),
              loading: loadingGranos || loadingVinculos,
              onNavegar: onAbrirGrano,
            },
            { label: "Veta", icono: <Layers size={10} />, activo: true },
            {
              label: "Formación",
              icono: <Boxes size={10} />,
              activo: false,
              items: formacionesQueUsanEstaVeta.items.map((v) => ({
                id: v.formacion_id,
                nombre: v.formacion.nombre,
              })),
              loading: formacionesQueUsanEstaVeta.loading,
              onNavegar: onAbrirFormacion,
            },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {errorEliminar && <ErrorBanner texto={errorEliminar} />}

        <input
          className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none placeholder:text-primary/25"
          placeholder="Función…"
          value={item.funcion ?? ""}
          onChange={(e) => onActualizar(item.id, { funcion: e.target.value })}
        />

        <div>
          <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
            Granos · {vinculos.length}
          </p>
          <ListaGranosDeVeta
            vinculos={vinculos}
            loading={loadingVinculos}
            granos={granos}
            onQuitar={quitarGrano}
            onAbrirGrano={onAbrirGrano}
          />
          <div className="mt-2">
            <SelectorGranoParaAgregar
              granos={granos.filter((g) => !granosUsados.has(g.id))}
              loadingGranos={loadingGranos}
              agregando={agregando}
              onElegir={agregarGrano}
            />
          </div>
        </div>

        <NotasField
          value={item.notas ?? ""}
          onChange={(notas) => onActualizar(item.id, { notas })}
        />

        <NotaReutilizable />
      </div>
    </PanelFlotanteBase>
  );
}

/** Lista de Granos que componen una Veta — cada fila con nombre y botón quitar. */
function ListaGranosDeVeta({
  vinculos,
  loading,
  granos,
  onQuitar,
  onAbrirGrano,
}: {
  vinculos: Array<{ vinculo_id: string; grano_id: string; cantidad: number | null; proporcion: number | null }>;
  loading: boolean;
  granos: Grano[];
  onQuitar: (vinculoId: string) => void;
  onAbrirGrano?: (granoId: string) => void;
}) {
  if (loading && vinculos.length === 0) {
    return <p className="text-micro text-primary/25 italic py-1">Cargando…</p>;
  }
  if (vinculos.length === 0) {
    return <p className="text-micro text-primary/25 italic py-1">Sin granos todavía</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {vinculos.map((v) => {
        const grano = granos.find((g) => g.id === v.grano_id);
        return (
          <div
            key={v.vinculo_id}
            className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/10"
          >
            <Gem size={12} className="text-accent/60 shrink-0" />
            <button
              type="button"
              onClick={() => onAbrirGrano?.(v.grano_id)}
              disabled={!onAbrirGrano}
              className="flex-1 min-w-0 truncate text-left text-micro font-bold text-primary/80 disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
            >
              {grano?.nombre || "Sin nombre"}
            </button>
            <button
              type="button"
              onClick={() => onQuitar(v.vinculo_id)}
              title="Quitar"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Buscador simple para agregar un Grano nuevo a la lista de una Veta
 *  (no reemplaza, solo agrega — contraparte "agregar" del SelectorGrano
 *  singular que existía antes de Fase 4). No crea Granos nuevos desde
 *  acá — para eso está el botón "Nuevo" de la grid. */
function SelectorGranoParaAgregar({
  granos,
  loadingGranos,
  agregando,
  onElegir,
}: {
  granos: Grano[];
  loadingGranos?: boolean;
  agregando?: boolean;
  onElegir: (granoId: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return granos;
    return granos.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [granos, busqueda]);

  function elegir(g: Grano) {
    onElegir(g.id);
    setAbierto(false);
    setBusqueda("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtrados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % filtrados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + filtrados.length) % filtrados.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const g = filtrados[activo];
      if (g) elegir(g);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={agregando}
        className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
      >
        <Plus size={10} /> Agregar grano
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/15">
        <Search size={12} className="text-primary/30 shrink-0" />
        <input
          autoFocus
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setActivo(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          placeholder={loadingGranos ? "Cargando…" : "Buscar grano…"}
          className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
        />
        <button
          type="button"
          onMouseDown={() => setAbierto(false)}
          title="Cancelar"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/30 hover:text-primary transition-colors cursor-pointer"
        >
          <X size={10} />
        </button>
      </div>

      <div
        className="absolute z-20 mt-1 left-0 right-0 max-h-48 overflow-y-auto rounded-md border shadow-lg"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
        }}
      >
        {filtrados.length === 0 ? (
          <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
        ) : (
          filtrados.slice(0, 30).map((g, i) => (
            <button
              key={g.id}
              type="button"
              onMouseEnter={() => setActivo(i)}
              onMouseDown={() => elegir(g)}
              className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold transition-colors truncate ${
                i === activo ? "bg-primary/10 text-primary" : "text-primary/75 hover:bg-primary/6 hover:text-primary"
              }`}
            >
              {g.nombre || "Sin nombre"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Piezas chicas compartidas ──────────────────────────────────────────────

function PanelFlotanteBase({
  children,
  onCerrar,
}: {
  children: React.ReactNode;
  onCerrar: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCerrar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Header estándar del panel flotante grande — mismo look que
 * ElementoPanelFlotante/CompuestoPanelFlotante: cuadro con ícono a la
 * izquierda, input de nombre grande, botón eliminar y botón cerrar a la
 * derecha. A diferencia de Elemento/Compuesto (que publican headerControls
 * con botón "Guardar" explícito), acá se mantiene el autosave on-change ya
 * existente en Grano/Veta — solo se iguala la cáscara visual.
 */
function PanelFlotanteHeader({
  icono,
  nombre,
  placeholder,
  onChangeNombre,
  onEliminar,
  eliminando,
  onCerrar,
}: {
  icono: React.ReactNode;
  nombre: string;
  placeholder: string;
  onChangeNombre: (nombre: string) => void;
  onEliminar: () => void;
  eliminando?: boolean;
  onCerrar: () => void;
}) {
  return (
    <div
      className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        background: "color-mix(in srgb, var(--primary) 3%, transparent)",
      }}
    >
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
        style={{
          background: "color-mix(in srgb, var(--primary) 8%, transparent)",
          borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
        }}
      >
        {icono}
      </div>
      <input
        className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
        placeholder={placeholder}
        value={nombre}
        onChange={(e) => onChangeNombre(e.target.value)}
      />
      <button
        type="button"
        onClick={onEliminar}
        disabled={eliminando}
        title="Eliminar"
        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all disabled:opacity-40 cursor-pointer"
      >
        <Trash2 size={10} />
      </button>
      <button
        type="button"
        onClick={onCerrar}
        title="Cerrar (Esc)"
        className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors cursor-pointer"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function ErrorBanner({ texto }: { texto: string }) {
  return (
    <p className="text-micro text-red-500/80 bg-red-500/5 border border-red-500/15 rounded-md px-2 py-1.5">
      {texto}
    </p>
  );
}

function NotasField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">Notas</p>
      <textarea
        className="w-full min-h-[4rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none placeholder:text-primary/25"
        placeholder="Notas…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NotaReutilizable() {
  return (
    <p className="text-micro text-primary/25 italic">
      Reutilizable: se puede vincular a varias Formaciones desde el botón &quot;Usar existente&quot;
      en la fórmula de cada Formación.
    </p>
  );
}

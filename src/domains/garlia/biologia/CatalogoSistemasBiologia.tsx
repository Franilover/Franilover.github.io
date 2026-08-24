"use client";

/**
 * CatalogoSistemasBiologia.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Biblioteca global de Sistemas y Organismos — mismo patrón que
 * CatalogoTejidosBiologia.tsx, un nivel más arriba en la cadena:
 *   Célula → Tejido → Órgano → Sistema → Organismo
 *
 * Fase 5 (ago-2026): Sistema y Organismo son catálogos simples (nombre/
 * descripción/notas, sin fórmula propia) vinculados M:N:
 *   - sistema_organos     (useSistemaOrganos)     → qué Órganos forman el Sistema
 *   - organismo_sistemas  (useOrganismoSistemas)  → qué Sistemas forman el Organismo
 *
 * Diferencia clave frente a organo_tejidos/tejido_celulas: sistema_organos
 * NO tiene columna `rol` ni `proporcion` (pertenencia simple, ej. "corazón
 * pertenece a Sistema circulatorio" no necesita ponderarse) — por eso el
 * panel de Sistema usa una lista de vínculos más simple (ListaVinculosSimple)
 * en vez de ListaVinculosMN, que exige `rol`. organismo_sistemas sí tiene
 * `proporcion` (igual que organo_tejidos), así que el panel de Organismo
 * reutiliza esa forma con un input de proporción en vez de rol.
 *
 * Mismo lenguaje visual que CatalogoTejidosBiologia/GridCatalogoGrupo.
 */

import { Boxes, Layers, Plus, Trash2, X, Search } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useConfirm } from "@/ui/ConfirmModal";
import { supabase } from "@/infra/supabase/supabase";
import { useSistemas } from "@/domains/garlia/elementos/useSistemas";
import { useOrganismos } from "@/domains/garlia/elementos/useOrganismos";
import { useSistemaOrganos, type OrganoDeSistema } from "@/domains/garlia/elementos/useSistemaOrganos";
import {
  useOrganismoSistemas,
  type SistemaDeOrganismo,
} from "@/domains/garlia/elementos/useOrganismoSistemas";
import { useSistemasDeUnOrgano } from "@/domains/garlia/elementos/useSistemasDeUnOrgano";
import type { Organismo, Organo, Sistema } from "@/domains/garlia/elementos/types";
import { BreadcrumbJerarquia } from "./BreadcrumbJerarquia";

interface Props {
  organos: Organo[];
  loadingOrganos?: boolean;
  /** Navegar al Órgano elegido — el padre (BiologiaPage) decide cómo abrir
   *  su editor, ya que el Órgano vive fuera de este catálogo. */
  onAbrirOrgano?: (organoId: string) => void;
}

export function CatalogoSistemasBiologia({ organos, loadingOrganos, onAbrirOrgano }: Props) {
  const sistemas = useSistemas();
  const organismos = useOrganismos();

  const [sistemaSeleccionadoId, setSistemaSeleccionadoId] = useState<string | null>(null);
  const [organismoSeleccionadoId, setOrganismoSeleccionadoId] = useState<string | null>(null);

  const [creandoSistema, setCreandoSistema] = useState(false);
  const [creandoOrganismo, setCreandoOrganismo] = useState(false);

  const sistemaActivo = sistemas.items.find((s) => s.id === sistemaSeleccionadoId) ?? null;
  const organismoActivo = organismos.items.find((o) => o.id === organismoSeleccionadoId) ?? null;

  async function crearSistema() {
    setCreandoSistema(true);
    try {
      const { data: nuevo, error } = await supabase
        .from("sistemas")
        .insert([{ nombre: "Nuevo sistema" }])
        .select()
        .single();
      if (!error && nuevo) {
        sistemas.setItems((prev) => [...prev, nuevo as Sistema]);
      }
    } finally {
      setCreandoSistema(false);
    }
  }

  async function crearOrganismo() {
    setCreandoOrganismo(true);
    try {
      const { data: nuevo, error } = await supabase
        .from("organismos")
        .insert([{ nombre: "Nuevo organismo" }])
        .select()
        .single();
      if (!error && nuevo) {
        organismos.setItems((prev) => [...prev, nuevo as Organismo]);
      }
    } finally {
      setCreandoOrganismo(false);
    }
  }

  async function actualizarSistema(id: string, cambios: Partial<Sistema>) {
    sistemas.setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
    const { error } = await supabase.from("sistemas").update(cambios).eq("id", id);
    if (error) console.error("[CatalogoSistemasBiologia] error actualizando sistema:", error);
  }

  async function actualizarOrganismo(id: string, cambios: Partial<Organismo>) {
    organismos.setItems((prev) => prev.map((o) => (o.id === id ? { ...o, ...cambios } : o)));
    const { error } = await supabase.from("organismos").update(cambios).eq("id", id);
    if (error) console.error("[CatalogoSistemasBiologia] error actualizando organismo:", error);
  }

  async function eliminarSistema(id: string): Promise<{ ok: boolean; error: unknown }> {
    const { error } = await supabase.from("sistemas").delete().eq("id", id);
    if (error) return { ok: false, error };
    sistemas.setItems((prev) => prev.filter((s) => s.id !== id));
    return { ok: true, error: null };
  }

  async function eliminarOrganismo(id: string): Promise<{ ok: boolean; error: unknown }> {
    const { error } = await supabase.from("organismos").delete().eq("id", id);
    if (error) return { ok: false, error };
    organismos.setItems((prev) => prev.filter((o) => o.id !== id));
    return { ok: true, error: null };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Sistemas ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Sistemas · {sistemas.items.length}
          </p>
          <button
            type="button"
            onClick={() => void crearSistema()}
            disabled={creandoSistema}
            title="Crear sistema nuevo"
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus size={10} /> Nuevo
          </button>
        </div>

        <GridSimple
          items={sistemas.items}
          loading={sistemas.loading}
          icono={<Layers size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={sistemaSeleccionadoId}
          onSeleccionar={setSistemaSeleccionadoId}
          labelVacio="sistemas"
        />

        {sistemaActivo && (
          <PanelEditorSistema
            item={sistemaActivo}
            organos={organos}
            loadingOrganos={loadingOrganos}
            onCerrar={() => setSistemaSeleccionadoId(null)}
            onActualizar={actualizarSistema}
            onEliminar={eliminarSistema}
            onAbrirOrgano={
              onAbrirOrgano
                ? (organoId) => {
                    setSistemaSeleccionadoId(null);
                    onAbrirOrgano(organoId);
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* ── Organismos ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-primary/10 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Organismos · {organismos.items.length}
          </p>
          <button
            type="button"
            onClick={() => void crearOrganismo()}
            disabled={creandoOrganismo}
            title="Crear organismo nuevo"
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus size={10} /> Nuevo
          </button>
        </div>

        <GridSimple
          items={organismos.items}
          loading={organismos.loading}
          icono={<Boxes size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={organismoSeleccionadoId}
          onSeleccionar={setOrganismoSeleccionadoId}
          labelVacio="organismos"
        />

        {organismoActivo && (
          <PanelEditorOrganismo
            item={organismoActivo}
            sistemas={sistemas.items}
            loadingSistemas={sistemas.loading}
            onCerrar={() => setOrganismoSeleccionadoId(null)}
            onActualizar={actualizarOrganismo}
            onEliminar={eliminarOrganismo}
            onAbrirSistema={(sistemaId) => {
              setOrganismoSeleccionadoId(null);
              setSistemaSeleccionadoId(sistemaId);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Grid genérica (idéntica a CatalogoTejidosBiologia.GridSimple) ────────

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
    <div className="grid grid-cols-3 gap-2 items-start">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSeleccionar(item.id)}
          className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
            seleccionadoId === item.id
              ? "border-primary/30 bg-primary/5"
              : "border-primary/10 bg-primary/[0.02] hover:border-primary/25 hover:bg-primary/5"
          }`}
        >
          {icono}
          <span className="text-micro font-black text-primary truncate">
            {item.nombre || "(sin nombre)"}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Panel Sistema: nombre, descripción, notas, Órganos (M:N vía
// sistema_organos — SIN rol/proporción, pertenencia simple) ───────────────

function PanelEditorSistema({
  item,
  organos,
  loadingOrganos,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirOrgano,
}: {
  item: Sistema;
  organos: Organo[];
  loadingOrganos?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Sistema>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  onAbrirOrgano?: (organoId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const vinculosOrgano = useSistemaOrganos(item.id);

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar sistema",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si algún Organismo lo usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente algún Organismo todavía lo usa. Quitalo de ahí primero.",
      );
    }
  }

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
              label: "Órgano",
              icono: <Boxes size={10} />,
              activo: false,
              items: vinculosOrgano.items.map((v) => ({ id: v.organo_id, nombre: v.organo.nombre })),
              loading: vinculosOrgano.loading,
              onNavegar: onAbrirOrgano,
            },
            { label: "Sistema", icono: <Layers size={10} />, activo: true },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {errorEliminar && <ErrorBanner texto={errorEliminar} />}

        <div className="flex flex-col md:flex-row gap-3 md:gap-5 mt-1">
          <div className="md:w-1/2 min-w-0">
            <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
              Órganos · qué forma el sistema
            </p>
            <ListaVinculosSimple<OrganoDeSistema>
              items={vinculosOrgano.items}
              loading={vinculosOrgano.loading}
              catalogo={organos}
              loadingCatalogo={loadingOrganos}
              getNombre={(v) => v.organo.nombre}
              getCatalogoId={(v) => v.organo_id}
              iconoCatalogo={<Boxes size={11} className="text-accent/60 shrink-0" />}
              onAgregar={(organoId) => void vinculosOrgano.vincularExistente(organoId)}
              onQuitar={vinculosOrgano.quitar}
              onAbrirItem={onAbrirOrgano}
            />
          </div>

          <div className="md:w-1/2 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
                Descripción
              </p>
              <input
                className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none placeholder:text-primary/25"
                placeholder="Descripción…"
                value={item.descripcion ?? ""}
                onChange={(e) => onActualizar(item.id, { descripcion: e.target.value })}
              />
            </div>

            <NotasField value={item.notas ?? ""} onChange={(notas) => onActualizar(item.id, { notas })} />

            <NotaReutilizable label="Organismos" />
          </div>
        </div>
      </div>
    </PanelFlotanteBase>
  );
}

// ─── Panel Organismo: nombre, descripción, notas, Sistemas (M:N vía
// organismo_sistemas — CON proporción, igual que organo_tejidos) ──────────

function PanelEditorOrganismo({
  item,
  sistemas,
  loadingSistemas,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirSistema,
}: {
  item: Organismo;
  sistemas: Sistema[];
  loadingSistemas?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Organismo>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  onAbrirSistema?: (sistemaId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const vinculosSistema = useOrganismoSistemas(item.id);

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar organismo",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar("No se pudo eliminar el organismo. Intentá de nuevo.");
    }
  }

  return (
    <PanelFlotanteBase onCerrar={onCerrar}>
      <ConfirmModal />
      <PanelFlotanteHeader
        icono={<Boxes className="text-primary/50" size={12} />}
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
              label: "Sistema",
              icono: <Layers size={10} />,
              activo: false,
              items: vinculosSistema.items.map((v) => ({ id: v.sistema_id, nombre: v.sistema.nombre })),
              loading: vinculosSistema.loading,
              onNavegar: onAbrirSistema,
            },
            { label: "Organismo", icono: <Boxes size={10} />, activo: true },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {errorEliminar && <ErrorBanner texto={errorEliminar} />}

        <div className="flex flex-col md:flex-row gap-3 md:gap-5 mt-1">
          <div className="md:w-1/2 min-w-0">
            <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
              Sistemas · qué forma el organismo
            </p>
            <ListaVinculosProporcion<SistemaDeOrganismo>
              items={vinculosSistema.items}
              loading={vinculosSistema.loading}
              catalogo={sistemas}
              loadingCatalogo={loadingSistemas}
              getNombre={(v) => v.sistema.nombre}
              getCatalogoId={(v) => v.sistema_id}
              proporcionPlaceholder="Proporción (ej. 1, 2)…"
              iconoCatalogo={<Layers size={11} className="text-accent/60 shrink-0" />}
              onAgregar={(sistemaId) => void vinculosSistema.vincularExistente(sistemaId)}
              onActualizarProporcion={vinculosSistema.actualizarProporcion}
              onQuitar={vinculosSistema.quitar}
              onAbrirItem={onAbrirSistema}
            />
          </div>

          <div className="md:w-1/2 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
                Descripción
              </p>
              <input
                className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none placeholder:text-primary/25"
                placeholder="Descripción…"
                value={item.descripcion ?? ""}
                onChange={(e) => onActualizar(item.id, { descripcion: e.target.value })}
              />
            </div>

            <NotasField value={item.notas ?? ""} onChange={(notas) => onActualizar(item.id, { notas })} />
          </div>
        </div>
      </div>
    </PanelFlotanteBase>
  );
}

// ─── ListaVinculosSimple: como ListaVinculosMN pero sin campo de rol —
// para sistema_organos, que no tiene esa columna. ─────────────────────────

interface VinculoConId {
  vinculo_id: string;
}

function ListaVinculosSimple<T extends VinculoConId>({
  items,
  loading,
  catalogo,
  loadingCatalogo,
  getNombre,
  getCatalogoId,
  iconoCatalogo,
  onAgregar,
  onQuitar,
  onAbrirItem,
}: {
  items: T[];
  loading: boolean;
  catalogo: { id: string; nombre: string }[];
  loadingCatalogo?: boolean;
  getNombre: (v: T) => string;
  getCatalogoId: (v: T) => string;
  iconoCatalogo?: React.ReactNode;
  onAgregar: (catalogoId: string) => void;
  onQuitar: (vinculoId: string) => void;
  onAbrirItem?: (catalogoId: string) => void;
}) {
  const [buscando, setBuscando] = useState(false);

  const yaVinculadosIds = useMemo(() => new Set(items.map(getCatalogoId)), [items, getCatalogoId]);
  const disponibles = useMemo(
    () => catalogo.filter((c) => !yaVinculadosIds.has(c.id)),
    [catalogo, yaVinculadosIds],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {loading ? (
        <p className="text-micro text-primary/25 italic py-1">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-1">Sin vínculos todavía</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((v) => (
            <div
              key={v.vinculo_id}
              className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/10"
            >
              {iconoCatalogo}
              <button
                type="button"
                onClick={() => onAbrirItem?.(getCatalogoId(v))}
                disabled={!onAbrirItem}
                className="flex-1 min-w-0 truncate text-left text-micro font-bold text-primary/80 disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
              >
                {getNombre(v) || "Sin nombre"}
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
          ))}
        </div>
      )}

      {buscando ? (
        <PickerCatalogoExistente
          disponibles={disponibles}
          loading={loadingCatalogo}
          onElegir={(id) => {
            onAgregar(id);
            setBuscando(false);
          }}
          onClose={() => setBuscando(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setBuscando(true)}
          className="flex items-center gap-1 self-start text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors cursor-pointer"
        >
          <Plus size={10} /> Agregar
        </button>
      )}
    </div>
  );
}

// ─── ListaVinculosProporcion: como ListaVinculosSimple pero con input de
// proporción — para organismo_sistemas, que sí tiene esa columna. ─────────

interface VinculoConProporcion {
  vinculo_id: string;
  proporcion: string | null;
}

function ListaVinculosProporcion<T extends VinculoConProporcion>({
  items,
  loading,
  catalogo,
  loadingCatalogo,
  getNombre,
  getCatalogoId,
  proporcionPlaceholder,
  iconoCatalogo,
  onAgregar,
  onActualizarProporcion,
  onQuitar,
  onAbrirItem,
}: {
  items: T[];
  loading: boolean;
  catalogo: { id: string; nombre: string }[];
  loadingCatalogo?: boolean;
  getNombre: (v: T) => string;
  getCatalogoId: (v: T) => string;
  proporcionPlaceholder: string;
  iconoCatalogo?: React.ReactNode;
  onAgregar: (catalogoId: string) => void;
  onActualizarProporcion: (vinculoId: string, proporcion: string) => void;
  onQuitar: (vinculoId: string) => void;
  onAbrirItem?: (catalogoId: string) => void;
}) {
  const [buscando, setBuscando] = useState(false);

  const yaVinculadosIds = useMemo(() => new Set(items.map(getCatalogoId)), [items, getCatalogoId]);
  const disponibles = useMemo(
    () => catalogo.filter((c) => !yaVinculadosIds.has(c.id)),
    [catalogo, yaVinculadosIds],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {loading ? (
        <p className="text-micro text-primary/25 italic py-1">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-1">Sin vínculos todavía</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((v) => (
            <div
              key={v.vinculo_id}
              className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/10"
            >
              {iconoCatalogo}
              <button
                type="button"
                onClick={() => onAbrirItem?.(getCatalogoId(v))}
                disabled={!onAbrirItem}
                className="shrink-0 max-w-[45%] truncate text-left text-micro font-bold text-primary/80 disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
              >
                {getNombre(v) || "Sin nombre"}
              </button>
              <input
                value={v.proporcion ?? ""}
                onChange={(e) => onActualizarProporcion(v.vinculo_id, e.target.value)}
                placeholder={proporcionPlaceholder}
                className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-micro text-primary/60 outline-none placeholder:text-primary/25"
              />
              <button
                type="button"
                onClick={() => onQuitar(v.vinculo_id)}
                title="Quitar"
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {buscando ? (
        <PickerCatalogoExistente
          disponibles={disponibles}
          loading={loadingCatalogo}
          onElegir={(id) => {
            onAgregar(id);
            setBuscando(false);
          }}
          onClose={() => setBuscando(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setBuscando(true)}
          className="flex items-center gap-1 self-start text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors cursor-pointer"
        >
          <Plus size={10} /> Agregar
        </button>
      )}
    </div>
  );
}

function PickerCatalogoExistente({
  disponibles,
  loading,
  onElegir,
  onClose,
}: {
  disponibles: { id: string; nombre: string }[];
  loading?: boolean;
  onElegir: (id: string) => void;
  onClose: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((d) => d.nombre.toLowerCase().includes(q));
  }, [disponibles, busqueda]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/15">
        <Search size={12} className="text-primary/30 shrink-0" />
        <input
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onBlur={() => setTimeout(onClose, 120)}
          placeholder={loading ? "Cargando…" : "Buscar para vincular…"}
          className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
        />
        <button
          type="button"
          onMouseDown={onClose}
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
          filtrados.slice(0, 30).map((d) => (
            <button
              key={d.id}
              type="button"
              onMouseDown={() => onElegir(d.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate"
            >
              {d.nombre || "Sin nombre"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Piezas chicas compartidas (idénticas a CatalogoTejidosBiologia) ──────

function PanelFlotanteBase({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
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

function NotaReutilizable({ label }: { label: string }) {
  return (
    <p className="text-micro text-primary/25 italic">
      Reutilizable: se puede vincular a varios {label} desde el botón &quot;Agregar&quot; de cada uno.
    </p>
  );
}

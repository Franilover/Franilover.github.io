"use client";

/**
 * PerfilAtomicoCriaturaPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * "Perfil atómico" de una criatura, tratada como un compuesto vivo: reusa
 * TAL CUAL el motor de afinidad.ts de Elementos (calcularPerfilAtomico,
 * calcularBalancePorCapa, calcularReactividad, calcularPeso) — la criatura
 * es un Compuesto más (mismo shape ComponenteCompuesto: elemento_id +
 * cantidad), solo que sus "componentes" se guardan en
 * perfiles_atomicos_criatura en vez de en la tabla compuestos.
 *
 * También vincula qué Oris (Física) canaliza/metaboliza la criatura —
 * enlace simple por id, sin motor propio (Oris no tiene capas como
 * Elementos).
 */

import { Atom, Bug, Plus, Search, X, Zap } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  calcularBalancePorCapa,
  calcularPerfilAtomico,
  calcularPeso,
  calcularReactividad,
} from "@/domains/garlia/elementos/afinidad";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import {
  LAYER_LABEL,
  PARTICLE_INITIAL,
  REACTIVIDAD_LABEL,
  formatLayer,
  type Compuesto,
  type ComponenteCompuesto,
  type Elemento,
  type LayerName,
} from "@/domains/garlia/elementos/types";
import { useOris } from "@/domains/garlia/fisica/useFisica";
import { useCriaturasCatalogoMin } from "@/domains/garlia/runas/useCriaturasCatalogoMin";
import { useCriaturasPorIds } from "@/domains/garlia/runas/useCriaturasPorIds";

import { usePerfilesAtomicosCriatura } from "./useBiologia";

const LAYERS: LayerName[] = ["nucleo", "media", "externa"];

// ─── Barra de balance de una capa ───────────────────────────────────────────

function BarraCapa({
  layer,
  perfil,
  total,
  capacidad,
}: {
  layer: LayerName;
  perfil: Record<string, number | undefined>;
  total: number;
  capacidad: number;
}) {
  const balance = total - capacidad;
  const pct = capacidad > 0 ? Math.min(100, (total / capacidad) * 100) : 0;

  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-micro font-black uppercase tracking-wide text-primary/50">
          {LAYER_LABEL[layer]}
        </span>
        <span className="text-micro font-bold text-primary/40">
          {total}/{capacidad}{" "}
          {balance === 0 ? "(saturada)" : balance > 0 ? `(+${balance})` : `(${balance})`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-primary/8 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            balance < 0 ? "bg-amber-400/60" : balance > 0 ? "bg-accent/60" : "bg-emerald-400/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-micro text-primary/35 mt-0.5 block">{formatLayer(perfil)}</span>
    </div>
  );
}

// ─── Selector de elementos componentes (mismo patrón buscador que criaturas) ─

function BuscadorElemento({
  elementos,
  excluirIds,
  onSelect,
}: {
  elementos: Elemento[];
  excluirIds: string[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const disponibles = useMemo(
    () =>
      elementos.filter(
        (e) => !excluirIds.includes(e.id) && e.nombre.toLowerCase().includes(search.toLowerCase()),
      ),
    [elementos, excluirIds, search],
  );

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 224);
      const espacioAbajo = window.innerHeight - r.bottom;
      const abreHaciaArriba = espacioAbajo < 260 && r.top > espacioAbajo;
      setPos({
        left: Math.min(r.left, window.innerWidth - width - 8),
        top: abreHaciaArriba ? r.top - 4 : r.bottom + 4,
        width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setSearch("");
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const abreHaciaArriba =
    pos != null && triggerRef.current ? pos.top < triggerRef.current.getBoundingClientRect().top : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
          color: "color-mix(in srgb, var(--primary) 35%, transparent)",
        }}
      >
        <Plus size={8} /> Añadir elemento
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl border shadow-xl overflow-hidden"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transform: abreHaciaArriba ? "translateY(-100%)" : undefined,
              maxHeight: "min(320px, calc(100vh - 16px))",
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
            >
              <Search size={11} style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)", flexShrink: 0 }} />
              <input
                autoFocus
                className="flex-1 bg-transparent outline-none text-micro font-bold uppercase tracking-wide placeholder:normal-case placeholder:font-medium placeholder:tracking-normal"
                placeholder="Buscar elemento…"
                style={{ color: "var(--primary)", caretColor: "var(--primary)" }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setOpen(false), setSearch(""))}
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {disponibles.length === 0 ? (
                <p className="text-micro text-primary/25 italic text-center py-3">
                  {search ? "Sin resultados" : "No hay más elementos"}
                </p>
              ) : (
                disponibles.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate"
                    onMouseDown={() => {
                      onSelect(e.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="shrink-0 text-primary/30">{e.simbolo}</span>
                    <span className="truncate">{e.nombre}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── Panel de una criatura individual ───────────────────────────────────────

function PanelPerfilCriatura({
  criaturaId,
  criaturaNombre,
  elementos,
  orisDisponibles,
}: {
  criaturaId: string;
  criaturaNombre: string;
  elementos: Elemento[];
  orisDisponibles: { id: string; nombre: string }[];
}) {
  const { perfiles, obtenerOCrear, actualizar } = usePerfilesAtomicosCriatura();
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [componentes, setComponentes] = useState<ComponenteCompuesto[]>([]);
  const [orisIds, setOrisIds] = useState<string[]>([]);
  const [notas, setNotas] = useState("");

  useEffect(() => {
    let cancelado = false;
    void obtenerOCrear(criaturaId).then((p) => {
      if (cancelado || !p) return;
      setPerfilId(p.id);
      setComponentes(p.componentes ?? []);
      setOrisIds(p.oris_ids ?? []);
      setNotas(p.notas ?? "");
    });
    return () => {
      cancelado = true;
    };
  }, [criaturaId]);

  const guardar = (patch: {
    componentes?: ComponenteCompuesto[];
    oris_ids?: string[];
    notas?: string;
  }) => {
    if (!perfilId) return;
    void actualizar(perfilId, patch);
  };

  const compuestoTemporal: Compuesto = useMemo(
    () => ({ id: criaturaId, nombre: criaturaNombre, componentes }),
    [criaturaId, criaturaNombre, componentes],
  );

  const perfilAtomico = useMemo(
    () => calcularPerfilAtomico(compuestoTemporal, elementos),
    [compuestoTemporal, elementos],
  );
  const balance = useMemo(() => calcularBalancePorCapa(perfilAtomico), [perfilAtomico]);
  const reactividad = useMemo(
    () => calcularReactividad(compuestoTemporal, elementos),
    [compuestoTemporal, elementos],
  );
  const peso = useMemo(() => calcularPeso(compuestoTemporal, elementos), [compuestoTemporal, elementos]);

  const agregarElemento = (elementoId: string) => {
    const next = [...componentes, { elemento_id: elementoId, cantidad: 1 }];
    setComponentes(next);
    guardar({ componentes: next });
  };
  const quitarElemento = (elementoId: string) => {
    const next = componentes.filter((c) => c.elemento_id !== elementoId);
    setComponentes(next);
    guardar({ componentes: next });
  };
  const cambiarCantidad = (elementoId: string, cantidad: number) => {
    const next = componentes.map((c) =>
      c.elemento_id === elementoId ? { ...c, cantidad: Math.max(1, cantidad) } : c,
    );
    setComponentes(next);
    guardar({ componentes: next });
  };

  const toggleOris = (orisId: string) => {
    const next = orisIds.includes(orisId)
      ? orisIds.filter((id) => id !== orisId)
      : [...orisIds, orisId];
    setOrisIds(next);
    guardar({ oris_ids: next });
  };

  if (!perfilId) {
    return <div className="py-4 text-xs text-primary/30 text-center">Cargando perfil…</div>;
  }

  return (
    <div>
      {/* Componentes elementales */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
            Composición elemental
          </span>
          <BuscadorElemento
            elementos={elementos}
            excluirIds={componentes.map((c) => c.elemento_id)}
            onSelect={agregarElemento}
          />
        </div>

        {componentes.length === 0 ? (
          <p className="text-micro text-primary/25 italic py-1">Sin elementos asignados todavía</p>
        ) : (
          <div className="space-y-1.5">
            {componentes.map((c) => {
              const el = elementos.find((e) => e.id === c.elemento_id);
              if (!el) return null;
              return (
                <div
                  key={c.elemento_id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-primary/10 bg-primary/[0.02]"
                >
                  <span className="text-xs font-bold text-primary/80 flex-1 truncate">
                    {el.nombre} <span className="text-primary/30">({el.simbolo})</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    className="w-14 bg-transparent text-xs text-center text-primary/70 outline-none border border-primary/10 rounded px-1 py-0.5"
                    value={c.cantidad}
                    onChange={(e) => cambiarCantidad(c.elemento_id, Number(e.target.value) || 1)}
                  />
                  <button
                    type="button"
                    onClick={() => quitarElemento(c.elemento_id)}
                    className="shrink-0 p-1 rounded-md text-primary/25 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Balance por capa */}
      {componentes.length > 0 && (
        <div className="mb-4 p-3 rounded-xl border border-primary/10 bg-primary/[0.02]">
          {LAYERS.map((layer) => {
            const b = balance.find((x) => x.layer === layer)!;
            return (
              <BarraCapa
                key={layer}
                layer={layer}
                perfil={perfilAtomico[layer]}
                total={b.total}
                capacidad={b.capacidad}
              />
            );
          })}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
            <span className="text-micro font-bold text-primary/50">
              Reactividad: <span className="text-primary/80">{REACTIVIDAD_LABEL[reactividad.nivel]}</span>
            </span>
            <span className="text-micro font-bold text-primary/50">
              Peso: <span className="text-primary/80">{peso.pesoTotal} ({peso.categoria})</span>
            </span>
          </div>
        </div>
      )}

      {/* Oris que canaliza/metaboliza */}
      <div className="mb-4">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Oris que metaboliza (Física)
        </span>
        {orisDisponibles.length === 0 ? (
          <p className="text-micro text-primary/25 italic py-1">No hay Oris cargados todavía</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {orisDisponibles.map((o) => {
              const activo = orisIds.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleOris(o.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-micro font-bold transition-colors ${
                    activo
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-primary/10 text-primary/50 hover:border-primary/25"
                  }`}
                >
                  <Zap size={9} />
                  {o.nombre}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Notas libres */}
      <div>
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Notas
        </span>
        <textarea
          className="w-full min-h-[4.5rem] bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs text-primary/70 outline-none placeholder:text-primary/30 resize-y"
          placeholder="Cómo metaboliza estos elementos, comportamiento resultante…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={() => guardar({ notas })}
        />
      </div>
    </div>
  );
}

// ─── Página principal: buscador de criatura + panel ─────────────────────────

export function PerfilesAtomicosPage() {
  const { items: elementos, loading: loadingElementos } = useElementos();
  const { items: oris, loading: loadingOris } = useOris();
  const { criaturas: catalogo, loading: loadingCatalogo } = useCriaturasCatalogoMin();
  const [criaturaId, setCriaturaId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtradas = useMemo(
    () => catalogo.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase())),
    [catalogo, search],
  );

  const criaturaSeleccionada = catalogo.find((c) => c.id === criaturaId) ?? null;

  const orisDisponibles = useMemo(
    () => (oris ?? []).map((o) => ({ id: o.id, nombre: o.nombre })),
    [oris],
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-64 shrink-0">
        <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg border border-primary/10 bg-primary/[0.02]">
          <Search size={11} className="text-primary/30 shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-primary/30"
            placeholder="Buscar criatura…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadingCatalogo ? (
          <div className="py-4 text-xs text-primary/30 text-center">Cargando…</div>
        ) : (
          <div className="space-y-1 max-h-[70vh] overflow-y-auto">
            {filtradas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCriaturaId(c.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition-colors ${
                  c.id === criaturaId
                    ? "bg-primary/10 text-primary"
                    : "text-primary/60 hover:bg-primary/5"
                }`}
              >
                <span className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-primary/8 flex items-center justify-center">
                  {c.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={c.nombre} className="w-full h-full object-cover" src={c.imagen_url} />
                  ) : (
                    <Bug size={9} className="text-primary/25" />
                  )}
                </span>
                <span className="truncate">{c.nombre}</span>
              </button>
            ))}
            {filtradas.length === 0 && (
              <p className="text-micro text-primary/25 italic px-2 py-2">Sin resultados</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {loadingElementos || loadingOris ? (
          <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
        ) : criaturaSeleccionada ? (
          <PanelPerfilCriatura
            key={criaturaSeleccionada.id}
            criaturaId={criaturaSeleccionada.id}
            criaturaNombre={criaturaSeleccionada.nombre}
            elementos={elementos}
            orisDisponibles={orisDisponibles}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/15 p-6 text-center">
            <Atom size={16} className="mx-auto mb-2 text-primary/20" />
            <p className="text-xs text-primary/30">
              Elegí una criatura de la lista para ver o editar su perfil atómico.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

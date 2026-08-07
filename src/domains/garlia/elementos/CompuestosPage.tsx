"use client";

/**
 * CompuestosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sub-tab "Compuestos" dentro de la sección Tabla: catálogo de combinaciones
 * de Elementos (ej. "Agua" = Fluxio + Cristalio, "Fuego" = Plasmio +
 * Reactivo). Mismo patrón visual que ElementosPage — grid de tarjetas +
 * detalle/editor lateral al seleccionar una, sin navegar a otra ruta.
 *
 * Cada compuesto vive en Supabase (tabla "compuestos") y referencia 2+
 * elementos por id con una cantidad cada uno (componentes: jsonb).
 */

import { Beaker, ChevronLeft, Loader2, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

import {
  calcularBalancePorCapa,
  calcularPerfilAtomico,
  ordenarPorAfinidad,
} from "./afinidad";
import {
  AFINIDAD_LABEL,
  LAYER_LABEL,
  type ComponenteCompuesto,
  type Compuesto,
  type Elemento,
  type LayerName,
  type TipoAfinidad,
} from "./types";

interface Props {
  compuestos: Compuesto[];
  elementos: Elemento[];
  loading?: boolean;
  creating?: boolean;
  onCreate?: () => void;
  onActualizar: (id: string, cambios: Partial<Compuesto>) => void;
  onEliminar?: (id: string) => void;
  seleccionarId?: string | null;
}

function nombreElemento(elementos: Elemento[], id: string): string {
  const el = elementos.find((e) => e.id === id);
  return el ? `${el.simbolo || "??"} · ${el.nombre}` : "(elemento eliminado)";
}

/** Tarjeta de compuesto: nombre + símbolo + resumen de sus componentes. */
function CompuestoCasilla({
  compuesto,
  elementos,
  seleccionado,
  onClick,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
  seleccionado?: boolean;
  onClick: () => void;
}) {
  const perfil = useMemo(
    () => calcularPerfilAtomico(compuesto, elementos),
    [compuesto, elementos],
  );
  const balance = useMemo(() => calcularBalancePorCapa(perfil), [perfil]);
  const estable = balance.every((b) => b.balance === 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-stretch gap-0.5 p-1.5 rounded-md border transition-colors text-left ${
        seleccionado
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-micro font-black text-primary/30 tabular-nums">
          {compuesto.componentes?.length ?? 0}×
        </span>
        <div className="flex items-center gap-0.5">
          {estable && (
            <span
              title="Estructura atómica completa"
              className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0 mt-0.5"
            />
          )}
          <Beaker size={10} className="text-accent/60 shrink-0 mt-0.5" />
        </div>
      </div>

      <span className="text-base font-black text-primary text-center leading-none py-0.5">
        {compuesto.simbolo || "??"}
      </span>

      <span className="text-micro font-bold text-primary/80 truncate text-center leading-tight">
        {compuesto.nombre}
      </span>

      <div className="mt-0.5 pt-0.5 border-t border-primary/10 flex flex-col gap-0.5">
        {(compuesto.componentes ?? []).slice(0, 3).map((c) => (
          <span
            key={c.elemento_id}
            className="text-micro text-primary/40 truncate leading-tight"
          >
            <span className="text-primary/25">{c.cantidad}×</span>{" "}
            {nombreElemento(elementos, c.elemento_id)}
          </span>
        ))}
        {(compuesto.componentes?.length ?? 0) > 3 && (
          <span className="text-micro text-primary/25 leading-tight">
            +{(compuesto.componentes?.length ?? 0) - 3} más
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Selector de elementos a combinar: lista de chips clickeables (toggle) con
 * un stepper +/- de cantidad para los ya elegidos. Mismo criterio simple
 * que el resto del panel admin — sin buscador, la tabla es chica (29 max).
 */
function SelectorElementosCompuesto({
  elementos,
  componentes,
  onChange,
}: {
  elementos: Elemento[];
  componentes: ComponenteCompuesto[];
  onChange: (componentes: ComponenteCompuesto[]) => void;
}) {
  const idsElegidos = new Set(componentes.map((c) => c.elemento_id));

  function toggleElemento(id: string) {
    if (idsElegidos.has(id)) {
      onChange(componentes.filter((c) => c.elemento_id !== id));
    } else {
      onChange([...componentes, { elemento_id: id, cantidad: 1 }]);
    }
  }

  function setCantidad(id: string, cantidad: number) {
    onChange(
      componentes.map((c) =>
        c.elemento_id === id ? { ...c, cantidad: Math.max(1, cantidad) } : c,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Elegidos, con stepper de cantidad */}
      {componentes.length > 0 && (
        <div className="flex flex-col gap-1">
          {componentes.map((c) => (
            <div
              key={c.elemento_id}
              className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2 pr-1 py-1 border border-primary/10"
            >
              <span className="flex-1 min-w-0 truncate text-micro font-bold text-primary/80">
                {nombreElemento(elementos, c.elemento_id)}
              </span>
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento_id, c.cantidad - 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  −
                </button>
                <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
                  {c.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento_id, c.cantidad + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => toggleElemento(c.elemento_id)}
                  title="Quitar"
                  className="w-5 h-5 flex items-center justify-center rounded border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disponibles para agregar */}
      <div className="flex flex-wrap gap-1">
        {elementos
          .filter((el) => !idsElegidos.has(el.id))
          .map((el) => (
            <button
              key={el.id}
              type="button"
              onClick={() => toggleElemento(el.id)}
              title={`Agregar ${el.nombre}`}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-micro font-bold border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <span className="font-black">{el.simbolo || "??"}</span>
              <span className="truncate max-w-[80px]">{el.nombre}</span>
            </button>
          ))}
        {elementos.length === 0 && (
          <p className="text-micro text-primary/25">
            Todavía no hay elementos en la Tabla Química para combinar.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Balance atómico del compuesto: suma de partículas por capa contra su
 * capacidad fija (2/4/6) — misma lógica que valencia química real. Muestra
 * dónde le sobra ("superávit", disponible para prestar) y dónde le falta
 * ("déficit", lo que necesita de otro compuesto para estabilizarse).
 */
function BalanceAtomico({
  compuesto,
  elementos,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
}) {
  const perfil = useMemo(
    () => calcularPerfilAtomico(compuesto, elementos),
    [compuesto, elementos],
  );
  const balance = useMemo(() => calcularBalancePorCapa(perfil), [perfil]);

  return (
    <div className="rounded-lg border border-primary/10 overflow-hidden">
      {balance.map((b, i) => (
        <div
          key={b.layer}
          className={`flex items-center gap-1.5 px-2 py-1 bg-primary/[0.02] ${
            i > 0 ? "border-t border-primary/10" : ""
          }`}
        >
          <span className="w-14 shrink-0 text-micro font-bold text-primary/60">
            {LAYER_LABEL[b.layer as LayerName]}
          </span>
          <span className="flex-1 text-micro text-primary/40 tabular-nums">
            {b.total} / {b.capacidad}
          </span>
          <span
            className={`shrink-0 text-micro font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
              b.balance === 0
                ? "text-primary/30"
                : b.balance > 0
                  ? "text-emerald-500 bg-emerald-500/10"
                  : "text-amber-500 bg-amber-500/10"
            }`}
          >
            {b.balance === 0 ? "Completa" : b.balance > 0 ? `+${b.balance} sobra` : `${b.balance} falta`}
          </span>
        </div>
      ))}
    </div>
  );
}

const AFINIDAD_COLOR: Record<TipoAfinidad, string> = {
  complementa: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  compite: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  saturado: "text-primary/40 bg-primary/5 border-primary/10",
  estable: "text-primary/30 bg-primary/[0.02] border-primary/10",
};

/**
 * Lista de afinidad del compuesto activo contra todos los demás del
 * catálogo, ordenada por complementariedad — los que mejor "encajan"
 * (cubren su déficit) primero.
 */
function PanelAfinidad({
  compuesto,
  todosLosCompuestos,
  elementos,
}: {
  compuesto: Compuesto;
  todosLosCompuestos: Compuesto[];
  elementos: Elemento[];
}) {
  const resultados = useMemo(
    () => ordenarPorAfinidad(compuesto, todosLosCompuestos, elementos),
    [compuesto, todosLosCompuestos, elementos],
  );

  if (todosLosCompuestos.length <= 1) {
    return (
      <p className="text-micro text-primary/25">
        Creá otro compuesto para ver con cuáles tiene afinidad.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {resultados.map(({ compuesto: otro, afinidad }) => (
        <div
          key={otro.id}
          className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md border ${AFINIDAD_COLOR[afinidad.tipo]}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-micro font-black truncate">
              {otro.simbolo || "??"} · {otro.nombre}
            </span>
            <span className="shrink-0 text-micro font-black uppercase tracking-wide">
              {AFINIDAD_LABEL[afinidad.tipo]}
            </span>
          </div>
          <p className="text-micro opacity-80 leading-snug">{afinidad.motivo}</p>
        </div>
      ))}
    </div>
  );
}

/** Detalle editable de un compuesto — mismo criterio que ElementoEditor. */
function CompuestoEditor({
  compuesto,
  elementos,
  todosLosCompuestos,
  onBack,
  onActualizar,
  onEliminar,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
  todosLosCompuestos: Compuesto[];
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<Compuesto>) => void;
  onEliminar?: (id: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(compuesto);

  React.useEffect(() => setLocal(compuesto), [compuesto]);

  async function persist(cambios: Partial<Compuesto>) {
    setSaving(true);
    try {
      const { error } = await supabase.from("compuestos").update(cambios).eq("id", compuesto.id);
      if (error) throw error;
      onActualizar(compuesto.id, cambios);
    } catch (e) {
      console.error("[CompuestoEditor] error guardando:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />
      <div
        style={{ background: "var(--bg-main)" }}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
      >
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <ChevronLeft size={12} />
        </button>

        <input
          value={local.nombre ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, nombre: e.target.value }))}
          onBlur={() => persist({ nombre: local.nombre })}
          placeholder="Nombre del compuesto"
          className="flex-1 min-w-0 bg-transparent text-micro font-black text-primary outline-none placeholder:text-primary/25"
        />

        <input
          value={local.simbolo ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, simbolo: e.target.value }))}
          onBlur={() => persist({ simbolo: local.simbolo })}
          placeholder="Sm"
          maxLength={4}
          className="shrink-0 w-12 text-center bg-primary/5 rounded-md px-1 py-0.5 text-micro font-black text-primary outline-none placeholder:text-primary/25 border border-primary/10"
        />

        <div className="shrink-0 flex items-center gap-1">
          {onEliminar && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: "Eliminar compuesto",
                  message: `¿Eliminar "${local.nombre}"? Esta acción no se puede deshacer.`,
                });
                if (ok) onEliminar(compuesto.id);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
              title="Eliminar"
            >
              <Trash2 size={11} />
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              persist({
                nombre: local.nombre,
                simbolo: local.simbolo,
                notas: local.notas,
                componentes: local.componentes,
              })
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save size={10} />
            {saving ? "…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-2.5 flex flex-col gap-3 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Notas
          </label>
          <textarea
            value={local.notas ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, notas: e.target.value }))}
            onBlur={() => persist({ notas: local.notas })}
            rows={2}
            placeholder="Descripción del compuesto…"
            className="bg-primary/5 rounded-md px-2 py-1 text-micro text-primary outline-none border border-primary/10 focus:border-primary/30 resize-none placeholder:text-primary/25"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
            Elementos que lo componen
          </p>
          <SelectorElementosCompuesto
            elementos={elementos}
            componentes={local.componentes ?? []}
            onChange={(componentes) => {
              setLocal((p) => ({ ...p, componentes }));
              persist({ componentes });
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
            Balance atómico
          </p>
          <BalanceAtomico compuesto={local} elementos={elementos} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1 text-micro font-black uppercase tracking-[0.2em] text-primary/25">
            <Sparkles size={10} />
            Afinidad con otros compuestos
          </p>
          <PanelAfinidad
            compuesto={local}
            todosLosCompuestos={todosLosCompuestos}
            elementos={elementos}
          />
        </div>
      </div>
    </div>
  );
}

export function CompuestosPage({
  compuestos,
  elementos,
  loading,
  creating,
  onCreate,
  onActualizar,
  onEliminar,
  seleccionarId,
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const activoId = seleccionadoId ?? seleccionarId ?? null;
  const activo = useMemo(
    () => compuestos.find((c) => c.id === activoId) ?? null,
    [compuestos, activoId],
  );

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden relative">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary/40">
            <Beaker size={12} />
            <p className="text-micro font-black uppercase tracking-widest">
              Compuestos · {compuestos.length}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {onCreate && (
              <button
                type="button"
                disabled={creating || elementos.length === 0}
                onClick={onCreate}
                title={
                  elementos.length === 0
                    ? "Primero cargá elementos en la Tabla Química"
                    : undefined
                }
                className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="animate-spin" size={10} /> : <Plus size={10} />}
                Nuevo compuesto
              </button>
            )}
          </div>
        </div>

        {loading && compuestos.length === 0 ? (
          <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
        ) : compuestos.length === 0 ? (
          <div className="py-6 text-micro text-primary/25 text-center">
            Todavía no hay compuestos creados.
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
          >
            {compuestos.map((c) => (
              <CompuestoCasilla
                key={c.id}
                compuesto={c}
                elementos={elementos}
                seleccionado={c.id === activoId}
                onClick={() =>
                  setSeleccionadoId((actual) => (actual === c.id ? null : c.id))
                }
              />
            ))}
          </div>
        )}
      </div>

      {activo && (
        <>
          <div
            className="absolute inset-0 z-30 md:hidden"
            style={{ background: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
            onClick={() => setSeleccionadoId(null)}
          />
          <div
            className="absolute md:sticky md:top-0 inset-y-0 right-0 z-40 flex flex-col w-full sm:w-[380px] md:w-[420px] shrink-0 border-l shadow-2xl md:shadow-none md:h-full md:self-start"
            style={{
              background: "var(--white-custom, var(--bg-main))",
              borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <CompuestoEditor
              compuesto={activo}
              elementos={elementos}
              todosLosCompuestos={compuestos}
              onBack={() => setSeleccionadoId(null)}
              onActualizar={onActualizar}
              onEliminar={
                onEliminar
                  ? (id) => {
                      onEliminar(id);
                      setSeleccionadoId(null);
                    }
                  : undefined
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

"use client";

/**
 * EditorGrupo.tsx
 * ─────────────────
 * View del editor de grupos. Exporta dos piezas:
 *
 *   EditorGrupo           → formulario de edición de UN grupo (sin sidebar).
 *                            Recibe el grupo por props, igual que
 *                            EditorPersonaje, EditorReino, etc. EditorMundo
 *                            lo muestra como overlay al hacer clic en un chip.
 *   EditorGrupoStandalone → interfaz legacy con sidebar propia. Mantiene
 *                            compatibilidad con editorGarlia.tsx y otros
 *                            consumidores que usan initialSelectedId /
 *                            autoCrear. Internamente orquesta useGrupos +
 *                            EditorGrupo.
 *
 * Antes este archivo tenía ~1400 líneas mezclando config estática, 2 hooks
 * de fetching y 3 componentes de UI (SelectorMiembros, SubtipoInput,
 * SelectorTipoGrupo). Ahora:
 *
 *   Config + tipos + hooks → hooks/useGrupos.ts
 *   UI                     → components/grupos/*.tsx
 *
 * Ruta destino:
 *   src/features/editorGarlia/views/EditorGrupo.tsx
 */

import { Layers, Plus, Save, Search, Trash2, X, Loader2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { useConfirm } from "@/ui/ConfirmModal";
import { SelectorMiembros } from "@/domains/garlia/grupos/SelectorMiembros";
import { SelectorTipoGrupo } from "@/domains/garlia/grupos/SelectorTipoGrupo";
import { SubtipoInput } from "@/domains/garlia/grupos/SubtipoInput";
import {
  SKILLS_POR_STAT_DND,
  STATS_DND,
  useDotesDisponibles,
} from "@/domains/garlia/aventuras/public/useFichasDnd";
import { supabase } from "@/infra/supabase/supabase";
import { dexiePut, dexieDelete as dexieDel } from "@/lib/utils/dexieHelpers";

import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import {
  useGrupos,
  GRUPO_TIPO_CONFIG,
  type Grupo,
  type GrupoTipo,
} from "@/domains/garlia/grupos/useGrupos";
import { type SaveStatus } from "@/domains/garlia/_shared/types";

// Re-exportados para no romper a quien importaba tipos/config desde acá.
export { GRUPO_TIPO_CONFIG, useGrupos };
export type { Grupo, GrupoTipo };

// ─── EditorGrupo — formulario de edición de un grupo (sin sidebar) ────────────
export function EditorGrupo({
  grupo,
  onSaved,
  onDeleted,
  onClickMiembro,
  sugerenciasSubtipo = [],
}: {
  grupo: Grupo;
  onSaved: (updated: Grupo) => void | Promise<void>;
  onDeleted: (id: string) => void | Promise<void>;
  onClickMiembro?: (id: string, tabla: string) => void;
  sugerenciasSubtipo?: string[];
}) {
  const [form, setForm] = useState<Grupo>(grupo);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const { confirm, ConfirmModal } = useConfirm();
  const cfg = GRUPO_TIPO_CONFIG[form.tipo];

  useEffect(() => {
    setForm(grupo);
    setStatus("idle");
  }, [grupo.id]);

  const save = async () => {
    setStatus("saving");
    try {
      await supabase
        .from("grupos_mundo")
        .update({
          nombre: form.nombre,
          tipo: form.tipo,
          subtipo: form.subtipo ?? null,
          descripcion: form.descripcion ?? null,
          dote_origen_id: form.dote_origen_id ?? null,
          salvaciones_clase: form.salvaciones_clase ?? null,
          habilidades_disponibles: form.habilidades_disponibles ?? null,
          habilidades_a_elegir: form.habilidades_a_elegir ?? null,
          miembro_ids: form.miembro_ids,
        })
        .eq("id", form.id);
      void dexiePut("grupos_mundo", form);
      await onSaved(form);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const del = async () => {
    const ok = await confirm({
      message: `¿Eliminar el grupo "${form.nombre}"?`,
      danger: true,
    });
    if (!ok) return;
    await supabase.from("grupos_mundo").delete().eq("id", form.id);
    void dexieDel("grupos_mundo", form.id);
    await onDeleted(form.id);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />

      {/* Header — una sola fila compacta */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-primary/10 bg-primary/[0.03]">
        {/* Ícono tipo */}
        <div
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border"
          style={{
            background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
            borderColor: `color-mix(in srgb, ${cfg.color} 20%, transparent)`,
          }}
        >
          <cfg.Icon
            size={11}
            style={{
              color: `color-mix(in srgb, ${cfg.color} 80%, transparent)`,
            }}
          />
        </div>

        {/* Nombre */}
        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
          placeholder="Nombre del grupo…"
          style={{ letterSpacing: "0.02em" }}
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />

        {/* Badge tipo */}
        <span
          className="hidden sm:inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 rounded text-micro font-black uppercase tracking-widest"
          style={{
            background: `color-mix(in srgb, ${cfg.color} 8%, transparent)`,
            color: `color-mix(in srgb, ${cfg.color} 60%, transparent)`,
            border: `1px solid color-mix(in srgb, ${cfg.color} 15%, transparent)`,
          }}
        >
          {cfg.labelPlural}
        </span>

        {/* Acciones */}
        <div className="shrink-0 flex items-center gap-1.5">
          <SaveIndicator status={status} />
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
            onClick={del}
          >
            <Trash2 size={10} />
          </button>
          <button
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
            disabled={status === "saving"}
            onClick={save}
          >
            <Save size={10} /> Guardar
          </button>
        </div>
      </div>

      {/* Body — dos columnas: info · miembros */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3">
        <div className="flex flex-col sm:flex-row gap-3 h-full">
          {/* Columna izquierda: subtipo + descripción. Se ensancha cuando es
              una Clase, porque el bloque de reglas de competencias (18 chips
              de habilidad) necesita más espacio para no verse apretado. */}
          <div
            className={`flex flex-col gap-2 sm:shrink-0 ${
              form.tipo === "personajes" && form.subtipo === "Clase" ? "sm:w-80" : "sm:w-56"
            }`}
          >
            <div className="space-y-1">
              <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/30">
                Tipo / subtipo
              </label>
              <SubtipoInput
                sugerencias={sugerenciasSubtipo}
                tipo={form.tipo}
                value={form.subtipo ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, subtipo: v || null }))}
              />
            </div>

            <div className="space-y-1 flex-1 flex flex-col">
              <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/30">
                Descripción
              </label>
              <textarea
                className="flex-1 w-full bg-primary/[0.03] border border-primary/10 rounded-lg px-2.5 py-1.5 text-micro text-primary outline-none focus:border-primary/25 resize-none placeholder:text-primary/25 leading-relaxed"
                placeholder={`${cfg.ejemplo}`}
                rows={4}
                value={form.descripcion ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    descripcion: e.target.value || null,
                  }))
                }
              />
            </div>

            {/* Dote de Origen: solo para grupos de personajes con
                subtipo="Trasfondo" — regla 2024, cada trasfondo otorga una
                dote fija automáticamente al elegirlo. Selector real contra
                el catálogo dotes_dnd (categoría "origen"), no texto libre. */}
            {form.tipo === "personajes" && form.subtipo === "Trasfondo" && (
              <div className="space-y-1">
                <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/30">
                  Dote de origen
                </label>
                <SelectorDoteOrigen
                  value={form.dote_origen_id ?? null}
                  onChange={(id, dote) =>
                    setForm((f) => ({
                      ...f,
                      dote_origen_id: id,
                      dote_origen: dote,
                    }))
                  }
                />
              </div>
            )}

            {/* Reglas de competencias: solo para grupos de personajes con
                subtipo="Clase" (regla 2024) — 2 salvaciones fijas + una
                lista de habilidades entre las que el jugador elige N. Esto
                es lo que la ficha del jugador usa para autocompletar
                salvaciones y restringir el tildado de habilidades. */}
            {form.tipo === "personajes" && form.subtipo === "Clase" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/30">
                    Salvaciones competentes (2 fijas)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {STATS_DND.map((stat) => {
                      const activa = (form.salvaciones_clase ?? []).includes(stat);
                      return (
                        <button
                          key={stat}
                          type="button"
                          onClick={() =>
                            setForm((f) => {
                              const actuales = f.salvaciones_clase ?? [];
                              if (activa) {
                                return { ...f, salvaciones_clase: actuales.filter((s) => s !== stat) };
                              }
                              if (actuales.length >= 2) return f; // solo 2 fijas
                              return { ...f, salvaciones_clase: [...actuales, stat] };
                            })
                          }
                          className="px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border transition-all"
                          style={{
                            background: activa
                              ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                              : "transparent",
                            borderColor: activa
                              ? "color-mix(in srgb, var(--primary) 35%, transparent)"
                              : "color-mix(in srgb, var(--primary) 12%, transparent)",
                            color: activa
                              ? "var(--primary)"
                              : "color-mix(in srgb, var(--primary) 40%, transparent)",
                          }}
                        >
                          {stat.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/30">
                    Habilidades disponibles
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {Object.values(SKILLS_POR_STAT_DND)
                      .flat()
                      .map((skill) => {
                        const activa = (form.habilidades_disponibles ?? []).includes(skill.id);
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() =>
                              setForm((f) => {
                                const actuales = f.habilidades_disponibles ?? [];
                                return {
                                  ...f,
                                  habilidades_disponibles: activa
                                    ? actuales.filter((s) => s !== skill.id)
                                    : [...actuales, skill.id],
                                };
                              })
                            }
                            className="px-2 py-1 rounded-md text-micro font-semibold border transition-all"
                            style={{
                              background: activa
                                ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                                : "transparent",
                              borderColor: activa
                                ? "color-mix(in srgb, var(--primary) 35%, transparent)"
                                : "color-mix(in srgb, var(--primary) 12%, transparent)",
                              color: activa
                                ? "var(--primary)"
                                : "color-mix(in srgb, var(--primary) 40%, transparent)",
                            }}
                          >
                            {skill.nombre}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/30">
                    Cuántas elige el jugador
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={(form.habilidades_disponibles ?? []).length}
                    className="h-8 w-20 px-2 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-sm text-primary/80 focus:border-primary/30 transition-colors"
                    value={form.habilidades_a_elegir ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        habilidades_a_elegir: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: miembros */}
          <div className="flex-1 min-w-0 space-y-1">
            <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/30">
              {cfg.labelPlural}
            </label>
            <SelectorMiembros
              miembro_ids={form.miembro_ids}
              tipo={form.tipo}
              onChange={(ids) => setForm((f) => ({ ...f, miembro_ids: ids }))}
              onClickMiembro={onClickMiembro}
            />
            {form.miembro_ids.length === 0 && (
              <div
                className="flex flex-col items-center gap-1.5 py-4 rounded-lg border border-dashed mt-1"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <cfg.Icon
                  size={14}
                  strokeWidth={1}
                  style={{
                    color: `color-mix(in srgb, ${cfg.color} 25%, transparent)`,
                  }}
                />
                <p className="text-micro font-black uppercase tracking-widest text-primary/20">
                  Sin miembros aún
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EditorGrupoStandalone — interfaz legacy con sidebar propia ───────────────
// Mantiene compatibilidad con editorGarlia.tsx y otros consumidores que usan
// initialSelectedId / autoCrear. Internamente orquesta useGrupos + EditorGrupo.
export function EditorGrupoStandalone({
  onClickMiembro,
  autoCrear = false,
  initialSelectedId,
  renderSiblingTabs,
}: {
  onClickMiembro?: (id: string, tabla: string) => void;
  autoCrear?: boolean;
  initialSelectedId?: string | null;
  /** Contenido opcional (ej. SiblingSectionTabs) renderizado arriba del buscador */
  renderSiblingTabs?: () => React.ReactNode;
}) {
  const { grupos, loaded, crearGrupo, actualizarGrupo, eliminarGrupo } =
    useGrupos();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? null,
  );
  const [search, setSearch] = useState("");
  const [creando, setCreando] = useState(autoCrear);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      setCreando(false);
    }
  }, [initialSelectedId]);

  const selected = grupos.find((g) => g.id === selectedId) ?? null;

  // Sugerencias de subtipo aisladas por tipo — nunca se mezclan
  const sugerenciasSubtipo = useMemo(() => {
    if (!selected) return [];
    return [
      ...new Set(
        grupos
          .filter(
            (g) =>
              g.tipo === selected.tipo && g.id !== selected.id && g.subtipo,
          )
          .map((g) => g.subtipo as string),
      ),
    ];
  }, [grupos, selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return grupos;
    const q = search.toLowerCase();
    return grupos.filter(
      (g) =>
        g.nombre.toLowerCase().includes(q) ||
        GRUPO_TIPO_CONFIG[g.tipo].labelPlural.toLowerCase().includes(q),
    );
  }, [grupos, search]);

  const gruposPorTipo = useMemo(() => {
    const map: Partial<Record<GrupoTipo, Grupo[]>> = {};
    for (const g of filtered) {
      if (!map[g.tipo]) map[g.tipo] = [];
      map[g.tipo]!.push(g);
    }
    return map;
  }, [filtered]);

  const handleCrear = async (tipo: GrupoTipo) => {
    const nuevo = await crearGrupo(tipo);
    if (nuevo) setSelectedId(nuevo.id);
    setCreando(false);
  };

  if (!loaded) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary/20" size={18} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex min-h-0 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`flex-col border-r min-h-0 w-64 shrink-0 ${selected || creando ? "hidden sm:flex" : "flex flex-1 sm:flex-none"}`}
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        {renderSiblingTabs?.()}

        <div
          className="shrink-0 flex items-center gap-2 px-3 py-2 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <Layers className="text-primary/35 shrink-0" size={11} />
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/45 flex-1">
            Grupos
          </span>
          <span className="text-micro text-primary/25 tabular-nums">
            {grupos.length}
          </span>
        </div>

        <div className="shrink-0 px-2 pt-2 pb-1.5 space-y-1.5">
          <div className="relative">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 text-primary/25"
              size={9}
            />
            <input
              className="w-full bg-primary/[0.04] border border-primary/10 rounded-lg pl-6 pr-5 py-1 text-micro font-medium outline-none focus:border-primary/25 text-primary placeholder:text-primary/25"
              placeholder="Buscar grupos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary"
                onClick={() => setSearch("")}
              >
                <X size={9} />
              </button>
            )}
          </div>
          <button
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-semibold text-primary"
            onClick={() => {
              setCreando(true);
              setSelectedId(null);
            }}
          >
            <Plus size={13} /> Añadir
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2 space-y-2">
          {grupos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Layers className="text-primary/15" size={20} strokeWidth={1} />
              <p className="text-micro font-black uppercase tracking-widest text-primary/20">
                Sin grupos aún
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-micro text-primary/20 text-center py-6 italic">
              Sin resultados
            </p>
          ) : (
            (
              Object.entries(GRUPO_TIPO_CONFIG) as [
                GrupoTipo,
                (typeof GRUPO_TIPO_CONFIG)[GrupoTipo],
              ][]
            )
              // Con búsqueda activa seguimos ocultando categorías vacías
              // (no tiene sentido mostrar 8 headers sin resultados). Sin
              // búsqueda, mostramos siempre las 8 categorías —así se puede
              // crear el primer grupo de un tipo (ej. runas) sin pasar por
              // el selector genérico, que requiere que ya exista al menos
              // uno para saber que ese tipo "existe".
              .filter(([tipo]) => !search.trim() || gruposPorTipo[tipo]?.length)
              .map(([tipo, cfg]) => (
                <div key={tipo}>
                  <div className="flex items-center gap-1 px-1 py-0.5 mb-0.5">
                    <cfg.Icon
                      size={8}
                      style={{
                        color: `color-mix(in srgb, ${cfg.color} 45%, transparent)`,
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em] flex-1"
                      style={{
                        color: `color-mix(in srgb, ${cfg.color} 40%, transparent)`,
                      }}
                    >
                      {cfg.labelPlural}
                    </span>
                    <button
                      className="shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors hover:bg-primary/10"
                      title={`Añadir grupo de ${cfg.labelPlural.toLowerCase()}`}
                      type="button"
                      onClick={() => {
                        setCreando(false);
                        void handleCrear(tipo);
                      }}
                    >
                      <Plus
                        size={9}
                        style={{
                          color: `color-mix(in srgb, ${cfg.color} 55%, transparent)`,
                        }}
                      />
                    </button>
                  </div>
                  <div className="space-y-0">
                    {!gruposPorTipo[tipo]?.length && (
                      <p className="text-micro text-primary/15 italic px-1 py-1">
                        Sin grupos aún
                      </p>
                    )}
                    {gruposPorTipo[tipo]?.map((grupo) => (
                      <button
                        key={grupo.id}
                        className={`w-full text-left px-2 py-1.5 rounded-lg transition-all border ${
                          selectedId === grupo.id
                            ? "border-primary/15 bg-primary/8"
                            : "border-transparent hover:bg-primary/5 hover:border-primary/8"
                        }`}
                        onClick={() => {
                          setSelectedId(grupo.id);
                          setCreando(false);
                        }}
                      >
                        <p
                          className={`text-micro font-black uppercase tracking-wide truncate ${selectedId === grupo.id ? "text-primary" : "text-primary/60"}`}
                        >
                          {grupo.nombre}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {grupo.subtipo && (
                            <span
                              className="text-micro font-semibold px-1 py-px rounded"
                              style={{
                                background: `color-mix(in srgb, ${GRUPO_TIPO_CONFIG[grupo.tipo].color} 8%, transparent)`,
                                color: `color-mix(in srgb, ${GRUPO_TIPO_CONFIG[grupo.tipo].color} 50%, transparent)`,
                              }}
                            >
                              {grupo.subtipo}
                            </span>
                          )}
                          <span className="text-micro text-primary/25">
                            {grupo.miembro_ids.length} miembros
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Panel principal */}
      <div
        className={`flex-1 flex flex-col min-h-0 overflow-hidden ${selected || creando ? "flex" : "hidden sm:flex"}`}
      >
        {creando ? (
          <SelectorTipoGrupo
            onCancel={() => setCreando(false)}
            onSelect={handleCrear}
          />
        ) : selected ? (
          <EditorGrupo
            key={selected.id}
            grupo={selected}
            sugerenciasSubtipo={sugerenciasSubtipo}
            onClickMiembro={onClickMiembro}
            onDeleted={async (id) => {
              await eliminarGrupo(id);
              setSelectedId(null);
            }}
            onSaved={async (updated) => {
              await actualizarGrupo(updated);
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 select-none">
            <Layers className="text-primary/15" size={24} strokeWidth={1} />
            <p className="text-micro font-black uppercase tracking-[0.3em] text-primary/20">
              Grupos
            </p>
            <p className="text-micro text-primary/15 tracking-widest text-center max-w-xs px-4">
              Agrupá personajes, criaturas, objetos o magia en facciones,
              manadas, colecciones y más
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Selector de Dote de Origen (para Trasfondo) ──────────────────────────
// Alimentado por dotes_dnd, filtrado a categoría "origen" — las Generales
// y Épicas no aplican acá, esas las elige el jugador al subir de nivel.
function SelectorDoteOrigen({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null, dote: Grupo["dote_origen"]) => void;
}) {
  const { dotes, loading } = useDotesDisponibles();
  const dotesOrigen = dotes.filter((d) => d.categoria === "origen");

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-micro text-primary/30">
        <Loader2 size={11} className="animate-spin" />
        Cargando dotes…
      </div>
    );
  }

  return (
    <select
      className="w-full bg-primary/[0.03] border border-primary/10 rounded-lg px-2.5 py-1.5 text-micro text-primary outline-none focus:border-primary/25"
      value={value ?? ""}
      onChange={(e) => {
        const id = e.target.value || null;
        const dote = dotesOrigen.find((d) => d.id === id) ?? null;
        onChange(
          id,
          dote ? { id: dote.id, nombre: dote.nombre, descripcion: dote.descripcion } : null,
        );
      }}
    >
      <option value="">—</option>
      {dotesOrigen.map((d) => (
        <option key={d.id} value={d.id}>
          {d.nombre}
        </option>
      ))}
    </select>
  );
}

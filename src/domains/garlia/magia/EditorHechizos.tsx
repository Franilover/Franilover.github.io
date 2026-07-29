"use client";

/**
 * EditorHechizos.tsx
 * ────────────────────
 * View del editor de hechizos/dones/runas. Orquesta:
 *   - Lista/selección de entidades mágicas (useEntidadesMagicas)
 *   - Carga de grupos de criaturas (useGruposCriaturas)
 *   - Creación de nuevas entidades
 *   - Delegación del formulario a FormularioMagico
 *
 * No contiene lógica de fetching de items individuales ni
 * helpers de Dexie — todo eso vive en hooks/ y lib/.
 *
 * Ruta destino:
 *   src/features/editorGarlia/views/EditorHechizos.tsx
 */

import { Loader2, Plus, Search } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { FormularioMagico } from "@/domains/garlia/magia/FormularioMagico";
import { CONFIG, type EntidadMagica, type Modo } from "@/domains/garlia/magia/types";
import { useGruposCriaturas } from "@/domains/garlia/grupos/useGruposCriaturas";
import { useGruposRunas } from "@/domains/garlia/grupos/useGruposRunas";
import { useEntidadesMagicas } from "@/domains/garlia/magia/useEntidadesMagicas";
import { supabase } from "@/infra/supabase/supabase";

export function EditorHechizos({
  modo,
  initialSelectedId,
  onSelectedIdChange,
  onItemSaved,
  onItemDeleted,
  renderSiblingTabs,
  onNavigateCriatura,
}: {
  modo: Modo;
  initialSelectedId?: string;
  onSelectedIdChange?: (id: string | null) => void;
  onItemSaved?: (item: EntidadMagica) => void;
  onItemDeleted?: (id: string) => void;
  /** Contenido opcional (ej. SiblingSectionTabs) renderizado arriba del buscador */
  renderSiblingTabs?: () => React.ReactNode;
  onNavigateCriatura?: (id: string) => void;
}) {
  const cfg = CONFIG[modo];
  const { items, setItems, loading } = useEntidadesMagicas(modo);
  const { grupos: gruposCriaturas, loading: loadingGruposCriaturas } = useGruposCriaturas();
  const { grupos: gruposRunas, loading: loadingGruposRunas } = useGruposRunas();
  // Runas se agrupan temáticamente entre sí (grupos_mundo tipo="runas");
  // hechizos/dones se agrupan por qué criaturas pueden usarlos (tipo="criaturas").
  const grupos = modo === "runas" ? gruposRunas : gruposCriaturas;
  const loadingGrupos = modo === "runas" ? loadingGruposRunas : loadingGruposCriaturas;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  // Sincronizar cuando llega un id desde afuera (buscador global)
  useEffect(() => {
    if (initialSelectedId && initialSelectedId !== selectedId) {
      setSelectedId(initialSelectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedId]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.nombre?.toLowerCase().includes(q));
  }, [items, query]);

  const selectItem = (id: string | null) => {
    setSelectedId(id);
    onSelectedIdChange?.(id);
  };

  // Si hay selectedId pero el item no está en la lista aún, lo buscamos en Supabase.
  // Usamos ref para no repetir el fetch ante re-renders.
  const fetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    if (items.find((i) => i.id === selectedId)) return;
    if (fetchedRef.current === selectedId) return;
    fetchedRef.current = selectedId;

    const tabla = CONFIG[modo].tabla;
    const selectFields =
      modo === "runas"
        ? "id, nombre, explicacion, imagen_url, criatura_id, patron_trazos, grupo_ids"
        : "id, nombre, explicacion, grupo_ids, imagen_url, criatura_id";

    supabase
      .from(tabla)
      .select(selectFields)
      .eq("id", selectedId)
      .single()
      .then(({ data }) => {
        if (data) {
          const item = data as unknown as EntidadMagica;
          setItems((prev) =>
            prev.some((i) => i.id === item.id)
              ? prev.map((i) => (i.id === item.id ? item : i))
              : [item, ...prev],
          );
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const insertPayload =
        modo === "runas"
          ? { nombre: `Nueva ${cfg.labelSing}`, grupo_ids: [] }
          : { nombre: `Nuevo ${cfg.labelSing}`, grupo_ids: [] };
      const selectFields =
        modo === "runas"
          ? "id, nombre, explicacion, imagen_url, criatura_id, grupo_ids"
          : "id, nombre, explicacion, grupo_ids, criatura_id";

      const { data, error } = await supabase
        .from(cfg.tabla)
        .insert([insertPayload])
        .select(selectFields)
        .single();
      if (error) throw error;
      const created = data as unknown as EntidadMagica;
      setItems((prev) => [created, ...prev]);
      selectItem(created.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Lista — se oculta al abrir un item, el editor pasa a ocupar todo el ancho */}
      <div
        className={[
          "w-64 shrink-0 border-r border-primary/10 flex flex-col min-h-0",
          selected ? "hidden" : "flex",
        ].join(" ")}
      >
        {renderSiblingTabs?.()}
        <div className="p-2 flex items-center gap-2 border-b border-primary/10">
          <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-input-bg">
            <Search size={12} className="text-primary/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar ${cfg.labelSing.toLowerCase()}…`}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-primary/25"
            />
          </div>
        </div>

        <div className="p-2 pb-0">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-semibold text-primary disabled:opacity-50"
          >
            {creating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Plus size={13} />
            )}
            Añadir
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="p-4 text-xs text-primary/30 text-center">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-xs text-primary/30 text-center">
              {items.length === 0 ? `Sin ${cfg.label.toLowerCase()} todavía` : "Sin resultados"}
            </div>
          ) : (
            filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => selectItem(i.id)}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
                  i.id === selectedId
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-primary/70 hover:bg-primary/5",
                ].join(" ")}
              >
                <cfg.Icon size={12} className="shrink-0 opacity-50" />
                <span className="truncate">{i.nombre}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {selected ? (
          <FormularioMagico
            key={selected.id}
            grupos={grupos}
            item={selected}
            loadingGrupos={loadingGrupos}
            modo={modo}
            todasLasRunas={modo === "runas" ? items : undefined}
            onNavigateCriatura={onNavigateCriatura}
            onDeleted={(id) => {
              setItems((prev) => prev.filter((i) => i.id !== id));
              selectItem(null);
              onItemDeleted?.(id);
            }}
            onSaved={(updated) => {
              setItems((prev) =>
                prev.map((i) => (i.id === updated.id ? updated : i)),
              );
              onItemSaved?.(updated);
            }}
          />
        ) : loading && selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary/20" size={20} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none">
            <cfg.Icon
              size={40}
              strokeWidth={1}
              style={{ color: cfg.color, opacity: 0.2 }}
            />
            <p className="text-micro font-black uppercase tracking-[0.3em] text-primary/25">
              {cfg.label}
            </p>
            <p className="text-micro text-primary/20 tracking-widest">
              Seleccioná un {cfg.labelSing.toLowerCase()} o creá uno nuevo
            </p>
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all mt-2"
              disabled={creating}
              onClick={handleCreate}
            >
              {creating ? (
                <Loader2 className="animate-spin" size={10} />
              ) : (
                <Plus size={10} />
              )}
              Nuevo {cfg.labelSing}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

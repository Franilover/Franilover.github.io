"use client";

/**
 * SeccionGruposVinculados.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Bloque completo "título + botón agregar + lista" para una relación N:N con
 * un catálogo propio (Órganos, Formaciones — ver useEntidadVinculosGrupo).
 * Pensado para insertarse directo en un editor (ej. EditorItem) sin repetir
 * el fontanería de abrir/cerrar el popover y armar cada tarjeta.
 *
 * Dos caminos desde el botón "+":
 *   - "Crear nuevo": crea un registro vacío en el catálogo, lo vincula, y
 *     abre directo su panel flotante (GrupoCompuestoPanelFlotante) para
 *     cargar los compuestos ahí — no queda editable inline en la tarjeta.
 *   - "Usar existente": muestra los del catálogo que esta entidad todavía
 *     NO tiene vinculados, como tarjetas reales (mismo componente
 *     TarjetaFormacionOrgano, con su fórmula visible) en vez de una lista
 *     de texto — clickear una tarjeta la vincula. Las tarjetas de "Usar"
 *     son de solo selección: no editan ni agregan compuestos desde ahí (el
 *     onUpdate/onDelete de esa vista son no-op y no hay onAbrirGrupo); para
 *     editar el contenido hay que abrir su panel flotante una vez vinculada.
 */

import { Plus, Search, X, type LucideIcon } from "lucide-react";
import React, { useMemo, useState } from "react";

import type { Compuesto } from "@/domains/garlia/elementos/types";
import { TarjetaFormacionOrgano } from "@/domains/garlia/_shared/TarjetaFormacionOrgano";
import type {
  EntradaCatalogoGrupo,
  GrupoVinculadoResuelto,
} from "@/domains/garlia/_shared/useEntidadVinculosGrupo";

export function SeccionGruposVinculados({
  titulo,
  descripcion,
  tipo = "organo",
  items,
  catalogo,
  loading,
  compuestos,
  onCrearNuevo,
  onUsarExistente,
  onUpdate,
  onDelete,
  onAbrirCompuesto,
  onAbrirGrupo,
  placeholderNombre,
  placeholderNotas,
  labelCrear = "Crear nuevo",
  labelExistente = "Usar uno existente",
  labelBuscar = "Buscar…",
}: {
  titulo: string;
  descripcion?: string;
  icono: LucideIcon;
  /** "organo" resuelve la fórmula vía Tejidos/Células; "formacion" vía
   *  Vetas/Granos — se reenvía tal cual a TarjetaFormacionOrgano. Default
   *  "organo" por compatibilidad con los llamadores existentes de Flora/
   *  Criaturas; Minerales/Items deben pasar "formacion" explícitamente. */
  tipo?: "organo" | "formacion";
  items: GrupoVinculadoResuelto[];
  /** Catálogo completo del propio módulo (Órganos, Formaciones…) para el picker "usar existente". */
  catalogo: EntradaCatalogoGrupo[];
  loading?: boolean;
  compuestos: Compuesto[];
  /** Crea un registro vacío + lo vincula — el llamador es responsable de
   *  abrir el panel flotante con el id devuelto (ver EditorItem.tsx). */
  onCrearNuevo: () => void | Promise<{ id: string } | null>;
  onUsarExistente: (grupoCompuestoId: string) => void;
  onUpdate: (id: string, updates: Partial<EntradaCatalogoGrupo>) => void;
  onDelete: (vinculoId: string) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
  onAbrirGrupo?: (grupoId: string) => void;
  placeholderNombre?: string;
  placeholderNotas?: string;
  labelCrear?: string;
  labelExistente?: string;
  labelBuscar?: string;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [pickerAbierto, setPickerAbierto] = useState(false);

  const yaVinculadosIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const disponibles = useMemo(
    () => catalogo.filter((g) => !yaVinculadosIds.has(g.id)),
    [catalogo, yaVinculadosIds],
  );

  return (
    <div className="pt-2 border-t border-primary/10">
      <div className="flex items-center justify-between mb-1.5 relative">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
          {titulo} {items.length > 0 && `(${items.length})`}
        </span>
        <div
          className="relative shrink-0"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenuAbierto(false);
          }}
        >
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            title={`Agregar ${titulo.toLowerCase()}`}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <Plus size={13} />
          </button>

          {menuAbierto && (
            <div
              className="absolute right-0 top-full mt-1 z-30 w-44 rounded-lg border shadow-lg overflow-hidden p-1.5 flex flex-col gap-0.5"
              style={{
                background: "var(--bg-main)",
                borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuAbierto(false);
                  void onCrearNuevo();
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs font-semibold text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                <Plus size={13} className="text-primary/40 shrink-0" />
                {labelCrear}
              </button>
              <button
                type="button"
                disabled={disponibles.length === 0}
                onClick={() => {
                  setMenuAbierto(false);
                  setPickerAbierto(true);
                }}
                title={disponibles.length === 0 ? "No hay otros en el catálogo todavía" : undefined}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs font-semibold text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Search size={13} className="text-primary/40 shrink-0" />
                {labelExistente}
                {disponibles.length > 0 && (
                  <span className="ml-auto text-primary/30 font-normal tabular-nums">
                    {disponibles.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {descripcion && <p className="text-micro text-primary/30 mb-1.5 -mt-1">{descripcion}</p>}

      {loading ? (
        <p className="text-micro text-primary/25 italic py-2">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-2">Nada definido todavía.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((item) => (
            <TarjetaFormacionOrgano
              key={item.vinculo_id}
              item={item}
              tipo={tipo}
              onUpdate={onUpdate}
              onDelete={() => onDelete(item.vinculo_id)}
              compuestos={compuestos}
              onAbrirCompuesto={onAbrirCompuesto}
              onAbrirGrupo={onAbrirGrupo}
              placeholderNombre={placeholderNombre}
              placeholderNotas={placeholderNotas}
            />
          ))}
        </div>
      )}

      {pickerAbierto && (
        <PickerUsarExistente
          titulo={titulo}
          tipo={tipo}
          disponibles={disponibles}
          compuestos={compuestos}
          labelBuscar={labelBuscar}
          onElegir={(id) => {
            onUsarExistente(id);
            setPickerAbierto(false);
          }}
          onClose={() => setPickerAbierto(false)}
        />
      )}
    </div>
  );
}

/**
 * Picker de "Usar existente" — muestra cada opción como la misma tarjeta
 * real (fórmula/notas visibles), pero de solo selección: onUpdate/onDelete
 * están deshabilitados (no-op) y no hay onAbrirGrupo — clickear la tarjeta
 * vincula. Editar el contenido requiere abrir el panel flotante desde la
 * tarjeta ya vinculada, fuera de este picker.
 */
function PickerUsarExistente({
  titulo,
  disponibles,
  compuestos,
  labelBuscar,
  onElegir,
  onClose,
}: {
  titulo: string;
  disponibles: EntradaCatalogoGrupo[];
  compuestos: Compuesto[];
  labelBuscar: string;
  onElegir: (id: string) => void;
  onClose: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [disponibles, busqueda]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, black 45%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-primary/10">
          <Search size={13} className="text-primary/30 shrink-0" />
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={labelBuscar}
            className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-sm text-primary outline-none placeholder:text-primary/30"
          />
          <span className="text-micro text-primary/30 shrink-0">
            {titulo} · {disponibles.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {filtrados.length === 0 ? (
            <p className="text-micro text-primary/25 italic text-center py-6">Sin resultados</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtrados.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onElegir(g.id)}
                  className="text-left rounded-lg border border-primary/10 hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  <div className="pointer-events-none">
                    <TarjetaFormacionOrgano
                      item={{ ...g, vinculo_id: g.id } as GrupoVinculadoResuelto}
                      onUpdate={() => {}}
                      onDelete={() => {}}
                      compuestos={compuestos}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

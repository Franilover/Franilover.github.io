"use client";

/**
 * SelectorOrganoPlanta.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Picker que se abre al clickear "+" en la tab Órganos de FloraEditor.
 * Dos caminos:
 *   1. "Crear órgano nuevo" — crea un Organo en blanco en el catálogo y lo
 *      vincula de una a esta planta.
 *   2. "Usar uno existente" — lista los Órganos del catálogo que esta
 *      planta todavía NO tiene vinculados (para no duplicar el vínculo) y
 *      permite buscar por nombre; al elegir uno, solo se vincula (no se
 *      copia nada) — si después se edita su fórmula, se actualiza en todas
 *      las plantas que lo usan.
 *
 * Mismo lenguaje visual que el dropdown de búsqueda en
 * SelectorFormulaOrgano/SelectorCompuesto: popover simple anclado al botón,
 * sin modal centrado.
 */

import { Plus, Sprout, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import type { Organo } from "./types";

export function SelectorOrganoPlanta({
  catalogoOrganos,
  organosYaVinculadosIds,
  onCrearNuevo,
  onUsarExistente,
  onClose,
}: {
  /** Catálogo completo de Órganos (todas las plantas). */
  catalogoOrganos: Organo[];
  /** Ids de Organo ya vinculados a esta planta — se excluyen de "usar existente". */
  organosYaVinculadosIds: Set<string>;
  onCrearNuevo: () => void;
  onUsarExistente: (organoId: string) => void;
  onClose: () => void;
}) {
  const [modo, setModo] = useState<"elegir" | "existente">("elegir");
  const [busqueda, setBusqueda] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  const disponibles = useMemo(
    () => catalogoOrganos.filter((o) => !organosYaVinculadosIds.has(o.id)),
    [catalogoOrganos, organosYaVinculadosIds],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [disponibles, busqueda]);

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 z-30 w-72 rounded-lg border shadow-lg overflow-hidden"
      style={{
        background: "var(--bg-main)",
        borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
      }}
    >
      {modo === "elegir" ? (
        <div className="p-1.5 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => {
              onCrearNuevo();
              onClose();
            }}
            className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs font-semibold text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
          >
            <Plus size={13} className="text-primary/40 shrink-0" />
            Crear órgano nuevo
          </button>
          <button
            type="button"
            disabled={disponibles.length === 0}
            onClick={() => setModo("existente")}
            title={
              disponibles.length === 0
                ? "No hay otros órganos en el catálogo todavía"
                : undefined
            }
            className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs font-semibold text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Sprout size={13} className="text-primary/40 shrink-0" />
            Usar uno existente
            {disponibles.length > 0 && (
              <span className="ml-auto text-primary/30 font-normal tabular-nums">
                {disponibles.length}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-primary/10">
            <Search size={12} className="text-primary/30 shrink-0" />
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar órgano…"
              className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-xs text-primary outline-none placeholder:text-primary/30"
            />
            <button
              type="button"
              onClick={() => setModo("elegir")}
              title="Volver"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/30 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <p className="text-micro text-primary/25 italic text-center py-3">
                Sin resultados
              </p>
            ) : (
              filtrados.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onUsarExistente(o.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-primary/75 hover:bg-primary/10 hover:text-primary transition-colors truncate cursor-pointer"
                >
                  <Sprout size={12} className="text-primary/30 shrink-0" />
                  <span className="truncate">{o.nombre || "(sin nombre)"}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

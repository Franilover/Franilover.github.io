"use client";

/**
 * SelectorGrupoVinculado.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Generaliza SelectorOrganoPlanta (flora/) para cualquier catálogo de
 * GrupoCompuesto vinculado N:N — Estructura/Habilidades de Items, además de
 * poder reemplazar a futuro Órganos/Formaciones. Dos caminos:
 *   1. "Crear nuevo" — crea un GrupoCompuesto en blanco y lo vincula.
 *   2. "Usar uno existente" — lista los del catálogo que la entidad todavía
 *      NO tiene vinculados, con búsqueda por nombre.
 *
 * Mismo lenguaje visual que el dropdown de búsqueda en SelectorFormulaOrgano.
 */

import { Plus, Search, X, type LucideIcon } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import type { GrupoCompuesto } from "@/domains/garlia/elementos/types";

export function SelectorGrupoVinculado({
  catalogo,
  yaVinculadosIds,
  onCrearNuevo,
  onUsarExistente,
  onClose,
  icono: Icono,
  labelCrear = "Crear nuevo",
  labelExistente = "Usar uno existente",
  labelBuscar = "Buscar…",
  labelVacio = "No hay otros en el catálogo todavía",
}: {
  /** Catálogo de GrupoCompuesto ya filtrado por tipo (todas las entidades). */
  catalogo: GrupoCompuesto[];
  /** Ids de GrupoCompuesto ya vinculados a esta entidad — se excluyen de "usar existente". */
  yaVinculadosIds: Set<string>;
  onCrearNuevo: () => void;
  onUsarExistente: (grupoCompuestoId: string) => void;
  onClose: () => void;
  icono: LucideIcon;
  labelCrear?: string;
  labelExistente?: string;
  labelBuscar?: string;
  labelVacio?: string;
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
    () => catalogo.filter((g) => !yaVinculadosIds.has(g.id)),
    [catalogo, yaVinculadosIds],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((g) => g.nombre.toLowerCase().includes(q));
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
            {labelCrear}
          </button>
          <button
            type="button"
            disabled={disponibles.length === 0}
            onClick={() => setModo("existente")}
            title={disponibles.length === 0 ? labelVacio : undefined}
            className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs font-semibold text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Icono size={13} className="text-primary/40 shrink-0" />
            {labelExistente}
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
              placeholder={labelBuscar}
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
              <p className="text-micro text-primary/25 italic text-center py-3">Sin resultados</p>
            ) : (
              filtrados.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onUsarExistente(g.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-primary/75 hover:bg-primary/10 hover:text-primary transition-colors truncate cursor-pointer"
                >
                  <Icono size={12} className="text-primary/30 shrink-0" />
                  <span className="truncate">{g.nombre || "(sin nombre)"}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

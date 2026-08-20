"use client";

/**
 * SelectorFormacionMineral.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Picker que se abre al clickear "+" en la tab Formaciones de MineralEditor.
 * Dos caminos:
 *   1. "Crear formación nueva" — crea un GrupoCompuesto (tipo="formacion")
 *      en blanco en el catálogo y lo vincula de una a este mineral.
 *   2. "Usar una existente" — lista las Formaciones del catálogo
 *      (grupos_compuestos con tipo="formacion") que este mineral todavía
 *      NO tiene vinculadas, y permite buscar por nombre; al elegir una,
 *      solo se vincula (no se copia nada) — si después se edita su
 *      fórmula, se actualiza en todos los minerales que la usan.
 *
 * Mismo lenguaje visual que SelectorOrganoPlanta (Flora) — popover simple
 * anclado al botón, sin modal centrado.
 */

import { Plus, Gem, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import type { GrupoCompuesto } from "@/domains/garlia/elementos/types";

export function SelectorFormacionMineral({
  catalogoFormaciones,
  formacionesYaVinculadasIds,
  onCrearNueva,
  onUsarExistente,
  onClose,
}: {
  /** Catálogo de Formaciones = Grupos de Compuestos con tipo="formacion" (todos los minerales). */
  catalogoFormaciones: GrupoCompuesto[];
  /** Ids de GrupoCompuesto ya vinculados a este mineral — se excluyen de "usar existente". */
  formacionesYaVinculadasIds: Set<string>;
  onCrearNueva: () => void;
  onUsarExistente: (grupoCompuestoId: string) => void;
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
    () => catalogoFormaciones.filter((f) => !formacionesYaVinculadasIds.has(f.id)),
    [catalogoFormaciones, formacionesYaVinculadasIds],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((f) => f.nombre.toLowerCase().includes(q));
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
              onCrearNueva();
              onClose();
            }}
            className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs font-semibold text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
          >
            <Plus size={13} className="text-primary/40 shrink-0" />
            Crear formación nueva
          </button>
          <button
            type="button"
            disabled={disponibles.length === 0}
            onClick={() => setModo("existente")}
            title={
              disponibles.length === 0
                ? "No hay otras formaciones en el catálogo todavía"
                : undefined
            }
            className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs font-semibold text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Gem size={13} className="text-primary/40 shrink-0" />
            Usar una existente
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
              placeholder="Buscar formación…"
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
              filtrados.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onUsarExistente(f.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-primary/75 hover:bg-primary/10 hover:text-primary transition-colors truncate cursor-pointer"
                >
                  <Gem size={12} className="text-primary/30 shrink-0" />
                  <span className="truncate">{f.nombre || "(sin nombre)"}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

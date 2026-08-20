"use client";

/**
 * SelectorGrupoCompuestos.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Botón + popover de búsqueda para elegir un Grupo de Compuestos del catálogo
 * (grupos_compuestos) y copiar sus componentes ({compuesto_id, cantidad})
 * como punto de partida de una fórmula plana — Órgano de Flora, Formación de
 * Mineral, o cualquier otro consumidor de ComponenteOrgano[].
 *
 * Solo copia valores, no acopla tablas: una vez elegido el grupo, la fórmula
 * resultante es independiente y editable como cualquier otra.
 */

import { Layers } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";

import type { GrupoCompuesto } from "@/domains/garlia/elementos/types";

export function SelectorGrupoCompuestos({
  grupos,
  onElegir,
  label = "Usar grupo",
}: {
  grupos: GrupoCompuesto[];
  /** Se llama con los componentes del grupo elegido, ya copiados
   *  ({compuesto_id, cantidad}[]) — el consumidor decide si reemplaza o
   *  fusiona con la fórmula actual. */
  onElegir: (componentes: { compuesto_id: string; cantidad: number }[]) => void;
  /** Texto del botón — por defecto "Usar grupo". */
  label?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [grupos, busqueda]);

  function elegir(g: GrupoCompuesto) {
    onElegir((g.componentes ?? []).map((c) => ({ compuesto_id: c.compuesto_id, cantidad: c.cantidad })));
    setAbierto(false);
    setBusqueda("");
  }

  if (grupos.length === 0) return null;

  return (
    <div className="relative inline-block" ref={contenedorRef}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Copiar la fórmula de un Grupo de Compuestos existente"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
      >
        <Layers size={10} />
        {label}
      </button>

      {abierto && (
        <>
          {/* Overlay invisible para cerrar al clickear afuera */}
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div
            className="absolute z-20 mt-1 left-0 w-56 max-h-56 overflow-y-auto rounded-md border shadow-lg"
            style={{
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <div className="p-1.5 border-b" style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar grupo…"
                className="w-full bg-transparent px-1 py-1 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
              />
            </div>

            {filtrados.length === 0 ? (
              <p className="text-micro text-primary/25 italic text-center py-3">Sin resultados</p>
            ) : (
              filtrados.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => elegir(g)}
                  className="w-full flex flex-col items-start gap-0.5 px-2 py-1.5 text-left transition-colors hover:bg-primary/6"
                >
                  <span className="text-micro font-bold text-primary truncate w-full">{g.nombre}</span>
                  <span className="text-[10px] text-primary/40">
                    {(g.componentes ?? []).length} compuesto{(g.componentes ?? []).length === 1 ? "" : "s"}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

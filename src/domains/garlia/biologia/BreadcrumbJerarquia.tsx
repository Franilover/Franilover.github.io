"use client";

/**
 * BreadcrumbJerarquia.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Fila horizontal "Célula > Tejido > Órgano" para mostrar arriba del nombre
 * en cada panel flotante de Biología (PanelEditorCelula/Tejido/Organo).
 * El nivel actual va resaltado y no es clickeable; los otros dos SÍ son
 * clickeables y abren un popover con la lista de items relacionados en esa
 * dirección — hacia arriba (quién me usa) o hacia abajo (de qué estoy
 * hecho) según corresponda:
 *
 *   Parado en Tejido → click "Célula" abre popover con las Células que
 *     componen ESE tejido (useTejidoCelulas, dirección abajo).
 *   Parado en Tejido → click "Órgano" abre popover con los Órganos que
 *     usan ESE tejido (useOrganosDeUnTejido, dirección arriba).
 *   Parado en Célula → click "Tejido" abre popover con los Tejidos que
 *     usan ESA célula (useTejidosDeUnaCelula, dirección arriba).
 *   Parado en Órgano → click "Tejido" abre popover con los Tejidos que
 *     componen ESE órgano (useOrganoTejidos, dirección abajo).
 *
 * Click en un item del popover navega: delega en el callback onNavegar del
 * nivel correspondiente, que el padre (BiologiaPage/CatalogoTejidosBiologia/
 * PanelEditorOrgano) resuelve cerrando el panel actual y abriendo el editor
 * flotante del elegido — mismo patrón que onAbrirCelula ya existente.
 *
 * Genérico y sin conocimiento de Supabase: recibe los items ya resueltos
 * (o un loader) por nivel vía props, así que el mismo componente sirve para
 * el espejo en Física (Grano > Veta > Formación) pasando otros labels/data.
 */

import { ChevronRight } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export interface NivelBreadcrumb {
  /** Label del nivel, ej. "Célula" / "Tejido" / "Órgano". */
  label: string;
  /** Ícono chico del nivel (mismo que usa el panel editor correspondiente). */
  icono?: React.ReactNode;
  /** true si este es el nivel del panel abierto actualmente (no clickeable, resaltado). */
  activo: boolean;
  /**
   * Items relacionados a mostrar en el popover cuando se clickea este nivel
   * desde OTRO nivel activo. Si es null/undefined mientras loading=true,
   * el popover muestra "Cargando…". Si es [] con loading=false, muestra
   * "Sin vínculos".
   */
  items?: { id: string; nombre: string }[];
  loading?: boolean;
  /** Navegar al item elegido: cierra el panel actual y abre el de destino. */
  onNavegar?: (id: string) => void;
}

interface Props {
  niveles: NivelBreadcrumb[];
}

export function BreadcrumbJerarquia({ niveles }: Props) {
  const [abiertoIdx, setAbiertoIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (abiertoIdx === null) return;
    function onClickFuera(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbiertoIdx(null);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAbiertoIdx(null);
    }
    document.addEventListener("mousedown", onClickFuera);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickFuera);
      document.removeEventListener("keydown", onEsc);
    };
  }, [abiertoIdx]);

  return (
    <div ref={containerRef} className="flex items-center gap-1 flex-wrap">
      {niveles.map((nivel, idx) => (
        <React.Fragment key={nivel.label}>
          {idx > 0 && <ChevronRight size={11} className="text-primary/20 shrink-0" />}
          <div className="relative">
            <button
              type="button"
              disabled={nivel.activo}
              onClick={() => setAbiertoIdx((prev) => (prev === idx ? null : idx))}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-micro font-black uppercase tracking-widest transition-colors ${
                nivel.activo
                  ? "text-primary cursor-default"
                  : "text-primary/40 hover:text-primary hover:bg-primary/6 cursor-pointer"
              }`}
              title={nivel.activo ? undefined : `Ver ${nivel.label.toLowerCase()}s relacionados`}
            >
              {nivel.icono}
              {nivel.label}
            </button>

            {abiertoIdx === idx && !nivel.activo && (
              <PopoverNivel
                nivel={nivel}
                onElegir={(id) => {
                  setAbiertoIdx(null);
                  nivel.onNavegar?.(id);
                }}
                onClose={() => setAbiertoIdx(null)}
              />
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function PopoverNivel({
  nivel,
  onElegir,
  onClose,
}: {
  nivel: NivelBreadcrumb;
  onElegir: (id: string) => void;
  onClose: () => void;
}) {
  const items = nivel.items ?? [];

  return (
    <div
      className="absolute z-30 mt-1 left-0 min-w-[11rem] max-w-[16rem] max-h-56 overflow-y-auto rounded-lg border shadow-xl py-1"
      style={{
        background: "var(--bg-main)",
        borderColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
        animation: "popIn 120ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="px-2.5 pb-1 text-[0.6rem] font-black uppercase tracking-[0.2em] text-primary/30 border-b border-primary/8 mb-1">
        {nivel.label}s
      </p>

      {nivel.loading && items.length === 0 ? (
        <p className="px-2.5 py-1.5 text-micro text-primary/25 italic">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="px-2.5 py-1.5 text-micro text-primary/25 italic">
          Sin {nivel.label.toLowerCase()}s vinculados
        </p>
      ) : (
        items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onElegir(it.id)}
            className="w-full text-left px-2.5 py-1.5 text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate cursor-pointer"
          >
            {it.nombre || "(sin nombre)"}
          </button>
        ))
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full text-left px-2.5 pt-1 mt-1 border-t border-primary/8 text-[0.6rem] font-black uppercase tracking-widest text-primary/25 hover:text-primary/50 transition-colors cursor-pointer"
      >
        Cerrar
      </button>
    </div>
  );
}

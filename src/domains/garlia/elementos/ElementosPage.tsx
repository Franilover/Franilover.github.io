"use client";

/**
 * ElementosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la sección "Tabla" (Tabla Química/Alquímica): grid de los 29
 * elementos + detalle inline al seleccionar uno (capas núcleo/media/externa
 * editables). Mismo patrón que RunasPage: sin navegar a otra ruta, toggle
 * de selección adentro de la misma página.
 *
 * Pensado para crecer con tabs hermanas (Iums, Simulador de reacciones) —
 * ver PanelSubTabsElementos más abajo, hoy con un solo tab activo.
 */

import { Atom, Loader2, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";

import { EntityCardGrid } from "@/domains/garlia/_shared/EntityCardGrid";

import { ElementoEditor } from "./ElementoEditor";
import { FAMILY_ICON, formatLayer, type Elemento } from "./types";

interface Props {
  elementos: Elemento[];
  loading?: boolean;
  creating?: boolean;
  onCreate?: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
  /** Id a dejar seleccionado tras crear (mismo patrón que runaRecienCreadaId). */
  seleccionarId?: string | null;
}

export function ElementosPage({
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
    () => elementos.find((e) => e.id === activoId) ?? null,
    [elementos, activoId],
  );

  if (activo) {
    return (
      <ElementoEditor
        elemento={activo}
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
    );
  }

  const items = elementos.map((el) => ({
    id: el.id,
    nombre: `#${el.numero_atomico} ${el.nombre}`,
    subtitle: `${el.simbolo} · N ${formatLayer(el.nucleo)} · M ${formatLayer(el.media)} · E ${formatLayer(el.externa)}`,
  }));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-primary/40">
          <Atom size={13} />
          <p className="text-micro font-black uppercase tracking-widest">
            Tabla Química · {elementos.length} elementos
          </p>
        </div>
        {onCreate && (
          <button
            type="button"
            disabled={creating}
            onClick={onCreate}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {creating ? <Loader2 className="animate-spin" size={11} /> : <Plus size={11} />}
            Nuevo elemento
          </button>
        )}
      </div>

      <EntityCardGrid
        title="Elementos"
        Icon={Atom}
        items={items}
        loading={loading}
        onItemClick={(id) => setSeleccionadoId(id)}
        emptyLabel="Todavía no hay elementos cargados."
        minCardWidth={130}
      />
    </div>
  );
}

"use client";

/**
 * TarjetaFormacionOrgano.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Tarjeta de edición para un Órgano o Formación ya vinculado a una entidad
 * (planta, mineral, item, o criatura) — nombre libre, función, notas, y la
 * fórmula de compuestos que lo compone.
 *
 * La fórmula ya NO es una columna `componentes` inline del propio
 * Organo/Formacion (esa columna no existe en Supabase) — vive 2 niveles
 * más abajo: Organo→organo_tejidos→Tejido→Célula→Compuesto, o su espejo
 * Formacion→formacion_vetas→Veta→Grano→Compuesto. Esta tarjeta resuelve
 * esa cadena con useOrganoTejidos/useFormacionVetas según `tipo`, y
 * delega la lista de la fórmula a SelectorFormulaTejidos (reemplaza al
 * viejo SelectorFormulaOrgano, que editaba un array plano).
 *
 * Un solo componente para los consumidores (Formaciones de Minerales,
 * Formaciones de Items, Órganos de Flora, Órganos de Criaturas) — el
 * nombre distingue el vocabulario del placeholder (Órgano vs Formación)
 * pero el comportamiento es idéntico.
 */

import { Trash2 } from "lucide-react";
import React from "react";

import type { EntradaCatalogoGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";
import { useOrganoTejidos } from "@/domains/garlia/elementos/useOrganoTejidos";
import { useFormacionVetas } from "@/domains/garlia/elementos/useFormacionVetas";
import { SelectorFormulaTejidos } from "@/domains/garlia/_shared/SelectorFormulaTejidos";
import type { Compuesto } from "@/domains/garlia/elementos/types";

/** Vínculo puente ya resuelto contra el catálogo — mismo shape para
 *  PlantaOrganoResuelto, MineralFormacion, CriaturaOrganoResuelto, y
 *  GrupoVinculadoResuelto genérico. */
export interface VinculadoConFormula extends EntradaCatalogoGrupo {
  vinculo_id: string;
}

export function TarjetaFormacionOrgano<T extends VinculadoConFormula>({
  item,
  tipo = "organo",
  onUpdate,
  onDelete,
  compuestos,
  onAbrirCompuesto,
  onAbrirGrupo,
  placeholderNombre = "Nombre…",
  placeholderNotas = "Notas…",
  tituloEliminar = "Quitar de aquí (sigue en el catálogo para otras entidades)",
}: {
  item: T;
  /** "organo" resuelve la fórmula vía Tejidos/Células; "formacion" vía Vetas/Granos. */
  tipo?: "organo" | "formacion";
  onUpdate: (id: string, updates: Partial<EntradaCatalogoGrupo>) => void;
  onDelete: () => void;
  compuestos: Compuesto[];
  onAbrirCompuesto?: (compuestoId: string) => void;
  /** Abre este Órgano/Formación en el panel flotante — vista completa
   *  fuera de la tarjeta inline, útil cuando está vinculado a muchas
   *  entidades y se quiere editar desde un solo lugar. */
  onAbrirGrupo?: (id: string) => void;
  placeholderNombre?: string;
  placeholderNotas?: string;
  tituloEliminar?: string;
}) {
  // Solo uno de los dos hooks resuelve datos reales (el otro recibe null
  // y queda inactivo) — según `tipo`, evita condicionalizar hooks.
  const tejidos = useOrganoTejidos(tipo === "organo" ? item.id : null);
  const vetas = useFormacionVetas(tipo === "formacion" ? item.id : null);

  const formula = tipo === "organo" ? tejidos : vetas;

  return (
    <div className="group py-3 px-3 rounded-lg border border-primary/10">
      <div className="flex items-center justify-between mb-2 gap-2">
        {onAbrirGrupo ? (
          <button
            type="button"
            onClick={() => onAbrirGrupo(item.id)}
            title="Abrir en el editor flotante"
            className="min-w-0 flex-1 text-left bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 truncate transition-colors hover:text-accent hover:underline cursor-pointer"
          >
            {item.nombre || placeholderNombre}
          </button>
        ) : (
          <input
            className="min-w-0 flex-1 bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
            placeholder={placeholderNombre}
            value={item.nombre ?? ""}
            onChange={(e) => onUpdate(item.id, { nombre: e.target.value })}
          />
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onDelete}
            title={tituloEliminar}
            className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mb-2">
        <input
          className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none transition-colors placeholder:text-primary/25 placeholder:font-normal"
          placeholder="Función…"
          value={item.funcion ?? ""}
          onChange={(e) => onUpdate(item.id, { funcion: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-xs items-start">
        <div>
          <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
            Fórmula
          </p>
          {formula.loading ? (
            <p className="text-micro text-primary/25 italic">Cargando…</p>
          ) : (
            <SelectorFormulaTejidos
              compuestos={compuestos}
              items={formula.items}
              onAgregar={(compuestoId) => void formula.agregarCompuesto(compuestoId)}
              onActualizarCompuesto={(catalogoId, compuestoId) =>
                void formula.actualizarCompuesto(catalogoId, compuestoId)
              }
              onActualizarProporcion={(vinculoId, proporcion) =>
                void formula.actualizarProporcion(vinculoId, proporcion)
              }
              onQuitar={(vinculoId) => void formula.quitarCompuesto(vinculoId)}
              onAbrirCompuesto={onAbrirCompuesto}
            />
          )}
        </div>

        <div>
          <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
            Notas
          </p>
          <textarea
            className="w-full h-full min-h-[3.5rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
            placeholder={placeholderNotas}
            value={item.notas ?? ""}
            onChange={(e) => onUpdate(item.id, { notas: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

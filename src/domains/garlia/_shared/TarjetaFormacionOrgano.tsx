"use client";

/**
 * TarjetaFormacionOrgano.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Tarjeta de SOLO LECTURA para un Órgano o Formación ya vinculado a una
 * entidad (planta, mineral, item, o criatura) — nombre, función, fórmula y
 * notas se muestran pero no se editan acá. Toda edición (agregar/usar
 * existente/quitar de la fórmula, cambiar nombre/función/notas) vive en su
 * editor propio: GrupoCompuestoPanelFlotante, que se abre clickeando el
 * nombre (onAbrirGrupo). Esto evita duplicar el mismo estado editable en
 * dos lugares a la vez (la tarjeta inline y el panel flotante).
 *
 * La fórmula ya NO es una columna `componentes` inline del propio
 * Organo/Formacion (esa columna no existe en Supabase) — vive 2 niveles
 * más abajo: Organo→organo_tejidos→Tejido→Célula→Compuesto, o su espejo
 * Formacion→formacion_vetas→Veta→Grano→Compuesto. Esta tarjeta resuelve
 * esa cadena con useOrganoTejidos/useFormacionVetas según `tipo`, y
 * delega la lista de la fórmula a SelectorFormulaTejidos en modo
 * `soloLectura` (solo nombre + proporción, sin controles de edición).
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

/** Vínculo puente ya resuelto contra el catálogo — mismo shape para
 *  PlantaOrganoResuelto, MineralFormacion, CriaturaOrganoResuelto, y
 *  GrupoVinculadoResuelto genérico. */
export interface VinculadoConFormula extends EntradaCatalogoGrupo {
  vinculo_id: string;
}

export function TarjetaFormacionOrgano<T extends VinculadoConFormula>({
  item,
  tipo = "organo",
  onDelete,
  onAbrirCelula,
  onAbrirGrupo,
  placeholderNombre = "Sin nombre",
  placeholderNotas = "Sin notas.",
  tituloEliminar = "Quitar de aquí (sigue en el catálogo para otras entidades)",
}: {
  item: T;
  /** "organo" resuelve la fórmula vía Tejidos/Células; "formacion" vía Vetas/Granos. */
  tipo?: "organo" | "formacion";
  /** Desvincula el Órgano/Formación de esta entidad (no lo borra del
   *  catálogo). Si se omite, no se muestra el botón. Editar el contenido
   *  (nombre, función, fórmula, notas) es responsabilidad del editor
   *  propio — ver onAbrirGrupo. */
  onDelete?: () => void;
  /** Abre el editor de la Célula/Grano que compone una fila de la fórmula
   *  (clickeando "hecho de: [Célula]") — el Compuesto se edita adentro de
   *  ese panel, no acá. */
  onAbrirCelula?: (celulaOGranoId: string) => void;
  /** Abre este Órgano/Formación en su editor propio (panel flotante) —
   *  único lugar donde se edita nombre/función/fórmula/notas. Si se omite,
   *  el nombre se muestra como texto plano (no clickeable). */
  onAbrirGrupo?: (id: string) => void;
  placeholderNombre?: string;
  placeholderNotas?: string;
  tituloEliminar?: string;
}) {
  // Solo uno de los dos hooks resuelve datos reales (el otro recibe null
  // y queda inactivo) — según `tipo`, evita condicionalizar hooks.
  const tejidos = useOrganoTejidos(tipo === "organo" ? item.id : null);
  const vetas = useFormacionVetas(tipo === "formacion" ? item.id : null);

  return (
    <div className="group py-3 px-3 rounded-lg border border-primary/10">
      <div className="flex items-center justify-between mb-2 gap-2">
        {onAbrirGrupo ? (
          <button
            type="button"
            onClick={() => onAbrirGrupo(item.id)}
            title="Abrir en el editor"
            className="min-w-0 flex-1 text-left bg-transparent px-0 py-1 text-sm font-semibold text-primary/80 truncate transition-colors hover:text-accent hover:underline cursor-pointer"
          >
            {item.nombre || placeholderNombre}
          </button>
        ) : (
          <p className="min-w-0 flex-1 truncate px-0 py-1 text-sm font-semibold text-primary/80">
            {item.nombre || placeholderNombre}
          </p>
        )}
        {onDelete && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onDelete}
              title={tituloEliminar}
              className="p-1 rounded hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {item.funcion && (
        <div className="mb-2">
          <p className="px-0 py-0.5 text-micro font-bold text-primary/60">{item.funcion}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-xs items-start">
        <div>
          <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
            Fórmula
          </p>
          {tipo === "organo" ? (
            tejidos.loading && tejidos.items.length === 0 ? (
              <p className="text-micro text-primary/25 italic">Cargando…</p>
            ) : (
              <SelectorFormulaTejidos
                items={tejidos.items}
                onActualizarProporcion={() => {}}
                onQuitar={() => {}}
                onAbrirCelula={onAbrirCelula}
                soloLectura
              />
            )
          ) : vetas.loading && vetas.items.length === 0 ? (
            <p className="text-micro text-primary/25 italic">Cargando…</p>
          ) : vetas.items.length === 0 ? (
            <p className="text-micro text-primary/25 italic">Nada definido todavía.</p>
          ) : (
            <div className="flex flex-col divide-y divide-primary/10">
              {vetas.items.map((veta) => (
                <div key={veta.vinculo_id} className="py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    {onAbrirGrupo ? (
                      <button
                        type="button"
                        onClick={() => onAbrirGrupo(veta.veta_id)}
                        className="min-w-0 truncate text-left text-xs font-semibold text-primary/70 hover:text-accent hover:underline"
                      >
                        {veta.nombre || "Veta sin nombre"}
                      </button>
                    ) : (
                      <span className="min-w-0 truncate text-xs font-semibold text-primary/70">
                        {veta.nombre || "Veta sin nombre"}
                      </span>
                    )}
                    {veta.proporcion && (
                      <span className="shrink-0 text-micro text-primary/40">
                        {veta.proporcion}
                      </span>
                    )}
                  </div>

                  {veta.granos.length > 0 && (
                    <div className="mt-1 ml-2 flex flex-col gap-0.5">
                      {veta.granos.map((grano) => (
                        <button
                          key={grano.vinculo_id}
                          type="button"
                          onClick={() => onAbrirCelula?.(grano.grano_id)}
                          disabled={!onAbrirCelula}
                          className="text-left text-micro text-primary/50 hover:text-accent disabled:hover:text-primary/50 disabled:cursor-default"
                        >
                          hecho de: {" "}
                          <span className="font-medium">
                            {grano.nombre || "Grano sin nombre"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
            Notas
          </p>
          <p className="w-full h-full min-h-[3.5rem] px-0 py-1 text-primary/70 whitespace-pre-wrap">
            {item.notas || placeholderNotas}
          </p>
        </div>
      </div>
    </div>
  );
}

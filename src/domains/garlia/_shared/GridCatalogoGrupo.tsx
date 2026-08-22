"use client";

/**
 * GridCatalogoGrupo.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Grid de tarjetas clickeables sobre un catálogo global (Organo, Formacion,
 * o Reaccion/Proceso — todos comparten el shape GrupoCompuesto/Reaccion),
 * cada una abriendo su editor flotante completo — GrupoCompuestoPanelFlotante
 * o ReaccionPanelFlotante, los mismos "editores propios" que ya usa Química
 * (GruposCompuestosPage/ReaccionesPage) e Items.
 *
 * Nace del rediseño de Biología (tabs Órganos/Procesos) y Física (grids de
 * Formaciones/Habilidades debajo de Subsistemas): en vez de triplicar el
 * mismo grid+card+popover en cada lugar, un solo componente parametrizado
 * por `modo` ("grupo" | "reaccion").
 *
 * A diferencia de GruposCompuestosPage/ReaccionesPage (que además ofrecen
 * crear/eliminar desde ahí), esta vista es de solo navegación + edición del
 * contenido existente — crear registros nuevos en el catálogo global sigue
 * siendo responsabilidad de Química, para no duplicar ese flujo en 3
 * lugares distintos.
 */

import { Boxes, Gem, Sprout, FlaskConical } from "lucide-react";
import React, { useState } from "react";

import { GrupoCompuestoPanelFlotante } from "@/domains/garlia/elementos/GruposCompuestosPage";
import { ReaccionPanelFlotante } from "@/domains/garlia/elementos/ReaccionesPage";
import type { Compuesto, Elemento, GrupoCompuesto, Reaccion } from "@/domains/garlia/elementos/types";

type Props =
  | {
      modo: "grupo";
      titulo: string;
      items: GrupoCompuesto[];
      compuestos: Compuesto[];
      onActualizar: (id: string, cambios: Partial<GrupoCompuesto>) => void;
      onEliminar?: (id: string) => void;
      onAbrirCompuesto?: (compuestoId: string) => void;
      /** Ícono de tarjeta — por defecto según el tipo de GrupoCompuesto más común en items. */
      icono?: "organo" | "formacion" | "generico";
    }
  | {
      modo: "reaccion";
      titulo: string;
      items: Reaccion[];
      compuestos: Compuesto[];
      elementos: Elemento[];
      onActualizar: (id: string, cambios: Partial<Reaccion>) => void;
      onEliminar?: (id: string) => void;
      onAbrirItem?: (item: { tipo: "elemento" | "compuesto"; id: string }) => void;
    };

function IconoGrupo({ tipo }: { tipo?: "organo" | "formacion" | "generico" }) {
  if (tipo === "organo") return <Sprout size={12} className="text-primary/40 shrink-0" />;
  if (tipo === "formacion") return <Gem size={12} className="text-primary/40 shrink-0" />;
  return <Boxes size={12} className="text-primary/40 shrink-0" />;
}

/**
 * Vista de catálogo global en grid de 3 columnas — mismo lenguaje visual
 * que BasesItemCard en fisica/FisicaPage.tsx (tarjeta compacta con solo el
 * nombre, click abre el detalle completo en un panel flotante centrado).
 */
export function GridCatalogoGrupo(props: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const activo =
    props.modo === "grupo"
      ? props.items.find((i) => i.id === seleccionadoId) ?? null
      : props.items.find((i) => i.id === seleccionadoId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
        {props.titulo} · {props.items.length}
      </p>

      {props.items.length === 0 ? (
        <div className="py-4 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
          Sin {props.titulo.toLowerCase()} todavía
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 items-start">
          {props.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSeleccionadoId(item.id)}
              className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                seleccionadoId === item.id
                  ? "border-primary/30 bg-primary/5"
                  : "border-primary/10 bg-primary/[0.02] hover:border-primary/25 hover:bg-primary/5"
              }`}
            >
              {props.modo === "grupo" ? (
                <IconoGrupo tipo={props.icono} />
              ) : (
                <FlaskConical size={12} className="text-primary/40 shrink-0" />
              )}
              <span className="text-micro font-black text-primary truncate">
                {item.nombre || "(sin nombre)"}
              </span>
            </button>
          ))}
        </div>
      )}

      {activo && props.modo === "grupo" && (
        <GrupoCompuestoPanelFlotante
          grupo={activo as GrupoCompuesto}
          compuestos={props.compuestos}
          onCerrar={() => setSeleccionadoId(null)}
          onActualizar={props.onActualizar}
          onEliminar={
            props.onEliminar
              ? (id) => {
                  props.onEliminar!(id);
                  setSeleccionadoId(null);
                }
              : undefined
          }
          onAbrirCompuesto={props.onAbrirCompuesto}
        />
      )}

      {activo && props.modo === "reaccion" && (
        <ReaccionPanelFlotante
          reaccion={activo as Reaccion}
          compuestos={props.compuestos}
          elementos={props.elementos}
          onCerrar={() => setSeleccionadoId(null)}
          onActualizar={props.onActualizar}
          onEliminar={
            props.onEliminar
              ? (id) => {
                  props.onEliminar!(id);
                  setSeleccionadoId(null);
                }
              : undefined
          }
          onAbrirItem={props.onAbrirItem}
        />
      )}
    </div>
  );
}

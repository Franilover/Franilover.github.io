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
import React, { useEffect, useState } from "react";

import { GrupoCompuestoPanelFlotante } from "@/domains/garlia/elementos/GruposCompuestosPage";
import { ReaccionPanelFlotante } from "@/domains/garlia/elementos/ReaccionesPage";
import type { Compuesto, Elemento, Reaccion } from "@/domains/garlia/elementos/types";
import type { EntradaCatalogoGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";
import { PillCatalogoItem } from "@/domains/garlia/_shared/PillCatalogoItem";

type Props =
  | {
      modo: "grupo";
      titulo: string;
      items: EntradaCatalogoGrupo[];
      compuestos: Compuesto[];
      onActualizar: (id: string, cambios: Partial<EntradaCatalogoGrupo>) => void;
      onEliminar?: (id: string) => void;
      onAbrirCompuesto?: (compuestoId: string) => void;
      /** Ícono de tarjeta Y qué cadena de composición resolver en el panel
       *  flotante (organo→tejidos/células, formacion→vetas/granos). */
      icono?: "organo" | "formacion" | "generico";
      /**
       * Id de un item de este catálogo a abrir de forma controlada desde
       * afuera — usado para navegar hasta acá desde el breadcrumb
       * "Tejido → Órgano" de un PanelEditorTejido que no vive dentro de
       * este grid. Cuando cambia, reemplaza la selección interna.
       */
      abrirIdExterno?: string | null;
      /** Se llama tras consumir abrirIdExterno, para que el padre limpie su estado. */
      onAbrirIdExternoConsumido?: () => void;
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

  // Navegación controlada desde afuera (breadcrumb Tejido → Órgano): al
  // recibir un id nuevo, lo abre acá igual que un click de tarjeta, y avisa
  // al padre para que limpie su estado y no reabra en loop.
  useEffect(() => {
    if (props.modo !== "grupo" || !props.abrirIdExterno) return;
    setSeleccionadoId(props.abrirIdExterno);
    props.onAbrirIdExternoConsumido?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.modo === "grupo" ? props.abrirIdExterno : null]);

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
        <div className="flex flex-wrap gap-1">
          {props.items.map((item) => (
            <PillCatalogoItem
              key={item.id}
              nombre={item.nombre}
              seleccionado={seleccionadoId === item.id}
              onClick={() => setSeleccionadoId(item.id)}
              icono={
                props.modo === "grupo" ? (
                  <IconoGrupo tipo={props.icono} />
                ) : (
                  <FlaskConical size={12} className="text-primary/40 shrink-0" />
                )
              }
            />
          ))}
        </div>
      )}

      {activo && props.modo === "grupo" && (
        <GrupoCompuestoPanelFlotante
          grupo={activo as EntradaCatalogoGrupo}
          tipo={props.icono === "formacion" ? "formacion" : "organo"}
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
          onAbrirOrganoExterno={
            props.icono !== "formacion"
              ? (organoId) => setSeleccionadoId(organoId)
              : undefined
          }
          onAbrirFormacionExterna={
            props.icono === "formacion"
              ? (formacionId) => setSeleccionadoId(formacionId)
              : undefined
          }
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

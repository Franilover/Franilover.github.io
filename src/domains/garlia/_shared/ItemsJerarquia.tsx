"use client";

/**
 * ItemsJerarquia
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de "Entidades" para Items, 3ra opción del dropdown de agrupación
 * (junto a GeografiaJerarquica / CriaturasJerarquica — ver
 * AgrupacionPersonajesDropdown y EntidadesPage). "Items" dejó de ser una
 * sección propia de la navbar y pasó a vivir acá adentro.
 *
 * A diferencia de sus pares, esta vista NO tiene relación con Personajes:
 * muestra Items en un único grid plano (sin agrupar por categoría ni
 * ninguna otra jerarquía) — no hay drag & drop ni popovers anidados.
 * Debajo, en el mismo criterio, se muestran aparte Flora y Minerales
 * (tampoco agrupados) — mismo catálogo que ya aparece en la vista "por
 * Criatura" (colgando de Ecosistema ahí), acá solo como bloques planos
 * informativos. Item, Flora y Mineral abren el panel flotante
 * (abrirPanel(kind, id)), igual que Personaje/Criatura/Reino en las otras
 * vistas jerárquicas.
 */

import React from "react";

import { BuscadorInline } from "@/domains/garlia/_shared/BuscadorInline";
import { EntityCardGrid } from "@/domains/garlia/_shared/EntityCardGrid";
import { GrupoFiltroBarra, type GrupoFiltroSubtipo } from "@/domains/garlia/_shared/GrupoFiltroDropdown";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";

interface Item {
  id: string;
  nombre: string;
  imagen_url?: string | null;
}
interface EntidadMin {
  id: string;
  nombre: string;
  imagen_url?: string | null;
}

interface Props {
  items: Item[];
  loading?: boolean;
  onCreate?: () => void;
  creating?: boolean;
  /** Flora — se muestra como bloque aparte debajo del grid de Items, sin
   *  agrupar (no tiene campo `categoria`). Puramente informativo: reusa
   *  el mismo catálogo que ya se muestra en la vista "por Criatura". */
  flora?: EntidadMin[];
  loadingFlora?: boolean;
  /** Minerales — mismo criterio que `flora`. */
  minerales?: EntidadMin[];
  loadingMinerales?: boolean;
  /** Grupos de tipo "items" agrupados por subtipo, para el dropdown de
   *  filtro por grupo de la barra superior — mismo patrón que las otras
   *  vistas jerárquicas. */
  gruposItemsPorSubtipo?: GrupoFiltroSubtipo[];
  grupoSeleccionadoId?: string | null;
  onSeleccionarGrupo?: (grupoId: string | null) => void;
  onOpenGrupo?: (grupoId: string) => void;
  busqueda: string;
  onBusquedaChange: (value: string) => void;
  /** Selector de agrupación (dropdown Reino/Criatura/Items + toggle ojo) —
   *  se renderiza pegado al buscador, igual que en GeografiaJerarquica y
   *  CriaturasJerarquica. */
  agrupacionSelector?: React.ReactNode;
}

export function ItemsJerarquia({
  items,
  loading,
  onCreate,
  creating,
  flora,
  loadingFlora,
  minerales,
  loadingMinerales,
  gruposItemsPorSubtipo,
  grupoSeleccionadoId,
  onSeleccionarGrupo,
  onOpenGrupo,
  busqueda,
  onBusquedaChange,
  agrupacionSelector,
}: Props) {
  const abrirPanel = usePanelFlotante((s) => s.abrir);

  const grupoSeleccionado = grupoSeleccionadoId
    ? gruposItemsPorSubtipo?.flatMap((b) => b.grupos).find((g) => g.id === grupoSeleccionadoId)
    : null;

  const itemsDelGrupo = grupoSeleccionado
    ? items.filter((i) => grupoSeleccionado.miembro_ids.includes(i.id))
    : items;

  const q = busqueda.trim().toLocaleLowerCase("es");
  const itemsFiltrados = q
    ? itemsDelGrupo.filter((i) => i.nombre?.toLocaleLowerCase("es").includes(q))
    : itemsDelGrupo;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
        {agrupacionSelector}
        <BuscadorInline
          value={busqueda}
          onChange={onBusquedaChange}
          placeholder="Buscar item por nombre…"
        />
        {gruposItemsPorSubtipo && (
          <GrupoFiltroBarra
            bloques={gruposItemsPorSubtipo}
            grupoSeleccionadoId={grupoSeleccionadoId ?? null}
            onSeleccionarGrupo={onSeleccionarGrupo ?? (() => {})}
            onOpenGrupo={onOpenGrupo}
          />
        )}
      </div>

      <EntityCardGrid
        title="Items"
        variant="grid"
        loading={loading}
        items={itemsFiltrados.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          imageUrl: i.imagen_url || undefined,
        }))}
        onItemClick={(id) => abrirPanel("item", id)}
        onCreate={onCreate}
        creating={creating}
        section="items"
      />

      {/* Flora y Minerales — bloques aparte, sin agrupar (no tienen
          `categoria`), debajo del grid de Items. Mismo catálogo que ya se
          ve en la vista "por Criatura", puramente informativo acá: solo
          mostrarlos y poder abrir su editor. */}
      {flora && flora.length > 0 && (
        <EntityCardGrid
          title="Flora"
          variant="grid"
          loading={loadingFlora}
          items={flora.map((f) => ({
            id: f.id,
            nombre: f.nombre,
            imageUrl: f.imagen_url || undefined,
          }))}
          onItemClick={(id) => abrirPanel("flora", id)}
          section="flora"
        />
      )}
      {minerales && minerales.length > 0 && (
        <EntityCardGrid
          title="Minerales"
          variant="grid"
          loading={loadingMinerales}
          items={minerales.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            imageUrl: m.imagen_url || undefined,
          }))}
          onItemClick={(id) => abrirPanel("mineral", id)}
          section="minerales"
        />
      )}
    </div>
  );
}

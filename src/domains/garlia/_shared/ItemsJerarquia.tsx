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
 * muestra Items agrupados por su campo `categoria` (ej. "Arma", "Poción")
 * en bloques con encabezado, acomodados en un layout tipo masonry (columnas
 * CSS, sin medir el DOM) — igual criterio visual que las columnas de
 * ecosistemas/reinos en CriaturasJerarquica/GeografiaJerarquica, ordenadas
 * alfabéticamente y con los sin-categoría al final.
 *
 * Arrastre (click izquierdo abre / click derecho arrastra): usa el hook
 * compartido useRightClickDrag (DragDropReasignable.tsx), mismo patrón que
 * GeografiaJerarquica/CriaturasJerarquica — un solo arrastre acá: la
 * EntityCard de un Item se puede soltar sobre el título de otro bloque de
 * categoría para reasignar Item.categoria (onMoverItem). Si no se pasa
 * onMoverItem, las cards no son arrastrables (comportamiento previo).
 *
 * Debajo, en el mismo criterio, se muestran aparte Flora y Minerales
 * (tampoco agrupados) — mismo catálogo que ya aparece en la vista "por
 * Criatura" (colgando de Ecosistema ahí), acá solo como bloques planos
 * informativos. Item, Flora y Mineral abren el panel flotante
 * (abrirPanel(kind, id)), igual que Personaje/Criatura/Reino en las otras
 * vistas jerárquicas.
 */

import { Box } from "lucide-react";
import React from "react";

import { BuscadorInline } from "@/domains/garlia/_shared/BuscadorInline";
import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import { EntityCardGrid } from "@/domains/garlia/_shared/EntityCardGrid";
import { useRightClickDrag } from "@/domains/garlia/_shared/DragDropReasignable";
import { GrupoFiltroBarra, type GrupoFiltroSubtipo } from "@/domains/garlia/_shared/GrupoFiltroDropdown";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";
import { useFavoritos } from "@/domains/garlia/_shared/useFavoritosStore";

interface Item {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  categoria?: string;
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
  /** Reasigna un item a otra categoría (arrastre por click derecho de su
   *  EntityCard sobre el título de otro bloque de categoría). `categoria`
   *  es null cuando se suelta sobre el bloque "Sin categoría". Si no se
   *  pasa, las cards no son arrastrables. */
  onMoverItem?: (itemId: string, categoria: string | null) => void;
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
  /** Ícono de descarga de datos (Items/Criaturas/Personajes), pegado a la
   *  izquierda del botón "+ Añadir" — provisto por EntidadesPage. Como esta
   *  vista no tiene un AñadirDropdown global (usa "+ Añadir" por bloque de
   *  categoría), se renderiza en la barra superior. */
  descargarDatosBoton?: React.ReactNode;
}

/** Bloque "título + grid" de una categoría, con soporte de drag & drop
 *  opcional — mismo look que EntityCardGrid, pero con el título como zona
 *  de drop y cada card como origen de arrastre (envueltas a mano en vez de
 *  usar EntityCardGrid, que no expone esos hooks). */
function BloqueCategoria({
  titulo,
  categoria,
  items,
  loading,
  onItemClick,
  onCreate,
  creating,
  dragItem,
  onMoverItem,
}: {
  titulo: string;
  /** Valor de categoria que representa este bloque — null para "Sin categoría". */
  categoria: string | null;
  items: Item[];
  loading?: boolean;
  onItemClick: (id: string) => void;
  onCreate?: () => void;
  creating?: boolean;
  dragItem?: ReturnType<typeof useRightClickDrag<string>>;
  onMoverItem?: (itemId: string, categoria: string | null) => void;
}) {
  const isFavorito = useFavoritos((s) => s.isFavorito);
  const toggleFavorito = useFavoritos((s) => s.toggleFavorito);

  const zoneId = `categoria:${categoria ?? "__sin_categoria__"}`;
  const dropActive = !!dragItem && !!onMoverItem && dragItem.esZonaActiva(zoneId);
  const dropHandlers =
    dragItem && onMoverItem
      ? dragItem.dropHandlers(zoneId, (itemId) => onMoverItem(itemId, categoria))
      : {};

  return (
    <div className="mb-6">
      <div
        {...dropHandlers}
        className={`flex items-center gap-2 mb-3 px-1 rounded-md transition-colors ${
          dropActive ? "ring-2 ring-accent/60 bg-accent/5" : ""
        }`}
      >
        <h2 className="text-micro font-black uppercase tracking-[0.25em] text-primary/50">
          {titulo}
        </h2>
        <span className="text-micro text-primary/25 tabular-nums">{items.length}</span>
        <div className="flex-1" />
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="text-micro font-bold uppercase tracking-wide text-primary/40 hover:text-primary transition-colors disabled:opacity-50"
          >
            + Añadir
          </button>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
      ) : items.length === 0 ? (
        <div
          {...dropHandlers}
          className={`py-6 text-xs text-center rounded-lg border border-dashed transition-colors ${
            dropActive
              ? "border-accent/40 text-accent/60"
              : "border-transparent text-primary/25"
          }`}
        >
          {dragItem && onMoverItem ? "Soltá un item acá" : `Sin ${titulo.toLowerCase()} todavía`}
        </div>
      ) : (
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))" }}
        >
          {items.map((item) => (
            <div key={item.id} {...(dragItem ? dragItem.dragHandlers(item.id) : {})}>
              <EntityCard
                nombre={item.nombre}
                imageUrl={item.imagen_url}
                Icon={Box}
                onClick={() => onItemClick(item.id)}
                isFavorite={isFavorito("items", item.id)}
                onToggleFavorite={() =>
                  toggleFavorito({ section: "items", id: item.id, nombre: item.nombre })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ItemsJerarquia({
  items,
  loading,
  onCreate,
  creating,
  onMoverItem,
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
  descargarDatosBoton,
}: Props) {
  const abrirPanel = usePanelFlotante((s) => s.abrir);

  const dragItem = useRightClickDrag<string>({
    label: (id) => items.find((i) => i.id === id)?.nombre ?? "",
  });

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

  // Agrupa por categoria (campo simple de texto del item, ej. "Arma",
  // "Poción", "Herramienta"…) — mismo criterio visual que las otras vistas
  // jerárquicas (bloques con encabezado), en orden alfabético, con los
  // sin-categoría al final.
  const categorias = React.useMemo(() => {
    const mapa = new Map<string, Item[]>();
    for (const item of itemsFiltrados) {
      const clave = item.categoria?.trim() || "";
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(item);
    }
    const conCategoria = [...mapa.entries()]
      .filter(([clave]) => clave !== "")
      .sort(([a], [b]) => a.localeCompare(b, "es"));
    const sinCategoria = mapa.get("") ?? [];
    return { conCategoria, sinCategoria };
  }, [itemsFiltrados]);

  const hayCategorias = categorias.conCategoria.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <div className="flex-1 flex items-center gap-2 flex-wrap">
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
        {descargarDatosBoton}
      </div>

      {hayCategorias ? (
        <div className="[column-fill:_balance]" style={{ columnWidth: 300, columnGap: 24 }}>
          {categorias.conCategoria.map(([categoria, itemsCategoria]) => (
            <div key={categoria} className="break-inside-avoid">
              <BloqueCategoria
                titulo={categoria}
                categoria={categoria}
                items={itemsCategoria}
                loading={loading}
                onItemClick={(id) => abrirPanel("item", id)}
                dragItem={dragItem}
                onMoverItem={onMoverItem}
              />
            </div>
          ))}
          {categorias.sinCategoria.length > 0 && (
            <div className="break-inside-avoid">
              <BloqueCategoria
                titulo="Sin categoría"
                categoria={null}
                items={categorias.sinCategoria}
                loading={loading}
                onItemClick={(id) => abrirPanel("item", id)}
                onCreate={onCreate}
                creating={creating}
                dragItem={dragItem}
                onMoverItem={onMoverItem}
              />
            </div>
          )}
        </div>
      ) : (
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
      )}
      {dragItem.overlay}

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

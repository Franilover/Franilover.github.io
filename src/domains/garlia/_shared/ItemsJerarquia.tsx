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
 * Debajo, en el mismo criterio, se muestran aparte Flora y Minerales — mismo
 * catálogo que ya aparece en la vista "por Criatura". Por defecto: Items
 * agrupados por categoría, Flora/Minerales planos. Un toggle "ojo" (mismo
 * patrón que el de Personajes en EntidadesPage) alterna a agrupar por
 * Criatura en su lugar: Items por su `criatura_id` (con bloque "Sin
 * criatura" para los que no tengan) y Flora/Minerales por Ecosistema
 * (Ecosistema.flora_ids / mineral_ids), todo en tarjetas simples de solo
 * lectura + navegación (sin drag&drop ni edición de vínculo — eso vive en
 * el editor de cada entidad). Item, Flora, Mineral y Criatura abren el
 * panel flotante (abrirPanel(kind, id)), igual que Personaje/Criatura/Reino
 * en las otras vistas jerárquicas.
 */

import { Box, Leaf as LeafIcon, Gem as GemIcon, Mountain, Plus, Sprout } from "lucide-react";
import React, { useState } from "react";

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
  criatura_id?: string | null;
}
interface EntidadMin {
  id: string;
  nombre: string;
  imagen_url?: string | null;
}
interface EcosistemaMin {
  id: string;
  nombre: string;
  /** Flora presente en este ecosistema — opcional para no romper usos previos. */
  flora_ids?: string[];
  /** Minerales presentes en este ecosistema — opcional idem. */
  mineral_ids?: string[];
}
interface CriaturaMin {
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
   *  agrupar por defecto (no tiene campo `categoria`). Puramente informativo:
   *  reusa el mismo catálogo que ya se muestra en la vista "por Criatura". */
  flora?: EntidadMin[];
  loadingFlora?: boolean;
  /** Minerales — mismo criterio que `flora`. */
  minerales?: EntidadMin[];
  loadingMinerales?: boolean;
  /** Ecosistemas — habilita el toggle "ojo" para agrupar Flora/Minerales por
   *  Ecosistema en vez de mostrarlos planos (mismo patrón que el toggle de
   *  Personajes en EntidadesPage). Si no se pasa, no aparece el toggle y
   *  Flora/Minerales siempre se muestran planos (comportamiento previo). */
  ecosistemas?: EcosistemaMin[];
  loadingEcosistemas?: boolean;
  /** Navega al editor de un Ecosistema (sección propia, no panel flotante —
   *  mismo criterio que onOpenGrupo/onNavigateCriatura en otras vistas). */
  onOpenEcosistema?: (id: string) => void;
  /** Criaturas — con el toggle "ojo" activo, los Items se agrupan por
   *  `criatura_id` en vez de por categoría (los que no tienen criatura caen
   *  en un bloque "Sin criatura"). Si no se pasa, el ojo solo reagrupa
   *  Flora/Minerales, dejando Items como están. */
  criaturas?: CriaturaMin[];
  loadingCriaturas?: boolean;
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
    <div
      {...dropHandlers}
      className={`mb-6 w-full rounded-lg border overflow-hidden transition-colors ${
        dropActive ? "border-accent/50 bg-accent/5" : "border-primary/10"
      }`}
    >
      <div className="px-3 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="text-micro text-primary/25 tabular-nums">{items.length}</span>
        <h2
          title={titulo}
          className="min-w-0 truncate text-micro font-black uppercase tracking-[0.2em] text-primary/70 text-center justify-self-center max-w-full"
        >
          {titulo}
        </h2>
        <div className="justify-self-end">
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              title="Añadir"
              className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
            >
              <Plus size={9} className="text-primary/60" />
            </button>
          )}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
      ) : items.length === 0 ? (
        <div
          className={`px-3 pb-3 pt-1 text-xs text-center ${
            dropActive ? "text-accent/60" : "text-primary/25"
          }`}
        >
          {dragItem && onMoverItem ? "Soltá un item acá" : `Sin ${titulo.toLowerCase()} todavía`}
        </div>
      ) : (
        <div
          className="px-3 pb-3 grid gap-1"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}
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

/** Tarjeta simple de un Ecosistema con la Flora/Minerales que contiene —
 *  solo lectura + navegación (sin drag&drop ni edición de vínculo, que vive
 *  en PanelEcosistema / SelectorEcosistemasDeEntidad). Mismo lenguaje visual
 *  liviano que BloqueEntidadesDeCriatura. */
function BloqueEcosistemaFloraMinerales({
  ecosistema,
  flora,
  minerales,
  onOpenEcosistema,
  onOpenFlora,
  onOpenMineral,
}: {
  ecosistema: EcosistemaMin;
  flora: EntidadMin[];
  minerales: EntidadMin[];
  onOpenEcosistema: (id: string) => void;
  onOpenFlora: (id: string) => void;
  onOpenMineral: (id: string) => void;
}) {
  return (
    <div className="mb-6 w-full rounded-lg border border-primary/10 overflow-hidden break-inside-avoid">
      <div className="px-3 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="text-micro text-primary/25 tabular-nums">
          {flora.length + minerales.length}
        </span>
        {ecosistema.id === "__sin_ecosistema__" ? (
          <h3
            title={ecosistema.nombre}
            className="min-w-0 truncate flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.2em] text-primary/50 justify-self-center max-w-full"
          >
            <Sprout size={11} className="text-primary/25 shrink-0" />
            {ecosistema.nombre}
          </h3>
        ) : (
          <button
            type="button"
            onClick={() => onOpenEcosistema(ecosistema.id)}
            title={ecosistema.nombre}
            className="min-w-0 truncate flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.2em] text-primary/70 hover:text-accent transition-colors justify-self-center max-w-full"
          >
            <Sprout size={11} className="text-primary/35 shrink-0" />
            {ecosistema.nombre}
          </button>
        )}
        <span />
      </div>

      {flora.length === 0 && minerales.length === 0 ? (
        <p className="px-3 pb-3 text-micro text-primary/25 italic">Sin flora ni minerales</p>
      ) : (
        <div
          className="px-3 pb-3 grid gap-1"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}
        >
          {flora.map((f) => (
            <EntityCard
              key={f.id}
              nombre={f.nombre}
              imageUrl={f.imagen_url}
              Icon={LeafIcon}
              onClick={() => onOpenFlora(f.id)}
            />
          ))}
          {minerales.map((m) => (
            <EntityCard
              key={m.id}
              nombre={m.nombre}
              imageUrl={m.imagen_url}
              Icon={GemIcon}
              onClick={() => onOpenMineral(m.id)}
            />
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
  ecosistemas,
  loadingEcosistemas,
  onOpenEcosistema,
  criaturas,
  loadingCriaturas,
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
  const [porEcosistema, setPorEcosistema] = useState(false);

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

  // Agrupa Flora/Minerales por Ecosistema (Ecosistema.flora_ids/mineral_ids)
  // cuando el toggle "ojo" está activo — mismo criterio de lectura que
  // useEntidadesDeCriatura, pero acá resuelto localmente ya que se pasan los
  // catálogos completos. Entidades sin ecosistema asignado caen aparte.
  const porEcosistemaData = React.useMemo(() => {
    if (!ecosistemas) return null;
    const floraById = new Map((flora ?? []).map((f) => [f.id, f]));
    const mineralById = new Map((minerales ?? []).map((m) => [m.id, m]));
    const floraAsignada = new Set<string>();
    const mineralAsignado = new Set<string>();

    const bloques = ecosistemas
      .map((eco) => {
        const floraEco = (eco.flora_ids ?? [])
          .map((id) => floraById.get(id))
          .filter((f): f is EntidadMin => !!f);
        const mineralesEco = (eco.mineral_ids ?? [])
          .map((id) => mineralById.get(id))
          .filter((m): m is EntidadMin => !!m);
        floraEco.forEach((f) => floraAsignada.add(f.id));
        mineralesEco.forEach((m) => mineralAsignado.add(m.id));
        return { ecosistema: eco, flora: floraEco, minerales: mineralesEco };
      })
      .filter((b) => b.flora.length > 0 || b.minerales.length > 0)
      .sort((a, b) => a.ecosistema.nombre.localeCompare(b.ecosistema.nombre, "es"));

    const floraSinEco = (flora ?? []).filter((f) => !floraAsignada.has(f.id));
    const mineralesSinEco = (minerales ?? []).filter((m) => !mineralAsignado.has(m.id));

    return { bloques, floraSinEco, mineralesSinEco };
  }, [ecosistemas, flora, minerales]);

  // Agrupa Items por Criatura (item.criatura_id) cuando el toggle "ojo" está
  // activo — reemplaza el agrupado por categoría. Los items sin criatura
  // asignada caen en un bloque "Sin criatura" aparte, mismo criterio que
  // "Sin categoría" en el agrupado por defecto.
  const porCriaturaData = React.useMemo(() => {
    if (!criaturas) return null;
    const criaturaById = new Map(criaturas.map((c) => [c.id, c]));
    const mapa = new Map<string, Item[]>();
    const sinCriatura: Item[] = [];
    for (const item of itemsFiltrados) {
      if (item.criatura_id && criaturaById.has(item.criatura_id)) {
        if (!mapa.has(item.criatura_id)) mapa.set(item.criatura_id, []);
        mapa.get(item.criatura_id)!.push(item);
      } else {
        sinCriatura.push(item);
      }
    }
    const bloques = [...mapa.entries()]
      .map(([criaturaId, itemsCriatura]) => ({
        criatura: criaturaById.get(criaturaId)!,
        items: itemsCriatura,
      }))
      .sort((a, b) => a.criatura.nombre.localeCompare(b.criatura.nombre, "es"));
    return { bloques, sinCriatura };
  }, [criaturas, itemsFiltrados]);

  const porCriatura = porEcosistema; // un solo toggle reagrupa Items + Flora/Minerales a la vez

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {agrupacionSelector}
          {(ecosistemas || criaturas) && (
            <button
              type="button"
              onClick={() => setPorEcosistema((v) => !v)}
              title={
                porEcosistema
                  ? "Ver Items por categoría, Flora/Minerales sin agrupar"
                  : "Ver Items por Criatura, Flora/Minerales por Ecosistema"
              }
              aria-pressed={porEcosistema}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-colors ${
                porEcosistema
                  ? "bg-accent/10 border-accent/20 text-accent/80"
                  : "bg-primary/[0.04] border-primary/10 text-primary/40 hover:bg-primary/10"
              }`}
            >
              {porEcosistema ? <Sprout size={12} /> : <Mountain size={12} />}
            </button>
          )}
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


      {porCriatura && porCriaturaData ? (
        <div className="[column-fill:_balance]" style={{ columnWidth: 300, columnGap: 24 }}>
          {(loadingCriaturas || loading) &&
          porCriaturaData.bloques.length === 0 &&
          porCriaturaData.sinCriatura.length === 0 ? (
            <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
          ) : (
            <>
              {porCriaturaData.bloques.map(({ criatura, items: itemsCriatura }) => (
                <div key={criatura.id} className="break-inside-avoid">
                  <BloqueCategoria
                    titulo={criatura.nombre}
                    categoria={criatura.id}
                    items={itemsCriatura}
                    loading={loading}
                    onItemClick={(id) => abrirPanel("item", id)}
                  />
                </div>
              ))}
              <div className="break-inside-avoid">
                <BloqueCategoria
                  titulo="Sin criatura"
                  categoria={null}
                  items={porCriaturaData.sinCriatura}
                  loading={loading}
                  onItemClick={(id) => abrirPanel("item", id)}
                  onCreate={onCreate}
                  creating={creating}
                />
              </div>
            </>
          )}
        </div>
      ) : hayCategorias ? (
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

      {/* Flora y Minerales — por defecto bloques planos (sin agrupar,
          mismo catálogo que ya se ve en la vista "por Criatura"); con el
          toggle "ojo" activo se agrupan por Ecosistema en su lugar. */}
      {porEcosistema && porEcosistemaData ? (
        <div className="mt-2">
          {(loadingEcosistemas || loadingFlora || loadingMinerales) &&
          porEcosistemaData.bloques.length === 0 ? (
            <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
          ) : porEcosistemaData.bloques.length === 0 &&
            porEcosistemaData.floraSinEco.length === 0 &&
            porEcosistemaData.mineralesSinEco.length === 0 ? (
            <div className="py-6 text-xs text-primary/25 text-center">
              Sin flora ni minerales todavía
            </div>
          ) : (
            <div className="[column-fill:_balance]" style={{ columnWidth: 300, columnGap: 24 }}>
              {porEcosistemaData.bloques.map(({ ecosistema, flora: floraEco, minerales: mineralesEco }) => (
                <BloqueEcosistemaFloraMinerales
                  key={ecosistema.id}
                  ecosistema={ecosistema}
                  flora={floraEco}
                  minerales={mineralesEco}
                  onOpenEcosistema={(id) => onOpenEcosistema?.(id)}
                  onOpenFlora={(id) => abrirPanel("flora", id)}
                  onOpenMineral={(id) => abrirPanel("mineral", id)}
                />
              ))}
              {(porEcosistemaData.floraSinEco.length > 0 ||
                porEcosistemaData.mineralesSinEco.length > 0) && (
                <BloqueEcosistemaFloraMinerales
                  ecosistema={{ id: "__sin_ecosistema__", nombre: "Sin ecosistema" }}
                  flora={porEcosistemaData.floraSinEco}
                  minerales={porEcosistemaData.mineralesSinEco}
                  onOpenEcosistema={() => {}}
                  onOpenFlora={(id) => abrirPanel("flora", id)}
                  onOpenMineral={(id) => abrirPanel("mineral", id)}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {flora && flora.length > 0 && (
            <div className="mb-6 w-full rounded-lg border border-primary/10 overflow-hidden">
              <div className="px-3 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="text-micro text-primary/25 tabular-nums">{flora.length}</span>
                <h2 className="min-w-0 truncate text-micro font-black uppercase tracking-[0.2em] text-primary/70 text-center justify-self-center max-w-full">
                  Flora
                </h2>
                <span />
              </div>
              <div className="px-3 pb-3">
                <EntityCardGrid
                  title="Flora"
                  variant="grid"
                  loading={loadingFlora}
                  minCardWidth={52}
                  hideHeader
                  items={flora.map((f) => ({
                    id: f.id,
                    nombre: f.nombre,
                    imageUrl: f.imagen_url || undefined,
                  }))}
                  onItemClick={(id) => abrirPanel("flora", id)}
                  section="flora"
                />
              </div>
            </div>
          )}
          {minerales && minerales.length > 0 && (
            <div className="mb-6 w-full rounded-lg border border-primary/10 overflow-hidden">
              <div className="px-3 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="text-micro text-primary/25 tabular-nums">{minerales.length}</span>
                <h2 className="min-w-0 truncate text-micro font-black uppercase tracking-[0.2em] text-primary/70 text-center justify-self-center max-w-full">
                  Minerales
                </h2>
                <span />
              </div>
              <div className="px-3 pb-3">
                <EntityCardGrid
                  title="Minerales"
                  variant="grid"
                  loading={loadingMinerales}
                  minCardWidth={52}
                  hideHeader
                  items={minerales.map((m) => ({
                    id: m.id,
                    nombre: m.nombre,
                    imageUrl: m.imagen_url || undefined,
                  }))}
                  onItemClick={(id) => abrirPanel("mineral", id)}
                  section="minerales"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

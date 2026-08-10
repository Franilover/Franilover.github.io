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
 * agrupa Items por su propio campo `categoria` (sin FK a Reino/Criatura),
 * en bloques planos — no hay drag & drop ni popovers anidados, solo un
 * EntityCardGrid por categoría:
 *
 *   [Categoría 1]
 *   [Item 1] [Item 2] [Item 3]
 *
 *   [Categoría 2]
 *   ...
 *
 * Los items sin categoría (vacía/null) caen en un bloque final "Sin
 * categoría". Debajo de las categorías de Items se muestran, aparte y sin
 * agrupar (no tienen campo `categoria`), Flora y Minerales — mismo
 * catálogo que ya aparece en la vista "por Criatura" (colgando de
 * Ecosistema ahí), acá solo como bloques planos informativos. Cada
 * tarjeta abre el editor completo de su entidad (openEntity(section, id)),
 * igual que el resto de las vistas jerárquicas.
 */

import { Package } from "lucide-react";
import React, { useMemo, useState } from "react";

import { BuscadorInline } from "@/domains/garlia/_shared/BuscadorInline";
import { EntityCardGrid } from "@/domains/garlia/_shared/EntityCardGrid";
import { GrupoFiltroBarra, type GrupoFiltroSubtipo } from "@/domains/garlia/_shared/GrupoFiltroDropdown";

interface Item {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  categoria?: string | null;
}
interface EntidadMin {
  id: string;
  nombre: string;
  imagen_url?: string | null;
}

const SIN_CATEGORIA = "__sin_categoria__";

interface Props {
  items: Item[];
  loading?: boolean;
  onOpen: (id: string) => void;
  onCreate?: () => void;
  creating?: boolean;
  /** Flora — se muestra como bloque aparte debajo de las categorías de
   *  Items, sin agrupar (no tiene campo `categoria`). Puramente informativo:
   *  reusa el mismo catálogo que ya se muestra en la vista "por Criatura". */
  flora?: EntidadMin[];
  loadingFlora?: boolean;
  onOpenFlora?: (id: string) => void;
  /** Minerales — mismo criterio que `flora`. */
  minerales?: EntidadMin[];
  loadingMinerales?: boolean;
  onOpenMineral?: (id: string) => void;
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
  onOpen,
  onCreate,
  creating,
  flora,
  loadingFlora,
  onOpenFlora,
  minerales,
  loadingMinerales,
  onOpenMineral,
  gruposItemsPorSubtipo,
  grupoSeleccionadoId,
  onSeleccionarGrupo,
  onOpenGrupo,
  busqueda,
  onBusquedaChange,
  agrupacionSelector,
}: Props) {
  const [categoriasColapsadas, setCategoriasColapsadas] = useState<Set<string>>(new Set());

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

  // Agrupa por categoría, preservando el orden de primera aparición; los
  // sin categoría van todos al bucket SIN_CATEGORIA y se muestran al final.
  const bloques = useMemo(() => {
    const porCategoria = new Map<string, Item[]>();
    for (const item of itemsFiltrados) {
      const key = item.categoria?.trim() || SIN_CATEGORIA;
      const lista = porCategoria.get(key);
      if (lista) lista.push(item);
      else porCategoria.set(key, [item]);
    }
    const entries = Array.from(porCategoria.entries());
    entries.sort(([a], [b]) => {
      if (a === SIN_CATEGORIA) return 1;
      if (b === SIN_CATEGORIA) return -1;
      return a.localeCompare(b, "es");
    });
    return entries;
  }, [itemsFiltrados]);

  const toggleColapsada = (key: string) =>
    setCategoriasColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <BuscadorInline
          value={busqueda}
          onChange={onBusquedaChange}
          placeholder="Buscar item por nombre…"
        />
        {agrupacionSelector}
        {gruposItemsPorSubtipo && (
          <GrupoFiltroBarra
            bloques={gruposItemsPorSubtipo}
            grupoSeleccionadoId={grupoSeleccionadoId ?? null}
            onSeleccionarGrupo={onSeleccionarGrupo ?? (() => {})}
            onOpenGrupo={onOpenGrupo}
          />
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
      ) : bloques.length === 0 ? (
        <div className="py-6 text-xs text-primary/25 text-center">Sin items todavía</div>
      ) : (
        bloques.map(([categoria, itemsDeCategoria]) => {
          const colapsada = categoriasColapsadas.has(categoria);
          const label = categoria === SIN_CATEGORIA ? "Sin categoría" : categoria;
          return (
            <div key={categoria} className="mb-8 last:mb-0">
              <button
                type="button"
                onClick={() => toggleColapsada(categoria)}
                className="flex items-center gap-1.5 mb-3 px-1 text-micro font-black uppercase tracking-[0.25em] text-primary/50 hover:text-accent transition-colors"
              >
                <Package size={11} className="shrink-0 text-accent/50" />
                {label}
                <span className="text-primary/25 tabular-nums font-normal tracking-normal normal-case">
                  {itemsDeCategoria.length}
                </span>
              </button>
              {!colapsada && (
                <EntityCardGrid
                  title={label}
                  variant="grid"
                  hideHeader
                  items={itemsDeCategoria.map((i) => ({
                    id: i.id,
                    nombre: i.nombre,
                    imageUrl: i.imagen_url || undefined,
                  }))}
                  onItemClick={onOpen}
                  section="items"
                />
              )}
            </div>
          );
        })
      )}

      {/* Flora y Minerales — bloques aparte, sin agrupar (no tienen
          `categoria`), debajo de las categorías de Items. Mismo catálogo
          que ya se ve en la vista "por Criatura", puramente informativo
          acá: solo mostrarlos y poder abrir su editor. */}
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
          onItemClick={(id) => onOpenFlora?.(id)}
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
          onItemClick={(id) => onOpenMineral?.(id)}
          section="minerales"
        />
      )}

      {onCreate && (
        <div className="flex justify-center mt-2">
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-micro font-bold uppercase tracking-wide text-primary disabled:opacity-50"
          >
            <Package size={11} />
            Añadir item
          </button>
        </div>
      )}
    </div>
  );
}

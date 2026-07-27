"use client";

/**
 * MagiaJerarquica
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de "Entidades" agrupada por criatura de origen, análoga a
 * GeografiaJerarquica pero de un solo nivel:
 *
 *   [Criatura 1]
 *   Dones      Runas      Items      Hechizos      Personajes
 *   [D1][D2]   [R1]       [I1][I2]   [H1]           [P1][P2]
 *
 *   [Criatura 2]
 *   ...
 *
 * Cada nodo "Criatura" es un chip temático que abre su editor completo
 * (openEntity("criaturas", id)). Las 5 categorías se muestran como columnas
 * internas; cada tarjeta abre el editor de esa entidad puntual.
 *
 * Relaciones usadas:
 *  - Don/Runa/Item/Hechizo.criatura_id → agrupa bajo su criatura de origen.
 *  - Personaje.especie (nombre de la criatura, no FK) → agrupa personajes
 *    bajo la criatura cuyo nombre coincide con su especie.
 * Las entidades sin vínculo caen en el bloque final global "Sin criatura".
 */

import { Plus, ScrollText, Sparkles, Star, Package, Bug, Users } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

import { EntityCard } from "./EntityCard";
import type { SectionKey } from "../../hooks/mundo/useMundoNavigationStore";

interface Criatura {
  id: string;
  nombre: string;
  imagen_url?: string | null;
}
interface EntidadHija {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  criatura_id?: string | null;
}
interface Personaje {
  id: string;
  nombre: string;
  img_url?: string | null;
  especie?: string | null;
}

interface Props {
  criaturas: Criatura[];
  dones: EntidadHija[];
  runas: EntidadHija[];
  items: EntidadHija[];
  hechizos: EntidadHija[];
  personajes: Personaje[];
  loading?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreateCriatura?: () => void;
  onCreateHija?: (
    tipo: "dones" | "runas" | "items" | "hechizos",
    criaturaId: string | null,
  ) => void;
  onCreatePersonaje?: (criatura: Criatura | null) => void;
  creatingCriatura?: boolean;
}

const CATEGORIAS = [
  { key: "dones" as const, label: "Dones", Icon: Star, section: "dones" as SectionKey },
  { key: "runas" as const, label: "Runas", Icon: ScrollText, section: "runas" as SectionKey },
  { key: "items" as const, label: "Items", Icon: Package, section: "items" as SectionKey },
  { key: "hechizos" as const, label: "Hechizos", Icon: Sparkles, section: "hechizos" as SectionKey },
];

function NodoCriatura({
  label,
  onClick,
  onCreate,
  fill,
}: {
  label: string;
  onClick: () => void;
  onCreate?: () => void;
  /** Si es true, el chip ocupa el 100% del ancho de su contenedor (uso en grid dinámico) */
  fill?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1 max-w-full ${fill ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={`px-2.5 py-0.5 rounded-full text-micro font-bold tracking-wide transition-colors truncate bg-primary/10 hover:bg-primary/20 text-primary/70 border border-primary/15 ${
          fill ? "flex-1 min-w-0 text-center" : ""
        }`}
      >
        {label}
      </button>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          title="Añadir"
          className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
        >
          <Plus size={9} className="text-primary/60" />
        </button>
      )}
    </div>
  );
}

function Columna({
  label,
  Icon,
  section,
  entidades,
  onOpen,
  onCreate,
  maxWidthPx,
}: {
  label: string;
  Icon: React.ElementType;
  section: SectionKey;
  entidades: EntidadHija[];
  onOpen: (section: SectionKey, id: string) => void;
  onCreate?: () => void;
  /** Ancho máximo disponible (px) para esta categoría; limita cuántas
   * columnas internas puede tener el grid para no desbordar la card. */
  maxWidthPx?: number;
}) {
  const vacia = entidades.length === 0;
  const itemSize = 52;
  const gapPx = 4;
  const maxColsPorAncho = maxWidthPx
    ? Math.max(1, Math.floor((maxWidthPx + gapPx) / (itemSize + gapPx)))
    : 6;
  const cols = Math.min(Math.max(entidades.length, 1), 6, maxColsPorAncho);
  const anchoPx = Math.max(cols * itemSize + (cols - 1) * gapPx, 90);

  return (
    <div className={vacia ? "w-fit shrink-0" : "shrink-0"} style={vacia ? undefined : { width: anchoPx }}>
      <div className="flex items-center gap-1">
        <Icon size={9} className="text-accent/50 shrink-0" />
        <span
          className="text-micro font-bold uppercase tracking-[0.1em] text-primary/60 truncate"
          style={{ maxWidth: vacia ? 140 : anchoPx }}
          title={label}
        >
          {label}
        </span>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            title={`Añadir ${label.toLowerCase()}`}
            className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
          >
            <Plus size={9} className="text-primary/60" />
          </button>
        )}
      </div>
      {vacia ? (
        <div className="mt-1.5 text-micro text-primary/25">Sin {label.toLowerCase()}</div>
      ) : (
        <div
          className="mt-2 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${cols}, ${itemSize}px)` }}
        >
          {entidades.map((e) => (
            <EntityCard
              key={e.id}
              nombre={e.nombre}
              imageUrl={e.imagen_url}
              Icon={Icon}
              onClick={() => onOpen(section, e.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MagiaJerarquica({
  criaturas,
  dones,
  runas,
  items,
  hechizos,
  personajes,
  loading,
  onOpen,
  onCreateCriatura,
  onCreateHija,
  onCreatePersonaje,
  creatingCriatura,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (loading && criaturas.length === 0) {
    return <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>;
  }

  const donesDe = (criaturaId: string) => dones.filter((d) => d.criatura_id === criaturaId);
  const runasDe = (criaturaId: string) => runas.filter((r) => r.criatura_id === criaturaId);
  const itemsDe = (criaturaId: string) => items.filter((i) => i.criatura_id === criaturaId);
  const hechizosDe = (criaturaId: string) => hechizos.filter((h) => h.criatura_id === criaturaId);
  // Personajes se agrupan por `especie` (nombre de la criatura, no FK) —
  // se normalizan a la forma EntidadHija (img_url → imagen_url) para
  // reutilizar el mismo componente Columna que el resto de categorías.
  const personajesDe = (criaturaNombre: string): EntidadHija[] =>
    personajes
      .filter((p) => p.especie === criaturaNombre)
      .map((p) => ({ id: p.id, nombre: p.nombre, imagen_url: p.img_url }));

  const totalDe = (criatura: Criatura) =>
    donesDe(criatura.id).length +
    runasDe(criatura.id).length +
    itemsDe(criatura.id).length +
    hechizosDe(criatura.id).length +
    personajesDe(criatura.nombre).length;

  const criaturasOrdenadas = [...criaturas].sort((a, b) => totalDe(b) - totalDe(a));
  const criaturasConVinculosBase = criaturasOrdenadas.filter((c) => totalDe(c) > 0);
  const criaturasVacias = criaturasOrdenadas.filter((c) => totalDe(c) === 0);

  // ── Layout masonry (columnas de igual ancho) ──────────────────────────────
  // Una criatura como "Humano" puede tener docenas de personajes y ser mucho
  // más alta que el resto; un simple flex-wrap por filas la trata como si
  // ocupara toda la fila y desperdicia el espacio horizontal sobrante a su
  // derecha. En vez de eso, repartimos las criaturas en N columnas de ancho
  // fijo y cada una se asigna a la columna con menor altura acumulada
  // (masonry greedy estándar, tipo Pinterest), estimando la altura de cada
  // card sin necesidad de medir el DOM.
  const GAP = 24;
  const ANCHO_MIN_COLUMNA = 300;
  const anchoDisponible = containerWidth || 1100;
  const numColumnas = Math.max(
    1,
    Math.floor((anchoDisponible + GAP) / (ANCHO_MIN_COLUMNA + GAP)),
  );
  const anchoColumnaMasonry = (anchoDisponible - GAP * (numColumnas - 1)) / numColumnas;

  const itemSize = 52;
  const gapPx = 4;
  const disponibleColumna = anchoColumnaMasonry - 32; // p-4 a ambos lados
  const maxColsPorAncho = Math.max(1, Math.floor((disponibleColumna + gapPx) / (itemSize + gapPx)));
  const anchoColumnaCategoria = (entidadesCount: number) => {
    if (entidadesCount === 0) return 0; // columna vacía no se renderiza
    const cols = Math.min(Math.max(entidadesCount, 1), 6, maxColsPorAncho);
    return Math.max(cols * itemSize + (cols - 1) * gapPx, 90);
  };
  // Altura de una columna-categoría (título + grid de EntityCard, que hace
  // wrap interno cada `cols` items). El tope de columnas coincide con el
  // que usa <Columna> al renderizar, para que la estimación no se quede
  // corta y termine desbordando (y recortándose) el ancho real de la card.
  const altoColumnaCategoria = (entidadesCount: number) => {
    if (entidadesCount === 0) return 0;
    const cols = Math.min(Math.max(entidadesCount, 1), 6, maxColsPorAncho);
    const filas = Math.ceil(entidadesCount / cols);
    const alturaTitulo = 18;
    const margenSuperior = 8; // mt-2
    return alturaTitulo + margenSuperior + filas * itemSize + (filas - 1) * gapPx;
  };
  const categoriasDe = (criatura: Criatura) =>
    [
      donesDe(criatura.id).length,
      runasDe(criatura.id).length,
      itemsDe(criatura.id).length,
      hechizosDe(criatura.id).length,
      personajesDe(criatura.nombre).length,
    ].filter((count) => count > 0);

  // Simula el `flex-wrap gap-6` real del contenido de la card (grid de cada
  // categoría) dentro del ancho fijo de columna, para saber cuántas filas
  // internas necesita y así estimar la altura total de la card.
  const altoCriatura = (criatura: Criatura) => {
    const counts = categoriasDe(criatura);
    const disponible = anchoColumnaMasonry - 32; // p-4 a ambos lados
    const gapInterno = 24;
    const filas: number[][] = [];
    let filaActual: number[] = [];
    let anchoFilaActual = 0;
    for (const count of counts) {
      const w = anchoColumnaCategoria(count);
      const necesario = filaActual.length === 0 ? w : anchoFilaActual + gapInterno + w;
      if (filaActual.length === 0 || necesario <= disponible) {
        filaActual.push(count);
        anchoFilaActual = necesario;
      } else {
        filas.push(filaActual);
        filaActual = [count];
        anchoFilaActual = w;
      }
    }
    if (filaActual.length > 0) filas.push(filaActual);

    const alturaBarraTitulo = 38; // px-4 py-2 + borde
    const paddingContenido = 32; // p-4 arriba + abajo
    const alturaFilas = filas.reduce(
      (sum, fila) => sum + Math.max(...fila.map(altoColumnaCategoria)),
      0,
    );
    const gapEntreFilas = gapInterno * Math.max(filas.length - 1, 0);
    return alturaBarraTitulo + paddingContenido + alturaFilas + gapEntreFilas;
  };

  // Reparte las criaturas (ya vienen ordenadas de mayor a menor contenido) en
  // `numColumnas` columnas, asignando cada una a la columna con menor altura
  // acumulada hasta el momento.
  function distribuirEnColumnas(list: Criatura[]): Criatura[][] {
    const columnas: Criatura[][] = Array.from({ length: numColumnas }, () => []);
    const alturas = new Array(numColumnas).fill(0);
    for (const criatura of list) {
      let idxMin = 0;
      for (let i = 1; i < numColumnas; i++) {
        if (alturas[i] < alturas[idxMin]) idxMin = i;
      }
      columnas[idxMin].push(criatura);
      alturas[idxMin] += altoCriatura(criatura) + GAP;
    }
    return columnas;
  }
  const columnasCriaturas = distribuirEnColumnas(criaturasConVinculosBase);

  const sinCriaturaIds = new Set(criaturas.map((c) => c.id));
  const criaturasNombres = new Set(criaturas.map((c) => c.nombre));
  const donesSinCriatura = dones.filter(
    (d) => !d.criatura_id || !sinCriaturaIds.has(d.criatura_id),
  );
  const runasSinCriatura = runas.filter(
    (r) => !r.criatura_id || !sinCriaturaIds.has(r.criatura_id),
  );
  const itemsSinCriatura = items.filter(
    (i) => !i.criatura_id || !sinCriaturaIds.has(i.criatura_id),
  );
  const hechizosSinCriatura = hechizos.filter(
    (h) => !h.criatura_id || !sinCriaturaIds.has(h.criatura_id),
  );
  const personajesSinCriatura: EntidadHija[] = personajes
    .filter((p) => !p.especie || !criaturasNombres.has(p.especie))
    .map((p) => ({ id: p.id, nombre: p.nombre, imagen_url: p.img_url }));
  const totalSinCriatura =
    donesSinCriatura.length +
    runasSinCriatura.length +
    itemsSinCriatura.length +
    hechizosSinCriatura.length +
    personajesSinCriatura.length;

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="flex-1" />
        {onCreateCriatura && (
          <button
            type="button"
            onClick={onCreateCriatura}
            disabled={creatingCriatura}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-micro font-bold uppercase tracking-wide text-primary disabled:opacity-50"
          >
            <Plus size={11} />
            Añadir criatura
          </button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        <div ref={containerRef} className="flex items-start gap-6">
          {columnasCriaturas.map((columna, colIdx) => (
            <div
              key={colIdx}
              className="flex flex-col gap-6 min-w-0"
              style={{ width: anchoColumnaMasonry }}
            >
              {columna.map((criatura) => (
                <div
                  key={criatura.id}
                  className="w-full rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden"
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
                    <span />
                    <button
                      type="button"
                      onClick={() => onOpen("criaturas", criatura.id)}
                      title={criatura.nombre}
                      className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 hover:text-accent transition-colors flex items-center gap-1"
                    >
                      <Bug size={9} className="shrink-0" />
                      {criatura.nombre}
                    </button>
                    <span />
                  </div>
                  <div className="p-4 flex flex-wrap gap-6">
                    {CATEGORIAS.map(({ key, label, Icon, section }) => {
                      const entidadesDe =
                        key === "dones"
                          ? donesDe(criatura.id)
                          : key === "runas"
                            ? runasDe(criatura.id)
                            : key === "items"
                              ? itemsDe(criatura.id)
                              : hechizosDe(criatura.id);
                      // Solo mostramos columnas con contenido para no saturar el
                      // card (una criatura sin dones, por ejemplo, no necesita
                      // mostrar "Sin dones" si tampoco tiene runas/items/hechizos
                      // vacíos a la vista).
                      if (entidadesDe.length === 0) return null;
                      return (
                        <Columna
                          key={key}
                          Icon={Icon}
                          entidades={entidadesDe}
                          label={label}
                          section={section}
                          onCreate={
                            onCreateHija ? () => onCreateHija(key, criatura.id) : undefined
                          }
                          onOpen={onOpen}
                          maxWidthPx={disponibleColumna}
                        />
                      );
                    })}
                    {personajesDe(criatura.nombre).length > 0 && (
                      <Columna
                        Icon={Users}
                        entidades={personajesDe(criatura.nombre)}
                        label="Personajes"
                        section="personajes"
                        onCreate={
                          onCreatePersonaje ? () => onCreatePersonaje(criatura) : undefined
                        }
                        onOpen={onOpen}
                        maxWidthPx={disponibleColumna}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {totalSinCriatura > 0 && (
          <div>
            <div className="h-px mb-3 bg-primary/10" />
            <div className="w-full rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
              <span />
              <span className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 flex items-center gap-1">
                <Bug size={9} className="shrink-0" />
                Sin criatura
              </span>
              <span />
            </div>
            <div className="p-4 flex flex-wrap gap-6">
              {[
                { key: "dones" as const, label: "Dones", Icon: Star, section: "dones" as SectionKey, entidades: donesSinCriatura },
                { key: "runas" as const, label: "Runas", Icon: ScrollText, section: "runas" as SectionKey, entidades: runasSinCriatura },
                { key: "items" as const, label: "Items", Icon: Package, section: "items" as SectionKey, entidades: itemsSinCriatura },
                { key: "hechizos" as const, label: "Hechizos", Icon: Sparkles, section: "hechizos" as SectionKey, entidades: hechizosSinCriatura },
              ]
                .filter((c) => c.entidades.length > 0)
                .map((c) => (
                  <Columna
                    key={c.key}
                    Icon={c.Icon}
                    entidades={c.entidades}
                    label={c.label}
                    section={c.section}
                    onCreate={onCreateHija ? () => onCreateHija(c.key, null) : undefined}
                    onOpen={onOpen}
                  />
                ))}
              {personajesSinCriatura.length > 0 && (
                <Columna
                  Icon={Users}
                  entidades={personajesSinCriatura}
                  label="Personajes"
                  section="personajes"
                  onCreate={onCreatePersonaje ? () => onCreatePersonaje(null) : undefined}
                  onOpen={onOpen}
                />
              )}
            </div>
            </div>
          </div>
        )}
        {criaturasVacias.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="h-px flex-1 bg-primary/10" />
              <span className="text-micro font-black uppercase tracking-[0.25em] text-primary/40 shrink-0">
                Sin dones, runas, items ni hechizos
              </span>
              <div className="h-px flex-1 bg-primary/10" />
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              }}
            >
              {criaturasVacias.map((criatura) => (
                <NodoCriatura
                  key={criatura.id}
                  fill
                  label={criatura.nombre}
                  onClick={() => onOpen("criaturas", criatura.id)}
                  onCreate={
                    onCreateHija ? () => onCreateHija("dones", criatura.id) : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {criaturasConVinculosBase.length === 0 &&
          criaturasVacias.length === 0 &&
          totalSinCriatura === 0 && (
            <div className="py-6 text-xs text-primary/25 text-center">
              Sin criaturas todavía
            </div>
          )}
      </div>
    </div>
  );
}

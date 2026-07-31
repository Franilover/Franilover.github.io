"use client";

/**
 * MagiaJerarquica
 * ───────────────────────────────────────────────────────────────────────────
 * Vista del sub-tab "Criaturas" de Entidades, agrupada por criatura de
 * origen, análoga a GeografiaJerarquica pero de un solo nivel:
 *
 *   [Criatura 1]
 *   Items         Personajes
 *   [I1][I2]      [P1][P2]
 *
 *   [Criatura 2]
 *   ...
 *
 * Cada nodo "Criatura" es un chip temático que abre su editor completo
 * (openEntity("criaturas", id)).
 *
 * Relaciones usadas:
 *  - Item.criatura_id → agrupa bajo su criatura de origen.
 *  - Personaje.especie (nombre de la criatura, no FK) → agrupa personajes
 *    bajo la criatura cuyo nombre coincide con su especie.
 * Las entidades sin vínculo caen en el bloque final global "Sin criatura".
 *
 * Nota: Hechizos/Dones/Runas ya no se agrupan por criatura — viven en su
 * propia sección de navbar (ver MagiaPorTipo) sin relación a criaturas.
 */

import { Plus, Package, Bug, Users } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";

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
  items: EntidadHija[];
  personajes: Personaje[];
  loading?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreateCriatura?: () => void;
  onCreateHija?: (tipo: "items", criaturaId: string | null) => void;
  onCreatePersonaje?: (criatura: Criatura | null) => void;
  creatingCriatura?: boolean;
}

function NodoCriatura({
  label,
  onClick,
  onCreate,
  fill,
}: {
  label: string;
  onClick: () => void;
  onCreate?: () => void;
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
  items,
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

  const itemsDe = (criaturaId: string) => items.filter((i) => i.criatura_id === criaturaId);
  const personajesDe = (criaturaNombre: string): EntidadHija[] =>
    personajes
      .filter((p) => p.especie === criaturaNombre)
      .map((p) => ({ id: p.id, nombre: p.nombre, imagen_url: p.img_url }));

  const totalDe = (criatura: Criatura) =>
    itemsDe(criatura.id).length + personajesDe(criatura.nombre).length;

  const criaturasOrdenadas = [...criaturas].sort((a, b) => totalDe(b) - totalDe(a));
  const criaturasConVinculosBase = criaturasOrdenadas.filter((c) => totalDe(c) > 0);
  const criaturasVacias = criaturasOrdenadas.filter((c) => totalDe(c) === 0);

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
  const disponibleColumna = anchoColumnaMasonry - 24; // px-3 a ambos lados = 24px total
  const maxColsPorAncho = Math.max(1, Math.floor((disponibleColumna + gapPx) / (itemSize + gapPx)));
  const anchoColumnaCategoria = (entidadesCount: number) => {
    if (entidadesCount === 0) return 0;
    const cols = Math.min(Math.max(entidadesCount, 1), 6, maxColsPorAncho);
    return Math.max(cols * itemSize + (cols - 1) * gapPx, 90);
  };
  const altoColumnaCategoria = (entidadesCount: number) => {
    if (entidadesCount === 0) return 0;
    const cols = Math.min(Math.max(entidadesCount, 1), 6, maxColsPorAncho);
    const filas = Math.ceil(entidadesCount / cols);
    const alturaTitulo = 18;
    const margenSuperior = 8;
    return alturaTitulo + margenSuperior + filas * itemSize + (filas - 1) * gapPx;
  };
  const categoriasDe = (criatura: Criatura) =>
    [itemsDe(criatura.id).length, personajesDe(criatura.nombre).length].filter(
      (count) => count > 0,
    );

  const altoCriatura = (criatura: Criatura) => {
    const counts = categoriasDe(criatura);
    const disponible = anchoColumnaMasonry - 24; // px-3 a ambos lados = 24px total
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

    const alturaBarraTitulo = 24; // py-3 compacto = ~24px
    const paddingContenido = 24; // px-3 pb-3 = 24px total vertical
    const alturaFilas = filas.reduce(
      (sum, fila) => sum + Math.max(...fila.map(altoColumnaCategoria)),
      0,
    );
    const gapEntreFilas = gapInterno * Math.max(filas.length - 1, 0);
    return alturaBarraTitulo + paddingContenido + alturaFilas + gapEntreFilas;
  };

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
  const itemsSinCriatura = items.filter(
    (i) => !i.criatura_id || !sinCriaturaIds.has(i.criatura_id),
  );
  const personajesSinCriatura: EntidadHija[] = personajes
    .filter((p) => !p.especie || !criaturasNombres.has(p.especie))
    .map((p) => ({ id: p.id, nombre: p.nombre, imagen_url: p.img_url }));
  const totalSinCriatura = itemsSinCriatura.length + personajesSinCriatura.length;

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
                  className="w-full rounded-lg border border-primary/10 overflow-hidden"
                >
                  <div className="px-3 py-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen("criaturas", criatura.id)}
                      title={criatura.nombre}
                      className="flex-1 min-w-0 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 hover:text-accent transition-colors flex items-center gap-1"
                    >
                      <Bug size={9} className="shrink-0" />
                      {criatura.nombre}
                    </button>
                  </div>
                  <div className="px-3 pb-3 flex flex-wrap gap-6">
                    {itemsDe(criatura.id).length > 0 && (
                      <Columna
                        Icon={Package}
                        entidades={itemsDe(criatura.id)}
                        label="Items"
                        section="items"
                        onCreate={
                          onCreateHija ? () => onCreateHija("items", criatura.id) : undefined
                        }
                        onOpen={onOpen}
                        maxWidthPx={disponibleColumna}
                      />
                    )}
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
            <div className="w-full rounded-lg border border-primary/10 overflow-hidden">
            <div className="px-3 py-3 flex items-center gap-2">
              <span className="flex-1 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 flex items-center gap-1">
                <Bug size={9} className="shrink-0" />
                Sin criatura
              </span>
            </div>
            <div className="px-3 pb-3 flex flex-wrap gap-6">
              {itemsSinCriatura.length > 0 && (
                <Columna
                  Icon={Package}
                  entidades={itemsSinCriatura}
                  label="Items"
                  section="items"
                  onCreate={onCreateHija ? () => onCreateHija("items", null) : undefined}
                  onOpen={onOpen}
                />
              )}
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
                Sin items ni personajes
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
                    onCreateHija ? () => onCreateHija("items", criatura.id) : undefined
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

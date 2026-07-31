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

import { Plus, Users } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";

interface Criatura {
  id: string;
  nombre: string;
  imagen_url?: string | null;
}
interface Personaje {
  id: string;
  nombre: string;
  img_url?: string | null;
  especie?: string | null;
}

interface Props {
  criaturas: Criatura[];
  personajes: Personaje[];
  loading?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreateCriatura?: () => void;
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

export function MagiaJerarquica({
  criaturas,
  personajes,
  loading,
  onOpen,
  onCreateCriatura,
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

  const personajesDe = (criaturaNombre: string) =>
    personajes.filter((p) => p.especie === criaturaNombre);

  const totalDe = (criatura: Criatura) =>
    personajesDe(criatura.nombre).length;

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
  const altoCriatura = (personajeCount: number) => {
    const alturaTitulo = 24; // py-3 compacto
    const paddingContenido = 24; // px-3 pb-3
    
    if (personajeCount === 0) {
      return alturaTitulo + paddingContenido + 16; // "Sin personajes" text
    }
    
    const cols = Math.min(Math.max(personajeCount, 1), 6, maxColsPorAncho);
    const filas = Math.ceil(personajeCount / cols);
    const margenSuperior = 8;
    const alturaCuadricula = filas * itemSize + (filas - 1) * gapPx;
    return alturaTitulo + paddingContenido + margenSuperior + alturaCuadricula;
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
      alturas[idxMin] += altoCriatura(personajesDe(criatura.nombre).length) + GAP;
    }
    return columnas;
  }
  const columnasCriaturas = distribuirEnColumnas(criaturasConVinculosBase);

  const criaturasNombres = new Set(criaturas.map((c) => c.nombre));
  const personajesSinCriatura = personajes.filter(
    (p) => !p.especie || !criaturasNombres.has(p.especie)
  );
  const totalSinCriatura = personajesSinCriatura.length;

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
                      className="flex-1 min-w-0 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 hover:text-accent transition-colors"
                    >
                      {criatura.nombre}
                    </button>
                  </div>
                  <div className="px-3 pb-3">
                    {personajesDe(criatura.nombre).length === 0 ? (
                      <div className="text-micro text-primary/25">Sin personajes</div>
                    ) : (
                      <div
                        className="grid gap-1"
                        style={{
                          gridTemplateColumns: `repeat(auto-fill, minmax(52px, 1fr))`,
                        }}
                      >
                        {personajesDe(criatura.nombre).map((p) => (
                          <EntityCard
                            key={p.id}
                            nombre={p.nombre}
                            imageUrl={p.img_url}
                            Icon={Users}
                            onClick={() => onOpen("personajes", p.id)}
                          />
                        ))}
                      </div>
                    )}
                    {onCreatePersonaje && (
                      <button
                        type="button"
                        onClick={() => onCreatePersonaje(criatura)}
                        title="Añadir personaje"
                        className="mt-2 p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors text-primary/60"
                      >
                        <Plus size={9} />
                      </button>
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
              <span className="flex-1 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
                Sin criatura
              </span>
            </div>
            <div className="px-3 pb-3">
              {personajesSinCriatura.length === 0 ? (
                <div className="text-micro text-primary/25">Sin personajes</div>
              ) : (
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                  }}
                >
                  {personajesSinCriatura.map((p) => (
                    <EntityCard
                      key={p.id}
                      nombre={p.nombre}
                      imageUrl={p.img_url}
                      Icon={Users}
                      onClick={() => onOpen("personajes", p.id)}
                    />
                  ))}
                </div>
              )}
              {onCreatePersonaje && (
                <button
                  type="button"
                  onClick={() => onCreatePersonaje(null)}
                  title="Añadir personaje"
                  className="mt-2 p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors text-primary/60"
                >
                  <Plus size={9} />
                </button>
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
                Sin personajes asignados
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

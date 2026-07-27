"use client";

/**
 * GeografiaJerarquica
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de "Entidades" agrupada por jerarquía real del mundo:
 *
 *   [Reino 1]
 *   [Ciudad 1]                         [Ciudad 2]
 *   [Personaje 1] [Personaje 2]        [Personaje 1] [Personaje 2]
 *
 *   [Reino 2]
 *   ...
 *
 * Cada nodo (reino / ciudad) se muestra como un botón tipo "chip" temático
 * (sin corchetes) y al hacer click abre su editor completo
 * (openEntity("reinos", id) / openEntity("ciudades", id)), que ya trae
 * adentro sus propias ciudades / personajes. Los personajes sí usan la
 * tarjeta normal (imagen + nombre) porque son la hoja del árbol.
 *
 * Relaciones usadas:
 *  - Ciudad.reino_id   → agrupa ciudades bajo su reino (obligatorio: toda
 *    ciudad pertenece a un único reino)
 *  - Personaje.ciudad_id → agrupa personajes bajo su ciudad
 *  - Personaje.reino (nombre) → si un personaje no tiene ciudad pero sí
 *    reino, se muestra dentro de ese reino bajo un slot "Sin Ciudad"
 * Las ciudades (y el slot "Sin Ciudad") de un reino se muestran en fila y
 * hacen wrap horizontal cuando no caben; los títulos largos se truncan para
 * no sobreponerse a los nodos vecinos. Solo caen en el bloque final global
 * "Sin ciudad" los personajes sin ciudad_id y sin reino válido asociado.
 */

import { Plus, Users } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

import { EntityCard } from "./EntityCard";
import type { SectionKey } from "../../hooks/mundo/useMundoNavigationStore";

interface Reino {
  id: string;
  nombre: string;
}
interface Ciudad {
  id: string;
  nombre: string;
  reino_id?: string | null;
}
interface Personaje {
  id: string;
  nombre: string;
  img_url?: string | null;
  ciudad_id?: string | null;
  reino?: string | null;
}

interface Props {
  reinos: Reino[];
  ciudades: Ciudad[];
  personajes: Personaje[];
  loading?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreateReino?: () => void;
  onCreateCiudad?: (reinoId: string | null) => void;
  onCreatePersonaje?: (ciudadId: string | null) => void;
  creatingReino?: boolean;
}

function NodoTitulo({
  label,
  onClick,
  onCreate,
  creating,
  variant = "reino",
  maxWidthPx,
  fill,
}: {
  label: string;
  onClick: () => void;
  onCreate?: () => void;
  creating?: boolean;
  variant?: "reino" | "ciudad";
  maxWidthPx?: number;
  /** Si es true, el chip ocupa el 100% del ancho de su contenedor (uso en grid dinámico) */
  fill?: boolean;
}) {
  const chipStyles =
    variant === "reino"
      ? "bg-primary/10 hover:bg-primary/20 text-primary/70 border border-primary/15"
      : "bg-accent/10 hover:bg-accent/20 text-accent/80 border border-accent/15";

  return (
    <div className={`flex items-center gap-1 max-w-full ${fill ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={onClick}
        title={label}
        style={maxWidthPx ? { maxWidth: maxWidthPx } : undefined}
        className={`px-2.5 py-0.5 rounded-full text-micro font-bold tracking-wide transition-colors truncate ${chipStyles} ${
          fill ? "flex-1 min-w-0 text-center" : ""
        }`}
      >
        {label}
      </button>
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
  );
}

export function GeografiaJerarquica({
  reinos,
  ciudades,
  personajes,
  loading,
  onOpen,
  onCreateReino,
  onCreateCiudad,
  onCreatePersonaje,
  creatingReino,
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

  if (loading && reinos.length === 0) {
    return (
      <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
    );
  }

  const ciudadesDe = (reinoId: string) =>
    ciudades
      .filter((c) => c.reino_id === reinoId)
      .sort((a, b) => personajesDe(b.id).length - personajesDe(a.id).length);
  const personajesDe = (ciudadId: string) =>
    personajes.filter((p) => p.ciudad_id === ciudadId);

  // Personajes sin ciudad_id, pero con un reino asignado directamente
  // (por nombre) se agrupan dentro de ese reino, bajo un slot "Sin Ciudad".
  const personajesSinCiudadDeReino = (reinoNombre: string) =>
    personajes.filter((p) => !p.ciudad_id && p.reino === reinoNombre);

  // Solo quedan huérfanos globales los que no tienen ni ciudad ni un reino
  // válido asociado.
  const personajesSinCiudad = personajes.filter(
    (p) => !p.ciudad_id && !reinos.some((r) => r.nombre === p.reino)
  );

  const reinosOrdenados = [...reinos].sort(
    (a, b) =>
      ciudadesDe(b.id).length +
      personajesSinCiudadDeReino(b.nombre).length -
      (ciudadesDe(a.id).length + personajesSinCiudadDeReino(a.nombre).length)
  );
  const reinosConCiudadesBase = reinosOrdenados.filter(
    (r) => ciudadesDe(r.id).length > 0 || personajesSinCiudadDeReino(r.nombre).length > 0
  );
  const reinosVacios = reinosOrdenados.filter(
    (r) => ciudadesDe(r.id).length === 0 && personajesSinCiudadDeReino(r.nombre).length === 0
  );

  // ── Layout masonry (columnas de igual ancho) ──────────────────────────────
  // Un reino con muchísimas ciudades puede ser mucho más alto que el resto;
  // un simple flex-wrap por filas lo trata como si ocupara toda la fila y
  // desperdicia el espacio horizontal sobrante a su derecha. En vez de eso,
  // repartimos los reinos en N columnas de ancho fijo y cada uno se asigna a
  // la columna con menor altura acumulada (masonry greedy estándar, tipo
  // Pinterest), estimando la altura de cada card sin medir el DOM.
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
  const anchoCiudad = (habitantesCount: number) => {
    if (habitantesCount === 0) return 90; // chip "Sin personajes"
    const cols = Math.min(Math.max(habitantesCount, 1), 6, maxColsPorAncho);
    return Math.max(cols * itemSize + (cols - 1) * gapPx, 90);
  };
  // Altura de una columna-ciudad (chip título + grid de EntityCard, que hace
  // wrap interno cada `cols` items). El tope de columnas coincide con el que
  // usa renderColumna al pintar, para que la estimación no se quede corta y
  // termine desbordando (y recortándose) el ancho real de la card.
  const altoCiudad = (habitantesCount: number) => {
    const alturaTitulo = 24; // chip tipo pill (py-1)
    const margenSuperior = 8; // mt-1.5/mt-2
    if (habitantesCount === 0) return alturaTitulo + margenSuperior + 16; // "Sin personajes"
    const cols = Math.min(Math.max(habitantesCount, 1), 6, maxColsPorAncho);
    const filas = Math.ceil(habitantesCount / cols);
    return alturaTitulo + margenSuperior + filas * itemSize + (filas - 1) * gapPx;
  };
  // Conteos de habitantes por ciudad (+ slot "Sin Ciudad"), en el mismo
  // orden de mayor a menor que usa el render.
  const entradasReino = (reino: Reino) => {
    const conteos = [
      ...ciudadesDe(reino.id).map((c) => personajesDe(c.id).length),
      ...(personajesSinCiudadDeReino(reino.nombre).length > 0
        ? [personajesSinCiudadDeReino(reino.nombre).length]
        : []),
    ];
    return conteos.sort((a, b) => b - a);
  };

  // Simula el `flex-wrap gap-6` real del contenido de la card (grid de cada
  // ciudad) dentro del ancho fijo de columna, para saber cuántas filas
  // internas necesita y así estimar la altura total de la card.
  const altoReino = (reino: Reino) => {
    const conteos = entradasReino(reino);
    const disponible = anchoColumnaMasonry - 32; // p-4 a ambos lados
    const gapInterno = 24;
    const filas: number[][] = [];
    let filaActual: number[] = [];
    let anchoFilaActual = 0;
    for (const count of conteos) {
      const w = anchoCiudad(count);
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
      (sum, fila) => sum + Math.max(...fila.map(altoCiudad)),
      0,
    );
    const gapEntreFilas = gapInterno * Math.max(filas.length - 1, 0);
    return alturaBarraTitulo + paddingContenido + alturaFilas + gapEntreFilas;
  };

  // Reparte los reinos (ya vienen ordenados de mayor a menor contenido) en
  // `numColumnas` columnas, asignando cada uno a la columna con menor altura
  // acumulada hasta el momento.
  function distribuirEnColumnas(list: Reino[]): Reino[][] {
    const columnas: Reino[][] = Array.from({ length: numColumnas }, () => []);
    const alturas = new Array(numColumnas).fill(0);
    for (const reino of list) {
      let idxMin = 0;
      for (let i = 1; i < numColumnas; i++) {
        if (alturas[i] < alturas[idxMin]) idxMin = i;
      }
      columnas[idxMin].push(reino);
      alturas[idxMin] += altoReino(reino) + GAP;
    }
    return columnas;
  }
  const columnasReinos = distribuirEnColumnas(reinosConCiudadesBase);

  const renderColumna = ({
    key,
    nombre,
    habitantes,
    onClick,
    onCreate,
    anchoMaxDisponible,
  }: {
    key: string;
    nombre: string;
    habitantes: Personaje[];
    onClick: () => void;
    onCreate?: () => void;
    /** Ancho máximo disponible (px); limita cuántas columnas internas puede
     * tener el grid para no desbordar la card. */
    anchoMaxDisponible?: number;
  }) => {
    const vacia = habitantes.length === 0;
    const itemSize = 52;
    const gapPx = 4;
    const maxColsPorAncho = anchoMaxDisponible
      ? Math.max(1, Math.floor((anchoMaxDisponible + gapPx) / (itemSize + gapPx)))
      : 6;
    // Más personajes → más columnas → la columna ocupa más ancho horizontal,
    // tope según el espacio real disponible.
    const cols = Math.min(Math.max(habitantes.length, 1), 6, maxColsPorAncho);
    const anchoPx = Math.max(cols * itemSize + (cols - 1) * gapPx, 90);

    return (
      <div
        key={key}
        className={vacia ? "w-fit shrink-0" : "shrink-0"}
        style={vacia ? undefined : { width: anchoPx }}
      >
        <NodoTitulo
          label={nombre}
          variant="ciudad"
          maxWidthPx={vacia ? 140 : anchoPx}
          onClick={onClick}
          onCreate={onCreate}
        />
        {vacia ? (
          <div className="mt-1.5 text-micro text-primary/25">
            Sin personajes
          </div>
        ) : (
          <div
            className="mt-2 grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${itemSize}px)`,
            }}
          >
            {habitantes.map((p) => (
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
      </div>
    );
  };

  const renderCiudad = (ciudad: Ciudad) =>
    renderColumna({
      key: ciudad.id,
      nombre: ciudad.nombre,
      habitantes: personajesDe(ciudad.id),
      onClick: () => onOpen("ciudades", ciudad.id),
      onCreate: onCreatePersonaje
        ? () => onCreatePersonaje!(ciudad.id)
        : undefined,
      anchoMaxDisponible: disponibleColumna,
    });

  const renderSinCiudadDeReino = (reino: Reino) =>
    renderColumna({
      key: `sin-ciudad-${reino.id}`,
      nombre: "Sin Ciudad",
      habitantes: personajesSinCiudadDeReino(reino.nombre),
      onClick: () => {},
      onCreate: onCreatePersonaje
        ? () => onCreatePersonaje!(null)
        : undefined,
      anchoMaxDisponible: disponibleColumna,
    });

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="flex-1" />
        {onCreateReino && (
          <button
            type="button"
            onClick={onCreateReino}
            disabled={creatingReino}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-micro font-bold uppercase tracking-wide text-primary disabled:opacity-50"
          >
            <Plus size={11} />
            Añadir reino
          </button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        <div ref={containerRef} className="flex items-start gap-6">
          {columnasReinos.map((columna, colIdx) => (
            <div
              key={colIdx}
              className="flex flex-col gap-6 min-w-0"
              style={{ width: anchoColumnaMasonry }}
            >
              {columna.map((reino) => (
                <div
                  key={reino.id}
                  className="w-full rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden"
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
                    <span />
                    <button
                      type="button"
                      onClick={() => onOpen("reinos", reino.id)}
                      title={reino.nombre}
                      className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 hover:text-accent transition-colors"
                    >
                      {reino.nombre}
                    </button>
                    <div className="justify-self-end">
                      {onCreateCiudad && (
                        <button
                          type="button"
                          onClick={() => onCreateCiudad(reino.id)}
                          title="Añadir ciudad"
                          className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          <Plus size={9} className="text-primary/60" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 flex flex-wrap gap-6">
                    {[
                      ...ciudadesDe(reino.id).map((c) => ({
                        tipo: "ciudad" as const,
                        ciudad: c,
                        count: personajesDe(c.id).length,
                      })),
                      ...(personajesSinCiudadDeReino(reino.nombre).length > 0
                        ? [
                            {
                              tipo: "sinCiudad" as const,
                              ciudad: null,
                              count: personajesSinCiudadDeReino(reino.nombre)
                                .length,
                            },
                          ]
                        : []),
                    ]
                      .sort((a, b) => b.count - a.count)
                      .map((item) =>
                        item.tipo === "ciudad"
                          ? renderCiudad(item.ciudad)
                          : renderSinCiudadDeReino(reino)
                      )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {personajesSinCiudad.length > 0 && (
          <div>
            <div className="h-px mb-3 bg-primary/10" />
            <div className="w-full rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
              <span />
              <span className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
                Sin ciudad
              </span>
              <div className="justify-self-end">
                {onCreatePersonaje && (
                  <button
                    type="button"
                    onClick={() => onCreatePersonaje(null)}
                    title="Añadir personaje"
                    className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                  >
                    <Plus size={9} className="text-primary/60" />
                  </button>
                )}
              </div>
            </div>
            <div
              className="p-4 grid gap-1"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
              }}
            >
              {personajesSinCiudad.map((p) => (
                <EntityCard
                  key={p.id}
                  nombre={p.nombre}
                  imageUrl={p.img_url}
                  Icon={Users}
                  onClick={() => onOpen("personajes", p.id)}
                />
              ))}
            </div>
            </div>
          </div>
        )}
        {reinosVacios.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="h-px flex-1 bg-primary/10" />
              <span className="text-micro font-black uppercase tracking-[0.25em] text-primary/40 shrink-0">
                Sin ciudades asignadas
              </span>
              <div className="h-px flex-1 bg-primary/10" />
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              }}
            >
              {reinosVacios.map((reino) => (
                <NodoTitulo
                  key={reino.id}
                  fill
                  label={reino.nombre}
                  onClick={() => onOpen("reinos", reino.id)}
                  onCreate={
                    onCreateCiudad ? () => onCreateCiudad(reino.id) : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        {reinosConCiudadesBase.length === 0 &&
          reinosVacios.length === 0 &&
          personajesSinCiudad.length === 0 && (
            <div className="py-6 text-xs text-primary/25 text-center">
              Sin reinos todavía
            </div>
          )}
      </div>
    </div>
  );
}

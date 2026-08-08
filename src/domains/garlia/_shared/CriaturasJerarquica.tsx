"use client";

/**
 * CriaturasJerarquica
 * ───────────────────────────────────────────────────────────────────────────
 * Vista del sub-tab "Criaturas" de Entidades, agrupada por ecosistema y por
 * criatura de origen, análoga a GeografiaJerarquica pero con Ecosistema en
 * el rol de Reino y Criatura en el rol de Ciudad:
 *
 *   [Ecosistema 1]
 *   [Criatura A]                        [Criatura B]
 *   [Personaje 1] [Personaje 2]         [Personaje 1]
 *
 *   [Ecosistema 2]
 *   ...
 *
 * El chip "Ecosistema" abre su editor completo (openEntity("ecosistemas",
 * id)); cada card de "Criatura" conserva su título-botón propio que abre
 * su editor completo (openEntity("criaturas", id)) y por dentro sigue
 * mostrando la grilla de personajes tal cual antes.
 *
 * Relaciones usadas:
 *  - Ecosistema.criatura_ids → agrupa criaturas bajo cada ecosistema que
 *    las contiene. Una criatura sin ecosistema, o cuyo ecosistema no está
 *    en la lista, cae en el bloque "Sin ecosistema".
 *  - Personaje.especie (nombre de la criatura, no FK) → agrupa personajes
 *    bajo la criatura cuyo nombre coincide con su especie.
 * Las entidades sin vínculo caen en el bloque final global "Sin criatura".
 */

import { Leaf, Plus, Users } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import { GrupoFiltroBarra, type GrupoFiltroSubtipo } from "@/domains/garlia/_shared/GrupoFiltroDropdown";
import { BuscadorInline } from "@/domains/garlia/_shared/BuscadorInline";
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
interface Ecosistema {
  id: string;
  nombre: string;
  criatura_ids: string[];
}

interface Props {
  criaturas: Criatura[];
  personajes: Personaje[];
  /** Ecosistemas — agrupan criaturas por encima de ellas (Ecosistema →
   *  Criatura → Personajes), opcional para no romper usos previos. */
  ecosistemas?: Ecosistema[];
  loading?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreateCriatura?: () => void;
  onCreatePersonaje?: (criatura: Criatura | null) => void;
  creatingCriatura?: boolean;
  /** Crea un ecosistema nuevo — botón junto a "Añadir criatura", para
   *  manejar ecosistemas sin salir de esta vista (antes solo se podían
   *  crear desde Magia → Biología). */
  onCreateEcosistema?: () => void;
  creatingEcosistema?: boolean;
  /** Grupos de tipo "criaturas" agrupados por subtipo, para los dropdowns
   *  de la barra superior — filtran qué criaturas se muestran. */
  gruposCriaturasPorSubtipo?: GrupoFiltroSubtipo[];
  grupoSeleccionadoId?: string | null;
  onSeleccionarGrupo?: (grupoId: string | null) => void;
  /** Abre el editor completo de un grupo — botón a la derecha de cada
   *  opción en los dropdowns de filtro. */
  onOpenGrupo?: (grupoId: string) => void;
  /** Texto de búsqueda por nombre de criatura — controlado por el padre,
   *  se combina (AND) con el filtro de grupo activo. */
  busqueda?: string;
  onBusquedaChange?: (value: string) => void;
  /** Elemento opcional pegado a la izquierda del buscador — usado por
   *  EntidadesPage para el dropdown de agrupación (Reino/Criatura). */
  agrupacionSelector?: React.ReactNode;
}

function NodoTitulo({
  label,
  onClick,
  onCreate,
  variant = "ecosistema",
  maxWidthPx,
  fill,
}: {
  label: string;
  onClick: () => void;
  onCreate?: () => void;
  variant?: "ecosistema" | "criatura";
  maxWidthPx?: number;
  fill?: boolean;
}) {
  const chipStyles =
    variant === "ecosistema"
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
          title="Añadir"
          className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
        >
          <Plus size={9} className="text-primary/60" />
        </button>
      )}
    </div>
  );
}

export function CriaturasJerarquica({
  criaturas,
  personajes,
  ecosistemas = [],
  loading,
  onOpen,
  onCreateCriatura,
  onCreatePersonaje,
  creatingCriatura,
  onCreateEcosistema,
  creatingEcosistema,
  gruposCriaturasPorSubtipo,
  grupoSeleccionadoId,
  onSeleccionarGrupo,
  onOpenGrupo,
  busqueda = "",
  onBusquedaChange,
  agrupacionSelector,
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

  // Si hay un grupo de criaturas seleccionado, se filtra la lista de
  // criaturas a solo sus miembros — el resto de la jerarquía (ecosistemas,
  // personajes) se calcula normalmente sobre ese subconjunto.
  const grupoSeleccionado = grupoSeleccionadoId
    ? gruposCriaturasPorSubtipo?.flatMap((b) => b.grupos).find((g) => g.id === grupoSeleccionadoId)
    : null;
  const criaturasBase = grupoSeleccionado
    ? criaturas.filter((c) => grupoSeleccionado.miembro_ids.includes(c.id))
    : criaturas;

  const qCriatura = busqueda.trim().toLocaleLowerCase("es");
  const personajesDe = (criaturaNombre: string) =>
    personajes.filter((p) => p.especie === criaturaNombre);

  // Criaturas agrupadas por ecosistema (Ecosistema.criatura_ids → criatura).
  const criaturasDe = (ecosistemaId: string) =>
    criaturasBase
      .filter((c) =>
        ecosistemas.find((e) => e.id === ecosistemaId)?.criatura_ids.includes(c.id),
      )
      .sort((a, b) => personajesDe(b.nombre).length - personajesDe(a.nombre).length);

  // Una criatura "tiene ecosistema" si algún ecosistema de la base la lista.
  const criaturaTieneEcosistema = (criaturaId: string) =>
    ecosistemas.some((e) => e.criatura_ids.includes(criaturaId));

  // La búsqueda matchea ecosistema, cualquiera de sus criaturas, o
  // cualquiera de sus personajes — se muestra el ecosistema completo.
  const ecosistemasVisibles = qCriatura
    ? ecosistemas.filter((e) => {
        if (e.nombre?.toLocaleLowerCase("es").includes(qCriatura)) return true;
        return criaturasDe(e.id).some(
          (c) =>
            c.nombre?.toLocaleLowerCase("es").includes(qCriatura) ||
            personajesDe(c.nombre).some((p) =>
              p.nombre?.toLocaleLowerCase("es").includes(qCriatura),
            ),
        );
      })
    : ecosistemas;

  const ecosistemasOrdenados = [...ecosistemasVisibles].sort(
    (a, b) => criaturasDe(b.id).length - criaturasDe(a.id).length,
  );
  const ecosistemasConCriaturas = ecosistemasOrdenados.filter((e) => criaturasDe(e.id).length > 0);
  const ecosistemasVacios = ecosistemasOrdenados.filter((e) => criaturasDe(e.id).length === 0);

  // Criaturas sin ecosistema (o cuyo ecosistema quedó fuera de la base) —
  // se muestran con el mismo patrón "solo criatura" que antes.
  const criaturasSinEcosistemaBase = criaturasBase.filter((c) => !criaturaTieneEcosistema(c.id));
  const criaturasSinEcosistemaVisibles = qCriatura
    ? criaturasSinEcosistemaBase.filter(
        (c) =>
          c.nombre?.toLocaleLowerCase("es").includes(qCriatura) ||
          personajesDe(c.nombre).some((p) => p.nombre?.toLocaleLowerCase("es").includes(qCriatura)),
      )
    : criaturasSinEcosistemaBase;

  const totalDe = (criatura: Criatura) => personajesDe(criatura.nombre).length;
  const criaturasSinEcoOrdenadas = [...criaturasSinEcosistemaVisibles].sort(
    (a, b) => totalDe(b) - totalDe(a),
  );
  const criaturasConVinculosBase = criaturasSinEcoOrdenadas.filter((c) => totalDe(c) > 0);
  const criaturasVacias = criaturasSinEcoOrdenadas.filter((c) => totalDe(c) === 0);

  // ── Layout masonry (columnas de igual ancho) para los ecosistemas ─────────
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

  const anchoCriaturaCard = (personajeCount: number) => {
    if (personajeCount === 0) return 90;
    const cols = Math.min(Math.max(personajeCount, 1), 6, maxColsPorAncho);
    return Math.max(cols * itemSize + (cols - 1) * gapPx, 90);
  };
  const altoCriaturaCard = (personajeCount: number) => {
    const alturaTitulo = 20;
    const margenSuperior = 6;
    if (personajeCount === 0) return alturaTitulo + margenSuperior + 16;
    const cols = Math.min(Math.max(personajeCount, 1), 6, maxColsPorAncho);
    const filas = Math.ceil(personajeCount / cols);
    return alturaTitulo + margenSuperior + filas * itemSize + (filas - 1) * gapPx;
  };

  // Simula el flex-wrap real del contenido de la card de ecosistema (grid
  // de cada criatura) dentro del ancho fijo de columna, para estimar la
  // altura total de la card sin medir el DOM.
  const altoEcosistema = (ecosistema: Ecosistema) => {
    const conteos = criaturasDe(ecosistema.id).map((c) => totalDe(c)).sort((a, b) => b - a);
    const disponible = anchoColumnaMasonry - 32; // px-3 a ambos lados aprox
    const gapInterno = 24;
    const filas: number[][] = [];
    let filaActual: number[] = [];
    let anchoFilaActual = 0;
    for (const count of conteos) {
      const w = anchoCriaturaCard(count);
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

    const alturaBarraTitulo = 38;
    const paddingContenido = 24;
    const alturaFilas = filas.reduce((sum, fila) => sum + Math.max(...fila.map(altoCriaturaCard)), 0);
    const gapEntreFilas = gapInterno * Math.max(filas.length - 1, 0);
    return alturaBarraTitulo + paddingContenido + alturaFilas + gapEntreFilas;
  };

  function distribuirEnColumnas(list: Ecosistema[]): Ecosistema[][] {
    const columnas: Ecosistema[][] = Array.from({ length: numColumnas }, () => []);
    const alturas = new Array(numColumnas).fill(0);
    for (const eco of list) {
      let idxMin = 0;
      for (let i = 1; i < numColumnas; i++) {
        if (alturas[i] < alturas[idxMin]) idxMin = i;
      }
      columnas[idxMin].push(eco);
      alturas[idxMin] += altoEcosistema(eco) + GAP;
    }
    return columnas;
  }
  const columnasEcosistemas = distribuirEnColumnas(ecosistemasConCriaturas);
  const hayEcosistemasConCriaturas = ecosistemasConCriaturas.length > 0;

  // ── Card de criatura individual (idéntica a la de antes) ─────────────────
  const renderCriaturaCard = (criatura: Criatura, anchoMaxDisponible?: number) => {
    const habitantes = personajesDe(criatura.nombre);
    const vacia = habitantes.length === 0;
    const maxCols = anchoMaxDisponible
      ? Math.max(1, Math.floor((anchoMaxDisponible + gapPx) / (itemSize + gapPx)))
      : 6;
    const cols = Math.min(Math.max(habitantes.length, 1), 6, maxCols);
    const anchoPx = Math.max(cols * itemSize + (cols - 1) * gapPx, 90);

    return (
      <div
        key={criatura.id}
        className={vacia ? "w-fit shrink-0" : "shrink-0"}
        style={vacia ? undefined : { width: anchoPx }}
      >
        <NodoTitulo
          label={criatura.nombre}
          variant="criatura"
          maxWidthPx={vacia ? 140 : anchoPx}
          onClick={() => onOpen("criaturas", criatura.id)}
          onCreate={onCreatePersonaje ? () => onCreatePersonaje(criatura) : undefined}
        />
        {vacia ? (
          <div className="mt-1.5 text-micro text-primary/25">Sin personajes</div>
        ) : (
          <div
            className="mt-2 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${cols}, ${itemSize}px)` }}
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

  const criaturasNombres = new Set(criaturasBase.map((c) => c.nombre));
  const personajesSinCriaturaBase = personajes.filter(
    (p) => !p.especie || !criaturasNombres.has(p.especie)
  );
  const personajesSinCriatura = qCriatura
    ? personajesSinCriaturaBase.filter((p) => p.nombre?.toLocaleLowerCase("es").includes(qCriatura))
    : personajesSinCriaturaBase;
  const totalSinCriatura = personajesSinCriatura.length;

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-2 mb-4 px-1 flex-wrap">
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {agrupacionSelector}
          {onBusquedaChange && (
            <BuscadorInline
              value={busqueda}
              onChange={onBusquedaChange}
              placeholder="Buscar ecosistema, criatura o personaje…"
            />
          )}
          <GrupoFiltroBarra
            bloques={gruposCriaturasPorSubtipo}
            grupoSeleccionadoId={grupoSeleccionadoId}
            onSeleccionarGrupo={onSeleccionarGrupo}
            onOpenGrupo={onOpenGrupo}
          />
        </div>
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
        {onCreateEcosistema && (
          <button
            type="button"
            onClick={onCreateEcosistema}
            disabled={creatingEcosistema}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors text-micro font-bold uppercase tracking-wide text-accent disabled:opacity-50"
          >
            <Leaf size={11} />
            Añadir ecosistema
          </button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {/* Nivel 1: Ecosistemas con sus criaturas adentro. El ref de medida
            vive siempre acá (aunque no haya ecosistemas con contenido) para
            no perder el ancho ya calculado del contenedor. */}
        <div ref={containerRef} className="flex items-start gap-6 empty:hidden">
          {hayEcosistemasConCriaturas &&
            columnasEcosistemas.map((columna, colIdx) => (
              <div
                key={colIdx}
                className="flex flex-col gap-6 min-w-0"
                style={{ width: anchoColumnaMasonry }}
              >
                {columna.map((eco) => (
                  <div
                    key={eco.id}
                    className="w-full rounded-lg border border-primary/10 overflow-hidden"
                  >
                    <div className="px-3 py-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpen("ecosistemas", eco.id)}
                        title={eco.nombre}
                        className="flex-1 min-w-0 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 hover:text-accent transition-colors"
                      >
                        {eco.nombre}
                      </button>
                    </div>
                    <div className="px-3 pb-3 flex flex-wrap gap-6">
                      {criaturasDe(eco.id).map((c) =>
                        renderCriaturaCard(c, disponibleColumna),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>

        {/* Criaturas sin ecosistema (mismo patrón "solo criatura" que antes) */}
        {criaturasConVinculosBase.length > 0 && (
          <div>
            {hayEcosistemasConCriaturas && <div className="h-px mb-2 bg-primary/10" />}
            <div className="mb-2 px-1 text-micro font-bold uppercase tracking-[0.12em] text-primary/40">
              Sin ecosistema
            </div>
            <div className="flex flex-wrap gap-6">
              {criaturasConVinculosBase.map((c) => renderCriaturaCard(c, disponibleColumna))}
            </div>
          </div>
        )}

        {(totalSinCriatura > 0 || criaturasVacias.length > 0 || ecosistemasVacios.length > 0) && (
          <div>
            <div className="h-px mb-3 bg-primary/10" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Columna izquierda: Personajes sin criatura */}
              {totalSinCriatura > 0 ? (
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
              ) : (
                <div />
              )}

              {/* Columna derecha: Ecosistemas sin criaturas + Criaturas sin personajes,
                  en sub-bloques propios (separados y rotulados) para no confundirse
                  entre sí ni con los "Sin criatura" de la columna izquierda. */}
              {criaturasVacias.length > 0 || ecosistemasVacios.length > 0 ? (
                <div className="w-full rounded-lg border border-primary/10 overflow-hidden">
                  <div className="px-3 py-3 flex items-center gap-2">
                    <span className="flex-1 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
                      Sin personajes asignados
                    </span>
                  </div>
                  <div className="px-3 pb-3 flex flex-col gap-3">
                    {ecosistemasVacios.length > 0 && (
                      <div>
                        <div className="mb-1.5 text-micro font-bold text-primary/30">
                          Ecosistemas sin criaturas
                        </div>
                        <div
                          className="grid gap-2"
                          style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                          }}
                        >
                          {ecosistemasVacios.map((eco) => (
                            <NodoTitulo
                              key={eco.id}
                              fill
                              label={eco.nombre}
                              onClick={() => onOpen("ecosistemas", eco.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {criaturasVacias.length > 0 && (
                      <div>
                        <div className="mb-1.5 text-micro font-bold text-primary/30">
                          Criaturas sin personajes
                        </div>
                        <div
                          className="grid gap-2"
                          style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                          }}
                        >
                          {criaturasVacias.map((criatura) => (
                            <NodoTitulo
                              key={criatura.id}
                              fill
                              variant="criatura"
                              label={criatura.nombre}
                              onClick={() => onOpen("criaturas", criatura.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>
        )}

        {!hayEcosistemasConCriaturas &&
          criaturasConVinculosBase.length === 0 &&
          criaturasVacias.length === 0 &&
          ecosistemasVacios.length === 0 &&
          totalSinCriatura === 0 && (
            <div className="py-6 text-xs text-primary/25 text-center">
              Sin criaturas todavía
            </div>
          )}
      </div>
    </div>
  );
}

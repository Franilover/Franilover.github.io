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
 *
 * Modo "ojo apagado" (mostrarPersonajes=false): en vez de Reino → Ciudad →
 * Personajes, se muestra Bioma → Reinos directo, usando Bioma.reino_ids
 * (M:N). El título de cada Bioma abre un popover flotante local con su
 * editor (ver PopoverFlotante + BiomaPopoverContent), sin navegar fuera de
 * esta vista.
 * (M:N) — no pasa por Ecosistema (eso queda exclusivo de CriaturasJerarquica,
 * donde Ecosistema es el hábitat de Criatura). Un reino que ningún bioma
 * lista cae en "Sin bioma".
 *
 * Arrastre (click izquierdo abre / click derecho arrastra): usa el hook
 * compartido useRightClickDrag (DragDropReasignable.tsx). Hay dos arrastres
 * independientes activos en esta vista:
 *  - dragReino: chips de Reino → se pueden soltar sobre el título de un
 *    Bioma (modo ojo OFF) para asignar el reino a ese bioma
 *    (onAsignarReinoABioma).
 *  - dragPersonaje: EntityCard de Personaje → se pueden soltar sobre una
 *    columna de Ciudad o sobre la card de un Reino (modo ojo ON) para
 *    reasignar Personaje.ciudad_id (y opcionalmente Personaje.reino) vía
 *    onMoverPersonaje.
 */

import { Compass, Plus, Users } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

import { EntityCard } from "./EntityCard";
import { GrupoFiltroBarra, type GrupoFiltroSubtipo } from "./GrupoFiltroDropdown";
import { BuscadorInline } from "./BuscadorInline";
import { useRightClickDrag } from "./DragDropReasignable";
import { PopoverFlotante } from "./PopoverFlotante";
import { BiomaPopoverContent } from "@/domains/garlia/biologia/BiomaPopoverContent";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";

export type GrupoPersonajeSubtipo = GrupoFiltroSubtipo;

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
interface Bioma {
  id: string;
  nombre: string;
  /** Reinos (por id) que tienen territorio en este bioma — M:N. */
  reino_ids: string[];
}

interface Props {
  reinos: Reino[];
  ciudades: Ciudad[];
  personajes: Personaje[];
  /** Biomas — nivel jerárquico usado en modo "ojo apagado" para agrupar
   *  reinos (Bioma → Reinos, vía Bioma.reino_ids), opcional para no romper
   *  usos previos. */
  biomas?: Bioma[];
  loading?: boolean;
  /** Controla el modo de la vista:
   *  - true (ojo): Reino → Ciudad → Personajes (comportamiento previo).
   *  - false (sin ojo): Bioma → Reinos directo, sin ciudades ni
   *    personajes en ningún lado.
   *  Por defecto true. */
  mostrarPersonajes?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreateReino?: () => void;
  onCreateCiudad?: (reinoId: string | null) => void;
  onCreatePersonaje?: (ciudadId: string | null) => void;
  /** Asigna un reino a un bioma (drag & drop de un chip de reino sobre el
   *  título de un bioma en modo "ojo apagado") — agrega el reino a
   *  Bioma.reino_ids (M:N). Si el elemento no acepta esta prop, los reinos
   *  no son arrastrables en este modo. */
  onAsignarReinoABioma?: (reinoId: string, biomaId: string) => void;
  /** Mueve un personaje a otra ciudad (arrastre por click derecho de una
   *  EntityCard de personaje sobre una columna de ciudad, o sobre la card
   *  de un reino para dejarlo en el slot "Sin Ciudad" de ese reino). Si
   *  ciudadId es null, el personaje queda sin ciudad — reinoNombre indica
   *  a qué reino asignarlo directamente (o null para el bloque "Sin
   *  ciudad" global, sin reino). Si el elemento no acepta esta prop, los
   *  personajes no son arrastrables. */
  onMoverPersonaje?: (
    personajeId: string,
    ciudadId: string | null,
    reinoNombre: string | null,
  ) => void;
  creatingReino?: boolean;
  gruposPersonajesPorSubtipo?: GrupoPersonajeSubtipo[];
  grupoSeleccionadoId?: string | null;
  onSeleccionarGrupo?: (grupoId: string | null) => void;
  /** Grupos de tipo "reinos" agrupados por subtipo — mismos dropdowns que
   *  los de personajes, separados por un divisor, a la izquierda de
   *  "Añadir reino". Filtran qué reinos se muestran. */
  gruposReinosPorSubtipo?: GrupoFiltroSubtipo[];
  grupoReinoSeleccionadoId?: string | null;
  onSeleccionarGrupoReino?: (grupoId: string | null) => void;
  /** Abre el editor completo de un grupo (openEntity("grupos", id)) — se
   *  muestra como botón a la derecha de cada opción en los dropdowns. */
  onOpenGrupo?: (grupoId: string) => void;
  /** Texto de búsqueda por nombre de reino — controlado por el padre, se
   *  combina (AND) con el filtro de grupo activo. */
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
  creating,
  variant = "reino",
  maxWidthPx,
  fill,
  dragProps,
  dropActive,
}: {
  label: string;
  onClick: () => void;
  onCreate?: () => void;
  creating?: boolean;
  variant?: "reino" | "ciudad";
  maxWidthPx?: number;
  /** Si es true, el chip ocupa el 100% del ancho de su contenedor (uso en grid dinámico) */
  fill?: boolean;
  /** Props de arrastre (click derecho) generadas por dragHandlers() del hook
   *  useRightClickDrag — si se pasa, el chip se vuelve arrastrable. */
  dragProps?: React.HTMLAttributes<HTMLElement>;
  /** true si actualmente hay un arrastre activo pasando sobre este chip
   *  como zona de drop — solo feedback visual. */
  dropActive?: boolean;
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
        title={dragProps?.title ?? label}
        style={maxWidthPx ? { maxWidth: maxWidthPx } : undefined}
        {...dragProps}
        className={`px-2.5 py-0.5 rounded-full text-micro font-bold tracking-wide transition-colors truncate ${chipStyles} ${
          fill ? "flex-1 min-w-0 text-center" : ""
        } ${dragProps ? "cursor-grab active:cursor-grabbing" : ""} ${
          dropActive ? "ring-2 ring-accent/60" : ""
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
  biomas = [],
  loading,
  mostrarPersonajes = true,
  onOpen,
  onCreateReino,
  onCreateCiudad,
  onCreatePersonaje,
  onAsignarReinoABioma,
  onMoverPersonaje,
  creatingReino,
  gruposPersonajesPorSubtipo,
  grupoSeleccionadoId,
  onSeleccionarGrupo,
  gruposReinosPorSubtipo,
  grupoReinoSeleccionadoId,
  onSeleccionarGrupoReino,
  onOpenGrupo,
  busqueda = "",
  onBusquedaChange,
  agrupacionSelector,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Popover flotante del editor de bioma (reemplaza la navegación a
  // pantalla completa: click en el título de un bioma abre este panel
  // anclado en vez de onOpen("biomas", id)).
  const [biomaAbierto, setBiomaAbierto] = useState<{ id: string; anchor: HTMLElement } | null>(
    null,
  );

  // Arrastre (click derecho) de chips de Reino → se sueltan sobre el título
  // de un Bioma en modo "ojo apagado".
  const dragReino = useRightClickDrag<string>({
    label: (id) => reinos.find((r) => r.id === id)?.nombre ?? "",
  });
  // Arrastre (click derecho) de EntityCard de Personaje → se sueltan sobre
  // una columna de Ciudad o sobre la card de un Reino en modo "ojo ON".
  const dragPersonaje = useRightClickDrag<string>({
    label: (id) => personajes.find((p) => p.id === id)?.nombre ?? "",
  });

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

  // Si hay un grupo de personajes seleccionado, se filtra la lista de
  // personajes a solo sus miembros — el resto de la jerarquía (reinos,
  // ciudades) se calcula normalmente sobre este subconjunto.
  const grupoSeleccionado = grupoSeleccionadoId
    ? gruposPersonajesPorSubtipo?.flatMap((b) => b.grupos).find((g) => g.id === grupoSeleccionadoId)
    : null;
  const personajesBase = grupoSeleccionado
    ? personajes.filter((p) => grupoSeleccionado.miembro_ids.includes(p.id))
    : personajes;

  // Si hay un grupo de reinos seleccionado, se filtra la lista de reinos a
  // solo sus miembros — el resto de la jerarquía se calcula sobre ellos.
  const grupoReinoSeleccionado = grupoReinoSeleccionadoId
    ? gruposReinosPorSubtipo?.flatMap((b) => b.grupos).find((g) => g.id === grupoReinoSeleccionadoId)
    : null;
  const reinosBase = grupoReinoSeleccionado
    ? reinos.filter((r) => grupoReinoSeleccionado.miembro_ids.includes(r.id))
    : reinos;

  const ciudadesDe = (reinoId: string) =>
    ciudades
      .filter((c) => c.reino_id === reinoId)
      .sort((a, b) => personajesDe(b.id).length - personajesDe(a.id).length);
  const personajesDe = (ciudadId: string) =>
    personajesBase.filter((p) => p.ciudad_id === ciudadId);

  // Personajes sin ciudad_id, pero con un reino asignado directamente
  // (por nombre) se agrupan dentro de ese reino, bajo un slot "Sin Ciudad".
  const personajesSinCiudadDeReino = (reinoNombre: string) =>
    personajesBase.filter((p) => !p.ciudad_id && p.reino === reinoNombre);

  // La búsqueda matchea reino, cualquiera de sus ciudades, o cualquiera de
  // sus personajes (con o sin ciudad) — se muestra el reino completo, no
  // solo la parte que hizo match.
  const qReino = busqueda.trim().toLocaleLowerCase("es");
  const reinosVisibles = qReino
    ? reinosBase.filter((r) => {
        if (r.nombre?.toLocaleLowerCase("es").includes(qReino)) return true;
        if (ciudadesDe(r.id).some((c) => c.nombre?.toLocaleLowerCase("es").includes(qReino))) return true;
        if (
          personajesSinCiudadDeReino(r.nombre).some((p) =>
            p.nombre?.toLocaleLowerCase("es").includes(qReino),
          )
        )
          return true;
        return ciudadesDe(r.id).some((c) =>
          personajesDe(c.id).some((p) => p.nombre?.toLocaleLowerCase("es").includes(qReino)),
        );
      })
    : reinosBase;

  // Solo quedan huérfanos globales los que no tienen ni ciudad ni un reino
  // válido asociado.
  const personajesSinCiudadBase = personajesBase.filter(
    (p) => !p.ciudad_id && !reinosBase.some((r) => r.nombre === p.reino)
  );
  const personajesSinCiudad = qReino
    ? personajesSinCiudadBase.filter((p) => p.nombre?.toLocaleLowerCase("es").includes(qReino))
    : personajesSinCiudadBase;

  const reinosOrdenados = [...reinosVisibles].sort(
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
  const disponibleColumna = anchoColumnaMasonry - 24; // px-3 a ambos lados = 24px total
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
    const alturaTitulo = 20; // chip título compacto (py-0.5 = 4px)
    const margenSuperior = 6; // mt-1.5
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
    ciudadIdDestino,
    reinoNombreDestino,
  }: {
    key: string;
    nombre: string;
    habitantes: Personaje[];
    onClick: () => void;
    onCreate?: () => void;
    /** Ancho máximo disponible (px); limita cuántas columnas internas puede
     * tener el grid para no desbordar la card. */
    anchoMaxDisponible?: number;
    /** Ciudad a la que se asigna un personaje soltado sobre esta columna
     *  (null = sin ciudad). Si se omite junto con onMoverPersonaje, la
     *  columna no es zona de drop. */
    ciudadIdDestino?: string | null;
    /** Reino al que pertenece esta columna — se usa junto a
     *  ciudadIdDestino: null para el slot "Sin Ciudad" de un reino
     *  específico (distinto del bloque "Sin ciudad" global). */
    reinoNombreDestino?: string | null;
  }) => {
    const vacia = habitantes.length === 0;
    const zoneId = `col:${key}`;
    const esZonaDrop = onMoverPersonaje && ciudadIdDestino !== undefined;
    const dropHandlers = esZonaDrop
      ? dragPersonaje.dropHandlers(zoneId, (personajeId) =>
          onMoverPersonaje!(personajeId, ciudadIdDestino ?? null, reinoNombreDestino ?? null),
        )
      : {};
    const dropActive = esZonaDrop && dragPersonaje.esZonaActiva(zoneId);

    if (!mostrarPersonajes) {
      // Vista colapsada: solo el chip de la ciudad + contador, sin grilla
      // de personajes — el toggle "Mostrar personajes" está apagado.
      return (
        <div key={key} className="w-fit shrink-0">
          <div className="flex items-center gap-1">
            <NodoTitulo
              label={nombre}
              variant="ciudad"
              maxWidthPx={160}
              onClick={onClick}
              onCreate={onCreate}
            />
            {!vacia && (
              <span className="text-micro font-bold text-primary/30 shrink-0">
                {habitantes.length}
              </span>
            )}
          </div>
        </div>
      );
    }

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
        {...dropHandlers}
        className={`${vacia ? "w-fit shrink-0" : "shrink-0"} rounded-lg transition-colors ${
          dropActive ? "ring-2 ring-accent/60 bg-accent/5" : ""
        }`}
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
            {esZonaDrop ? "Soltá un personaje acá" : "Sin personajes"}
          </div>
        ) : (
          <div
            className="mt-2 grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${itemSize}px)`,
            }}
          >
            {habitantes.map((p) => (
              <div
                key={p.id}
                {...(onMoverPersonaje ? dragPersonaje.dragHandlers(p.id) : {})}
              >
                <EntityCard
                  nombre={p.nombre}
                  imageUrl={p.img_url}
                  Icon={Users}
                  onClick={() => onOpen("personajes", p.id)}
                />
              </div>
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
      ciudadIdDestino: ciudad.id,
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
      ciudadIdDestino: null,
      reinoNombreDestino: reino.nombre,
    });

  // ── Modo "ojo apagado": Bioma → Reinos ─────────────────────────────────────
  // Reinos con territorio en un bioma dado, vía Bioma.reino_ids (M:N). Se
  // calcula solo cuando hace falta (mostrarPersonajes=false) para no afectar
  // el modo normal.
  const qReinoOjoOff = busqueda.trim().toLocaleLowerCase("es");
  const reinosDeBioma = (biomaId: string) => {
    const bioma = biomas.find((b) => b.id === biomaId);
    if (!bioma) return [];
    return reinos.filter((r) => bioma.reino_ids.includes(r.id));
  };

  // Reinos que ningún bioma lista todavía.
  const reinosConBiomaIds = new Set(
    biomas.flatMap((b) => reinosDeBioma(b.id).map((r) => r.id)),
  );
  const reinosSinBiomaBase = reinos.filter((r) => !reinosConBiomaIds.has(r.id));
  const reinosSinBioma = qReinoOjoOff
    ? reinosSinBiomaBase.filter((r) => r.nombre?.toLocaleLowerCase("es").includes(qReinoOjoOff))
    : reinosSinBiomaBase;

  const biomasVisiblesOjoOff = qReinoOjoOff
    ? biomas.filter((b) => {
        if (b.nombre?.toLocaleLowerCase("es").includes(qReinoOjoOff)) return true;
        return reinosDeBioma(b.id).some((r) =>
          r.nombre?.toLocaleLowerCase("es").includes(qReinoOjoOff),
        );
      })
    : biomas;

  const hayBiomasConReinos = biomasVisiblesOjoOff.some((b) => reinosDeBioma(b.id).length > 0);

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-2 mb-4 px-1 flex-wrap">
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {agrupacionSelector}
          {onBusquedaChange && (
            <BuscadorInline
              value={busqueda}
              onChange={onBusquedaChange}
              placeholder="Buscar reino, ciudad o personaje…"
            />
          )}
          <GrupoFiltroBarra
            bloques={gruposPersonajesPorSubtipo}
            grupoSeleccionadoId={grupoSeleccionadoId}
            onSeleccionarGrupo={onSeleccionarGrupo}
            onOpenGrupo={onOpenGrupo}
          />
          {!!gruposPersonajesPorSubtipo?.length && !!gruposReinosPorSubtipo?.length && (
            <div className="w-px h-4 bg-primary/15 shrink-0" />
          )}
          <GrupoFiltroBarra
            bloques={gruposReinosPorSubtipo}
            grupoSeleccionadoId={grupoReinoSeleccionadoId}
            onSeleccionarGrupo={onSeleccionarGrupoReino}
            onOpenGrupo={onOpenGrupo}
          />
        </div>
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

      {mostrarPersonajes ? (
        <div className="flex flex-col gap-8">
          <div ref={containerRef} className="flex items-start gap-6">
            {columnasReinos.map((columna, colIdx) => (
              <div
                key={colIdx}
                className="flex flex-col gap-6 min-w-0"
                style={{ width: anchoColumnaMasonry }}
              >
                {columna.map((reino) => {
                  const zoneIdReino = `reino:${reino.id}`;
                  const dropActiveReino =
                    !!onMoverPersonaje && dragPersonaje.esZonaActiva(zoneIdReino);
                  const dropHandlersReino = onMoverPersonaje
                    ? dragPersonaje.dropHandlers(zoneIdReino, (personajeId) =>
                        onMoverPersonaje(personajeId, null, reino.nombre),
                      )
                    : {};
                  return (
                  <div
                    key={reino.id}
                    {...dropHandlersReino}
                    className={`w-full rounded-lg border overflow-hidden transition-colors ${
                      dropActiveReino ? "border-accent/50 bg-accent/5" : "border-primary/10"
                    }`}
                  >
                    <div className="px-3 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <span />
                      <button
                        type="button"
                        onClick={() => onOpen("reinos", reino.id)}
                        title={reino.nombre}
                        className="min-w-0 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 hover:text-accent transition-colors text-center justify-self-center max-w-full"
                      >
                        {reino.nombre}
                      </button>
                      <div className="justify-self-end">
                        {onCreateCiudad && (
                          <button
                            type="button"
                            onClick={() => onCreateCiudad(reino.id)}
                            title="Añadir ciudad"
                            className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
                          >
                            <Plus size={9} className="text-primary/60" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="px-3 pb-3 flex flex-wrap gap-6">
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
                  );
                })}
              </div>
            ))}
          </div>

          {(personajesSinCiudad.length > 0 || reinosVacios.length > 0) && (
            <div>
              <div className="h-px mb-3 bg-primary/10" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Columna izquierda: Personajes sin ciudad */}
                {personajesSinCiudad.length > 0 ? (
                  <div
                    {...(onMoverPersonaje
                      ? dragPersonaje.dropHandlers("sin-ciudad-global", (personajeId) =>
                          onMoverPersonaje(personajeId, null, null),
                        )
                      : {})}
                    className={`w-full rounded-lg border overflow-hidden transition-colors ${
                      onMoverPersonaje && dragPersonaje.esZonaActiva("sin-ciudad-global")
                        ? "border-accent/50 bg-accent/5"
                        : "border-primary/10"
                    }`}
                  >
                    <div className="px-3 py-3 flex items-center gap-2">
                      <span className="flex-1 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
                        Sin ciudad
                      </span>
                      {onCreatePersonaje && (
                        <button
                          type="button"
                          onClick={() => onCreatePersonaje(null)}
                          title="Añadir personaje"
                          className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
                        >
                          <Plus size={9} className="text-primary/60" />
                        </button>
                      )}
                    </div>
                    <div
                      className="px-3 pb-3 grid gap-1"
                      style={{
                        gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                      }}
                    >
                      {personajesSinCiudad.map((p) => (
                        <div key={p.id} {...(onMoverPersonaje ? dragPersonaje.dragHandlers(p.id) : {})}>
                          <EntityCard
                            nombre={p.nombre}
                            imageUrl={p.img_url}
                            Icon={Users}
                            onClick={() => onOpen("personajes", p.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                {/* Columna derecha: Reinos sin ciudades */}
                {reinosVacios.length > 0 ? (
                  <div className="w-full rounded-lg border border-primary/10 overflow-hidden">
                    <div className="px-3 py-3 flex items-center gap-2">
                      <span className="flex-1 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
                        Sin ciudades asignadas
                      </span>
                    </div>
                    <div
                      className="px-3 pb-3 grid gap-2"
                      style={{
                        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                      }}
                    >
                      {reinosVacios.map((reino) => (
                        <div
                          key={reino.id}
                          {...(onMoverPersonaje
                            ? dragPersonaje.dropHandlers(`reino:${reino.id}`, (personajeId) =>
                                onMoverPersonaje(personajeId, null, reino.nombre),
                              )
                            : {})}
                        >
                          <NodoTitulo
                            fill
                            label={reino.nombre}
                            onClick={() => onOpen("reinos", reino.id)}
                            dropActive={
                              !!onMoverPersonaje && dragPersonaje.esZonaActiva(`reino:${reino.id}`)
                            }
                            onCreate={
                              onCreateCiudad ? () => onCreateCiudad(reino.id) : undefined
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}
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
      ) : (
        // ── Ojo OFF: Reinos agrupados directo por Bioma (Bioma.reino_ids,
        // M:N) — sin pasar por Ecosistema, que queda exclusivo de la vista
        // por Criatura (CriaturasJerarquica).
        <div className="flex flex-col gap-8">
          <div ref={containerRef} className="h-0 overflow-hidden" aria-hidden />

          {biomasVisiblesOjoOff.length > 0 &&
            biomasVisiblesOjoOff.map((bioma) => {
              const reinosDelBioma = reinosDeBioma(bioma.id).filter((r) =>
                qReinoOjoOff ? r.nombre?.toLocaleLowerCase("es").includes(qReinoOjoOff) : true,
              );
              const zoneIdBioma = `bioma:${bioma.id}`;
              const dropActiveBioma =
                !!onAsignarReinoABioma && dragReino.esZonaActiva(zoneIdBioma);
              const dropHandlersBioma = onAsignarReinoABioma
                ? dragReino.dropHandlers(zoneIdBioma, (reinoId) =>
                    onAsignarReinoABioma(reinoId, bioma.id),
                  )
                : {};
              return (
                <div key={bioma.id} className="flex flex-col gap-3">
                  <div
                    {...dropHandlersBioma}
                    className={`self-start rounded-md transition-colors ${
                      dropActiveBioma ? "ring-2 ring-accent/60 bg-accent/5" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => setBiomaAbierto({ id: bioma.id, anchor: e.currentTarget })}
                      title={bioma.nombre}
                      className="flex items-center gap-1.5 px-1 text-micro font-black uppercase tracking-[0.15em] text-primary/50 hover:text-accent transition-colors"
                    >
                      <Compass size={11} className="shrink-0 text-accent/50" />
                      {bioma.nombre}
                    </button>
                  </div>
                  {reinosDelBioma.length === 0 ? (
                    <div className="text-micro text-primary/25 px-1">
                      {onAsignarReinoABioma ? "Soltá un reino acá" : "Sin reinos"}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {reinosDelBioma.map((r) => (
                        <NodoTitulo
                          key={r.id}
                          label={r.nombre}
                          variant="reino"
                          maxWidthPx={160}
                          dragProps={dragReino.dragHandlers(r.id)}
                          onClick={() => onOpen("reinos", r.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {reinosSinBioma.length > 0 && (
            <div>
              {hayBiomasConReinos && <div className="h-px mb-2 bg-primary/10" />}
              <div className="mb-2 px-1 text-micro font-bold uppercase tracking-[0.12em] text-primary/40">
                Sin bioma
              </div>
              <div className="flex flex-wrap gap-2">
                {reinosSinBioma.map((r) => (
                  <NodoTitulo
                    key={r.id}
                    label={r.nombre}
                    variant="reino"
                    maxWidthPx={160}
                    dragProps={dragReino.dragHandlers(r.id)}
                    onClick={() => onOpen("reinos", r.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {biomasVisiblesOjoOff.length === 0 && reinosSinBioma.length === 0 && (
            <div className="py-6 text-xs text-primary/25 text-center">
              Sin reinos todavía
            </div>
          )}
        </div>
      )}
      {dragReino.overlay}
      {dragPersonaje.overlay}

      {biomaAbierto &&
        biomas.some((b) => b.id === biomaAbierto.id) && (
          <PopoverFlotante
            anchor={biomaAbierto.anchor}
            onClose={() => setBiomaAbierto(null)}
            width={640}
            maxHeight={480}
          >
            <BiomaPopoverContent biomaId={biomaAbierto.id} onClose={() => setBiomaAbierto(null)} />
          </PopoverFlotante>
        )}
    </div>
  );
}

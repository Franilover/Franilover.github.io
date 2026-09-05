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
 * El chip "Ecosistema" (y el título de su Bioma agrupador) abren un popover
 * flotante local con su editor (ver PopoverFlotante + EcosistemaPopoverContent
 * / BiomaPopoverContent más abajo), sin navegar fuera de esta vista. Cada
 * card de "Criatura" conserva su título-botón propio que abre su editor
 * completo (openEntity("criaturas", id)) y por dentro sigue mostrando la
 * grilla de personajes tal cual antes.
 *
 * Relaciones usadas:
 *  - Tabla puente ecosistema_criaturas (ruta canónica v226, ver prop
 *    criaturaIdsDeEcosistema) → agrupa criaturas bajo cada ecosistema que
 *    las contiene. Una criatura sin ecosistema, o cuyo ecosistema no está
 *    en la lista, cae en el bloque "Sin ecosistema".
 *  - Ecosistema.flora_ids / mineral_ids → se muestran como chips dentro de
 *    la misma tarjeta de ecosistema, al mismo nivel que sus criaturas —
 *    solo lectura acá, la edición del vínculo vive en PanelEcosistema.
 *  - Personaje.especie (nombre de la criatura, no FK) → agrupa personajes
 *    bajo la criatura cuyo nombre coincide con su especie.
 * Las entidades sin vínculo caen en el bloque final global "Sin criatura".
 *
 * Arrastre (click izquierdo abre / click derecho arrastra): usa el hook
 * compartido useRightClickDrag (DragDropReasignable.tsx), mismo patrón que
 * GeografiaJerarquica. Dos arrastres independientes:
 *  - dragCriatura: chips de Criatura → se pueden soltar sobre una card de
 *    Ecosistema (modo ojo OFF) para asignar la criatura a ese ecosistema
 *    (onAsignarCriaturaAEcosistema).
 *  - dragPersonaje: EntityCard de Personaje → se pueden soltar sobre una
 *    card de Criatura (modo ojo ON) para reasignar Personaje.especie vía
 *    onMoverPersonaje.
 */

import { Bug, ChevronDown, Compass, Gem, Leaf, Plus, Users } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

import { EntityCard } from "@/domains/garlia/_shared/EntityCard";
import { GrupoFiltroBarra, type GrupoFiltroSubtipo } from "@/domains/garlia/_shared/GrupoFiltroDropdown";
import { BuscadorInline } from "@/domains/garlia/_shared/BuscadorInline";
import { useRightClickDrag } from "@/domains/garlia/_shared/DragDropReasignable";
import { PopoverFlotante } from "@/domains/garlia/_shared/PopoverFlotante";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";
import { BiomaPopoverContent } from "@/domains/garlia/biologia/BiomaPopoverContent";
import { EcosistemaPopoverContent } from "@/domains/garlia/biologia/EcosistemaPopoverContent";
import type { SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";

interface Criatura {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  descripcion?: string | null;
}
interface Personaje {
  id: string;
  nombre: string;
  img_url?: string | null;
  especie?: string | null;
  reino?: string | null;
}
interface Ecosistema {
  id: string;
  nombre: string;
  /** Flora presente en este ecosistema — opcional para no romper usos previos. */
  flora_ids?: string[];
  /** Minerales presentes en este ecosistema — opcional idem. */
  mineral_ids?: string[];
  /** FK al Bioma que contiene este ecosistema — opcional idem. */
  bioma_id?: string | null;
}
interface Bioma {
  id: string;
  nombre: string;
}
interface EntidadMin {
  id: string;
  nombre: string;
  imagen_url?: string | null;
}

interface Props {
  criaturas: Criatura[];
  personajes: Personaje[];
  /** Ecosistemas — agrupan criaturas por encima de ellas (Ecosistema →
   *  Criatura → Personajes), opcional para no romper usos previos. */
  ecosistemas?: Ecosistema[];
  /** Resuelve los ids de criatura que habitan un ecosistema dado — ruta
   *  canónica v226 vía la tabla puente ecosistema_criaturas (ya no vive en
   *  Ecosistema.criatura_ids, columna retirada). Si no se pasa, se asume
   *  que ningún ecosistema tiene criaturas asignadas. */
  criaturaIdsDeEcosistema?: (ecosistemaId: string) => string[];
  /** Biomas — nivel jerárquico por encima de Ecosistema (Bioma → Ecosistema
   *  → Criatura → Personajes), opcional idem. Solo se usa en modo "ojo
   *  apagado"; en modo "ojo prendido" no aplica (vista plana por especie). */
  biomas?: Bioma[];
  /** Catálogo mínimo de Flora (id/nombre/imagen) — para resolver los
   *  flora_ids de cada ecosistema y mostrarlos como chips dentro de su
   *  tarjeta, al mismo nivel que las criaturas. */
  flora?: EntidadMin[];
  /** Catálogo mínimo de Minerales — mismo propósito que `flora`. */
  minerales?: EntidadMin[];
  loading?: boolean;
  /** Controla el modo de la vista:
   *  - true (ojo): Personajes agrupados por especie (Criatura), sin
   *    Ecosistema por encima — vista plana Criatura → Personajes.
   *  - false (sin ojo): Criaturas, Flora y Minerales agrupados por
   *    Ecosistema, sin mostrar personajes en ningún lado.
   *  Por defecto true. */
  mostrarPersonajes?: boolean;
  onOpen: (section: SectionKey, id: string) => void;
  onCreateCriatura?: () => void;
  onCreatePersonaje?: (criatura: Criatura | null) => void;
  creatingCriatura?: boolean;
  /** Asigna una criatura a un ecosistema (arrastre por click derecho de un
   *  chip de criatura sobre una card de ecosistema, modo "ojo apagado") —
   *  crea la fila correspondiente en la tabla puente ecosistema_criaturas.
   *  Si el elemento no acepta esta prop, los chips de criatura no son
   *  arrastrables. */
  onAsignarCriaturaAEcosistema?: (criaturaId: string, ecosistemaId: string) => void;
  /** Mueve un ecosistema a otro bioma (arrastre por click derecho de una
   *  card/chip de ecosistema sobre el título de un bioma, mismo criterio
   *  que en GeografiaJerarquica) — setea Ecosistema.bioma_id. Si el
   *  elemento no acepta esta prop, los ecosistemas no son arrastrables. */
  onAsignarEcosistemaABioma?: (ecosistemaId: string, biomaId: string) => void;
  /** Mueve un personaje a otra criatura (especie) — arrastre por click
   *  derecho de una EntityCard de personaje sobre una card de criatura en
   *  modo "ojo ON". `criaturaNombre` es null para dejarlo sin especie
   *  (bloque "Sin criatura"). Si el elemento no acepta esta prop, los
   *  personajes no son arrastrables. */
  onMoverPersonaje?: (personajeId: string, criaturaNombre: string | null) => void;
  /** Crea un ecosistema nuevo — botón junto a "Añadir criatura", para
   *  manejar ecosistemas sin salir de esta vista (antes solo se podían
   *  crear desde Magia → Biología). Devuelve el id creado (o null si
   *  falló) para que este componente abra su popover de edición anclado
   *  al botón que disparó la acción, en vez de navegar a pantalla completa. */
  onCreateEcosistema?: () => Promise<string | null> | string | null | void;
  creatingEcosistema?: boolean;
  /** Crea un Bioma nuevo — botón junto a "Añadir ecosistema", mismo criterio
   *  de atajo sin salir de esta vista. Mismo contrato que onCreateEcosistema. */
  onCreateBioma?: () => Promise<string | null> | string | null | void;
  creatingBioma?: boolean;
  /** Crea una entidad de Flora nueva — botón junto a "Añadir ecosistema",
   *  misma lógica: no se agrupa jerárquicamente acá, solo un atajo para no
   *  salir de esta vista para crearla. */
  onCreateFlora?: () => void;
  creatingFlora?: boolean;
  /** Crea una entidad de Mineral nueva — mismo patrón que onCreateFlora. */
  onCreateMineral?: () => void;
  creatingMineral?: boolean;
  /** Grupos de tipo "criaturas" agrupados por subtipo, para los dropdowns
   *  de la barra superior — filtran qué criaturas se muestran. */
  gruposCriaturasPorSubtipo?: GrupoFiltroSubtipo[];
  grupoSeleccionadoId?: string | null;
  onSeleccionarGrupo?: (grupoId: string | null) => void;
  /** Abre el editor completo de un grupo — botón a la derecha de cada
   *  opción en los dropdowns de filtro, y también usado por el popover
   *  flotante de Personaje (bloque "Grupos"). */
  onOpenGrupo?: (grupoId: string) => void;
  /** Abre el editor completo de una canción — usado por el popover flotante
   *  de Personaje (bloque "Canciones"). */
  onSelectCancion?: (id: string) => void;
  /** Navega al editor completo de un capítulo — usado por el popover
   *  flotante de Personaje (bloque "Capítulos"). */
  onNavigateCapitulo?: (capituloId: string) => void;
  /** Guarda un patch parcial de un personaje (especie/reino) — usado por los
   *  selectores rápidos del popover flotante de Personaje. Si no se pasa,
   *  esos selectores no aparecen editables (el popover sigue mostrándose,
   *  solo que de solo lectura). */
  onUpdatePersonaje?: (personajeId: string, patch: Partial<Personaje>) => void;
  /** Abre el editor completo de un grupo de clasificación — usado por el
   *  popover flotante de Criatura (bloque "Clasificación"). Reutiliza
   *  onOpenGrupo si no se pasa uno específico. */
  onSelectGrupo?: (grupoId: string) => void;
  /** Navega al editor completo de un reino — usado por el popover flotante
   *  de Criatura (bloque "Territorio"). */
  onNavigateReino?: (id: string) => void;
  /** Guarda un patch parcial de una criatura (descripción) — usado por el
   *  popover flotante de Criatura. */
  onUpdateCriatura?: (criaturaId: string, patch: Partial<Criatura>) => void;
  /** Texto de búsqueda por nombre de criatura — controlado por el padre,
   *  se combina (AND) con el filtro de grupo activo. */
  busqueda?: string;
  onBusquedaChange?: (value: string) => void;
  /** Elemento opcional pegado a la izquierda del buscador — usado por
   *  EntidadesPage para el dropdown de agrupación (Reino/Criatura). */
  agrupacionSelector?: React.ReactNode;
  /** Ícono de descarga de datos (Items/Criaturas/Personajes), pegado a la
   *  izquierda del AñadirDropdown — provisto por EntidadesPage. */
  descargarDatosBoton?: React.ReactNode;
}

function NodoTitulo({
  label,
  onClick,
  onCreate,
  variant = "ecosistema",
  maxWidthPx,
  fill,
  dragProps,
  dropActive,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCreate?: () => void;
  variant?: "ecosistema" | "criatura" | "flora" | "mineral";
  maxWidthPx?: number;
  fill?: boolean;
  /** Props de arrastre (click derecho) generadas por dragHandlers() del hook
   *  useRightClickDrag — si se pasa, el chip se vuelve arrastrable. */
  dragProps?: React.HTMLAttributes<HTMLElement>;
  /** true si actualmente hay un arrastre activo pasando sobre este chip
   *  como zona de drop — solo feedback visual. */
  dropActive?: boolean;
}) {
  const chipStyles =
    variant === "criatura"
      ? "bg-accent/10 hover:bg-accent/20 text-accent/80 border border-accent/15"
      : "bg-primary/10 hover:bg-primary/20 text-primary/70 border border-primary/15";

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
          title="Añadir"
          className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
        >
          <Plus size={9} className="text-primary/60" />
        </button>
      )}
    </div>
  );
}

/**
 * AñadirDropdown
 * ───────────────────────────────────────────────────────────────────────────
 * Reemplaza los 4 botones "Añadir criatura / ecosistema / flora / mineral"
 * por un único botón "+" que despliega las mismas 4 opciones en un menú,
 * siguiendo el mismo patrón visual que AgrupacionPersonajesDropdown.
 * Solo se muestran las opciones cuyo handler fue provisto por el padre.
 */
function AñadirDropdown({
  onCreateCriatura,
  creatingCriatura,
  onCreateBioma,
  creatingBioma,
  onCreateEcosistema,
  creatingEcosistema,
  onCreateFlora,
  creatingFlora,
  onCreateMineral,
  creatingMineral,
}: {
  onCreateCriatura?: () => void;
  creatingCriatura?: boolean;
  onCreateBioma?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  creatingBioma?: boolean;
  onCreateEcosistema?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  creatingEcosistema?: boolean;
  onCreateFlora?: () => void;
  creatingFlora?: boolean;
  onCreateMineral?: () => void;
  creatingMineral?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const opciones: {
    key: string;
    label: string;
    Icon: React.ElementType;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    creating?: boolean;
  }[] = [
    {
      key: "criatura",
      label: "Añadir criatura",
      Icon: Bug,
      onClick: onCreateCriatura,
      creating: creatingCriatura,
    },
    {
      key: "bioma",
      label: "Añadir bioma",
      Icon: Compass,
      onClick: onCreateBioma,
      creating: creatingBioma,
    },
    {
      key: "ecosistema",
      label: "Añadir ecosistema",
      Icon: Leaf,
      onClick: onCreateEcosistema,
      creating: creatingEcosistema,
    },
    {
      key: "flora",
      label: "Añadir flora",
      Icon: Leaf,
      onClick: onCreateFlora,
      creating: creatingFlora,
    },
    {
      key: "mineral",
      label: "Añadir mineral",
      Icon: Gem,
      onClick: onCreateMineral,
      creating: creatingMineral,
    },
  ].filter((o) => o.onClick);

  if (opciones.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Añadir…"
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-primary/70"
      >
        <Plus size={13} />
        <ChevronDown size={10} className="shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 top-full right-0 mt-1 min-w-[180px] rounded-lg border border-primary/10 bg-[var(--card,_#1a1a1a)] shadow-lg overflow-hidden py-1">
          {opciones.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={o.creating}
              onClick={(e) => {
                o.onClick?.(e);
                setOpen(false);
              }}
              className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-micro font-bold uppercase tracking-wide truncate transition-colors text-primary/70 hover:bg-primary/5 disabled:opacity-50"
            >
              <o.Icon size={11} className="shrink-0" />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * EcosistemaExtrasIcono
 * ───────────────────────────────────────────────────────────────────────────
 * Reemplaza la columna lateral de chips de flora/minerales dentro de cada
 * card de ecosistema por un solo ícono (Leaf o Gem) en la esquina superior
 * derecha de la card. Al hacer click despliega un dropdown con la lista de
 * nombres — click en un nombre abre su editor (onOpen). No se renderiza si
 * la lista está vacía.
 */
function EcosistemaExtrasIcono({
  items,
  Icon,
  label,
  onOpenItem,
}: {
  items: EntidadMin[];
  Icon: React.ElementType;
  label: string;
  onOpenItem: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title={`${label} (${items.length})`}
        className="flex items-center gap-1 p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors text-primary/60"
      >
        <Icon size={11} />
      </button>
      {open && (
        <div className="absolute z-20 top-full right-0 mt-1 min-w-[160px] max-h-64 overflow-y-auto rounded-lg border border-primary/10 bg-[var(--card,_#1a1a1a)] shadow-lg py-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenItem(item.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-micro font-semibold truncate text-primary/70 hover:bg-primary/5 transition-colors"
            >
              <Icon size={10} className="shrink-0 text-primary/40" />
              <span className="truncate">{item.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CriaturasJerarquica({
  criaturas,
  personajes,
  ecosistemas = [],
  criaturaIdsDeEcosistema = () => [],
  biomas = [],
  flora = [],
  minerales = [],
  loading,
  mostrarPersonajes = true,
  onOpen,
  onCreateCriatura,
  onCreatePersonaje,
  creatingCriatura,
  onAsignarCriaturaAEcosistema,
  onAsignarEcosistemaABioma,
  onMoverPersonaje,
  onCreateEcosistema,
  creatingEcosistema,
  onCreateBioma,
  creatingBioma,
  onCreateFlora,
  creatingFlora,
  onCreateMineral,
  creatingMineral,
  gruposCriaturasPorSubtipo,
  grupoSeleccionadoId,
  onSeleccionarGrupo,
  onOpenGrupo,
  onSelectCancion,
  onNavigateCapitulo,
  onUpdatePersonaje,
  onSelectGrupo,
  onNavigateReino,
  onUpdateCriatura,
  busqueda = "",
  onBusquedaChange,
  agrupacionSelector,
  descargarDatosBoton,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Popovers flotantes de bioma/ecosistema (reemplazan la navegación a
  // pantalla completa: click en un ecosistema o en el título de su bioma
  // abre un panel anclado en vez de onOpen("ecosistemas"/"biomas", id)).
  const [ecosistemaAbierto, setEcosistemaAbierto] = useState<{
    id: string;
    anchor: HTMLElement;
  } | null>(null);
  const [biomaAbierto, setBiomaAbierto] = useState<{ id: string; anchor: HTMLElement } | null>(
    null,
  );
  // Vista rápida flotante de Personaje/Criatura: click izquierdo abre el
  // panel flotante global (siempre centrado en pantalla) — ver
  // PanelFlotanteGlobal, montado una sola vez en EditorMundoRoot.
  const abrirPanel = usePanelFlotante((s) => s.abrir);

  // Envuelven las props onCreateBioma/onCreateEcosistema (que crean la
  // entidad y devuelven su id) para además abrir el popover de edición
  // anclado al botón "Añadir…" que disparó la acción, en vez de navegar a
  // pantalla completa.
  const handleCreateBioma = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const anchor = e.currentTarget;
    const resultado = await onCreateBioma?.();
    if (resultado) setBiomaAbierto({ id: resultado, anchor });
  };
  const handleCreateEcosistema = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const anchor = e.currentTarget;
    const resultado = await onCreateEcosistema?.();
    if (resultado) setEcosistemaAbierto({ id: resultado, anchor });
  };

  // Arrastre (click derecho) de chips de Criatura → se sueltan sobre una
  // card de Ecosistema en modo "ojo apagado".
  const dragCriatura = useRightClickDrag<string>({
    label: (id) => criaturas.find((c) => c.id === id)?.nombre ?? "",
  });
  // Arrastre (click derecho) de EntityCard de Personaje → se sueltan sobre
  // una card de Criatura en modo "ojo ON" (o "Sin criatura").
  const dragPersonaje = useRightClickDrag<string>({
    label: (id) => personajes.find((p) => p.id === id)?.nombre ?? "",
  });
  // Arrastre (click derecho) de chips/cards de Ecosistema → se sueltan
  // sobre el título de un Bioma.
  const dragEcosistema = useRightClickDrag<string>({
    label: (id) => ecosistemas.find((e) => e.id === id)?.nombre ?? "",
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

  // Criaturas agrupadas por ecosistema, vía tabla puente ecosistema_criaturas
  // (ruta canónica v226 — reemplaza la antigua Ecosistema.criatura_ids).
  const criaturasDe = (ecosistemaId: string) => {
    const ids = new Set(criaturaIdsDeEcosistema(ecosistemaId));
    return criaturasBase
      .filter((c) => ids.has(c.id))
      .sort((a, b) => personajesDe(b.nombre).length - personajesDe(a.nombre).length);
  };

  // Flora / Minerales del ecosistema — solo lectura acá, edición vive en
  // PanelEcosistema. Mismo patrón que criaturasDe pero resolviendo contra
  // el catálogo mínimo pasado por el padre.
  const floraDe = (ecosistemaId: string) => {
    const ids = ecosistemas.find((e) => e.id === ecosistemaId)?.flora_ids ?? [];
    return flora.filter((f) => ids.includes(f.id));
  };
  const mineralesDe = (ecosistemaId: string) => {
    const ids = ecosistemas.find((e) => e.id === ecosistemaId)?.mineral_ids ?? [];
    return minerales.filter((m) => ids.includes(m.id));
  };

  // Flora/Minerales que ningún ecosistema (de la base) lista todavía —
  // mismo criterio que "criaturas sin ecosistema", para que una entidad
  // recién creada no desaparezca de la vista hasta asignarle un ecosistema.
  const floraAsignadaIds = new Set(ecosistemas.flatMap((e) => e.flora_ids ?? []));
  const mineralesAsignadosIds = new Set(ecosistemas.flatMap((e) => e.mineral_ids ?? []));
  const floraSinEcosistemaBase = flora.filter((f) => !floraAsignadaIds.has(f.id));
  const mineralesSinEcosistemaBase = minerales.filter((m) => !mineralesAsignadosIds.has(m.id));
  const floraSinEcosistema = qCriatura
    ? floraSinEcosistemaBase.filter((f) => f.nombre?.toLocaleLowerCase("es").includes(qCriatura))
    : floraSinEcosistemaBase;
  const mineralesSinEcosistema = qCriatura
    ? mineralesSinEcosistemaBase.filter((m) => m.nombre?.toLocaleLowerCase("es").includes(qCriatura))
    : mineralesSinEcosistemaBase;

  // Una criatura "tiene ecosistema" si algún ecosistema de la base la lista
  // en la tabla puente ecosistema_criaturas.
  const criaturaTieneEcosistema = (criaturaId: string) =>
    ecosistemas.some((e) => criaturaIdsDeEcosistema(e.id).includes(criaturaId));

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

  // Un ecosistema "tiene contenido" si tiene al menos una criatura, una
  // flora o un mineral asociado — antes solo se miraba criaturasDe(e.id),
  // por lo que un ecosistema con solo flora/minerales (sin criaturas)
  // caía en "vacío" y se mostraba como chip sin poder ver sus plantas o
  // minerales hasta que se le agregara una criatura. Bug corregido acá.
  const tieneContenido = (e: Ecosistema) =>
    criaturasDe(e.id).length > 0 || floraDe(e.id).length > 0 || mineralesDe(e.id).length > 0;

  const ecosistemasOrdenados = [...ecosistemasVisibles].sort(
    (a, b) => criaturasDe(b.id).length - criaturasDe(a.id).length,
  );
  const ecosistemasConCriaturas = ecosistemasOrdenados.filter(tieneContenido);
  const ecosistemasVacios = ecosistemasOrdenados.filter((e) => !tieneContenido(e));

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
  // altura total de la card sin medir el DOM. También suma el bloque de
  // chips de flora/minerales cuando existe (antes se ignoraba, así que un
  // ecosistema con solo flora/minerales medía altura 0 de contenido y
  // rompía el layout masonry).
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
    const zoneId = `criatura:${criatura.id}`;
    const esZonaDrop = !!onMoverPersonaje;
    const dropHandlers = esZonaDrop
      ? dragPersonaje.dropHandlers(zoneId, (personajeId) =>
          onMoverPersonaje!(personajeId, criatura.nombre),
        )
      : {};
    const dropActive = esZonaDrop && dragPersonaje.esZonaActiva(zoneId);

    if (!mostrarPersonajes) {
      // Vista colapsada: solo el chip de la criatura + contador, sin grilla
      // de personajes — el toggle "Mostrar personajes" está apagado.
      return (
        <div key={criatura.id} className="w-fit shrink-0">
          <div className="flex items-center gap-1">
            <NodoTitulo
              label={criatura.nombre}
              variant="criatura"
              maxWidthPx={160}
              dragProps={
                onAsignarCriaturaAEcosistema ? dragCriatura.dragHandlers(criatura.id) : undefined
              }
              onClick={() => abrirPanel("criatura", criatura.id)}
              onCreate={onCreatePersonaje ? () => onCreatePersonaje(criatura) : undefined}
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

    const maxCols = anchoMaxDisponible
      ? Math.max(1, Math.floor((anchoMaxDisponible + gapPx) / (itemSize + gapPx)))
      : 6;
    const cols = Math.min(Math.max(habitantes.length, 1), 6, maxCols);
    const anchoPx = Math.max(cols * itemSize + (cols - 1) * gapPx, 90);

    return (
      <div
        key={criatura.id}
        {...dropHandlers}
        className={`${vacia ? "w-fit shrink-0" : "shrink-0"} rounded-lg transition-colors ${
          dropActive ? "ring-2 ring-accent/60 bg-accent/5" : ""
        }`}
        style={vacia ? undefined : { width: anchoPx }}
      >
        <NodoTitulo
          label={criatura.nombre}
          variant="criatura"
          maxWidthPx={vacia ? 140 : anchoPx}
          dragProps={
            onAsignarCriaturaAEcosistema ? dragCriatura.dragHandlers(criatura.id) : undefined
          }
          onClick={() => abrirPanel("criatura", criatura.id)}
          onCreate={onCreatePersonaje ? () => onCreatePersonaje(criatura) : undefined}
        />
        {vacia ? (
          <div className="mt-1.5 text-micro text-primary/25">
            {esZonaDrop ? "Soltá un personaje acá" : "Sin personajes"}
          </div>
        ) : (
          <div
            className="mt-2 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${cols}, ${itemSize}px)` }}
          >
            {habitantes.map((p) => (
              <div key={p.id} {...(onMoverPersonaje ? dragPersonaje.dragHandlers(p.id) : {})}>
                <EntityCard
                  nombre={p.nombre}
                  imageUrl={p.img_url}
                  Icon={Users}
                  onClick={() => abrirPanel("personaje", p.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Card de ecosistema individual (idéntica a la de antes, extraída para
  // poder repetirla dentro de cada bloque de bioma sin duplicar el JSX) ────
  const renderTarjetaEcosistema = (eco: Ecosistema) => {
    const zoneId = `eco:${eco.id}`;
    const dropActive = !!onAsignarCriaturaAEcosistema && dragCriatura.esZonaActiva(zoneId);
    const dropHandlers = onAsignarCriaturaAEcosistema
      ? dragCriatura.dropHandlers(zoneId, (criaturaId) =>
          onAsignarCriaturaAEcosistema(criaturaId, eco.id),
        )
      : {};

    return (
      <div
        key={eco.id}
        {...dropHandlers}
        className={`w-full rounded-lg border overflow-hidden transition-colors ${
          dropActive ? "border-accent/50 bg-accent/5" : "border-primary/10"
        }`}
      >
        <div className="px-3 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => setEcosistemaAbierto({ id: eco.id, anchor: e.currentTarget })}
            {...(onAsignarEcosistemaABioma ? dragEcosistema.dragHandlers(eco.id) : {})}
            title={
              onAsignarEcosistemaABioma
                ? `${eco.nombre} — click derecho para mover`
                : eco.nombre
            }
            className={`flex-1 min-w-0 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70 hover:text-accent transition-colors ${
              onAsignarEcosistemaABioma ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          >
            {eco.nombre}
          </button>
          <EcosistemaExtrasIcono
            items={floraDe(eco.id)}
            Icon={Leaf}
            label="Flora"
            onOpenItem={(id) => abrirPanel("flora", id)}
          />
          <EcosistemaExtrasIcono
            items={mineralesDe(eco.id)}
            Icon={Gem}
            label="Minerales"
            onOpenItem={(id) => abrirPanel("mineral", id)}
          />
        </div>
        <div className="px-3 pb-3 flex flex-wrap gap-6">
          {criaturasDe(eco.id).length === 0 && onAsignarCriaturaAEcosistema && (
            <div className="text-micro text-primary/25">Soltá una criatura acá</div>
          )}
          {criaturasDe(eco.id).map((c) => renderCriaturaCard(c, disponibleColumna))}
        </div>
      </div>
    );
  };

  // ── Vista "por especie" (ojo ON): todas las criaturas con sus personajes,
  // sin agrupar por ecosistema. Se recorren todas las criaturas de la base
  // (con o sin personajes) ordenadas por cantidad de habitantes.
  const criaturasPorEspecieOrdenadas = [...criaturasBase]
    .filter((c) => {
      if (!qCriatura) return true;
      return (
        c.nombre?.toLocaleLowerCase("es").includes(qCriatura) ||
        personajesDe(c.nombre).some((p) => p.nombre?.toLocaleLowerCase("es").includes(qCriatura))
      );
    })
    .sort((a, b) => totalDe(b) - totalDe(a));
  const criaturasPorEspecieConPersonajes = criaturasPorEspecieOrdenadas.filter((c) => totalDe(c) > 0);
  const criaturasPorEspecieVacias = criaturasPorEspecieOrdenadas.filter((c) => totalDe(c) === 0);

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
        <div className="flex items-center gap-1.5 shrink-0">
          {descargarDatosBoton}
          <AñadirDropdown
            onCreateCriatura={onCreateCriatura}
            creatingCriatura={creatingCriatura}
            onCreateEcosistema={handleCreateEcosistema}
            creatingEcosistema={creatingEcosistema}
            onCreateBioma={handleCreateBioma}
            creatingBioma={creatingBioma}
            onCreateFlora={onCreateFlora}
            creatingFlora={creatingFlora}
            onCreateMineral={onCreateMineral}
            creatingMineral={creatingMineral}
          />
        </div>
      </div>

      {mostrarPersonajes ? (
        // ── Ojo ON: Personajes agrupados por especie (criatura), sin
        // ecosistema — vista plana, análoga a antes pero sin el nivel
        // de Ecosistema por encima.
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-6">
            {criaturasPorEspecieConPersonajes.map((c) => renderCriaturaCard(c))}
          </div>

          {(totalSinCriatura > 0 || criaturasPorEspecieVacias.length > 0) && (
            <div>
              <div className="h-px mb-3 bg-primary/10" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {totalSinCriatura > 0 ? (
                  <div
                    {...(onMoverPersonaje
                      ? dragPersonaje.dropHandlers("sin-criatura-global", (personajeId) =>
                          onMoverPersonaje(personajeId, null),
                        )
                      : {})}
                    className={`w-full rounded-lg border overflow-hidden transition-colors ${
                      onMoverPersonaje && dragPersonaje.esZonaActiva("sin-criatura-global")
                        ? "border-accent/50 bg-accent/5"
                        : "border-primary/10"
                    }`}
                  >
                    <div className="px-3 py-3 flex items-center gap-2">
                      <span className="flex-1 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
                        Sin criatura
                      </span>
                    </div>
                    <div className="px-3 pb-3">
                      {personajesSinCriatura.length === 0 ? (
                        <div className="text-micro text-primary/25">
                          {onMoverPersonaje ? "Soltá un personaje acá" : "Sin personajes"}
                        </div>
                      ) : (
                        <div
                          className="grid gap-1"
                          style={{
                            gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
                          }}
                        >
                          {personajesSinCriatura.map((p) => (
                            <div key={p.id} {...(onMoverPersonaje ? dragPersonaje.dragHandlers(p.id) : {})}>
                              <EntityCard
                                nombre={p.nombre}
                                imageUrl={p.img_url}
                                Icon={Users}
                                onClick={() => abrirPanel("personaje", p.id)}
                              />
                            </div>
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

                {criaturasPorEspecieVacias.length > 0 ? (
                  <div className="w-full rounded-lg border border-primary/10 overflow-hidden">
                    <div className="px-3 py-3 flex items-center gap-2">
                      <span className="flex-1 truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
                        Criaturas sin personajes
                      </span>
                    </div>
                    <div className="px-3 pb-3">
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                        }}
                      >
                        {criaturasPorEspecieVacias.map((criatura) => (
                          <div
                            key={criatura.id}
                            {...(onMoverPersonaje
                              ? dragPersonaje.dropHandlers(`criatura:${criatura.id}`, (personajeId) =>
                                  onMoverPersonaje(personajeId, criatura.nombre),
                                )
                              : {})}
                          >
                            <NodoTitulo
                              fill
                              variant="criatura"
                              label={criatura.nombre}
                              dropActive={
                                !!onMoverPersonaje &&
                                dragPersonaje.esZonaActiva(`criatura:${criatura.id}`)
                              }
                              onClick={() => abrirPanel("criatura", criatura.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            </div>
          )}

          {criaturasPorEspecieOrdenadas.length === 0 && totalSinCriatura === 0 && (
            <div className="py-6 text-xs text-primary/25 text-center">
              Sin criaturas todavía
            </div>
          )}
        </div>
      ) : (
        // ── Ojo OFF: Criaturas, flora y minerales agrupados por ecosistema,
        // sin personajes — misma jerarquía Ecosistema → Criatura de antes,
        // pero las cards de criatura nunca muestran la grilla de habitantes.
        <div className="flex flex-col gap-8">
          {/* Nivel 1 (medida): el ref de medida de ancho vive siempre acá,
              en un contenedor invisible de altura 0, para no perder el
              ancho ya calculado del contenedor sin importar si el masonry
              de ecosistemas se renderiza agrupado por bioma o no. */}
          <div ref={containerRef} className="h-0 overflow-hidden" aria-hidden />

          {/* Bloque de masonry de un conjunto de ecosistemas — misma lógica
              de columnas para todos los casos, solo cambia el subconjunto
              de `columna` de entrada. Extraído para poder repetirlo una vez
              por Bioma sin duplicar el JSX de cada card de ecosistema. */}
          {biomas.length > 0
            ? // Agrupado por Bioma: un bloque por cada bioma que tenga AL
              // MENOS un ecosistema (con o sin contenido) — antes solo se
              // listaban los biomas cuyos ecosistemas tenían criaturas, así
              // que un bioma sin ecosistemas con criaturas (aunque tuviera
              // ecosistemas vacíos, o incluso ningún ecosistema) desaparecía
              // por completo de la vista. Ahora:
              //  - Un bioma con ecosistemas (con o sin contenido) muestra su
              //    masonry de cards + los ecosistemas vacíos como chips.
              //  - Un bioma sin ningún ecosistema se muestra igual, como
              //    chip de bioma sin contenido debajo.
              // + "Sin bioma" al final para ecosistemas huérfanos.
              [
                ...biomas.map((bioma) => ({
                  key: bioma.id,
                  label: bioma.nombre,
                  esBioma: true,
                  todosEcosistemas: ecosistemasOrdenados.filter((e) => e.bioma_id === bioma.id),
                  columnas: distribuirEnColumnas(
                    ecosistemasConCriaturas.filter((e) => e.bioma_id === bioma.id),
                  ),
                  vacios: ecosistemasVacios.filter((e) => e.bioma_id === bioma.id),
                })),
                {
                  key: "__sin_bioma__",
                  label: "Sin bioma",
                  esBioma: false,
                  todosEcosistemas: ecosistemasOrdenados.filter(
                    (e) => !e.bioma_id || !biomas.some((b) => b.id === e.bioma_id),
                  ),
                  columnas: distribuirEnColumnas(
                    ecosistemasConCriaturas.filter(
                      (e) => !e.bioma_id || !biomas.some((b) => b.id === e.bioma_id),
                    ),
                  ),
                  vacios: ecosistemasVacios.filter(
                    (e) => !e.bioma_id || !biomas.some((b) => b.id === e.bioma_id),
                  ),
                },
              ]
                // Se descarta un grupo solo si ni siquiera tiene ecosistemas
                // (ni con contenido ni vacíos) — un bioma sin ecosistemas
                // todavía debe verse como chip de bioma vacío, no desaparecer.
                .filter((grupo) => grupo.esBioma || grupo.todosEcosistemas.length > 0)
                .map((grupo) => {
                  const esSinBioma = grupo.key === "__sin_bioma__";
                  const zoneIdBioma = `bioma:${grupo.key}`;
                  const dropActiveBioma =
                    !!onAsignarEcosistemaABioma && dragEcosistema.esZonaActiva(zoneIdBioma);
                  const dropHandlersBioma = onAsignarEcosistemaABioma
                    ? dragEcosistema.dropHandlers(zoneIdBioma, (ecosistemaId) =>
                        onAsignarEcosistemaABioma(ecosistemaId, esSinBioma ? "" : grupo.key),
                      )
                    : {};
                  return (
                  <div key={grupo.key} className="flex flex-col gap-3">
                    <div
                      {...dropHandlersBioma}
                      className={`self-start rounded-md transition-colors ${
                        dropActiveBioma ? "ring-2 ring-accent/60 bg-accent/5" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) =>
                          grupo.key !== "__sin_bioma__" &&
                          setBiomaAbierto({ id: grupo.key, anchor: e.currentTarget })
                        }
                        disabled={grupo.key === "__sin_bioma__"}
                        title={grupo.label}
                        className="flex items-center gap-1.5 px-1 text-micro font-black uppercase tracking-[0.15em] text-primary/50 hover:text-accent transition-colors disabled:hover:text-primary/50 disabled:cursor-default"
                      >
                        <Compass size={11} className="shrink-0 text-accent/50" />
                        {grupo.label}
                      </button>
                    </div>
                    {grupo.todosEcosistemas.length === 0 ? (
                      <div className="text-micro text-primary/25 px-1">Sin ecosistemas</div>
                    ) : (
                      <>
                        {grupo.columnas.some((c) => c.length > 0) && (
                          <div className="flex items-start gap-6">
                            {grupo.columnas.map((columna, colIdx) => (
                              <div
                                key={colIdx}
                                className="flex flex-col gap-6 min-w-0"
                                style={{ width: anchoColumnaMasonry }}
                              >
                                {columna.map((eco) => renderTarjetaEcosistema(eco))}
                              </div>
                            ))}
                          </div>
                        )}
                        {grupo.vacios.length > 0 && (
                          <div
                            className="grid gap-2"
                            style={{
                              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            }}
                          >
                            {grupo.vacios.map((eco) => (
                              <NodoTitulo
                                key={eco.id}
                                fill
                                label={eco.nombre}
                                dragProps={
                                  onAsignarEcosistemaABioma
                                    ? dragEcosistema.dragHandlers(eco.id)
                                    : undefined
                                }
                                onClick={(e) =>
                                  setEcosistemaAbierto({ id: eco.id, anchor: e.currentTarget })
                                }
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  );
                })
            : // Sin biomas cargados: comportamiento anterior, un único
              // masonry plano de todos los ecosistemas con contenido, más
              // los vacíos como chips.
              <>
                {hayEcosistemasConCriaturas && (
                  <div className="flex items-start gap-6">
                    {columnasEcosistemas.map((columna, colIdx) => (
                      <div
                        key={colIdx}
                        className="flex flex-col gap-6 min-w-0"
                        style={{ width: anchoColumnaMasonry }}
                      >
                        {columna.map((eco) => renderTarjetaEcosistema(eco))}
                      </div>
                    ))}
                  </div>
                )}
              </>}

          {/* Criaturas sin ecosistema (mismo patrón "solo criatura" que antes) */}
          {criaturasSinEcoOrdenadas.length > 0 && (
            <div>
              {hayEcosistemasConCriaturas && <div className="h-px mb-2 bg-primary/10" />}
              <div className="mb-2 px-1 text-micro font-bold uppercase tracking-[0.12em] text-primary/40">
                Sin ecosistema
              </div>
              <div className="flex flex-wrap gap-6">
                {criaturasSinEcoOrdenadas.map((c) => renderCriaturaCard(c, disponibleColumna))}
              </div>
            </div>
          )}

          {/* Flora/Minerales sin ecosistema — mismo criterio: una entidad
              recién creada debe seguir siendo visible/clickeable hasta que se
              le asigne un ecosistema desde su propio editor. */}
          {(floraSinEcosistema.length > 0 || mineralesSinEcosistema.length > 0) && (
            <div>
              {(hayEcosistemasConCriaturas || criaturasSinEcoOrdenadas.length > 0) && (
                <div className="h-px mb-2 bg-primary/10" />
              )}
              <div className="mb-2 px-1 text-micro font-bold uppercase tracking-[0.12em] text-primary/40">
                Flora y minerales sin ecosistema
              </div>
              <div className="flex flex-wrap gap-1.5">
                {floraSinEcosistema.map((f) => (
                  <NodoTitulo
                    key={f.id}
                    label={f.nombre}
                    variant="flora"
                    maxWidthPx={160}
                    onClick={() => abrirPanel("flora", f.id)}
                  />
                ))}
                {mineralesSinEcosistema.map((m) => (
                  <NodoTitulo
                    key={m.id}
                    label={m.nombre}
                    variant="mineral"
                    maxWidthPx={160}
                    onClick={() => abrirPanel("mineral", m.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {!hayEcosistemasConCriaturas &&
            ecosistemasVacios.length === 0 &&
            criaturasSinEcoOrdenadas.length === 0 &&
            floraSinEcosistema.length === 0 &&
            mineralesSinEcosistema.length === 0 &&
            biomas.length === 0 && (
              <div className="py-6 text-xs text-primary/25 text-center">
                Sin criaturas todavía
              </div>
            )}
        </div>
      )}
      {dragCriatura.overlay}
      {dragPersonaje.overlay}
      {dragEcosistema.overlay}

      {ecosistemaAbierto &&
        ecosistemas.some((e) => e.id === ecosistemaAbierto.id) && (
          <PopoverFlotante
            anchor={ecosistemaAbierto.anchor}
            onClose={() => setEcosistemaAbierto(null)}
            width={640}
            maxHeight={560}
            centerVertically
            centerHorizontally
          >
            <EcosistemaPopoverContent
              ecosistemaId={ecosistemaAbierto.id}
              onClose={() => setEcosistemaAbierto(null)}
              onSelectCriatura={(id) => abrirPanel("criatura", id)}
            />
          </PopoverFlotante>
        )}

      {biomaAbierto &&
        biomas.some((b) => b.id === biomaAbierto.id) && (
          <PopoverFlotante
            anchor={biomaAbierto.anchor}
            onClose={() => setBiomaAbierto(null)}
            width={640}
            maxHeight={480}
            centerVertically
            centerHorizontally
          >
            <BiomaPopoverContent biomaId={biomaAbierto.id} onClose={() => setBiomaAbierto(null)} />
          </PopoverFlotante>
        )}
    </div>
  );
}

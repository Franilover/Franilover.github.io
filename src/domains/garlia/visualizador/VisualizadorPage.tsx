"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Atom,
  BarChart3,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Gauge,
  GitBranch,
  Layers3,
  Orbit,
  Pause,
  Play,
  Radio,
  RotateCcw,
  SkipForward,
  Sparkles,
  Waypoints,
  Workflow,
  Zap,
} from "lucide-react";

// V2 — conectado a datos reales de Supabase. Cada sección lee de los
// hooks/tipos ya usados por el resto del sistema (fisica/useFisica,
// elementos/useCompuestos, materiales/useMateriales, etc.) en vez de
// fixtures locales. Las pocas piezas sin hook propio (particulas con
// ejes_fundamentales, runas, propiedades_derivadas) viven en
// useVisualizadorData.ts, mismo patrón useSupabaseData que todo lo demás.
// Nada de física/química se calcula acá: solo se lee y se presenta.

import {
  contarLetrasDeIum,
  contarLetrasDeOris,
  particulasDeIum,
  particulasDeOris,
  type FilaIum,
} from "@/domains/garlia/fisica/types";
import { useOrisConIums } from "@/domains/garlia/fisica/useOrisConIums";
import { useIums } from "@/domains/garlia/fisica/useFisica";

import { useMateriales } from "@/domains/garlia/materiales/useMateriales";
import {
  PropiedadesFisicasGenerico,
  propiedadesCalculadasGenerico,
} from "@/domains/garlia/_shared/GridPropiedadesCalculadas";

import { useEstructuras } from "@/domains/garlia/elementos/useEstructuras";
import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useProcesos } from "@/domains/garlia/elementos/useProcesos";
import { propiedadesCalculadasDeCompuesto, type Compuesto, type Elemento } from "@/domains/garlia/elementos/types";

import { RunaThumbnail } from "@/domains/garlia/runas/RunaThumbnail";

import {
  useParticulasCompletas,
  usePropiedadesDerivadas,
  useRunasCatalogo,
  useValoresDerivadosDeEntidad,
  type EntidadTipoDerivada,
} from "./useVisualizadorData";

// ─── Vertical slice: lenguaje visual reutilizable + rutas Física/Alquimia ──
// Nueva sección "rutas" (no toca las 12 secciones existentes arriba).
import { StructureCanvas, type CanvasColumn, type CanvasEdge } from "./StructureCanvas";
import { Inspector, type InspectorEntity } from "./Inspector";
import { TraceView, type TraceStep } from "./TraceView";
import { type Perspectiva } from "./PerspectivaSwitcher";
import { useEnlaceRoute, type EnlaceResuelto } from "./routes/useEnlaceRoute";
import { useFisicaRoute } from "./routes/useFisicaRoute";
import { useAlquimiaRoute } from "./routes/useAlquimiaRoute";
import { useCompuestoRoute } from "./routes/useCompuestoRoute";
import {
  useCompatibilidadRoute,
  type EstadoCompatibilidad,
  type NodoCompatibilidad,
  type VecinoCompatibilidad,
} from "./routes/useCompatibilidadRoute";
import { useInteraccionRoute } from "./routes/useInteraccionRoute";
import { CompatibilidadNetwork } from "./CompatibilidadNetwork";
import { contarLetrasNodo } from "./NodeVisuals";
// AtomoVisual: el gráfico REAL y completo de un Elemento (núcleo + capa
// media + capa externa como órbitas concéntricas, con sus partículas
// reales distribuidas y toggle inicial/ATS propio) — ya existía en
// elementos/ElementoEditor.tsx. Se trae acá tal cual, mismo criterio que
// ParticulaVisual/IumVisual desde fisica/: reusar el visor real en vez de
// mantener un dibujo propio (ElementoNodo) en NodeVisuals.tsx.
import { AtomoVisual } from "@/domains/garlia/elementos/ElementoEditor";
import { TriangleATS, type EntidadATS } from "./TriangleATS";
// Componente "de afuera" del visualizador (fisica/), el diseño original de
// Partícula con letras dentro de tercios de color — pedido explícito de
// reusarlo en la tab Rutas en vez de ParticulaNodo (el círculo sin letras
// que se creó de cero para VIS-01). Mismo dato de entrada (formula), solo
// cambia qué SVG dibuja.
import { ParticulaVisual, IumVisual } from "@/domains/garlia/fisica/ParticulaVisual";

// SectionKey: se mantienen las 15 keys viejas (ya tienen render implementado
// más abajo, active === "...") y se agregan keys nuevas para los VIS que
// Supabase (visualizador_estado, fuente de verdad) ya tiene registrados pero
// todavía no tienen sección propia — esas rinden un placeholder "próximamente"
// hasta que se diseñen. Nada se inventa: nombre y VIS-id vienen 1:1 de Supabase.
type SectionKey =
  // ya implementadas
  | "oris_ruta"
  | "elementos_ruta"
  | "compuestos_ruta"
  | "ats"
  | "material"
  | "structure"
  | "compatibilidad"
  | "interaccion"
  | "reactivity"
  | "energy"
  | "electric"
  | "information"
  | "oris"
  | "runas"
  | "process"
  // pendientes de diseño (placeholder) — nombre real de Supabase
  | "comparacion" // VIS-18
  | "propagacion" // VIS-06
  | "tiempo" // VIS-16
  | "elEnlace" // VIS-19
  | "mapaUniversal" // VIS-15
  | "laboratorio" // VIS-17
  | "celulasTejido" // VIS-11
  | "tejidoOrgano" // VIS-12
  | "organoOrganismo" // VIS-13
  | "organismoReinoMundo"; // VIS-14

type NavGroup = {
  group: string;
  items: { key: SectionKey; label: string; visId: string; icon: React.ReactNode; implementado: boolean }[];
};

// Agrupación acordada: 7 grupos temáticos de sidebar, cruzados contra las
// categorías reales de visualizador_estado en Supabase. VIS-09 queda en
// Dinámica (así está categorizado en Supabase); Biología va visible al
// final, sin colapsar, aunque su desarrollo esté pospuesto.
const navGroups: NavGroup[] = [
  {
    group: "Constitución",
    items: [
      { key: "oris_ruta", label: "Oris", visId: "VIS-01", icon: <GitBranch size={15} />, implementado: true },
      { key: "elementos_ruta", label: "Elementos", visId: "VIS-01", icon: <GitBranch size={15} />, implementado: true },
      { key: "compuestos_ruta", label: "Compuestos", visId: "VIS-01", icon: <GitBranch size={15} />, implementado: true },
      { key: "ats", label: "Triángulo A/T/S", visId: "VIS-02", icon: <Orbit size={15} />, implementado: true },
    ],
  },
  {
    group: "Relaciones",
    items: [
      { key: "compatibilidad", label: "Compatibilidad → Enlace", visId: "VIS-04", icon: <Waypoints size={15} />, implementado: true },
      { key: "elEnlace", label: "El Enlace", visId: "VIS-19", icon: <Waypoints size={15} />, implementado: true },
    ],
  },
  {
    group: "Propiedades Físicas",
    items: [
      { key: "structure", label: "Material → Estructura", visId: "VIS-10", icon: <Atom size={15} />, implementado: true },
      { key: "material", label: "Perfil físico de Material", visId: "VIS-21", icon: <Gauge size={15} />, implementado: true },
      { key: "reactivity", label: "Perfil Reactivo", visId: "VIS-22", icon: <FlaskConical size={15} />, implementado: true },
      { key: "comparacion", label: "Comparación", visId: "VIS-18", icon: <BarChart3 size={15} />, implementado: false },
    ],
  },
  {
    group: "Dinámica",
    items: [
      { key: "interaccion", label: "Interacción", visId: "VIS-05", icon: <Play size={15} />, implementado: true },
      { key: "process", label: "Proceso: Entrada→Transf.→Salida", visId: "VIS-25", icon: <Workflow size={15} />, implementado: true },
      { key: "energy", label: "Energía de Enlace", visId: "VIS-23", icon: <BarChart3 size={15} />, implementado: true },
      { key: "electric", label: "Carga Eléctrica", visId: "VIS-24", icon: <Zap size={15} />, implementado: true },
      // Propagación (VIS-06) y Tiempo (VIS-16) están activos en Supabase pero
      // sin sección propia en este archivo todavía — placeholder, no se inventa UI.
      { key: "propagacion", label: "Propagación", visId: "VIS-06", icon: <Radio size={15} />, implementado: false },
      { key: "tiempo", label: "Tiempo", visId: "VIS-16", icon: <Radio size={15} />, implementado: false },
      { key: "information", label: "Información (sin dato)", visId: "VIS-PENDIENTE-INFO", icon: <Radio size={15} />, implementado: false },
    ],
  },
  {
    group: "Oris / Runas",
    items: [
      { key: "oris", label: "Oris", visId: "VIS-08", icon: <Sparkles size={15} />, implementado: true },
      { key: "runas", label: "Runa → Mecanismo → Fenómeno", visId: "VIS-09", icon: <CircleDot size={15} />, implementado: true },
    ],
  },
  {
    group: "Atlas / Sandbox",
    items: [
      { key: "mapaUniversal", label: "Mapa Universal", visId: "VIS-15", icon: <GitBranch size={15} />, implementado: false },
      { key: "laboratorio", label: "Laboratorio", visId: "VIS-17", icon: <FlaskConical size={15} />, implementado: false },
    ],
  },
  {
    group: "Biología",
    items: [
      { key: "celulasTejido", label: "Células → Tejido", visId: "VIS-11", icon: <Layers3 size={15} />, implementado: false },
      { key: "tejidoOrgano", label: "Tejido → Órgano", visId: "VIS-12", icon: <Layers3 size={15} />, implementado: false },
      { key: "organoOrganismo", label: "Órgano → Organismo", visId: "VIS-13", icon: <Layers3 size={15} />, implementado: false },
      { key: "organismoReinoMundo", label: "Organismo → Reino → Mundo", visId: "VIS-14", icon: <Layers3 size={15} />, implementado: false },
    ],
  },
];

// navItems plano: se mantiene para no romper nada que ya lo recorra tal cual.
const navItems = navGroups.flatMap((g) => g.items);

// ─── UI primitives — pass de densidad: mismo lenguaje visual, más aire.
// Todos estos se reutilizan decenas de veces en las 13 secciones, así que
// ajustarlos acá sube la respiración de todo el visualizador de una vez,
// sin tener que tocar cada sección individualmente.

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary/50">
      {children}
    </span>
  );
}

function FlowNode({
  title,
  subtitle,
  tone = "default",
  onClick,
}: {
  title: string;
  subtitle?: string;
  tone?: "default" | "accent";
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`min-w-[128px] rounded-xl border px-4 py-4 text-left transition-colors ${
        tone === "accent" ? "border-primary/30" : "border-primary/10"
      } ${onClick ? "hover:border-primary/30 cursor-pointer" : ""}`}
    >
      <p className="text-sm font-black text-primary/80">{title}</p>
      {subtitle ? <p className="mt-1.5 text-[11px] leading-4 text-primary/40">{subtitle}</p> : null}
    </Comp>
  );
}

function Arrow() {
  return <ChevronRight className="shrink-0 text-primary/25" size={20} />;
}

function MiniBarChart({ values }: { values: { label: string; value: number }[] }) {
  return (
    <div className="space-y-4">
      {values.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/45">
            <span>{item.label}</span>
            <span>{item.value.toFixed(2)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${Math.max(0, Math.min(1, item.value)) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barra centrada en cero para ejes que van de -N a +N (ejes_fundamentales
 *  de Partícula). A diferencia de MiniBarChart (0..1), acá el 0 es el
 *  centro visual y positivo/negativo van a cada lado. */
function BarraDivergente({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(-1, Math.min(1, value / max)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/45">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full">
        <div className="absolute left-1/2 top-0 h-full w-px bg-primary/20" />
        {pct >= 0 ? (
          <div
            className="absolute left-1/2 top-0 h-full rounded-r-full bg-primary/60"
            style={{ width: `${(pct / 1) * 50}%` }}
          />
        ) : (
          <div
            className="absolute right-1/2 top-0 h-full rounded-l-full bg-primary/60"
            style={{ width: `${(-pct / 1) * 50}%` }}
          />
        )}
      </div>
    </div>
  );
}

/** Selector horizontal de "chips" para elegir una entidad real de un
 *  catálogo — mismo patrón repetido en Material/Estructura/Reactividad/
 *  Oris/Runas/Proceso: evita reimplementar un <select> feo por sección y
 *  hace el visualizador tangiblemente más interactivo (clic para explorar). */
function ChipSelector<T>({
  items,
  active,
  getKey,
  getLabel,
  onSelect,
}: {
  items: T[];
  active: T | null;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const selected = active ? getKey(active) === getKey(item) : false;
        return (
          <button
            key={getKey(item)}
            type="button"
            onClick={() => onSelect(item)}
            className={`rounded-full border px-3.5 py-2 text-xs font-black transition-colors ${
              selected
                ? "border-primary/40 text-primary/90"
                : "border-primary/10 text-primary/50 hover:border-primary/25 hover:text-primary/75"
            }`}
          >
            {getLabel(item)}
          </button>
        );
      })}
    </div>
  );
}

function SelectDropdown<T>({
  items,
  active,
  getKey,
  getLabel,
  onSelect,
  placeholder = "Seleccioná un elemento…",
}: {
  items: T[];
  active: T | null;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={active ? getKey(active) : ""}
      onChange={(e) => {
        const found = items.find((item) => getKey(item) === e.target.value);
        if (found) onSelect(found);
      }}
      className="w-full max-w-sm rounded-lg border border-primary/15 bg-transparent px-3.5 py-2.5 text-xs font-black text-primary/85 outline-none transition-colors hover:border-primary/30 focus:border-primary/40"
    >
      {!active ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {items.map((item) => (
        <option key={getKey(item)} value={getKey(item)} className="bg-[var(--bg-main)] text-primary">
          {getLabel(item)}
        </option>
      ))}
    </select>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-primary/10 p-5 text-xs font-bold text-primary/35">
      <span className="h-2 w-2 animate-pulse rounded-full bg-primary/40" />
      Cargando datos reales desde Supabase…
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-primary/15 p-5 text-xs leading-5 text-primary/40">
      {children}
    </div>
  );
}


// ─── Valores derivados reales: tarjeta reusable para Material/Estructura/Compuesto ──

function TarjetaValoresDerivados({
  tipo,
  entidadId,
  entidadNombre,
}: {
  tipo: EntidadTipoDerivada;
  entidadId: string | null;
  entidadNombre?: string;
}) {
  const { items, loading } = useValoresDerivadosDeEntidad(tipo, entidadId);

  if (!entidadId) return <EmptyRow>Selecciona una entidad para ver sus propiedades derivadas reales.</EmptyRow>;
  if (loading) return <LoadingRow />;
  if (items.length === 0)
    return (
      <EmptyRow>
        {entidadNombre ?? "Esta entidad"} no tiene valores calculados en valores_propiedades_derivadas todavía.
      </EmptyRow>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((v) => (
        <div
          key={v.id}
          className="rounded-xl border border-primary/10 p-4"
          title={v.propiedad.descripcion ?? undefined}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{v.propiedad.nombre}</p>
            <span className="shrink-0 text-sm font-black tabular-nums text-primary/85">
              {Number.isFinite(v.valor) ? v.valor.toLocaleString("es-CL", { maximumFractionDigits: 4 }) : "—"}
            </span>
          </div>
          {v.propiedad.formula ? (
            <p className="mt-2.5 truncate text-xs font-bold text-primary/55" title={v.propiedad.formula}>
              {v.propiedad.formula}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─── Sección "Rutas" — vertical slice: Física vs Alquimia ──────────────────
// Deliberadamente separada de VisualizadorPage: encapsula sus propios hooks
// de ruta (useFisicaRoute/useAlquimiaRoute) para no mezclar su estado con
// las 12 secciones existentes. No calcula nada — solo arma nodos/edges/trace
// a partir de lo que los hooks de ruta ya resolvieron.

function RutaFisicaCanvas({
  route,
  hoverId,
  setHoverId,
  selectedNodeId,
  onSelectNode,
}: {
  route: ReturnType<typeof useFisicaRoute>;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const {
    oris,
    orisSel,
    setOrisSelId,
    iumPorId,
    particulasDelOrisSel,
    iumSel,
    setIumSelId,
    particulasDelIumSel,
  } = route;

  // Zoom: click en un nodo IUM entra al nivel Ium → Partículas propias del
  // Ium (particulasDelIumSel, ya resuelto por el hook, sin recalcular
  // nada). "iumSel" viene del mismo hook — reutiliza su propio estado en
  // vez de duplicar un id de zoom acá.
  const enZoomIum = Boolean(iumSel);

  const columns: CanvasColumn[] = useMemo(() => {
    if (enZoomIum && iumSel) {
      // Vista con zoom: Partículas del Ium (nivel 1) → Ium (nivel 2).
      const particulaNodesZoom = particulasDelIumSel.map((p, i) => ({
        id: `particula-ium-${i}`,
        label: p.nombre,
        sublabel: p.formula,
        hideBorder: true,
        visual: <ParticulaVisual formula={p.formula} size={78} />,
      }));
      const iumNodeZoom = {
        id: `ium-${iumSel.id}`,
        label: iumSel.nombre,
        sublabel: "Ium seleccionado",
        tone: "accent" as const,
        // Sin borde de nodo (pedido explícito para Rutas) + sin el botón
        // de alternar modo. Al no recortarse contra el trazo del círculo
        // ni el margen del foreignObject, el size interno sube de 52→64
        // para aprovechar el espacio ganado.
        hideBorder: true,
        visual: <IumVisual particulas={particulasDelIumSel} size={120} showToggle={false} />,
      };
      return [
        { id: "particulas", label: "Partículas del Ium", nodes: particulaNodesZoom },
        { id: "ium", label: "IUM", nodes: [iumNodeZoom] },
      ];
    }
    if (!orisSel) return [];
    // Nivel 1: partículas reales expandidas del Oris, CONSERVANDO de qué
    // IUM viene cada una (antes se usaba particulasDelOrisSel, que aplana
    // todo en un array sin recordar el origen — por eso todas terminaban
    // conectadas al primer IUM). Se reconstruye acá mismo iterando
    // iums_composicion, igual que hace particulasDeOris internamente, pero
    // sin perder el iumId en el camino — mismo dato, sin agregar cálculo
    // nuevo de dominio.
    const particulaNodes: { id: string; label: string; sublabel: string; visual: React.ReactNode; iumId: string; iumRep: number; particulaIdxEnIum: number; totalParticulasEnIum: number; hideBorder: boolean }[] = [];
    for (const [iumId, cantidadIum] of Object.entries(orisSel.iums_composicion)) {
      const ium = iumPorId[iumId];
      if (!ium || !cantidadIum) continue;
      const particulasDelIum = particulasDeIum(ium);
      for (let rep = 0; rep < cantidadIum; rep++) {
        particulasDelIum.forEach((p, particulaIdxEnIum) => {
          particulaNodes.push({
            id: `particula-${iumId}-${particulaNodes.length}`,
            label: p.nombre,
            sublabel: p.formula,
            hideBorder: true,
            visual: <ParticulaVisual formula={p.formula} size={78} />,
            iumId,
            // Instancia real del IUM a la que pertenece esta partícula —
            // antes se perdía este dato y todos los edges terminaban
            // apuntando a la instancia "-0" del IUM aunque hubiera 2+
            // instancias iguales (ej. 2× Fluxor). Con esto cada partícula
            // se conecta a SU propia instancia real.
            iumRep: rep,
            // Posición de esta partícula DENTRO del anillo interno de su
            // propio IumVisual (mismo orden que particulasDeIum, que es
            // el mismo array que IumVisual recibe y recorre) — se usa
            // para que el edge apunte a la partícula exacta dentro del
            // círculo del IUM, no al centro del IUM.
            particulaIdxEnIum,
            totalParticulasEnIum: particulasDelIum.length,
          });
        });
      }
    }
    // Nivel 2: los IUMs reales que componen el Oris (desde iums_composicion).
    // Antes: un solo nodo por IUM con sublabel "N×" agrupando la cantidad.
    // Ahora, mismo criterio que el nivel de Partículas: se expande una
    // instancia por unidad (ej. 3× Fluxor → 3 nodos "Fluxor" separados),
    // así se ven todas las unidades alrededor igual que las partículas.
    // Cada IUM se pinta con IumVisual (componente "de afuera" de fisica/,
    // pedido explícito de reusarlo acá en vez de CentroGravedadNodo).
    // particulasDeIum sigue siendo cálculo de datos, no visual, así que se
    // reusa tal cual: ya expande la composición real.
    const iumNodes: { id: string; label: string; sublabel?: string; hideBorder: boolean; visual: React.ReactNode }[] = [];
    for (const [iumId, cantidad] of Object.entries(orisSel.iums_composicion)) {
      const ium = iumPorId[iumId];
      if (!ium || !cantidad) continue;
      const particulasDelIumActual = particulasDeIum(ium);
      for (let rep = 0; rep < cantidad; rep++) {
        iumNodes.push({
          id: `ium-${iumId}-${rep}`,
          label: ium.nombre,
          hideBorder: true,
          visual: <IumVisual particulas={particulasDelIumActual} size={108} showToggle={false} />,
        });
      }
    }
    // Nivel 3: el Oris seleccionado — mismo tratamiento que un IUM (un
    // Oris es, en el modelo, una bolsa de IUMs que a su vez son bolsas de
    // partículas), con sus partículas ya expandidas. Mismo componente
    // IumVisual — el diseño "de afuera" no distingue IUM de Oris, ambos
    // son "una bolsa de partículas" con el mismo tratamiento visual.
    const orisNode = {
      id: `oris-${orisSel.id}`,
      label: orisSel.nombre,
      sublabel: orisSel.dominio,
      tone: "accent" as const,
      // Subido de 68 → 84 → 96 → 144 → 180: pedido explícito de que la
      // esfera del Oris se vea AÚN más grande que el IUM. El radio real
      // del nodo central (centerR) también sube proporcionalmente vía
      // centerScale más abajo, para que el círculo real crezca junto con
      // el size interno (si no, el size interno crece pero se sigue
      // viendo del mismo tamaño en pantalla, recortado al radio del nodo).
      hideBorder: true,
      visual: <IumVisual particulas={particulasDelOrisSel} size={180} showToggle={false} />,
    };
    return [
      { id: "particulas", label: "Partículas (A/T/S)", nodes: particulaNodes },
      { id: "iums", label: "IUM", nodes: iumNodes },
      { id: "oris", label: "Oris", nodes: [orisNode] },
    ];
  }, [enZoomIum, iumSel, particulasDelIumSel, orisSel, iumPorId, particulasDelOrisSel]);

  // Sin líneas en esta vista (a pedido): ni partícula→IUM ni IUM→Oris. El
  // anillo orbital y la jerarquía visual (Partículas → IUM → Oris) ya
  // comunican la pertenencia sin necesidad de trazos.
  const edges: CanvasEdge[] = useMemo(() => [], []);

  // Click en un nodo: si es un IUM de la vista de conjunto, hace zoom.
  // El id real es `ium-{iumId}-{rep}` (una instancia expandida) — el
  // zoom es por IUM (no por instancia), así que se descarta el sufijo
  // "-{rep}" y se queda solo con el iumId real.
  function handleSelectNode(nodeId: string) {
    if (!enZoomIum && nodeId.startsWith("ium-")) {
      const sinPrefijo = nodeId.slice("ium-".length);
      const iumId = sinPrefijo.slice(0, sinPrefijo.lastIndexOf("-"));
      setIumSelId(iumId || sinPrefijo);
      return;
    }
    onSelectNode(nodeId);
  }

  return (
    <>
      {route.loading ? <LoadingRow /> : route.empty ? <EmptyRow>No hay Oris cargados en Supabase todavía.</EmptyRow> : null}
      {!route.loading && oris.length > 0 ? (
        <>
          {enZoomIum ? (
            <button
              type="button"
              onClick={() => setIumSelId(null)}
              className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/15 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary/60 hover:border-primary/30 hover:text-primary/85"
            >
              <ChevronRight className="rotate-180" size={12} />
              Volver a {orisSel?.nombre ?? "Oris"}
            </button>
          ) : (
            <ChipSelector
              items={oris}
              active={orisSel}
              getKey={(o) => o.id}
              getLabel={(o) => o.nombre}
              onSelect={(o) => {
                setOrisSelId(o.id);
                setIumSelId(null);
              }}
            />
          )}
          <div className="mt-5 rounded-2xl p-5">
            <StructureCanvas
              columns={columns}
              edges={edges}
              selectedNodeId={
                enZoomIum
                  ? (iumSel ? `ium-${iumSel.id}` : null)
                  : (selectedNodeId ?? (orisSel ? `oris-${orisSel.id}` : null))
              }
              onHoverNode={setHoverId}
              onSelectNode={handleSelectNode}
              highlightedNodeIds={hoverId ? [hoverId] : []}
              // Pedido explícito: en Rutas los círculos de Partícula/IUM/Oris
              // se ven más grandes que en el resto de perspectivas — 1.5×
              // solo para esta instancia del canvas (Alquimia y otras vistas
              // no pasan nodeScale, quedan en el tamaño base = 1).
              nodeScale={1.5}
              // El Oris (centro) además se ve AÚN más grande que los IUM
              // orbitantes — 1.4× extra compuesto sobre el nodeScale de
              // arriba, solo aplica al nodo central.
              centerScaleExtra={1.4}
            />
          </div>
        </>
      ) : null}
    </>
  );
}

function RutaAlquimiaCanvas({
  route,
  hoverId,
  setHoverId,
  selectedNodeId,
  onSelectNode,
}: {
  route: ReturnType<typeof useAlquimiaRoute>;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const { elementos, elementoSel, setElementoSelId } = route;

  const columns: CanvasColumn[] = useMemo(() => {
    if (!elementoSel) return [];
    // Una sola columna: el Elemento con su AtomoVisual. Se sacó la columna
    // "Capa" (núcleo/media/externa) con sus edges hacia el centro — el
    // propio AtomoVisual ya dibuja esas 3 capas como órbitas concéntricas
    // puertas adentro, así que los nodos + líneas de afuera repetían la
    // misma información en dos lenguajes visuales distintos a la vez.
    const elementoNode = {
      id: `elemento-${elementoSel.id}`,
      label: elementoSel.nombre,
      sublabel: elementoSel.simbolo,
      tone: "accent" as const,
      hideBorder: true,
      visual: <AtomoVisual elemento={elementoSel} className="w-full aspect-square h-auto" />,
    };
    return [{ id: "elemento", label: "Elemento", nodes: [elementoNode] }];
  }, [elementoSel]);

  return (
    <>
      {route.loading ? <LoadingRow /> : route.empty ? <EmptyRow>No hay Elementos cargados en Supabase todavía.</EmptyRow> : null}
      {!route.loading && elementos.length > 0 ? (
        <>
          <SelectDropdown
            items={elementos}
            active={elementoSel}
            getKey={(e) => e.id}
            getLabel={(e) => `${e.simbolo} · ${e.nombre}`}
            onSelect={(e) => setElementoSelId(e.id)}
            placeholder="Seleccioná un elemento…"
          />
          <div className="mt-5 rounded-2xl p-5">
            <StructureCanvas
              columns={columns}
              edges={[]}
              selectedNodeId={selectedNodeId ?? (elementoSel ? `elemento-${elementoSel.id}` : null)}
              onHoverNode={setHoverId}
              onSelectNode={onSelectNode}
              highlightedNodeIds={hoverId ? [hoverId] : []}
              // Sin orbitantes alrededor: el nodo central puede verse más
              // grande, mismo patrón que el Oris en Física (centerScaleExtra).
              // Subido de 1.6 a 2.2 — junto con fillWidth (canvas a todo el
              // ancho disponible), el átomo llena mejor el espacio en vez de
              // verse como un punto chico rodeado de mucho vacío.
              centerScaleExtra={2.2}
              // Sin anillos, el tamaño interno calculado (size) queda chico
              // y no tiene relación con el espacio real del layout — se deja
              // que el canvas ocupe todo el ancho disponible del contenedor
              // en vez de limitarse a ese valor fijo.
              fillWidth
            />
          </div>
        </>
      ) : null}
    </>
  );
}

// VIS-03 — Elementos → Sitios → Compatibilidad → Enlaces → Estructura →
// Compuesto (docx Parte 4). Mismo criterio que RutaFisicaCanvas/
// RutaAlquimiaCanvas: solo arma columnas/edges a partir de lo que
// useCompuestoRoute ya resolvió, sin decidir compatibilidad ni estructura
// acá — "el frontend no decide que sea compatible; el motor entrega el
// resultado" (docx punto 5).
/** Modo de vista dentro de VIS-03 — docx puntos 11/12: "Modo Ciencia" (panel
 *  de datos completo: elementos/sitios/enlaces/estructura en crudo) vs
 *  "Modo Exploración" (hover/click naturales sobre el canvas, sin panel de
 *  datos de fondo). "El panel nunca debe ser más importante que la
 *  estructura visual" — por eso Ciencia agrega un panel ADEMÁS del canvas,
 *  nunca lo reemplaza. */
type ModoVisComp = "exploracion" | "ciencia";

function ModoCompSwitcher({ value, onChange }: { value: ModoVisComp; onChange: (m: ModoVisComp) => void }) {
  const opciones: { key: ModoVisComp; label: string }[] = [
    { key: "exploracion", label: "Exploración" },
    { key: "ciencia", label: "Ciencia" },
  ];
  return (
    <div className="flex gap-1.5">
      {opciones.map((op) => (
        <button
          key={op.key}
          type="button"
          onClick={() => onChange(op.key)}
          className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
            value === op.key
              ? "border-primary/40 text-primary/90"
              : "border-primary/10 text-primary/45 hover:border-primary/25 hover:text-primary/70"
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}

/** Panel "Modo Ciencia" (docx punto 11) — Elementos/Sitios/Enlaces/Estructura
 *  en crudo, todo lectura directa de lo que route ya resolvió. Se agrega
 *  DEBAJO del canvas, nunca lo reemplaza (regla explícita del docx). */
function PanelModoCiencia({ route }: { route: ReturnType<typeof useCompuestoRoute> }) {
  const { compuestoSel, componentes, enlaces, elementoFocoId, sitiosDelElementoFoco, estructuraNombre } = route;
  if (!compuestoSel) return null;
  const elementoFoco = componentes.find((c) => c.elemento.id === elementoFocoId)?.elemento ?? null;
  return (
    <div className="mt-4 grid gap-4 rounded-2xl border border-primary/10 p-5 sm:grid-cols-4">
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-primary/35">Elementos</p>
        <ul className="mt-2 space-y-1 text-xs text-primary/70">
          {componentes.map((c) => (
            <li key={c.elemento.id}>
              {c.elemento.simbolo} · {c.elemento.nombre} ×{c.cantidad}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-primary/35">Sitios</p>
        {!elementoFoco ? (
          <p className="mt-2 text-xs text-primary/35">Pasá el cursor sobre un elemento.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-primary/70">
            {sitiosDelElementoFoco.length === 0 ? (
              <li className="text-primary/35">Sin sitios calculados.</li>
            ) : (
              sitiosDelElementoFoco.map((s) => (
                <li key={s.id}>
                  #{s.numero_sitio ?? "—"} · {s.tipo} · afinidad {s.afinidad?.toFixed(2) ?? "—"}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-primary/35">Enlaces</p>
        <ul className="mt-2 space-y-1 text-xs text-primary/70">
          {enlaces.length === 0 ? (
            <li className="text-primary/35">Sin enlaces calculados.</li>
          ) : (
            enlaces.map((e) => (
              <li key={e.id}>
                intensidad {e.intensidad?.toFixed(2) ?? "—"} · estabilidad {e.estabilidad?.toFixed(2) ?? "—"}
              </li>
            ))
          )}
        </ul>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-primary/35">Estructura</p>
        <p className="mt-2 text-xs text-primary/70">{estructuraNombre ?? "Sin estructura formalizada."}</p>
      </div>
    </div>
  );
}

/** Comparación de compuestos (docx punto 22): dos StructureCanvas lado a
 *  lado, cada uno con su propia composición/estructura/propiedades reales
 *  — nunca una sola vista fusionada, para no sugerir una relación entre
 *  ambos que el motor no calculó. */
function PanelComparacion({
  route,
  compuestoBId,
  setCompuestoBId,
}: {
  route: ReturnType<typeof useCompuestoRoute>;
  compuestoBId: string | null;
  setCompuestoBId: (id: string | null) => void;
}) {
  const compuestoB = compuestoBId ? route.compuestos.find((c) => c.id === compuestoBId) ?? null : null;
  const propsA = route.compuestoSel ? propiedadesCalculadasDeCompuesto(route.compuestoSel) : [];
  const propsB = compuestoB ? propiedadesCalculadasDeCompuesto(compuestoB) : [];
  const clavesComparadas = ["estabilidad", "rigidez", "flexibilidad", "dureza"];

  return (
    <div className="mt-4 rounded-2xl border border-primary/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">
          Comparar con
        </p>
        <SelectDropdown
          items={route.compuestos.filter((c) => c.id !== route.compuestoSel?.id)}
          active={compuestoB}
          getKey={(c) => c.id}
          getLabel={(c) => (c.simbolo ? `${c.simbolo} · ${c.nombre}` : c.nombre)}
          onSelect={(c) => setCompuestoBId(c.id)}
          placeholder="Elegí un segundo compuesto…"
        />
      </div>
      {!compuestoB ? null : (
        <div className="mt-4 grid grid-cols-2 gap-6">
          {[
            { c: route.compuestoSel, props: propsA },
            { c: compuestoB, props: propsB },
          ].map(({ c, props }, i) => (
            <div key={i}>
              <p className="text-xs font-black text-primary/85">{c?.nombre}</p>
              <p className="mt-0.5 text-[11px] text-primary/45">
                {c?.componentes?.length ?? 0} elemento(s) · {c?.tipo_compuesto ?? "sin clasificar"}
              </p>
              <div className="mt-3 space-y-2">
                {clavesComparadas.map((clave) => {
                  const p = props.find((pp) => pp.clave === clave);
                  return (
                    <div key={clave} className="flex items-center justify-between text-xs">
                      <span className="text-primary/40">{p?.label ?? clave}</span>
                      <span className="text-primary/70">{p?.valor ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RutaCompuestoCanvas({
  route,
  hoverId,
  setHoverId,
  selectedNodeId,
  onSelectNode,
}: {
  route: ReturnType<typeof useCompuestoRoute>;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const { compuestoSel, componentes, enlaces } = route;

  const [modo, setModo] = useState<ModoVisComp>("exploracion");
  const [comparando, setComparando] = useState(false);
  const [compuestoBId, setCompuestoBId] = useState<string | null>(null);
  // Token de reproducción (docx punto 19: botón [ REPRODUCIR FORMACIÓN ]).
  // Cambiar este valor re-dispara la animación de fases del canvas aunque
  // el compuesto activo sea el mismo — ver replayToken en StructureCanvas.
  const [replayToken, setReplayToken] = useState(0);

  // Nivel 1: un nodo por unidad de Elemento en la composición real (ej.
  // A×2, B×1, C×3 → 6 nodos), mismo criterio de expansión 1-instancia-por-
  // unidad que usa RutaFisicaCanvas para Partículas/IUM — así cada enlace
  // real de compuesto_enlaces (que apunta a un elemento_a_id/elemento_b_id
  // puntual, no "a la fórmula en general") tiene un nodo propio al que
  // llegar, sin inventar cuál instancia es cuál cuando hay cantidad > 1.
  const elementoNodos = useMemo(() => {
    const nodos: { id: string; elementoId: string; label: string; sublabel?: string }[] = [];
    for (const { elemento, cantidad } of componentes) {
      for (let rep = 0; rep < cantidad; rep++) {
        nodos.push({
          id: `elemento-${elemento.id}-${rep}`,
          elementoId: elemento.id,
          label: elemento.nombre,
          sublabel: elemento.simbolo,
        });
      }
    }
    return nodos;
  }, [componentes]);

  // Enlaces reales → edges entre la PRIMERA instancia disponible de cada
  // elemento involucrado. compuesto_enlaces no distingue instancia cuando
  // cantidad > 1 (guarda elemento_a_id/elemento_b_id, no un índice de
  // repetición) — se conecta a la primera instancia como representante en
  // vez de inventar a cuál de las N corresponde, y se documenta acá mismo
  // en vez de en un comentario disperso: no es una limitación del canvas,
  // es que ese dato no existe en la fila real.
  const primeraInstanciaPorElemento = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const n of elementoNodos) {
      if (!mapa.has(n.elementoId)) mapa.set(n.elementoId, n.id);
    }
    return mapa;
  }, [elementoNodos]);

  const columns: CanvasColumn[] = useMemo(() => {
    if (!compuestoSel) return [];
    const nodosElementos = elementoNodos.map((n) => ({
      id: n.id,
      label: n.label,
      sublabel: n.sublabel,
      hideBorder: true,
      visual: (
        <AtomoVisual
          elemento={componentes.find((c) => c.elemento.id === n.elementoId)!.elemento}
          className="w-full aspect-square h-auto"
        />
      ),
    }));
    const compuestoNodo = {
      id: `compuesto-${compuestoSel.id}`,
      label: compuestoSel.nombre,
      sublabel: compuestoSel.simbolo ?? compuestoSel.tipo_compuesto ?? undefined,
      tone: "accent" as const,
      hideBorder: true,
      // Sin un "MoleculaVisual" propio: el compuesto emergente se
      // representa por ahora con su símbolo/nombre (mismo criterio del
      // docx punto 23 — "identidad visual reutilizada", el compuesto es
      // ◇/estructura contenedora, no una esfera de elemento) mientras no
      // exista un visual dedicado para esta capa.
      visual: (
        <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-primary/40 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]">
          <span className="text-lg font-black text-primary/85">
            {compuestoSel.simbolo ?? compuestoSel.nombre.slice(0, 3).toUpperCase()}
          </span>
        </div>
      ),
    };
    return [
      { id: "elementos", label: "Elementos", nodes: nodosElementos },
      { id: "compuesto", label: "Compuesto", nodes: [compuestoNodo] },
    ];
  }, [compuestoSel, elementoNodos, componentes]);

  // Edges reales: un enlace de compuesto_enlaces por par de elementos
  // conectados, con weight = intensidad real (docx punto 6: "la línea
  // cambia visualmente [con] mayor intensidad" según el enlace real, no
  // una línea pareja). Sin enlaces (compuesto sin compuesto_enlaces
  // todavía), no se dibuja ninguna línea — nunca se asume conexión.
  const edges: CanvasEdge[] = useMemo(() => {
    if (!compuestoSel) return [];
    const out: CanvasEdge[] = [];
    for (const enlace of enlaces) {
      const nodoA = primeraInstanciaPorElemento.get(enlace.elemento_a_id);
      const nodoB = primeraInstanciaPorElemento.get(enlace.elemento_b_id);
      if (!nodoA || !nodoB) continue;
      out.push({
        fromNodeId: nodoA,
        toNodeId: nodoB,
        weight: enlace.intensidad ?? undefined,
      });
    }
    return out;
  }, [compuestoSel, enlaces, primeraInstanciaPorElemento]);

  return (
    <>
      {route.loading ? <LoadingRow /> : route.empty ? <EmptyRow>No hay Compuestos cargados en Supabase todavía.</EmptyRow> : null}
      {!route.loading && route.compuestos.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SelectDropdown
              items={route.compuestos}
              active={compuestoSel}
              getKey={(c) => c.id}
              getLabel={(c) => (c.simbolo ? `${c.simbolo} · ${c.nombre}` : c.nombre)}
              onSelect={(c) => route.setCompuestoSelId(c.id)}
              placeholder="Seleccioná un compuesto…"
            />
            <div className="flex items-center gap-2.5">
              <ModoCompSwitcher value={modo} onChange={setModo} />
              <button
                type="button"
                onClick={() => setReplayToken((t) => t + 1)}
                className="rounded-full border border-primary/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary/55 transition-colors hover:border-primary/30 hover:text-primary/85"
                title="Reproducir formación"
              >
                ▶ Reproducir formación
              </button>
              <button
                type="button"
                onClick={() => setComparando((v) => !v)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  comparando
                    ? "border-primary/40 text-primary/90"
                    : "border-primary/15 text-primary/55 hover:border-primary/30 hover:text-primary/85"
                }`}
              >
                Comparar
              </button>
            </div>
          </div>
          <div className="mt-5 rounded-2xl p-5">
            <StructureCanvas
              columns={columns}
              edges={edges}
              selectedNodeId={
                selectedNodeId ?? (compuestoSel ? `compuesto-${compuestoSel.id}` : null)
              }
              onHoverNode={(id) => {
                setHoverId(id);
                // Foco de sitios (docx punto 3/18): al pasar el mouse
                // sobre un nodo Elemento, se activa la consulta de sus
                // sitios reales — al salir, se limpia (no queda "pegado").
                if (id?.startsWith("elemento-")) {
                  const nodo = elementoNodos.find((n) => n.id === id);
                  route.setElementoFocoId(nodo?.elementoId ?? null);
                } else if (!id) {
                  route.setElementoFocoId(null);
                }
              }}
              onSelectNode={onSelectNode}
              highlightedNodeIds={hoverId ? [hoverId] : []}
              centerScaleExtra={1.3}
              replayToken={replayToken}
            />
          </div>
          {compuestoSel && !route.loadingEnlaces && enlaces.length === 0 ? (
            <p className="mt-3 text-[11px] text-primary/40">
              Este compuesto todavía no tiene enlaces calculados en Supabase — se muestran solo
              los elementos de su composición, sin conexiones.
            </p>
          ) : null}
          {route.estructuraId ? (
            <p className="mt-3 text-[11px] text-primary/40">
              Estructura real asociada: <span className="text-primary/60">{route.estructuraNombre}</span>
              {route.compuestosDeLaEstructura.length > 1
                ? ` (compartida con ${route.compuestosDeLaEstructura.length - 1} compuesto(s) más)`
                : null}
            </p>
          ) : null}
          {modo === "ciencia" ? <PanelModoCiencia route={route} /> : null}
          {comparando ? (
            <PanelComparacion route={route} compuestoBId={compuestoBId} setCompuestoBId={setCompuestoBId} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

// ─── Sección "Compatibilidad" — VIS-04, tab propia en la sidebar ──────────
// Deliberadamente FUERA de "Rutas": el docx (Parte 5, punto 1) marca que
// VIS-04 tiene identidad visual propia, distinta de la cadena
// jerárquica que ya cubren Física/Alquimia/Química (VIS-01/02/03) — acá no
// hay un "resultado final" que emerge, hay un espacio de posibilidades
// alrededor de una entidad ya existente. Mismo criterio de encapsulación
// que RutasSection: hook propio (useCompatibilidadRoute), sin mezclar
// estado con las demás secciones.

/** Pastilla de estado compatible/posible/incompatible — mismo lenguaje que
 *  usa CompatibilidadNetwork para las líneas (sólida/punteada/sin línea),
 *  reflejado acá en texto para quien no distinga el trazo a simple vista. */
function EstadoCompatPill({ estado }: { estado: EstadoCompatibilidad }) {
  const LABEL: Record<EstadoCompatibilidad, string> = {
    compatible: "Compatible",
    posible: "Posible",
    incompatible: "Incompatible",
  };
  const CLASE: Record<EstadoCompatibilidad, string> = {
    compatible: "border-primary/45 text-primary/90",
    posible: "border-primary/20 text-primary/55",
    incompatible: "border-primary/10 text-primary/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${CLASE[estado]}`}>
      {LABEL[estado]}
    </span>
  );
}

/** Visual de un nodo del mapa — Elemento usa AtomoVisual real (mismo
 *  componente que Química/Alquimia); Compuesto usa el mismo símbolo
 *  circular con iniciales que ya define RutaCompuestoCanvas para el nodo
 *  "compuesto emergente" (no existe un visual de Compuesto dedicado
 *  todavía — se reusa el mismo criterio, no se inventa uno nuevo). */
function NodoCompatVisual({ nodo }: { nodo: NodoCompatibilidad }) {
  if (nodo.tipo === "elemento") {
    return <AtomoVisual elemento={nodo.entidad as Elemento} className="w-full aspect-square h-auto" />;
  }
  const c = nodo.entidad as Compuesto;
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-primary/40 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]">
      <span className="text-sm font-black text-primary/85">
        {c.simbolo ?? c.nombre.slice(0, 3).toUpperCase()}
      </span>
    </div>
  );
}

/** Panel "¿por qué?" (docx punto 7) — aparece al seleccionar un vecino.
 *  Nunca inventa una explicación: si el motor no la dio (afinidad null
 *  porque hay Estado Noble de por medio, o cancelación sin aportes), se
 *  muestra igual el motivo textual que evaluarVecino ya resolvió — nunca
 *  un texto genérico distinto del que realmente calculó el motor. */
function PanelPorQue({ vecino }: { vecino: VecinoCompatibilidad }) {
  return (
    <div className="rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/35">¿Por qué?</p>
        <EstadoCompatPill estado={vecino.estado} />
      </div>
      <p className="mt-2 text-xs font-black text-primary/85">{vecino.nodo.label}</p>
      <p className="mt-3 text-xs leading-5 text-primary/55">{vecino.motivo}</p>
      {vecino.afinidad && vecino.afinidad.aportes.length > 0 ? (
        <div className="mt-4 space-y-1 border-t border-primary/10 pt-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-primary/35">Aportes</p>
          {vecino.afinidad.aportes.slice(0, 4).map((a, i) => (
            <p key={i} className="text-[11px] text-primary/50">
              {a.particula} · {a.cantidad}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Matriz secundaria (docx punto 20) — solo se calcula/renderiza si
 *  vistaGlobal está activa (route ya guarda esa condición: paresGlobales
 *  viene vacío si vistaGlobal es false, evitando el costo O(n²) sin uso). */
function MatrizCompatibilidad({
  route,
  onSaltarAlGrafo,
}: {
  route: ReturnType<typeof useCompatibilidadRoute>;
  onSaltarAlGrafo: (aId: string, bId: string) => void;
}) {
  const catalogo = route.catalogoActivo;
  if (catalogo.length > 24) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-primary/12 p-6 text-center text-xs leading-5 text-primary/35">
        Catálogo demasiado grande para matriz ({catalogo.length} entidades) — usá el grafo de vecinos para explorar.
      </div>
    );
  }
  const estadoDe = (aId: string, bId: string): EstadoCompatibilidad | null => {
    const par = route.paresGlobales.find(
      (p) =>
        (p.a.nodeId === aId && p.b.nodeId === bId) || (p.a.nodeId === bId && p.b.nodeId === aId),
    );
    return par?.estado ?? null;
  };
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl p-5">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="p-1" />
            {catalogo.map((n) => (
              <th key={n.nodeId} className="p-1 text-center font-black uppercase tracking-wide text-primary/40">
                {n.sublabel ?? n.label.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {catalogo.map((fila) => (
            <tr key={fila.nodeId}>
              <td className="p-1 pr-2 text-right font-black uppercase tracking-wide text-primary/40">
                {fila.sublabel ?? fila.label.slice(0, 3)}
              </td>
              {catalogo.map((col) => {
                if (col.nodeId === fila.nodeId) return <td key={col.nodeId} className="p-1 text-center text-primary/15">·</td>;
                const estado = estadoDe(fila.nodeId, col.nodeId);
                const COLOR: Record<EstadoCompatibilidad, string> = {
                  compatible: "bg-primary/50",
                  posible: "bg-primary/20",
                  incompatible: "bg-primary/5",
                };
                return (
                  <td key={col.nodeId} className="p-1 text-center">
                    <button
                      type="button"
                      title={`${fila.label} × ${col.label}${estado ? ` · ${estado}` : ""}`}
                      onClick={() => onSaltarAlGrafo(fila.nodeId, col.nodeId)}
                      className={`h-4 w-4 rounded-sm ${estado ? COLOR[estado] : "bg-transparent"} transition-transform hover:scale-125`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompatibilidadSection() {
  const route = useCompatibilidadRoute();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [nodoSelId, setNodoSelId] = useState<string | null>(null);

  useEffect(() => {
    setNodoSelId(null);
  }, [route.centro?.nodeId, route.tipoActivo]);

  const vecinoSel = useMemo(
    () => (nodoSelId ? route.vecinos.find((v) => v.nodo.nodeId === nodoSelId) ?? null : null),
    [nodoSelId, route.vecinos],
  );

  function handleSelectVecino(nodeId: string) {
    setNodoSelId(nodeId);
    route.setComparandoConId(null);
  }

  function handleSaltarAlGrafo(aId: string, bId: string) {
    route.setVistaGlobal(false);
    route.setCentroId(aId);
    setNodoSelId(bId);
  }

  return (
    <>
      {route.loading ? (
        <LoadingRow />
      ) : route.empty ? (
        <EmptyRow>No hay {route.tipoActivo === "elemento" ? "Elementos" : "Compuestos"} cargados en Supabase todavía.</EmptyRow>
      ) : null}

      {!route.loading && route.catalogoActivo.length > 0 && route.centro ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Tipo de entidad — el docx no distingue "VIS-04 de
                  Elementos" de "VIS-04 de Compuestos", el usuario elige
                  la escala (mismo mapa de posibilidades, distinto catálogo). */}
              <div className="flex gap-1.5">
                {(["elemento", "compuesto"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => route.setTipoActivo(t)}
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      route.tipoActivo === t
                        ? "border-primary/40 text-primary/90"
                        : "border-primary/10 text-primary/45 hover:border-primary/25 hover:text-primary/70"
                    }`}
                  >
                    {t === "elemento" ? "Elementos" : "Compuestos"}
                  </button>
                ))}
              </div>
              <SelectDropdown
                items={route.catalogoActivo}
                active={route.centro}
                getKey={(n) => n.nodeId}
                getLabel={(n) => (n.sublabel ? `${n.sublabel} · ${n.label}` : n.label)}
                onSelect={(n) => route.setCentroId(n.nodeId)}
                placeholder="Seleccioná una entidad…"
              />
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => route.setVistaGlobal(!route.vistaGlobal)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  route.vistaGlobal
                    ? "border-primary/40 text-primary/90"
                    : "border-primary/15 text-primary/55 hover:border-primary/30 hover:text-primary/85"
                }`}
              >
                {route.vistaGlobal ? "Vista de vecinos" : "Vista global"}
              </button>
            </div>
          </div>

          {/* Breadcrumb / historial (docx punto 14/15) — reutiliza el
              mismo lenguaje de "volver a X" que Rutas ya usa para IUM. */}
          {route.historial.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary/40">
              {route.historial.map((paso) => (
                <React.Fragment key={paso.nodeId}>
                  <button
                    type="button"
                    onClick={() => route.retrocederA(paso.nodeId)}
                    className="hover:text-primary/70 transition-colors"
                  >
                    {paso.label}
                  </button>
                  <ChevronRight size={11} className="text-primary/25" />
                </React.Fragment>
              ))}
              <span className="text-primary/80">{route.centro.label}</span>
            </div>
          ) : null}

          {route.vistaGlobal ? (
            <MatrizCompatibilidad route={route} onSaltarAlGrafo={handleSaltarAlGrafo} />
          ) : (
            <>
              <div className="mt-5 grid gap-5 lg:grid-cols-[2.4fr_1fr]">
                <div className="rounded-2xl p-5">
                  <CompatibilidadNetwork
                    centro={route.centro}
                    vecinos={route.vecinos}
                    renderVisual={(n) => <NodoCompatVisual nodo={n} />}
                    selectedNodeId={nodoSelId}
                    onHoverNode={setHoverId}
                    onSelectNode={(id) => {
                      if (id === route.centro?.nodeId) return;
                      // Click en un vecino selecciona (fija el panel
                      // "¿por qué?"); la EXPANSIÓN progresiva (volverlo
                      // centro) queda para el botón explícito de abajo,
                      // para no perder el estado seleccionado con un solo
                      // click accidental (docx no obliga a fusionar ambas
                      // acciones en un mismo gesto).
                      handleSelectVecino(id);
                    }}
                    highlightedNodeIds={hoverId ? [hoverId] : []}
                    soloRutaHaciaId={route.soloRutaHaciaId}
                  />
                  {route.vecinos.length === 0 ? (
                    <EmptyRow>Este catálogo tiene una sola entidad todavía — no hay vecinos que comparar.</EmptyRow>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {vecinoSel ? (
                    <>
                      <PanelPorQue vecino={vecinoSel} />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => route.navegarA(vecinoSel.nodo.nodeId)}
                          className="rounded-full border border-primary/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary/55 transition-colors hover:border-primary/30 hover:text-primary/85"
                        >
                          Explorar {vecinoSel.nodo.label}
                        </button>
                        {vecinoSel.estado !== "incompatible" ? (
                          <button
                            type="button"
                            onClick={() =>
                              route.setComparandoConId(
                                route.comparandoConId === vecinoSel.nodo.nodeId ? null : vecinoSel.nodo.nodeId,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                              route.comparandoConId === vecinoSel.nodo.nodeId
                                ? "border-primary/40 text-primary/90"
                                : "border-primary/15 text-primary/55 hover:border-primary/30 hover:text-primary/85"
                            }`}
                          >
                            Comparar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            route.setSoloRutaHaciaId(
                              route.soloRutaHaciaId === vecinoSel.nodo.nodeId ? null : vecinoSel.nodo.nodeId,
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                            route.soloRutaHaciaId === vecinoSel.nodo.nodeId
                              ? "border-primary/40 text-primary/90"
                              : "border-primary/15 text-primary/55 hover:border-primary/30 hover:text-primary/85"
                          }`}
                        >
                          Solo ruta
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-primary/12 p-6 text-center text-xs leading-5 text-primary/35">
                      Seleccioná un vecino del mapa para ver por qué es compatible, posible o incompatible.
                    </div>
                  )}

                  {/* Comparación (docx punto 11) — dos entidades lado a
                      lado, cada una con SU propia lista de vecinos real,
                      nunca una vista fusionada. */}
                  {route.comparandoConId && route.comparacion ? (
                    <div className="rounded-2xl p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/35">
                        {route.centro.label} vs {route.comparacion.nodo.label}
                      </p>
                      <p className="mt-3 text-[11px] leading-5 text-primary/50">
                        {route.vecinos.filter((v) => v.estado === "compatible").length} compatible(s) ·{" "}
                        {route.vecinos.filter((v) => v.estado === "posible").length} posible(s) desde{" "}
                        {route.centro.label}.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </>
      ) : null}
    </>
  );
}

function InteraccionSection() {
  // VIS-05 — visualizador_estado orden 5: "¿Qué ocurre cuando dos entidades
  // interactúan?". Envuelve el Sandbox real (sandbox/useSandbox.ts) vía
  // useInteraccionRoute — el frontend no calcula ni simula nada acá, solo
  // visualiza eventos/entidades/estado ya resueltos por el motor.
  const route = useInteraccionRoute();

  const timelineOrdenada = useMemo(
    () => [...route.eventosResueltos].sort((a, b) => a.evento.tiempo_programado - b.evento.tiempo_programado),
    [route.eventosResueltos],
  );

  const [entidadParaDisparo, setEntidadParaDisparo] = useState<string>("");
  const [eventoParaDisparo, setEventoParaDisparo] = useState<string>("");

  return (
    <>
      {route.loading ? (
        <LoadingRow />
      ) : route.empty ? (
        <EmptyRow>
          No hay simulaciones de Sandbox activas todavía — creá una desde la sección Sandbox para poder ver
          interacciones acá.
        </EmptyRow>
      ) : null}

      {!route.loading && route.simulaciones.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SelectDropdown
              items={route.simulaciones}
              active={route.simulaciones.find((s) => s.id === route.simulacionId) ?? null}
              getKey={(s) => s.id}
              getLabel={(s) => s.nombre}
              onSelect={(s) => route.setSimulacionId(s.id)}
              placeholder="Seleccioná una simulación…"
            />
            <div className="flex items-center gap-2">
              <StatusPill>t={route.tiempoSimulado ?? "—"}</StatusPill>
              <button
                type="button"
                onClick={() => route.play()}
                disabled={route.ejecutandoAccion}
                className="rounded-full border border-primary/15 p-2 text-primary/60 transition-colors hover:border-primary/30 hover:text-primary/90 disabled:opacity-40"
                title="Play"
              >
                <Play size={14} />
              </button>
              <button
                type="button"
                onClick={() => route.pause()}
                disabled={route.ejecutandoAccion}
                className="rounded-full border border-primary/15 p-2 text-primary/60 transition-colors hover:border-primary/30 hover:text-primary/90 disabled:opacity-40"
                title="Pause"
              >
                <Pause size={14} />
              </button>
              <button
                type="button"
                onClick={() => route.step()}
                disabled={route.ejecutandoAccion}
                className="rounded-full border border-primary/15 p-2 text-primary/60 transition-colors hover:border-primary/30 hover:text-primary/90 disabled:opacity-40"
                title="Step"
              >
                <SkipForward size={14} />
              </button>
              <button
                type="button"
                onClick={() => route.reset()}
                disabled={route.ejecutandoAccion}
                className="rounded-full border border-primary/15 p-2 text-primary/60 transition-colors hover:border-primary/30 hover:text-primary/90 disabled:opacity-40"
                title="Reset"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[2.8fr_0.72fr]">
            <div className="space-y-5">
              {/* Timeline (docx: "timeline, nodos causales, log") — cada
                  evento es clickeable, fija cuál cadena se ve en el
                  Inspector/TraceView de la derecha. */}
              <div className="overflow-x-auto rounded-2xl p-5">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-primary/35">Timeline de eventos</p>
                {timelineOrdenada.length === 0 ? (
                  <EmptyRow>Esta simulación todavía no tiene eventos encolados.</EmptyRow>
                ) : (
                  <div className="flex min-w-[560px] flex-wrap gap-2">
                    {timelineOrdenada.map((ev) => {
                      const selected = route.eventoSelId === ev.evento.id;
                      return (
                        <button
                          key={ev.evento.id}
                          type="button"
                          onClick={() => route.setEventoSelId(ev.evento.id)}
                          className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                            selected ? "border-primary/40" : "border-primary/10 hover:border-primary/25"
                          }`}
                        >
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary/35">
                            t={ev.evento.tiempo_programado}
                          </p>
                          <p className="mt-0.5 text-xs font-black text-primary/85">
                            {ev.catalogo?.nombre ?? ev.evento.evento_id.slice(0, 8)}
                          </p>
                          <p
                            className={`mt-0.5 text-[10px] font-bold ${
                              ev.evento.estado === "procesado" ? "text-primary/60" : "text-primary/35"
                            }`}
                          >
                            {ev.evento.estado}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cadena causal completa del evento seleccionado (docx
                  "trace causal") — sigue evento_origen_id hacia atrás. Un
                  solo eslabón es válido (no todo evento tiene origen). */}
              {route.cadenaCausal.length > 1 ? (
                <div className="rounded-2xl p-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-primary/35">
                    Cadena causal
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-primary/55">
                    {[...route.cadenaCausal].reverse().map((ev, i, arr) => (
                      <React.Fragment key={ev.id}>
                        <span className={ev.id === route.eventoSel?.evento.id ? "text-primary/90" : undefined}>
                          {route.catalogoEventos.find((c) => c.id === ev.evento_id)?.nombre ?? ev.evento_id.slice(0, 8)}
                        </span>
                        {i < arr.length - 1 ? <ChevronRight size={12} className="text-primary/25" /> : null}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Disparar evento (docx "click evento, inspector") — mismo
                  RPC que ya usa SandboxPage, encolar_evento_sandbox vía
                  route.dispararEvento. */}
              <div className="rounded-2xl p-5">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-primary/35">
                  Disparar evento
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <SelectDropdown
                    items={route.entidades}
                    active={route.entidades.find((e) => e.id === entidadParaDisparo) ?? null}
                    getKey={(e) => e.id}
                    getLabel={(e) => e.entidad_tipo}
                    onSelect={(e) => setEntidadParaDisparo(e.id)}
                    placeholder="Entidad…"
                  />
                  <SelectDropdown
                    items={route.catalogoEventos}
                    active={route.catalogoEventos.find((e) => e.id === eventoParaDisparo) ?? null}
                    getKey={(e) => e.id}
                    getLabel={(e) => e.nombre}
                    onSelect={(e) => setEventoParaDisparo(e.id)}
                    placeholder="Evento…"
                  />
                  <button
                    type="button"
                    disabled={!entidadParaDisparo || !eventoParaDisparo}
                    onClick={() => {
                      route.dispararEvento({ eventoId: eventoParaDisparo, entidadId: entidadParaDisparo });
                      setEventoParaDisparo("");
                    }}
                    className="rounded-full border border-primary/15 px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-primary/55 transition-colors hover:border-primary/30 hover:text-primary/85 disabled:opacity-40"
                  >
                    Encolar
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 lg:max-w-[280px]">
              <div className="rounded-2xl p-5">
                <TraceView steps={route.cadena} direction="down" />
              </div>
              {route.eventoSel ? (
                <Inspector
                  entity={{
                    eyebrow: "Interacción",
                    title: route.eventoSel.catalogo?.nombre ?? route.eventoSel.evento.evento_id,
                    subtitle: route.eventoSel.catalogo?.categoria ?? undefined,
                    note: route.eventoSel.catalogo?.descripcion ?? null,
                    fields: [
                      { label: "Estado", value: route.eventoSel.evento.estado },
                      { label: "Sujeto", value: route.eventoSel.sujeto?.entidad_tipo ?? null },
                      { label: "Objetivo", value: route.eventoSel.objetivo?.entidad_tipo ?? null },
                      { label: "t. programado", value: route.eventoSel.evento.tiempo_programado },
                      { label: "t. ejecutado", value: route.eventoSel.evento.ejecutado_at },
                    ],
                  }}
                  bordered={false}
                />
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function RutasSection({ perspectiva }: { perspectiva: Perspectiva }) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Nodo fijado por click dentro del canvas — distinto del Oris/Elemento
  // elegido en el ChipSelector. Se limpia al cambiar de contexto (Oris,
  // Elemento, capa o perspectiva) para no dejar seleccionado un nodo que
  // ya no existe en el canvas nuevo.
  const [nodoSelId, setNodoSelId] = useState<string | null>(null);

  const fisicaRoute = useFisicaRoute();
  const alquimiaRoute = useAlquimiaRoute();
  const compuestoRoute = useCompuestoRoute();

  useEffect(() => {
    setNodoSelId(null);
  }, [
    perspectiva,
    fisicaRoute.orisSel?.id,
    fisicaRoute.iumSel?.id,
    alquimiaRoute.elementoSel?.id,
    compuestoRoute.compuestoSel?.id,
  ]);

  // Partícula clickeada dentro del canvas activo, si el nodo seleccionado
  // es de nivel "partícula" — usa las mismas listas ya expandidas por el
  // hook de ruta (particulasDelOrisSel / particulasDelIumSel en zoom /
  // particulasDeCapaSel), sin volver a consultar nada.
  const particulaClickeada = useMemo(() => {
    if (!nodoSelId || !nodoSelId.startsWith("particula-")) return null;
    if (perspectiva === "fisica") {
      if (nodoSelId.startsWith("particula-ium-")) {
        const idx = Number(nodoSelId.slice("particula-ium-".length));
        return fisicaRoute.particulasDelIumSel[idx] ?? null;
      }
      // Formato vista de conjunto: `particula-{iumId}-{i}` — el índice es
      // siempre lo que sigue al ÚLTIMO guión, igual que en Alquimia más
      // abajo (antes asumía que todo tras "particula-" era el índice, lo
      // cual dejó de ser cierto al incluir el iumId real en el id).
      const idx = Number(nodoSelId.slice(nodoSelId.lastIndexOf("-") + 1));
      return fisicaRoute.particulasDelOrisSel[idx] ?? null;
    }
    // Formato alquimia: `particula-${capa}-${i}`
    const idx = Number(nodoSelId.slice(nodoSelId.lastIndexOf("-") + 1));
    return alquimiaRoute.particulasDeCapaSel[idx] ?? null;
  }, [nodoSelId, perspectiva, fisicaRoute.particulasDelOrisSel, fisicaRoute.particulasDelIumSel, alquimiaRoute.particulasDeCapaSel]);

  // Elemento clickeado dentro del canvas de Química (nodo `elemento-{id}-{rep}`,
  // ver RutaCompuestoCanvas) — distinto de particulaClickeada porque acá el
  // nodo referencia directamente un Elemento del catálogo, no una partícula
  // expandida por conteo.
  const elementoQuimicaClickeado = useMemo(() => {
    if (perspectiva !== "quimica" || !nodoSelId || !nodoSelId.startsWith("elemento-")) return null;
    const sinPrefijo = nodoSelId.slice("elemento-".length);
    const elementoId = sinPrefijo.slice(0, sinPrefijo.lastIndexOf("-"));
    return compuestoRoute.componentes.find((c) => c.elemento.id === elementoId)?.elemento ?? null;
  }, [perspectiva, nodoSelId, compuestoRoute.componentes]);

  // Inspector: solo presentacional — el shape se arma acá a partir de datos
  // ya resueltos por el hook de ruta activo, sin calcular nada nuevo.
  // Si hay una partícula clickeada, tiene prioridad: es la única entidad
  // cuya A/T/S es geometría relevante para el usuario en este momento
  // (sección "A/T/S es información contextual, no geometría principal").
  const inspectorEntity: InspectorEntity | null = useMemo(() => {
    if (particulaClickeada) {
      const letras = contarLetrasNodo(particulaClickeada.formula);
      return {
        eyebrow: "Partícula",
        title: particulaClickeada.nombre,
        subtitle: particulaClickeada.formula,
        visual: <ParticulaVisual formula={particulaClickeada.formula} size={40} />,
        fields: [
          { label: "A (antítesis)", value: letras.A },
          { label: "T (tesis)", value: letras.T },
          { label: "S (síntesis)", value: letras.S },
        ],
      };
    }
    if (perspectiva === "fisica") {
      // IUM en zoom tiene prioridad sobre el Oris de fondo: es la entidad
      // que el usuario efectivamente clickeó y quiere inspeccionar. Antes
      // el click en un IUM nunca llegaba acá (ver handleSelectNode en
      // RutaFisicaCanvas) y el Inspector seguía mostrando el Oris.
      const ium = fisicaRoute.iumSel;
      if (ium) {
        return {
          eyebrow: "IUM",
          title: ium.nombre,
          subtitle: `${fisicaRoute.particulasDelIumSel.length} partícula(s)`,
          visual: <IumVisual particulas={fisicaRoute.particulasDelIumSel} size={40} />,
          fields: [
            { label: "A", value: fisicaRoute.letrasIumSel.A },
            { label: "T", value: fisicaRoute.letrasIumSel.T },
            { label: "S", value: fisicaRoute.letrasIumSel.S },
          ],
        };
      }
      const o = fisicaRoute.orisSel;
      if (!o) return null;
      return {
        eyebrow: "Oris",
        title: o.nombre,
        subtitle: `${o.familia} · ${o.dominio}`,
        note: o.descripcion ?? null,
        // Gráfico quitado a pedido — el Inspector del Oris en Rutas ahora
        // es solo texto (título/subtítulo/campos), sin el CentroGravedadNodo.
        fields: [
          { label: "Fórmula", value: o.formula },
          { label: "A", value: fisicaRoute.letrasOrisSel.A },
          { label: "T", value: fisicaRoute.letrasOrisSel.T },
          { label: "S", value: fisicaRoute.letrasOrisSel.S },
          { label: "IUMs distintos", value: Object.keys(o.iums_composicion).length },
        ],
      };
    }
    // Elemento: mismo criterio que el Oris en Física (línea de arriba) —
    // el Inspector no repite el gráfico que ya se ve en el canvas central
    // (AtomoVisual), solo texto/campos.
    if (perspectiva === "alquimia") {
      const e = alquimiaRoute.elementoSel;
      if (!e) return null;
      return {
        eyebrow: "Elemento",
        title: `${e.simbolo} · ${e.nombre}`,
        subtitle: e.familia,
        note: e.notas ?? null,
        fields: [
          { label: "N° atómico", value: e.numero_atomico },
          { label: "Es noble", value: e.es_noble ? "Sí" : "No" },
        ],
      };
    }
    // Química (VIS-03): el Elemento clickeado tiene prioridad sobre el
    // Compuesto de fondo — muestra sus sitios de enlace reales (docx punto
    // 18 "Click sobre un sitio"), no solo identidad básica.
    if (elementoQuimicaClickeado) {
      const e = elementoQuimicaClickeado;
      const sitios = compuestoRoute.sitiosDelElementoFoco;
      return {
        eyebrow: "Elemento",
        title: `${e.simbolo} · ${e.nombre}`,
        subtitle: e.familia,
        note: e.notas ?? null,
        fields: [
          { label: "N° atómico", value: e.numero_atomico },
          {
            label: "Sitios de enlace",
            value: compuestoRoute.loadingSitios ? "cargando…" : sitios.length,
          },
          {
            label: "Capacidad de enlace",
            value: e.capacidad_enlace !== null && e.capacidad_enlace !== undefined ? e.capacidad_enlace.toFixed(3) : null,
          },
        ],
      };
    }
    const c = compuestoRoute.compuestoSel;
    if (!c) return null;
    const props = propiedadesCalculadasDeCompuesto(c).filter(
      (p) => ["estabilidad", "rigidez", "flexibilidad"].includes(p.clave),
    );
    return {
      eyebrow: "Compuesto",
      title: c.simbolo ? `${c.simbolo} · ${c.nombre}` : c.nombre,
      subtitle: c.tipo_compuesto ?? undefined,
      note: c.notas ?? null,
      fields: [
        { label: "Elementos distintos", value: compuestoRoute.componentes.length },
        { label: "Enlaces reales", value: compuestoRoute.loadingEnlaces ? "cargando…" : compuestoRoute.enlaces.length },
        ...props.map((p) => ({ label: p.label, value: p.valor })),
      ],
    };
  }, [particulaClickeada, perspectiva, fisicaRoute, alquimiaRoute, elementoQuimicaClickeado, compuestoRoute]);

  // Trace: ruta ya resuelta, en el mismo orden que el modelo real — nunca
  // fusiona Física, Alquimia y Química en una sola secuencia. Si hay una
  // partícula/elemento clickeado, el Trace lo refleja en vez de asumir
  // siempre la primera — para no mostrarle al usuario una procedencia
  // distinta de lo que ve seleccionado en el canvas/Inspector.
  const traceSteps: TraceStep[] = useMemo(() => {
    if (perspectiva === "fisica") {
      const o = fisicaRoute.orisSel;
      const ium = fisicaRoute.iumSel;
      const particulaTrace =
        particulaClickeada ??
        (ium ? fisicaRoute.particulasDelIumSel[0] : fisicaRoute.particulasDelOrisSel[0]) ??
        null;
      const iumTrace =
        ium ??
        (o
          ? (() => {
              const primerIumId = Object.keys(o.iums_composicion)[0];
              return primerIumId ? fisicaRoute.iumPorId[primerIumId] : null;
            })()
          : null);
      return [
        {
          id: "t-particula",
          levelLabel: "Partícula (A/T/S)",
          title: particulaTrace?.nombre ?? null,
          subtitle: particulaTrace?.formula ?? undefined,
        },
        {
          id: "t-ium",
          levelLabel: "IUM",
          title: iumTrace?.nombre ?? null,
        },
        { id: "t-oris", levelLabel: "Oris", title: o?.nombre ?? null, subtitle: o?.dominio ?? undefined },
      ];
    }
    if (perspectiva === "alquimia") {
      const e = alquimiaRoute.elementoSel;
      const capaSel = alquimiaRoute.capaSel;
      const capaConDatos = capaSel
        ? alquimiaRoute.capas.find((c) => c.capa === capaSel)
        : alquimiaRoute.capas.find((c) => c.total > 0);
      const particulaTrace = particulaClickeada ?? alquimiaRoute.particulasDeCapaSel[0] ?? null;
      return [
        {
          id: "t-particula",
          levelLabel: "Partícula química",
          title: particulaTrace?.nombre ?? (capaConDatos && !particulaTrace ? capaConDatos.resumen.split(" ")[0] ?? null : null),
          subtitle: particulaTrace?.formula ?? undefined,
        },
        { id: "t-capa", levelLabel: "Capa", title: capaConDatos?.label ?? null },
        { id: "t-elemento", levelLabel: "Elemento", title: e ? `${e.simbolo} · ${e.nombre}` : null },
      ];
    }
    // Química (VIS-03): la ruta completa del docx (24. VIS-03 definitivo —
    // Elemento → Sitios → Compatibilidad → Enlace → Estructura → Compuesto).
    // Compatibilidad no tiene traza propia hoy (no hay un hook que resuelva
    // sitio_compatibilidad por par de sitios seleccionados en el canvas) —
    // se muestra "—" en vez de inventar un valor, mismo criterio que
    // TraceView ya soporta (title: null → "Sin dato").
    const elFoco = elementoQuimicaClickeado ?? compuestoRoute.componentes[0]?.elemento ?? null;
    const primerEnlace = compuestoRoute.enlaces[0] ?? null;
    return [
      { id: "t-elemento", levelLabel: "Elemento", title: elFoco ? `${elFoco.simbolo} · ${elFoco.nombre}` : null },
      {
        id: "t-sitios",
        levelLabel: "Sitios",
        title: elementoQuimicaClickeado
          ? `${compuestoRoute.sitiosDelElementoFoco.length} sitio(s)`
          : null,
      },
      { id: "t-compatibilidad", levelLabel: "Compatibilidad", title: null },
      {
        id: "t-enlace",
        levelLabel: "Enlace",
        title: primerEnlace ? `Intensidad ${primerEnlace.intensidad?.toFixed(2) ?? "—"}` : null,
      },
      {
        id: "t-estructura",
        levelLabel: "Estructura",
        title: compuestoRoute.estructuraNombre,
      },
      {
        id: "t-compuesto",
        levelLabel: "Compuesto",
        title: compuestoRoute.compuestoSel?.nombre ?? null,
      },
    ];
  }, [perspectiva, fisicaRoute, alquimiaRoute, compuestoRoute, particulaClickeada, elementoQuimicaClickeado]);

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[2.8fr_0.72fr]">
        <div>
          {perspectiva === "fisica" ? (
            <RutaFisicaCanvas
              route={fisicaRoute}
              hoverId={hoverId}
              setHoverId={setHoverId}
              selectedNodeId={nodoSelId}
              onSelectNode={setNodoSelId}
            />
          ) : perspectiva === "alquimia" ? (
            <RutaAlquimiaCanvas
              route={alquimiaRoute}
              hoverId={hoverId}
              setHoverId={setHoverId}
              selectedNodeId={nodoSelId}
              onSelectNode={setNodoSelId}
            />
          ) : (
            <RutaCompuestoCanvas
              route={compuestoRoute}
              hoverId={hoverId}
              setHoverId={setHoverId}
              selectedNodeId={nodoSelId}
              onSelectNode={setNodoSelId}
            />
          )}
        </div>

        {/* Angostado: de 1fr (≈lg:grid-cols-[2.2fr_1fr]) a 0.72fr
            (lg:grid-cols-[2.8fr_0.72fr]) — pedido explícito de darle más
            protagonismo horizontal al canvas. max-w evita que este panel
            se estire de más en pantallas muy anchas, ya que el fr solo
            reparte el espacio disponible pero no pone techo. */}
        <div className="space-y-4 lg:max-w-[280px]">
          <Inspector
            entity={inspectorEntity}
            emptyLabel="Seleccioná un Oris, un Elemento o un Compuesto para inspeccionarlo."
            bordered={false}
          />
          <div className="rounded-2xl p-5">
            <TraceView steps={traceSteps} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * EnlaceLinea — la "anatomía del enlace" del docx (Parte 6, sección 5):
 * una línea A═══════B cuyo grosor y opacidad son proporcionales al dato
 * real de intensidad (0..1) — nunca decorativa. Sin dato, se dibuja en su
 * grosor mínimo (nunca se inventa una intensidad media).
 *
 * La ligera onda cuando estabilidad es baja (docx sección 6: "estable" =
 * línea recta, "inestable" ≋≋≋) se logra con un <path> ondulado en vez de
 * una <line> recta — el grado de ondulación es proporcional a
 * (1 - estabilidad), nunca una animación de temblor porque el docx pide
 * explícitamente "no representar inestabilidad si el motor no tiene ese
 * concepto" (sección 6): si no hay dato de estabilidad, se dibuja recta.
 */
function EnlaceLinea({
  intensidad,
  estabilidad,
  labelA,
  labelB,
}: {
  intensidad: number | null;
  estabilidad: number | null;
  labelA: string;
  labelB: string;
}) {
  const grosor = 1.5 + (intensidad ?? 0) * 7; // 1.5px..8.5px
  const amplitudOnda = estabilidad != null ? (1 - Math.max(0, Math.min(1, estabilidad))) * 10 : 0;
  const w = 320;
  const h = 60;
  const midY = h / 2;
  const path =
    amplitudOnda > 0.5
      ? `M 40 ${midY} Q ${w / 4} ${midY - amplitudOnda} ${w / 2} ${midY} T ${w - 40} ${midY}`
      : `M 40 ${midY} L ${w - 40} ${midY}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-sm" style={{ height: h }}>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={grosor}
        strokeLinecap="round"
        className="text-primary/70"
      />
      <circle cx={40} cy={midY} r={7} className="fill-current text-primary/85" />
      <circle cx={w - 40} cy={midY} r={7} className="fill-current text-primary/85" />
      <text x={40} y={midY - 16} textAnchor="middle" className="fill-current text-[11px] font-black text-primary/70">
        {labelA}
      </text>
      <text x={w - 40} y={midY - 16} textAnchor="middle" className="fill-current text-[11px] font-black text-primary/70">
        {labelB}
      </text>
    </svg>
  );
}

/** Barra de bloques (docx sección 5: "INTENSIDAD ██████████████░░"), más
 *  fiel al diseño que una barra lisa — cada bloque relleno representa un
 *  décimo del valor 0..1 real. */
function BarraBloques({ label, value }: { label: string; value: number }) {
  const llenos = Math.round(Math.max(0, Math.min(1, value)) * 10);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/45">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`h-3 flex-1 rounded-sm ${i < llenos ? "bg-primary/70" : "bg-primary/10"}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * EnlaceContextoCanvas — el mismo StructureCanvas orbital de "Compuestos"
 * (columns/edges con weight=intensidad real), pero sin los controles de
 * UI de RutaCompuestoCanvas (selector de compuesto, modo Ciencia,
 * Comparar) — para usarlo como panel de "contexto estructural" dentro de
 * EnlaceSection (docx sección 10: el enlace dentro de un compuesto, resto
 * atenuado) sin duplicar controles que EnlaceSection ya tiene los suyos.
 * Misma lógica de armado de nodos/edges que RutaCompuestoCanvas — se
 * repite acá en vez de exportarla porque son ~25 líneas y mantenerlas
 * como un hook aparte agregaría una capa de indirección para un solo uso.
 */
function EnlaceContextoCanvas({
  route,
  highlightedNodeIds,
}: {
  route: ReturnType<typeof useCompuestoRoute>;
  highlightedNodeIds: string[];
}) {
  const { compuestoSel, componentes, enlaces } = route;
  const [hoverId, setHoverId] = useState<string | null>(null);

  const elementoNodos = useMemo(() => {
    const nodos: { id: string; elementoId: string; label: string; sublabel?: string }[] = [];
    for (const { elemento, cantidad } of componentes) {
      for (let rep = 0; rep < cantidad; rep++) {
        nodos.push({
          id: `elemento-${elemento.id}-${rep}`,
          elementoId: elemento.id,
          label: elemento.nombre,
          sublabel: elemento.simbolo,
        });
      }
    }
    return nodos;
  }, [componentes]);

  const primeraInstanciaPorElemento = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const n of elementoNodos) {
      if (!mapa.has(n.elementoId)) mapa.set(n.elementoId, n.id);
    }
    return mapa;
  }, [elementoNodos]);

  const columns: CanvasColumn[] = useMemo(() => {
    if (!compuestoSel) return [];
    const nodosElementos = elementoNodos.map((n) => ({
      id: n.id,
      label: n.label,
      sublabel: n.sublabel,
      hideBorder: true,
      visual: (
        <AtomoVisual
          elemento={componentes.find((c) => c.elemento.id === n.elementoId)!.elemento}
          className="w-full aspect-square h-auto"
        />
      ),
    }));
    const compuestoNodo = {
      id: `compuesto-${compuestoSel.id}`,
      label: compuestoSel.nombre,
      sublabel: compuestoSel.simbolo ?? compuestoSel.tipo_compuesto ?? undefined,
      tone: "accent" as const,
      hideBorder: true,
      visual: (
        <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-primary/40 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]">
          <span className="text-lg font-black text-primary/85">
            {compuestoSel.simbolo ?? compuestoSel.nombre.slice(0, 3).toUpperCase()}
          </span>
        </div>
      ),
    };
    return [
      { id: "elementos", label: "Elementos", nodes: nodosElementos },
      { id: "compuesto", label: "Compuesto", nodes: [compuestoNodo] },
    ];
  }, [compuestoSel, elementoNodos, componentes]);

  const edges: CanvasEdge[] = useMemo(() => {
    if (!compuestoSel) return [];
    const out: CanvasEdge[] = [];
    for (const enlace of enlaces) {
      const nodoA = primeraInstanciaPorElemento.get(enlace.elemento_a_id);
      const nodoB = primeraInstanciaPorElemento.get(enlace.elemento_b_id);
      if (!nodoA || !nodoB) continue;
      out.push({ fromNodeId: nodoA, toNodeId: nodoB, weight: enlace.intensidad ?? undefined });
    }
    return out;
  }, [compuestoSel, enlaces, primeraInstanciaPorElemento]);

  if (!compuestoSel) return null;

  return (
    <div className="rounded-2xl p-5">
      <StructureCanvas
        columns={columns}
        edges={edges}
        selectedNodeId={null}
        onHoverNode={setHoverId}
        onSelectNode={() => {}}
        highlightedNodeIds={hoverId ? [hoverId] : highlightedNodeIds}
        centerScaleExtra={1.3}
      />
    </div>
  );
}

/**
 * EnlaceSection — VIS-19 "El Enlace".
 *
 * El enlace es el protagonista: se elige un Compuesto para ubicar sus
 * enlaces reales (compuesto_enlaces), y desde ahí un enlace puntual para
 * inspeccionar su anatomía (A ↔ B, estado, intensidad/estabilidad/
 * reversibilidad/confianza — todo proporcional al dato real, nunca
 * decorativo). El resto del compuesto queda atenuado detrás, dando
 * contexto sin competir con el enlace activo (docx sección 10: "el enlace
 * dentro de un compuesto" — reusa RutaCompuestoCanvas/StructureCanvas con
 * highlightedNodeIds en vez de duplicar el canvas).
 */
function EnlaceSection() {
  const route = useEnlaceRoute();
  const { compuestoRoute, enlaces, enlaceSel, setEnlaceSelId, compararActivo, setCompararActivo, enlaceCompararSel, setEnlaceCompararId } = route;

  const anatomiaValues = (e: EnlaceResuelto | null) => {
    if (!e) return [];
    const campos: { label: string; value: number | null }[] = [
      { label: "Intensidad", value: e.intensidad },
      { label: "Estabilidad", value: e.estabilidad },
      { label: "Reversibilidad", value: e.reversibilidad },
      { label: "Confianza", value: e.confianza },
    ];
    return campos
      .filter((c): c is { label: string; value: number } => c.value != null)
      .map((c) => ({ label: c.label, value: c.value }));
  };

  const labelEnlace = (e: EnlaceResuelto) =>
    `${e.elementoA?.simbolo ?? "?"} ↔ ${e.elementoB?.simbolo ?? "?"}`;

  // Nodos del enlace activo dentro del canvas del compuesto (docx sección
  // 10 — "el enlace dentro de un compuesto, resto atenuado"). Mismo
  // criterio de "primera instancia" que usa RutaCompuestoCanvas
  // internamente (compuesto_enlaces no distingue instancia cuando
  // cantidad > 1 — no se inventa a cuál de las N corresponde).
  const highlightedNodeIds = useMemo(() => {
    if (!enlaceSel) return [];
    return [`elemento-${enlaceSel.elemento_a_id}-0`, `elemento-${enlaceSel.elemento_b_id}-0`];
  }, [enlaceSel]);

  return (
    <div className="grid gap-7 lg:grid-cols-[1.35fr_0.65fr]">
      {/* Canvas: contexto estructural del enlace activo (docx sección 10)
          — el enlace dentro del compuesto completo, resto atenuado. Reusa
          RutaCompuestoCanvas en vez de duplicar el canvas orbital. */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/35">Contexto estructural</p>
        <div className="mt-3 rounded-2xl p-5">
          {enlaceSel ? (
            <EnlaceContextoCanvas route={compuestoRoute} highlightedNodeIds={highlightedNodeIds} />
          ) : (
            <EmptyRow>Seleccioná un enlace para ver su contexto en el compuesto.</EmptyRow>
          )}
        </div>
      </div>

      {/* Inspector: selector de Compuesto + lista de enlaces + anatomía
          del enlace activo (+ comparación si está activada). */}
      <div>
        <p className="text-xs font-black text-primary/80">Compuesto</p>
        <div className="mt-3">
          {compuestoRoute.loading ? (
            <LoadingRow />
          ) : (
            <SelectDropdown
              items={compuestoRoute.compuestos}
              active={compuestoRoute.compuestoSel}
              getKey={(c) => c.id}
              getLabel={(c) => c.nombre}
              onSelect={(c) => compuestoRoute.setCompuestoSelId(c.id)}
              placeholder="Seleccioná un compuesto…"
            />
          )}
        </div>

        <p className="mt-7 text-xs font-black text-primary/80">
          Enlaces reales <span className="font-medium text-primary/35">· {enlaces.length}</span>
        </p>
        <div className="mt-3 space-y-1">
          {enlaces.length === 0 ? (
            <EmptyRow>Este compuesto no tiene enlaces instanciados todavía.</EmptyRow>
          ) : (
            enlaces.map((e) => {
              const selected = enlaceSel?.id === e.id;
              const selectedCompare = enlaceCompararSel?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => (compararActivo && selected ? null : compararActivo ? setEnlaceCompararId(e.id) : setEnlaceSelId(e.id))}
                  className={`flex w-full items-center justify-between gap-2 py-2 text-left text-xs transition-colors ${
                    selected || selectedCompare ? "font-black text-primary/90" : "font-bold text-primary/45 hover:text-primary/70"
                  }`}
                >
                  <span>{labelEnlace(e)}</span>
                  {e.estado ? <StatusPill>{e.estado}</StatusPill> : null}
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setCompararActivo(!compararActivo);
            if (compararActivo) setEnlaceCompararId(null);
          }}
          className={`mt-6 text-[11px] font-black uppercase tracking-widest transition-colors ${
            compararActivo ? "text-primary/80" : "text-primary/35 hover:text-primary/60"
          }`}
        >
          {compararActivo ? "✕ Comparar enlaces" : "Comparar enlaces"}
        </button>

        <div className={`mt-7 grid gap-7 ${compararActivo ? "sm:grid-cols-2" : ""}`}>
          {[enlaceSel, ...(compararActivo ? [enlaceCompararSel] : [])].map((e, i) => (
            <div key={e?.id ?? `vacio-${i}`}>
              {!e ? (
                <EmptyRow>{i === 0 ? "Seleccioná un enlace para inspeccionarlo." : "Elegí un segundo enlace para comparar."}</EmptyRow>
              ) : (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/35">Anatomía del enlace</p>

                  <div className="mt-4">
                    <EnlaceLinea
                      intensidad={e.intensidad}
                      estabilidad={e.estabilidad}
                      labelA={e.elementoA?.simbolo ?? "?"}
                      labelB={e.elementoB?.simbolo ?? "?"}
                    />
                  </div>

                  <p className="mt-2 text-lg font-black text-primary/85">
                    {e.elementoA?.nombre ?? "?"} <span className="text-primary/30">↔</span> {e.elementoB?.nombre ?? "?"}
                  </p>
                  {e.estado ? <p className="mt-1 text-xs font-bold text-primary/40">{e.estado}</p> : null}

                  <div className="mt-6 space-y-4">
                    {e.intensidad != null ? <BarraBloques label="Intensidad" value={e.intensidad} /> : null}
                    {e.estabilidad != null ? <BarraBloques label="Estabilidad" value={e.estabilidad} /> : null}
                    {e.reversibilidad != null ? <BarraBloques label="Reversibilidad" value={e.reversibilidad} /> : null}
                    {e.confianza != null ? <BarraBloques label="Confianza" value={e.confianza} /> : null}
                    {route.loadingEnlaces ? (
                      <LoadingRow />
                    ) : anatomiaValues(e).length === 0 ? (
                      <EmptyRow>Sin datos de anatomía calculados todavía para este enlace.</EmptyRow>
                    ) : null}
                  </div>

                  {e.coste_energetico != null ? (
                    <p className="mt-5 text-[11px] font-bold text-primary/45">
                      Coste energético: <span className="text-primary/70">{e.coste_energetico}</span>
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VisualizadorPage() {
  const [active, setActive] = useState<SectionKey>("oris_ruta");

  // ─── Fuentes de datos reales ────────────────────────────────────────────
  const { items: particulas, loading: loadingParticulas } = useParticulasCompletas();
  const { items: iums } = useIums();
  const { items: oris, loading: loadingOris } = useOrisConIums();
  const { items: materiales, loading: loadingMateriales } = useMateriales();
  const { items: estructuras, loading: loadingEstructuras } = useEstructuras();
  const { items: compuestos, loading: loadingCompuestos } = useCompuestos();
  const { items: procesos, loading: loadingProcesos } = useProcesos();
  const { items: runas, loading: loadingRunas } = useRunasCatalogo();
  const { items: propiedadesDerivadas, loading: loadingPropiedadesDerivadas } = usePropiedadesDerivadas();

  const iumPorId = useMemo(() => {
    const mapa: Record<string, FilaIum> = {};
    for (const i of iums) {
      mapa[i.id] = {
        id: i.id,
        nombre: i.nombre,
        detalle: i.detalle,
        extra: i.extra ?? undefined,
        composicion: i.composicion,
      };
    }
    return mapa;
  }, [iums]);

  // ─── Selecciones activas por sección ────────────────────────────────────
  const [orisSel, setOrisSel] = useState<(typeof oris)[number] | null>(null);
  const [materialSel, setMaterialSel] = useState<(typeof materiales)[number] | null>(null);
  const [estructuraSel, setEstructuraSel] = useState<(typeof estructuras)[number] | null>(null);
  const [compuestoSel, setCompuestoSel] = useState<(typeof compuestos)[number] | null>(null);
  const [procesoSel, setProcesoSel] = useState<(typeof procesos)[number] | null>(null);
  const [runaSel, setRunaSel] = useState<(typeof runas)[number] | null>(null);

  // ─── VIS-02: nivel de zoom semántico del mapa A/T/S (docx punto 14 —
  // "partículas / IUMs / Oris, todas vistas en el mismo espacio
  // conceptual"). El triángulo en sí no cambia; solo qué conjunto de
  // entidades se proyecta en él.
  const [nivelATS, setNivelATS] = useState<"particulas" | "ium" | "oris">("particulas");
  const [atsSelId, setAtsSelId] = useState<string | null>(null);

  const entidadesATS: EntidadATS[] = useMemo(() => {
    if (nivelATS === "particulas") {
      return particulas.map((p) => ({
        id: p.id,
        label: p.nombre,
        sublabel: p.formula,
        // Mismo conteo real que ya usa contarLetrasNodo (NodeVisuals) para
        // el color dominante de ParticulaVisual — no se reinventa la regla.
        letras: contarLetrasNodo(p.formula),
      }));
    }
    if (nivelATS === "ium") {
      return iums.map((i) => {
        const fila = iumPorId[i.id];
        return {
          id: i.id,
          label: i.nombre,
          sublabel: `${fila ? particulasDeIum(fila).length : 0} partícula(s)`,
          letras: fila ? contarLetrasDeIum(fila) : { A: 0, T: 0, S: 0 },
          componentes: fila
            ? particulasDeIum(fila).map((p) => ({ label: p.nombre, letras: contarLetrasNodo(p.formula) }))
            : [],
        };
      });
    }
    return oris.map((o) => ({
      id: o.id,
      label: o.nombre,
      sublabel: o.dominio,
      letras: contarLetrasDeOris(o.iums_composicion, iumPorId),
      componentes: particulasDeOris(o.iums_composicion, iumPorId).map((p) => ({
        label: p.nombre,
        letras: contarLetrasNodo(p.formula),
      })),
    }));
  }, [nivelATS, particulas, iums, oris, iumPorId]);

  // Selección por defecto y saneo si el nivel cambia y el id activo ya no
  // existe en el nuevo conjunto — mismo patrón que el resto de selecciones
  // de esta página (useEffect, nunca recalculado "en frío" en cada render).
  useEffect(() => {
    if (entidadesATS.length === 0) {
      if (atsSelId !== null) setAtsSelId(null);
      return;
    }
    if (!atsSelId || !entidadesATS.some((e) => e.id === atsSelId)) {
      setAtsSelId(entidadesATS[0].id);
    }
  }, [entidadesATS, atsSelId]);

  const atsEntidadActiva = entidadesATS.find((e) => e.id === atsSelId) ?? null;

  useEffect(() => {
    if (!orisSel && oris.length > 0) setOrisSel(oris[0]);
  }, [oris, orisSel]);
  useEffect(() => {
    if (!materialSel && materiales.length > 0) setMaterialSel(materiales[0]);
  }, [materiales, materialSel]);
  useEffect(() => {
    if (!estructuraSel && estructuras.length > 0) setEstructuraSel(estructuras[0]);
  }, [estructuras, estructuraSel]);
  useEffect(() => {
    if (!compuestoSel && compuestos.length > 0) setCompuestoSel(compuestos[0]);
  }, [compuestos, compuestoSel]);
  useEffect(() => {
    if (!procesoSel && procesos.length > 0) setProcesoSel(procesos[0]);
  }, [procesos, procesoSel]);
  useEffect(() => {
    if (!runaSel && runas.length > 0) setRunaSel(runas[0]);
  }, [runas, runaSel]);

  // Fórmula seleccionada en la sección "Fórmulas" — calculadora interactiva
  const densidad = useMemo(
    () => propiedadesDerivadas.find((p) => p.clave === "densidad") ?? null,
    [propiedadesDerivadas],
  );
  const [mass, setMass] = useState(12);
  const [volume, setVolume] = useState(0.004);
  const densidadCalculada = useMemo(() => (volume > 0 ? mass / volume : 0), [mass, volume]);
  const [propiedadFormulaSel, setPropiedadFormulaSel] = useState<(typeof propiedadesDerivadas)[number] | null>(null);

  const oriSelLetras = useMemo(() => {
    if (!orisSel) return { A: 0, T: 0, S: 0 };
    return contarLetrasDeOris(orisSel.iums_composicion, iumPorId);
  }, [orisSel, iumPorId]);

  const materialPropiedades = useMemo(
    () => (materialSel ? propiedadesCalculadasGenerico(materialSel.propiedades_calculadas) : []),
    [materialSel],
  );

  const compuestoPropiedades = useMemo(
    () => (compuestoSel ? propiedadesCalculadasDeCompuesto(compuestoSel) : []),
    [compuestoSel],
  );

  return (
    <main className="min-h-screen bg-[var(--bg-main)] text-primary">
      <div className="w-full py-8">

        <div className="grid gap-2 lg:grid-cols-[150px_minmax(0,1fr)]">
          <aside className="p-0 lg:sticky lg:top-6 lg:self-start">
            <nav className="space-y-4">
              {navGroups.map((grupo) => (
                <div key={grupo.group}>
                  <p className="mb-1.5 px-0 text-[9px] font-black uppercase tracking-widest text-primary/30">
                    {grupo.group}
                  </p>
                  <div className="space-y-1.5">
                    {grupo.items.map((item) => {
                      const selected = item.key === active;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setActive(item.key)}
                          className={`flex w-full items-center gap-2 py-2 text-left text-xs transition-colors ${selected ? "font-black text-primary/90" : "font-medium text-primary/45 hover:text-primary/70"} ${item.implementado ? "" : "opacity-60"}`}
                          title={item.visId}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                          {!item.implementado ? <span className="ml-auto text-[9px] text-primary/25">pronto</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <section className="min-w-0">
            {active === "oris_ruta" ? <RutasSection perspectiva="fisica" /> : null}

            {active === "elementos_ruta" ? <RutasSection perspectiva="alquimia" /> : null}

            {active === "compuestos_ruta" ? <RutasSection perspectiva="quimica" /> : null}

            {active === "compatibilidad" ? <CompatibilidadSection /> : null}

            {active === "interaccion" ? <InteraccionSection /> : null}

            {active === "ats" ? (
              <>
                {/* VIS-02 — Espacio Tesis/Antítesis/Síntesis. El triángulo
                    es el protagonista de la sección (docx: "el
                    protagonista es el espacio que existe dentro de él"),
                    con el selector de partícula anterior movido a un panel
                    lateral de detalle en vez de encabezar la sección. */}
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["particulas", "Partículas"],
                      ["ium", "IUM"],
                      ["oris", "Oris"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setNivelATS(key)}
                      className={`rounded-full border px-4 py-1.5 text-[11px] font-black uppercase tracking-widest transition-colors ${
                        nivelATS === key
                          ? "border-primary/60 bg-primary/10 text-primary/90"
                          : "border-primary/12 text-primary/40 hover:border-primary/25"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="ml-1 text-[10px] text-primary/35">
                    Zoom semántico — mismo espacio conceptual, distinto nivel.
                  </span>
                </div>

                <div className="grid gap-7 lg:grid-cols-[1.35fr_0.65fr]">
                  <div className="rounded-2xl p-7">
                    {(nivelATS === "particulas" && loadingParticulas) || (nivelATS === "oris" && loadingOris) ? (
                      <LoadingRow />
                    ) : entidadesATS.length === 0 ? (
                      <EmptyRow>Sin entidades para este nivel.</EmptyRow>
                    ) : (
                      <TriangleATS
                        entidades={entidadesATS}
                        selectedId={atsSelId}
                        onSelect={setAtsSelId}
                        modoCiencia
                      />
                    )}
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl p-7">
                      {atsEntidadActiva ? (
                        <div className="flex flex-col items-center text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">
                            {nivelATS === "particulas" ? "Partícula" : nivelATS === "ium" ? "IUM" : "Oris"}
                          </p>
                          <p className="mt-1 text-2xl font-black text-primary/85">{atsEntidadActiva.label}</p>
                          {atsEntidadActiva.sublabel ? (
                            <p className="mt-1 text-xs font-bold text-primary/40">{atsEntidadActiva.sublabel}</p>
                          ) : null}
                          <div className="my-3 h-6 border-l border-dashed border-primary/20" />
                          <div className="grid w-full grid-cols-3 gap-3 text-center">
                            {(["A", "T", "S"] as const).map((letra) => (
                              <div key={letra} className="rounded-xl border border-primary/10 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{letra}</p>
                                <p className="mt-1 text-lg font-black text-primary/75">{atsEntidadActiva.letras[letra]}</p>
                              </div>
                            ))}
                          </div>
                          {atsEntidadActiva.componentes?.length ? (
                            <p className="mt-3 text-[11px] font-bold text-primary/40">
                              {atsEntidadActiva.componentes.length} componente(s) superpuesto(s) en el mapa
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <EmptyRow>Elegí una entidad en el mapa.</EmptyRow>
                      )}
                    </div>

                    <div className="rounded-2xl p-7">
                      <p className="text-xs font-black text-primary/80">Ejes fundamentales</p>
                      <p className="text-[10px] text-primary/35">Valores reales de particulas.ejes_fundamentales</p>
                      {nivelATS !== "particulas" ? (
                        <EmptyRow>Solo disponible a nivel Partículas.</EmptyRow>
                      ) : (() => {
                        const p = particulas.find((x) => x.id === atsSelId) ?? null;
                        return p?.ejes_fundamentales ? (
                          <div className="mt-4 space-y-4">
                            {(
                              [
                                ["dinamica", "Dinámica"],
                                ["coherencia", "Coherencia"],
                                ["estabilidad", "Estabilidad"],
                                ["informacion", "Información"],
                                ["interaccion", "Interacción"],
                                ["transformacion", "Transformación"],
                              ] as const
                            ).map(([clave, label]) => {
                              const valores = particulas
                                .map((pp) => pp.ejes_fundamentales?.[clave])
                                .filter((v): v is number => typeof v === "number");
                              const max = Math.max(1, ...valores.map((v) => Math.abs(v)));
                              const v = p.ejes_fundamentales?.[clave] ?? 0;
                              return <BarraDivergente key={clave} label={label} value={v} max={max} />;
                            })}
                          </div>
                        ) : (
                          <EmptyRow>Sin ejes fundamentales para esta partícula.</EmptyRow>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {active === "material" ? (
              <>
                {loadingMateriales ? (
                  <LoadingRow />
                ) : (
                  <SelectDropdown
                    items={materiales}
                    active={materialSel}
                    getKey={(m) => m.id}
                    getLabel={(m) => m.nombre}
                    onSelect={setMaterialSel}
                    placeholder="Seleccioná un material…"
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">
                      Perfil físico {materialSel ? `· ${materialSel.nombre}` : ""}
                    </p>
                    <div className="mt-5">
                      {materialPropiedades.length > 0 ? (
                        <PropiedadesFisicasGenerico propiedades={materialSel?.propiedades_calculadas} columnas={2} />
                      ) : (
                        <EmptyRow>Sin propiedades calculadas todavía para este material.</EmptyRow>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Metadatos</p>
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <StatusPill>{materialSel?.tipo_material ?? "—"}</StatusPill>
                      <StatusPill>{materialSel?.estado_calculo ?? "sin calcular"}</StatusPill>
                      {materialSel?.propiedades_calculadas?.fuente_fisica ? (
                        <StatusPill>{String(materialSel.propiedades_calculadas.fuente_fisica)}</StatusPill>
                      ) : null}
                    </div>
                    {materialSel?.descripcion ? (
                      <p className="mt-4 text-xs leading-5 text-primary/45">{materialSel.descripcion}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-8 rounded-2xl p-7">
                  <p className="text-xs font-black text-primary/80">Valores derivados reales</p>
                  <p className="mt-1 text-[10px] text-primary/35">valores_propiedades_derivadas para este material</p>
                  <div className="mt-4">
                    <TarjetaValoresDerivados tipo="material" entidadId={materialSel?.id ?? null} entidadNombre={materialSel?.nombre} />
                  </div>
                </div>

                <div className="mt-8 grid gap-7 lg:grid-cols-2">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Densidad</p>
                    <p className="mt-1 text-[10px] text-primary/35">
                      Calculadora interactiva usando la fórmula real: {densidad?.formula ?? "rho=M/V"}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <label className="rounded-xl border border-primary/10 p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">Masa</span>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            aria-label="Masa"
                            type="number"
                            value={mass}
                            onChange={(e) => setMass(Number(e.target.value))}
                            className="w-full rounded-lg border border-primary/10 bg-transparent px-3 py-2 text-sm font-black text-primary/80 outline-none"
                          />
                          <span className="text-xs font-bold text-primary/35">kg</span>
                        </div>
                      </label>
                      <label className="rounded-xl border border-primary/10 p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">Volumen</span>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            aria-label="Volumen"
                            type="number"
                            step="0.001"
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="w-full rounded-lg border border-primary/10 bg-transparent px-3 py-2 text-sm font-black text-primary/80 outline-none"
                          />
                          <span className="text-xs font-bold text-primary/35">m³</span>
                        </div>
                      </label>
                    </div>
                    <div className="mt-8 rounded-2xl p-6 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/35">Resultado</p>
                      <p className="mt-2 text-3xl font-black tabular-nums text-primary/85">
                        {Number.isFinite(densidadCalculada) ? densidadCalculada.toLocaleString("es-CL") : "—"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-primary/40">kg/m³</p>
                      <p className="mt-3 text-lg font-black text-primary/75">{densidad?.formula ?? "rho=M/V"}</p>
                      {densidad?.dependencias ? (
                        <p className="mt-1 text-[10px] font-bold text-primary/35">Dependencias: {densidad.dependencias}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl p-7">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-primary/80">Catálogo real</p>
                      <StatusPill>{propiedadesDerivadas.length} propiedades</StatusPill>
                    </div>
                    {loadingPropiedadesDerivadas ? (
                      <LoadingRow />
                    ) : (
                      <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                        {propiedadesDerivadas.map((p) => {
                          const selected = propiedadFormulaSel?.id === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPropiedadFormulaSel(selected ? null : p)}
                              className={`w-full rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary/30" : "border-primary/10 hover:border-primary/20"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-black text-primary/80">{p.nombre}</p>
                                {p.tipo_valor ? <StatusPill>{p.tipo_valor}</StatusPill> : null}
                              </div>
                              {p.formula ? <p className="mt-1 truncate text-[11px] font-bold text-primary/50">{p.formula}</p> : null}
                              {selected && p.dependencias ? (
                                <p className="mt-2 text-[10px] leading-4 text-primary/40">Depende de: {p.dependencias}</p>
                              ) : null}
                              {selected && p.descripcion ? (
                                <p className="mt-1 text-[10px] leading-4 text-primary/40">{p.descripcion}</p>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {active === "structure" ? (
              <>
                {loadingEstructuras ? (
                  <LoadingRow />
                ) : (
                  <SelectDropdown
                    items={estructuras}
                    active={estructuraSel}
                    getKey={(e) => e.id}
                    getLabel={(e) => e.nombre}
                    onSelect={setEstructuraSel}
                    placeholder="Seleccioná una estructura…"
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">
                      Propiedades {estructuraSel ? `· ${estructuraSel.nombre}` : ""}
                    </p>
                    <div className="mt-5">
                      {estructuraSel?.propiedades_calculadas ? (
                        <PropiedadesFisicasGenerico propiedades={estructuraSel.propiedades_calculadas} columnas={2} />
                      ) : (
                        <EmptyRow>Sin propiedades calculadas todavía para esta estructura.</EmptyRow>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Función</p>
                    <div className="mt-3 space-y-2">
                      <StatusPill>{estructuraSel?.tipo ?? "sin tipo"}</StatusPill>
                    </div>
                    {estructuraSel?.funcion ? (
                      <p className="mt-4 text-xs leading-5 text-primary/45">{estructuraSel.funcion}</p>
                    ) : null}
                    {estructuraSel?.descripcion ? (
                      <p className="mt-3 text-xs leading-5 text-primary/40">{estructuraSel.descripcion}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-8 rounded-2xl p-7">
                  <p className="text-xs font-black text-primary/80">Valores derivados reales</p>
                  <div className="mt-4">
                    <TarjetaValoresDerivados
                      tipo="estructura"
                      entidadId={estructuraSel?.id ?? null}
                      entidadNombre={estructuraSel?.nombre}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {active === "reactivity" ? (
              <>
                {loadingCompuestos ? (
                  <LoadingRow />
                ) : (
                  <SelectDropdown
                    items={compuestos}
                    active={compuestoSel}
                    getKey={(c) => c.id}
                    getLabel={(c) => c.nombre}
                    onSelect={setCompuestoSel}
                    placeholder="Seleccioná un compuesto…"
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-2">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">
                      Perfil reactivo {compuestoSel ? `· ${compuestoSel.nombre}` : ""}
                    </p>
                    <div className="mt-5">
                      {compuestoPropiedades.filter((p) => p.proporcion !== undefined).length > 0 ? (
                        <MiniBarChart
                          values={compuestoPropiedades
                            .filter((p) => p.proporcion !== undefined)
                            .map((p) => ({ label: p.label, value: p.proporcion ?? 0 }))}
                        />
                      ) : (
                        <EmptyRow>Sin índices reactivos calculados todavía.</EmptyRow>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Ficha</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {compuestoSel?.tipo_compuesto ? <StatusPill>{compuestoSel.tipo_compuesto}</StatusPill> : null}
                      {compuestoSel?.clasificacion ? <StatusPill>{compuestoSel.clasificacion}</StatusPill> : null}
                      {compuestoSel?.estado ? <StatusPill>{compuestoSel.estado}</StatusPill> : null}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                      {compuestoPropiedades
                        .filter((p) => p.valor !== null && p.proporcion === undefined)
                        .slice(0, 6)
                        .map((p) => (
                          <div key={p.clave} className="rounded-lg border border-primary/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{p.label}</p>
                            <p className="mt-1 font-black text-primary/75">{p.valor}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="mt-8 rounded-2xl p-7">
                  <p className="text-xs font-black text-primary/80">Valores derivados reales</p>
                  <div className="mt-4">
                    <TarjetaValoresDerivados tipo="compuesto" entidadId={compuestoSel?.id ?? null} entidadNombre={compuestoSel?.nombre} />
                  </div>
                </div>
              </>
            ) : null}

            {active === "energy" ? (
              <>
                {loadingCompuestos ? (
                  <LoadingRow />
                ) : (
                  <div className="rounded-2xl p-5">
                    <MiniBarChart
                      values={compuestos
                        .filter((c) => typeof c.energia_enlace === "number")
                        .slice(0, 8)
                        .map((c) => ({
                          label: c.nombre,
                          value: Math.max(0, Math.min(1, (c.energia_enlace ?? 0) / 5)),
                        }))}
                    />
                  </div>
                )}
                <div className="mt-8 rounded-2xl p-6 text-xs leading-5 text-primary/45">
                  Barra normalizada a un techo visual de 5 solo para comparar proporciones — el valor real de{" "}
                  <span className="font-black text-primary/60">energia_enlace</span> no está acotado a [0,1]; usa la
                  ficha del compuesto en la pestaña Química para el número exacto.
                </div>
              </>
            ) : null}

            {active === "electric" ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {compuestos
                    .filter((c) => typeof c.carga === "number" && c.carga !== 0)
                    .slice(0, 8)
                    .map((c) => (
                      <FlowNode
                        key={c.id}
                        title={c.nombre}
                        subtitle={`carga ${c.carga}`}
                        tone={(c.carga ?? 0) > 0 ? "accent" : "default"}
                      />
                    ))}
                </div>
                {compuestos.filter((c) => typeof c.carga === "number" && c.carga !== 0).length === 0 ? (
                  <EmptyRow>Ningún compuesto cargado tiene carga distinta de cero todavía.</EmptyRow>
                ) : null}
              </>
            ) : null}

            {active === "information" ? (
              <>
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-2xl p-7">
                  <FlowNode title="Fuente" subtitle="mensaje + intensidad" />
                  <Arrow />
                  <FlowNode title="Propagación" subtitle="distancia" />
                  <Arrow />
                  <FlowNode title="Receptor" subtitle="intensidad · fidelidad" tone="accent" />
                </div>
                <div className="mt-8 rounded-2xl p-6 text-xs leading-5 text-primary/45">
                  Diagrama conceptual — a diferencia de las otras 11 secciones, no hay una tabla "información"/"señal" en
                  Supabase todavía. No se inventan valores numéricos acá.
                </div>
              </>
            ) : null}

            {active === "oris" ? (
              <>
                {loadingOris ? (
                  <LoadingRow />
                ) : (
                  <ChipSelector
                    items={oris}
                    active={orisSel}
                    getKey={(o) => o.id}
                    getLabel={(o) => o.nombre}
                    onSelect={setOrisSel}
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_0.9fr]">
                  <div className="overflow-x-auto rounded-2xl p-7">
                    <div className="flex min-w-[620px] items-center gap-2">
                      <FlowNode title="Partículas" subtitle="A/T/S" />
                      <Arrow />
                      <FlowNode
                        title="IUMs"
                        subtitle={orisSel ? `${Object.keys(orisSel.iums_composicion).length} usados` : undefined}
                      />
                      <Arrow />
                      <FlowNode title={orisSel?.nombre ?? "Oris"} subtitle={orisSel?.dominio} tone="accent" />
                      <Arrow />
                      <FlowNode title="Éterium" subtitle={orisSel?.familia} />
                    </div>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Equilibrio A/T/S</p>
                    <div className="mt-5">
                      <MiniBarChart
                        values={(["A", "T", "S"] as const).map((letra) => ({
                          label: letra,
                          value:
                            oriSelLetras.A + oriSelLetras.T + oriSelLetras.S > 0
                              ? oriSelLetras[letra] / (oriSelLetras.A + oriSelLetras.T + oriSelLetras.S)
                              : 0,
                        }))}
                      />
                    </div>
                    {orisSel?.formula ? <p className="mt-4 text-xs font-black text-primary/70">{orisSel.formula}</p> : null}
                    {orisSel?.descripcion ? (
                      <p className="mt-2 text-[11px] leading-5 text-primary/40">{orisSel.descripcion}</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {active === "runas" ? (
              <>
                {loadingRunas ? (
                  <LoadingRow />
                ) : (
                  <ChipSelector
                    items={runas}
                    active={runaSel}
                    getKey={(r) => r.id}
                    getLabel={(r) => r.nombre}
                    onSelect={setRunaSel}
                  />
                )}
                <div className="mt-8 grid gap-7 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl p-6">
                    {runaSel?.patron_trazos && runaSel.patron_trazos.length > 0 ? (
                      <div className="h-44 w-44">
                        <RunaThumbnail patronTrazos={runaSel.patron_trazos} />
                      </div>
                    ) : (
                      <EmptyRow>Esta runa no tiene patrón de trazos guardado todavía.</EmptyRow>
                    )}
                  </div>
                  <div className="rounded-2xl p-7">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-primary/80">{runaSel?.nombre ?? "Runa"}</p>
                      <StatusPill>{runaSel?.patron_trazos?.length ?? 0} trazos</StatusPill>
                    </div>
                    <div className="mt-5 space-y-3 text-xs text-primary/60">
                      <div className="rounded-xl border border-primary/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">Explicación</p>
                        <p className="mt-1 leading-5">{runaSel?.explicacion || "Sin explicación registrada todavía."}</p>
                      </div>
                      {runaSel?.explicacion_por_rango && Object.keys(runaSel.explicacion_por_rango).length > 0 ? (
                        <div className="rounded-xl border border-primary/10 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">
                            Feedback progresivo por precisión
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {Object.entries(runaSel.explicacion_por_rango).map(([rango, texto]) => (
                              <p key={rango} className="text-[11px] leading-4">
                                <span className="font-black text-primary/70">{rango}%: </span>
                                {texto}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {active === "process" ? (
              <>
                {loadingProcesos ? (
                  <LoadingRow />
                ) : (
                  <SelectDropdown
                    items={procesos}
                    active={procesoSel}
                    getKey={(p) => p.id}
                    getLabel={(p) => p.nombre}
                    onSelect={setProcesoSel}
                    placeholder="Seleccioná un proceso…"
                  />
                )}
                <div className="mt-8 overflow-x-auto rounded-2xl p-7">
                  <div className="flex min-w-[760px] items-center gap-2">
                    <FlowNode title="Entrada" subtitle={procesoSel?.entrada ?? "—"} />
                    <Arrow />
                    <FlowNode title="Transformación" subtitle={procesoSel?.transformacion ?? "—"} tone="accent" />
                    <Arrow />
                    <FlowNode title="Salida" subtitle={procesoSel?.salida ?? "—"} />
                  </div>
                </div>
                <div className="mt-8 grid gap-7 lg:grid-cols-2">
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Condiciones</p>
                    <p className="mt-2 text-xs leading-5 text-primary/50">{procesoSel?.condiciones || "Sin condiciones registradas."}</p>
                  </div>
                  <div className="rounded-2xl p-7">
                    <p className="text-xs font-black text-primary/80">Regla clave / conservación</p>
                    <p className="mt-2 text-xs leading-5 text-primary/50">{procesoSel?.regla_clave || "—"}</p>
                    {procesoSel?.conservacion ? (
                      <p className="mt-2 text-[11px] leading-5 text-primary/40">Conserva: {procesoSel.conservacion}</p>
                    ) : null}
                    {procesoSel?.tipo ? <StatusPill>{procesoSel.tipo}</StatusPill> : null}
                  </div>
                </div>
              </>
            ) : null}

            {active === "elEnlace" ? <EnlaceSection /> : null}

            {(
              [
                ["comparacion", "VIS-18", "Comparación"],
                ["propagacion", "VIS-06", "Propagación"],
                ["tiempo", "VIS-16", "Tiempo"],
                ["mapaUniversal", "VIS-15", "Mapa Universal"],
                ["laboratorio", "VIS-17", "Laboratorio"],
                ["celulasTejido", "VIS-11", "Células → Tejido"],
                ["tejidoOrgano", "VIS-12", "Tejido → Órgano"],
                ["organoOrganismo", "VIS-13", "Órgano → Organismo"],
                ["organismoReinoMundo", "VIS-14", "Organismo → Reino → Mundo"],
              ] as const
            ).map(([key, visId, nombre]) =>
              active === key ? (
                <div key={key} className="rounded-2xl p-7">
                  <p className="text-xs font-black text-primary/80">
                    {nombre} <span className="font-medium text-primary/35">· {visId}</span>
                  </p>
                  <EmptyRow>
                    Diseño pendiente — este VIS está registrado en visualizador_estado (Supabase) pero todavía no
                    tiene sección propia acá. Nada se inventa hasta diseñarlo.
                  </EmptyRow>
                </div>
              ) : null
            )}

          </section>
        </div>
      </div>
    </main>
  );
}

export default VisualizadorPage;

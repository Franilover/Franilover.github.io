"use client";

/**
 * CompuestosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sub-tab "Compuestos" dentro de la sección Tabla: catálogo de combinaciones
 * de Elementos (ej. "Agua" = Fluxio + Cristalio, "Fuego" = Plasmio +
 * Reactivo). Mismo patrón visual que ElementosPage — grid de tarjetas +
 * detalle/editor lateral al seleccionar una, sin navegar a otra ruta.
 *
 * Cada compuesto vive en Supabase (tabla "compuestos") y referencia 2+
 * elementos por id con una cantidad cada uno (componentes: jsonb).
 */

import {
  Atom,
  Beaker,
  ChevronLeft,
  Combine,
  Download,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";
import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import { type SaveStatus } from "@/ui/saveStatus";

import { EditorHeaderBar } from "../_shared/EditorHeaderBar";
import {
  usePublishHeaderControls,
  type EditorHeaderControls,
  type OnHeaderControlsChange,
} from "../_shared/useEditorHeaderControls";
import { ElementoPanelFlotante } from "./ElementosPage";
import { AtomoVisual } from "./ElementoEditor";
import { useCompuestoTags, useTagsCatalogo } from "./useTagsCompuestos";
import { sincronizarComponentesCompuesto } from "./useCompuestosConElementos";
import { useCompuestoEnlaces, type CompuestoEnlaceRow } from "./useCompuestoEnlaces";
import {
  useCompuestoEstabilidad,
  useCompuestoElementosProporcion,
  type CompuestoElementoProporcion,
  type CompuestoEstabilidadRow,
} from "./useCompuestoEstabilidad";
import { useGranos } from "./useGranos";
import { useCelulas } from "./useCelulas";
import { PanelEditorGrano, PanelEditorVeta } from "@/domains/garlia/fisica/CatalogoVetasFisica";
import { PanelEditorCelula, PanelEditorTejido } from "@/domains/garlia/biologia/CatalogoTejidosBiologia";
import { BreadcrumbJerarquia } from "@/domains/garlia/biologia/BreadcrumbJerarquia";
import { GrupoCompuestoPanelFlotante } from "./GruposCompuestosPage";
import { useOrganos } from "./useOrganos";
import { useFormaciones } from "./useFormaciones";
import { useTejidos } from "./useTejidos";
import { useVetas } from "./useVetas";
import type { EntradaCatalogoGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";
import { InfoFormulasPopover } from "./InfoFormulasPopover";

import {
  calcularAfinidad,
  calcularBalancePorCapa,
  calcularCancelacionCarga,
  calcularElectromagnetismo,
  calcularEnlaceResultante,
  calcularPerfilAtomico,
  calcularReactividad,
  combinarComponentes,
  compuestoEsInerte,
  encontrarCompuestoDuplicado,
  generarSimboloCompuesto,
} from "./afinidad";
import {
  AFINIDAD_LABEL,
  ENLACE_LABEL,
  LAYER_LABEL,
  REACTIVIDAD_LABEL,
  propiedadesCalculadasDeCompuesto,
  propiedadesCalculadasDeElemento,
  type ComponenteCompuesto,
  type Compuesto,
  type Elemento,
  type LayerName,
  type PropiedadCalculada,
  type TipoAfinidad,
  type TipoEnlace,
} from "./types";

// ─── Descarga: todos los compuestos en un solo JSON ────────────────────────
// Autocontenido: además de nombre/símbolo/notas/componentes crudos, incluye
// el perfil atómico calculado (suma de partículas por capa) y el balance
// (déficit/superávit) de cada uno, para no depender de recalcularlo al
// volver a importar el archivo.
function descargarDatosCompuestos(compuestos: Compuesto[], elementos: Elemento[]) {
  const compuestosConAnalisis = compuestos.map((c) => {
    const perfil = calcularPerfilAtomico(c, elementos);
    const balance = calcularBalancePorCapa(perfil);
    return {
      ...c,
      componentes_detalle: (c.componentes ?? []).map((comp) => ({
        ...comp,
        elemento: elementos.find((e) => e.id === comp.elemento_id) ?? null,
      })),
      perfil_atomico: perfil,
      balance_por_capa: balance,
    };
  });

  const payload = {
    exportado_en: new Date().toISOString(),
    compuestos: compuestosConAnalisis,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `compuestos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface Props {
  compuestos: Compuesto[];
  elementos: Elemento[];
  loading?: boolean;
  creating?: boolean;
  onCreate?: () => void;
  /**
   * Crea un compuesto ya con componentes definidos (usado por el
   * Laboratorio al combinar dos compuestos existentes). Opcional: si no se
   * pasa, el botón "Crear combinación" del laboratorio queda deshabilitado.
   */
  onCrearConComponentes?: (
    datos: Pick<Compuesto, "nombre" | "simbolo" | "componentes">,
  ) => void;
  onActualizar: (id: string, cambios: Partial<Compuesto>) => void;
  onEliminar?: (id: string) => void;
  seleccionarId?: string | null;
  /** Se llama una vez que seleccionarId fue aplicado (el panel ya se abrió
   *  con ese id) — el caller debe limpiar su estado acá, si no, al cerrar
   *  el panel este vuelve a reabrirse solo porque seleccionarId sigue
   *  teniendo el mismo valor. */
  onSeleccionarIdConsumido?: () => void;
}

function nombreElemento(elementos: Elemento[], id: string): string {
  const el = elementos.find((e) => e.id === id);
  return el ? `${el.simbolo || "??"} · ${el.nombre}` : "(elemento eliminado)";
}

/**
 * Pill de compuesto: solo el nombre, formato chip compacto (mismo espíritu
 * que NodoTitulo en GeografiaJerarquica) — se prioriza legibilidad y
 * densidad sobre el detalle de componentes, que ya se ve al abrir el panel.
 * El punto de "estable" se conserva como señal rápida sin abrir nada.
 */
function CompuestoCasilla({
  compuesto,
  elementos,
  seleccionado,
  onClick,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
  seleccionado?: boolean;
  onClick: () => void;
}) {
  const perfil = useMemo(
    () => calcularPerfilAtomico(compuesto, elementos),
    [compuesto, elementos],
  );
  const balance = useMemo(() => calcularBalancePorCapa(perfil), [perfil]);
  const estable = balance.every((b) => b.balance === 0);

  return (
    <button
      type="button"
      onClick={onClick}
      title={compuesto.nombre}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-bold tracking-wide transition-colors truncate max-w-full ${
        seleccionado
          ? "text-primary border border-primary/40 ring-2 ring-primary/30"
          : "hover:bg-primary/10 text-primary/70 border border-primary/15"
      }`}
    >
      {estable && (
        <span
          title="Estructura atómica completa"
          className="w-1 h-1 rounded-full bg-accent/70 shrink-0"
        />
      )}
      <span className="truncate">{compuesto.nombre}</span>
    </button>
  );
}

/**
 * Representación tipo átomo del compuesto: mismo dibujo (núcleo + capas
 * orbitales con las partículas del mundo) que usa ElementoEditor, pero
 * alimentado con el perfil atómico combinado — la suma de partículas de
 * todos los elementos que lo componen, ya multiplicada por sus cantidades.
 * Como calcularPerfilAtomico devuelve {nucleo, media, externa} con la
 * misma forma (ParticleMap) que un Elemento, no hace falta ningún dibujo
 * nuevo: se reutiliza AtomoVisual pasándole el perfil como si fuera un
 * elemento con esas 3 capas ya combinadas ("molécula" en vez de átomo).
 */
function AtomoVisualCompuesto({
  compuesto,
  elementos,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
}) {
  const perfil = useMemo(
    () => calcularPerfilAtomico(compuesto, elementos),
    [compuesto, elementos],
  );

  return (
    <div className="w-full">
      <AtomoVisual elemento={perfil} className="w-full aspect-square h-auto" />
    </div>
  );
}

const AFINIDAD_COLOR: Record<TipoAfinidad, string> = {
  complementa: "text-primary bg-primary/10 border-primary/20",
  compite: "text-primary/70 bg-primary/5 border-primary/10",
  saturado: "text-primary/40 bg-primary/5 border-primary/10",
  estable: "text-primary/30 bg-primary/[0.02] border-primary/10",
};

const ENLACE_COLOR: Record<TipoEnlace, string> = {
  fuerte: "text-primary bg-primary/10 border-primary/20",
  debil: "text-primary/70 bg-primary/5 border-primary/10",
  neutro: "text-primary/30 bg-primary/[0.02] border-primary/10",
};

/**
 * Sección de solo lectura con las propiedades físicas que Supabase calcula
 * automáticamente (masa, estabilidad, rigidez, compatibilidad, energía de
 * enlace, etc. — columnas directas en "compuestos") a partir de
 * compuesto_elementos + elementos + compuesto_enlaces. Mismo criterio
 * visual que PropiedadesFisicasBloque de ElementoEditor: nunca editable,
 * marcado como "derivado".
 */
function PropiedadesFisicasCompuestoBloque({ propiedades }: { propiedades: PropiedadCalculada[] }) {
  const conValor = propiedades.filter((p) => p.valor !== null);
  if (conValor.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-primary/10 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Propiedades físicas
        </span>
        <InfoFormulasPopover propiedades={conValor} />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {conValor.map((p) => (
          <div
            key={p.clave}
            title={p.descripcion}
            className="flex flex-col gap-1 rounded-md border border-primary/10 px-2 py-1.5"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-micro font-bold text-primary/50 truncate">{p.label}</span>
              <span className="text-micro font-black text-primary/70 tabular-nums shrink-0 truncate max-w-[6.5rem] text-right">
                {p.valor}
              </span>
            </div>
            {p.proporcion !== undefined && (
              <div className="h-1 rounded-full bg-primary/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent/50"
                  style={{ width: `${p.proporcion * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Composición real del compuesto (tabla "compuesto_elementos"): a
 * diferencia de "cantidad" (ahora editada en otro lado, no en este editor),
 * acá se muestra proporcion_molar/proporcion_deducida — la proporción real
 * entre elementos que puede diferir de la cantidad simple (ej. Agua: 4:1 en
 * cantidad pero 10:1 en proporcion_molar) — más las propiedades físicas de
 * cada elemento componente (masa, estabilidad, transparencia, etc., mismas
 * columnas que ElementoEditor → propiedadesCalculadasDeElemento), para ver
 * de un vistazo qué aporta cada elemento a las propiedades del compuesto de
 * arriba sin tener que abrir cada Elemento por separado. Solo lectura.
 */
function ComposicionRealBloque({
  proporciones,
  loading,
  elementos,
  onAbrirElemento,
}: {
  proporciones: CompuestoElementoProporcion[];
  loading: boolean;
  elementos: Elemento[];
  onAbrirElemento?: (elementoId: string) => void;
}) {
  // Propiedades de todos los elementos componentes juntas, para que el
  // popover de info liste la fórmula de cada una una sola vez (no
  // repetida por elemento) — mismo criterio que PropiedadesFisicasBloque.
  // Calculado antes de cualquier return temprano (reglas de hooks).
  const propiedadesParaInfo = useMemo(() => {
    const vistas = new Set<string>();
    const acc: PropiedadCalculada[] = [];
    for (const p of proporciones) {
      const el = elementos.find((e) => e.id === p.elemento_id);
      if (!el) continue;
      for (const prop of propiedadesCalculadasDeElemento(el)) {
        if (prop.valor === null || vistas.has(prop.clave)) continue;
        vistas.add(prop.clave);
        acc.push(prop);
      }
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proporciones, elementos]);

  if (loading || proporciones.length === 0) return null;
  const tieneAlguna = proporciones.some((p) => p.proporcion_molar !== null);
  if (!tieneAlguna) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-primary/10 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Composición real
        </span>
        <InfoFormulasPopover propiedades={propiedadesParaInfo} />
      </div>
      <div className="flex flex-col gap-1">
        {proporciones.map((p) => {
          const el = elementos.find((e) => e.id === p.elemento_id);
          const propiedadesElemento = el
            ? propiedadesCalculadasDeElemento(el).filter((prop) => prop.valor !== null)
            : [];
          return (
            <div
              key={p.id}
              className="flex flex-col gap-1 rounded-md border border-primary/10 px-2 py-1.5"
            >
              <button
                type="button"
                disabled={!onAbrirElemento}
                onClick={() => onAbrirElemento?.(p.elemento_id)}
                title={onAbrirElemento ? "Ver/editar este elemento" : undefined}
                className={`text-micro font-bold text-primary/70 truncate text-left ${
                  onAbrirElemento ? "cursor-pointer hover:underline hover:text-primary" : ""
                }`}
              >
                {el?.simbolo || "??"} · {el?.nombre ?? "—"}
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <span title="Proporción molar" className="text-micro tabular-nums text-primary/60">
                  molar {p.proporcion_molar !== null ? p.proporcion_molar : "—"}
                </span>
                <span
                  title="Proporción deducida (normalizada)"
                  className="text-micro font-black tabular-nums text-primary/70"
                >
                  {p.proporcion_deducida !== null
                    ? `${(p.proporcion_deducida * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
              {propiedadesElemento.length > 0 && (
                <div className="flex items-center gap-x-2.5 gap-y-0.5 flex-wrap pt-0.5 border-t border-primary/[0.06]">
                  {propiedadesElemento.map((prop) => (
                    <span
                      key={prop.clave}
                      title={prop.descripcion}
                      className="text-micro text-primary/45 whitespace-nowrap"
                    >
                      {prop.label} <span className="font-bold text-primary/60">{prop.valor}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Detalle de estabilidad del compuesto (tabla "compuesto_estabilidad"):
 * tensión, calidad de enlaces y complejidad estructural, calculado a partir
 * de compuesto_enlaces — más granular que "estabilidad" (columna directa,
 * ya mostrada en PropiedadesFisicasCompuestoBloque). No todos los
 * compuestos tienen esta fila auxiliar (ver estado_proyecto), por eso
 * devuelve null silenciosamente si no existe.
 */
function EstabilidadDetalleBloque({
  detalle,
  loading,
}: {
  detalle: CompuestoEstabilidadRow | null;
  loading: boolean;
}) {
  if (loading || !detalle) return null;

  const fmt = (v: number | null, digitos = 3) => (v === null ? "—" : v.toFixed(digitos));

  const filas: { label: string; valor: string; descripcion: string }[] = [
    { label: "Tensión", valor: fmt(detalle.tension), descripcion: "Cuánto desbalance/estrés hay entre los enlaces del compuesto." },
    { label: "Calidad de enlaces", valor: fmt(detalle.calidad_enlaces), descripcion: "Qué tan buenos (compatibles y estables) son los enlaces formados." },
    { label: "Complejidad estructural", valor: fmt(detalle.complejidad_estructural), descripcion: "Qué tan compleja es la estructura de enlaces del compuesto." },
    { label: "Coste de organización", valor: fmt(detalle.coste_organizacion), descripcion: "Cuánto \"cuesta\" mantener organizada la estructura del compuesto." },
    { label: "Confianza", valor: fmt(detalle.confianza), descripcion: "Qué tan confiable es este cálculo dado el estado actual de datos." },
  ];

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-primary/10 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Estabilidad — detalle
        </span>
        {detalle.clasificacion && (
          <span className="text-micro font-bold text-primary/50 bg-primary/5 rounded px-1.5 py-0.5">
            {detalle.clasificacion}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {filas.map((f) => (
          <div
            key={f.label}
            title={f.descripcion}
            className="flex items-center justify-between gap-1 rounded-md border border-primary/10 px-2 py-1.5"
          >
            <span className="text-micro font-bold text-primary/50 truncate">{f.label}</span>
            <span className="text-micro font-black text-primary/70 tabular-nums shrink-0">
              {f.valor}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Enlaces reales instanciados del compuesto (tabla "compuesto_enlaces"):
 * el grafo elemento↔elemento que alimenta compuesto_estabilidad — a
 * diferencia de ese bloque (un número agregado por compuesto), acá se ve
 * cada enlace individual con su intensidad/coste/estabilidad/
 * reversibilidad. Solo lectura.
 */
function EnlacesCompuestoBloque({
  enlaces,
  loading,
  error,
  elementos,
  onAbrirElemento,
}: {
  enlaces: CompuestoEnlaceRow[];
  loading: boolean;
  error?: string | null;
  elementos: Elemento[];
  onAbrirElemento?: (elementoId: string) => void;
}) {
  if (loading) return null;
  // Antes: `if (loading || enlaces.length === 0) return null` — un error
  // real de fetch (ver useCompuestoEnlaces) caía en el mismo return null
  // que "este compuesto no tiene enlaces", indistinguible en pantalla.
  // Ahora el error se muestra explícito; solo el caso realmente vacío
  // (sin error, 0 filas) sigue sin renderizar nada.
  if (error) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-red-200 bg-red-50 p-2">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-red-500">
          Enlaces — error al cargar
        </span>
        <span className="text-micro text-red-500/80">{error}</span>
      </div>
    );
  }
  if (enlaces.length === 0) return null;

  const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(2));
  const nombreEl = (id: string) => {
    const el = elementos.find((e) => e.id === id);
    return el ? `${el.simbolo || "??"} · ${el.nombre}` : "—";
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-primary/10 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Enlaces
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {enlaces.map((e) => (
          <div
            key={e.id}
            className="flex flex-col gap-0.5 rounded-md border border-primary/10 px-2 py-1"
          >
            <span className="text-micro font-bold text-primary/70 truncate">
              <button
                type="button"
                disabled={!onAbrirElemento}
                onClick={() => onAbrirElemento?.(e.elemento_a_id)}
                title={onAbrirElemento ? "Ver/editar este elemento" : undefined}
                className={onAbrirElemento ? "cursor-pointer hover:underline hover:text-primary" : ""}
              >
                {nombreEl(e.elemento_a_id)}
              </button>
              {" ↔ "}
              <button
                type="button"
                disabled={!onAbrirElemento}
                onClick={() => onAbrirElemento?.(e.elemento_b_id)}
                title={onAbrirElemento ? "Ver/editar este elemento" : undefined}
                className={onAbrirElemento ? "cursor-pointer hover:underline hover:text-primary" : ""}
              >
                {nombreEl(e.elemento_b_id)}
              </button>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span title="Intensidad" className="text-micro tabular-nums text-primary/50">
                int {fmt(e.intensidad)}
              </span>
              <span title="Coste energético" className="text-micro tabular-nums text-primary/50">
                coste {fmt(e.coste_energetico)}
              </span>
              <span title="Estabilidad" className="text-micro tabular-nums text-primary/50">
                estab {fmt(e.estabilidad)}
              </span>
              <span title="Reversibilidad" className="text-micro tabular-nums text-primary/50">
                rev {fmt(e.reversibilidad)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompuestoEditor({
  compuesto,
  elementos,
  todosLosCompuestos,
  onBack,
  onActualizar,
  onEliminar,
  onHeaderControlsChange,
  onActualizarElemento,
  onNavigateCompuesto,
  granoOCelulaAbierto: granoOCelulaAbiertoProp,
  onGranoOCelulaAbiertoChange,
  onAbrirOrganoOFormacion,
  onAbrirTejidoOVeta,
  elementoAbierto: elementoAbiertoProp,
  onElementoAbiertoChange,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
  todosLosCompuestos: Compuesto[];
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<Compuesto>) => void;
  onEliminar?: (id: string) => void;
  /** Publica los controles de header hacia CompuestoPanelFlotante, que los
   *  renderiza en su propia barra para evitar la barra duplicada. Si no se
   *  pasa, este editor sigue mostrando su propia barra (uso standalone). */
  onHeaderControlsChange?: OnHeaderControlsChange;
  /** Refleja los cambios de un Elemento en el catálogo en memoria del
   *  caller, para que el panel flotante del elemento muestre datos frescos
   *  (mismo patrón que onActualizar de Compuesto). */
  onActualizarElemento?: (id: string, cambios: Partial<Elemento>) => void;
  /** Navega a otro Compuesto donde se usa el elemento que se está viendo
   *  (clic en "Usado en compuestos" dentro del panel de Elemento embebido).
   *  Opcional: si no se pasa, esa lista queda como referencia sin navegar. */
  onNavigateCompuesto?: (compuestoId: string) => void;
  /** Controlado opcionalmente desde CompuestoPanelFlotante, que necesita el
   *  mismo estado para que el breadcrumb del header (Grano/Célula ⇄
   *  Compuesto) navegue al mismo sub-panel que abre "Compone" en el
   *  cuerpo. Si no se pasa, el editor usa su propio estado interno
   *  (uso standalone, sin breadcrumb en header). */
  granoOCelulaAbierto?: { tipo: "grano" | "celula"; id: string } | null;
  onGranoOCelulaAbiertoChange?: (v: { tipo: "grano" | "celula"; id: string } | null) => void;
  /** Salto Compuesto → Célula/Grano → Órgano/Formación (breadcrumb interno
   *  de PanelEditorCelula/PanelEditorGrano). Antes este salto no hacía
   *  nada porque no se pasaban onAbrirOrgano/onAbrirFormacion — bug
   *  reportado ("Hoja → Célula X → Órgano no funciona"). Cierra el
   *  sub-panel de Grano/Célula y delega en CompuestoPanelFlotante, que
   *  tiene el catálogo de Órganos/Formaciones para resolver el registro. */
  onAbrirOrganoOFormacion?: (v: { tipo: "organo" | "formacion"; id: string }) => void;
  /** Salto Compuesto → Célula/Grano → Tejido/Veta (breadcrumb interno de
   *  PanelEditorCelula/PanelEditorGrano, nivel intermedio, no el destino
   *  final Órgano/Formación). Mismo patrón que onAbrirOrganoOFormacion. */
  onAbrirTejidoOVeta?: (v: { tipo: "tejido" | "veta"; id: string }) => void;
  /** Controlado opcionalmente desde CompuestoPanelFlotante, que necesita el
   *  mismo estado para que el breadcrumb del header (Compuesto ⇄ Elemento)
   *  abra el mismo ElementoPanelFlotante que ya abre "Compone" en el
   *  cuerpo. Si no se pasa, el editor usa su propio estado interno (uso
   *  standalone, sin breadcrumb en header) — mismo patrón exacto que
   *  granoOCelulaAbierto. */
  elementoAbierto?: string | null;
  onElementoAbiertoChange?: (id: string | null) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(compuesto);
  const [editandoElementoIdLocal, setEditandoElementoIdLocal] = useState<string | null>(null);
  const editandoElementoId =
    elementoAbiertoProp !== undefined ? elementoAbiertoProp : editandoElementoIdLocal;
  const setEditandoElementoId = onElementoAbiertoChange ?? setEditandoElementoIdLocal;
  // Sub-panel anidado del Grano/Célula elegido desde SeUsaEnGranoOCelulaBloque
  // o desde el breadcrumb del header — mismo patrón que editandoElementoId,
  // pero apunta a una de dos entidades distintas según qué rama se
  // clickeó. Controlable desde afuera (ver props) para que
  // CompuestoPanelFlotante pueda disparar la misma navegación desde su
  // breadcrumb de header.
  const [granoOCelulaAbiertoLocal, setGranoOCelulaAbiertoLocal] = useState<
    { tipo: "grano" | "celula"; id: string } | null
  >(null);
  const granoOCelulaAbierto =
    granoOCelulaAbiertoProp !== undefined ? granoOCelulaAbiertoProp : granoOCelulaAbiertoLocal;
  const setGranoOCelulaAbierto = onGranoOCelulaAbiertoChange ?? setGranoOCelulaAbiertoLocal;

  // useTagsCatalogo/useCompuestoTags (Naturaleza/Oris/Uso) se sacaron de
  // acá: alimentaban solo SelectorTagsCompuesto, que ya no se renderiza en
  // este editor. Siguen vivos en MasonryGruposNaturaleza (vista de
  // catálogo, más abajo en este mismo archivo) sin relación con esto.
  // useUsosCompuesto (bloque "Usado en Item/Mineral/Flora") también se
  // sacó de acá: era informativo, de solo lectura, sobre otras entidades
  // del catálogo — no datos propios de Química.
  // Catálogos globales de Grano/Célula — solo para tener sus handlers
  // actualizar/eliminar disponibles cuando se abre el sub-panel de arriba;
  // useSupabaseData cachea vía Dexie, así que instanciarlos acá no repite
  // fetch si ya se cargaron en Física/Biología. Mismo criterio que
  // CatalogoVetasFisica/CatalogoTejidosBiologia.
  const granosCatalogo = useGranos();
  const celulasCatalogo = useCelulas();

  // Propiedades físicas calculadas por Supabase (masa, estabilidad, rigidez,
  // etc. — columnas directas en "compuestos") + detalle de proporción real
  // por elemento (compuesto_elementos.proporcion_molar/deducida) + análisis
  // de tensión/calidad de enlaces (compuesto_estabilidad). Las 3 fuentes son
  // solo lectura, derivadas — ver propiedadesCalculadasDeCompuesto en types.ts.
  const propiedadesFisicas = useMemo(
    () => propiedadesCalculadasDeCompuesto(local),
    [local],
  );
  const { items: proporcionElementos, loading: proporcionLoading } =
    useCompuestoElementosProporcion(compuesto.id);
  const { item: estabilidadDetalle, loading: estabilidadLoading } = useCompuestoEstabilidad(
    compuesto.id,
  );
  const { items: enlacesCompuesto, loading: enlacesLoading, error: enlacesError } = useCompuestoEnlaces(compuesto.id);

  async function persistElemento(id: string, cambios: Partial<Elemento>) {
    try {
      const { error } = await supabase.from("elementos").update(cambios).eq("id", id);
      if (error) throw error;
      onActualizarElemento?.(id, cambios);
    } catch (e) {
      console.error("[CompuestoEditor] error guardando elemento:", e);
    }
  }

  React.useEffect(() => setLocal(compuesto), [compuesto]);

  async function persist(cambios: Partial<Compuesto>) {
    setSaving(true);
    try {
      // Fase 2 del rediseño: compuestos.componentes (jsonb) quedó @deprecated
      // como respaldo crudo. Un cambio de composición ya no se escribe ahí —
      // se sincroniza contra compuesto_elementos (tabla relacional), que es
      // la fuente real desde la que useCompuestosConElementos reconstruye
      // "componentes" al leer. El resto de columnas (nombre, simbolo, notas,
      // estado, etc.) sigue guardándose igual que siempre.
      const { componentes, ...cambiosSinComponentes } = cambios;

      if (Object.keys(cambiosSinComponentes).length > 0) {
        const { error } = await supabase
          .from("compuestos")
          .update(cambiosSinComponentes)
          .eq("id", compuesto.id);
        if (error) throw error;
      }

      if (componentes !== undefined) {
        const ok = await sincronizarComponentesCompuesto(compuesto.id, componentes);
        if (!ok) throw new Error("no se pudo sincronizar compuesto_elementos");
      }

      onActualizar(compuesto.id, cambios);
    } catch (e) {
      console.error("[CompuestoEditor] error guardando:", e);
    } finally {
      setSaving(false);
    }
  }

  // Símbolo auto-generado a partir de los símbolos de los elementos
  // componentes (ej. 2× Fluxio + 1× Cristalio → "Fl2Cr"). Editable después.
  function handleAutoGenerarSimbolo() {
    const simbolo = generarSimboloCompuesto(local.componentes ?? [], elementos);
    setLocal((p) => ({ ...p, simbolo }));
    persist({ simbolo });
  }

  // Aviso de duplicado: misma combinación exacta de elementos+cantidades
  // ya existe en otro compuesto del catálogo.
  const duplicadoDe = useMemo(
    () =>
      encontrarCompuestoDuplicado(local.componentes ?? [], todosLosCompuestos, compuesto.id),
    [local.componentes, todosLosCompuestos, compuesto.id],
  );

  async function handleEliminar() {
    if (!onEliminar) return;
    const ok = await confirm({
      title: "Eliminar compuesto",
      message: `¿Eliminar "${local.nombre}"? Esta acción no se puede deshacer.`,
    });
    if (ok) onEliminar(compuesto.id);
  }

  function handleGuardar() {
    persist({
      nombre: local.nombre,
      simbolo: local.simbolo,
      notas: local.notas,
      componentes: local.componentes,
    });
  }

  const status: SaveStatus = saving ? "saving" : "idle";

  const headerControls: EditorHeaderControls = {
    prefix: (
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
      >
        <ChevronLeft size={12} />
      </button>
    ),
    nombre: local.nombre ?? "",
    placeholderNombre: "Nombre del compuesto",
    onChangeNombre: (nombre: string) => setLocal((p) => ({ ...p, nombre })),
    onBlurNombre: () => persist({ nombre: local.nombre }),
    status,
    onGuardar: handleGuardar,
    onEliminar: handleEliminar,
    extra: (
      <>
        <input
          value={local.simbolo ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, simbolo: e.target.value }))}
          onBlur={() => persist({ simbolo: local.simbolo })}
          placeholder="Sm"
          maxLength={6}
          className="shrink-0 w-14 text-center bg-primary/5 rounded-md px-1 py-0.5 text-micro font-black text-primary outline-none placeholder:text-primary/25 border border-primary/10"
        />
        <button
          type="button"
          onClick={handleAutoGenerarSimbolo}
          disabled={(local.componentes?.length ?? 0) === 0}
          title="Auto-generar símbolo a partir de los elementos"
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Wand2 size={11} />
        </button>
      </>
    ),
  };

  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />
      {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

      <div className="flex-1 min-h-0 p-2.5 flex flex-col gap-3 overflow-y-auto">
        {duplicadoDe && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-primary/15 bg-primary/5 text-primary/80">
            <span className="text-micro font-bold leading-snug">
              Misma combinación exacta que "{duplicadoDe.simbolo || "??"} · {duplicadoDe.nombre}" —
              ¿es a propósito?
            </span>
          </div>
        )}

        {/* Fila superior: gráfico compacto a la izquierda + Propiedades
            físicas/Estabilidad (ambos bloques de stats cortos, en grid) a
            la derecha — aprovechan mejor el ancho ahí que apilados en una
            columna angosta. Composición real y Enlaces son listas que
            leen mejor a lo ancho, así que van a ancho completo debajo.
            Reemplaza al bloque "Usado en Item/Mineral/Flora" — informativo
            de solo lectura sobre otras entidades del catálogo, no datos
            propios de Química — y a los 4 cuadros de Reactividad/Peso/
            Carga/Enlace que vivían debajo del átomo, ya antiguos y
            redundantes con Propiedades físicas + Estabilidad. */}
        <div className="grid grid-cols-[minmax(11rem,14rem)_1fr] gap-3 items-start">
          <AtomoVisualCompuesto compuesto={local} elementos={elementos} />

          <div className="grid grid-cols-2 gap-3 min-w-0">
            <PropiedadesFisicasCompuestoBloque propiedades={propiedadesFisicas} />
            <EstabilidadDetalleBloque detalle={estabilidadDetalle} loading={estabilidadLoading} />
          </div>
        </div>

        <ComposicionRealBloque
          proporciones={proporcionElementos}
          loading={proporcionLoading}
          elementos={elementos}
          onAbrirElemento={setEditandoElementoId}
        />
        <EnlacesCompuestoBloque
          enlaces={enlacesCompuesto}
          loading={enlacesLoading}
          error={enlacesError}
          elementos={elementos}
          onAbrirElemento={setEditandoElementoId}
        />
      </div>

      {editandoElementoId && (
        <ElementoPanelFlotante
          elemento={elementos.find((e) => e.id === editandoElementoId)!}
          todosLosElementos={elementos}
          onCerrar={() => setEditandoElementoId(null)}
          onActualizar={persistElemento}
          compuestos={todosLosCompuestos}
          onNavigateCompuesto={
            onNavigateCompuesto
              ? (compuestoId) => {
                  setEditandoElementoId(null);
                  onNavigateCompuesto(compuestoId);
                }
              : undefined
          }
        />
      )}

      {/* Sub-panel del Grano/Célula elegido desde "Compone" — mismo editor
         completo que usan Física/Biología (PanelEditorGrano/PanelEditorCelula),
         apilado encima de este panel de Compuesto. */}
      {granoOCelulaAbierto?.tipo === "grano" &&
        (() => {
          const granoActivo = granosCatalogo.items.find((g) => g.id === granoOCelulaAbierto.id);
          if (!granoActivo) return null;
          return (
            <PanelEditorGrano
              item={granoActivo}
              compuestos={todosLosCompuestos}
              onCerrar={() => setGranoOCelulaAbierto(null)}
              onActualizar={granosCatalogo.actualizar}
              onEliminar={granosCatalogo.eliminar}
              onAbrirCompuesto={
                onNavigateCompuesto
                  ? (compuestoId) => {
                      setGranoOCelulaAbierto(null);
                      onNavigateCompuesto(compuestoId);
                    }
                  : undefined
              }
              onAbrirFormacion={
                onAbrirOrganoOFormacion
                  ? (formacionId) => {
                      setGranoOCelulaAbierto(null);
                      onAbrirOrganoOFormacion({ tipo: "formacion", id: formacionId });
                    }
                  : undefined
              }
              onAbrirVeta={
                onAbrirTejidoOVeta
                  ? (vetaId) => {
                      setGranoOCelulaAbierto(null);
                      onAbrirTejidoOVeta({ tipo: "veta", id: vetaId });
                    }
                  : undefined
              }
            />
          );
        })()}
      {granoOCelulaAbierto?.tipo === "celula" &&
        (() => {
          const celulaActiva = celulasCatalogo.items.find((c) => c.id === granoOCelulaAbierto.id);
          if (!celulaActiva) return null;
          return (
            <PanelEditorCelula
              item={celulaActiva}
              compuestos={todosLosCompuestos}
              onCerrar={() => setGranoOCelulaAbierto(null)}
              onActualizar={celulasCatalogo.actualizar}
              onEliminar={celulasCatalogo.eliminar}
              onAbrirCompuesto={
                onNavigateCompuesto
                  ? (compuestoId) => {
                      setGranoOCelulaAbierto(null);
                      onNavigateCompuesto(compuestoId);
                    }
                  : undefined
              }
              onAbrirOrgano={
                onAbrirOrganoOFormacion
                  ? (organoId) => {
                      setGranoOCelulaAbierto(null);
                      onAbrirOrganoOFormacion({ tipo: "organo", id: organoId });
                    }
                  : undefined
              }
              onAbrirTejido={
                onAbrirTejidoOVeta
                  ? (tejidoId) => {
                      setGranoOCelulaAbierto(null);
                      onAbrirTejidoOVeta({ tipo: "tejido", id: tejidoId });
                    }
                  : undefined
              }
            />
          );
        })()}
    </div>
  );
}

/**
 * Panel flotante centrado del detalle de un Compuesto — mismo patrón visual
 * que ElementoPanelFlotante en ElementosPage.tsx (modal grande centrado en
 * pantalla con backdrop blur, animación popIn, Escape para cerrar y bloqueo
 * de scroll del fondo), en vez del drawer lateral que usaba antes.
 */
export function CompuestoPanelFlotante({
  compuesto,
  elementos,
  todosLosCompuestos,
  onCerrar,
  onActualizar,
  onEliminar,
  onNavigateCompuesto,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
  todosLosCompuestos: Compuesto[];
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Compuesto>) => void;
  onEliminar?: (id: string) => void;
  /** Navega a otro Compuesto donde se usa un elemento visto desde acá
   *  (clic en "Usado en compuestos" dentro del panel de Elemento anidado).
   *  Opcional: si no se pasa, esa lista no navega. */
  onNavigateCompuesto?: (compuestoId: string) => void;
}) {
  const [headerControls, setHeaderControls] = useState<EditorHeaderControls | null>(null);
  // Levantado desde CompuestoEditor para que el breadcrumb de acá (header)
  // y el bloque "Compone" del cuerpo compartan el mismo sub-panel — clic en
  // cualquiera de los dos abre el mismo PanelEditorGrano/PanelEditorCelula.
  // Además de controlar qué sub-panel abrir, este estado se usa más abajo
  // para OCULTAR (no desmontar) este panel de Compuesto mientras el
  // sub-panel está abierto: PanelEditorGrano/PanelEditorCelula usan el
  // mismo z-[9999] fijo (createPortal a document.body, igual que este
  // panel y el resto de la cadena Grano⇄Veta⇄Formación /
  // Célula⇄Tejido⇄Órgano), así que sin esto quedaban dos portales al mismo
  // nivel apilados por orden de montaje en vez de por jerarquía real —
  // tapando paneles al abrir un tercer nivel desde ahí. Ocultar en vez de
  // desmontar preserva el estado del editor de Compuesto (nombre sin
  // guardar, etc.) para cuando el usuario vuelve.
  //
  // CompuestoPanelFlotante tampoco se remonta al navegar entre compuestos
  // (el caller no le pasa key={compuesto.id}), así que hay que resetear
  // este estado a mano cuando cambia compuesto.id — si no, queda
  // apuntando al Grano/Célula del compuesto ANTERIOR (ver useEffect abajo).
  const [granoOCelulaAbierto, setGranoOCelulaAbierto] = useState<
    { tipo: "grano" | "celula"; id: string } | null
  >(null);
  // Levantado desde CompuestoEditor (mismo motivo/patrón exacto que
  // granoOCelulaAbierto): el breadcrumb de este header también necesita
  // controlar qué Elemento se abre, para que clickear "Elemento" desde acá
  // y clickear un elemento en el cuerpo (ElementoPanelFlotante embebido)
  // compartan el mismo estado en vez de dos paneles independientes.
  const [elementoAbierto, setElementoAbierto] = useState<string | null>(null);
  // Destino del salto Célula→Órgano / Grano→Formación desde el breadcrumb
  // interno de PanelEditorCelula/PanelEditorGrano (ver onAbrirOrganoOFormacion
  // en CompuestoEditor). Requiere los catálogos de Órganos/Formaciones —
  // GrupoCompuestoPanelFlotante resuelve el resto de su árbol solo.
  const [organoOFormacionAbierto, setOrganoOFormacionAbierto] = useState<
    { tipo: "organo" | "formacion"; id: string } | null
  >(null);
  // Destino del salto Célula→Tejido / Grano→Veta (nivel intermedio, no el
  // Órgano/Formación final) — mismo motivo que organoOFormacionAbierto:
  // antes no se pasaba onAbrirTejido/onAbrirVeta desde acá.
  const [tejidoOVetaAbierto, setTejidoOVetaAbierto] = useState<
    { tipo: "tejido" | "veta"; id: string } | null
  >(null);
  useEffect(() => {
    setGranoOCelulaAbierto(null);
    setOrganoOFormacionAbierto(null);
    setTejidoOVetaAbierto(null);
    setElementoAbierto(null);
  }, [compuesto.id]);
  // granosDeCompuesto/celulasDeCompuesto quitados: solo alimentaban los
  // niveles Grano/Célula del breadcrumb de este header, que ahora es
  // Elemento›Compuesto — granoOCelulaAbierto (abajo) sigue vivo porque
  // controla el sub-panel del bloque "Compone" en el cuerpo, sin relación
  // con el header.
  const organosCatalogo = useOrganos();
  const formacionesCatalogo = useFormaciones();
  const tejidosCatalogo = useTejidos();
  const vetasCatalogoNivel2 = useVetas();
  const celulasCatalogoNivel2 = useCelulas();
  const granosCatalogoNivel2 = useGranos();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCerrar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 ${
        granoOCelulaAbierto || organoOFormacionAbierto || tejidoOVetaAbierto || elementoAbierto
          ? "invisible pointer-events-none"
          : ""
      }`}
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          {headerControls ? (
            <>
              {headerControls.prefix}
              <input
                className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
                placeholder={headerControls.placeholderNombre}
                value={headerControls.nombre ?? ""}
                onChange={(e) => headerControls.onChangeNombre(e.target.value)}
                onBlur={headerControls.onBlurNombre}
              />
              {headerControls.extra}
              <div className="shrink-0 flex items-center gap-1.5">
                <SaveIndicator status={headerControls.status} />
                <button
                  type="button"
                  onClick={headerControls.onEliminar}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
                >
                  <Trash2 size={10} />
                </button>
                <button
                  type="button"
                  disabled={headerControls.status === "saving"}
                  onClick={headerControls.onGuardar}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
                >
                  <Save size={10} /> Guardar
                </button>
              </div>
            </>
          ) : (
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                background: "color-mix(in srgb, var(--primary) 8%, transparent)",
                borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
              }}
            >
              <Beaker className="text-primary/50" size={12} />
            </div>
          )}
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="shrink-0 px-3 pt-2">
          <BreadcrumbJerarquia
            niveles={[
              {
                label: "Elemento",
                icono: <Atom size={10} />,
                activo: false,
                // Composición real de este Compuesto — mismos componentes
                // (elemento_id + cantidad) que ya resuelve el bloque
                // "Compone" del cuerpo, no un fetch nuevo.
                items: (compuesto.componentes ?? []).map((comp) => ({
                  id: comp.elemento_id,
                  nombre:
                    elementos.find((e) => e.id === comp.elemento_id)?.nombre ??
                    "(elemento desconocido)",
                })),
                loading: false,
                onNavegar: setElementoAbierto,
              },
              { label: "Compuesto", icono: <Package size={10} />, activo: true },
            ]}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <CompuestoEditor
            key={compuesto.id}
            compuesto={compuesto}
            elementos={elementos}
            todosLosCompuestos={todosLosCompuestos}
            onBack={onCerrar}
            onActualizar={onActualizar}
            onEliminar={
              onEliminar
                ? (id) => {
                    onEliminar(id);
                  }
                : undefined
            }
            onHeaderControlsChange={setHeaderControls}
            onNavigateCompuesto={onNavigateCompuesto}
            granoOCelulaAbierto={granoOCelulaAbierto}
            onGranoOCelulaAbiertoChange={setGranoOCelulaAbierto}
            onAbrirOrganoOFormacion={setOrganoOFormacionAbierto}
            onAbrirTejidoOVeta={setTejidoOVetaAbierto}
            elementoAbierto={elementoAbierto}
            onElementoAbiertoChange={setElementoAbierto}
          />
        </div>
      </div>

      {elementoAbierto &&
        (() => {
          const elementoActivo = elementos.find((e) => e.id === elementoAbierto);
          if (!elementoActivo) return null;
          return (
            <ElementoPanelFlotante
              elemento={elementoActivo}
              todosLosElementos={elementos}
              onCerrar={() => setElementoAbierto(null)}
              onActualizar={async (id, cambios) => {
                // El elemento vive en el catálogo global (elementos), no en
                // este compuesto puntual — persiste directo, mismo patrón
                // exacto que persistElemento dentro de CompuestoEditor (no
                // se puede reusar esa función porque vive en otro
                // componente y el catálogo en memoria acá es de solo
                // lectura vía props, sin setter propio).
                try {
                  const { error } = await supabase
                    .from("elementos")
                    .update(cambios)
                    .eq("id", id);
                  if (error) throw error;
                } catch (e) {
                  console.error(
                    "[CompuestoPanelFlotante] error guardando elemento:",
                    e,
                  );
                }
              }}
              compuestos={todosLosCompuestos}
              onNavigateCompuesto={(compuestoId) => {
                setElementoAbierto(null);
                onNavigateCompuesto?.(compuestoId);
              }}
            />
          );
        })()}

      {organoOFormacionAbierto?.tipo === "organo" &&
        (() => {
          const organoActivo = organosCatalogo.items.find(
            (o) => o.id === organoOFormacionAbierto.id,
          );
          if (!organoActivo) return null;
          return (
            <GrupoCompuestoPanelFlotante
              grupo={organoActivo as unknown as EntradaCatalogoGrupo}
              tipo="organo"
              compuestos={todosLosCompuestos}
              onCerrar={() => setOrganoOFormacionAbierto(null)}
              onActualizar={(id, cambios) =>
                organosCatalogo.setItems((items) =>
                  items.map((o) => (o.id === id ? { ...o, ...cambios } : o)),
                )
              }
              onAbrirCompuesto={
                onNavigateCompuesto
                  ? (compuestoId) => {
                      setOrganoOFormacionAbierto(null);
                      onNavigateCompuesto(compuestoId);
                    }
                  : undefined
              }
            />
          );
        })()}
      {organoOFormacionAbierto?.tipo === "formacion" &&
        (() => {
          const formacionActiva = formacionesCatalogo.items.find(
            (f) => f.id === organoOFormacionAbierto.id,
          );
          if (!formacionActiva) return null;
          return (
            <GrupoCompuestoPanelFlotante
              grupo={formacionActiva as unknown as EntradaCatalogoGrupo}
              tipo="formacion"
              compuestos={todosLosCompuestos}
              onCerrar={() => setOrganoOFormacionAbierto(null)}
              onActualizar={(id, cambios) =>
                formacionesCatalogo.setItems((items) =>
                  items.map((f) => (f.id === id ? { ...f, ...cambios } : f)),
                )
              }
              onAbrirCompuesto={
                onNavigateCompuesto
                  ? (compuestoId) => {
                      setOrganoOFormacionAbierto(null);
                      onNavigateCompuesto(compuestoId);
                    }
                  : undefined
              }
            />
          );
        })()}

      {/* Panel del Tejido/Veta abierto desde el breadcrumb intermedio
         "Célula → Tejido" / "Grano → Veta" — mismo editor único que usan
         Física/Biología (PanelEditorTejido/PanelEditorVeta), apilado al
         mismo nivel que organoOFormacionAbierto (ambos ocultan este panel
         de Compuesto mientras están abiertos). Desde acá también se puede
         seguir subiendo a Órgano/Formación, o volver a bajar a
         Célula/Grano — reutiliza los mismos estados de arriba. */}
      {tejidoOVetaAbierto?.tipo === "tejido" &&
        (() => {
          const tejidoActivo = tejidosCatalogo.items.find((t) => t.id === tejidoOVetaAbierto.id);
          if (!tejidoActivo) return null;
          return (
            <PanelEditorTejido
              item={tejidoActivo}
              celulas={celulasCatalogoNivel2.items}
              loadingCelulas={celulasCatalogoNivel2.loading}
              compuestos={todosLosCompuestos}
              onCerrar={() => setTejidoOVetaAbierto(null)}
              onActualizar={tejidosCatalogo.actualizar}
              onEliminar={tejidosCatalogo.eliminar}
              onAbrirCompuesto={
                onNavigateCompuesto
                  ? (compuestoId) => {
                      setTejidoOVetaAbierto(null);
                      onNavigateCompuesto(compuestoId);
                    }
                  : undefined
              }
              onAbrirCelula={(celulaId) => {
                setTejidoOVetaAbierto(null);
                setGranoOCelulaAbierto({ tipo: "celula", id: celulaId });
              }}
              onAbrirOrgano={(organoId) => {
                setTejidoOVetaAbierto(null);
                setOrganoOFormacionAbierto({ tipo: "organo", id: organoId });
              }}
            />
          );
        })()}
      {tejidoOVetaAbierto?.tipo === "veta" &&
        (() => {
          const vetaActiva = vetasCatalogoNivel2.items.find((v) => v.id === tejidoOVetaAbierto.id);
          if (!vetaActiva) return null;
          return (
            <PanelEditorVeta
              item={vetaActiva}
              granos={granosCatalogoNivel2.items}
              loadingGranos={granosCatalogoNivel2.loading}
              onCerrar={() => setTejidoOVetaAbierto(null)}
              onActualizar={vetasCatalogoNivel2.actualizar}
              onEliminar={vetasCatalogoNivel2.eliminar}
              onAbrirGrano={(granoId) => {
                setTejidoOVetaAbierto(null);
                setGranoOCelulaAbierto({ tipo: "grano", id: granoId });
              }}
              onAbrirFormacion={(formacionId) => {
                setTejidoOVetaAbierto(null);
                setOrganoOFormacionAbierto({ tipo: "formacion", id: formacionId });
              }}
            />
          );
        })()}
    </div>,
    document.body,
  );
}

/**
 * Laboratorio: combinar dos compuestos existentes en uno nuevo. Muestra la
 * afinidad entre los dos elegidos y, si el
 * usuario confirma, arma un compuesto nuevo con la unión de sus componentes
 * (combinarComponentes) — punto de partida en vez de armar desde cero.
 */
function LaboratorioModal({
  compuestos,
  elementos,
  onCerrar,
  onCrear,
}: {
  compuestos: Compuesto[];
  elementos: Elemento[];
  onCerrar: () => void;
  onCrear?: (datos: Pick<Compuesto, "nombre" | "simbolo" | "componentes">) => void;
}) {
  const [idA, setIdA] = useState<string>(compuestos[0]?.id ?? "");
  const [idB, setIdB] = useState<string>(compuestos[1]?.id ?? "");
  const [nombreNuevo, setNombreNuevo] = useState("");

  const compA = compuestos.find((c) => c.id === idA) ?? null;
  const compB = compuestos.find((c) => c.id === idB) ?? null;
  const mismosElegidos = idA && idB && idA === idB;

  const afinidad = useMemo(
    () => (compA && compB && !mismosElegidos ? calcularAfinidad(compA, compB, elementos) : null),
    [compA, compB, mismosElegidos, elementos],
  );

  // Ley de Cancelación de Carga: ¿la Voluntad libre de uno cancela los
  // huecos de Percepción del otro? Es el criterio de compatibilidad real
  // según reglas-sistema-actualizado.md — independiente del balance de
  // capas que ya usa `afinidad` arriba.
  const cancelacionCarga = useMemo(
    () => (compA && compB && !mismosElegidos ? calcularCancelacionCarga(compA, compB, elementos) : null),
    [compA, compB, mismosElegidos, elementos],
  );

  // Enlace Resultante: proporción Transición/Catálisis combinada — define
  // si el compuesto resultante sería fuerte/permanente o débil/metaestable.
  const enlace = useMemo(
    () => (compA && compB && !mismosElegidos ? calcularEnlaceResultante(compA, compB, elementos) : null),
    [compA, compB, mismosElegidos, elementos],
  );

  // Electromagnetismo Derivado: corriente (flujo de Voluntad por huecos de
  // Percepción) y si esa corriente + la Cinética del núcleo inducen campo.
  const electromagnetismo = useMemo(
    () => (compA && compB && !mismosElegidos ? calcularElectromagnetismo(compA, compB, elementos) : null),
    [compA, compB, mismosElegidos, elementos],
  );

  const componentesCombinados = useMemo(
    () => (compA && compB && !mismosElegidos ? combinarComponentes(compA, compB) : []),
    [compA, compB, mismosElegidos],
  );

  const simboloSugerido = useMemo(
    () =>
      componentesCombinados.length > 0
        ? generarSimboloCompuesto(componentesCombinados, elementos)
        : "",
    [componentesCombinados, elementos],
  );

  // Vista "probeta": balance y reactividad del resultado de la mezcla en
  // vivo, antes de confirmar la combinación — mismo cálculo que el editor
  // de un compuesto ya creado, aplicado acá a la mezcla en curso.
  const compuestoPreview: Compuesto | null =
    componentesCombinados.length > 0
      ? { id: "__preview__", nombre: nombreNuevo || "Mezcla", componentes: componentesCombinados }
      : null;
  const balancePreview = useMemo(
    () =>
      compuestoPreview
        ? calcularBalancePorCapa(calcularPerfilAtomico(compuestoPreview, elementos))
        : [],
    [compuestoPreview, elementos],
  );
  const reactividadPreview = useMemo(
    () => (compuestoPreview ? calcularReactividad(compuestoPreview, elementos) : null),
    [compuestoPreview, elementos],
  );

  function crear() {
    if (!compA || !compB || mismosElegidos) return;
    onCrear?.({
      nombre: nombreNuevo.trim() || `${compA.nombre} + ${compB.nombre}`,
      simbolo: simboloSugerido || "??",
      componentes: componentesCombinados,
    });
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm" onClick={onCerrar} />
      <div
        className="relative z-10 flex flex-col w-full max-w-md max-h-[calc(100vh-2rem)] rounded-[var(--radius-card)] border shadow-2xl overflow-hidden"
        style={{
          background: "var(--white-custom, var(--bg-main))",
          borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
      >
        <div
          style={{ background: "var(--bg-main)" }}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
        >
          <Combine size={12} className="text-primary/40" />
          <p className="flex-1 min-w-0 text-micro font-black uppercase tracking-widest text-primary/70">
            Laboratorio · combinar compuestos
          </p>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto">
          {compuestos.length < 2 ? (
            <p className="text-micro text-primary/25 text-center py-4">
              Necesitás al menos 2 compuestos creados para combinar.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                    Compuesto A
                  </label>
                  <select
                    value={idA}
                    onChange={(e) => setIdA(e.target.value)}
                    className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
                  >
                    {compuestos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.simbolo || "??"} · {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                    Compuesto B
                  </label>
                  <select
                    value={idB}
                    onChange={(e) => setIdB(e.target.value)}
                    className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
                  >
                    {compuestos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.simbolo || "??"} · {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {mismosElegidos ? (
                <p className="text-micro text-primary/80 bg-primary/5 border border-primary/10 rounded-md px-2 py-1.5">
                  Elegí dos compuestos distintos.
                </p>
              ) : (
                afinidad && (
                  <div
                    className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md border ${AFINIDAD_COLOR[afinidad.tipo]}`}
                  >
                    <span className="text-micro font-black uppercase tracking-wide">
                      {AFINIDAD_LABEL[afinidad.tipo]}
                    </span>
                  </div>
                )
              )}

              {!mismosElegidos && cancelacionCarga && enlace && electromagnetismo && compA && compB && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                    Química real · Voluntad ↔ Percepción
                  </label>

                  {(compuestoEsInerte(compA, elementos) || compuestoEsInerte(compB, elementos)) && (
                    <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-md border text-primary/80 bg-primary/5 border-primary/10">
                      <span className="text-micro font-black uppercase tracking-wide">
                        Estado Noble: bloquea el enlace
                      </span>
                      <span className="text-micro font-normal opacity-80">
                        {compuestoEsInerte(compA, elementos) ? compA.nombre : compB.nombre} tiene su
                        Capa Externa 100% saturada — no puede iniciar ni aceptar enlaces nuevos,
                        sin importar el balance de cargas.
                      </span>
                    </div>
                  )}

                  <div
                    className={`flex flex-col gap-1 px-2 py-1.5 rounded-md border ${
                      cancelacionCarga.compatible
                        ? "text-primary/80 bg-primary/5 border-primary/10"
                        : "text-primary/30 bg-primary/[0.02] border-primary/10"
                    }`}
                  >
                    <span className="text-micro font-black uppercase tracking-wide">
                      {cancelacionCarga.compatible
                        ? "Cancelación de carga compatible"
                        : "Sin cancelación de carga"}
                    </span>
                    <span className="text-micro font-normal opacity-80">
                      {compA.simbolo || compA.nombre} → {compB.simbolo || compB.nombre}:{" "}
                      {cancelacionCarga.voluntadAaPercepcionB} · {compB.simbolo || compB.nombre} →{" "}
                      {compA.simbolo || compA.nombre}: {cancelacionCarga.voluntadBaPercepcionA}
                    </span>
                  </div>

                  <div
                    className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md border ${ENLACE_COLOR[enlace.tipo]}`}
                  >
                    <span className="text-micro font-black uppercase tracking-wide">
                      {ENLACE_LABEL[enlace.tipo]}
                    </span>
                    <span className="text-micro font-normal opacity-80">
                      Transición {enlace.totalTransicion} · Catálisis {enlace.totalCatalisis}
                    </span>
                  </div>

                  <div
                    className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md border ${
                      electromagnetismo.generaCampoMagnetico
                        ? "text-primary/80 bg-primary/5 border-primary/10"
                        : electromagnetismo.corriente > 0
                          ? "text-primary/50 bg-primary/5 border-primary/10"
                          : "text-primary/30 bg-primary/[0.02] border-primary/10"
                    }`}
                  >
                    <span className="text-micro font-black uppercase tracking-wide">
                      {electromagnetismo.generaCampoMagnetico
                        ? "Genera campo magnético"
                        : electromagnetismo.corriente > 0
                          ? "Corriente sin campo (falta Cinética)"
                          : "Sin corriente eléctrica"}
                    </span>
                    <span className="text-micro font-normal opacity-80">
                      Corriente {electromagnetismo.corriente} · Cinética {electromagnetismo.cineticaTotal}
                    </span>
                  </div>
                </div>
              )}

              {!mismosElegidos && componentesCombinados.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                    Vista de probeta · resultado de la mezcla
                  </label>
                  <div className="rounded-lg border border-primary/10 overflow-hidden">
                    {balancePreview.map((b, i) => (
                      <div
                        key={b.layer}
                        className={`flex items-center gap-1.5 px-2 py-1 bg-primary/[0.02] ${
                          i > 0 ? "border-t border-primary/10" : ""
                        }`}
                      >
                        <span className="w-14 shrink-0 text-micro font-bold text-primary/60">
                          {LAYER_LABEL[b.layer as LayerName]}
                        </span>
                        <span className="flex-1 text-micro text-primary/40 tabular-nums">
                          {b.total} / {b.capacidad}
                        </span>
                        <span
                          className={`shrink-0 text-micro font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            b.balance === 0
                              ? "text-primary/30"
                              : "text-primary/70 bg-primary/10"
                          }`}
                        >
                          {b.balance === 0 ? "Completa" : b.balance > 0 ? `+${b.balance} sobra` : `${b.balance} falta`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {reactividadPreview && (
                    <p className="text-micro text-primary/40">
                      Reactividad resultante:{" "}
                      <span className="font-black text-primary/70">
                        {REACTIVIDAD_LABEL[reactividadPreview.nivel]}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {!mismosElegidos && componentesCombinados.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                    Nombre del nuevo compuesto
                  </label>
                  <input
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                    placeholder={compA && compB ? `${compA.nombre} + ${compB.nombre}` : ""}
                    className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25 placeholder:font-normal"
                  />
                  <p className="text-micro text-primary/40">
                    Símbolo sugerido: <span className="font-black text-primary/70">{simboloSugerido}</span> ·{" "}
                    {componentesCombinados.length} elemento(s) combinados
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {compuestos.length >= 2 && (
          <div
            style={{ background: "var(--bg-main)" }}
            className="shrink-0 flex items-center justify-end gap-1.5 px-2.5 py-1.5 border-t border-primary/10"
          >
            <button
              type="button"
              onClick={onCerrar}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={crear}
              disabled={!onCrear || mismosElegidos || componentesCombinados.length === 0}
              title={!onCrear ? "No disponible" : undefined}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <Combine size={10} />
              Crear combinación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MasonryGruposNaturaleza
 * ───────────────────────────────────────────────────────────────────────────
 * Reparte los grupos de compuestos (por Naturaleza) en columnas de igual
 * ancho, cada grupo asignado a la columna con menor altura acumulada
 * (masonry greedy, mismo criterio que distribuirEnColumnas en
 * GeografiaJerarquica.tsx). Como ahora cada compuesto es solo una pill de
 * texto, la altura de un grupo depende de cuántas pills entran por fila
 * dado el ancho de columna — se estima con el mismo enfoque de "simular el
 * wrap" en vez de medir el DOM, para poder recalcular las columnas antes
 * de pintar.
 */
function MasonryGruposNaturaleza({
  grupos,
  elementos,
  activoId,
  onSeleccionar,
}: {
  grupos: { id: string; nombre: string; compuestos: Compuesto[] }[];
  elementos: Elemento[];
  activoId: string | null;
  onSeleccionar: (id: string) => void;
}) {
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

  const GAP = 16;
  const ANCHO_MIN_COLUMNA = 240;
  const anchoDisponible = containerWidth || 900;
  const numColumnas = Math.max(
    1,
    Math.floor((anchoDisponible + GAP) / (ANCHO_MIN_COLUMNA + GAP)),
  );
  const anchoColumna = (anchoDisponible - GAP * (numColumnas - 1)) / numColumnas;

  // Estimación de altura de una pill según su ancho de texto (aprox. 5px
  // por carácter a text-micro + padding del chip), para simular el
  // flex-wrap real sin medir el DOM.
  const PILL_ALTO = 26;
  const PILL_GAP = 4;
  const anchoPill = (nombre: string) => Math.min(Math.max(nombre.length * 5 + 32, 60), anchoColumna);

  const altoGrupo = (grupo: { nombre: string; compuestos: Compuesto[] }) => {
    const tituloAlto = 20;
    let filas = 1;
    let anchoFila = 0;
    for (const c of grupo.compuestos) {
      const w = anchoPill(c.nombre);
      const necesario = anchoFila === 0 ? w : anchoFila + PILL_GAP + w;
      if (anchoFila === 0 || necesario <= anchoColumna) {
        anchoFila = necesario;
      } else {
        filas += 1;
        anchoFila = w;
      }
    }
    return tituloAlto + filas * PILL_ALTO + (filas - 1) * PILL_GAP;
  };

  function distribuirEnColumnas() {
    const columnas: { id: string; nombre: string; compuestos: Compuesto[] }[][] = Array.from(
      { length: numColumnas },
      () => [],
    );
    const alturas = new Array(numColumnas).fill(0);
    for (const grupo of grupos) {
      let idxMin = 0;
      for (let i = 1; i < numColumnas; i++) {
        if (alturas[i] < alturas[idxMin]) idxMin = i;
      }
      columnas[idxMin].push(grupo);
      alturas[idxMin] += altoGrupo(grupo) + GAP;
    }
    return columnas;
  }

  const columnas = useMemo(
    () => distribuirEnColumnas(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grupos, numColumnas, anchoColumna],
  );

  return (
    <div ref={containerRef} className="flex gap-4 items-start">
      {columnas.map((columna, i) => (
        <div key={i} className="flex flex-col gap-4 min-w-0" style={{ width: anchoColumna }}>
          {columna.map((grupo) => (
            <div key={grupo.id}>
              <div className="mb-1 px-1 text-micro font-bold uppercase tracking-[0.12em] text-primary/40">
                {grupo.nombre}
              </div>
              <div className="flex flex-wrap gap-1">
                {grupo.compuestos.map((c) => (
                  <CompuestoCasilla
                    key={c.id}
                    compuesto={c}
                    elementos={elementos}
                    seleccionado={c.id === activoId}
                    onClick={() => onSeleccionar(c.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CompuestosPage({
  compuestos,
  elementos,
  loading,
  creating,
  onCreate,
  onCrearConComponentes,
  onActualizar,
  onEliminar,
  seleccionarId,
  onSeleccionarIdConsumido,
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [laboratorioAbierto, setLaboratorioAbierto] = useState(false);

  // Agrupamiento por Naturaleza (eje "naturaleza" del sistema de tags) —
  // mismo espíritu que Personajes/Criaturas agrupados por su jerarquía:
  // una sección por cada tag de naturaleza que tenga al menos un compuesto,
  // más un bloque final "Sin naturaleza" para los que no tienen tag de ese
  // eje asignado. Se arma acá (y no en useTagsCompuestos) porque es una
  // vista, no un dato — la fuente de verdad sigue siendo la tabla relacional.
  const { porCategoria: tagsPorCategoria } = useTagsCatalogo();
  const { tagIdsDe } = useCompuestoTags();
  const tagsNaturaleza = tagsPorCategoria.naturaleza;

  const gruposPorNaturaleza = useMemo(() => {
    const mapa = new Map<string, Compuesto[]>();
    for (const tag of tagsNaturaleza) mapa.set(tag.id, []);
    const sinNaturaleza: Compuesto[] = [];

    for (const c of compuestos) {
      const tagIds = tagIdsDe(c.id);
      const tagNaturaleza = tagsNaturaleza.find((t) => tagIds.has(t.id));
      if (tagNaturaleza) {
        mapa.get(tagNaturaleza.id)!.push(c);
      } else {
        sinNaturaleza.push(c);
      }
    }

    const grupos = tagsNaturaleza
      .map((tag) => ({ id: tag.id, nombre: tag.nombre, compuestos: mapa.get(tag.id)! }))
      .filter((g) => g.compuestos.length > 0);

    if (sinNaturaleza.length > 0) {
      grupos.push({ id: "__sin-naturaleza__", nombre: "Sin naturaleza", compuestos: sinNaturaleza });
    }

    return { grupos, sinNaturaleza };
  }, [compuestos, tagsNaturaleza, tagIdsDe]);

  // Permite que el caller fuerce la apertura de un compuesto específico
  // desde afuera (ej. al navegar desde "Usado en compuestos" en el editor
  // de un Elemento). seleccionadoId pasa a ser la única fuente de verdad
  // tras aplicarlo — así "cerrar" realmente cierra, en vez de reabrirse
  // porque seleccionarId sigue teniendo el mismo id.
  useEffect(() => {
    if (seleccionarId) {
      setSeleccionadoId(seleccionarId);
      onSeleccionarIdConsumido?.();
    }
  }, [seleccionarId]);

  const activoId = seleccionadoId;
  const activo = useMemo(
    () => compuestos.find((c) => c.id === activoId) ?? null,
    [compuestos, activoId],
  );

  return (
    <div className="flex relative">
      <div className="flex-1 p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-primary/40">
            <p className="text-micro font-black uppercase tracking-widest">
              Compuestos
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              disabled={compuestos.length < 2}
              onClick={() => setLaboratorioAbierto(true)}
              title="Combinar dos compuestos existentes en uno nuevo"
              className="flex items-center justify-center p-1.5 rounded-md border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Combine size={14} />
            </button>

            <button
              type="button"
              disabled={compuestos.length === 0}
              onClick={() => descargarDatosCompuestos(compuestos, elementos)}
              title="Descargar todos los compuestos como JSON"
              className="flex items-center justify-center p-1.5 rounded-md border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Download size={14} />
            </button>

            {onCreate && (
              <button
                type="button"
                disabled={creating || elementos.length === 0}
                onClick={onCreate}
                title={
                  elementos.length === 0
                    ? "Primero cargá elementos en la Tabla Química"
                    : "Nuevo compuesto"
                }
                className="flex items-center justify-center p-1.5 rounded-md bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              </button>
            )}
          </div>
        </div>

        {loading && compuestos.length === 0 ? (
          <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
        ) : compuestos.length === 0 ? (
          <div className="py-6 text-micro text-primary/25 text-center">
            Todavía no hay compuestos creados.
          </div>
        ) : (
          <MasonryGruposNaturaleza
            grupos={gruposPorNaturaleza.grupos}
            elementos={elementos}
            activoId={activoId}
            onSeleccionar={(id) =>
              setSeleccionadoId((actual) => (actual === id ? null : id))
            }
          />
        )}
      </div>

      {/* Panel flotante centrado: mismo patrón que ElementoPanelFlotante en
          ElementosPage.tsx — modal grande centrado en pantalla con backdrop
          blur, en vez del drawer lateral que usaba antes. Se cierra con
          click en el backdrop, Escape, o el botón X. */}
      {activo && (
        <CompuestoPanelFlotante
          compuesto={activo}
          elementos={elementos}
          todosLosCompuestos={compuestos}
          onCerrar={() => setSeleccionadoId(null)}
          onActualizar={onActualizar}
          onEliminar={
            onEliminar
              ? (id) => {
                  onEliminar(id);
                  setSeleccionadoId(null);
                }
              : undefined
          }
          onNavigateCompuesto={setSeleccionadoId}
        />
      )}

      {laboratorioAbierto && (
        <LaboratorioModal
          compuestos={compuestos}
          elementos={elementos}
          onCerrar={() => setLaboratorioAbierto(false)}
          onCrear={onCrearConComponentes}
        />
      )}
    </div>
  );
}

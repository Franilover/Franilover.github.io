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
import {
  sincronizarComponentesCompuesto,
  agregarElementoACompuesto,
  quitarElementoDeCompuesto,
  actualizarCantidadElemento,
  actualizarRolElemento,
} from "./useCompuestosConElementos";
import {
  useCompuestoEnlaces,
  useEnlaceSitiosParaPar,
  agregarEnlaceACompuesto,
  quitarEnlaceDeCompuesto,
  type CompuestoEnlaceRow,
} from "./useCompuestoEnlaces";
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
import { TarjetaPropiedadesFisicas } from "../_shared/GridPropiedadesCalculadas";
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
/**
 * Fórmula expandida de un Compuesto para el header ("1 Cn + 2 Ep + 1 Fu"):
 * se arma pura y exclusivamente desde compuesto_elementos (cantidad real,
 * ver CompuestoElementoProporcion) + el símbolo real de cada elemento del
 * catálogo — no un segundo cálculo independiente ni un campo duplicado.
 * NO deriva de enlaces, proporcion_molar/deducida ni ninguna propiedad
 * visual: eso describe otra cosa (la proporción real puede diferir de la
 * cantidad simple, ver ComposicionRealBloque), acá específicamente se pide
 * la cantidad canónica de compuesto_elementos.cantidad.
 *
 * Orden: el orden en que ya llegan las filas de compuesto_elementos (mismo
 * orden que usa ComposicionRealBloque para listarlas) — no hay columna
 * "orden" en el schema, así que no se inventa un criterio de reordenamiento
 * en frontend (alfabético, por número atómico, etc.).
 *
 * Devuelve null si la composición está vacía o si algún elemento no
 * resuelve contra el catálogo (no se inventa "??" en el header — mejor no
 * mostrar fórmula que mostrar una incompleta/falsa).
 */
function formulaExpandidaCompuesto(
  proporciones: CompuestoElementoProporcion[],
  elementos: Elemento[],
): string | null {
  if (proporciones.length === 0) return null;

  const partes: string[] = [];
  for (const p of proporciones) {
    const el = elementos.find((e) => e.id === p.elemento_id);
    if (!el || !el.simbolo) return null;
    partes.push(`${p.cantidad} ${el.simbolo}`);
  }
  return partes.join(" + ");
}

function PropiedadesFisicasCompuestoBloque({ propiedades }: { propiedades: PropiedadCalculada[] }) {
  // columnas=4 (antes 5): con Estabilidad-detalle + las columnas de
  // clasificación/estructura fundidas (ver auditoría 2026-08-30), varias
  // etiquetas nuevas son largas ("Tipo de estructura (derivada)", "Razón de
  // clasificación") — 5 columnas las apretaba demasiado.
  return <TarjetaPropiedadesFisicas propiedades={propiedades} columnas={4} />;
}

/**
 * Composición real del compuesto (tabla "compuesto_elementos"): muestra
 * proporcion_molar/proporcion_deducida — la proporción real entre
 * elementos, que puede diferir de la cantidad simple (ej. Agua: 4:1 en
 * cantidad pero 10:1 en proporcion_molar) — más las propiedades físicas de
 * cada elemento componente (masa, estabilidad, transparencia, etc., mismas
 * columnas que ElementoEditor → propiedadesCalculadasDeElemento), para ver
 * de un vistazo qué aporta cada elemento a las propiedades del compuesto de
 * arriba sin tener que abrir cada Elemento por separado.
 *
 * Editable: cantidad y rol de cada fila, agregar un elemento nuevo del
 * catálogo (con cantidad+rol), quitar una fila. proporcion_molar/
 * proporcion_deducida siguen siendo de solo lectura — las calcula Supabase
 * a partir de cantidad, no se escriben nunca desde acá.
 */
function ComposicionRealBloque({
  compuestoId,
  proporciones,
  loading,
  elementos,
  onAbrirElemento,
  onRecargar,
}: {
  compuestoId: string;
  proporciones: CompuestoElementoProporcion[];
  loading: boolean;
  elementos: Elemento[];
  onAbrirElemento?: (elementoId: string) => void;
  /** Refresca proporcionElementos en el caller (CompuestoEditor) después de
   *  cada mutación — mismo patrón que "load"/"refetch" de useSupabaseData. */
  onRecargar: () => void;
}) {
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nuevoElementoId, setNuevoElementoId] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState("1");
  const [nuevoRol, setNuevoRol] = useState("");
  const { confirm, ConfirmModal } = useConfirm();

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

  const elementosDisponibles = useMemo(
    () => elementos.filter((e) => !proporciones.some((p) => p.elemento_id === e.id)),
    [elementos, proporciones],
  );

  async function handleCantidadBlur(elementoId: string, valor: string) {
    const cantidad = Number(valor);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return;
    setGuardandoId(elementoId);
    await actualizarCantidadElemento(compuestoId, elementoId, cantidad);
    setGuardandoId(null);
    onRecargar();
  }

  async function handleRolBlur(elementoId: string, rol: string) {
    setGuardandoId(elementoId);
    await actualizarRolElemento(compuestoId, elementoId, rol.trim() || null);
    setGuardandoId(null);
    onRecargar();
  }

  async function handleQuitar(elementoId: string, nombre: string) {
    const ok = await confirm({
      title: "Quitar elemento",
      message: `¿Quitar "${nombre}" de la composición de este compuesto?`,
    });
    if (!ok) return;
    setGuardandoId(elementoId);
    await quitarElementoDeCompuesto(compuestoId, elementoId);
    setGuardandoId(null);
    onRecargar();
  }

  async function handleAgregar() {
    if (!nuevoElementoId) return;
    const cantidad = Number(nuevaCantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return;
    setGuardandoId(nuevoElementoId);
    await agregarElementoACompuesto(compuestoId, nuevoElementoId, cantidad);
    if (nuevoRol.trim()) {
      await actualizarRolElemento(compuestoId, nuevoElementoId, nuevoRol.trim());
    }
    setGuardandoId(null);
    setAgregando(false);
    setNuevoElementoId("");
    setNuevaCantidad("1");
    setNuevoRol("");
    onRecargar();
  }

  if (loading) return null;

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <ConfirmModal />
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Composición real
        </span>
        {propiedadesParaInfo.length > 0 && <InfoFormulasPopover propiedades={propiedadesParaInfo} />}
        <button
          type="button"
          onClick={() => setAgregando((v) => !v)}
          disabled={elementosDisponibles.length === 0}
          title="Agregar elemento a la composición"
          className="shrink-0 flex items-center justify-center w-5 h-5 rounded border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ml-auto"
        >
          <Plus size={10} />
        </button>
      </div>

      {agregando && (
        <div className="flex flex-col gap-1 px-2 py-1.5 rounded-md border border-primary/10 bg-primary/5">
          <select
            value={nuevoElementoId}
            onChange={(e) => setNuevoElementoId(e.target.value)}
            className="bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
          >
            <option value="">Elegir elemento…</option>
            {elementosDisponibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.simbolo || "??"} · {e.nombre}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step="any"
              value={nuevaCantidad}
              onChange={(e) => setNuevaCantidad(e.target.value)}
              placeholder="Cantidad"
              className="w-16 bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            />
            <input
              value={nuevoRol}
              onChange={(e) => setNuevoRol(e.target.value)}
              placeholder="Rol (opcional)"
              className="flex-1 bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
            />
            <button
              type="button"
              onClick={handleAgregar}
              disabled={!nuevoElementoId || guardandoId === nuevoElementoId}
              className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {guardandoId === nuevoElementoId ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Save size={11} />
              )}
            </button>
          </div>
        </div>
      )}

      {proporciones.length === 0 && !agregando && (
        <p className="text-micro text-primary/25 px-2 py-1">Sin elementos en la composición.</p>
      )}

      <div className="flex flex-col gap-1">
        {proporciones.map((p) => {
          const el = elementos.find((e) => e.id === p.elemento_id);
          const propiedadesElemento = el
            ? propiedadesCalculadasDeElemento(el).filter((prop) => prop.valor !== null)
            : [];
          const ocupado = guardandoId === p.elemento_id;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-1 px-2 py-1.5 rounded-md border border-transparent hover:border-primary/10 hover:bg-primary/[0.03] transition-colors"
            >
              <div className="flex items-center gap-1.5">
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
                <button
                  type="button"
                  onClick={() => handleQuitar(p.elemento_id, el?.nombre ?? p.elemento_id)}
                  disabled={ocupado}
                  title="Quitar de la composición"
                  className="ml-auto shrink-0 flex items-center justify-center w-5 h-5 rounded text-primary/25 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30"
                >
                  {ocupado ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={p.cantidad}
                  key={`cant-${p.id}-${p.cantidad}`}
                  onBlur={(e) => handleCantidadBlur(p.elemento_id, e.target.value)}
                  disabled={ocupado}
                  title="Cantidad"
                  className="w-14 bg-primary/5 rounded px-1.5 py-0.5 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
                />
                <input
                  defaultValue={p.rol ?? ""}
                  key={`rol-${p.id}-${p.rol ?? ""}`}
                  onBlur={(e) => handleRolBlur(p.elemento_id, e.target.value)}
                  disabled={ocupado}
                  placeholder="Rol"
                  title="Rol"
                  className="w-20 bg-primary/5 rounded px-1.5 py-0.5 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25"
                />
                <span title="Proporción molar (calculada)" className="text-micro tabular-nums text-primary/60">
                  molar {p.proporcion_molar !== null ? p.proporcion_molar : "—"}
                </span>
                <span
                  title="Proporción deducida — normalizada (calculada)"
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
 * Traduce el detalle de estabilidad del compuesto (tabla
 * "compuesto_estabilidad": tensión, calidad de enlaces, complejidad
 * estructural — más granular que "estabilidad", la columna directa que ya
 * arma propiedadesCalculadasDeCompuesto) al mismo shape PropiedadCalculada
 * que usa TarjetaPropiedadesFisicas, para que estas filas se vean con
 * exactamente el mismo diseño que el resto de "Propiedades físicas" en vez
 * de un bloque aparte con su propio grid. No todos los compuestos tienen
 * esta fila auxiliar (ver estado_proyecto), por eso devuelve [] si no
 * existe — se funde sin dejar hueco en la tarjeta combinada.
 */
function propiedadesDeEstabilidadDetalle(
  detalle: CompuestoEstabilidadRow | null,
): PropiedadCalculada[] {
  if (!detalle) return [];

  const fmt = (v: number | null, digitos = 3) => (v === null ? null : v.toFixed(digitos));
  const prop = (v: number | null) => (v === null ? undefined : Math.max(0, Math.min(1, v)));

  const clasif = detalle.clasificacion ? ` (${detalle.clasificacion})` : "";
  const grupo = "Análisis estructural";

  return [
    { clave: "eb_tension", label: "Tensión", valor: fmt(detalle.tension), proporcion: prop(detalle.tension), descripcion: `Cuánto desbalance/estrés hay entre los enlaces del compuesto${clasif}.`, grupo },
    { clave: "eb_calidad_enlaces", label: "Calidad de enlaces", valor: fmt(detalle.calidad_enlaces), proporcion: prop(detalle.calidad_enlaces), descripcion: `Qué tan buenos (compatibles y estables) son los enlaces formados${clasif}.`, grupo },
    { clave: "eb_complejidad_estructural", label: "Complejidad estructural", valor: fmt(detalle.complejidad_estructural), proporcion: prop(detalle.complejidad_estructural), descripcion: `Qué tan compleja es la estructura de enlaces del compuesto${clasif}.`, grupo },
    { clave: "eb_coste_organizacion", label: "Coste de organización", valor: fmt(detalle.coste_organizacion), proporcion: prop(detalle.coste_organizacion), descripcion: `Cuánto "cuesta" mantener organizada la estructura del compuesto${clasif}.`, grupo },
    { clave: "eb_confianza", label: "Confianza", valor: fmt(detalle.confianza), proporcion: prop(detalle.confianza), descripcion: `Qué tan confiable es este cálculo dado el estado actual de datos${clasif}.`, grupo },
  ];
}

/**
 * Selector de enlace_sitios para un par de elementos ya elegido — lista
 * SOLO los enlaces que useEnlaceSitiosParaPar resolvió como aplicables a
 * ese par exacto (cadena enlace_sitios → site_a/b_id →
 * elemento_sitios_enlace.elemento_id). No hay opción de crear un
 * enlace_sitios nuevo: ese catálogo es responsabilidad de otra pantalla,
 * fuera de este editor de compuesto.
 */
function SelectorEnlaceSitios({
  elementoAId,
  elementoBId,
  value,
  onChange,
}: {
  elementoAId: string;
  elementoBId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const { items, loading } = useEnlaceSitiosParaPar(elementoAId, elementoBId);
  const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(2));

  if (loading) {
    return <p className="text-micro text-primary/25 px-1">Buscando enlaces aplicables…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-micro text-primary/40 px-1">
        Sin enlaces del catálogo aplicables a este par de elementos.
      </p>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
    >
      <option value="">Elegir enlace…</option>
      {items.map((e) => (
        <option key={e.id} value={e.id}>
          int {fmt(e.intensidad)} · coste {fmt(e.coste_energetico)} · estab {fmt(e.estabilidad)}
        </option>
      ))}
    </select>
  );
}

/**
 * Enlaces reales instanciados del compuesto (tabla "compuesto_enlaces"):
 * el grafo elemento↔elemento que alimenta compuesto_estabilidad — a
 * diferencia de ese bloque (un número agregado por compuesto), acá se ve
 * cada enlace individual con su intensidad/coste/estabilidad/
 * reversibilidad.
 *
 * Editable: agregar una fila (par de elementos de la composición del
 * compuesto + un enlace_sitios existente aplicable a ese par, ver
 * SelectorEnlaceSitios) o quitar una fila. El catálogo enlace_sitios en sí
 * — sus 4 números, y qué combinaciones son físicamente válidas — nunca se
 * crea ni se edita desde acá; eso es una tabla de reglas/capacidades que
 * vive fuera del compuesto (ver useCompuestoEnlaces.ts).
 */
function EnlacesCompuestoBloque({
  compuestoId,
  enlaces,
  loading,
  error,
  elementos,
  elementosDeLaComposicion,
  onAbrirElemento,
  onRecargar,
}: {
  compuestoId: string;
  enlaces: CompuestoEnlaceRow[];
  loading: boolean;
  error?: string | null;
  elementos: Elemento[];
  /** Elementos que efectivamente están en la composición de este
   *  compuesto (compuesto_elementos) — un enlace solo tiene sentido entre
   *  elementos que ya son parte del compuesto, así que el selector de
   *  "agregar enlace" se arma con esta lista, no con el catálogo entero. */
  elementosDeLaComposicion: Elemento[];
  onAbrirElemento?: (elementoId: string) => void;
  onRecargar: () => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const [elementoAId, setElementoAId] = useState("");
  const [elementoBId, setElementoBId] = useState("");
  const [enlaceSitiosId, setEnlaceSitiosId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const { confirm, ConfirmModal } = useConfirm();

  const nombreEl = (id: string) => {
    const el = elementos.find((e) => e.id === id);
    return el ? `${el.simbolo || "??"} · ${el.nombre}` : "—";
  };

  function resetFormAgregar() {
    setAgregando(false);
    setElementoAId("");
    setElementoBId("");
    setEnlaceSitiosId("");
  }

  async function handleAgregar() {
    if (!elementoAId || !elementoBId || !enlaceSitiosId || elementoAId === elementoBId) return;
    setGuardando(true);
    await agregarEnlaceACompuesto(compuestoId, elementoAId, elementoBId, enlaceSitiosId);
    setGuardando(false);
    resetFormAgregar();
    onRecargar();
  }

  async function handleQuitar(enlaceId: string, aId: string, bId: string) {
    const ok = await confirm({
      title: "Quitar enlace",
      message: `¿Quitar el enlace entre "${nombreEl(aId)}" y "${nombreEl(bId)}"?`,
    });
    if (!ok) return;
    setQuitandoId(enlaceId);
    await quitarEnlaceDeCompuesto(enlaceId);
    setQuitandoId(null);
    onRecargar();
  }

  if (loading) return null;
  // Antes: `if (loading || enlaces.length === 0) return null` — un error
  // real de fetch (ver useCompuestoEnlaces) caía en el mismo return null
  // que "este compuesto no tiene enlaces", indistinguible en pantalla.
  // Ahora el error se muestra explícito; solo el caso realmente vacío
  // (sin error, 0 filas) sigue sin renderizar nada... salvo que ahora hay
  // botón de agregar, así que ya no hace falta ocultar todo el bloque.
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

  const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(2));

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <ConfirmModal />
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Enlaces
        </span>
        <button
          type="button"
          onClick={() => (agregando ? resetFormAgregar() : setAgregando(true))}
          disabled={elementosDeLaComposicion.length < 2}
          title="Agregar enlace entre dos elementos de la composición"
          className="shrink-0 flex items-center justify-center w-5 h-5 rounded border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ml-auto"
        >
          <Plus size={10} />
        </button>
      </div>

      {agregando && (
        <div className="flex flex-col gap-1 px-2 py-1.5 rounded-md border border-primary/10 bg-primary/5">
          <div className="grid grid-cols-2 gap-1">
            <select
              value={elementoAId}
              onChange={(e) => {
                setElementoAId(e.target.value);
                setEnlaceSitiosId("");
              }}
              className="bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            >
              <option value="">Elemento A…</option>
              {elementosDeLaComposicion.map((e) => (
                <option key={e.id} value={e.id} disabled={e.id === elementoBId}>
                  {e.simbolo || "??"} · {e.nombre}
                </option>
              ))}
            </select>
            <select
              value={elementoBId}
              onChange={(e) => {
                setElementoBId(e.target.value);
                setEnlaceSitiosId("");
              }}
              className="bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            >
              <option value="">Elemento B…</option>
              {elementosDeLaComposicion.map((e) => (
                <option key={e.id} value={e.id} disabled={e.id === elementoAId}>
                  {e.simbolo || "??"} · {e.nombre}
                </option>
              ))}
            </select>
          </div>

          {elementoAId && elementoBId && (
            <SelectorEnlaceSitios
              elementoAId={elementoAId}
              elementoBId={elementoBId}
              value={enlaceSitiosId}
              onChange={setEnlaceSitiosId}
            />
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAgregar}
              disabled={!elementoAId || !elementoBId || !enlaceSitiosId || guardando}
              className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {guardando ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            </button>
          </div>
        </div>
      )}

      {enlaces.length === 0 && !agregando && (
        <p className="text-micro text-primary/25 px-2 py-1">Sin enlaces instanciados.</p>
      )}

      <div className="flex flex-col gap-1">
        {enlaces.map((e) => (
          <div
            key={e.id}
            className="flex flex-col gap-0.5 px-2 py-1 rounded-md border border-transparent hover:border-primary/10 hover:bg-primary/[0.03] transition-colors"
          >
            <div className="flex items-center gap-1.5">
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
              <button
                type="button"
                onClick={() => handleQuitar(e.id, e.elemento_a_id, e.elemento_b_id)}
                disabled={quitandoId === e.id}
                title="Quitar este enlace"
                className="ml-auto shrink-0 flex items-center justify-center w-5 h-5 rounded text-primary/25 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30"
              >
                {quitandoId === e.id ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Trash2 size={10} />
                )}
              </button>
            </div>
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
  const {
    items: proporcionElementos,
    loading: proporcionLoading,
    load: recargarProporcionElementos,
  } = useCompuestoElementosProporcion(compuesto.id);
  const { item: estabilidadDetalle, loading: estabilidadLoading } = useCompuestoEstabilidad(
    compuesto.id,
  );
  const {
    items: enlacesCompuesto,
    loading: enlacesLoading,
    error: enlacesError,
    load: recargarEnlacesCompuesto,
  } = useCompuestoEnlaces(compuesto.id);

  // Elementos que efectivamente están en la composición de este compuesto
  // (compuesto_elementos), resueltos contra el catálogo — es la lista de
  // la que EnlacesCompuestoBloque arma su selector "agregar enlace": un
  // enlace solo tiene sentido entre elementos que ya forman parte del
  // compuesto.
  const elementosDeLaComposicion = useMemo(
    () =>
      proporcionElementos
        .map((p) => elementos.find((e) => e.id === p.elemento_id))
        .filter((e): e is Elemento => !!e),
    [proporcionElementos, elementos],
  );

  // ComposicionRealBloque y EnlacesCompuestoBloque ahora son editables:
  // después de cualquier mutación (agregar/editar/quitar elemento o
  // enlace) hay que refrescar ambos hooks — un cambio en compuesto_elementos
  // puede alterar qué elementos están disponibles para enlazar, y viceversa
  // ninguno de los dos recalcula al otro solo, así que se recargan juntos.
  function recargarComposicionYEnlaces() {
    recargarProporcionElementos();
    recargarEnlacesCompuesto();
  }

  // "Estabilidad — detalle" (compuesto_estabilidad) se funde acá dentro de
  // la misma lista que alimenta PropiedadesFisicasCompuestoBloque (pedido
  // explícito): antes era un bloque aparte (EstabilidadDetalleBloque) con su
  // propio grid de 3 columnas; ahora sus 5 filas son PropiedadCalculada más,
  // así que se renderizan con exactamente el mismo diseño de tarjeta que el
  // resto de Propiedades físicas (TarjetaPropiedadesFisicas), sin bloque ni
  // grid separados. Si el compuesto no tiene fila auxiliar todavía o sigue
  // cargando, propiedadesDeEstabilidadDetalle devuelve [] y no se nota hueco.
  const propiedadesFisicas = useMemo(
    () => [
      ...propiedadesCalculadasDeCompuesto(local),
      ...(estabilidadLoading ? [] : propiedadesDeEstabilidadDetalle(estabilidadDetalle)),
    ],
    [local, estabilidadDetalle, estabilidadLoading],
  );

  // Fórmula expandida para el header (ver formulaExpandidaCompuesto): null
  // mientras proporcionElementos está cargando o si la composición no
  // resuelve — el header simplemente no muestra subtítulo en ese caso, no
  // un placeholder inventado.
  const formulaHeader = useMemo(
    () => (proporcionLoading ? null : formulaExpandidaCompuesto(proporcionElementos, elementos)),
    [proporcionElementos, elementos, proporcionLoading],
  );

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
    subtitulo: formulaHeader,
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

        {/* Gráfico a la izquierda (columna fija) + Propiedades físicas a la
            derecha — incluye ahora también el detalle de Estabilidad
            (compuesto_estabilidad), fundido en la misma tarjeta/diseño en
            vez de un bloque aparte (ver propiedadesDeEstabilidadDetalle).
            Reemplaza al bloque "Usado en Item/Mineral/Flora" — informativo
            de solo lectura sobre otras entidades del catálogo, no datos
            propios de Química — y a los 4 cuadros de Reactividad/Peso/
            Carga/Enlace que vivían debajo del átomo, ya antiguos y
            redundantes con Propiedades físicas + Estabilidad. */}
        <div className="grid grid-cols-[minmax(11rem,14rem)_1fr] gap-3 items-start">
          <AtomoVisualCompuesto compuesto={local} elementos={elementos} />
          <PropiedadesFisicasCompuestoBloque propiedades={propiedadesFisicas} />
        </div>

        {/* Composición real (izquierda) · Enlaces (derecha). */}
        <div className="grid grid-cols-2 gap-3 items-start">
          <ComposicionRealBloque
            compuestoId={compuesto.id}
            proporciones={proporcionElementos}
            loading={proporcionLoading}
            elementos={elementos}
            onAbrirElemento={setEditandoElementoId}
            onRecargar={recargarComposicionYEnlaces}
          />
          <EnlacesCompuestoBloque
            compuestoId={compuesto.id}
            enlaces={enlacesCompuesto}
            loading={enlacesLoading}
            error={enlacesError}
            elementos={elementos}
            elementosDeLaComposicion={elementosDeLaComposicion}
            onAbrirElemento={setEditandoElementoId}
            onRecargar={recargarComposicionYEnlaces}
          />
        </div>
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
  // Antes: containerWidth arrancaba en 0 y el layout se pintaba con un
  // ancho estimado (900px, ver fallback más abajo) hasta que el
  // ResizeObserver medía el ancho real — un reflow grande y visible del
  // masonry entero apenas cargaba (más notorio ahora que la columna mide
  // ~1/3 del panel por el grid de 3 columnas, no el ancho completo). Con
  // "medido" no se renderiza el masonry hasta tener el ancho real, así
  // que no hay salto: solo aparece ya con el layout correcto.
  const [medido, setMedido] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        setContainerWidth(width);
        setMedido(true);
      }
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
      {!medido ? (
        // Placeholder mientras se mide el contenedor real — evita pintar
        // con el ancho estimado (900) y después saltar al recalcular con
        // el ancho verdadero. Altura aproximada para que no haya salto de
        // scroll cuando el masonry real aparece encima.
        <div className="flex-1 py-6 text-center text-micro text-primary/30">Cargando…</div>
      ) : (
        columnas.map((columna, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 min-w-0"
            style={{ width: anchoColumna }}
          >
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
        ))
      )}
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

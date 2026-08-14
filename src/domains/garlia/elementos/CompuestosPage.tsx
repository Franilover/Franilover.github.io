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
  Beaker,
  ChevronLeft,
  Combine,
  Download,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { RichEditor } from "@/editor/lexical";
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

import {
  autocompletarHastaEstable,
  calcularAfinidad,
  calcularBalancePorCapa,
  calcularCancelacionCarga,
  calcularDeficitConCatalizadores,
  calcularElectromagnetismo,
  calcularEnlaceResultante,
  calcularEstequiometriaExacta,
  calcularPerfilAtomico,
  calcularPeso,
  calcularReactividad,
  combinarComponentes,
  compuestoEsInerte,
  encontrarCompuestoDuplicado,
  generarSimboloCompuesto,
  sugerirElementosParaCompletar,
} from "./afinidad";
import {
  AFINIDAD_LABEL,
  ENLACE_LABEL,
  LAYER_LABEL,
  REACTIVIDAD_LABEL,
  type ComponenteCompuesto,
  type Compuesto,
  type Elemento,
  type LayerName,
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
}

function nombreElemento(elementos: Elemento[], id: string): string {
  const el = elementos.find((e) => e.id === id);
  return el ? `${el.simbolo || "??"} · ${el.nombre}` : "(elemento eliminado)";
}

/** Tarjeta de compuesto: nombre + símbolo + resumen de sus componentes. */
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
      className={`group flex flex-col items-stretch gap-0.5 p-1.5 rounded-md border transition-colors text-left ${
        seleccionado
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-micro font-black text-primary/30 tabular-nums">
          {compuesto.componentes?.length ?? 0}×
        </span>
        <div className="flex items-center gap-0.5">
          {estable && (
            <span
              title="Estructura atómica completa"
              className="w-1.5 h-1.5 rounded-full bg-accent/70 shrink-0 mt-0.5"
            />
          )}
          <Beaker size={10} className="text-accent/60 shrink-0 mt-0.5" />
        </div>
      </div>

      <span className="text-base font-black text-primary text-center leading-none py-0.5">
        {compuesto.simbolo || "??"}
      </span>

      <span className="text-micro font-bold text-primary/80 truncate text-center leading-tight">
        {compuesto.nombre}
      </span>

      <div className="mt-0.5 pt-0.5 border-t border-primary/10 flex flex-col gap-0.5">
        {(compuesto.componentes ?? []).slice(0, 3).map((c) => (
          <span
            key={c.elemento_id}
            className="text-micro text-primary/40 truncate leading-tight"
          >
            <span className="text-primary/25">{c.cantidad}×</span>{" "}
            {nombreElemento(elementos, c.elemento_id)}
          </span>
        ))}
        {(compuesto.componentes?.length ?? 0) > 3 && (
          <span className="text-micro text-primary/25 leading-tight">
            +{(compuesto.componentes?.length ?? 0) - 3} más
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Selector de elementos a combinar — mismo espíritu que SelectorEntidad
 * (fichaComponents.tsx): barra de búsqueda arriba, siempre visible, con la
 * lista de resultados en vertical justo debajo (sin dropdown ni portal,
 * pensado para vivir fijo en una columna angosta). Cada fila trae su
 * propio botón sumar/quitar para elegir muy rápido sin reabrir nada; los
 * elementos ya elegidos muestran además el stepper +/- de cantidad y
 * quedan arriba de la lista, con separador. Los que más ayudan a cerrar
 * el déficit actual (sugerirElementosParaCompletar) se destacan con un
 * puntito, igual que antes.
 */
function SelectorElementosCompuesto({
  elementos,
  componentes,
  onChange,
  onAbrirElemento,
}: {
  elementos: Elemento[];
  componentes: ComponenteCompuesto[];
  onChange: (componentes: ComponenteCompuesto[]) => void;
  /** Abre el panel flotante del Elemento (mismo patrón que "Editar" en
   *  SelectorCompuesto) al clickear su nombre, sin disparar sumar/quitar. */
  onAbrirElemento?: (elementoId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const idsElegidos = new Set(componentes.map((c) => c.elemento_id));

  const sugerencias = useMemo(
    () => sugerirElementosParaCompletar(componentes, elementos),
    [componentes, elementos],
  );
  const idsSugeridos = useMemo(
    () => new Set(sugerencias.slice(0, 3).map((s) => s.elemento.id)),
    [sugerencias],
  );

  function agregarElemento(id: string) {
    if (idsElegidos.has(id)) return;
    onChange([...componentes, { elemento_id: id, cantidad: 1 }]);
  }

  function quitarElemento(id: string) {
    onChange(componentes.filter((c) => c.elemento_id !== id));
  }

  function setCantidad(id: string, cantidad: number) {
    onChange(
      componentes.map((c) =>
        c.elemento_id === id ? { ...c, cantidad: Math.max(1, cantidad) } : c,
      ),
    );
  }

  const disponibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = elementos.filter((el) => !idsElegidos.has(el.id));
    const filtrados = !q
      ? base
      : base.filter(
          (el) =>
            el.nombre.toLowerCase().includes(q) || (el.simbolo ?? "").toLowerCase().includes(q),
        );
    // Sugeridos primero, después el resto en su orden original.
    return [
      ...filtrados.filter((el) => idsSugeridos.has(el.id)),
      ...filtrados.filter((el) => !idsSugeridos.has(el.id)),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementos, query, idsElegidos, idsSugeridos]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Barra de búsqueda, siempre visible */}
      <div className="shrink-0 flex items-center gap-2 px-2.5 h-8 rounded-md border border-primary/10 bg-primary/[0.03] focus-within:border-primary/30 transition-colors">
        <Search size={12} className="text-primary/35 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar elemento…"
          className="flex-1 bg-transparent outline-none text-micro text-primary/80 placeholder:text-primary/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="shrink-0 text-primary/30 hover:text-primary/60 transition-colors cursor-pointer"
            title="Limpiar búsqueda"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Elegidos, con stepper de cantidad — siempre arriba de la lista de
          disponibles, con separador. */}
      {componentes.length > 0 && (
        <div className="shrink-0 flex flex-col gap-0.5 pb-1 mb-0.5 border-b border-primary/10">
          {componentes.map((c) => (
            <div
              key={c.elemento_id}
              className="flex items-center gap-1.5 bg-accent/[0.06] rounded-md pl-2 pr-1 py-1 border border-accent/15"
            >
              <span
                className={`flex-1 min-w-0 truncate text-micro font-bold text-primary/80 ${
                  onAbrirElemento ? "cursor-pointer hover:underline hover:text-primary" : ""
                }`}
                title={onAbrirElemento ? "Ver/editar este elemento" : undefined}
                onClick={() => onAbrirElemento?.(c.elemento_id)}
              >
                {nombreElemento(elementos, c.elemento_id)}
              </span>
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento_id, c.cantidad - 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  −
                </button>
                <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
                  {c.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento_id, c.cantidad + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => quitarElemento(c.elemento_id)}
                  title="Quitar"
                  className="w-5 h-5 flex items-center justify-center rounded border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disponibles: lista vertical siempre abierta, un botón + por fila
          para agregar rápido sin reabrir ningún dropdown. Altura fija con
          scroll propio — la columna vive en un grid items-start, así que
          sin este límite crecería sin techo. */}
      <div className="max-h-[22rem] overflow-y-auto flex flex-col gap-0.5 rounded-md border border-primary/10 bg-primary/[0.02] p-1">
        {disponibles.length === 0 ? (
          <p className="text-micro text-primary/25 text-center py-3">
            {elementos.length === 0
              ? "Todavía no hay elementos en la Tabla Química para combinar."
              : query
                ? "Sin resultados."
                : "Ya agregaste todos los elementos disponibles."}
          </p>
        ) : (
          disponibles.map((el) => {
            const sugerido = idsSugeridos.has(el.id);
            return (
              <div
                key={el.id}
                className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                  sugerido ? "bg-accent/[0.06] hover:bg-accent/10" : "hover:bg-primary/5"
                }`}
              >
                {sugerido && <span className="w-1 h-1 rounded-full bg-accent shrink-0" />}
                <button
                  type="button"
                  onClick={() => (onAbrirElemento ? onAbrirElemento(el.id) : agregarElemento(el.id))}
                  title={
                    onAbrirElemento
                      ? "Ver/editar este elemento"
                      : sugerido
                        ? `${el.nombre} — completa parte del déficit actual`
                        : undefined
                  }
                  className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                >
                  <span className="shrink-0 text-micro font-black text-primary/70 w-8">
                    {el.simbolo || "??"}
                  </span>
                  <span className="flex-1 min-w-0 text-micro text-primary/80 truncate">
                    {el.nombre}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => agregarElemento(el.id)}
                  title="Agregar al compuesto"
                  className="shrink-0 flex items-center justify-center w-5 h-5 rounded border border-primary/15 text-primary/40 group-hover:text-primary cursor-pointer"
                >
                  <Plus size={10} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Balance atómico del compuesto: suma de partículas por capa contra su
 * capacidad fija (2/4/6) — misma lógica que valencia química real. Muestra
 * dónde le sobra ("superávit", disponible para prestar) y dónde le falta
 * ("déficit", lo que necesita de otro compuesto para estabilizarse).
 */
function BalanceAtomico({
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
  const balance = useMemo(() => calcularBalancePorCapa(perfil), [perfil]);

  return (
    <div className="rounded-lg border border-primary/10 overflow-hidden">
      {balance.map((b, i) => (
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
                : "text-accent bg-accent/10"
            }`}
          >
            {b.balance === 0 ? "Completa" : b.balance > 0 ? `+${b.balance} sobra` : `${b.balance} falta`}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Reactividad ("energía de activación") + peso molecular de un compuesto —
 * derivados directos del perfil atómico, sin datos nuevos que cargar. Los
 * catalizadores presentes en la mezcla ya están descontados del déficit
 * (ver calcularDeficitConCatalizadores en afinidad.ts).
 */
function AnalisisReactivoPeso({
  compuesto,
  elementos,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
}) {
  const reactividad = useMemo(
    () => calcularReactividad(compuesto, elementos),
    [compuesto, elementos],
  );
  const { catalizadoresActivos, deficitBase } = useMemo(
    () => calcularDeficitConCatalizadores(compuesto, elementos),
    [compuesto, elementos],
  );
  const peso = useMemo(() => calcularPeso(compuesto, elementos), [compuesto, elementos]);

  const colorReactividad =
    reactividad.nivel === "inerte"
      ? "text-primary/40 bg-primary/5 border-primary/10"
      : reactividad.nivel === "moderado"
        ? "text-accent/70 bg-accent/[0.06] border-accent/15"
        : reactividad.nivel === "inestable"
          ? "text-accent bg-accent/10 border-accent/25"
          : "text-accent bg-accent/20 border-accent/40";

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md border ${colorReactividad}`}>
        <span className="text-micro font-black uppercase tracking-wide">
          {REACTIVIDAD_LABEL[reactividad.nivel]}
        </span>
        <span className="text-micro opacity-70">
          Déficit {reactividad.deficitTotal}/{reactividad.capacidadTotal}
          {catalizadoresActivos.length > 0 && (
            <> · reducido de {deficitBase} por {catalizadoresActivos.length} catalizador(es)</>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-md border border-primary/10 bg-primary/[0.02]">
        <span className="text-micro font-black uppercase tracking-wide text-primary/60">
          {peso.pesoTotal} · peso {peso.categoria}
        </span>
        <span className="text-micro text-primary/40">
          Núcleo×3 {peso.porCapa.nucleo} · Media×2 {peso.porCapa.media} · Externa×1{" "}
          {peso.porCapa.externa}
        </span>
      </div>
    </div>
  );
}

/**
 * Estequiometría exacta: busca el múltiplo entero mínimo de toda la mezcla
 * que deja las 3 capas en 0 sin sobras — como balancear 2H₂ + O₂ → 2H₂O.
 * Muestra el resultado solo si difiere de la mezcla actual (si ya está
 * balanceado tal cual, no hace falta mostrar nada extra).
 */
function PanelEstequiometria({
  compuesto,
  elementos,
}: {
  compuesto: Compuesto;
  elementos: Elemento[];
}) {
  const resultado = useMemo(
    () => calcularEstequiometriaExacta(compuesto, elementos),
    [compuesto, elementos],
  );

  if (!resultado.balanceado) {
    return (
      <p className="text-micro text-primary/25">
        No hay una proporción entera (hasta ×12) que balancee las 3 capas exactamente en 0
        con estos elementos.
      </p>
    );
  }

  const yaBalanceado = resultado.factor === 1;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-accent/20 bg-accent/10 text-accent">
        <span className="text-micro font-bold leading-snug">
          {yaBalanceado
            ? "Esta mezcla ya está balanceada exacta (sin sobras)."
            : `Multiplicando toda la mezcla ×${resultado.factor} se balancea exacto, sin sobras.`}
        </span>
      </div>
      {!yaBalanceado && (
        <div className="flex flex-col gap-0.5">
          {resultado.componentes.map((c) => (
            <span key={c.elemento_id} className="text-micro text-primary/50">
              {nombreElemento(elementos, c.elemento_id)} × {c.cantidad}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const AFINIDAD_COLOR: Record<TipoAfinidad, string> = {
  complementa: "text-accent bg-accent/10 border-accent/25",
  compite: "text-accent/70 bg-accent/[0.06] border-accent/15",
  saturado: "text-primary/40 bg-primary/5 border-primary/10",
  estable: "text-primary/30 bg-primary/[0.02] border-primary/10",
};

const ENLACE_COLOR: Record<TipoEnlace, string> = {
  fuerte: "text-accent bg-accent/10 border-accent/25",
  debil: "text-accent/70 bg-accent/[0.06] border-accent/15",
  neutro: "text-primary/30 bg-primary/[0.02] border-primary/10",
};

/** Detalle editable de un compuesto — mismo criterio que ElementoEditor. */
function CompuestoEditor({
  compuesto,
  elementos,
  todosLosCompuestos,
  onBack,
  onActualizar,
  onEliminar,
  onHeaderControlsChange,
  onActualizarElemento,
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
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(compuesto);
  const [editandoElementoId, setEditandoElementoId] = useState<string | null>(null);

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
      const { error } = await supabase.from("compuestos").update(cambios).eq("id", compuesto.id);
      if (error) throw error;
      onActualizar(compuesto.id, cambios);
    } catch (e) {
      console.error("[CompuestoEditor] error guardando:", e);
    } finally {
      setSaving(false);
    }
  }

  // Auto-completar hasta estable: agrega, en orden greedy, los elementos
  // que más déficit cierran con menos desperdicio (ver afinidad.ts) hasta
  // que las 3 capas queden en 0 o ya no haya candidatos que ayuden.
  function handleAutoCompletar() {
    const nuevosComponentes = autocompletarHastaEstable(local.componentes ?? [], elementos);
    setLocal((p) => ({ ...p, componentes: nuevosComponentes }));
    persist({ componentes: nuevosComponentes });
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
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-accent/25 bg-accent/10 text-accent">
            <span className="text-micro font-bold leading-snug">
              Misma combinación exacta que "{duplicadoDe.simbolo || "??"} · {duplicadoDe.nombre}" —
              ¿es a propósito?
            </span>
          </div>
        )}

        {/* Tres columnas: Elementos que lo componen (izquierda) · análisis
            del compuesto — estequiometría, reactividad/peso, balance
            (centro) · Notas con RichEditor (derecha). */}
        <div className="grid grid-cols-3 gap-3 items-start">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
                Elementos que lo componen
              </p>
              <button
                type="button"
                onClick={handleAutoCompletar}
                disabled={(elementos.length ?? 0) === 0}
                title="Agregar automáticamente los elementos que faltan para estabilizar las 3 capas"
                className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Wand2 size={10} />
                Auto-completar
              </button>
            </div>
            <SelectorElementosCompuesto
              elementos={elementos}
              componentes={local.componentes ?? []}
              onChange={(componentes) => {
                setLocal((p) => ({ ...p, componentes }));
                persist({ componentes });
              }}
              onAbrirElemento={setEditandoElementoId}
            />
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex flex-col gap-1.5">
              <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
                Estequiometría exacta
              </p>
              <PanelEstequiometria compuesto={local} elementos={elementos} />
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
                Reactividad y peso
              </p>
              <AnalisisReactivoPeso compuesto={local} elementos={elementos} />
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
                Balance atómico
              </p>
              <BalanceAtomico compuesto={local} elementos={elementos} />
            </div>
          </div>

          <div className="flex flex-col gap-0.5 min-w-0">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Notas
            </label>
            <RichEditor
              minHeight="16rem"
              placeholder="Descripción del compuesto…"
              value={local.notas ?? ""}
              onChange={(v) => {
                setLocal((p) => ({ ...p, notas: v }));
                persist({ notas: v });
              }}
            />
          </div>
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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
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
          />
        </div>
      </div>
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
                <p className="text-micro text-accent bg-accent/10 border border-accent/20 rounded-md px-2 py-1.5">
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
                    <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-md border text-accent bg-accent/10 border-accent/20">
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
                        ? "text-accent bg-accent/10 border-accent/20"
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
                        ? "text-accent bg-accent/10 border-accent/20"
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
                              : "text-accent bg-accent/10"
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
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [laboratorioAbierto, setLaboratorioAbierto] = useState(false);

  // Permite que el caller fuerce la apertura de un compuesto específico
  // desde afuera (ej. al navegar desde "Usado en compuestos" en el editor
  // de un Elemento) cada vez que seleccionarId cambia, no solo como valor
  // inicial.
  useEffect(() => {
    if (seleccionarId) setSeleccionadoId(seleccionarId);
  }, [seleccionarId]);

  const activoId = seleccionadoId ?? seleccionarId ?? null;
  const activo = useMemo(
    () => compuestos.find((c) => c.id === activoId) ?? null,
    [compuestos, activoId],
  );

  return (
    <div className="flex relative">
      <div className="flex-1 p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary/40">
            <Beaker size={12} />
            <p className="text-micro font-black uppercase tracking-widest">
              Compuestos · {compuestos.length}
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
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
          >
            {compuestos.map((c) => (
              <CompuestoCasilla
                key={c.id}
                compuesto={c}
                elementos={elementos}
                seleccionado={c.id === activoId}
                onClick={() =>
                  setSeleccionadoId((actual) => (actual === c.id ? null : c.id))
                }
              />
            ))}
          </div>
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

"use client";

import {
  Box,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  propiedadesCalculadasGenerico,
  TarjetaPropiedadesFisicas,
} from "@/domains/garlia/_shared/GridPropiedadesCalculadas";
import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useEstructuras } from "@/domains/garlia/elementos/useEstructuras";
import type { PropiedadCalculada } from "@/domains/garlia/elementos/types";
import { ComboSelector } from "@/ui/ComboSelector";
import { useConfirm } from "@/ui/ConfirmModal";

import { useMaterialComponentes } from "./useMaterialComponentes";
import { useMaterialEstructuras } from "./useMaterialEstructuras";
import { useMateriales } from "./useMateriales";
import { usePerfilReactivoMaterial } from "./usePerfilReactivoMaterial";
import type { PerfilReactivoMaterial, Material, MaterialComponente, MaterialEstructura } from "./types";

/** Etiqueta legible para el origen de una propiedad física (ver
 *  documentacion_sistema "Fuente por propiedad en Material v187", orden
 *  421). No es un cálculo: es texto de presentación 1:1 sobre el valor
 *  que Supabase ya entrega en propiedades_calculadas.fuente_fisica. */
function etiquetaFuenteFisica(fuente: string | undefined): string | null {
  switch (fuente) {
    case "composicion":
      return "por composición";
    case "estructura":
      return "por estructura";
    case "estructura_y_composicion":
      return "estructura + composición";
    default:
      return fuente ?? null;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Ejes del Perfil Reactivo Emergente V2, con etiqueta y descripción — mismo
 *  criterio que las listas MAGNITUDES/INDICES de propiedadesCalculadasGenerico
 *  (elementos/types.ts / GridPropiedadesCalculadas.tsx), para que estos ejes
 *  se muestren como PropiedadCalculada más y compartan el diseño exacto de
 *  "Propiedades físicas" (TarjetaPropiedadesFisicas) en vez de un bloque
 *  aparte con su propio grid. Todos son índices [0,1] → llevan barra de
 *  proporción igual que estabilidad/rigidez/etc. */
const EJES_PERFIL_REACTIVO: { clave: string; label: string; descripcion: string }[] = [
  { clave: "afinidad_reactiva", label: "Afinidad reactiva", descripcion: "Qué tan bien tiende a acoplarse/reaccionar con otras sustancias." },
  { clave: "dinamismo_reactivo", label: "Dinamismo reactivo", descripcion: "Qué tan activa/cambiante es la microestructura reactiva del material." },
  { clave: "estabilidad_reactiva", label: "Estabilidad reactiva", descripcion: "Qué tan resistente es a iniciar o sostener una reacción." },
  { clave: "conductividad_reactiva", label: "Conductividad reactiva", descripcion: "Facilidad para propagar una influencia reactiva a través del material." },
  { clave: "actividad_catalitica_reactiva", label: "Actividad catalítica", descripcion: "Capacidad de acelerar/facilitar reacciones sin consumirse." },
  { clave: "potencial_transicion_reactivo", label: "Potencial de transición", descripcion: "Qué tan propenso está el material a cambiar de estado o forma." },
  { clave: "potencial_transformacion_reactiva", label: "Potencial de transformación", descripcion: "Qué tan propenso está el material a transformarse en algo distinto." },
];

/**
 * Traduce el Perfil Reactivo Emergente V2 (documentacion_sistema, orden
 * 1101; fuente real: vista v_perfil_reactivo_material, ver
 * usePerfilReactivoMaterial) al mismo shape PropiedadCalculada que usa
 * TarjetaPropiedadesFisicas — pedido explícito: mismo diseño que
 * "Propiedades físicas" en vez de un bloque "Perfil reactivo" aparte.
 *
 * No es una lista de etiquetas manuales tipo "inflamable/explosivo": son
 * ejes derivados de la microestructura del material. Cuando el material no
 * tiene desglose microscópico suficiente (estado !== "derivado_microestructura")
 * devuelve [] — información propia del canon, no se inventa un perfil ni se
 * fuerza a cero.
 */
function propiedadesDePerfilReactivo(
  item: PerfilReactivoMaterial | null,
): PropiedadCalculada[] {
  if (!item || item.estado !== "derivado_microestructura" || !item.perfil) return [];

  const prop = (v: number | null | undefined) =>
    typeof v === "number" ? Math.max(0, Math.min(1, v)) : undefined;
  const fmt = (v: number | null | undefined) => (typeof v === "number" ? v.toFixed(3) : null);

  return EJES_PERFIL_REACTIVO.filter((eje) => item.perfil?.[eje.clave] !== undefined).map((eje) => {
    const v = item.perfil?.[eje.clave] as number | undefined;
    return {
      clave: `pr_${eje.clave}`,
      label: eje.label,
      valor: fmt(v),
      proporcion: prop(v),
      descripcion: eje.descripcion,
      grupo: "Propiedades reactivas",
    };
  });
}

/**
 * Fila editable de un componente ya vinculado (material_componentes).
 * Mismo criterio que FilaMaterial en items/SelectorMaterialesItem.tsx:
 * estado local propio para los inputs numéricos, se persiste recién en
 * onBlur y solo si el valor final es válido, para no disparar constraints
 * de Supabase con valores intermedios (ej. cantidad = 0 mientras se
 * retipea el campo).
 */
function FilaComponente({
  fila,
  nombreComponente,
  onActualizar,
  onEliminar,
}: {
  fila: MaterialComponente;
  nombreComponente: string;
  onActualizar: (
    cambios: Partial<Pick<MaterialComponente, "cantidad" | "proporcion_min" | "proporcion_max" | "unidad" | "rol">>,
  ) => void;
  onEliminar: () => void;
}) {
  const [cantidadTexto, setCantidadTexto] = useState(String(fila.cantidad));
  const [rolTexto, setRolTexto] = useState(fila.rol ?? "");
  const [unidadTexto, setUnidadTexto] = useState(fila.unidad ?? "");

  const cantidadGuardada = String(fila.cantidad);
  const rolGuardado = fila.rol ?? "";
  const unidadGuardada = fila.unidad ?? "";

  function commitCantidad() {
    const n = Number(cantidadTexto);
    if (cantidadTexto.trim() === "" || Number.isNaN(n) || n <= 0) {
      setCantidadTexto(cantidadGuardada);
      return;
    }
    if (n !== fila.cantidad) onActualizar({ cantidad: n });
  }

  function commitRol() {
    const v = rolTexto.trim();
    if (v !== rolGuardado) onActualizar({ rol: v === "" ? null : v });
  }

  function commitUnidad() {
    const v = unidadTexto.trim();
    if (v !== unidadGuardada) onActualizar({ unidad: v === "" ? null : v });
  }

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 rounded-md border border-primary/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-bold text-primary/70 truncate">{nombreComponente}</span>
        <button
          type="button"
          onClick={onEliminar}
          title="Quitar componente"
          className="shrink-0 rounded-md p-1 text-primary/25 hover:text-red-500 hover:bg-red-500/8 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Cant.
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            step="any"
            type="number"
            value={cantidadTexto}
            onChange={(e) => setCantidadTexto(e.target.value)}
            onBlur={commitCantidad}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Unidad
          <input
            className="w-14 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="—"
            type="text"
            value={unidadTexto}
            onChange={(e) => setUnidadTexto(e.target.value)}
            onBlur={commitUnidad}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Rol
          <input
            className="w-20 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="—"
            type="text"
            value={rolTexto}
            onChange={(e) => setRolTexto(e.target.value)}
            onBlur={commitRol}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Fila editable de una estructura ya asociada (material_estructuras).
 *  Mismo criterio de commit-on-blur que FilaComponente. */
function FilaEstructura({
  fila,
  nombreEstructura,
  onActualizar,
  onEliminar,
}: {
  fila: MaterialEstructura;
  nombreEstructura: string;
  onActualizar: (cambios: Partial<Pick<MaterialEstructura, "cantidad" | "proporcion" | "rol">>) => void;
  onEliminar: () => void;
}) {
  const [cantidadTexto, setCantidadTexto] = useState(String(fila.cantidad));
  const [proporcionTexto, setProporcionTexto] = useState(
    fila.proporcion === null ? "" : String(fila.proporcion),
  );
  const [rolTexto, setRolTexto] = useState(fila.rol ?? "");

  const cantidadGuardada = String(fila.cantidad);
  const proporcionGuardada = fila.proporcion === null ? "" : String(fila.proporcion);
  const rolGuardado = fila.rol ?? "";

  function commitCantidad() {
    const n = Number(cantidadTexto);
    if (cantidadTexto.trim() === "" || Number.isNaN(n) || n <= 0) {
      setCantidadTexto(cantidadGuardada);
      return;
    }
    if (n !== fila.cantidad) onActualizar({ cantidad: n });
  }

  function commitProporcion() {
    if (proporcionTexto.trim() === "") {
      if (fila.proporcion !== null) onActualizar({ proporcion: null });
      return;
    }
    const n = Number(proporcionTexto);
    if (Number.isNaN(n) || n < 0 || n > 1) {
      setProporcionTexto(proporcionGuardada);
      return;
    }
    if (n !== fila.proporcion) onActualizar({ proporcion: n });
  }

  function commitRol() {
    const v = rolTexto.trim();
    if (v !== rolGuardado) onActualizar({ rol: v === "" ? null : v });
  }

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 rounded-md border border-primary/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-bold text-primary/70 truncate">{nombreEstructura}</span>
        <button
          type="button"
          onClick={onEliminar}
          title="Quitar estructura"
          className="shrink-0 rounded-md p-1 text-primary/25 hover:text-red-500 hover:bg-red-500/8 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Cant.
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            step="any"
            type="number"
            value={cantidadTexto}
            onChange={(e) => setCantidadTexto(e.target.value)}
            onBlur={commitCantidad}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Prop.
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            max={1}
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={proporcionTexto}
            onChange={(e) => setProporcionTexto(e.target.value)}
            onBlur={commitProporcion}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Rol
          <input
            className="w-20 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="—"
            type="text"
            value={rolTexto}
            onChange={(e) => setRolTexto(e.target.value)}
            onBlur={commitRol}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      </div>
    </div>
  );
}

function MaterialDetail({ material }: { material: Material }) {
  const { confirm, ConfirmModal } = useConfirm();
  const {
    items: componentes,
    loading: loadingComponentes,
    agregar: agregarComponente,
    actualizar: actualizarComponente,
    eliminar: eliminarComponente,
  } = useMaterialComponentes(material.id);
  const {
    items: estructuras,
    loading: loadingEstructuras,
    agregar: agregarEstructura,
    actualizar: actualizarEstructura,
    eliminar: eliminarEstructura,
  } = useMaterialEstructuras(material.id);
  const { items: compuestos, loading: loadingCompuestos } = useCompuestos();
  const { items: estructurasCatalogo, loading: loadingEstructurasCatalogo } = useEstructuras();
  const { item: perfilReactivo, loading: loadingPerfilReactivo } = usePerfilReactivoMaterial(material.id);

  const [agregandoCompuestoId, setAgregandoCompuestoId] = useState<string | null>(null);
  const [guardandoComponente, setGuardandoComponente] = useState(false);
  const [agregandoEstructuraId, setAgregandoEstructuraId] = useState<string | null>(null);
  const [guardandoEstructura, setGuardandoEstructura] = useState(false);

  // Solo se ofrecen compuestos que todavía no están vinculados como
  // componente de tipo "compuesto" — evita duplicar la misma fila.
  const compuestosDisponibles = compuestos.filter(
    (c) => !componentes.some((comp) => comp.componente_tipo === "compuesto" && comp.componente_id === c.id),
  );
  const estructurasDisponibles = estructurasCatalogo.filter(
    (e) => !estructuras.some((rel) => rel.estructura_id === e.id),
  );

  async function handleAgregarComponente() {
    if (!agregandoCompuestoId) return;
    setGuardandoComponente(true);
    try {
      // Cantidad inicial neutra (1) — el usuario la ajusta después; no se
      // inventa un valor físico, es solo el punto de partida editable.
      await agregarComponente({
        componente_tipo: "compuesto",
        componente_id: agregandoCompuestoId,
        cantidad: 1,
      });
      setAgregandoCompuestoId(null);
    } finally {
      setGuardandoComponente(false);
    }
  }

  async function handleEliminarComponente(id: string, nombre: string) {
    const ok = await confirm({
      title: "Quitar componente",
      message: `¿Quitar "${nombre}" de los componentes de este material?`,
    });
    if (ok) await eliminarComponente(id);
  }

  async function handleAgregarEstructura() {
    if (!agregandoEstructuraId) return;
    setGuardandoEstructura(true);
    try {
      await agregarEstructura({ estructura_id: agregandoEstructuraId, cantidad: 1 });
      setAgregandoEstructuraId(null);
    } finally {
      setGuardandoEstructura(false);
    }
  }

  async function handleEliminarEstructura(id: string, nombre: string) {
    const ok = await confirm({
      title: "Quitar estructura",
      message: `¿Quitar "${nombre}" de las estructuras de este material?`,
    });
    if (ok) await eliminarEstructura(id);
  }

  // Propiedades físicas (jsonb propiedades_calculadas, vía
  // propiedadesCalculadasGenerico) + Perfil Reactivo Emergente V2 (vista
  // v_perfil_reactivo_material, vía propiedadesDePerfilReactivo) fundidos en
  // una sola lista — pedido explícito: mismo diseño de tarjeta para ambos,
  // como ya se hizo con "Estabilidad — detalle" en CompuestoEditor. Mientras
  // el perfil reactivo sigue cargando no se agregan sus filas todavía, para
  // no mostrar "sin dato" un instante y después aparecer.
  const propiedades = material.propiedades_calculadas ?? {};
  const propiedadesCombinadas = [
    ...propiedadesCalculadasGenerico(propiedades).map((p) => ({ ...p, grupo: p.grupo ?? "Propiedades físicas" })),
    ...(loadingPerfilReactivo ? [] : propiedadesDePerfilReactivo(perfilReactivo)),
  ];
  const fuente = etiquetaFuenteFisica(propiedades.fuente_fisica as string | undefined);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-micro text-primary/40">
            <span className="rounded px-1.5 py-0.5 bg-primary/5 font-bold">{material.tipo_material}</span>
            <span className="rounded px-1.5 py-0.5 bg-primary/5 font-bold">
              {material.estado_calculo || "sin estado"}
            </span>
          </div>
          {material.descripcion && (
            <p className="mt-1.5 text-xs leading-relaxed text-primary/55">{material.descripcion}</p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="flex flex-col gap-2 min-w-0">
          {fuente && (
            <div className="flex justify-end">
              <span
                title="Origen de estos valores: composición química y/o estructura física del material"
                className="shrink-0 rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-micro font-semibold text-primary/60"
              >
                {fuente}
              </span>
            </div>
          )}
          <TarjetaPropiedadesFisicas propiedades={propiedadesCombinadas} columnas={2} />
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-col gap-1.5 min-w-0 p-2">
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Componentes
            </span>
            {loadingComponentes ? (
              <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {componentes.length === 0 && (
                  <p className="py-1 text-micro text-primary/30">Sin componentes registrados.</p>
                )}
                {componentes.map((componente) => {
                  const compuesto =
                    componente.componente_tipo === "compuesto"
                      ? compuestos.find((item) => item.id === componente.componente_id)
                      : null;
                  return (
                    <FilaComponente
                      key={componente.id}
                      fila={componente}
                      nombreComponente={
                        compuesto?.nombre ?? `${componente.componente_tipo} · ${componente.componente_id.slice(0, 8)}`
                      }
                      onActualizar={(cambios) => actualizarComponente(componente.id, cambios)}
                      onEliminar={() =>
                        handleEliminarComponente(
                          componente.id,
                          compuesto?.nombre ?? componente.componente_id.slice(0, 8),
                        )
                      }
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ComboSelector
                  icon={<Plus size={11} />}
                  items={compuestosDisponibles.map((c) => ({ id: c.id, label: c.nombre }))}
                  label=""
                  loading={loadingCompuestos}
                  mode="single"
                  placeholder="Elegir compuesto del catálogo…"
                  value={agregandoCompuestoId}
                  onChange={setAgregandoCompuestoId}
                />
              </div>
              <button
                type="button"
                disabled={!agregandoCompuestoId || guardandoComponente}
                onClick={handleAgregarComponente}
                className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary disabled:opacity-30 transition-all px-1"
              >
                {guardandoComponente ? "Agregando…" : "Agregar"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0 p-2">
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Estructuras
            </span>
            {loadingEstructuras ? (
              <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {estructuras.length === 0 && (
                  <p className="py-1 text-micro text-primary/30">Sin estructuras asociadas.</p>
                )}
                {estructuras.map((relacion) => {
                  const estructura = estructurasCatalogo.find((item) => item.id === relacion.estructura_id);
                  return (
                    <FilaEstructura
                      key={relacion.id}
                      fila={relacion}
                      nombreEstructura={estructura?.nombre ?? relacion.estructura_id.slice(0, 8)}
                      onActualizar={(cambios) => actualizarEstructura(relacion.id, cambios)}
                      onEliminar={() =>
                        handleEliminarEstructura(relacion.id, estructura?.nombre ?? relacion.estructura_id.slice(0, 8))
                      }
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ComboSelector
                  icon={<Plus size={11} />}
                  items={estructurasDisponibles.map((e) => ({ id: e.id, label: e.nombre }))}
                  label=""
                  loading={loadingEstructurasCatalogo}
                  mode="single"
                  placeholder="Elegir estructura del catálogo…"
                  value={agregandoEstructuraId}
                  onChange={setAgregandoEstructuraId}
                />
              </div>
              <button
                type="button"
                disabled={!agregandoEstructuraId || guardandoEstructura}
                onClick={handleAgregarEstructura}
                className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary disabled:opacity-30 transition-all px-1"
              >
                {guardandoEstructura ? "Agregando…" : "Agregar"}
              </button>
            </div>
          </div>

          {material.notas && (
            <div className="flex flex-col gap-1.5 min-w-0 p-2">
              <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                Notas
              </span>
              <p className="whitespace-pre-wrap text-micro leading-relaxed text-primary/50">{material.notas}</p>
            </div>
          )}
        </div>
      </div>
      {ConfirmModal}
    </div>
  );
}

/** Mismo diseño que CompuestoCasilla (elementos/CompuestosPage.tsx): chip
 *  compacto rounded-full, px-2.5 py-1, text-micro font-bold tracking-wide,
 *  mismos estados seleccionado/hover. */
function MaterialPill({ material, selected, onClick }: { material: Material; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={material.nombre}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-bold tracking-wide transition-colors truncate max-w-full ${
        selected
          ? "text-primary border border-primary/40 ring-2 ring-primary/30"
          : "hover:bg-primary/10 text-primary/70 border border-primary/15"
      }`}
    >
      <span className="truncate">{material.nombre}</span>
    </button>
  );
}

/**
 * Panel flotante de Materiales — mismo shell exacto que ElementosPage /
 * CompuestosPage (createPortal a document.body, fixed inset-0 z-[9999],
 * backdrop con blur, contenedor w-full h-full max-w-6xl rounded-2xl con
 * animación popIn, header shrink-0 con caja de ícono + botón cerrar, cuerpo
 * flex-1 min-h-0 overflow-y-auto). Las propiedades_calculadas siguen siendo
 * de solo lectura (vienen ya derivadas de Supabase), pero Componentes y
 * Estructuras sí son editables desde acá (agregar/editar/quitar) — por eso
 * no se replica el sistema headerControls editable/guardable de
 * nombre/símbolo: se usa siempre el header "default" (caja de ícono) que
 * Elemento/Compuesto muestran cuando no hay headerControls, y la edición
 * vive dentro de cada bloque (Componentes/Estructuras) con su propio
 * guardado inmediato, no con un botón "Guardar" global.
 */
function MaterialEditorFlotante({ material, onClose }: { material: Material; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
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
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            }}
          >
            <Box className="text-primary/50" size={12} />
          </div>
          <span className="flex-1 min-w-0 truncate text-sm font-black text-primary">
            {material.nombre}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          <MaterialDetail material={material} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MaterialesPage() {
  const { items: materiales, loading } = useMateriales();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const seleccionado = materiales.find((material) => material.id === seleccionadoId) ?? null;

  return (
    <div className="px-3 pb-4 pt-2">
      {loading ? (
        <p className="py-5 text-center text-micro text-primary/35">Cargando…</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {materiales.map((material) => (
            <MaterialPill
              key={material.id}
              material={material}
              selected={material.id === seleccionadoId}
              onClick={() => setSeleccionadoId(material.id)}
            />
          ))}
        </div>
      )}
      {seleccionado && (
        <MaterialEditorFlotante material={seleccionado} onClose={() => setSeleccionadoId(null)} />
      )}
    </div>
  );
}

export default MaterialesPage;

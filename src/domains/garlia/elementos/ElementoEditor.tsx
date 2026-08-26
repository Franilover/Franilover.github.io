"use client";

/**
 * ElementoEditor.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Detalle editable de un Elemento: número atómico, nombre, símbolo, familia,
 * noble sí/no, notas, y las 3 capas (núcleo/media/externa) — cada una con
 * un input numérico por tipo de partícula (0 = no aparece en la capa).
 *
 * Guardado con debounce simple al perder foco (blur) / al cambiar selects,
 * mismo criterio que el resto de editores del panel admin: update directo
 * a Supabase + propagación al estado del padre via onActualizar.
 */

import { Beaker, ChevronLeft } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

import { EditorHeaderBar } from "../_shared/EditorHeaderBar";
import { usePublishHeaderControls, type OnHeaderControlsChange } from "../_shared/useEditorHeaderControls";
import { type SaveStatus } from "@/ui/saveStatus";

import {
  calcularParticulaDominante,
  calcularReactividadElemento,
} from "./afinidad";
import {
  ELEMENT_FAMILIES,
  LAYER_LABEL,
  LAYER_PARTICLES,
  PARTICLE_INITIAL,
  PARTICLE_TYPES,
  capacidadExterna,
  layerTotal,
  propiedadesCalculadasDeElemento,
  type Compuesto,
  type Elemento,
  type ElementFamily,
  type LayerName,
  type ParticleMap,
  type ParticleType,
  type PropiedadCalculada,
} from "./types";
import { useParticulas } from "../fisica/useFisica";
import { useElementoSitiosEnlace, type ElementoSitioEnlace } from "./useElementoSitiosEnlace";

interface Props {
  elemento: Elemento;
  todosLosElementos?: Elemento[];
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
  /** Publica los controles de header (nombre, símbolo, guardar, eliminar)
   *  hacia el contenedor (ElementoPanelFlotante), que los renderiza en su
   *  propia barra para evitar la barra duplicada. Si no se pasa, este
   *  editor sigue mostrando su propia barra (uso standalone). */
  onHeaderControlsChange?: OnHeaderControlsChange;
  /** Catálogo de compuestos, para mostrar en qué compuestos se usa este
   *  elemento (columna junto a Notas). Si no se pasa, esa sección no se
   *  muestra. */
  compuestos?: Compuesto[];
  /** Navega al panel flotante de un Compuesto donde se usa este elemento,
   *  al clickear uno de la lista. */
  onNavigateCompuesto?: (compuestoId: string) => void;
}

export function ElementoEditor({
  elemento,
  todosLosElementos,
  onBack,
  onActualizar,
  onEliminar,
  onHeaderControlsChange,
  compuestos,
  onNavigateCompuesto,
}: Props) {
  const { confirm, ConfirmModal } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(elemento);

  useEffect(() => setLocal(elemento), [elemento]);

  // Estado Noble (sección 3.2): la capa externa debe estar 100% saturada
  // para que "es_noble" sea coherente con la regla de bloqueo de enlaces.
  // Ya no es un toggle manual: se deriva 100% de las partículas — si la
  // capa externa está saturada, el elemento ES Noble, sin excepción.
  const totalExterna = useMemo(() => layerTotal(local.externa), [local.externa]);
  const capacidadTotalExterna = useMemo(
    () => capacidadExterna(local.numero_atomico),
    [local.numero_atomico],
  );
  const esNobleDerivado = capacidadTotalExterna > 0 && totalExterna === capacidadTotalExterna;

  // Mantiene local.es_noble sincronizado con el derivado y lo persiste
  // apenas cambia (ej. al completar o vaciar la capa externa), sin que el
  // usuario tenga que tocar nada — reemplaza al toggle manual de antes.
  useEffect(() => {
    if (local.es_noble === esNobleDerivado) return;
    setLocal((prev) => ({ ...prev, es_noble: esNobleDerivado }));
    persist({ es_noble: esNobleDerivado });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esNobleDerivado]);

  async function persist(cambios: Partial<Elemento>) {
    setSaving(true);
    try {
      const { error } = await supabase.from("elementos").update(cambios).eq("id", elemento.id);
      if (error) throw error;
      onActualizar(elemento.id, cambios);
    } catch (e) {
      console.error("[ElementoEditor] error guardando:", e);
    } finally {
      setSaving(false);
    }
  }

  function setLayerValue(layer: LayerName, particle: string, value: number) {
    const current: ParticleMap = { ...(local[layer] || {}) };
    if (value > 0) current[particle as keyof ParticleMap] = value;
    else delete current[particle as keyof ParticleMap];
    setLocal((prev) => ({ ...prev, [layer]: current }));
  }

  // Partícula(s) dominante(s): la(s) de mayor cantidad sumando las 3 capas.
  const dominantes = useMemo(() => calcularParticulaDominante(local), [local]);

  // Reactividad ("energía de activación"): cuánto déficit acumulado tiene
  // el elemento solo — mismo cálculo que para compuestos, aplicado a un
  // elemento suelto (ver calcularReactividadElemento en afinidad.ts).
  const reactividad = useMemo(() => calcularReactividadElemento(local), [local]);

  // Propiedades físicas calculadas por Supabase (masa, estabilidad, rigidez,
  // dureza, etc.) — puramente de lectura, ver propiedadesCalculadasDeElemento.
  const propiedadesFisicas = useMemo(() => propiedadesCalculadasDeElemento(local), [local]);
  const { items: sitiosEnlace, loading: sitiosLoading } = useElementoSitiosEnlace(elemento.id);

  // Compuestos donde se usa este elemento — para la columna junto a Notas.
  const compuestosQueLoUsan = useMemo(
    () =>
      (compuestos ?? []).filter((c) =>
        (c.componentes ?? []).some((comp) => comp.elemento_id === elemento.id),
      ),
    [compuestos, elemento.id],
  );

  async function handleEliminar() {
    if (!onEliminar) return;
    const ok = await confirm({
      title: "Eliminar elemento",
      message: `¿Eliminar "${local.nombre}" de la tabla? Esta acción no se puede deshacer.`,
    });
    if (ok) onEliminar(elemento.id);
  }

  function handleGuardar() {
    persist({
      nombre: local.nombre,
      simbolo: local.simbolo,
      familia: local.familia,
      es_noble: local.es_noble,
      es_catalizador: local.es_catalizador,
      notas: local.notas,
      nucleo: local.nucleo,
      media: local.media,
      externa: local.externa,
    });
  }

  const status: SaveStatus = saving ? "saving" : "idle";

  const headerControls = {
    prefix: (
      <>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <ChevronLeft size={12} />
        </button>
        <span className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/30 px-1.5 py-0.5 rounded border border-primary/15">
          #{local.numero_atomico}
        </span>
      </>
    ),
    nombre: local.nombre ?? "",
    placeholderNombre: "Nombre del elemento",
    onChangeNombre: (nombre: string) => setLocal((p) => ({ ...p, nombre })),
    onBlurNombre: () => persist({ nombre: local.nombre }),
    status,
    onGuardar: handleGuardar,
    onEliminar: handleEliminar,
    extra: (
      <input
        value={local.simbolo ?? ""}
        onChange={(e) => setLocal((p) => ({ ...p, simbolo: e.target.value }))}
        onBlur={() => persist({ simbolo: local.simbolo })}
        placeholder="Sm"
        maxLength={3}
        className="shrink-0 w-10 text-center bg-primary/5 rounded-md px-1 py-0.5 text-micro font-black text-primary outline-none placeholder:text-primary/25 border border-primary/10"
      />
    ),
  };

  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />
      {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

      {/* Body */}
      <div className="flex-1 min-h-0 p-2.5 flex flex-col gap-3 overflow-y-auto">
        {/* Notas (izquierda) + Selectores (centro, apilados verticalmente)
            + En qué compuestos se usa (derecha) — misma fila de 3 columnas. */}
        <div className="grid grid-cols-[1.4fr_minmax(9rem,0.7fr)_1fr] gap-3 items-start">
          <div className="flex flex-col gap-0.5">
            <RichEditor
              minHeight="10rem"
              placeholder="Descripción del elemento…"
              value={local.notas ?? ""}
              onChange={(v) => {
                setLocal((p) => ({ ...p, notas: v }));
                persist({ notas: v });
              }}
            />
          </div>

          {/* Columna de selectores: N° atómico, Familia, Noble, Catalizador
              — cada fila con borde sutil propio (mismo estilo que las
              columnas de capa atómica y las filas de Elementos que lo
              componen en Compuestos), label a la izquierda y control a
              la derecha, sin bordes individuales en los controles. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/10 px-2 py-1.5">
              <label
                className="text-micro font-black uppercase tracking-[0.2em] text-primary/30"
                title="El Número Atómico es solo la posición de orden en la Tabla Periódica (1 a 62) — no es la suma de partículas del elemento."
              >
                N° atómico
              </label>
              <input
                type="number"
                value={local.numero_atomico}
                onChange={(e) =>
                  setLocal((p) => ({ ...p, numero_atomico: Number(e.target.value) }))
                }
                onBlur={() => persist({ numero_atomico: local.numero_atomico })}
                className="w-16 shrink-0 bg-transparent rounded-md px-1 py-1 text-micro font-bold text-primary outline-none text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/10 px-2 py-1.5">
              <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                Familia
              </label>
              <select
                value={local.familia}
                onChange={(e) => {
                  const familia = e.target.value as ElementFamily;
                  setLocal((p) => ({ ...p, familia }));
                  persist({ familia });
                }}
                className="w-28 shrink-0 bg-transparent rounded-md px-1 py-1 text-micro font-bold text-primary outline-none text-right"
              >
                {ELEMENT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                esNobleDerivado
                  ? "bg-primary border-primary"
                  : "border-primary/10"
              }`}
            >
              <label
                className={`text-micro font-black uppercase tracking-[0.2em] ${
                  esNobleDerivado ? "text-btn-text/70" : "text-primary/30"
                }`}
                title="Estado Noble (sección 3.2): se calcula solo — capa externa 100% saturada. No puede iniciar ni aceptar enlaces nuevos, sin importar el balance de Voluntad/Percepción."
              >
                Noble
              </label>
              <span
                title={
                  esNobleDerivado
                    ? "Capa externa saturada — bloquea enlaces nuevos en toda la app."
                    : `Capa externa ${totalExterna}/${capacidadTotalExterna} — todavía no está saturada.`
                }
                className={`text-micro font-bold ${
                  esNobleDerivado ? "text-btn-text" : "text-primary/40"
                }`}
              >
                {esNobleDerivado ? "Sí" : "No"}
              </span>
            </div>

            <div
              className={`relative flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                local.es_catalizador
                  ? "bg-primary border-primary"
                  : "border-primary/10"
              }`}
            >
              <label
                title="Reduce el déficit/energía de activación de un compuesto sin sumar sus partículas a las capas y sin consumirse — igual que un catalizador real."
                className={`text-micro font-black uppercase tracking-[0.2em] ${
                  local.es_catalizador ? "text-btn-text/70" : "text-primary/30"
                }`}
              >
                Catalizador
              </label>
              <button
                type="button"
                onClick={() => {
                  const es_catalizador = !local.es_catalizador;
                  setLocal((p) => ({ ...p, es_catalizador }));
                  persist({ es_catalizador });
                }}
                className={`absolute inset-0 w-full h-full cursor-pointer`}
                aria-label="Alternar catalizador"
              />
              <span
                className={`text-micro font-bold pointer-events-none ${
                  local.es_catalizador ? "text-btn-text" : "text-primary/50"
                }`}
              >
                {local.es_catalizador ? "Sí" : "No"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="min-h-[10rem] max-h-[10rem] overflow-y-auto p-1 flex flex-col gap-0.5">
              {compuestos === undefined ? (
                <p className="text-micro text-primary/25 text-center py-3">
                  No disponible acá.
                </p>
              ) : compuestosQueLoUsan.length === 0 ? (
                <p className="text-micro text-primary/25 text-center py-3">
                  Este elemento todavía no se usa en ningún compuesto.
                </p>
              ) : (
                compuestosQueLoUsan.map((c) => {
                  const comp = (c.componentes ?? []).find((x) => x.elemento_id === elemento.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onNavigateCompuesto?.(c.id)}
                      disabled={!onNavigateCompuesto}
                      title={onNavigateCompuesto ? "Abrir este compuesto" : undefined}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-primary/5 disabled:cursor-default disabled:hover:bg-transparent cursor-pointer"
                    >
                      <Beaker size={11} className="text-accent/60 shrink-0" />
                      <span className="shrink-0 text-micro font-black text-primary/70">
                        {c.simbolo || "??"}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-micro text-primary/70">
                        {c.nombre}
                      </span>
                      {comp && (
                        <span className="shrink-0 text-micro text-primary/30">{comp.cantidad}×</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Átomo (izquierda) + Capas atómicas (derecha), lado a lado.
            items-stretch para que el átomo (cuadrado, aspect-square) crezca
            hasta la misma altura que el bloque de capas de al lado. */}
        <div className="grid grid-cols-[auto_1fr] gap-3 items-stretch">
          {/* Visualización tipo átomo real: núcleo + capas orbitales, pero
              con las partículas propias del mundo (Masa, Cinética,
              Voluntad…) en vez de protones/neutrones/electrones genéricos. */}
          <AtomoVisual elemento={local} />

          {/* Capas: título con el ratio deficit/capacidad y, justo detrás,
              las partículas dominantes (mismo chip que antes vivía en Rol,
              ahora eliminado). */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-1.5">
                <span
                  title="Déficit acumulado sobre la capacidad total de las 3 capas"
                  className="text-micro font-black tabular-nums text-primary/40"
                >
                  {reactividad.deficitTotal}/{reactividad.capacidadTotal}
                </span>
                {dominantes.length > 0 && (
                  <span
                    title="Partícula(s) dominante(s)"
                    className="text-micro font-bold text-primary/60 bg-primary/5 rounded px-1.5 py-0.5"
                  >
                    {dominantes.map((d) => d.particula).join(" / ")}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["nucleo", "media", "externa"] as LayerName[]).map((layer, i) => (
                <div
                  key={layer}
                  className="flex flex-col gap-2 p-2 rounded-lg border border-primary/10"
                >
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 text-center">
                    {LAYER_LABEL[layer]}
                  </span>
                  <div className="border-t border-primary/10" />
                  <div className="flex flex-col items-stretch gap-1.5">
                    {LAYER_PARTICLES[layer].map((particle) => {
                      const value = local[layer]?.[particle] ?? 0;
                      return (
                        <div
                          key={particle}
                          className="flex items-center justify-between gap-1.5 pl-2.5 pr-1 py-1.5"
                        >
                          <span className="text-xs font-bold text-primary/60 truncate">
                            {particle}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={(e) =>
                              setLayerValue(layer, particle, Math.max(0, Number(e.target.value)))
                            }
                            onBlur={() => persist({ [layer]: local[layer] } as Partial<Elemento>)}
                            className="w-9 shrink-0 text-center bg-transparent text-sm font-black text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 items-start">
          <PropiedadesFisicasBloque propiedades={propiedadesFisicas} />
          <SitiosEnlaceBloque sitios={sitiosEnlace} loading={sitiosLoading} />
        </div>
      </div>
    </div>
  );
}

/**
 * Sitios de enlace del elemento (tabla "elemento_sitios_enlace"): agrupa
 * sitios idénticos (mismo tipo+geometría+afinidad+capacidad+selectividad,
 * que es lo usual — ver useElementoSitiosEnlace) en una sola fila con un
 * contador "×N", en vez de repetir la fila por cada numero_sitio. Solo
 * lectura, mismo criterio derivado que PropiedadesFisicasBloque.
 */
function SitiosEnlaceBloque({
  sitios,
  loading,
}: {
  sitios: ElementoSitioEnlace[];
  loading: boolean;
}) {
  const grupos = useMemo(() => {
    const mapa = new Map<string, { sitio: ElementoSitioEnlace; cantidad: number }>();
    for (const s of sitios) {
      const clave = [
        s.tipo,
        s.geometria_clave,
        s.afinidad,
        s.capacidad,
        s.selectividad,
        s.saturacion,
        s.estado,
      ].join("|");
      const existente = mapa.get(clave);
      if (existente) existente.cantidad += 1;
      else mapa.set(clave, { sitio: s, cantidad: 1 });
    }
    return Array.from(mapa.values());
  }, [sitios]);

  if (loading || grupos.length === 0) return null;

  const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(2));

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-primary/10 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Sitios de enlace
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {grupos.map(({ sitio, cantidad }, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5 rounded-md border border-primary/10 px-2 py-1"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-micro font-black text-primary/60 shrink-0">×{cantidad}</span>
              <span className="text-micro font-bold text-primary/70 truncate capitalize">
                {sitio.tipo}
                {sitio.geometria_clave && (
                  <span className="font-normal text-primary/40"> · {sitio.geometria_clave}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span title="Afinidad" className="text-micro tabular-nums text-primary/50">
                af {fmt(sitio.afinidad)}
              </span>
              <span title="Capacidad" className="text-micro tabular-nums text-primary/50">
                cap {fmt(sitio.capacidad)}
              </span>
              <span title="Selectividad" className="text-micro tabular-nums text-primary/50">
                sel {fmt(sitio.selectividad)}
              </span>
              <span
                title="Saturación"
                className={`text-micro font-bold tabular-nums ${
                  (sitio.saturacion ?? 0) > 0 ? "text-primary/70" : "text-primary/30"
                }`}
              >
                sat {fmt(sitio.saturacion)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Sección de solo lectura con las propiedades físicas que Supabase calcula
 * automáticamente (trigger calcular_propiedades_elemento) a partir de las 3
 * capas de partículas. Nunca editable desde acá — cambian solo si cambia la
 * composición del elemento arriba. El título "derivado" + el ícono distinto
 * marcan visualmente que no son campos manuales, mismo criterio pedido para
 * Compuesto.
 */
function PropiedadesFisicasBloque({ propiedades }: { propiedades: PropiedadCalculada[] }) {
  const conValor = propiedades.filter((p) => p.valor !== null);
  if (conValor.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-primary/10 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Propiedades físicas
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {conValor.map((p) => (
          <div
            key={p.clave}
            title={p.descripcion}
            className="flex flex-col gap-1 rounded-md border border-primary/10 px-2 py-1.5"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-micro font-bold text-primary/50 truncate">{p.label}</span>
              <span className="text-micro font-black text-primary/70 tabular-nums shrink-0">
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

// ─── Visualización tipo átomo real ──────────────────────────────────────
// Núcleo central con las partículas de la capa "nucleo" (equivalente a
// protones/neutrones) y dos anillos orbitales para "media" y "externa"
// (equivalente a las capas de electrones), cada uno con las partículas
// propias del mundo (Masa, Cinética, Voluntad, etc.) girando alrededor en
// vez de electrones genéricos. Cada tipo de partícula recibe un color
// determinístico derivado de --primary/--accent (sin paleta hardcodeada),
// así distintos tipos se distinguen entre sí de forma consistente.
const PARTICLE_HUE_MIX = PARTICLE_TYPES.reduce<Record<string, number>>((acc, p, i) => {
  acc[p] = Math.round((i / PARTICLE_TYPES.length) * 100);
  return acc;
}, {});

const LETRA_ATS_COLOR: Record<"A" | "T" | "S", { bg: string; border: string; fg: string }> = {
  A: { bg: "color-mix(in srgb, #22c55e 18%, transparent)", border: "#22c55e", fg: "#15803d" },
  T: { bg: "color-mix(in srgb, #ef4444 18%, transparent)", border: "#ef4444", fg: "#b91c1c" },
  S: { bg: "color-mix(in srgb, #3b82f6 18%, transparent)", border: "#3b82f6", fg: "#1d4ed8" },
};

function sectorPathAtomo(cx: number, cy: number, r: number, anguloIni: number, anguloFin: number): string {
  const x1 = cx + r * Math.cos(anguloIni);
  const y1 = cy + r * Math.sin(anguloIni);
  const x2 = cx + r * Math.cos(anguloFin);
  const y2 = cy + r * Math.sin(anguloFin);
  const largo = anguloFin - anguloIni > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largo} 1 ${x2} ${y2} Z`;
}

function colorDeParticula(particula: ParticleType): { fg: string; bg: string; border: string } {
  // Alterna entre --primary y --accent según la posición del tipo en
  // PARTICLE_TYPES, variando el porcentaje de mezcla — 100% dinámico
  // (deriva de las variables de tema, nunca un hex fijo). Fondo sólido y
  // fuerte (no transparente) + texto con --btn-text (misma variable que ya
  // usa el resto de la app para texto de alto contraste sobre bg-primary
  // sólido), así las letras siempre se leen sin importar el tema activo.
  const base = PARTICLE_TYPES.indexOf(particula) % 2 === 0 ? "--primary" : "--accent";
  const mix = 60 + (PARTICLE_HUE_MIX[particula] % 30);
  return {
    fg: "var(--btn-text)",
    bg: `color-mix(in srgb, var(${base}) ${mix}%, var(--bg-main))`,
    border: `color-mix(in srgb, var(${base}) 90%, black)`,
  };
}

/** Une todas las ocurrencias de una capa en una lista plana de partículas
 * individuales (ej. {Masa: 2} → ["Masa", "Masa"]) para poder distribuirlas
 * una por una alrededor de una órbita. */
function particulasDeCapa(layer: ParticleMap | null | undefined): ParticleType[] {
  if (!layer) return [];
  const out: ParticleType[] = [];
  for (const tipo of PARTICLE_TYPES) {
    const n = layer[tipo] ?? 0;
    for (let i = 0; i < n; i++) out.push(tipo);
  }
  return out;
}

/**
 * Perfil mínimo que necesita AtomoVisual: las 3 capas como ParticleMap.
 * Tanto Elemento como el PerfilAtomico calculado de un Compuesto (suma de
 * partículas de todos sus elementos componentes) cumplen esta forma, por
 * eso el mismo dibujo sirve para ambos sin duplicar el SVG.
 */
export interface PerfilConCapas {
  nucleo?: ParticleMap | null;
  media?: ParticleMap | null;
  externa?: ParticleMap | null;
}

export function AtomoVisual({
  elemento,
  className,
}: {
  elemento: PerfilConCapas;
  /** Clases del contenedor (tamaño/forma). Por defecto se comporta como
   *  siempre — cuadrado atado a la altura del padre (h-full) — para no
   *  romper el uso existente en ElementoEditor. Pasar algo como
   *  "w-full aspect-square h-auto" cuando el padre es una columna angosta
   *  y se quiere que la molécula use todo el ancho disponible en vez de
   *  quedar chica por depender de una altura fija. */
  className?: string;
}) {
  const [modo, setModo] = useState<"inicial" | "ats">("inicial");
  const nucleares = useMemo(() => particulasDeCapa(elemento.nucleo), [elemento.nucleo]);
  const capaMedia = useMemo(() => particulasDeCapa(elemento.media), [elemento.media]);
  const capaExterna = useMemo(() => particulasDeCapa(elemento.externa), [elemento.externa]);

  // Fórmula A/T/S real leída de la tabla "particulas" en Supabase (misma
  // fuente que usa Física) en vez de una constante fija en el frontend —
  // así el modo "ats" refleja siempre la convención vigente sin necesidad
  // de tocar código cuando cambia en la base de datos.
  const { items: particulasDb } = useParticulas();
  const formulaPorNombre = useMemo(() => {
    const out: Partial<Record<ParticleType, string>> = {};
    for (const p of particulasDb) {
      if (PARTICLE_TYPES.includes(p.nombre as ParticleType)) {
        out[p.nombre as ParticleType] = p.formula;
      }
    }
    return out;
  }, [particulasDb]);

  const hayParticulas = nucleares.length + capaMedia.length + capaExterna.length > 0;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radios = { media: 48, externa: 82 };

  // El núcleo no tiene radio de órbita fijo: a más partículas apiñadas,
  // más chicas y más separadas del centro necesitan estar para no
  // solaparse. Escala en base a la cantidad, con piso y techo para que
  // ni quede gigante con 1 partícula ni ilegible con muchas.
  const nucleoCount = Math.max(nucleares.length, 1);
  const nucleoParticleRadius = Math.max(4, Math.min(10, 15 - nucleoCount * 0.7));
  const nucleoOrbitRadius = nucleoCount === 1 ? 0 : Math.max(12, Math.min(26, 10 + nucleoCount * 1.6));
  const nucleoFontSize = Math.max(3.5, nucleoParticleRadius * 0.75);

  const particleRadius = { nucleo: nucleoParticleRadius, orbita: 9 };
  const fontSize = { nucleo: nucleoFontSize, orbita: 7 };

  function posicionEnOrbita(i: number, total: number, radio: number) {
    const angulo = (i / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angulo) * radio, y: cy + Math.sin(angulo) * radio };
  }

  /** Dibuja el contenido de un círculo de partícula según el modo activo:
   *  "inicial" = círculo sólido con la letra corta (M, C, P...); "ats" =
   *  3 tercios A/T/S en miniatura, igual que ParticulaVisual en Física. */
  function contenidoParticula(particula: ParticleType, r: number, font: number) {
    if (modo === "inicial") {
      const color = colorDeParticula(particula);
      return (
        <>
          <circle r={r} strokeWidth={1.5} style={{ fill: color.bg, stroke: color.border }} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={font} fontWeight={900} style={{ fill: color.fg }}>
            {PARTICLE_INITIAL[particula]}
          </text>
        </>
      );
    }
    const formula = formulaPorNombre[particula] ?? "";
    const letras = formula.split("").filter((c): c is "A" | "T" | "S" => c === "A" || c === "T" || c === "S");
    const anguloTercio = (Math.PI * 2) / 3;
    const miniFont = r * 0.62;
    const labelR = r * 0.55;
    return (
      <>
        {letras.map((letra, j) => {
          const aIni = -Math.PI / 2 + j * anguloTercio;
          const aFin = aIni + anguloTercio;
          const aMedio = (aIni + aFin) / 2;
          const color = LETRA_ATS_COLOR[letra];
          return (
            <g key={j}>
              <path d={sectorPathAtomo(0, 0, r, aIni, aFin)} strokeWidth={1} style={{ fill: color.bg, stroke: color.border }} />
              <text
                x={labelR * Math.cos(aMedio)}
                y={labelR * Math.sin(aMedio)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={miniFont}
                fontWeight={900}
                style={{ fill: color.fg }}
              >
                {letra}
              </text>
            </g>
          );
        })}
        <circle r={r} fill="none" strokeWidth={1} style={{ stroke: "var(--bg-main)" }} />
      </>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center p-2 ${
        className ?? "shrink-0 aspect-square h-full"
      }`}
      title="Representación del átomo: núcleo + capas orbitales con las partículas propias del mundo"
    >
      {hayParticulas && (
        <button
          type="button"
          onClick={() => setModo((m) => (m === "inicial" ? "ats" : "inicial"))}
          title={modo === "inicial" ? "Mostrar letras A/T/S" : "Mostrar iniciales de las Partículas"}
          className="absolute bottom-1 right-1 z-10 flex items-center justify-center rounded-full border shadow-sm cursor-pointer transition-transform hover:scale-110"
          style={{
            width: 22,
            height: 22,
            fontSize: 10,
            fontWeight: 900,
            background: "var(--primary)",
            color: "var(--btn-text)",
            borderColor: "color-mix(in srgb, var(--primary) 90%, black)",
          }}
        >
          {modo === "inicial" ? "∆" : "Aa"}
        </button>
      )}

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-w-full max-h-full">
        {/* Órbitas: solo el trazo, sin relleno */}
        {(["media", "externa"] as const).map((layer) => (
          <circle
            key={layer}
            cx={cx}
            cy={cy}
            r={radios[layer]}
            fill="none"
            style={{ stroke: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
            strokeDasharray="2 4"
            strokeWidth={1.5}
          />
        ))}

        {/* Núcleo: partículas de la capa "nucleo" apiladas al centro */}
        <g>
          {nucleares.length === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={particleRadius.nucleo}
              style={{ fill: "color-mix(in srgb, var(--primary) 15%, transparent)" }}
            />
          ) : (
            nucleares.map((particula, i) => {
              const pos =
                nucleares.length === 1
                  ? { x: cx, y: cy }
                  : posicionEnOrbita(i, nucleares.length, nucleoOrbitRadius);
              return (
                <g key={`${particula}-${i}`} transform={`translate(${pos.x}, ${pos.y})`}>
                  <title>{particula}</title>
                  {contenidoParticula(particula, particleRadius.nucleo, fontSize.nucleo)}
                </g>
              );
            })
          )}
        </g>

        {/* Capas orbitales: cada partícula distribuida a lo largo del anillo */}
        {(
          [
            { layer: "media" as const, particulas: capaMedia, radio: radios.media },
            { layer: "externa" as const, particulas: capaExterna, radio: radios.externa },
          ]
        ).map(({ layer, particulas, radio }) =>
          particulas.map((particula, i) => {
            const pos = posicionEnOrbita(i, particulas.length, radio);
            return (
              <g key={`${layer}-${particula}-${i}`} transform={`translate(${pos.x}, ${pos.y})`}>
                <title>{particula}</title>
                {contenidoParticula(particula, particleRadius.orbita, fontSize.orbita)}
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

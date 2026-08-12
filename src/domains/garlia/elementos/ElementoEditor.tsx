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

import { ChevronLeft, Save, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";
import { useConfirm } from "@/ui/ConfirmModal";

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
  type Elemento,
  type ElementFamily,
  type LayerName,
  type ParticleMap,
  type ParticleType,
} from "./types";

interface Props {
  elemento: Elemento;
  todosLosElementos?: Elemento[];
  onBack: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
}

export function ElementoEditor({
  elemento,
  todosLosElementos,
  onBack,
  onActualizar,
  onEliminar,
}: Props) {
  const { confirm, ConfirmModal } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(elemento);

  useEffect(() => setLocal(elemento), [elemento]);

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

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />
      {/* Header */}
      <div
        style={{ background: "var(--bg-main)" }}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
      >
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

        <input
          value={local.nombre ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, nombre: e.target.value }))}
          onBlur={() => persist({ nombre: local.nombre })}
          placeholder="Nombre del elemento"
          className="flex-1 min-w-0 bg-transparent text-micro font-black text-primary outline-none placeholder:text-primary/25"
        />

        <input
          value={local.simbolo ?? ""}
          onChange={(e) => setLocal((p) => ({ ...p, simbolo: e.target.value }))}
          onBlur={() => persist({ simbolo: local.simbolo })}
          placeholder="Sm"
          maxLength={3}
          className="shrink-0 w-10 text-center bg-primary/5 rounded-md px-1 py-0.5 text-micro font-black text-primary outline-none placeholder:text-primary/25 border border-primary/10"
        />

        <div className="shrink-0 flex items-center gap-1">
          {onEliminar && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: "Eliminar elemento",
                  message: `¿Eliminar "${local.nombre}" de la tabla? Esta acción no se puede deshacer.`,
                });
                if (ok) onEliminar(elemento.id);
              }}
              className="flex items-center justify-center w-6 h-6 rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
              title="Eliminar"
            >
              <Trash2 size={11} />
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() =>
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
              })
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save size={10} />
            {saving ? "…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 p-2.5 flex flex-col gap-3 overflow-y-auto">
        {/* Metadatos: N° atómico, Familia, Noble y Catalizador en una sola
            fila de 4 columnas. */}
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              N° atómico
            </label>
            <input
              type="number"
              value={local.numero_atomico}
              onChange={(e) =>
                setLocal((p) => ({ ...p, numero_atomico: Number(e.target.value) }))
              }
              onBlur={() => persist({ numero_atomico: local.numero_atomico })}
              className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          <div className="flex flex-col gap-0.5">
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
              className="bg-primary/5 rounded-md px-2 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
            >
              {ELEMENT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
              Noble
            </label>
            <button
              type="button"
              onClick={() => {
                const es_noble = !local.es_noble;
                setLocal((p) => ({ ...p, es_noble }));
                persist({ es_noble });
              }}
              className={`rounded-md px-2 py-1 text-micro font-bold outline-none border transition-all cursor-pointer truncate ${
                local.es_noble
                  ? "bg-primary text-btn-text border-primary"
                  : "bg-primary/5 text-primary/50 border-primary/10 hover:border-primary/30"
              }`}
            >
              {local.es_noble ? "Sí" : "No"}
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            <label
              title="Reduce el déficit/energía de activación de un compuesto sin sumar sus partículas a las capas y sin consumirse — igual que un catalizador real."
              className="text-micro font-black uppercase tracking-[0.2em] text-primary/30"
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
              className={`rounded-md px-2 py-1 text-micro font-bold outline-none border transition-all cursor-pointer truncate ${
                local.es_catalizador
                  ? "bg-primary text-btn-text border-primary"
                  : "bg-primary/5 text-primary/50 border-primary/10 hover:border-primary/30"
              }`}
            >
              {local.es_catalizador ? "Sí" : "No"}
            </button>
          </div>
        </div>

        {/* Notas: expandido a ancho completo, editor rich text (Lexical)
            en vez de textarea plano — mismo componente que usa el resto
            de la app para descripciones largas (ver MineralEditor). */}
        <div className="flex flex-col gap-0.5">
          <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Notas
          </label>
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
            <div className="flex items-center justify-between">
              <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/25">
                Capas atómicas
              </p>
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
                    className="text-micro font-bold text-accent/70 bg-accent/10 rounded px-1.5 py-0.5"
                  >
                    {dominantes.map((d) => d.particula).join(" / ")}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 rounded-lg border border-primary/10 overflow-hidden">
              {(["nucleo", "media", "externa"] as LayerName[]).map((layer, i) => (
                <div
                  key={layer}
                  className={`flex flex-col gap-2 p-2 ${
                    i > 0 ? "border-l border-primary/10" : ""
                  } bg-primary/[0.02]`}
                >
                  <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 text-center">
                    {LAYER_LABEL[layer]}
                  </span>
                  <div className="flex flex-col items-stretch gap-1.5">
                    {LAYER_PARTICLES[layer].map((particle) => {
                      const value = local[layer]?.[particle] ?? 0;
                      return (
                        <div
                          key={particle}
                          className="flex items-center justify-between gap-1.5 bg-primary/5 rounded-lg pl-2.5 pr-1 py-1.5 border border-primary/10 focus-within:border-primary/30"
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

function AtomoVisual({ elemento }: { elemento: Elemento }) {
  const nucleares = useMemo(() => particulasDeCapa(elemento.nucleo), [elemento.nucleo]);
  const capaMedia = useMemo(() => particulasDeCapa(elemento.media), [elemento.media]);
  const capaExterna = useMemo(() => particulasDeCapa(elemento.externa), [elemento.externa]);

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radios = { media: 48, externa: 82 };
  const particleRadius = { nucleo: 10, orbita: 9 };
  const fontSize = { nucleo: 7.5, orbita: 7 };

  function posicionEnOrbita(i: number, total: number, radio: number) {
    const angulo = (i / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angulo) * radio, y: cy + Math.sin(angulo) * radio };
  }

  return (
    <div
      className="shrink-0 aspect-square h-full rounded-lg border border-primary/10 bg-primary/[0.02] flex items-center justify-center p-2"
      title="Representación del átomo: núcleo + capas orbitales con las partículas propias del mundo"
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-w-full max-h-full">
        {/* Órbitas: solo el trazo, sin relleno */}
        {(["media", "externa"] as const).map((layer) => (
          <circle
            key={layer}
            cx={cx}
            cy={cy}
            r={radios[layer]}
            fill="none"
            style={{ stroke: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            strokeDasharray="2 4"
            strokeWidth={1}
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
              const color = colorDeParticula(particula);
              const pos =
                nucleares.length === 1
                  ? { x: cx, y: cy }
                  : posicionEnOrbita(i, nucleares.length, particleRadius.nucleo + 4);
              return (
                <g key={`${particula}-${i}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={particleRadius.nucleo}
                    strokeWidth={1.5}
                    style={{ fill: color.bg, stroke: color.border }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={fontSize.nucleo}
                    fontWeight={900}
                    style={{ fill: color.fg }}
                  >
                    {PARTICLE_INITIAL[particula]}
                  </text>
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
            const color = colorDeParticula(particula);
            const pos = posicionEnOrbita(i, particulas.length, radio);
            return (
              <g key={`${layer}-${particula}-${i}`}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={particleRadius.orbita}
                  strokeWidth={1.5}
                  style={{ fill: color.bg, stroke: color.border }}
                />
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize.orbita}
                  fontWeight={900}
                  style={{ fill: color.fg }}
                >
                  {PARTICLE_INITIAL[particula]}
                </text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

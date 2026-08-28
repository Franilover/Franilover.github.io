"use client";

import React, { useMemo, useState } from "react";
import {
  Atom,
  BarChart3,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Gauge,
  GitBranch,
  Info,
  Layers3,
  Orbit,
  Radio,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

// V1 visual laboratory: the values below are illustrative UI fixtures only.
// Never promote them to canonical worldbuilding data without connecting a
// verified Supabase adapter. The visualizer is deliberately data-driven so
// the frontend team can replace the fixture with real catalog/view data later.

type SectionKey =
  | "micro"
  | "ats"
  | "formula"
  | "material"
  | "structure"
  | "reactivity"
  | "energy"
  | "electric"
  | "information"
  | "oris"
  | "runas"
  | "process";

type Metric = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  formula?: string;
};

const metricDemo: Metric[] = [
  { key: "masa", label: "Masa", value: 12, unit: "kg" },
  { key: "volumen", label: "Volumen", value: 0.004, unit: "m³" },
  {
    key: "densidad",
    label: "Densidad",
    value: 3000,
    unit: "kg/m³",
    formula: "ρ = m / V",
  },
  { key: "rigidez", label: "Rigidez", value: 0.72, min: 0, max: 1 },
  { key: "flexibilidad", label: "Flexibilidad", value: 0.38, min: 0, max: 1 },
  { key: "estabilidad", label: "Estabilidad", value: 0.81, min: 0, max: 1 },
  { key: "resistencia", label: "Resistencia", value: 0.67, min: 0, max: 1 },
];

const navItems: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: "micro", label: "Micro → Macro", icon: <Layers3 size={15} /> },
  { key: "ats", label: "A / T / S", icon: <Orbit size={15} /> },
  { key: "formula", label: "Fórmulas", icon: <Gauge size={15} /> },
  { key: "material", label: "Material", icon: <Atom size={15} /> },
  { key: "structure", label: "Estructura", icon: <GitBranch size={15} /> },
  { key: "reactivity", label: "Reactividad", icon: <FlaskConical size={15} /> },
  { key: "energy", label: "Energía", icon: <BarChart3 size={15} /> },
  { key: "electric", label: "Electricidad", icon: <Zap size={15} /> },
  { key: "information", label: "Información", icon: <Radio size={15} /> },
  { key: "oris", label: "Oris / Éterium", icon: <Sparkles size={15} /> },
  { key: "runas", label: "Runas", icon: <CircleDot size={15} /> },
  { key: "process", label: "Proceso", icon: <Workflow size={15} /> },
];

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/35">{eyebrow}</p>
      <h1 className="mt-1 text-xl font-black tracking-tight text-primary/90">{title}</h1>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-primary/50">{description}</p>
    </div>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/10 bg-primary/5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-primary/50">
      {children}
    </span>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.025] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{metric.label}</p>
          <p className="mt-1 text-sm font-black tabular-nums text-primary/85">
            {metric.value}{metric.unit ? ` ${metric.unit}` : ""}
          </p>
        </div>
        {metric.min !== undefined && metric.max !== undefined ? <StatusPill>0–1</StatusPill> : null}
      </div>
      {metric.formula ? (
        <div className="mt-3 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">Relación</p>
          <p className="mt-1 text-sm font-black text-primary/75">{metric.formula}</p>
        </div>
      ) : null}
    </div>
  );
}

function FlowNode({ title, subtitle, tone = "default" }: { title: string; subtitle?: string; tone?: "default" | "accent" }) {
  return (
    <div className={`min-w-[112px] rounded-xl border px-3 py-3 ${tone === "accent" ? "border-primary/30 bg-primary/10" : "border-primary/10 bg-primary/[0.025]"}`}>
      <p className="text-xs font-black text-primary/80">{title}</p>
      {subtitle ? <p className="mt-1 text-[10px] leading-4 text-primary/40">{subtitle}</p> : null}
    </div>
  );
}

function Arrow() {
  return <ChevronRight className="shrink-0 text-primary/25" size={18} />;
}

function FakeLineChart({ points }: { points: number[] }) {
  const width = 620;
  const height = 220;
  const pad = 22;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const xStep = (width - pad * 2) / Math.max(points.length - 1, 1);
  const toY = (v: number) => {
    const span = Math.max(max - min, 1e-9);
    return height - pad - ((v - min) / span) * (height - pad * 2);
  };
  const polyline = points.map((v, i) => `${pad + xStep * i},${toY(v)}`).join(" ");

  return (
    <div className="overflow-hidden rounded-xl border border-primary/10 bg-primary/[0.02] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Gráfico de evolución temporal de ejemplo">
        {[0, 1, 2, 3, 4].map((step) => {
          const y = pad + ((height - pad * 2) / 4) * step;
          return <line key={step} x1={pad} x2={width - pad} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" />;
        })}
        <polyline points={polyline} fill="none" stroke="currentColor" strokeOpacity="0.75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) => (
          <circle key={`${v}-${i}`} cx={pad + xStep * i} cy={toY(v)} r="4" fill="currentColor" fillOpacity="0.75" />
        ))}
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="currentColor" strokeOpacity="0.12" />
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="currentColor" strokeOpacity="0.12" />
      </svg>
      <div className="flex justify-between px-1 text-[10px] font-bold text-primary/35">
        <span>t0</span><span>t1</span><span>t2</span><span>t3</span><span>t4</span>
      </div>
    </div>
  );
}

function MiniBarChart({ values }: { values: { label: string; value: number }[] }) {
  return (
    <div className="space-y-3">
      {values.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/45">
            <span>{item.label}</span><span>{item.value.toFixed(2)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-primary/8">
            <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.max(0, Math.min(1, item.value)) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function VisualizadorPage() {
  const [active, setActive] = useState<SectionKey>("micro");
  const [mass, setMass] = useState(12);
  const [volume, setVolume] = useState(0.004);
  const [rigidez, setRigidez] = useState(0.72);
  const [flexibilidad, setFlexibilidad] = useState(0.38);

  const density = useMemo(() => (volume > 0 ? mass / volume : 0), [mass, volume]);

  return (
    <main className="min-h-screen bg-[var(--bg-main)] text-primary">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-primary/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/35">Laboratorio visual</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-primary/90">Visualizador</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-primary/50">
              Explora cómo se relacionan partículas, materiales, estructuras, procesos y fenómenos. Esta V1 es una capa visual experimental preparada para recibir datos reales de Supabase.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill>V1 experimental</StatusPill>
            <StatusPill>sin lógica física local</StatusPill>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-primary/10 bg-primary/[0.02] p-2 lg:sticky lg:top-4 lg:self-start">
            <p className="px-3 pb-2 pt-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary/30">Explorar</p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const selected = item.key === active;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActive(item.key)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black transition-colors ${selected ? "bg-primary/10 text-primary/90" : "text-primary/45 hover:bg-primary/5 hover:text-primary/70"}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-3 rounded-xl border border-primary/10 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 shrink-0 text-primary/40" size={14} />
                <p className="text-[10px] leading-4 text-primary/45">
                  Los números de demostración de esta V1 sirven para validar la interacción visual. No son datos canónicos.
                </p>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            {active === "micro" ? (
              <>
                <SectionTitle eyebrow="Genealogía" title="De lo pequeño al fenómeno" description="La vista principal para explicar a un lector cómo una propiedad o fenómeno puede remontarse a las unidades microscópicas del universo." />
                <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-primary/[0.02] p-4">
                  <div className="flex min-w-[820px] items-center gap-2">
                    <FlowNode title="Partículas" subtitle="A / T / S" />
                    <Arrow />
                    <FlowNode title="IUMs" subtitle="configuraciones" />
                    <Arrow />
                    <FlowNode title="Elementos" subtitle="identidad funcional" />
                    <Arrow />
                    <FlowNode title="Compuestos" subtitle="composición" />
                    <Arrow />
                    <FlowNode title="Materiales" subtitle="propiedades" tone="accent" />
                    <Arrow />
                    <FlowNode title="Estructuras" subtitle="arquitectura" />
                    <Arrow />
                    <FlowNode title="Estado" subtitle="dinámica" />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border border-primary/10 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-primary/80">Propiedades derivadas</p>
                        <p className="text-[10px] text-primary/35">Ejemplo visual para explicar un material</p>
                      </div>
                      <StatusPill>ejemplo</StatusPill>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {metricDemo.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-4">
                    <p className="text-xs font-black text-primary/80">Procedencia</p>
                    <div className="mt-4 space-y-2 text-xs">
                      {["Composición microscópica", "Enlaces", "Geometría", "Reglas de propiedad", "Valor calculado"].map((item, index) => (
                        <div key={item} className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/8 text-[10px] font-black text-primary/50">{index + 1}</span>
                          <span className="font-bold text-primary/55">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {active === "ats" ? (
              <>
                <SectionTitle eyebrow="Fundamento" title="Equilibrio A / T / S" description="Una lectura visual de cómo Tesis, Antítesis y Síntesis componen las partículas funcionales propias de Garlia." />
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <div className="mx-auto flex max-w-xs flex-col items-center">
                      <div className="rounded-full border border-primary/15 bg-primary/5 px-8 py-5 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">Partícula</p>
                        <p className="mt-1 text-2xl font-black text-primary/85">Masa</p>
                        <p className="mt-1 text-xs font-bold text-primary/40">TTT</p>
                      </div>
                      <div className="my-3 h-8 border-l border-dashed border-primary/20" />
                      <div className="grid w-full grid-cols-3 gap-2 text-center">
                        {[["Tesis", 3], ["Antítesis", 0], ["Síntesis", 0]].map(([label, value]) => (
                          <div key={String(label)} className="rounded-xl border border-primary/10 bg-primary/[0.025] p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">{label}</p>
                            <p className="mt-1 text-lg font-black text-primary/75">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <p className="text-xs font-black text-primary/80">Comparación</p>
                    <div className="mt-4 space-y-4">
                      <MiniBarChart values={[
                        { label: "Masa", value: 1 },
                        { label: "Cinética", value: 1 },
                        { label: "Potencial", value: 0.67 },
                        { label: "Información", value: 0.67 },
                        { label: "Equilibrio", value: 1 },
                      ]} />
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {active === "formula" ? (
              <>
                <SectionTitle eyebrow="Matemática del mundo" title="Fórmulas que se pueden ver" description="Las relaciones matemáticas importantes deben poder explicarse visualmente, mostrando entradas, operación y resultado." />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <p className="text-xs font-black text-primary/80">Densidad</p>
                    <p className="mt-1 text-[10px] text-primary/35">Ejemplo con valores explorables</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <label className="rounded-xl border border-primary/10 p-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">Masa</span>
                        <div className="mt-2 flex items-center gap-2">
                          <input aria-label="Masa" type="number" value={mass} onChange={(e) => setMass(Number(e.target.value))} className="w-full rounded-lg border border-primary/10 bg-transparent px-3 py-2 text-sm font-black text-primary/80 outline-none" />
                          <span className="text-xs font-bold text-primary/35">kg</span>
                        </div>
                      </label>
                      <label className="rounded-xl border border-primary/10 p-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">Volumen</span>
                        <div className="mt-2 flex items-center gap-2">
                          <input aria-label="Volumen" type="number" step="0.001" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full rounded-lg border border-primary/10 bg-transparent px-3 py-2 text-sm font-black text-primary/80 outline-none" />
                          <span className="text-xs font-bold text-primary/35">m³</span>
                        </div>
                      </label>
                    </div>
                    <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/5 p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/35">Resultado de la demostración</p>
                      <p className="mt-2 text-3xl font-black tabular-nums text-primary/85">{Number.isFinite(density) ? density.toLocaleString("es-CL") : "—"}</p>
                      <p className="mt-1 text-xs font-bold text-primary/40">kg/m³</p>
                      <p className="mt-3 text-lg font-black text-primary/75">ρ = m / V</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <p className="text-xs font-black text-primary/80">Dependencias</p>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <FlowNode title="Masa" subtitle={String(mass)} />
                      <Arrow />
                      <FlowNode title="Densidad" subtitle={density.toFixed(2)} tone="accent" />
                      <Arrow />
                      <FlowNode title="Volumen" subtitle={String(volume)} />
                    </div>
                    <p className="mt-5 text-xs leading-5 text-primary/45">En la versión conectada a Supabase, el frontend debe mostrar la fórmula y dependencias que entregue el backend, nunca inventarlas.</p>
                  </div>
                </div>
              </>
            ) : null}

            {active === "material" ? (
              <>
                <SectionTitle eyebrow="Materia" title="Perfil de un material" description="Comparación visual de propiedades intrínsecas y reactivas, con sus fuentes y procedencia." />
                <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <p className="text-xs font-black text-primary/80">Perfil mecánico</p>
                    <div className="mt-5">
                      <MiniBarChart values={metricDemo.filter((m) => ["rigidez", "flexibilidad", "estabilidad", "resistencia"].includes(m.key)).map((m) => ({ label: m.label, value: m.value }))} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <p className="text-xs font-black text-primary/80">Tipo de dato</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <StatusPill>intrínseca</StatusPill>
                      <StatusPill>derivada</StatusPill>
                      <StatusPill>reactiva</StatusPill>
                      <StatusPill>dinámica</StatusPill>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-primary/45">El visualizador debe separar visualmente propiedades permanentes, emergentes y estados dinámicos.</p>
                  </div>
                </div>
              </>
            ) : null}

            {active === "structure" ? (
              <>
                <SectionTitle eyebrow="Arquitectura" title="Cómo una estructura cambia el comportamiento" description="Aquí el lector ve que las propiedades estructurales emergen de componentes, interfaces y geometría, no solo del material." />
                <div className="overflow-x-auto rounded-2xl border border-primary/10 p-5">
                  <div className="flex min-w-[680px] items-center gap-2">
                    <FlowNode title="Material A" subtitle="rigidez .72" />
                    <Arrow />
                    <FlowNode title="Material B" subtitle="flexibilidad .38" />
                    <Arrow />
                    <FlowNode title="Interfaces" subtitle="2 uniones" />
                    <Arrow />
                    <FlowNode title="Geometría" subtitle="arquitectura" />
                    <Arrow />
                    <FlowNode title="Diente" subtitle="respuesta" tone="accent" />
                  </div>
                </div>
              </>
            ) : null}

            {active === "reactivity" ? (
              <>
                <SectionTitle eyebrow="Reactividad" title="De composición a procesos posibles" description="El objetivo es hacer visible por qué un material es capaz de reaccionar, sin convertir cada reacción en una regla aislada." />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <p className="text-xs font-black text-primary/80">Perfil reactivo</p>
                    <div className="mt-5"><MiniBarChart values={[{ label: "Afinidad reactiva", value: 0.78 }, { label: "Dinamismo", value: 0.61 }, { label: "Catálisis", value: 0.24 }, { label: "Transformación", value: 0.69 }]} /></div>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <p className="text-xs font-black text-primary/80">Ruta causal</p>
                    <div className="mt-5 flex flex-wrap items-center gap-2"><FlowNode title="Composición" /><Arrow /><FlowNode title="Perfil reactivo" /><Arrow /><FlowNode title="Proceso" tone="accent" /></div>
                  </div>
                </div>
              </>
            ) : null}

            {active === "energy" ? (
              <>
                <SectionTitle eyebrow="Dinámica" title="Energía a través del tiempo" description="Una gráfica temporal debe enseñar cómo cambia una magnitud durante el Sandbox o un proceso." />
                <FakeLineChart points={[10, 12, 15, 11, 9, 13, 16]} />
                <div className="mt-4 rounded-2xl border border-primary/10 p-4 text-xs leading-5 text-primary/45">La gráfica V1 usa datos de demostración. En el flujo real, los puntos deben venir de snapshots/estado del Sandbox o de una salida formal del motor.</div>
              </>
            ) : null}

            {active === "electric" ? (
              <>
                <SectionTitle eyebrow="Carga" title="Flujo eléctrico" description="La visualización separa carga, conductividad y transferencia para que el lector entienda el fenómeno paso a paso." />
                <div className="grid gap-4 md:grid-cols-3">
                  {["Carga origen", "Conductividad", "Carga destino"].map((title, index) => <FlowNode key={title} title={title} subtitle={index === 0 ? "10 q" : index === 1 ? "0.80" : "2 q"} tone={index === 1 ? "accent" : "default"} />)}
                </div>
                <div className="mt-4 flex items-center justify-center text-sm font-black text-primary/50"><span>10 q</span><ChevronRight size={20} /><span>flujo</span><ChevronRight size={20} /><span>2 q</span></div>
              </>
            ) : null}

            {active === "information" ? (
              <>
                <SectionTitle eyebrow="Información" title="Señal, intensidad y fidelidad" description="Una señal puede llegar atenuada sin perder por completo su contenido. La interfaz debe hacer ambas magnitudes visibles." />
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-2xl border border-primary/10 p-5">
                  <FlowNode title="Fuente" subtitle="mensaje + intensidad 10" />
                  <Arrow />
                  <FlowNode title="Propagación" subtitle="distancia 3" />
                  <Arrow />
                  <FlowNode title="Receptor" subtitle="intensidad 7 · fidelidad .7" tone="accent" />
                </div>
              </>
            ) : null}

            {active === "oris" ? (
              <>
                <SectionTitle eyebrow="Capa funcional" title="Oris / Éterium" description="Un Oris se presenta como una configuración funcional derivada de IUMs y partículas, y su relación con Éterium como un acoplamiento, no como un poder aislado." />
                <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <div className="overflow-x-auto rounded-2xl border border-primary/10 p-5">
                    <div className="flex min-w-[620px] items-center gap-2"><FlowNode title="Partículas" subtitle="A/T/S" /><Arrow /><FlowNode title="IUMs" /><Arrow /><FlowNode title="Oris" subtitle="perfil funcional" tone="accent" /><Arrow /><FlowNode title="Acoplamiento" subtitle="0.82" /></div>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-5"><p className="text-xs font-black text-primary/80">Perfil</p><div className="mt-5"><MiniBarChart values={[{ label: "Coherencia", value: 0.8 }, { label: "Dinámica", value: 0.66 }, { label: "Información", value: 0.52 }, { label: "Transformación", value: 0.71 }]} /></div></div>
                </div>
              </>
            ) : null}

            {active === "runas" ? (
              <>
                <SectionTitle eyebrow="Semántica" title="Runas como operadores" description="El visualizador debe mostrar patrón gráfico, semántica, operación y mecanismo sin asumir que una Runa es un hechizo fijo." />
                <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.02] p-5">
                    <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
                      <div className="absolute h-28 w-28 rotate-45 rounded-2xl border border-primary/30" />
                      <div className="h-16 w-16 rounded-full border-2 border-primary/30" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/10 p-5">
                    <div className="flex items-center justify-between"><p className="text-xs font-black text-primary/80">Runa</p><StatusPill>sin semántica</StatusPill></div>
                    <div className="mt-5 space-y-3 text-xs text-primary/50"><div className="rounded-xl border border-primary/10 p-3">Patrón gráfico · disponible</div><div className="rounded-xl border border-primary/10 p-3">Operación · pendiente</div><div className="rounded-xl border border-primary/10 p-3">Mecanismo · pendiente</div><div className="rounded-xl border border-primary/10 p-3">Condiciones · pendiente</div></div>
                  </div>
                </div>
              </>
            ) : null}

            {active === "process" ? (
              <>
                <SectionTitle eyebrow="Causalidad" title="Proceso → mecanismo → efecto" description="Esta es la vista para explicar un fenómeno completo de principio a fin." />
                <div className="overflow-x-auto rounded-2xl border border-primary/10 p-5"><div className="flex min-w-[760px] items-center gap-2"><FlowNode title="Evento" /><Arrow /><FlowNode title="Interacción" /><Arrow /><FlowNode title="Proceso" /><Arrow /><FlowNode title="Mecanismo" subtitle="primitivos" tone="accent" /><Arrow /><FlowNode title="Efecto" /><Arrow /><FlowNode title="Estado nuevo" /></div></div>
                <div className="mt-4 rounded-2xl border border-primary/10 p-4 text-xs leading-5 text-primary/45">Esta cadena debe consumir la traza real de Supabase. El frontend no debe reconstruir causalidad por heurísticas.</div>
              </>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-primary/10 bg-primary/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black text-primary/75">Base preparada para conectar datos reales</p>
                <p className="mt-1 text-[10px] text-primary/40">Los componentes visuales de esta V1 son deliberadamente genéricos para que el equipo pueda sustituir fixtures por vistas/hook reales sin rehacer la UI.</p>
              </div>
              <div className="flex items-center gap-2"><StatusPill>Supabase → visualizador</StatusPill><StatusPill>sin reglas duplicadas</StatusPill></div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default VisualizadorPage;

"use client";

/**
 * GridPropiedadesCalculadas.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Grid de solo-lectura para el jsonb `propiedades_calculadas` que comparten
 * Estructura y Organismo (mismo patrón calculado que viene de Elemento/
 * Compuesto: masa, rigidez, estabilidad, etc.). Extraído a compartido para
 * no duplicar la misma tabla de etiquetas en cada catálogo — cualquier otra
 * entidad que sume propiedades_calculadas más adelante puede reusar esto.
 *
 * Omite claves de metadata (fuente/método/versión/ponderación) — esas
 * describen CÓMO se calculó, no son una métrica en sí, y se muestran aparte
 * si el caller las necesita.
 */

import React from "react";

import { InfoFormulasPopover } from "@/domains/garlia/elementos/InfoFormulasPopover";
import type { PropiedadCalculada } from "@/domains/garlia/elementos/types";

/** Etiquetas legibles para las claves numéricas más comunes. Claves no
 *  listadas acá se muestran tal cual (snake_case), no rompe nada nuevo. */
const ETIQUETAS_METRICA: Record<string, string> = {
  masa: "Masa",
  carga: "Carga",
  rigidez: "Rigidez",
  cohesion: "Cohesión",
  estabilidad: "Estabilidad",
  flexibilidad: "Flexibilidad",
  compatibilidad: "Compatibilidad",
  energia_enlace: "Energía de enlace",
  subestructuras: "Subestructuras",
  componentes: "Componentes",
  soporte_estructural: "Soporte estructural",
  componentes_directos: "Componentes directos",
  interfaces_con_datos: "Interfaces con datos",
  resistencia_estructural: "Resistencia estructural",
  flexibilidad_estructural: "Flexibilidad estructural",
};

/** Claves de metadata (no métricas) que no se muestran como tarjeta. */
const CLAVES_METADATA = new Set(["fuente", "metodo", "version", "ponderacion"]);

export function GridPropiedadesCalculadas({
  propiedades,
}: {
  propiedades: Record<string, unknown> | null;
}) {
  if (!propiedades) {
    return <p className="text-micro text-primary/25 italic py-1">Sin propiedades calculadas todavía.</p>;
  }

  const entradas = Object.entries(propiedades).filter(
    ([clave, valor]) => !CLAVES_METADATA.has(clave) && valor !== null && valor !== undefined,
  );

  if (entradas.length === 0) {
    return <p className="text-micro text-primary/25 italic py-1">Sin propiedades calculadas todavía.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {entradas.map(([clave, valor]) => (
        <div
          key={clave}
          className="flex flex-col gap-0.5 bg-primary/5 rounded-md px-2 py-1.5 border border-primary/10"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/35 truncate">
            {ETIQUETAS_METRICA[clave] ?? clave}
          </span>
          <span className="text-micro font-black text-primary/80">
            {typeof valor === "number" ? Number(valor.toFixed(4)).toString() : String(valor)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Fuente del cálculo (ej. "organos", "sistemas", "compuestos"), si está
 *  presente en el jsonb — se muestra como nota chica aparte del grid. */
export function fuenteDePropiedadesCalculadas(
  propiedades: Record<string, unknown> | null,
): string | null {
  const fuente = propiedades?.["fuente"];
  return typeof fuente === "string" ? fuente : null;
}

/**
 * Traduce el jsonb `propiedades_calculadas` (Materiales, Estructuras — y
 * cualquier otra entidad que use el mismo modelo canónico v2xx) a
 * PropiedadCalculada[], con las mismas descripciones/fórmulas ya auditadas
 * para Elemento/Compuesto (ver propiedadesCalculadasDeElemento /
 * propiedadesCalculadasDeCompuesto en elementos/types.ts). Las 9 físicas
 * base + compatibilidad/energía de enlace comparten fórmula y significado
 * en todos los niveles ontológicos: son índices [0,1] emergentes de
 * composición y arquitectura, no promedios inventados por nivel — ver
 * documentacion_sistema "Jerarquía de propiedades" (orden 500) y "Regla de
 * separación" (orden 103).
 *
 * No incluye masa/volumen/densidad/carga como magnitudes con fórmula
 * propia por nivel: cada nivel las deriva distinto (composición directa en
 * Elemento/Compuesto, fuente_fisica seleccionada en Material — ver
 * "Fuente por propiedad en Material v187", orden 421), así que se muestran
 * con una descripción genérica de magnitud, no una fórmula fija que
 * induciría a pensar que es la misma ecuación en todos los niveles.
 */
export function propiedadesCalculadasGenerico(
  propiedades: Record<string, unknown> | null | undefined,
): PropiedadCalculada[] {
  if (!propiedades) return [];

  const num = (clave: string): number | null => {
    const v = propiedades[clave];
    return typeof v === "number" ? v : null;
  };
  const fmt = (v: number | null, digitos = 3) => (v === null ? null : v.toFixed(digitos));
  const prop = (v: number | null) => (v === null ? undefined : Math.max(0, Math.min(1, v)));

  const MAGNITUDES: { clave: string; label: string; descripcion: string; digitos?: number }[] = [
    { clave: "masa", label: "Masa", descripcion: "Cantidad total de masa contenida; magnitud acumulativa, no un índice 0–1. La fuente exacta (composición directa o estructura) depende del nivel — ver fuente_fisica.", digitos: 2 },
    { clave: "carga", label: "Carga", descripcion: "Carga neta acumulada de la composición.", digitos: 2 },
    { clave: "volumen", label: "Volumen", descripcion: "Espacio ocupado según composición y organización espacial; no es un índice 0–1.", digitos: 2 },
    { clave: "densidad", label: "Densidad", descripcion: "Masa por unidad de volumen (masa / volumen); no es un índice 0–1.", digitos: 4 },
    { clave: "energia_enlace", label: "Energía de enlace", descripcion: "Energía acumulada en los enlaces internos.", digitos: 4 },
  ];

  const INDICES: { clave: string; label: string; descripcion: string; formula: string }[] = [
    { clave: "estabilidad", label: "Estabilidad", descripcion: "Tendencia a conservar su estado frente a ruptura o transformación.", formula: "S = 0.50·compatibilidad + 0.40·calidad de enlaces − 0.10·tensión − 0.05·complejidad" },
    { clave: "rigidez", label: "Rigidez", descripcion: "Resistencia a cambiar de forma cuando actúa una fuerza.", formula: "Propiedad derivada de la composición y arquitectura de enlaces del nivel inferior." },
    { clave: "flexibilidad", label: "Flexibilidad", descripcion: "Capacidad de cambiar de forma conservando su integridad.", formula: "Propiedad derivada de la composición y arquitectura de enlaces del nivel inferior." },
    { clave: "dureza", label: "Dureza", descripcion: "Resistencia a penetración, rayado o deformación local.", formula: "Propiedad derivada de la composición del nivel inferior." },
    { clave: "conductividad", label: "Conductividad", descripcion: "Facilidad para transmitir una influencia a través de su estructura.", formula: "Propiedad derivada de la capacidad de transmisión de sus componentes." },
    { clave: "transparencia", label: "Transparencia", descripcion: "Facilidad para dejar pasar una influencia sin retenerla.", formula: "Propiedad derivada de la capacidad de paso de sus componentes." },
    { clave: "interaccion", label: "Interacción", descripcion: "Facilidad para acoplarse o responder a su entorno.", formula: "Propiedad derivada de la capacidad de acoplamiento de sus componentes." },
    { clave: "compatibilidad", label: "Compatibilidad", descripcion: "Qué tan compatibles son entre sí los componentes/enlaces usados.", formula: "Función de carga, catálisis, transición, interacción y transformación entre componentes." },
  ];

  const salida: PropiedadCalculada[] = [];

  for (const m of MAGNITUDES) {
    const v = num(m.clave);
    if (v === null) continue;
    salida.push({ clave: m.clave, label: m.label, valor: fmt(v, m.digitos ?? 3), descripcion: m.descripcion });
  }

  for (const i of INDICES) {
    const v = num(i.clave);
    if (v === null) continue;
    salida.push({ clave: i.clave, label: i.label, valor: fmt(v), proporcion: prop(v), descripcion: i.descripcion, formula: i.formula });
  }

  return salida;
}

/**
 * Tarjeta de solo lectura reutilizable para "Propiedades físicas": título +
 * InfoFormulasPopover + grid de tarjetas con barra de proporción cuando
 * aplica. Es el único lugar donde vive este diseño — Elemento, Compuesto,
 * Material y Estructura lo comparten pasando su propia lista ya calculada
 * (cada nivel tiene su función propia: propiedadesCalculadasDeElemento,
 * propiedadesCalculadasDeCompuesto, propiedadesCalculadasGenerico), así que
 * un cambio visual acá se refleja en los 4 sin duplicar JSX/clases.
 */
export function TarjetaPropiedadesFisicas({
  propiedades,
  columnas = 3,
}: {
  propiedades: PropiedadCalculada[];
  /** Cuántas columnas usar en el grid — Compuesto tiene más propiedades
   *  visibles (5 cols) que Elemento/Material/Estructura (2–3). */
  columnas?: 2 | 3 | 4 | 5;
}) {
  const conValor = propiedades.filter((p) => p.valor !== null);
  if (conValor.length === 0) return null;

  const gridCols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[columnas];

  return (
    <div className="flex flex-col gap-1.5 min-w-0 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Propiedades físicas
        </span>
        <InfoFormulasPopover propiedades={conValor} />
      </div>
      <div className={`grid ${gridCols} gap-1.5 min-w-0`}>
        {conValor.map((p) => (
          <div
            key={p.clave}
            title={p.descripcion}
            className="flex flex-col gap-1 min-w-0 rounded-md border border-primary/10 px-2 py-1.5"
          >
            <div className="flex items-center justify-between gap-1 min-w-0">
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
 * Wrapper de PropiedadesFisicasGenerico para Material y Estructura, que
 * guardan sus propiedades en el jsonb propiedades_calculadas en vez de
 * columnas propias — traduce el jsonb a PropiedadCalculada[] y delega el
 * render a TarjetaPropiedadesFisicas.
 */
export function PropiedadesFisicasGenerico({
  propiedades,
  columnas = 3,
}: {
  propiedades: Record<string, unknown> | null | undefined;
  columnas?: 2 | 3 | 4 | 5;
}) {
  const lista = propiedadesCalculadasGenerico(propiedades);
  return <TarjetaPropiedadesFisicas propiedades={lista} columnas={columnas} />;
}

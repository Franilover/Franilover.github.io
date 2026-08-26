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

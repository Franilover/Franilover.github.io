"use client";

/**
 * LogicaSistemaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sub-tab "Lógica" del toggle de Magia (junto a Runas/Química/Física/
 * Biología, ver RunasPage.tsx → SECCIONES_MAGIA). Es la versión "explicación
 * humana" del sistema entero: un mapa de capas — Fundamento → Partículas →
 * Elementos → Compuestos → Estructuras → Células → Tejidos → Propiedades
 * emergentes → Procesos y dinámica → ... — con, dentro de cada una, los
 * conceptos reales que ya están documentados en Supabase
 * (documentacion_sistema: concepto + explicación + fórmula + ejemplo).
 *
 * A propósito NO es un diagrama aparte con estados ✅/🟡/⚪ inventados: el
 * único indicador que se muestra es el conteo real de conceptos por capa
 * (ver useDocumentacionSistema), así que nunca puede quedar desactualizado
 * respecto a lo que de verdad está escrito — si se agrega o edita un
 * concepto en Supabase, esta vista lo refleja solo con recargar.
 *
 * Diseño: cada capa es una "caja" con su propio color de acento (agrupadas
 * por familia — micro/composición/organización/dinámica/auditoría, ver
 * COLOR_POR_FAMILIA — asignado por coincidencia de texto en el nombre de
 * la capa, así que una capa nueva en Supabase cae en un color razonable
 * sin tocar código) y conectadas por una línea vertical con flecha, mismo
 * espíritu que el diagrama de capas original (Fundamentos → Propiedades
 * emergentes → Organización → Comportamiento) pero con las capas y
 * conteos reales de hoy en vez de un mapa fijo desactualizado.
 *
 * Solo lectura: esta pantalla no escribe en documentacion_sistema, es un
 * visor. Editar los conceptos se sigue haciendo desde Supabase directamente
 * (mismo criterio que compuesto_estabilidad/elemento_sitios_enlace en
 * ElementoEditor/CompuestosPage: derivado, no editable desde el frontend).
 */

import { ChevronDown, ChevronRight, Layers, Loader2 } from "lucide-react";
import React, { useState } from "react";

import {
  useDocumentacionSistema,
  type CapaDocumentacion,
  type ConceptoDocumentacion,
} from "./useDocumentacionSistema";

/**
 * Color de acento por familia de capas, para que el mapa se lea de un
 * vistazo (mismo principio que el diagrama enviado: Fundamentos/
 * Propiedades/Organización/Comportamiento en bloques visualmente
 * distintos). Se resuelve por coincidencia de texto sobre el nombre real
 * de la capa (ver colorDeCapa) — no una lista fija de claves — para que
 * una capa nueva agregada en Supabase (ej. "Ecología") caiga en un color
 * razonable sin tocar este archivo.
 */
const FAMILIAS: { test: RegExp; color: string }[] = [
  { test: /fundamento|base|principio/i, color: "#64748b" }, // gris pizarra — cimientos
  { test: /partícula|elemento/i, color: "#3b82f6" }, // azul — micro/física
  { test: /compuesto/i, color: "#22c55e" }, // verde — composición química
  { test: /estructura|célula|tejido|órgano|sistema|organismo|jerarquía/i, color: "#a855f7" }, // violeta — organización biológica
  { test: /propiedad/i, color: "#f59e0b" }, // ámbar — propiedades emergentes
  { test: /proceso|dinámica|motor/i, color: "#ef4444" }, // rojo — dinámica/tiempo
  { test: /auditoría/i, color: "#14b8a6" }, // teal — verificación
];
const COLOR_DEFECTO = "#8b8b99";

function colorDeCapa(nombre: string): string {
  return FAMILIAS.find((f) => f.test.test(nombre))?.color ?? COLOR_DEFECTO;
}

export function LogicaSistemaPage() {
  const { capas, total, loading } = useDocumentacionSistema();
  const [capaAbierta, setCapaAbierta] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-primary/30">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (capas.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-micro text-primary/30">
        Todavía no hay conceptos documentados.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 rounded-lg border border-primary/10 px-3 py-2.5">
        <Layers size={15} className="text-primary/40 shrink-0" />
        <p className="text-sm text-primary/60">
          Cómo está armado el sistema, capa por capa — de lo más chico (partículas) a lo más
          grande (organismos).{" "}
          <span className="font-bold text-primary/80">{total} conceptos</span> documentados en
          total.
        </p>
      </div>

      {/* Mapa de capas: una caja por capa, en el orden real en que aparecen
          en documentacion_sistema (ver orden numérico de cada concepto),
          conectadas por una línea vertical — mismo espíritu que el
          diagrama de bloques apilados (Fundamentos → Propiedades →
          Organización → Comportamiento). */}
      <div className="flex flex-col">
        {capas.map((c, i) => (
          <CajaCapa
            key={c.capa}
            capa={c}
            esUltima={i === capas.length - 1}
            abierta={capaAbierta === c.capa}
            onToggle={() => setCapaAbierta((prev) => (prev === c.capa ? null : c.capa))}
          />
        ))}
      </div>
    </div>
  );
}

function CajaCapa({
  capa,
  esUltima,
  abierta,
  onToggle,
}: {
  capa: CapaDocumentacion;
  esUltima: boolean;
  abierta: boolean;
  onToggle: () => void;
}) {
  const color = colorDeCapa(capa.capa);

  return (
    <div className="flex flex-col items-stretch">
      <div
        className="rounded-xl border-2 overflow-hidden transition-shadow"
        style={{
          borderColor: `color-mix(in srgb, ${color} ${abierta ? 55 : 30}%, transparent)`,
          background: `color-mix(in srgb, ${color} ${abierta ? 7 : 4}%, var(--bg-main))`,
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left cursor-pointer"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: color }}
          />
          <span className="text-[15px] font-black tracking-tight text-primary/85 truncate">
            {capa.capa}
          </span>
          <span
            className="text-micro font-black uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
            style={{
              color: `color-mix(in srgb, ${color} 70%, black)`,
              background: `color-mix(in srgb, ${color} 16%, transparent)`,
            }}
          >
            {capa.conceptos.length} concepto{capa.conceptos.length === 1 ? "" : "s"}
          </span>
          <span className="flex-1" />
          {abierta ? (
            <ChevronDown size={15} className="text-primary/40 shrink-0" />
          ) : (
            <ChevronRight size={15} className="text-primary/40 shrink-0" />
          )}
        </button>

        {abierta && (
          <div
            className="flex flex-col gap-2 px-3.5 pb-3.5 pt-1 border-t"
            style={{ borderColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
          >
            {capa.conceptos.map((concepto) => (
              <TarjetaConcepto key={concepto.id} concepto={concepto} color={color} />
            ))}
          </div>
        )}
      </div>

      {/* Conector vertical hacia la siguiente capa — línea + flechita,
          mismo lenguaje visual que el diagrama de bloques apilados. */}
      {!esUltima && (
        <div className="flex flex-col items-center h-5">
          <div className="w-px flex-1" style={{ background: "color-mix(in srgb, var(--primary) 18%, transparent)" }} />
          <svg width="10" height="6" viewBox="0 0 10 6" className="text-primary/25 -mt-px">
            <path d="M0 0 L5 6 L10 0 Z" fill="currentColor" />
          </svg>
        </div>
      )}
    </div>
  );
}

function TarjetaConcepto({
  concepto,
  color,
}: {
  concepto: ConceptoDocumentacion;
  color: string;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border-l-4 bg-primary/[0.03] px-3 py-2.5"
      style={{ borderLeftColor: color }}
    >
      <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/60">
        {concepto.concepto}
      </span>
      <p className="text-sm text-primary/75 leading-snug">{concepto.explicacion}</p>

      {concepto.formula && (
        <div className="rounded bg-primary/5 px-2 py-1 font-mono text-micro text-primary/60 w-fit">
          {concepto.formula}
        </div>
      )}

      {concepto.ejemplo && (
        <p className="text-micro text-primary/45 italic">Ejemplo: {concepto.ejemplo}</p>
      )}

      {concepto.dependencias && (
        <p className="text-micro text-primary/35">Depende de: {concepto.dependencias}</p>
      )}
    </div>
  );
}

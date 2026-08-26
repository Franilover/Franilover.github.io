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
 * Diseño: cada capa es un bloque siempre expandido (sin acordeón/dropdown)
 * con su propio color de acento — tonos apagados/desaturados a propósito,
 * para que se lea como referencia técnica y no como un dashboard de
 * semáforos — resuelto por coincidencia de texto sobre el nombre de la
 * capa (ver colorDeCapa), así que una capa nueva en Supabase cae en un
 * color razonable sin tocar código. Los conceptos de cada capa se
 * muestran en grid de hasta 2 columnas (no una lista vertical larga) para
 * aprovechar mejor el ancho disponible en capas con muchos conceptos
 * (ej. Estructuras con 38, Células con 34).
 *
 * Solo lectura: esta pantalla no escribe en documentacion_sistema, es un
 * visor. Editar los conceptos se sigue haciendo desde Supabase directamente
 * (mismo criterio que compuesto_estabilidad/elemento_sitios_enlace en
 * ElementoEditor/CompuestosPage: derivado, no editable desde el frontend).
 */

import { BookOpenText, Layers, Loader2 } from "lucide-react";
import React from "react";

import { useEstadoProyecto } from "@/domains/garlia/auditoria/useEstadoProyecto";
import { Text } from "@/ui/Tipografia";

import {
  useDocumentacionSistema,
  type CapaDocumentacion,
  type ConceptoDocumentacion,
} from "./useDocumentacionSistema";

/**
 * Color de acento por familia de capas — deliberadamente apagado/desaturado
 * (tonos "dusty", no colores de marca vivos) para que se lea como
 * referencia técnica y no como un dashboard de semáforos. Se resuelve por
 * coincidencia de texto sobre el nombre real de la capa (ver colorDeCapa)
 * — no una lista fija de claves — para que una capa nueva agregada en
 * Supabase (ej. "Ecología") caiga en un color razonable sin tocar este
 * archivo.
 */
const FAMILIAS: { test: RegExp; color: string }[] = [
  { test: /fundamento|base|principio/i, color: "#78716c" }, // gris piedra — cimientos
  { test: /partícula|elemento/i, color: "#5b7a99" }, // azul apagado — micro/física
  { test: /compuesto/i, color: "#5e8c6a" }, // verde apagado — composición química
  { test: /estructura|célula|tejido|órgano|sistema|organismo|jerarquía/i, color: "#8a6d9e" }, // violeta apagado — organización biológica
  { test: /propiedad/i, color: "#b08a4e" }, // ámbar apagado — propiedades emergentes
  { test: /proceso|dinámica|motor/i, color: "#b06a5e" }, // terracota — dinámica/tiempo
  { test: /auditoría/i, color: "#4d8f88" }, // teal apagado — verificación
];
const COLOR_DEFECTO = "#8b8b99";

function colorDeCapa(nombre: string): string {
  return FAMILIAS.find((f) => f.test.test(nombre))?.color ?? COLOR_DEFECTO;
}

export function LogicaSistemaPage() {
  const { capas, total, loading } = useDocumentacionSistema();

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

  // Dos columnas internas, lado a lado (misma idea que el toggle
  // Química/Física/Biología, pero acá conviven a la vez porque son la
  // misma lógica vista en dos niveles):
  //   izquierda → mapa técnico de capas ya existente (documentacion_sistema
  //     completo, capa por capa, con fórmulas/dependencias). Siempre
  //     expandido — sin acordeón — porque es la referencia de trabajo del
  //     día a día, no algo que se navega una vez y se cierra.
  //   derecha   → "Manual humano": la capa documentacion_sistema.capa=
  //     "Manual humano" (leyes sencillas) + lo nuevo de estado_proyecto
  //     (explicaciones humanas del registro maestro), en el mismo espíritu
  //     de lectura pero en lenguaje llano, sin fórmulas.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Columna izquierda: mapa de capas técnico, siempre abierto. */}
        <div className="flex flex-col gap-3">
          {capas.map((c) => (
            <BloqueCapa key={c.capa} capa={c} />
          ))}
        </div>

        {/* Columna derecha: manual humano (nuevo). */}
        <ManualHumanoColumna capas={capas} />
      </div>
    </div>
  );
}

/**
 * Columna derecha "Manual humano": leyes sencillas (documentacion_sistema
 * con capa="Manual humano", ya cargadas en `capas` — no se vuelve a pedir
 * a Supabase) + las explicaciones humanas que se están agregando en
 * estado_proyecto (resumen, siguiente paso, principios). Solo lectura,
 * igual que el resto de esta pantalla — no escribe en ninguna tabla.
 */
function ManualHumanoColumna({ capas }: { capas: CapaDocumentacion[] }) {
  const capaManual = capas.find((c) => c.capa.toLowerCase() === "manual humano") ?? null;
  const { maestro, loading: loadingMaestro } = useEstadoProyecto();
  const colorManual = "#0ea5e9"; // celeste — distinto de las familias técnicas, para que se lea como "la otra columna"

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-sky-500/25 bg-sky-500/[0.03] p-3.5">
      <div className="flex items-center gap-2">
        <BookOpenText size={15} className="text-sky-600/70 shrink-0" />
        <span className="text-[15px] font-black tracking-tight text-primary/85">
          Manual humano
        </span>
        {capaManual && (
          <span className="text-micro font-black uppercase tracking-wide px-2 py-0.5 rounded-full text-sky-700 bg-sky-500/15">
            {capaManual.conceptos.length} ley{capaManual.conceptos.length === 1 ? "" : "es"}
          </span>
        )}
      </div>
      <p className="text-sm text-primary/55 leading-snug">
        Las mismas capas de la izquierda, explicadas simple: leyes sencillas y el avance real del
        proyecto contado en palabras.
      </p>

      {/* Leyes sencillas (documentacion_sistema, capa="Manual humano") */}
      <div className="flex flex-col gap-2">
        {!capaManual || capaManual.conceptos.length === 0 ? (
          <p className="text-micro text-primary/30 italic px-1">
            Todavía no hay leyes sencillas documentadas.
          </p>
        ) : (
          capaManual.conceptos.map((concepto) => (
            <TarjetaConcepto key={concepto.id} concepto={concepto} color={colorManual} />
          ))
        )}
      </div>

      {/* Explicaciones humanas nuevas de estado_proyecto */}
      <div className="mt-2 pt-3 border-t border-sky-500/15 flex flex-col gap-2.5">
        <Text variant="lbl" className="text-sky-700/70">
          Estado del proyecto, en palabras
        </Text>

        {loadingMaestro ? (
          <div className="flex items-center gap-2 text-primary/30 py-2">
            <Loader2 className="animate-spin" size={14} />
            <span className="text-micro">Cargando estado_proyecto...</span>
          </div>
        ) : !maestro ? (
          <p className="text-micro text-primary/30 italic">Sin registro estado_proyecto.</p>
        ) : (
          <>
            <div>
              <Text variant="lbl">Resumen</Text>
              <p className="text-sm text-primary/75 leading-relaxed mt-1">{maestro.resumen}</p>
            </div>
            <div>
              <Text variant="lbl">Siguiente paso</Text>
              <p className="text-sm text-primary/75 leading-relaxed mt-1">
                {maestro.siguiente_paso}
              </p>
            </div>
            {maestro.principios.length > 0 && (
              <div>
                <Text variant="lbl">Principios rectores</Text>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {maestro.principios.map((p, i) => (
                    <div
                      key={i}
                      className="text-micro text-primary/55 italic pl-2.5"
                      style={{ borderLeft: "2px solid color-mix(in srgb, #0ea5e9 25%, transparent)" }}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BloqueCapa({ capa }: { capa: CapaDocumentacion }) {
  const color = colorDeCapa(capa.capa);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
        background: `color-mix(in srgb, ${color} 3%, var(--bg-main))`,
      }}
    >
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5 border-b"
        style={{ borderColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-sm font-bold tracking-tight text-primary/75 truncate">
          {capa.capa}
        </span>
        <span className="flex-1" />
        <span className="text-micro font-semibold text-primary/35 shrink-0">
          {capa.conceptos.length} concepto{capa.conceptos.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Grid de tarjetas en vez de lista vertical: aprovecha mejor el
          ancho de la columna cuando hay varios conceptos cortos por capa
          (ej. Estructuras con 38, Células con 34). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5">
        {capa.conceptos.map((concepto) => (
          <TarjetaConcepto key={concepto.id} concepto={concepto} color={color} />
        ))}
      </div>
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
      className="flex flex-col gap-1 rounded-lg border-l-[3px] bg-primary/[0.02] px-2.5 py-2"
      style={{ borderLeftColor: `color-mix(in srgb, ${color} 55%, transparent)` }}
    >
      <span className="text-micro font-bold uppercase tracking-[0.1em] text-primary/50">
        {concepto.concepto}
      </span>
      <p className="text-sm text-primary/70 leading-snug">{concepto.explicacion}</p>

      {concepto.formula && (
        <div className="rounded bg-primary/5 px-2 py-1 font-mono text-micro text-primary/50 w-fit">
          {concepto.formula}
        </div>
      )}

      {concepto.ejemplo && (
        <p className="text-micro text-primary/40 italic">Ejemplo: {concepto.ejemplo}</p>
      )}

      {concepto.dependencias && (
        <p className="text-micro text-primary/30">Depende de: {concepto.dependencias}</p>
      )}
    </div>
  );
}

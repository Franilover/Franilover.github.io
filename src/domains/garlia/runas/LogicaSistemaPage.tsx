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
 * Diseño: cada capa es un bloque siempre expandido (sin acordeón/dropdown),
 * neutro — sin colores de acento por capa, para no desentonar con el resto
 * del editor. Los conceptos de cada capa se muestran en grid de hasta 2
 * columnas (no una lista vertical larga) para aprovechar mejor el ancho
 * disponible en capas con muchos conceptos (ej. Estructuras con 38,
 * Células con 34).
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/10 bg-primary/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <BookOpenText size={15} className="text-primary/40 shrink-0" />
        <span className="text-[15px] font-black tracking-tight text-primary/85">
          Manual humano
        </span>
        {capaManual && (
          <span className="text-micro font-semibold text-primary/35">
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
            <TarjetaConcepto key={concepto.id} concepto={concepto} />
          ))
        )}
      </div>

      {/* Explicaciones humanas nuevas de estado_proyecto */}
      <div className="mt-2 pt-3 border-t border-primary/10 flex flex-col gap-2.5">
        <Text variant="lbl">Estado del proyecto, en palabras</Text>

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
                    <div key={i} className="text-micro text-primary/55 italic">
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
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.015] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-primary/10">
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
          <TarjetaConcepto key={concepto.id} concepto={concepto} />
        ))}
      </div>
    </div>
  );
}

function TarjetaConcepto({ concepto }: { concepto: ConceptoDocumentacion }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-primary/[0.03] px-2.5 py-2">
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

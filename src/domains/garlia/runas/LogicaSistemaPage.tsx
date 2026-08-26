"use client";

/**
 * LogicaSistemaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sub-tab "Lógica" del toggle de Magia (junto a Runas/Química/Física/
 * Biología, ver RunasPage.tsx → SECCIONES_MAGIA). Es la versión "explicación
 * humana" del sistema entero: los conceptos reales que ya están documentados
 * en Supabase (documentacion_sistema: concepto + explicación + fórmula +
 * ejemplo + dependencias), organizados por capa (Fundamento → Partículas →
 * Elementos → ... → Manual humano).
 *
 * REDISEÑO v2 (explorador de archivos): con ~22 capas y hasta 50 conceptos
 * en una sola capa, mostrar todo expandido a la vez (v1) era imposible de
 * escanear. Ahora:
 *   - Sidebar izquierda: lista de capas con su conteo — se selecciona UNA
 *     capa a la vez (o "Todas" para ver el listado global filtrado).
 *   - Buscador global arriba: filtra por concepto/explicación/ejemplo a
 *     través de TODAS las capas a la vez (no solo la seleccionada), porque
 *     con este volumen "ubicar una regla" es la tarea más común — al
 *     escribir, la sidebar pasa a mostrar solo las capas con resultados y
 *     el panel derecho lista esos resultados con su capa de origen visible.
 *   - Panel derecho: los conceptos de la capa activa (o los resultados de
 *     búsqueda), en lista vertical de una columna — más fácil de leer
 *     fórmula/ejemplo/dependencias en línea que un grid apretado.
 *
 * estado_proyecto (el changelog v128...v148) YA NO vive acá — se maneja en
 * otra pantalla (ver domains/garlia/auditoria). Esta vista es solo el mapa
 * de conceptos: documentacion_sistema, capa por capa.
 *
 * A propósito NO es un diagrama con estados ✅/🟡/⚪ inventados: el único
 * indicador es el conteo real de conceptos por capa (ver
 * useDocumentacionSistema), así que nunca puede quedar desactualizado — si
 * se agrega/edita un concepto en Supabase, esta vista lo refleja solo con
 * recargar.
 *
 * Solo lectura: esta pantalla no escribe en documentacion_sistema, es un
 * visor. Editar los conceptos se sigue haciendo desde Supabase directamente
 * (mismo criterio que compuesto_estabilidad/elemento_sitios_enlace en
 * ElementoEditor/CompuestosPage: derivado, no editable desde el frontend).
 */

import { Layers, Loader2, Search, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import {
  useDocumentacionSistema,
  type CapaDocumentacion,
  type ConceptoDocumentacion,
} from "./useDocumentacionSistema";

/** Filtra conceptos por texto libre — concepto, explicación y ejemplo son
 *  los campos donde alguien buscaría "esa regla que decía tal cosa". No
 *  se busca en fórmula/dependencias: son notación técnica, no lenguaje
 *  natural, y ensuciarían el filtro con falsos positivos (ej. buscar "e"
 *  matchearía casi cualquier fórmula). */
function coincide(concepto: ConceptoDocumentacion, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    concepto.concepto.toLowerCase().includes(q) ||
    concepto.explicacion.toLowerCase().includes(q) ||
    (concepto.ejemplo?.toLowerCase().includes(q) ?? false)
  );
}

export function LogicaSistemaPage() {
  const { capas, total, loading } = useDocumentacionSistema();
  const [capaActivaId, setCapaActivaId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // Capas con al menos un concepto que matchee la búsqueda (o todas, si no
  // hay búsqueda activa) — es lo que se lista en la sidebar.
  const capasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return capas;
    return capas
      .map((c) => ({ ...c, conceptos: c.conceptos.filter((co) => coincide(co, busqueda)) }))
      .filter((c) => c.conceptos.length > 0);
  }, [capas, busqueda]);

  const buscando = busqueda.trim().length > 0;

  // Capa realmente seleccionada: si hay búsqueda activa, ignoramos la
  // selección manual y mostramos resultados de TODAS las capas filtradas
  // (con su nombre de capa visible en cada tarjeta) — es más útil que
  // forzar a elegir una capa primero para poder buscar dentro de ella.
  const capaActiva = useMemo(
    () => (buscando ? null : capasFiltradas.find((c) => c.capa === capaActivaId) ?? capasFiltradas[0] ?? null),
    [buscando, capasFiltradas, capaActivaId],
  );

  const totalResultadosBusqueda = useMemo(
    () => capasFiltradas.reduce((acc, c) => acc + c.conceptos.length, 0),
    [capasFiltradas],
  );

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
    <div className="flex flex-col gap-4">
      {/* Cabecera + buscador global */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-primary/10 px-3 py-2.5">
          <Layers size={15} className="text-primary/40 shrink-0" />
          <p className="text-sm text-primary/60">
            Cómo está armado el sistema, capa por capa.{" "}
            <span className="font-bold text-primary/80">{total} conceptos</span> documentados en
            total.
          </p>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 pointer-events-none"
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar un concepto, explicación o ejemplo en todas las capas..."
            className="w-full rounded-lg border border-primary/10 bg-primary/[0.02] pl-9 pr-9 py-2.5 text-sm text-primary/80 placeholder:text-primary/30 outline-none focus:border-primary/25 transition-colors"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-primary/30 hover:text-primary/60 hover:bg-primary/5 transition-colors"
              title="Limpiar búsqueda"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Explorador: sidebar de capas + panel de detalle */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-start">
        <SidebarCapas
          capas={capasFiltradas}
          capaActivaId={buscando ? null : capaActiva?.capa ?? null}
          onSeleccionar={(id) => setCapaActivaId(id)}
          deshabilitada={buscando}
        />

        <div className="min-w-0 rounded-xl border border-primary/10 bg-primary/[0.015] overflow-hidden">
          {buscando ? (
            <PanelResultadosBusqueda
              capas={capasFiltradas}
              total={totalResultadosBusqueda}
              query={busqueda}
            />
          ) : capaActiva ? (
            <PanelCapa capa={capaActiva} />
          ) : (
            <div className="py-16 text-center text-micro text-primary/30">
              Sin resultados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar de capas — lista simple con conteo, sin colores de acento. La
 * capa activa se marca con fondo sutil, no con borde/color de familia
 * (ver historial: se descartó el sistema de colores por capa por
 * desentonar). Cuando hay búsqueda activa, se deshabilita visualmente
 * (los resultados vienen de todas las capas a la vez) pero se sigue
 * mostrando para que la persona vea en qué capas están los resultados.
 */
function SidebarCapas({
  capas,
  capaActivaId,
  onSeleccionar,
  deshabilitada,
}: {
  capas: CapaDocumentacion[];
  capaActivaId: string | null;
  onSeleccionar: (id: string) => void;
  deshabilitada: boolean;
}) {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/[0.015] overflow-hidden">
      <div className="max-h-[70vh] overflow-y-auto flex flex-col p-1.5 gap-0.5">
        {capas.map((c) => {
          const activa = !deshabilitada && c.capa === capaActivaId;
          return (
            <button
              key={c.capa}
              type="button"
              disabled={deshabilitada}
              onClick={() => onSeleccionar(c.capa)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                activa ? "bg-primary/10" : deshabilitada ? "opacity-50" : "hover:bg-primary/5"
              }`}
            >
              <span
                className={`text-sm truncate flex-1 min-w-0 ${
                  activa ? "font-bold text-primary/85" : "font-medium text-primary/60"
                }`}
              >
                {c.capa}
              </span>
              <span className="text-micro font-semibold text-primary/30 shrink-0">
                {c.conceptos.length}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Panel de detalle: todos los conceptos de la capa activa, en lista
 *  vertical de una columna (no grid) — más fácil de leer fórmula +
 *  ejemplo + dependencias en línea sin apretar el ancho de cada tarjeta. */
function PanelCapa({ capa }: { capa: CapaDocumentacion }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-primary/10 sticky top-0 bg-[var(--bg-main)]">
        <span className="text-[15px] font-bold tracking-tight text-primary/85">{capa.capa}</span>
        <span className="text-micro font-semibold text-primary/35">
          {capa.conceptos.length} concepto{capa.conceptos.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-primary/[0.06]">
        {capa.conceptos.map((concepto) => (
          <TarjetaConcepto key={concepto.id} concepto={concepto} />
        ))}
      </div>
    </div>
  );
}

/** Panel de resultados de búsqueda: conceptos de todas las capas que
 *  matchean, agrupados por capa de origen (con el nombre de la capa
 *  visible como sub-header) para no perder el contexto de dónde vive
 *  cada regla. */
function PanelResultadosBusqueda({
  capas,
  total,
  query,
}: {
  capas: CapaDocumentacion[];
  total: number;
  query: string;
}) {
  if (total === 0) {
    return (
      <div className="py-16 text-center text-sm text-primary/30">
        Sin resultados para "{query}".
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-primary/10 sticky top-0 bg-[var(--bg-main)]">
        <span className="text-sm text-primary/60">
          <span className="font-bold text-primary/80">{total}</span> resultado
          {total === 1 ? "" : "s"} para "{query}"
        </span>
      </div>
      <div className="flex flex-col">
        {capas.map((c) => (
          <div key={c.capa} className="flex flex-col">
            <div className="px-4 pt-3 pb-1.5">
              <span className="text-micro font-bold uppercase tracking-[0.1em] text-primary/35">
                {c.capa}
              </span>
            </div>
            <div className="flex flex-col divide-y divide-primary/[0.06]">
              {c.conceptos.map((concepto) => (
                <TarjetaConcepto key={concepto.id} concepto={concepto} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TarjetaConcepto({ concepto }: { concepto: ConceptoDocumentacion }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <span className="text-sm font-bold text-primary/80">{concepto.concepto}</span>
      <p className="text-sm text-primary/65 leading-relaxed">{concepto.explicacion}</p>

      {concepto.formula && (
        <div className="rounded bg-primary/5 px-2 py-1 font-mono text-micro text-primary/50 w-fit mt-0.5">
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

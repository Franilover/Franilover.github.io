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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-primary/40" />
        <p className="text-sm text-primary/50">
          Cómo está armado el sistema, capa por capa — de lo más chico (partículas) a lo más
          grande (organismos). {total} conceptos documentados en total.
        </p>
      </div>

      {/* Mapa de capas: una fila por capa, en el orden real en que aparecen
          en documentacion_sistema (ver orden numérico de cada concepto). */}
      <div className="flex flex-col gap-1.5">
        {capas.map((c) => (
          <BloqueCapa
            key={c.capa}
            capa={c}
            abierta={capaAbierta === c.capa}
            onToggle={() => setCapaAbierta((prev) => (prev === c.capa ? null : c.capa))}
          />
        ))}
      </div>
    </div>
  );
}

function BloqueCapa({
  capa,
  abierta,
  onToggle,
}: {
  capa: CapaDocumentacion;
  abierta: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-primary/10 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-primary/5 transition-colors"
      >
        {abierta ? (
          <ChevronDown size={13} className="text-primary/40 shrink-0" />
        ) : (
          <ChevronRight size={13} className="text-primary/40 shrink-0" />
        )}
        <span className="text-sm font-black text-primary/80 truncate">{capa.capa}</span>
        <span className="text-micro font-bold text-primary/35 shrink-0">
          {capa.conceptos.length} concepto{capa.conceptos.length === 1 ? "" : "s"}
        </span>
      </button>

      {abierta && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {capa.conceptos.map((concepto) => (
            <TarjetaConcepto key={concepto.id} concepto={concepto} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaConcepto({ concepto }: { concepto: ConceptoDocumentacion }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-primary/10 p-2.5">
      <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/60">
        {concepto.concepto}
      </span>
      <p className="text-sm text-primary/75 leading-snug">{concepto.explicacion}</p>

      {concepto.formula && (
        <div className="rounded bg-primary/5 px-2 py-1 font-mono text-micro text-primary/60">
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

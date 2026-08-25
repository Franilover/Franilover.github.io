"use client";

/**
 * EstadoMaestroPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de solo lectura de estado_proyecto (clave="maestro"): resumen,
 * versión, siguiente paso, y las listas completado/en_progreso/pendiente
 * como acordeones colapsables (son arrays largos de texto narrativo, no
 * tiene sentido mostrarlos todos abiertos de entrada).
 *
 * Reutiliza Loading/EmptyState/Badge de ui/Feedback.tsx y Text de
 * ui/Tipografia.tsx — mismas piezas que ya usa el resto del editor, sin
 * inventar estilos nuevos. No escribe nada: es un espejo de Supabase.
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useState } from "react";

import { Badge, EmptyState, Loading } from "@/ui/Feedback";
import { Text } from "@/ui/Tipografia";

import { useEstadoProyecto } from "./useEstadoProyecto";

function ListaColapsable({
  titulo,
  items,
  variant,
  abiertoPorDefecto = false,
}: {
  titulo: string;
  items: string[];
  variant: "success" | "warning" | "info";
  abiertoPorDefecto?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  return (
    <div className="border border-primary/10 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-primary/[0.02] hover:bg-primary/[0.04] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {abierto ? (
            <ChevronDown size={14} className="shrink-0 text-primary/40" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-primary/40" />
          )}
          <Text variant="btn" className="text-primary/70 truncate">
            {titulo}
          </Text>
        </div>
        <Badge variant={variant}>{items.length}</Badge>
      </button>

      {abierto && (
        <div className="px-3 py-3 space-y-2.5 max-h-[420px] overflow-y-auto border-t border-primary/10">
          {items.length === 0 ? (
            <Text variant="sm" className="text-primary/30 italic">
              Sin elementos.
            </Text>
          ) : (
            items.map((texto, i) => (
              <div
                key={i}
                className="text-xs leading-relaxed text-primary/70 pl-3"
                style={{
                  borderLeft: "2px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                }}
              >
                {texto}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function EstadoMaestroPanel() {
  const { maestro, loading } = useEstadoProyecto();

  if (loading) return <Loading text="Cargando estado del proyecto..." fullScreen={false} />;
  if (!maestro) return <EmptyState label="Sin registro estado_proyecto" />;

  return (
    <div className="space-y-4">
      {/* Cabecera: título, versión, última actualización */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Text variant="xl" as="h2" className="text-primary">
            {maestro.titulo}
          </Text>
          <Text variant="sm" className="text-primary/50 mt-1">
            {maestro.objetivo_actual}
          </Text>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="info">v{maestro.version}</Badge>
          <Text variant="xs" className="text-primary/30">
            {new Date(maestro.ultima_actualizacion).toLocaleString("es-CL")}
          </Text>
        </div>
      </div>

      {/* Resumen y siguiente paso — lo más importante, siempre visible */}
      <div className="bg-primary/[0.02] border border-primary/10 rounded-lg p-4 space-y-3">
        <div>
          <Text variant="lbl">Resumen</Text>
          <Text variant="sm" className="text-primary/80 mt-1 leading-relaxed">
            {maestro.resumen}
          </Text>
        </div>
        <div>
          <Text variant="lbl">Siguiente paso</Text>
          <Text variant="sm" className="text-primary/80 mt-1 leading-relaxed">
            {maestro.siguiente_paso}
          </Text>
        </div>
        <div>
          <Text variant="lbl">Etapa actual</Text>
          <Text variant="sm" className="text-primary/60 mt-1 leading-relaxed">
            {maestro.etapa_actual}
          </Text>
        </div>
      </div>

      {/* Listas colapsables */}
      <div className="space-y-2">
        <ListaColapsable
          titulo="Completado"
          items={maestro.completado}
          variant="success"
        />
        {maestro.en_progreso.length > 0 && (
          <ListaColapsable
            titulo="En progreso"
            items={maestro.en_progreso}
            variant="info"
            abiertoPorDefecto
          />
        )}
        <ListaColapsable
          titulo="Pendiente"
          items={maestro.pendiente}
          variant="warning"
        />
      </div>

      {/* Principios — corto, siempre visible sin acordeón */}
      <div>
        <Text variant="lbl">Principios rectores</Text>
        <div className="mt-1.5 space-y-1.5">
          {maestro.principios.map((p, i) => (
            <div key={i} className="text-xs text-primary/60 italic pl-3" style={{
              borderLeft: "2px solid color-mix(in srgb, var(--primary) 10%, transparent)",
            }}>
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

/**
 * Las columnas jsonb de estado_proyecto (completado/en_progreso/pendiente/
 * principios) NO tienen forma garantizada: hoy "pendiente" llegó como
 * objeto {clave: texto} en vez de array de strings (re-verificado en vivo
 * contra Supabase), y como es una tabla narrativa editada a mano, cualquier
 * otra columna podría cambiar de forma el día de mañana. Antes el
 * componente asumía siempre string[] y llamaba items.map() directo — con
 * un objeto eso explota (TypeError: items.map is not a function),
 * tumbando toda la columna 1 del panel de auditoría en un error en blanco.
 * Este normalizador acepta cualquier forma jsonb razonable y siempre
 * devuelve string[], para que la UI nunca vuelva a crashear por esto.
 */
function normalizarListaJsonb(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
  }
  if (valor && typeof valor === "object") {
    // Objeto {clave: texto} — se muestra como "clave: texto" para no
    // perder la clave, que suele ser la propiedad afectada (ej. "masa").
    return Object.entries(valor as Record<string, unknown>).map(
      ([clave, texto]) =>
        typeof texto === "string" ? `${clave}: ${texto}` : `${clave}: ${JSON.stringify(texto)}`,
    );
  }
  if (typeof valor === "string" && valor.trim() !== "") return [valor];
  return [];
}

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

  // Normalizado UNA vez acá — nunca pasar maestro.completado/en_progreso/
  // pendiente/principios crudos a un .map()/.length más abajo (ver nota
  // del normalizador arriba: la forma real en Supabase no es uniforme).
  const completado = normalizarListaJsonb(maestro.completado);
  const enProgreso = normalizarListaJsonb(maestro.en_progreso);
  const pendiente = normalizarListaJsonb(maestro.pendiente);
  const principios = normalizarListaJsonb(maestro.principios);

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
          items={completado}
          variant="success"
        />
        {enProgreso.length > 0 && (
          <ListaColapsable
            titulo="En progreso"
            items={enProgreso}
            variant="info"
            abiertoPorDefecto
          />
        )}
        <ListaColapsable
          titulo="Pendiente"
          items={pendiente}
          variant="warning"
        />
      </div>

      {/* Principios — corto, siempre visible sin acordeón */}
      <div>
        <Text variant="lbl">Principios rectores</Text>
        <div className="mt-1.5 space-y-1.5">
          {principios.map((p, i) => (
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

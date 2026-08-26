"use client";

/**
 * AlertasPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Dos fuentes, ambas de solo lectura, agrupadas por severidad:
 *   1. compuesto_estequiometria_alertas — toda fila presente está ACTIVA
 *      por definición (las resueltas se borran, no se marcan; ver
 *      types.ts). Se navega directo al compuesto vía
 *      compuestoIdParaNavegacion(), mismo patrón que
 *      AuditoriaDerivacionPanel.
 *   2. compuesto_consistencia_issues — SÍ soporta filas cerradas
 *      (resolved_at). Acá solo mostramos las abiertas por defecto, con un
 *      toggle para ver también las cerradas; es genérica por
 *      entity_type/entity_id así que la navegación es best-effort: solo
 *      sabemos abrir el editor real cuando entity_type es reconocible
 *      (hoy, en la práctica, siempre "compuesto" — ver types.ts). Si
 *      apareciera un entity_type no mapeado, la fila se muestra igual
 *      pero sin click-to-navigate, en vez de asumir un mapeo que no existe.
 *
 * Mismo patrón visual/de navegación que AuditoriaDerivacionPanel.tsx: filas
 * clickeables que abren el editor real ya existente vía
 * useMundoNavigation().openEntity — la auditoría nunca es un callejón sin
 * salida.
 */

import React, { useMemo, useState } from "react";

import { Badge, EmptyState, Loading } from "@/ui/Feedback";
import { Text } from "@/ui/Tipografia";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { compuestoIdParaNavegacion } from "@/domains/garlia/elementos/ElementosSection";

import { useAlertasEstequiometria } from "./useAlertasEstequiometria";
import { useConsistenciaIssues } from "./useConsistenciaIssues";
import type { AlertaEstequiometria, ConsistenciaIssue } from "./types";

/** Valores reales confirmados en Supabase (Paso 8): "warning" e "info" en
 *  ambas tablas hoy. Se agrega el resto (crítica/alta/baja) como fallback
 *  por si aparecen a futuro — pero warning/info van primero y explícitos
 *  para no depender de que "warning" contenga "alt" o similar por
 *  casualidad de substring. */
function grupoSeveridad(valor: string): string {
  const v = valor.toLowerCase();
  if (v === "critical" || v.includes("crit")) return "Crítica";
  if (v === "warning" || v.includes("alt") || v.includes("high")) return "Alta";
  if (v === "info" || v.includes("med")) return "Media";
  if (v.includes("baj") || v.includes("low")) return "Baja";
  return "Otras";
}

function varianteBadgeSeveridad(grupo: string): "danger" | "warning" | "info" | "default" {
  if (grupo === "Crítica") return "danger";
  if (grupo === "Alta") return "warning";
  if (grupo === "Media") return "info";
  return "default";
}

function agruparPorSeveridad<T>(items: T[], severidadDe: (item: T) => string) {
  const grupos = new Map<string, T[]>();
  for (const item of items) {
    const grupo = grupoSeveridad(severidadDe(item));
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), item]);
  }
  // Orden fijo Crítica > Alta > Media > Baja > Otras, omitiendo grupos vacíos.
  const ORDEN = ["Crítica", "Alta", "Media", "Baja", "Otras"];
  return ORDEN.filter((g) => grupos.has(g)).map((g) => [g, grupos.get(g)!] as const);
}

function FilaAlertaEstequiometria({ alerta }: { alerta: AlertaEstequiometria }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  return (
    <button
      type="button"
      onClick={() => openEntity("elementos", compuestoIdParaNavegacion(alerta.compuesto_id))}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-primary/[0.04] transition-colors cursor-pointer border-b border-primary/5 text-left"
    >
      <Text variant="sm" className="text-primary/80 truncate min-w-0 flex-1">
        {alerta.codigo}
      </Text>
      <Text variant="xs" className="text-primary/30 shrink-0">
        compuesto
      </Text>
    </button>
  );
}

function BloqueAlertasEstequiometria() {
  const { items, loading } = useAlertasEstequiometria();

  const grupos = useMemo(
    () => agruparPorSeveridad(items, (a) => a.severidad),
    [items],
  );

  if (loading) return <Loading text="Cargando alertas de estequiometría..." fullScreen={false} />;
  if (items.length === 0)
    return <EmptyState label="Sin alertas de estequiometría activas" />;

  return (
    <div className="space-y-3">
      {grupos.map(([grupo, alertas]) => (
        <div key={grupo} className="border border-primary/10 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/[0.02]">
            <Text variant="btn" className="text-primary/70">
              {grupo}
            </Text>
            <Badge variant={varianteBadgeSeveridad(grupo)}>{alertas.length}</Badge>
          </div>
          <div>
            {alertas.map((alerta) => (
              <FilaAlertaEstequiometria key={alerta.id} alerta={alerta} />
            ))}
          </div>
        </div>
      ))}
      <Text variant="xs" className="text-primary/30 px-1">
        Toda fila presente está activa — las alertas resueltas se eliminan de la tabla
        en origen. Click abre el compuesto en su editor real.
      </Text>
    </div>
  );
}

function FilaConsistenciaIssue({ issue }: { issue: ConsistenciaIssue }) {
  const openEntity = useMundoNavigation((s) => s.openEntity);
  // Best-effort: solo navegamos cuando reconocemos el entity_type. No
  // asumimos que todo lo que empieza con "compuesto" sea navegable a
  // "elementos" sin verificarlo primero.
  const navegable = issue.entity_type.toLowerCase().includes("compuesto");

  const contenido = (
    <>
      <div className="min-w-0 flex-1">
        <Text variant="sm" className="text-primary/80 truncate">
          {issue.issue_code}
        </Text>
        <Text variant="xs" className="text-primary/30 truncate">
          {issue.entity_type}
          {issue.resolved_at && " · resuelto"}
        </Text>
      </div>
      <Text variant="xs" className="text-primary/30 shrink-0">
        {new Date(issue.detected_at).toLocaleDateString("es-CL")}
      </Text>
    </>
  );

  const className =
    "w-full flex items-center justify-between gap-3 px-3 py-2.5 border-b border-primary/5 text-left" +
    (navegable ? " hover:bg-primary/[0.04] transition-colors cursor-pointer" : " opacity-70");

  if (!navegable) {
    return (
      <div className={className}>
        {contenido}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openEntity("elementos", compuestoIdParaNavegacion(issue.entity_id))}
      className={className}
    >
      {contenido}
    </button>
  );
}

function BloqueConsistenciaIssues() {
  const { abiertos, cerrados, loading } = useConsistenciaIssues();
  const [verCerrados, setVerCerrados] = useState(false);

  const visibles = verCerrados ? [...abiertos, ...cerrados] : abiertos;
  const grupos = useMemo(
    () => agruparPorSeveridad(visibles, (i) => i.severity),
    [visibles],
  );

  if (loading) return <Loading text="Cargando issues de consistencia..." fullScreen={false} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <Text variant="lbl">
          Issues de consistencia ({abiertos.length} abiertos
          {cerrados.length > 0 ? `, ${cerrados.length} cerrados` : ""})
        </Text>
        {cerrados.length > 0 && (
          <Badge active={verCerrados} variant="default" onClick={() => setVerCerrados((v) => !v)}>
            Ver cerrados
          </Badge>
        )}
      </div>

      {visibles.length === 0 ? (
        <EmptyState label="Sin issues de consistencia abiertos" />
      ) : (
        grupos.map(([grupo, issues]) => (
          <div key={grupo} className="border border-primary/10 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/[0.02]">
              <Text variant="btn" className="text-primary/70">
                {grupo}
              </Text>
              <Badge variant={varianteBadgeSeveridad(grupo)}>{issues.length}</Badge>
            </div>
            <div>
              {issues.map((issue) => (
                <FilaConsistenciaIssue key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function AlertasPanel() {
  return (
    <div className="space-y-6">
      <div>
        <Text variant="lbl" className="mb-2 px-1 block">
          Alertas de estequiometría
        </Text>
        <BloqueAlertasEstequiometria />
      </div>
      <div>
        <BloqueConsistenciaIssues />
      </div>
    </div>
  );
}

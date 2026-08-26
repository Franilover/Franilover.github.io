"use client";

/**
 * AuditoriaSection.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Orquestador de la sección "Estado del Mundo": 3 columnas internas —
 * Estado | Auditoría de derivación | Alertas — cada una con su propio
 * scroll interno, para tener el estado maestro a la vista mientras se
 * revisa una discrepancia sin perder contexto. Responsive: en pantallas
 * angostas las columnas se apilan.
 *
 * Rediseño de layout (sobre la versión de 3 columnas iguales):
 *   1. Header con RESUMEN agregado real (compuestos con discrepancia,
 *      alertas activas) en vez de solo el label "Estado del Mundo" —
 *      antes había que entrar a cada columna y escanear para saber si
 *      hay algo urgente; ahora se ve en la barra superior sin scrollear.
 *   2. Grid ADAPTATIVO: si hay alertas de severidad Alta/Crítica, la
 *      columna Alertas se ensancha (2fr vs 1fr en las otras dos) — es la
 *      única de las 3 cuyo contenido cambia el orden de prioridad de
 *      lectura según el estado real de los datos; Estado y Auditoría son
 *      siempre "revisar cuando quieras", Alertas puede ser "revisar ya".
 *      Sin alertas altas/críticas, las 3 columnas quedan iguales (1fr
 *      cada una) — no hay razón para desbalancear el layout sin motivo.
 *   3. Headers de columna con BADGE de conteo (no solo ícono + label),
 *      mismo patrón visual que ya usan las tablas internas de cada panel.
 *
 * Los conteos se piden reusando los mismos hooks que cada panel ya
 * usa internamente (useAuditoriaCompuestos, useAlertasEstequiometria,
 * useConsistenciaIssues) — todos pasan por useSupabaseData, que cachea
 * vía Dexie/DataProvider, así que llamarlos acá arriba TAMBIÉN no dispara
 * un fetch nuevo: React Query-style, se comparte el mismo estado cacheado
 * entre este orquestador y el panel hijo que renderiza la lista completa.
 *
 * Solo lectura, igual que antes — ningún panel escribe en Supabase.
 */

import { ClipboardList, ListChecks, ShieldAlert } from "lucide-react";
import React from "react";

import { Badge } from "@/ui/Feedback";
import { Text } from "@/ui/Tipografia";

import { EstadoMaestroPanel } from "./EstadoMaestroPanel";
import { AuditoriaDerivacionPanel } from "./AuditoriaDerivacionPanel";
import { AlertasPanel } from "./AlertasPanel";
import { useAuditoriaCompuestos } from "./useAuditoriaCompuestos";
import { useAlertasEstequiometria } from "./useAlertasEstequiometria";
import { useConsistenciaIssues } from "./useConsistenciaIssues";

function ColumnaHeader({
  Icon,
  label,
  count,
  countVariant = "default",
}: {
  Icon: React.ElementType;
  label: string;
  /** Si se pasa, se muestra como Badge junto al label — mismo patrón que
   *  los headers de tabla dentro de cada panel (ver TablaCompuestos,
   *  BloqueAlertasEstequiometria). undefined = sin badge (loading). */
  count?: number;
  countVariant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-2 mb-2 border-b border-primary/10">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon size={13} className="text-primary/35 shrink-0" />
        <Text variant="lbl" className="text-primary/50 truncate">
          {label}
        </Text>
      </div>
      {count !== undefined && <Badge variant={countVariant}>{count}</Badge>}
    </div>
  );
}

export function AuditoriaSection() {
  const { items: compuestos, conDiscrepancia, loading: compuestosLoading } =
    useAuditoriaCompuestos();
  const { altaOCritica: alertasAltas, loading: alertasLoading } = useAlertasEstequiometria();
  const { altaOCritica: issuesAltos, loading: issuesLoading } = useConsistenciaIssues();

  const resumenListo = !compuestosLoading && !alertasLoading && !issuesLoading;

  // Total de alertas "vivas" que importan para decidir el layout: alertas
  // de estequiometría (todas activas por definición) + issues de
  // consistencia ABIERTOS. No cuenta issues cerrados — ver useConsistenciaIssues.
  const totalAlertasAltas = alertasAltas + issuesAltos;
  const destacarAlertas = resumenListo && totalAlertasAltas > 0;

  // Grid adaptativo: 3 columnas iguales por defecto; si hay algo
  // urgente en Alertas, esa columna pasa a 2fr (el doble de ancho que
  // las otras dos) para que la lectura priorice lo que hay que atender.
  const gridTemplate = destacarAlertas
    ? "md:[grid-template-columns:1fr_1fr_2fr]"
    : "md:grid-cols-3";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-primary/10">
        <Text variant="lbl" className="text-primary/50">
          Estado del Mundo
        </Text>

        {/* Resumen agregado — visible sin entrar a ninguna columna. Se
            arma solo cuando los 3 hooks ya resolvieron, para no mostrar
            un "0" engañoso mientras carga (ver resumenListo arriba). */}
        {resumenListo && (
          <div className="flex items-center gap-2 flex-wrap">
            {conDiscrepancia > 0 && (
              <Badge variant="warning">
                {conDiscrepancia}/{compuestos.length} compuestos con discrepancia
              </Badge>
            )}
            {totalAlertasAltas > 0 ? (
              <Badge variant="danger">{totalAlertasAltas} alerta{totalAlertasAltas === 1 ? "" : "s"} alta{totalAlertasAltas === 1 ? "" : "s"}/crítica{totalAlertasAltas === 1 ? "" : "s"}</Badge>
            ) : (
              <Badge variant="success">Sin alertas altas</Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden px-4 py-4">
        <div className={`grid grid-cols-1 ${gridTemplate} gap-5 md:h-full transition-[grid-template-columns] duration-300`}>
          <div className="min-w-0 md:h-full md:overflow-y-auto md:pr-1">
            <ColumnaHeader Icon={ClipboardList} label="Estado" />
            <EstadoMaestroPanel />
          </div>

          <div className="min-w-0 md:h-full md:overflow-y-auto md:pr-1">
            <ColumnaHeader
              Icon={ListChecks}
              label="Auditoría"
              count={compuestosLoading ? undefined : conDiscrepancia}
              countVariant={
                !compuestosLoading && conDiscrepancia === 0 ? "success" : "warning"
              }
            />
            <AuditoriaDerivacionPanel />
          </div>

          <div className="min-w-0 md:h-full md:overflow-y-auto md:pr-1">
            <ColumnaHeader
              Icon={ShieldAlert}
              label="Alertas"
              count={issuesLoading || alertasLoading ? undefined : totalAlertasAltas}
              countVariant={
                !issuesLoading && !alertasLoading && totalAlertasAltas === 0
                  ? "success"
                  : "danger"
              }
            />
            <AlertasPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

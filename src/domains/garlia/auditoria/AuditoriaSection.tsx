"use client";

/**
 * AuditoriaSection.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Orquestador de la sección "Estado del Mundo". Antes eran 3 tabs
 * (Estado / Auditoría / Alertas) mostradas una a la vez — con el volumen
 * real de datos (estado maestro + tablas de auditoría + alertas) obligaba
 * a saltar de tab en tab para tener una foto completa. Ahora las 3 viven
 * a la vez, como 3 columnas internas de una sola página:
 *   Estado | Auditoría de derivación | Alertas
 * cada una con su propio scroll interno, así que se puede tener el estado
 * maestro a la vista mientras se revisa una discrepancia sin perder
 * contexto. Responsive: en pantallas angostas las columnas se apilan.
 *
 * Solo lectura, igual que antes — ningún panel escribe en Supabase.
 */

import { ClipboardList, ListChecks, ShieldAlert } from "lucide-react";
import React from "react";

import { Text } from "@/ui/Tipografia";

import { EstadoMaestroPanel } from "./EstadoMaestroPanel";
import { AuditoriaDerivacionPanel } from "./AuditoriaDerivacionPanel";
import { AlertasPanel } from "./AlertasPanel";

function ColumnaHeader({ Icon, label }: { Icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pb-2 mb-2 border-b border-primary/10">
      <Icon size={13} className="text-primary/35 shrink-0" />
      <Text variant="lbl" className="text-primary/50">
        {label}
      </Text>
    </div>
  );
}

export function AuditoriaSection() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-primary/10">
        <Text variant="lbl" className="text-primary/50">
          Estado del Mundo
        </Text>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:h-full">
          <div className="min-w-0 md:h-full md:overflow-y-auto md:pr-1">
            <ColumnaHeader Icon={ClipboardList} label="Estado" />
            <EstadoMaestroPanel />
          </div>

          <div className="min-w-0 md:h-full md:overflow-y-auto md:pr-1">
            <ColumnaHeader Icon={ListChecks} label="Auditoría" />
            <AuditoriaDerivacionPanel />
          </div>

          <div className="min-w-0 md:h-full md:overflow-y-auto md:pr-1">
            <ColumnaHeader Icon={ShieldAlert} label="Alertas" />
            <AlertasPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

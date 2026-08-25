"use client";

/**
 * AuditoriaSection.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Orquestador de la sección "Auditoría": agrupa los 3 paneles (Estado
 * Maestro / Auditoría de derivación / Alertas) bajo tabs internas, mismo
 * patrón visual que SelectorSeccionMagia en RunasPage.tsx (chips
 * redondeados con ícono, sin dependencias nuevas). Reemplaza el registro
 * directo de EstadoMaestroPanel en EditorMundoRoot.tsx hecho en el paso
 * anterior — un solo toque adicional a EditorMundoRoot para apuntar acá.
 *
 * La tab activa NO se persiste entre sesiones (a diferencia de
 * useMagiaSeccionStore): es un dashboard de solo lectura, no hay costo real
 * en que siempre abra en "Estado" — evita sumar otro store solo para esto.
 */

import { ClipboardList, ListChecks, ShieldAlert } from "lucide-react";
import React, { useState } from "react";

import { Text } from "@/ui/Tipografia";

import { EstadoMaestroPanel } from "./EstadoMaestroPanel";
import { AuditoriaDerivacionPanel } from "./AuditoriaDerivacionPanel";
import { AlertasPanel } from "./AlertasPanel";

type TabAuditoria = "estado" | "derivacion" | "alertas";

const TABS: { key: TabAuditoria; label: string; Icon: React.ElementType }[] = [
  { key: "estado", label: "Estado", Icon: ClipboardList },
  { key: "derivacion", label: "Auditoría", Icon: ListChecks },
  { key: "alertas", label: "Alertas", Icon: ShieldAlert },
];

function SelectorTabAuditoria({
  tab,
  onCambiarTab,
}: {
  tab: TabAuditoria;
  onCambiarTab: (tab: TabAuditoria) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {TABS.map(({ key, label, Icon }) => {
        const activa = tab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCambiarTab(key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
              activa ? "bg-primary/10 text-primary" : "text-primary/35 hover:text-primary/60"
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AuditoriaSection() {
  const [tab, setTab] = useState<TabAuditoria>("estado");

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-primary/10">
        <Text variant="lbl" className="text-primary/50">
          Estado del Mundo
        </Text>
        <SelectorTabAuditoria tab={tab} onCambiarTab={setTab} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {tab === "estado" && <EstadoMaestroPanel />}
        {tab === "derivacion" && <AuditoriaDerivacionPanel />}
        {tab === "alertas" && <AlertasPanel />}
      </div>
    </div>
  );
}

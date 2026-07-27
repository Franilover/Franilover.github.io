"use client";

/**
 * FechaMundoBadge.tsx
 * ──────────────────────
 * Badge compacto de solo-lectura que muestra una fecha del calendario
 * del mundo. Extraído de EditorLineaTiempo.tsx — reutilizable en
 * cualquier lista/tarjeta que necesite mostrar una fecha (capítulos,
 * eventos, cumpleaños, etc.).
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/calendario/FechaMundoBadge.tsx
 */

import { Loader2 } from "lucide-react";
import React from "react";

import { useCalendario } from "@/domains/garlia/calendario/useCalendario";
import {
  diaAbsolutoAFecha,
  formatFechaCorta,
  eraEnAnio,
} from "@/lib/utils/calendario";


export function FechaMundoBadge({ diaAbsoluto }: { diaAbsoluto: number }) {
  const { cal, loading } = useCalendario();
  if (loading || !cal)
    return <Loader2 className="animate-spin text-primary/20" size={8} />;
  const fecha = diaAbsolutoAFecha(diaAbsoluto, cal.estaciones, cal.config);
  // Si el día absoluto no cae dentro de ninguna estación definida, evitamos
  // crashear formatFechaCorta y mostramos un placeholder en su lugar.
  if (!fecha.estacion) {
    return (
      <span className="text-micro text-primary/30 italic">Fecha inválida</span>
    );
  }
  const era = eraEnAnio(fecha.anio, cal.eras);
  return (
    <span className="inline-flex items-center gap-1.5">
      {era && (
        <span
          className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
          style={{ background: era.color ?? "var(--accent)" }}
        />
      )}
      <span
        className="text-micro font-bold"
        style={{ color: "var(--primary)" }}
      >
        {formatFechaCorta(fecha)}
      </span>
    </span>
  );
}

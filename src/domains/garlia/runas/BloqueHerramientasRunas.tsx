"use client";

/**
 * BloqueHerramientasRunas
 * ───────────────────────────────────────────────────────────────────────────
 * Antes vivían dentro del editor de una runa puntual (FormularioMagico,
 * modo="runas" → PanelPatronRuna):
 *   - El probador de reconocimiento (PanelTestReconocimiento) — dibujar un
 *     trazo de prueba y ver contra qué runa matchea, para detectar
 *     ambigüedades entre runas parecidas.
 *   - El editor de combinaciones (EditorCombinacionesRunas) — hechizos
 *     compuestos que se activan al dibujar runas específicas en celdas
 *     específicas del tablero de /garlia/runas.
 *
 * Se movieron acá porque son herramientas globales del sistema de runas,
 * no de una runa individual — no dependen de estar editando una runa en
 * particular. Ahora viven en la página de Magia, debajo de Subsistemas.
 *
 * El probador sigue funcionando igual: compara contra TODAS las runas que
 * ya tengan patron_trazos guardado en DB (no hay "runa actual" acá, así
 * que no se pasa runaActualId ni trazosActuales en memoria).
 */

import React from "react";

import { EditorCombinacionesRunas } from "./EditorCombinacionesRunas";
import { PanelTestReconocimiento } from "./PanelTestReconocimiento";
import type { EntidadMagica } from "./types";

// ─── Sub-bloque: probador de reconocimiento ────────────────────────────────
// Mismo estilo que los bloques de Hechizos/Dones/Runas: sin icono, título
// centrado.

export function SubBloqueProbador({ runas }: { runas: EntidadMagica[] }) {
  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2 py-2">
        <span />
        <span className="justify-self-center max-w-[280px] truncate text-micro font-bold uppercase tracking-[0.12em] text-primary/70">
          Probador de Runas
        </span>
        <span />
      </div>
      <div className="px-2 pb-2 flex-1">
        <PanelTestReconocimiento runas={runas} trazosActuales={[]} />
      </div>
    </div>
  );
}

// ─── Bloque combinado ───────────────────────────────────────────────────────

export function BloqueHerramientasRunas({
  runas,
}: {
  /** Catálogo completo de runas, para el probador y el editor de combinaciones. */
  runas: EntidadMagica[];
}) {
  return (
    <div>
      <SubBloqueProbador runas={runas} />
      <EditorCombinacionesRunas runas={runas} />
    </div>
  );
}

"use client";

/**
 * BiologiaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sección Biología, hermana de Física en el toggle superior de RunasPage.
 * Ahora muestra directamente el cladograma (Taxonomía) sin sub-tabs:
 *   - Ecosistemas se manejan desde Entidades → Criaturas (ver
 *     CriaturasJerarquica / EcosistemaEditor), ya no vive acá.
 *   - Perfiles atómicos de criatura (afinidad.ts de Elementos + Oris de
 *     Física) tampoco se muestran acá — si hace falta recuperar el acceso,
 *     ver PerfilesAtomicosPage en PerfilAtomicoCriaturaPanel.tsx.
 *
 * 100% self-contained (trae sus propios datos de Supabase, como Física) y
 * NO toca EditorCriatura.tsx — solo referencia criaturas por id.
 */

import { Download } from "lucide-react";
import React from "react";

import { CladisticaPage } from "./CladisticaPage";
import { useBiologiaConfig, useTaxones } from "./useBiologia";

interface Props {
  /** El padre decide qué hacer al clickear una criatura (ej. abrir su editor). */
  onSelectCriatura?: (id: string) => void;
}

// ─── Descarga: el cladograma de Biología en un solo JSON ──────────────────
// Mismo patrón que descargarDatosElementos/descargarDatosFisica — un solo
// archivo autocontenido con taxones + config de rangos.
function descargarDatosBiologia(datos: {
  rangos: string[];
  taxones: ReturnType<typeof useTaxones>["taxones"];
}) {
  const payload = {
    exportado_en: new Date().toISOString(),
    rangos_taxonomicos: datos.rangos,
    taxones: datos.taxones,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `biologia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BiologiaPage({ onSelectCriatura }: Props) {
  // Traído acá solo para armar el JSON de descarga — Taxonomía sigue
  // manejando sus propios datos internamente (self-contained), esto no le
  // saca esa responsabilidad.
  const { rangos } = useBiologiaConfig();
  const { taxones } = useTaxones();

  return (
    <div>
      <div className="flex items-center justify-end px-2 mb-1">
        <button
          type="button"
          onClick={() => descargarDatosBiologia({ rangos, taxones })}
          title="Descargar el cladograma de Biología (taxones + rangos) como JSON"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <Download size={10} />
          <span className="hidden sm:inline">Descargar datos</span>
        </button>
      </div>

      <CladisticaPage onSelectCriatura={onSelectCriatura} />
    </div>
  );
}

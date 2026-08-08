"use client";

/**
 * BiologiaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Orquestador de la sección Biología, hermana de Física en el toggle
 * superior de RunasPage. Sub-tabs internas:
 *   - Cladística: cladograma (grupos monofiléticos por sinapomorfía, sin
 *     rangos linneanos fijos) + criaturas.
 *   - Ecosistemas: biomas + cadenas alimenticias.
 *   - Perfiles: perfil atómico de criatura (reusa afinidad.ts de Elementos)
 *     + vínculo con Oris de Física.
 *
 * 100% self-contained (trae sus propios datos de Supabase, como Física) y
 * NO toca EditorCriatura.tsx — solo referencia criaturas por id.
 */

import { Download } from "lucide-react";
import React, { useState } from "react";

import { CladisticaPage } from "./CladisticaPage";
import { EcosistemasPage } from "./EcosistemasPage";
import { PerfilesAtomicosPage } from "./PerfilAtomicoCriaturaPanel";
import { SECCIONES_BIOLOGIA, type SeccionBiologia } from "./types";
import {
  useCadenasAlimenticias,
  useClados,
  useEcosistemas,
  usePerfilesAtomicosCriatura,
} from "./useBiologia";

interface Props {
  /** El padre decide qué hacer al clickear una criatura (ej. abrir su editor). */
  onSelectCriatura?: (id: string) => void;
}

// ─── Descarga: todo el contenido de Biología en un solo JSON ──────────────
// Mismo patrón que descargarDatosElementos/descargarDatosFisica — un solo
// archivo autocontenido con clados, ecosistemas, cadenas alimenticias y
// perfiles atómicos de criatura.
function descargarDatosBiologia(datos: {
  clados: ReturnType<typeof useClados>["clados"];
  ecosistemas: ReturnType<typeof useEcosistemas>["ecosistemas"];
  cadenas: ReturnType<typeof useCadenasAlimenticias>["cadenas"];
  perfiles: ReturnType<typeof usePerfilesAtomicosCriatura>["perfiles"];
}) {
  const payload = {
    exportado_en: new Date().toISOString(),
    clados: datos.clados,
    ecosistemas: datos.ecosistemas,
    cadenas_alimenticias: datos.cadenas,
    perfiles_atomicos_criatura: datos.perfiles,
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

function SelectorSeccionBiologia({
  seccion,
  onCambiarSeccion,
}: {
  seccion: SeccionBiologia;
  onCambiarSeccion: (s: SeccionBiologia) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-0.5 mb-2">
      {SECCIONES_BIOLOGIA.map(({ key, label, Icon }) => {
        const activa = seccion === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCambiarSeccion(key)}
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

export function BiologiaPage({ onSelectCriatura }: Props) {
  const [seccion, setSeccion] = useState<SeccionBiologia>("cladistica");

  // Traídos acá solo para armar el JSON de descarga — Cladística,
  // Ecosistemas y Perfiles siguen manejando sus propios datos
  // internamente (self-contained), esto no les saca esa responsabilidad.
  const { clados } = useClados();
  const { ecosistemas } = useEcosistemas();
  const { cadenas } = useCadenasAlimenticias();
  const { perfiles } = usePerfilesAtomicosCriatura();

  return (
    <div>
      <div className="flex items-center justify-end px-2 mb-1">
        <button
          type="button"
          onClick={() =>
            descargarDatosBiologia({ clados, ecosistemas, cadenas, perfiles })
          }
          title="Descargar todos los datos de Biología (cladística, ecosistemas, cadenas y perfiles) como JSON"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <Download size={10} />
          <span className="hidden sm:inline">Descargar datos</span>
        </button>
      </div>

      <SelectorSeccionBiologia seccion={seccion} onCambiarSeccion={setSeccion} />

      {seccion === "cladistica" && <CladisticaPage onSelectCriatura={onSelectCriatura} />}
      {seccion === "ecosistemas" && <EcosistemasPage onSelectCriatura={onSelectCriatura} />}
      {seccion === "perfiles" && <PerfilesAtomicosPage />}
    </div>
  );
}

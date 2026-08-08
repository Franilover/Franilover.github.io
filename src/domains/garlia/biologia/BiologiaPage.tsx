"use client";

/**
 * BiologiaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Orquestador de la sección Biología, hermana de Física en el toggle
 * superior de RunasPage. Sub-tabs internas:
 *   - Taxonomía: árbol filogenético (rangos configurables) + criaturas.
 *   - Ecosistemas: biomas + cadenas alimenticias.
 *   - Perfiles: perfil atómico de criatura (reusa afinidad.ts de Elementos)
 *     + vínculo con Oris de Física.
 *
 * 100% self-contained (trae sus propios datos de Supabase, como Física) y
 * NO toca EditorCriatura.tsx — solo referencia criaturas por id.
 */

import React, { useState } from "react";

import { EcosistemasPage } from "./EcosistemasPage";
import { PerfilesAtomicosPage } from "./PerfilAtomicoCriaturaPanel";
import { TaxonomiaPage } from "./TaxonomiaPage";
import { SECCIONES_BIOLOGIA, type SeccionBiologia } from "./types";

interface Props {
  /** El padre decide qué hacer al clickear una criatura (ej. abrir su editor). */
  onSelectCriatura?: (id: string) => void;
}

function SelectorSeccionBiologia({
  seccion,
  onCambiarSeccion,
}: {
  seccion: SeccionBiologia;
  onCambiarSeccion: (s: SeccionBiologia) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 px-2 py-2 mb-2">
      {SECCIONES_BIOLOGIA.map(({ key, label, Icon }) => {
        const activa = seccion === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCambiarSeccion(key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-micro font-bold uppercase tracking-[0.1em] transition-colors ${
              activa ? "bg-primary/10 text-primary" : "text-primary/40 hover:text-primary/70"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function BiologiaPage({ onSelectCriatura }: Props) {
  const [seccion, setSeccion] = useState<SeccionBiologia>("taxonomia");

  return (
    <div>
      <SelectorSeccionBiologia seccion={seccion} onCambiarSeccion={setSeccion} />

      {seccion === "taxonomia" && <TaxonomiaPage onSelectCriatura={onSelectCriatura} />}
      {seccion === "ecosistemas" && <EcosistemasPage onSelectCriatura={onSelectCriatura} />}
      {seccion === "perfiles" && <PerfilesAtomicosPage />}
    </div>
  );
}

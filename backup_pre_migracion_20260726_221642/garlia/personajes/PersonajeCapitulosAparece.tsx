"use client";

/**
 * PersonajeCapitulosAparece.tsx
 * ─────────────────────────────
 * Lista los capítulos en los que aparece un personaje, con navegación
 * directa al capítulo via localStorage + evento.
 * La lógica de datos vive en useCapitulosConPersonaje.
 *
 * Ruta: src/features/editorGarlia/components/personajes/PersonajeCapitulosAparece.tsx
 */

import { Loader2 } from "lucide-react";

import {
  type CapAparece,
  useCapitulosConPersonaje,
} from "@/domains/garlia/libros/capitulos/useCapitulosConPersonaje";

// ─── Componente ───────────────────────────────────────────────────────────────

export function PersonajeCapitulosAparece({
  personajeId,
  onNavigateCapitulo,
}: {
  personajeId: string;
  /**
   * Cambia la sección activa del store de navegación de Mundo a "capitulos".
   * Sin esto, EstudioCapitulos sí abre el capítulo correcto (localStorage +
   * evento, ver abajo) pero EditorMundoRoot nunca deja de mostrar Personajes,
   * porque section sigue en "personajes" — la sección visible depende
   * SIEMPRE de useMundoNavigation, no de qué haga cada editor por su cuenta.
   */
  onNavigateCapitulo?: (capituloId: string) => void;
}) {
  const { caps, loading } = useCapitulosConPersonaje(personajeId);

  const navigateToCap = (cap: CapAparece) => {
    if (!cap.libro_id) return;
    localStorage.setItem("estudio-caps-last-cap", cap.id);
    localStorage.setItem("estudio-caps-last-libro", cap.libro_id);
    window.dispatchEvent(new Event("estudio-caps-action"));
    onNavigateCapitulo?.(cap.id);
  };

  if (loading)
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="animate-spin text-primary/15" size={12} />
      </div>
    );

  if (!caps.length)
    return (
      <p className="text-micro font-black text-primary/20 uppercase tracking-[0.2em] text-center py-3 italic">
        Sin apariciones
      </p>
    );

  return (
    <div>
      {caps.map((cap) => (
        <button
          key={cap.id}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/[0.04] transition-colors text-left group disabled:opacity-40 disabled:cursor-default cursor-pointer border-b border-primary/[0.04] last:border-0"
          disabled={!cap.libro_id}
          type="button"
          onClick={() => navigateToCap(cap)}
        >
          <span className="shrink-0 text-micro font-black tabular-nums text-accent/50 w-4 text-right leading-none">
            {cap.orden}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black text-primary/70 truncate uppercase tracking-wide leading-tight group-hover:text-primary transition-colors">
              {cap.titulo_capitulo}
            </p>
            {cap.libro_titulo && (
              <p className="text-micro text-primary/25 truncate leading-tight">
                {cap.libro_titulo}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

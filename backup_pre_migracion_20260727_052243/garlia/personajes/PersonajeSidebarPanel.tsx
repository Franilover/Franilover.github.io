"use client";

/**
 * PersonajeSidebarPanel.tsx
 * ─────────────────────────
 * Sidebar de escritorio y drawer mobile del editor de personajes.
 * Compone todos los bloques laterales: relaciones, capítulos, canciones,
 * grupos y hechizos. No tiene estado propio salvo lo puramente visual
 * (no aplica aquí) — toda la lógica vive en los componentes hijos.
 *
 * Ruta: src/features/editorGarlia/components/personajes/PersonajeSidebarPanel.tsx
 */

import { BookOpen, Music2, SlidersHorizontal, X } from "lucide-react";

import { BloqueRelaciones } from "./BloqueRelaciones";
import { PersonajeCancionesAsociadas } from "./PersonajeCancionesAsociadas";
import { PersonajeCapitulosAparece } from "./PersonajeCapitulosAparece";
import { PersonajeGrupos } from "./PersonajeGrupos";
import { PersonajeHechizos } from "./PersonajeHechizos";

// ─── Props ────────────────────────────────────────────────────────────────────
interface PersonajeSidebarPanelProps {
  personajeId: string;
  nombrePersonaje: string;
  grupoIds: string[];
  especieEsMagica: boolean;
  /** Modo inline (columna derecha en desktop) o drawer (modal en mobile). */
  modo: "inline" | "drawer";
  /** Solo relevante cuando modo="drawer". */
  onCerrarDrawer?: () => void;
  onSelectPersonaje?: (id: string) => void;
  onOpenGrupo?: (id: string) => void;
  onSelectCancion?: (id: string) => void;
  onNavigateCapitulo?: (capituloId: string) => void;
}

// ─── Contenido compartido entre inline y drawer ───────────────────────────────
function SidebarContenido({
  personajeId,
  nombrePersonaje,
  grupoIds,
  especieEsMagica,
  onSelectPersonaje,
  onOpenGrupo,
  onSelectCancion,
  onNavigateCapitulo,
}: Omit<PersonajeSidebarPanelProps, "modo" | "onCerrarDrawer">) {
  return (
    <>
      {/* Relaciones */}
      <div className="p-2">
        <BloqueRelaciones
          personajeId={personajeId}
          onSelectPersonaje={onSelectPersonaje}
        />
      </div>

      {/* Capítulos */}
      <div className="mt-3">
        <div className="flex items-center gap-1.5 px-2 py-1">
          <BookOpen className="text-primary/25 shrink-0" size={8} />
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 leading-none">
            Capítulos
          </span>
          <div
            className="flex-1 h-px"
            style={{
              background:
                "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          />
        </div>
        <PersonajeCapitulosAparece personajeId={personajeId} onNavigateCapitulo={onNavigateCapitulo} />
      </div>

      {/* Canciones */}
      <div className="mt-3">
        <div className="flex items-center gap-1.5 px-2 py-1">
          <Music2 className="text-primary/25 shrink-0" size={8} />
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 leading-none">
            Canciones
          </span>
          <div
            className="flex-1 h-px"
            style={{
              background:
                "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          />
        </div>
        <PersonajeCancionesAsociadas
          nombrePersonaje={nombrePersonaje}
          personajeId={personajeId}
          onSelectCancion={onSelectCancion}
        />
      </div>

      {/* Grupos */}
      <div className="p-2 mt-1">
        <PersonajeGrupos personajeId={personajeId} onOpenGrupo={onOpenGrupo} />
      </div>

      {/* Hechizos — solo si la especie es mágica */}
      {especieEsMagica && (
        <div className="mt-3">
          <PersonajeHechizos grupoIds={grupoIds} personajeId={personajeId} />
        </div>
      )}
    </>
  );
}

// ─── PersonajeSidebarPanel ────────────────────────────────────────────────────
export function PersonajeSidebarPanel({
  modo,
  onCerrarDrawer,
  ...rest
}: PersonajeSidebarPanelProps) {
  if (modo === "inline") {
    return (
      <aside
        className="hidden sm:flex flex-col w-56 shrink-0 border-l overflow-y-auto"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          scrollbarWidth: "none",
        }}
      >
        <SidebarContenido {...rest} />
      </aside>
    );
  }

  // Drawer mobile
  return (
    <div className="sm:hidden fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0"
        style={{
          background: "color-mix(in srgb, var(--primary) 20%, transparent)",
        }}
        onClick={onCerrarDrawer}
      />

      <div
        className="relative flex flex-col h-full overflow-y-auto shadow-2xl"
        style={{
          width: "240px",
          background: "var(--white-custom, var(--bg-main))",
          borderLeft:
            "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
          scrollbarWidth: "none",
        }}
      >
        <div
          className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        >
          <span
            className="text-micro font-black uppercase tracking-[0.2em] flex items-center gap-1.5"
            style={{
              color: "color-mix(in srgb, var(--primary) 40%, transparent)",
            }}
          >
            <SlidersHorizontal size={9} /> Entidades
          </span>
          <button
            className="p-1 rounded-lg text-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
            onClick={onCerrarDrawer}
          >
            <X size={14} />
          </button>
        </div>

        <SidebarContenido {...rest} />
      </div>
    </div>
  );
}

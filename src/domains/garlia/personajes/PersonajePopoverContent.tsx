"use client";

/**
 * PersonajePopoverContent.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Versión "popover" minimalista de un Personaje: nombre + selectores rápidos
 * (Especie, Reino) y, debajo, los mismos bloques del sidebar del editor
 * completo (Relaciones, Capítulos, Canciones, Grupos) — reutiliza
 * <SidebarContenido> de PersonajeSidebarPanel para no duplicar esa lógica.
 *
 * No navega a pantalla completa por sí solo: expone un botón "centrar"
 * (ícono Maximize2) que es quien decide abrir el editor completo, igual que
 * EcosistemaPopoverContent/BiomaPopoverContent con onSelectCriatura /
 * onSelectBioma — acá es `onAbrirCompleto`.
 *
 * Pensado para usarse dentro de <PopoverFlotante>, igual que los popovers de
 * Ecosistema/Bioma en CriaturasJerarquica y GeografiaJerarquica.
 */

import { Maximize2, UserCircle2 } from "lucide-react";
import React from "react";

import { ComboSelector } from "@/ui/ComboSelector";
import { useNombresDeTabla } from "@/domains/garlia/_shared/useNombresDeTabla";
import { useCiudades } from "@garlia/ciudades";
import { useReinosMin } from "@garlia/reinos";

import { SidebarContenido } from "./PersonajeSidebarPanel";

interface PersonajeMin {
  id: string;
  nombre: string;
  img_url?: string | null;
  especie?: string | null;
  reino?: string | null;
  ciudad_id?: string | null;
}

export function PersonajePopoverContent({
  personaje,
  onSave,
  onClose,
  onAbrirCompleto,
  onSelectPersonaje,
  onOpenGrupo,
  onSelectCancion,
  onNavigateCapitulo,
}: {
  personaje: PersonajeMin;
  /** Guarda un patch parcial (especie/reino/ciudad_id) — el resto de campos
   *  se editan solo en el editor completo. */
  onSave: (patch: Partial<PersonajeMin>) => void;
  onClose: () => void;
  /** Abre el EditorPersonaje a pantalla completa para este personaje. */
  onAbrirCompleto: () => void;
  onSelectPersonaje?: (id: string) => void;
  onOpenGrupo?: (id: string) => void;
  onSelectCancion?: (id: string) => void;
  onNavigateCapitulo?: (capituloId: string) => void;
}) {
  const especies = useNombresDeTabla("criaturas");
  const reinosMin = useReinosMin();
  const ciudades = useCiudades();

  // Mismo criterio que FormularioPersonaje (EditorPersonaje.tsx): ciudades
  // filtradas por el reino actual del personaje (o sin reino_id si no tiene
  // reino asignado).
  const reinoSeleccionadoId =
    reinosMin.find((r) => r.nombre === personaje.reino)?.id ?? null;
  const ciudadesFiltradas = ciudades.filter((l) =>
    reinoSeleccionadoId ? l.reino_id === reinoSeleccionadoId : !l.reino_id,
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header: avatar + nombre + botón centrar (pantalla completa) */}
      <div className="shrink-0 flex items-center gap-2 mb-3">
        <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-primary/15 bg-primary/5 flex items-center justify-center">
          {personaje.img_url ? (
            <img
              alt={personaje.nombre}
              className="w-full h-full object-cover"
              src={personaje.img_url}
            />
          ) : (
            <UserCircle2 className="text-primary/25" size={18} />
          )}
        </div>
        <span className="flex-1 min-w-0 truncate text-sm font-black text-primary">
          {personaje.nombre}
        </span>
        <button
          type="button"
          onClick={onAbrirCompleto}
          title="Abrir a pantalla completa"
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest text-primary/40 hover:text-accent hover:bg-accent/10 transition-all"
        >
          <Maximize2 size={11} /> Centrar
        </button>
      </div>

      {/* Selectores rápidos: Especie, Reino, Ubicación */}
      <div className="shrink-0 grid grid-cols-3 gap-2 mb-3">
        <ComboSelector
          allowNone
          items={especies.map((e) => ({ id: e, label: e }))}
          label="Especie"
          mode="single"
          noneLabel="Sin especie"
          placeholder="Humano, elfo…"
          value={personaje.especie ?? null}
          onChange={(v) => onSave({ especie: v ?? "" })}
        />
        <ComboSelector
          allowNone
          groups={[]}
          items={reinosMin.map((r) => ({ id: r.nombre, label: r.nombre }))}
          label="Reino"
          mode="single"
          noneLabel="Sin reino"
          placeholder="Territorio…"
          value={personaje.reino ?? null}
          onChange={(v) => onSave({ reino: v ?? "", ciudad_id: null })}
        />
        <ComboSelector
          allowNone
          groups={[]}
          items={ciudadesFiltradas.map((l) => ({ id: l.id, label: l.nombre }))}
          label="Ubicación"
          mode="single"
          noneLabel="Sin ubicación"
          placeholder="Ciudad…"
          value={personaje.ciudad_id ?? null}
          onChange={(v) => onSave({ ciudad_id: v ?? null })}
        />
      </div>

      {/* Relaciones / Capítulos / Canciones / Grupos — mismo contenido que
          el sidebar del editor completo, sin duplicar su lógica. */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        <SidebarContenido
          personajeId={personaje.id}
          nombrePersonaje={personaje.nombre}
          onNavigateCapitulo={onNavigateCapitulo}
          onOpenGrupo={onOpenGrupo}
          onSelectCancion={onSelectCancion}
          onSelectPersonaje={onSelectPersonaje ?? onClose}
        />
      </div>
    </div>
  );
}

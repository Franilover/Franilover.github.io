"use client";

/**
 * CriaturaPopoverContent.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Versión "popover" minimalista de una Criatura: nombre + descripción y,
 * debajo, tres bloques compactos:
 *   - Clasificación (Hábitat, Inteligencia, Alma, Usar Mana, Produce Mana —
 *     mismo <BloqueGrupoCategoria> que EditorCriatura.tsx, un grupo por
 *     subtipo)
 *   - Personajes (toggle vía usePersonajesDeCriatura — set/unset del campo
 *     Personaje.especie)
 *   - Territorio (toggle de reinos vía useCriaturaReinos, tabla puente
 *     criatura_reinos)
 *
 * No incluye Ciudades, Creaciones ni Subsistema Mágico — ver el editor
 * completo (EditorCriatura.tsx) para esos bloques y la ficha D&D.
 *
 * No navega a pantalla completa por sí solo: expone un botón "centrar"
 * (ícono Maximize2) que es quien decide abrir el editor completo, mismo
 * patrón que PersonajePopoverContent con onAbrirCompleto.
 *
 * Resuelve sus propios datos por criaturaId (como EcosistemaPopoverContent/
 * BiomaPopoverContent), así el llamador solo necesita pasar el id.
 *
 * Pensado para usarse dentro de <PopoverFlotante>, igual que los popovers de
 * Ecosistema/Bioma/Personaje en CriaturasJerarquica y GeografiaJerarquica.
 */

import { Brain, Globe, Maximize2, Sparkles, Star, Users, Wand2 } from "lucide-react";
import React, { useState } from "react";

import { RichEditor } from "@/editor/lexical";

import {
  BloqueGrupoCategoria,
  type GrupoMinExt,
} from "./BloqueGruposCriatura";
import { useCriaturaReinos } from "./CriaturaHabitat";
import { useCriaturaAsideCatalogs } from "./useCriaturaAsideCatalogs";
import { usePersonajesDeCriatura } from "./usePersonajesDeCriatura";
import { useMembresiaGruposCriatura } from "@/domains/garlia/grupos/useMembresiaGruposCriatura";

interface CriaturaMin {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  descripcion?: string | null;
}

const CATEGORIAS_CLASIFICACION = [
  { label: "Hábitat", subtipo: "Hábitat", icon: Globe },
  { label: "Inteligencia", subtipo: "Inteligencia", icon: Brain },
  { label: "Alma", subtipo: "Alma", icon: Wand2 },
  { label: "Usar Mana", subtipo: "Usar Mana", icon: Sparkles },
  { label: "Produce Mana", subtipo: "Produce Mana", icon: Star },
] as const;

export function CriaturaPopoverContent({
  criatura,
  onSave,
  onClose,
  onAbrirCompleto,
  onSelectPersonaje,
  onSelectGrupo,
  onNavigateReino,
}: {
  criatura: CriaturaMin;
  /** Guarda un patch parcial (por ahora solo `descripcion`) — el resto de
   *  campos se editan solo en el editor completo. */
  onSave: (patch: Partial<CriaturaMin>) => void;
  onClose: () => void;
  /** Abre el EditorCriatura a pantalla completa para esta criatura. */
  onAbrirCompleto: () => void;
  onSelectPersonaje?: (id: string) => void;
  onSelectGrupo?: (grupoId: string) => void;
  onNavigateReino?: (id: string) => void;
}) {
  const [descripcion, setDescripcion] = useState(criatura.descripcion ?? "");

  const { allPersonajes, allReinos } = useCriaturaAsideCatalogs();

  const {
    grupos: gruposActuales,
    todosGrupos,
    addToGrupo,
    removeFromGrupo,
  } = useMembresiaGruposCriatura(criatura.id);

  const {
    personajes: personajesDeEspecie,
    loading: loadingPersonajes,
    saving: savingPersonajes,
    toggle: togglePersonaje,
  } = usePersonajesDeCriatura(criatura.id, criatura.nombre);

  const {
    rows: reinoRows,
    loading: loadingReinos,
    add: addReinoSidebar,
    remove: removeReinoSidebar,
  } = useCriaturaReinos(criatura.id);

  const [savingReinos, setSavingReinos] = useState(false);

  const handleTogglePersonaje = (id: string, add: boolean) =>
    togglePersonaje(id, add, criatura.nombre, allPersonajes);

  const handleToggleReino = async (id: string, add: boolean) => {
    setSavingReinos(true);
    if (add) {
      const reino = allReinos.find((r) => r.id === id);
      if (reino) await addReinoSidebar(reino);
    } else {
      const row = reinoRows.find((r) => r.reinoId === id);
      if (row) await removeReinoSidebar(row.rowId);
    }
    setSavingReinos(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header: avatar + nombre + botón centrar (pantalla completa) */}
      <div className="shrink-0 flex items-center gap-2 mb-3">
        <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-primary/15 bg-primary/5 flex items-center justify-center">
          {criatura.imagen_url ? (
            <img
              alt={criatura.nombre}
              className="w-full h-full object-cover"
              src={criatura.imagen_url}
            />
          ) : (
            <Users className="text-primary/25" size={16} />
          )}
        </div>
        <span className="flex-1 min-w-0 truncate text-sm font-black text-primary">
          {criatura.nombre}
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

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-3">
        {/* Descripción — el guardado ocurre al perder foco (blur), captado
            por delegación en el div contenedor (mismo criterio que
            PanelEcosistema, donde RichEditor solo actualiza el estado local
            en onChange y el guardado real lo dispara el blur de un campo
            hermano). */}
        <div onBlur={() => onSave({ descripcion })}>
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 block mb-1">
            Descripción
          </span>
          <RichEditor
            minHeight="4.5rem"
            placeholder="Aspecto físico general…"
            value={descripcion}
            onChange={setDescripcion}
          />
        </div>

        {/* Clasificación */}
        <div>
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 block mb-1.5">
            Clasificación
          </span>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIAS_CLASIFICACION.map(({ label, subtipo, icon }) => (
              <div key={subtipo} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-micro font-bold uppercase tracking-widest text-primary/30 mb-0.5">
                  {React.createElement(icon, { size: 7 })} {label}
                </span>
                <BloqueGrupoCategoria
                  gruposActuales={gruposActuales as GrupoMinExt[]}
                  icon={icon}
                  label={label}
                  subtipo={subtipo}
                  todosGrupos={todosGrupos as GrupoMinExt[]}
                  onAdd={addToGrupo}
                  onRemove={removeFromGrupo}
                  onSelectGrupo={onSelectGrupo}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Personajes */}
        <div>
          <div className="flex items-center gap-1.5 px-0.5 mb-1.5">
            <Users className="text-primary/25 shrink-0" size={8} />
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 leading-none">
              Personajes
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            />
          </div>
          {loadingPersonajes ? (
            <p className="text-micro text-primary/25 italic px-0.5">Cargando…</p>
          ) : personajesDeEspecie.length === 0 ? (
            <p className="text-micro text-primary/25 italic px-0.5">Sin personajes</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {personajesDeEspecie.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => (onSelectPersonaje ?? onClose)(p.id)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-primary/10 bg-primary/[0.02] hover:border-accent/40 hover:bg-accent/5 transition-all text-left min-w-0"
                >
                  <div className="shrink-0 w-4 h-4 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                    {p.img_url ? (
                      <img alt={p.nombre} className="w-full h-full object-cover" src={p.img_url} />
                    ) : (
                      <Users size={8} className="text-primary/30" />
                    )}
                  </div>
                  <span className="truncate text-micro font-bold text-primary/70">{p.nombre}</span>
                </button>
              ))}
            </div>
          )}
          {savingPersonajes && (
            <p className="text-micro text-primary/25 italic px-0.5 mt-1">Guardando…</p>
          )}
          {/* Añadir/quitar personajes de la especie — mismo toggle que el
              editor completo, solo que acá sin grilla de selección visual
              (se hace por nombre, vía el campo Personaje.especie). Se deja
              afuera de este popover minimalista: usar "Centrar" para el
              picker completo. */}
        </div>

        {/* Territorio */}
        <div>
          <div className="flex items-center gap-1.5 px-0.5 mb-1.5">
            <Globe className="text-primary/25 shrink-0" size={8} />
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 leading-none">
              Territorio
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            />
          </div>
          {loadingReinos ? (
            <p className="text-micro text-primary/25 italic px-0.5">Cargando…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {reinoRows.map((r) => (
                <div
                  key={r.rowId}
                  className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg border text-micro font-bold"
                  style={{
                    background: "color-mix(in srgb, var(--primary) 6%, transparent)",
                    borderColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  <button
                    type="button"
                    className="hover:underline"
                    title="Ir al reino"
                    onClick={() => onNavigateReino?.(r.reinoId)}
                  >
                    {r.reinoNombre}
                  </button>
                  <button
                    type="button"
                    className="w-3 h-3 rounded flex items-center justify-center text-primary/30 hover:text-red-400 transition-colors"
                    onClick={() => handleToggleReino(r.reinoId, false)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <select
                className="bg-transparent border border-dashed rounded-lg px-2 py-0.5 text-micro font-black uppercase tracking-widest text-primary/35 outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)" }}
                value=""
                disabled={savingReinos}
                onChange={(e) => {
                  if (e.target.value) handleToggleReino(e.target.value, true);
                }}
              >
                <option value="">+ Añadir reino</option>
                {allReinos
                  .filter((r) => !reinoRows.some((row) => row.reinoId === r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * PanelFlotanteGlobal
 * ───────────────────────────────────────────────────────────────────────────
 * Único punto de renderizado para la "vista rápida" de Personaje/Criatura.
 * Lee usePanelFlotante, resuelve los datos por id vía useSupabaseData (mismo
 * cache que ya usa EntidadesPage — sin fetch nuevo) y renderiza
 * PersonajePopoverContent / CriaturaPopoverContent dentro de un
 * PopoverFlotante siempre centrado en pantalla (centerVertically +
 * centerHorizontally + backdrop).
 *
 * Se monta UNA sola vez en EditorMundoRoot. Cualquier botón de "abrir
 * personaje/criatura" en toda la app debe llamar a
 * usePanelFlotante().abrir(kind, id) con click izquierdo normal — nunca más
 * click del medio ni pantalla completa.
 *
 * onAbrirCompleto sigue navegando a pantalla completa vía openEntity (mismo
 * mecanismo que ya usaba onOpen("personajes"/"criaturas", id)) para cuando
 * el usuario realmente quiere el editor completo, no solo la vista rápida.
 */

import React, { useRef } from "react";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { PersonajePopoverContent, type Personaje } from "@garlia/personajes";
import { CriaturaPopoverContent } from "@/domains/garlia/criaturas";
import type { Criatura } from "@/domains/garlia/criaturas/types";

import { PopoverFlotante } from "./PopoverFlotante";
import { usePanelFlotante } from "./usePanelFlotanteStore";

export function PanelFlotanteGlobal() {
  const entidad = usePanelFlotante((s) => s.entidad);
  const cerrar = usePanelFlotante((s) => s.cerrar);
  const abrir = usePanelFlotante((s) => s.abrir);
  const openEntity = useMundoNavigation((s) => s.openEntity);

  const { data: personajes, updateRow: updatePersonaje } =
    useSupabaseData<Personaje>("personajes");
  const { data: criaturas, updateRow: updateCriatura } =
    useSupabaseData<Criatura>("criaturas");

  // El panel siempre se centra en el viewport — PopoverFlotante necesita un
  // anchor no-nulo para el cálculo inicial de posición, pero en modo
  // backdrop ignora anchor.contains() para el cierre por click-afuera, así
  // que document.body como placeholder es seguro acá.
  const bodyAnchorRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" ? document.body : null,
  );

  if (!entidad) return null;

  if (entidad.kind === "personaje") {
    const p = personajes.find((x) => x.id === entidad.id);
    if (!p) return null;
    return (
      <PopoverFlotante
        anchor={bodyAnchorRef.current}
        onClose={cerrar}
        width={560}
        maxHeight={620}
        centerVertically
        centerHorizontally
        backdrop
      >
        <PersonajePopoverContent
          personaje={p}
          onSave={(patch) => updatePersonaje(p.id, patch)}
          onClose={cerrar}
          onAbrirCompleto={() => {
            cerrar();
            openEntity("personajes", p.id);
          }}
          onSelectPersonaje={(id) => abrir("personaje", id)}
          onOpenGrupo={(id) => {
            cerrar();
            openEntity("grupos", id);
          }}
          onSelectCancion={(id) => {
            cerrar();
            openEntity("letras", id);
          }}
          onNavigateCapitulo={(capituloId) => {
            cerrar();
            openEntity("capitulos", capituloId);
          }}
        />
      </PopoverFlotante>
    );
  }

  const c = criaturas.find((x) => x.id === entidad.id);
  if (!c) return null;
  return (
    <PopoverFlotante
      anchor={bodyAnchorRef.current}
      onClose={cerrar}
      width={560}
      maxHeight={620}
      centerVertically
      centerHorizontally
      backdrop
    >
      <CriaturaPopoverContent
        criatura={c}
        onSave={(patch) => updateCriatura(c.id, patch)}
        onClose={cerrar}
        onAbrirCompleto={() => {
          cerrar();
          openEntity("criaturas", c.id);
        }}
        onSelectPersonaje={(id) => abrir("personaje", id)}
        onSelectGrupo={(grupoId) => {
          cerrar();
          openEntity("grupos", grupoId);
        }}
        onNavigateReino={(id) => {
          cerrar();
          openEntity("reinos", id);
        }}
      />
    </PopoverFlotante>
  );
}

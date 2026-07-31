"use client";

/**
 * EntidadesPage
 * ───────────────────────────────────────────────────────────────────────────
 * Combina varias páginas de "grid de tarjetas" que comparten datos/hooks:
 * Personajes + Reinos + Ciudades (Entidades/Geografía), Criaturas (Items +
 * Personajes agrupados por criatura de origen), Hechizos + Dones + Runas
 * (Magia), Letras/Canciones, y Grupos + Notas (Organización). Cada una es
 * ahora su propia sección en la navbar (sin sub-tabs internas) — pero
 * reutilizan este mismo componente para su renderizado, ya que comparten
 * hooks de datos (useSupabaseData, useGrupos, useNotas, etc.).
 *
 * Al clickear una tarjeta se abre el editor de esa entidad a pantalla
 * completa (mismo store global: openEntity(section, id)); "Volver" en la
 * navbar limpia solo selectedId (clearSelection), volviendo al grid — la
 * sección activa sigue siendo la que se abrió, así el editor correcto se
 * muestra sin lógica extra acá.
 */

import { Music, Plus, StickyNote } from "lucide-react";
import React, { useMemo, useState } from "react";

import { PanelEditor } from "@/domains/garlia/canciones/editor/PanelEditor";
import { ModalNuevaCancion } from "@/domains/garlia/canciones/modals/ModalNuevaCancion";
import { FormularioMagico } from "@/domains/garlia/magia/FormularioMagico";
import { CONFIG, type EntidadMagica } from "@/domains/garlia/magia/types";
import { useCanciones } from "@/domains/garlia/canciones/useCanciones";
import type { Cancion } from "@/domains/garlia/canciones/types";
import { Chip } from "@/ui/Chip";
import { useGruposCriaturas } from "@/domains/garlia/grupos/useGruposCriaturas";
import { useGruposRunas } from "@/domains/garlia/grupos/useGruposRunas";
import { useNotas } from "@/editor/notas/useNotas";
import { type Nota } from "@/domains/garlia/_shared/types";
import { useEntidadesMagicas } from "@/domains/garlia/magia/useEntidadesMagicas";
import { EditorGrupo, GRUPO_TIPO_CONFIG, useGrupos, type GrupoTipo } from "@/domains/garlia/grupos/EditorGrupo";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { supabase } from "@/infra/supabase/supabase";

import { CriaturaEditor } from "@/domains/garlia/criaturas/CriaturaEditor";
import { ItemEditor } from "@/domains/garlia/items/ItemEditor";
import { PersonajeEditor } from "@garlia/personajes";
import { ReinoEditor } from "@garlia/reinos";
import { CiudadEditor } from "@garlia/ciudades";
import { EntityCardGrid } from "@/domains/garlia/_shared/EntityCardGrid";
import { GeografiaJerarquica } from "@/domains/garlia/_shared/GeografiaJerarquica";
import { MagiaJerarquica } from "@/domains/garlia/magia/MagiaJerarquica";
import { MagiaPorTipo } from "@/domains/garlia/magia/MagiaPorTipo";
import { TABLA_TO_SECTION } from "@/domains/garlia/_shared/useExternalCommandBridge";
import { useMundoNavigation, type SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";

interface Personaje {
  id: string;
  nombre: string;
  img_url?: string;
  reino?: string;
  especie?: string;
  ciudad_id?: string | null;
}
interface Criatura {
  id: string;
  nombre: string;
  imagen_url?: string;
  habitat?: string;
}
interface Item {
  id: string;
  nombre: string;
  imagen_url?: string;
  categoria?: string;
  criatura_id?: string | null;
}
interface Reino {
  id: string;
  nombre: string;
  oculto?: boolean;
}
interface Ciudad {
  id: string;
  nombre: string;
  tipo?: string | null;
  reino_id?: string | null;
}

interface Props {
  section: SectionKey;
  selectedId: string | null;
}

function useMagiaCategoria(modo: "hechizos" | "dones" | "runas") {
  const { items, setItems, loading } = useEntidadesMagicas(modo);
  const [creating, setCreating] = useState(false);
  const cfg = CONFIG[modo];

  const create = async (): Promise<string | null> => {
    setCreating(true);
    try {
      const insertPayload =
        modo === "runas"
          ? { nombre: `Nueva ${cfg.labelSing}` }
          : { nombre: `Nuevo ${cfg.labelSing}`, grupo_ids: [] };
      const selectFields =
        modo === "runas"
          ? "id, nombre, explicacion, imagen_url"
          : "id, nombre, explicacion, grupo_ids";

      const { data, error } = await supabase
        .from(cfg.tabla)
        .insert([insertPayload])
        .select(selectFields)
        .single();
      if (error) throw error;
      const created = data as unknown as EntidadMagica;
      setItems((prev) => [created, ...prev]);
      return created.id;
    } finally {
      setCreating(false);
    }
  };

  return { items, setItems, loading, creating, create, cfg };
}

export function EntidadesPage({ section, selectedId }: Props) {
  // ── Entidades ──────────────────────────────────────────────────────────
  const { data: personajes, loading: loadingP, addRow: addPersonaje } =
    useSupabaseData<Personaje>("personajes");
  const { data: criaturas, loading: loadingC, addRow: addCriatura } =
    useSupabaseData<Criatura>("criaturas");
  const { data: items, loading: loadingI, addRow: addItem } =
    useSupabaseData<Item>("items");

  // ── Geografía ──────────────────────────────────────────────────────────
  const { data: reinos, loading: loadingR, addRow: addReino } =
    useSupabaseData<Reino>("reinos");
  const { data: ciudades, loading: loadingCd, addRow: addCiudad } =
    useSupabaseData<Ciudad>("ciudades");

  // ── Magia ──────────────────────────────────────────────────────────────
  const hechizos = useMagiaCategoria("hechizos");
  const dones = useMagiaCategoria("dones");
  const runas = useMagiaCategoria("runas");
  const { grupos: gruposCriaturas, loading: loadingGrupos } = useGruposCriaturas();
  const { grupos: gruposRunas, loading: loadingGruposRunas } = useGruposRunas();

  // ── Organización (Grupos + Notas) ────────────────────────────────────────
  const { grupos, loaded: loadedGrupos, crearGrupo, actualizarGrupo, eliminarGrupo } = useGrupos();
  const { notas, loading: loadingNotas, crear: crearNota, actualizar: actualizarNota, eliminar: eliminarNota } =
    useNotas();

  const gruposPorTipo = useMemo(() => {
    const map: Partial<Record<GrupoTipo, typeof grupos>> = {};
    for (const g of grupos) {
      if (!map[g.tipo]) map[g.tipo] = [];
      map[g.tipo]!.push(g);
    }
    return map;
  }, [grupos]);

  /** Dentro de cada tipo, agrupamos por subtipo (ej. "Familia", "Clan"…).
   *  Los grupos sin subtipo caen en un balde aparte al final. */
  const subtiposPorTipo = useMemo(() => {
    const map: Partial<Record<GrupoTipo, { subtipo: string | null; items: typeof grupos }[]>> = {};
    for (const [tipoStr, lista] of Object.entries(gruposPorTipo)) {
      const tipo = tipoStr as GrupoTipo;
      const porSubtipo = new Map<string, typeof grupos>();
      const sinSubtipo: typeof grupos = [];
      for (const g of lista ?? []) {
        if (g.subtipo && g.subtipo.trim()) {
          const key = g.subtipo.trim();
          if (!porSubtipo.has(key)) porSubtipo.set(key, []);
          porSubtipo.get(key)!.push(g);
        } else {
          sinSubtipo.push(g);
        }
      }
      const bloques: { subtipo: string | null; items: typeof grupos }[] = Array.from(porSubtipo.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([subtipo, items]) => ({ subtipo, items }));
      if (sinSubtipo.length) bloques.push({ subtipo: null, items: sinSubtipo });
      map[tipo] = bloques;
    }
    return map;
  }, [gruposPorTipo]);

  // ── Canciones ─────────────────────────────────────────────────────────
  const { canciones, setCanciones, loading: loadingCanciones } = useCanciones();
  const [showNuevaCancion, setShowNuevaCancion] = useState(false);

  // Filtros por Emoción / Tema (chips, selección única por campo — igual
  // que los selectores del sidebar de edición). Los valores disponibles
  // salen de las propias canciones cargadas, no de una lista fija.
  const [filtroEmocion, setFiltroEmocion] = useState<string>("");
  const [filtroTema, setFiltroTema] = useState<string>("");

  const emocionesDisponibles = useMemo(
    () =>
      Array.from(
        new Set(canciones.map((c) => c.emocion?.trim()).filter(Boolean)),
      ).sort((a, b) => a!.localeCompare(b!, "es")) as string[],
    [canciones],
  );
  const temasDisponibles = useMemo(
    () =>
      Array.from(
        new Set(canciones.map((c) => c.tema?.trim()).filter(Boolean)),
      ).sort((a, b) => a!.localeCompare(b!, "es")) as string[],
    [canciones],
  );

  const cancionesFiltradas = useMemo(
    () =>
      canciones.filter((c) => {
        if (filtroEmocion && c.emocion?.trim() !== filtroEmocion) return false;
        if (filtroTema && c.tema?.trim() !== filtroTema) return false;
        return true;
      }),
    [canciones, filtroEmocion, filtroTema],
  );

  /** Agrupa canciones por Idioma → Cantante → Compositor, en ese orden.
   *  Los valores vacíos caen en un balde "Sin …" que siempre queda al final. */
  const cancionesAgrupadas = useMemo(() => {
    const SIN = new Set(["Sin idioma", "Sin compositor", "Sin cantante"]);
    const sortKeys = (keys: string[]) =>
      keys.sort((a, b) => {
        if (SIN.has(a) && !SIN.has(b)) return 1;
        if (SIN.has(b) && !SIN.has(a)) return -1;
        return a.localeCompare(b, "es");
      });

    const porIdioma = new Map<string, Map<string, Map<string, Cancion[]>>>();
    for (const c of cancionesFiltradas) {
      const idioma = c.idioma?.trim() || "Sin idioma";
      const compositor = c.compositor?.trim() || "Sin compositor";
      const cantante = c.cantante?.trim() || "Sin cantante";

      if (!porIdioma.has(idioma)) porIdioma.set(idioma, new Map());
      const porCantante = porIdioma.get(idioma)!;

      if (!porCantante.has(cantante)) porCantante.set(cantante, new Map());
      const porCompositor = porCantante.get(cantante)!;

      if (!porCompositor.has(compositor)) porCompositor.set(compositor, []);
      porCompositor.get(compositor)!.push(c);
    }

    return sortKeys(Array.from(porIdioma.keys())).map((idioma) => {
      const porCantante = porIdioma.get(idioma)!;
      return {
        idioma,
        cantantes: sortKeys(Array.from(porCantante.keys())).map((cantante) => {
          const porCompositor = porCantante.get(cantante)!;
          return {
            cantante,
            compositores: sortKeys(Array.from(porCompositor.keys())).map((compositor) => ({
              compositor,
              canciones: porCompositor.get(compositor)!,
            })),
          };
        }),
      };
    });
  }, [cancionesFiltradas]);

  const openEntity = useMundoNavigation((s) => s.openEntity);

  const selectedPersonaje = useMemo(
    () => (section === "personajes" ? personajes.find((p) => p.id === selectedId) : null),
    [section, personajes, selectedId],
  );
  const selectedCriatura = useMemo(
    () => (section === "criaturas" ? criaturas.find((c) => c.id === selectedId) : null),
    [section, criaturas, selectedId],
  );
  const selectedItem = useMemo(
    () => (section === "items" ? items.find((i) => i.id === selectedId) : null),
    [section, items, selectedId],
  );
  const selectedReino = useMemo(
    () => (section === "reinos" ? reinos.find((r) => r.id === selectedId) : null),
    [section, reinos, selectedId],
  );
  const selectedCiudad = useMemo(
    () => (section === "ciudades" ? ciudades.find((c) => c.id === selectedId) : null),
    [section, ciudades, selectedId],
  );
  const selectedGrupo = useMemo(
    () => (section === "grupos" ? grupos.find((g) => g.id === selectedId) ?? null : null),
    [section, grupos, selectedId],
  );
  const selectedNota = useMemo(
    () => (section === "notas" ? notas.find((n) => n.id === selectedId) ?? null : null),
    [section, notas, selectedId],
  );
  const selectedCancion = useMemo(
    () => (section === "letras" ? canciones.find((c) => c.id === selectedId) ?? null : null),
    [section, canciones, selectedId],
  );

  const activeMagiaCategoria =
    section === "hechizos" ? hechizos : section === "dones" ? dones : section === "runas" ? runas : null;
  const selectedMagia = useMemo(
    () =>
      activeMagiaCategoria
        ? activeMagiaCategoria.items.find((i) => i.id === selectedId) ?? null
        : null,
    [activeMagiaCategoria, selectedId],
  );

  if (selectedMagia && activeMagiaCategoria) {
    return (
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <FormularioMagico
          key={selectedMagia.id}
          grupos={section === "runas" ? gruposRunas : gruposCriaturas}
          item={selectedMagia}
          loadingGrupos={section === "runas" ? loadingGruposRunas : loadingGrupos}
          modo={section as "hechizos" | "dones" | "runas"}
          todasLasRunas={section === "runas" ? runas.items : undefined}
          onDeleted={(id) => {
            activeMagiaCategoria.setItems((prev) => prev.filter((i) => i.id !== id));
          }}
          onSaved={(updated) => {
            activeMagiaCategoria.setItems((prev) =>
              prev.map((i) => (i.id === updated.id ? updated : i)),
            );
          }}
          onNavigateGrupo={(id) => openEntity("grupos", id)}
        />
      </div>
    );
  }

  if (selectedGrupo) {
    return (
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <EditorGrupo
          key={selectedGrupo.id}
          grupo={selectedGrupo}
          onClickMiembro={(id, tabla) => {
            const destino = TABLA_TO_SECTION[tabla];
            if (destino) openEntity(destino, id);
          }}
          onDeleted={async (id) => {
            await eliminarGrupo(id);
          }}
          onSaved={async (updated) => {
            await actualizarGrupo(updated);
          }}
        />
      </div>
    );
  }

  if (selectedCancion) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <PanelEditor
          key={selectedCancion.id}
          cancionId={selectedCancion.id}
          onNavigateCiudad={(id) => openEntity("ciudades", id)}
          onNavigateGrupo={(id) => openEntity("grupos", id)}
          onNavigatePersonaje={(id) => openEntity("personajes", id)}
          onNavigateReino={(id) => openEntity("reinos", id)}
        />
      </div>
    );
  }

  if (selectedNota) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 gap-3">
        <input
          className="w-full bg-transparent text-base font-black text-primary outline-none placeholder:text-primary/25"
          placeholder="Título de la nota…"
          value={selectedNota.titulo}
          onChange={(e) => actualizarNota({ ...selectedNota, titulo: e.target.value })}
        />
        <textarea
          className="flex-1 w-full bg-primary/[0.03] border border-primary/10 rounded-lg p-3 text-sm text-primary outline-none focus:border-primary/25 resize-none placeholder:text-primary/25"
          placeholder="Escribí acá…"
          value={selectedNota.contenido ?? ""}
          onChange={(e) => actualizarNota({ ...selectedNota, contenido: e.target.value })}
        />
        <button
          type="button"
          onClick={() => eliminarNota(selectedNota.id)}
          className="self-start text-micro font-bold uppercase tracking-[0.15em] text-red-400/60 hover:text-red-400 transition-colors"
        >
          Eliminar nota
        </button>
      </div>
    );
  }

  const selected =
    selectedPersonaje ?? selectedCriatura ?? selectedItem ?? selectedReino ?? selectedCiudad ?? null;

  if (selected) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selectedPersonaje && <PersonajeEditor personaje={selectedPersonaje} />}
        {selectedCriatura && <CriaturaEditor criatura={selectedCriatura} />}
        {selectedItem && <ItemEditor item={selectedItem} />}
        {selectedReino && <ReinoEditor reino={selectedReino} />}
        {selectedCiudad && <CiudadEditor ciudad={selectedCiudad} />}
      </div>
    );
  }

  // ── Magia (Hechizos/Dones/Runas) ──────────────────────────────────────
  // Sección propia de la navbar: tres bloques planos (MagiaPorTipo), sin
  // agrupar por criatura — esa relación fue eliminada.
  if (section === "hechizos" || section === "dones" || section === "runas") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <MagiaPorTipo
          dones={dones.items}
          hechizos={hechizos.items}
          runas={runas.items}
          loading={hechizos.loading || dones.loading || runas.loading}
          creating={hechizos.creating || dones.creating || runas.creating}
          onCreate={async (tipo) => {
            const categoria = tipo === "hechizos" ? hechizos : tipo === "dones" ? dones : runas;
            const id = await categoria.create();
            if (id) openEntity(tipo, id);
          }}
          onOpen={(section, id) => openEntity(section, id)}
          onOpenEnsayo={(id) => openEntity("notas-gos", id)}
          todasLasRunas={runas.items}
        />
      </div>
    );
  }

  // ── Letras (Canciones) ─────────────────────────────────────────────────
  // Sección propia de la navbar (antes vivía adentro de Entidades → sub-tab
  // "Canciones"). Mismo agrupamiento Idioma → Cantante → Compositor, pero
  // como página independiente.
  if (section === "letras") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowNuevaCancion(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-micro font-bold uppercase tracking-wide text-primary"
          >
            <Plus size={11} />
            Añadir
          </button>
        </div>

        {(emocionesDisponibles.length > 0 || temasDisponibles.length > 0) && (
          <div className="flex flex-wrap items-start gap-x-5 gap-y-2 mb-4 px-1">
            {emocionesDisponibles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-micro font-black uppercase tracking-widest text-primary/30">
                  Emoción
                </span>
                {emocionesDisponibles.map((e) => (
                  <Chip
                    key={e}
                    active={filtroEmocion === e}
                    onClick={() =>
                      setFiltroEmocion((prev) => (prev === e ? "" : e))
                    }
                  >
                    {e}
                  </Chip>
                ))}
              </div>
            )}
            {temasDisponibles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-micro font-black uppercase tracking-widest text-primary/30">
                  Tema
                </span>
                {temasDisponibles.map((t) => (
                  <Chip
                    key={t}
                    active={filtroTema === t}
                    onClick={() => setFiltroTema((prev) => (prev === t ? "" : t))}
                  >
                    {t}
                  </Chip>
                ))}
              </div>
            )}
            {(filtroEmocion || filtroTema) && (
              <button
                type="button"
                className="text-micro font-black uppercase tracking-widest text-primary/30 hover:text-primary/60 transition-colors"
                onClick={() => {
                  setFiltroEmocion("");
                  setFiltroTema("");
                }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>
        )}

        {loadingCanciones && canciones.length === 0 ? (
          <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
        ) : canciones.length === 0 ? (
          <div className="py-6 text-xs text-primary/25 text-center">Sin canciones todavía</div>
        ) : cancionesFiltradas.length === 0 ? (
          <div className="py-6 text-xs text-primary/25 text-center">
            Sin canciones con estos filtros
          </div>
        ) : (
          cancionesAgrupadas.map(({ idioma, cantantes }) => (
            <MundoCard key={idioma} title={idioma} Icon={Music}>
              {cantantes.map(({ cantante, compositores }) => (
                <div key={cantante} className="flex-none w-fit max-w-full">
                  <h4 className="text-micro font-semibold text-primary/35 mb-1.5 px-1">
                    {cantante}
                  </h4>
                  <div className="flex flex-row flex-wrap gap-4 items-start">
                    {compositores.map(({ compositor, canciones: cancionesGrupo }) => (
                      <div key={compositor} className="flex-none w-fit max-w-full">
                        <EntityCardGrid
                          title={compositor}
                          variant="chips"
                          items={cancionesGrupo.map((c: Cancion) => ({ id: c.id, nombre: c.titulo }))}
                          onItemClick={(id) => openEntity("letras", id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </MundoCard>
          ))
        )}

        {showNuevaCancion && (
          <ModalNuevaCancion
            onClose={() => setShowNuevaCancion(false)}
            onCreated={(c) => {
              setCanciones((prev) => [c, ...prev]);
              openEntity("letras", c.id);
            }}
          />
        )}
      </div>
    );
  }

  // ── Criaturas ────────────────────────────────────────────────────────
  // Sección propia de la navbar (antes vivía adentro de Entidades → sub-tab
  // "Criaturas"). Agrupa Items + Personajes por criatura de origen.
  if (section === "criaturas") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <MagiaJerarquica
          criaturas={criaturas}
          items={items}
          personajes={personajes}
          loading={loadingC || loadingI || loadingP}
          onCreateCriatura={async () => {
            const { data } = await addCriatura({ nombre: "Nueva criatura" });
            if (data?.id) openEntity("criaturas", data.id);
          }}
          onCreateHija={async (_tipo, criaturaId) => {
            const { data } = await addItem({
              nombre: "Nuevo objeto",
              ...(criaturaId ? { criatura_id: criaturaId } : {}),
            });
            if (data?.id) openEntity("items", data.id);
          }}
          onCreatePersonaje={async (criatura) => {
            const { data } = await addPersonaje({
              nombre: "Nuevo personaje",
              ...(criatura ? { especie: criatura.nombre } : {}),
            });
            if (data?.id) openEntity("personajes", data.id);
          }}
          onOpen={(section, id) => openEntity(section, id)}
        />
      </div>
    );
  }

  // ── Organización (Grupos + Notas) ────────────────────────────────────
  // Sección propia de la navbar (antes vivía adentro de Entidades → sub-tab
  // "Organización").
  if (section === "grupos" || section === "notas") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="flex flex-row flex-wrap gap-6 items-start">
          {(Object.entries(GRUPO_TIPO_CONFIG) as [GrupoTipo, (typeof GRUPO_TIPO_CONFIG)[GrupoTipo]][]).map(
            ([tipo, cfg]) => {
              const bloques = subtiposPorTipo[tipo] ?? [];
              if (!loadedGrupos && bloques.length === 0) {
                return (
                  <MundoCard
                    key={tipo}
                    title={cfg.labelPlural}
                    Icon={cfg.Icon}
                    fill={false}
                    onCreate={async () => {
                      const nuevo = await crearGrupo(tipo);
                      if (nuevo) openEntity("grupos", nuevo.id);
                    }}
                  >
                    <div className="w-full py-6 text-xs text-primary/30 text-center">Cargando…</div>
                  </MundoCard>
                );
              }
              if (bloques.length === 0) {
                return (
                  <MundoCard
                    key={tipo}
                    title={cfg.labelPlural}
                    Icon={cfg.Icon}
                    fill={false}
                    onCreate={async () => {
                      const nuevo = await crearGrupo(tipo);
                      if (nuevo) openEntity("grupos", nuevo.id);
                    }}
                  >
                    <div className="w-full py-6 text-xs text-primary/25 text-center">
                      Sin grupos aún
                    </div>
                  </MundoCard>
                );
              }

              return (
                <MundoCard
                  key={tipo}
                  title={cfg.labelPlural}
                  Icon={cfg.Icon}
                  fill={false}
                  onCreate={async () => {
                    const nuevo = await crearGrupo(tipo);
                    if (nuevo) openEntity("grupos", nuevo.id);
                  }}
                >
                  {bloques.map((bloque, i) => (
                    <div key={bloque.subtipo ?? `__sin-subtipo-${i}`} className="flex-none w-fit max-w-full">
                      <EntityCardGrid
                        title={bloque.subtipo ?? "Sin subtipo"}
                        variant="chips"
                        loading={!loadedGrupos}
                        items={bloque.items.map((g) => ({ id: g.id, nombre: g.nombre }))}
                        onItemClick={(id) => openEntity("grupos", id)}
                      />
                    </div>
                  ))}
                </MundoCard>
              );
            },
          )}
        </div>
        <MundoCard
          title="Notas"
          Icon={StickyNote}
          onCreate={async () => {
            const nota = await crearNota("Nueva nota");
            if (nota) openEntity("notas", nota.id);
          }}
        >
          {loadingNotas && notas.length === 0 ? (
            <div className="w-full py-6 text-xs text-primary/30 text-center">Cargando…</div>
          ) : notas.length === 0 ? (
            <div className="w-full py-6 text-xs text-primary/25 text-center">Sin notas todavía</div>
          ) : (
            notas.map((n: Nota) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openEntity("notas", n.id)}
                title={n.titulo || "Sin título"}
                className="px-2.5 py-1.5 rounded-lg border border-primary/10 bg-primary/[0.03] hover:bg-primary/10 hover:border-primary/20 transition-colors text-xs font-semibold text-primary/80 text-left truncate max-w-[220px]"
              >
                {n.titulo || "Sin título"}
              </button>
            ))
          )}
        </MundoCard>
      </div>
    );
  }

  // ── Entidades (Personajes/Items + Geografía) ─────────────────────────
  // Sin sub-tabs: Criaturas y Organización ahora son secciones propias de
  // la navbar (ver arriba), así que acá solo queda Geografía (Reinos +
  // Ciudades + Personajes).
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      <GeografiaJerarquica
        reinos={reinos}
        ciudades={ciudades}
        personajes={personajes}
        loading={loadingR || loadingCd || loadingP}
        onOpen={(section, id) => openEntity(section, id)}
        onCreateReino={async () => {
          const { data } = await addReino({ nombre: "Nuevo reino" });
          if (data?.id) openEntity("reinos", data.id);
        }}
        onCreateCiudad={async (reinoId) => {
          const { data } = await addCiudad({ nombre: "Nueva ciudad", reino_id: reinoId });
          if (data?.id) openEntity("ciudades", data.id);
        }}
        onCreatePersonaje={async (ciudadId) => {
          const { data } = await addPersonaje({
            nombre: "Nuevo personaje",
            ciudad_id: ciudadId,
          });
          if (data?.id) openEntity("personajes", data.id);
        }}
      />
    </div>
  );
}

/**
 * MundoCard
 * ───────────────────────────────────────────────────────────────────────────
 * Card "de mundo" reutilizable — mismo lenguaje visual que usan las cards de
 * Reino (GeografiaJerarquica) y Criatura (MagiaJerarquica): borde redondeado,
 * barra de título centrada con fondo tenue, y contenido libre debajo.
 * Sirve para unificar cualquier nivel de agrupación de la página (Idioma,
 * Compositor, Tipo de grupo, etc.) bajo un mismo estilo.
 */
function MundoCard({
  title,
  Icon,
  onCreate,
  creating,
  fill = true,
  children,
}: {
  title: string;
  Icon?: React.ElementType;
  onCreate?: () => void;
  creating?: boolean;
  /** Si es false, la card mide según su contenido en vez de ocupar todo el
   *  ancho — para usarla lado a lado con otras cards (como Reino/Criatura). */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-primary/10 bg-primary/[0.03] overflow-hidden ${
        fill ? "w-full mb-6 last:mb-0" : "flex-none w-fit max-w-full"
      }`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/10">
        <span />
        <div className="flex items-center gap-1.5 justify-self-center max-w-[280px]">
          {Icon && <Icon size={9} className="text-primary/70 shrink-0" />}
          <h3 className="text-micro font-bold uppercase tracking-[0.12em] text-primary/70 truncate">
            {title}
          </h3>
        </div>
        <div className="justify-self-end">
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              title="Añadir"
              className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Plus size={9} className="text-primary/60" />
            </button>
          )}
        </div>
      </div>
      <div className="p-4 flex flex-row flex-wrap gap-6 items-start">{children}</div>
    </div>
  );
}

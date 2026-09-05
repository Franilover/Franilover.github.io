"use client";

/**
 * EntidadesPage
 * ───────────────────────────────────────────────────────────────────────────
 * Combina varias páginas de "grid de tarjetas" que comparten datos/hooks:
 * Personajes + Reinos + Ciudades (Entidades/Geografía), Criaturas (Items +
 * Personajes agrupados por criatura de origen), Letras/Canciones, y Grupos
 * + Notas (Organización). Cada una es
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

import { Gem, Leaf, Mountain, Music, Plus, Sprout, StickyNote } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DescargarDatosDropdown } from "./DescargarDatosDropdown";
import { PanelEditor } from "@/domains/garlia/canciones/editor/PanelEditor";
import { ModalNuevaCancion } from "@/domains/garlia/canciones/modals/ModalNuevaCancion";
import { useCanciones } from "@/domains/garlia/canciones/useCanciones";
import type { Cancion } from "@/domains/garlia/canciones/types";
import { useGruposCriaturas } from "@/domains/garlia/grupos/useGruposCriaturas";
import { useRunas } from "@/domains/garlia/runas/useRunas";
import { RunasPage } from "@/domains/garlia/runas/RunasPage";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import type { Elemento } from "@/domains/garlia/elementos/types";
import { useNotas } from "@/editor/notas/useNotas";
import { type Nota } from "@/domains/garlia/_shared/types";
import { EditorGrupo, GRUPO_TIPO_CONFIG, useGrupos, type GrupoTipo } from "@/domains/garlia/grupos/EditorGrupo";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { supabase } from "@/infra/supabase/supabase";

import { CriaturaEditor } from "@/domains/garlia/criaturas/CriaturaEditor";
import { EcosistemaEditor } from "@/domains/garlia/biologia/EcosistemaEditor";
import { BiomaEditor } from "@/domains/garlia/biologia/BiomaEditor";
import { useEcosistemas, useEcosistemaCriaturas, useBiomas } from "@/domains/garlia/biologia/useBiologia";
import { FloraEditor } from "@/domains/garlia/flora/FloraEditor";
import { useFlora } from "@/domains/garlia/flora/useFlora";
import { MineralEditor } from "@/domains/garlia/minerales/MineralEditor";
import { useMinerales } from "@/domains/garlia/minerales/useMinerales";
import { ItemEditor } from "@/domains/garlia/items/ItemEditor";
import { PersonajeEditor } from "@garlia/personajes";
import { ReinoEditor } from "@garlia/reinos";
import { CiudadEditor } from "@garlia/ciudades";
import { EntityCardGrid } from "@/domains/garlia/_shared/EntityCardGrid";
import { GeografiaJerarquica, type GrupoPersonajeSubtipo } from "@/domains/garlia/_shared/GeografiaJerarquica";
import { GrupoFiltroBarra, GrupoFiltroDropdown, type GrupoFiltroSubtipo } from "@/domains/garlia/_shared/GrupoFiltroDropdown";
import { CriaturasJerarquica } from "@/domains/garlia/_shared/CriaturasJerarquica";
import { ItemsJerarquia } from "@/domains/garlia/_shared/ItemsJerarquia";
import { AgrupacionPersonajesDropdown } from "@/domains/garlia/_shared/AgrupacionPersonajesDropdown";
import { BuscadorInline } from "@/domains/garlia/_shared/BuscadorInline";
import { TABLA_TO_SECTION } from "@/domains/garlia/_shared/useExternalCommandBridge";
import { useMundoNavigation, type SectionKey } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { usePanelFlotante } from "@/domains/garlia/_shared/usePanelFlotanteStore";
import { useEntidadesUi } from "@/domains/garlia/_shared/useEntidadesUiStore";

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

// ─── Descarga: dataset de Criaturas (agrupación por ecosistema) ───────────
// Mismo patrón que descargarDatosElementos/descargarDatosFisica/
// descargarDatosBiologia — un solo archivo JSON autocontenido.
function descargarUtil(nombreBase: string, payload: Record<string, unknown>) {
  const blob = new Blob(
    [JSON.stringify({ exportado_en: new Date().toISOString(), ...payload }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreBase}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function descargarDatosCriaturas(datos: {
  criaturas: Criatura[];
  personajes: Personaje[];
  ecosistemas: unknown[];
  biomas: unknown[];
  flora: unknown[];
  minerales: unknown[];
}) {
  descargarUtil("criaturas", datos);
}

function descargarDatosReinos(datos: {
  reinos: Reino[];
  ciudades: Ciudad[];
  personajes: Personaje[];
}) {
  descargarUtil("reinos", datos);
}

function descargarDatosItems(datos: { items: Item[] }) {
  descargarUtil("items", datos);
}

export function EntidadesPage({ section, selectedId }: Props) {
  // ── Entidades ──────────────────────────────────────────────────────────
  const { data: personajes, loading: loadingP, addRow: addPersonaje, updateRow: updatePersonaje } =
    useSupabaseData<Personaje>("personajes");
  const { data: criaturas, loading: loadingC, addRow: addCriatura, updateRow: updateCriatura } =
    useSupabaseData<Criatura>("criaturas");
  const { data: items, loading: loadingI, addRow: addItem, updateRow: updateItem } =
    useSupabaseData<Item>("items");
  const { ecosistemas, loading: loadingEco, creating: creatingEco, crear: crearEcosistema, actualizar: actualizarEcosistema } = useEcosistemas();
  // Ruta canónica v226: pertenencia Ecosistema↔Criatura vía tabla puente,
  // ya no vive en ecosistemas.criatura_ids (columna retirada).
  const { criaturaIdsDe: criaturaIdsDeEcosistema, asignar: asignarCriaturaAEcosistemaBridge } =
    useEcosistemaCriaturas();
  const { biomas, loading: loadingBiomas, creating: creatingBiomas, crear: crearBioma, actualizar: actualizarBioma } = useBiomas();
  const { flora, loading: loadingFlora, creating: creatingFlora, crear: crearFlora } = useFlora();
  const { minerales, loading: loadingMinerales, creating: creatingMinerales, crear: crearMineral } = useMinerales();

  // ── Geografía ──────────────────────────────────────────────────────────
  const { data: reinos, loading: loadingR, addRow: addReino } =
    useSupabaseData<Reino>("reinos");
  const { data: ciudades, loading: loadingCd, addRow: addCiudad } =
    useSupabaseData<Ciudad>("ciudades");

  const { grupos: gruposCriaturas, loading: loadingGrupos } = useGruposCriaturas();

  // ── Runas ─────────────────────────────────────────────────────────────
  // Los grupos de runas ahora los carga RunasPage internamente
  // (useGruposRunas propio, junto al panel de selección inline) — ya no
  // hace falta cargarlos acá para pasárselos a un editor aparte.
  const { items: runas, setItems: setRunas, loading: loadingRunas } = useRunas();
  const [creatingRuna, setCreatingRuna] = useState(false);
  // Runa a dejar seleccionada dentro de RunasPage tras crearla — ya no
  // navegamos a un editor aparte (FormularioRuna, eliminado).
  const [runaRecienCreadaId, setRunaRecienCreadaId] = useState<string | null>(null);

  // ── Tabla Química (Elementos) ────────────────────────────────────────────
  // Vive dentro de "Magia", como tab hermana de Runas (toggle Sistema/
  // Runas/Tabla en RunasPage) — no como sección propia de navegación.
  const {
    items: elementos,
    setItems: setElementos,
    loading: loadingElementos,
  } = useElementos();
  const [creatingElemento, setCreatingElemento] = useState(false);
  const [elementoRecienCreadoId, setElementoRecienCreadoId] = useState<string | null>(null);

  async function handleCreateElemento() {
    setCreatingElemento(true);
    try {
      const siguienteNumero =
        elementos.reduce((max, e) => Math.max(max, e.numero_atomico ?? 0), 0) + 1;
      const { data, error } = await supabase
        .from("elementos")
        .insert([
          {
            nombre: "Nuevo elemento",
            simbolo: "??",
            numero_atomico: siguienteNumero,
            familia: "Inerte",
            es_noble: false,
            nucleo: {},
            media: {},
            externa: {},
          },
        ])
        .select()
        .single();
      if (error) throw error;
      setElementos((prev) => [...prev, data as Elemento]);
      setElementoRecienCreadoId((data as Elemento).id);
    } catch (e) {
      console.error("[EntidadesPage] error creando elemento:", e);
    } finally {
      setCreatingElemento(false);
    }
  }

  async function handleEliminarElemento(id: string) {
    try {
      const { error } = await supabase.from("elementos").delete().eq("id", id);
      if (error) throw error;
      setElementos((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      console.error("[EntidadesPage] error eliminando elemento:", e);
    }
  }

  // Borra varios elementos de una sola vez — usada por la selección
  // múltiple (Shift+Click) en ElementosPage, en vez de N deletes sueltos.
  async function handleEliminarVariosElementos(ids: string[]) {
    const { error } = await supabase.from("elementos").delete().in("id", ids);
    if (error) throw error;
    const idsSet = new Set(ids);
    setElementos((prev) => prev.filter((e) => !idsSet.has(e.id)));
  }

  // Inserta un lote de elementos ya parseados/validados por ElementosPage
  // (parsearArchivoElementosJSON) — mismo insert que handleCreateElemento
  // pero con varias filas a la vez, para el botón "Subir JSON".
  async function handleImportarElementos(nuevos: Omit<Elemento, "id">[]) {
    const { data, error } = await supabase.from("elementos").insert(nuevos).select();
    if (error) throw error;
    const insertados = (data ?? []) as Elemento[];
    setElementos((prev) => [...prev, ...insertados]);
    return insertados.length;
  }

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

  /** Agrupa los grupos de un tipo dado por subtipo — helper reusado para
   *  los dropdowns de la barra superior de Personajes (Reinos), Criaturas
   *  e Items. Los grupos sin subtipo caen en un bloque "Sin subtipo" al
   *  final, igual que en Organización. */
  const agruparPorSubtipo = (tipo: GrupoTipo): GrupoFiltroSubtipo[] => {
    const lista = gruposPorTipo[tipo] ?? [];
    const porSubtipo = new Map<string, typeof lista>();
    const sinSubtipo: typeof lista = [];
    for (const g of lista) {
      if (g.subtipo && g.subtipo.trim()) {
        const key = g.subtipo.trim();
        if (!porSubtipo.has(key)) porSubtipo.set(key, []);
        porSubtipo.get(key)!.push(g);
      } else {
        sinSubtipo.push(g);
      }
    }
    const bloques: GrupoFiltroSubtipo[] = Array.from(porSubtipo.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([subtipo, items]) => ({
        subtipo,
        grupos: items.map((g) => ({ id: g.id, nombre: g.nombre, miembro_ids: g.miembro_ids })),
      }));
    if (sinSubtipo.length) {
      bloques.push({
        subtipo: null,
        grupos: sinSubtipo.map((g) => ({ id: g.id, nombre: g.nombre, miembro_ids: g.miembro_ids })),
      });
    }
    return bloques;
  };

  const gruposPersonajesPorSubtipo: GrupoPersonajeSubtipo[] = useMemo(
    () => agruparPorSubtipo("personajes"),
    [gruposPorTipo],
  );
  const gruposCriaturasPorSubtipo: GrupoFiltroSubtipo[] = useMemo(
    () => agruparPorSubtipo("criaturas"),
    [gruposPorTipo],
  );
  const gruposItemsPorSubtipo: GrupoFiltroSubtipo[] = useMemo(
    () => agruparPorSubtipo("items"),
    [gruposPorTipo],
  );
  const gruposReinosPorSubtipo: GrupoFiltroSubtipo[] = useMemo(
    () => agruparPorSubtipo("reinos"),
    [gruposPorTipo],
  );

  // Agrupación activa de la vista "Personajes": por Reino (jerarquía
  // Reino→Ciudad→Personaje) o por Criatura (Criatura→Personaje). El
  // dropdown que la controla vive pegado al buscador de esa vista; al
  // cambiarla, los dropdowns de filtro por grupo debajo cambian a los
  // correspondientes (Reinos vs Criaturas) — ver más abajo.
  // Persistido en Zustand (useEntidadesUiStore) para que, si estás en
  // GeografiaJerarquica / CriaturasJerarquica / ItemsJerarquia y recargás
  // la página, se mantenga la misma vista en vez de volver a "reino".
  const agrupacionPersonajes = useEntidadesUi((s) => s.agrupacionPersonajes);
  const setAgrupacionPersonajes = useEntidadesUi((s) => s.setAgrupacionPersonajes);
  // Toggle "mostrar personajes" — al apagarlo, ambas vistas jerárquicas
  // ocultan la grilla de personajes y solo muestran la estructura de
  // arriba (Reino/Ciudad o Ecosistema/Criatura), para una vista más limpia.
  const mostrarPersonajes = useEntidadesUi((s) => s.mostrarPersonajes);
  const setMostrarPersonajes = useEntidadesUi((s) => s.setMostrarPersonajes);

  const grupoPersonajeSeleccionadoId = useEntidadesUi((s) => s.grupoPersonajeSeleccionadoId);
  const setGrupoPersonajeSeleccionadoId = useEntidadesUi((s) => s.setGrupoPersonajeSeleccionadoId);
  const grupoCriaturaSeleccionadoId = useEntidadesUi((s) => s.grupoCriaturaSeleccionadoId);
  const setGrupoCriaturaSeleccionadoId = useEntidadesUi((s) => s.setGrupoCriaturaSeleccionadoId);
  const grupoItemSeleccionadoId = useEntidadesUi((s) => s.grupoItemSeleccionadoId);
  const setGrupoItemSeleccionadoId = useEntidadesUi((s) => s.setGrupoItemSeleccionadoId);
  const grupoReinoSeleccionadoId = useEntidadesUi((s) => s.grupoReinoSeleccionadoId);
  const setGrupoReinoSeleccionadoId = useEntidadesUi((s) => s.setGrupoReinoSeleccionadoId);

  // Búsqueda por nombre — una por sección, todas filtran sobre el nombre
  // de la entidad (case/acento-insensible), combinándose (AND) con el
  // filtro de grupo activo de cada vista.
  const busquedaCriatura = useEntidadesUi((s) => s.busquedaCriatura);
  const setBusquedaCriatura = useEntidadesUi((s) => s.setBusquedaCriatura);
  const busquedaReino = useEntidadesUi((s) => s.busquedaReino);
  const setBusquedaReino = useEntidadesUi((s) => s.setBusquedaReino);
  const busquedaItem = useEntidadesUi((s) => s.busquedaItem);
  const setBusquedaItem = useEntidadesUi((s) => s.setBusquedaItem);

  // ── Canciones ─────────────────────────────────────────────────────────
  const { canciones, setCanciones, loading: loadingCanciones } = useCanciones();
  const [showNuevaCancion, setShowNuevaCancion] = useState(false);

  // Filtros por Emoción / Tema (chips, selección única por campo). Ya no
  // salen de columnas de la tabla `canciones` (esas quedaron sin usar) sino
  // de los grupos de tipo "canciones" con subtipo "Emoción" / "Tema" —
  // cada grupo es un valor posible y sus miembro_ids son las canciones que
  // caen en ese valor (ver useGrupos / grupos_mundo).
  const [filtroEmocionId, setFiltroEmocionId] = useState<string | null>(null);
  const [filtroTemaId, setFiltroTemaId] = useState<string | null>(null);
  const [busquedaCancion, setBusquedaCancion] = useState<string>("");

  const gruposEmocionCancion = useMemo(
    () =>
      grupos
        .filter((g) => g.tipo === "canciones" && g.subtipo?.trim().toLocaleLowerCase("es") === "emoción")
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [grupos],
  );
  const gruposTemaCancion = useMemo(
    () =>
      grupos
        .filter((g) => g.tipo === "canciones" && g.subtipo?.trim().toLocaleLowerCase("es") === "tema")
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [grupos],
  );

  // Sets de ids de canción para el grupo seleccionado — O(1) al filtrar.
  const idsCancionEmocionActiva = useMemo(() => {
    if (!filtroEmocionId) return null;
    const g = gruposEmocionCancion.find((g) => g.id === filtroEmocionId);
    return g ? new Set(g.miembro_ids) : new Set<string>();
  }, [filtroEmocionId, gruposEmocionCancion]);
  const idsCancionTemaActivo = useMemo(() => {
    if (!filtroTemaId) return null;
    const g = gruposTemaCancion.find((g) => g.id === filtroTemaId);
    return g ? new Set(g.miembro_ids) : new Set<string>();
  }, [filtroTemaId, gruposTemaCancion]);

  const cancionesFiltradas = useMemo(() => {
    const q = busquedaCancion.trim().toLocaleLowerCase("es");
    return canciones.filter((c) => {
      if (idsCancionEmocionActiva && !idsCancionEmocionActiva.has(c.id)) return false;
      if (idsCancionTemaActivo && !idsCancionTemaActivo.has(c.id)) return false;
      if (q) {
        const enTitulo = c.titulo?.toLocaleLowerCase("es").includes(q);
        const enCantante = c.cantante?.toLocaleLowerCase("es").includes(q);
        const enCompositor = c.compositor?.toLocaleLowerCase("es").includes(q);
        if (!enTitulo && !enCantante && !enCompositor) return false;
      }
      return true;
    });
  }, [canciones, idsCancionEmocionActiva, idsCancionTemaActivo, busquedaCancion]);

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
  const abrirPanel = usePanelFlotante((s) => s.abrir);
  const clearSelection = useMundoNavigation((s) => s.clearSelection);

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
  const selectedEcosistema = useMemo(
    () => (section === "ecosistemas" ? ecosistemas.find((e) => e.id === selectedId) ?? null : null),
    [section, ecosistemas, selectedId],
  );
  const selectedBioma = useMemo(
    () => (section === "biomas" ? biomas.find((b) => b.id === selectedId) ?? null : null),
    [section, biomas, selectedId],
  );
  const selectedFlora = useMemo(
    () => (section === "flora" ? flora.find((f) => f.id === selectedId) ?? null : null),
    [section, flora, selectedId],
  );
  const selectedMineral = useMemo(
    () => (section === "minerales" ? minerales.find((m) => m.id === selectedId) ?? null : null),
    [section, minerales, selectedId],
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
          onNavigatePersonaje={(id) => abrirPanel("personaje", id)}
          onNavigateReino={(id) => abrirPanel("reino", id)}
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
    selectedPersonaje ?? selectedCriatura ?? selectedItem ?? selectedReino ?? selectedCiudad ?? selectedBioma ?? selectedEcosistema ?? selectedFlora ?? selectedMineral ?? null;

  if (selected) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selectedPersonaje && <PersonajeEditor personaje={selectedPersonaje} />}
        {selectedCriatura && <CriaturaEditor criatura={selectedCriatura} />}
        {selectedItem && <ItemEditor item={selectedItem} />}
        {selectedReino && <ReinoEditor reino={selectedReino} />}
        {selectedCiudad && <CiudadEditor ciudad={selectedCiudad} />}
        {selectedBioma && <BiomaEditor bioma={selectedBioma} />}
        {selectedEcosistema && <EcosistemaEditor ecosistema={selectedEcosistema} />}
        {selectedFlora && (
          <FloraEditor
            key={selectedFlora.id}
            flora={selectedFlora}
            onDeleted={() => clearSelection()}
          />
        )}
        {selectedMineral && (
          <MineralEditor
            key={selectedMineral.id}
            mineral={selectedMineral}
            onDeleted={() => clearSelection()}
          />
        )}
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
        <div className="flex items-center gap-2 mb-4 px-1 flex-wrap">
          <BuscadorInline
            value={busquedaCancion}
            onChange={setBusquedaCancion}
            placeholder="Buscar por canción, cantante o compositor…"
          />
          {gruposEmocionCancion.length > 0 && (
            <GrupoFiltroDropdown
              subtipo="Emoción"
              grupos={gruposEmocionCancion}
              selectedId={filtroEmocionId}
              onSelect={setFiltroEmocionId}
              onOpenGrupo={(id) => openEntity("grupos", id)}
            />
          )}
          {gruposTemaCancion.length > 0 && (
            <GrupoFiltroDropdown
              subtipo="Tema"
              grupos={gruposTemaCancion}
              selectedId={filtroTemaId}
              onSelect={setFiltroTemaId}
              onOpenGrupo={(id) => openEntity("grupos", id)}
            />
          )}
          {(filtroEmocionId || filtroTemaId) && (
            <button
              type="button"
              className="text-micro font-black uppercase tracking-widest text-primary/30 hover:text-primary/60 transition-colors"
              onClick={() => {
                setFiltroEmocionId(null);
                setFiltroTemaId(null);
              }}
            >
              ✕ Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowNuevaCancion(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-micro font-bold uppercase tracking-wide text-primary"
          >
            <Plus size={11} />
            Añadir
          </button>
        </div>

        {loadingCanciones && canciones.length === 0 ? (
          <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
        ) : canciones.length === 0 ? (
          <div className="py-6 text-xs text-primary/25 text-center">Sin canciones todavía</div>
        ) : cancionesFiltradas.length === 0 ? (
          <div className="py-6 text-xs text-primary/25 text-center">
            {busquedaCancion
              ? `Sin resultados para "${busquedaCancion}"`
              : "Sin canciones con estos filtros"}
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

  // ── Runas ────────────────────────────────────────────────────────────
  if (section === "runas") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <RunasPage
          creating={creatingRuna}
          loading={loadingRunas}
          runas={runas}
          todasLasRunas={runas}
          seleccionarRunaId={runaRecienCreadaId}
          onActualizarRuna={(id, cambios) =>
            setRunas((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)))
          }
          onOpenEnsayo={(id) => openEntity("notas-gos", id)}
          onCreate={async () => {
            setCreatingRuna(true);
            try {
              const { data, error } = await supabase
                .from("runas")
                .insert([{ nombre: "Nueva runa" }])
                .select()
                .single();
              if (error) throw error;
              setRunas((prev) => [...prev, data]);
              setRunaRecienCreadaId(data.id);
            } catch (e) {
              console.error("[EntidadesPage] error creando runa:", e);
            } finally {
              setCreatingRuna(false);
            }
          }}
          onOpen={(section, id) => openEntity(section, id)}
          elementos={elementos}
          loadingElementos={loadingElementos}
          creatingElemento={creatingElemento}
          onCreateElemento={handleCreateElemento}
          onActualizarElemento={(id, cambios) =>
            setElementos((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambios } : e)))
          }
          onEliminarElemento={handleEliminarElemento}
          seleccionarElementoId={elementoRecienCreadoId}
          onImportarElementos={handleImportarElementos}
          onEliminarVariosElementos={handleEliminarVariosElementos}
        />
      </div>
    );
  }

  // ── Flora ────────────────────────────────────────────────────────
  // Sección propia de la navbar, dentro de Entidades como Criaturas.
  // Grid simple sin agrupación (mismo molde que Items).
  if (section === "flora") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <EntityCardGrid
          Icon={Leaf}
          title="Flora"
          section="flora"
          variant="grid"
          loading={loadingFlora}
          creating={creatingFlora}
          items={flora.map((f) => ({
            id: f.id,
            nombre: f.nombre,
            imageUrl: f.imagen_url || undefined,
          }))}
          onItemClick={(id) => openEntity("flora", id)}
          onCreate={async () => {
            const nueva = await crearFlora("Nueva planta");
            if (nueva?.id) openEntity("flora", nueva.id);
          }}
        />
      </div>
    );
  }

  // ── Minerales ────────────────────────────────────────────────────
  // Sección propia de la navbar, dentro de Entidades como Criaturas.
  // Grid simple sin agrupación (mismo molde que Items/Flora).
  if (section === "minerales") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <EntityCardGrid
          Icon={Gem}
          title="Minerales"
          section="minerales"
          variant="grid"
          loading={loadingMinerales}
          creating={creatingMinerales}
          items={minerales.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            imageUrl: m.imagen_url || undefined,
          }))}
          onItemClick={(id) => openEntity("minerales", id)}
          onCreate={async () => {
            const nuevo = await crearMineral("Nuevo mineral");
            if (nuevo?.id) openEntity("minerales", nuevo.id);
          }}
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
        <div
          className="grid gap-6 items-start"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {(Object.entries(GRUPO_TIPO_CONFIG) as [GrupoTipo, (typeof GRUPO_TIPO_CONFIG)[GrupoTipo]][]).map(
            ([tipo, cfg]) => {
              const bloques = subtiposPorTipo[tipo] ?? [];
              if (!loadedGrupos && bloques.length === 0) {
                return (
                  <MundoCard
                    key={tipo}
                    title={cfg.labelPlural}
                    Icon={cfg.Icon}
                    className="w-full"
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
                    className="w-full"
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
                  className="w-full"
                  onCreate={async () => {
                    const nuevo = await crearGrupo(tipo);
                    if (nuevo) openEntity("grupos", nuevo.id);
                  }}
                >
                  {bloques.map((bloque, i) => (
                    <div key={bloque.subtipo ?? `__sin-subtipo-${i}`} className="flex-none w-fit max-w-full">
                      <div className="flex items-center gap-1 max-w-full">
                        <span
                          title={bloque.subtipo ?? "Sin subtipo"}
                          className="px-2.5 py-0.5 rounded-full text-micro font-bold tracking-wide truncate bg-accent/10 text-accent/80 border border-accent/15"
                        >
                          {bloque.subtipo ?? "Sin subtipo"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {bloque.items.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => openEntity("grupos", g.id)}
                            title={g.nombre}
                            className="px-2.5 py-1.5 rounded-lg border border-primary/10 bg-primary/[0.03] hover:bg-primary/10 hover:border-primary/20 transition-colors text-xs font-semibold text-primary/80 text-left truncate max-w-[220px]"
                          >
                            {g.nombre}
                          </button>
                        ))}
                      </div>
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

  // ── Entidades (Personajes + Geografía/Criaturas + Items) ─────────────
  // Sin sub-tabs: Organización ahora es sección propia de la navbar.
  // "Personajes" absorbe también la vista antes llamada "Criaturas", y el
  // dropdown de agrupación (junto al buscador) tiene una 3ra opción "Items"
  // que reemplazó a la sección propia "Items" que antes vivía en la navbar
  // (ver AgrupacionPersonajesDropdown): alterna entre agrupar por Reino
  // (GeografiaJerarquica), por Criatura (CriaturasJerarquica) o mostrar
  // Items en un grid plano (ItemsJerarquia, sin relación a Personajes ni
  // agrupación alguna — junto con Flora y Minerales, también planos), y
  // los dropdowns de filtro por grupo debajo cambian según cuál esté
  // activa.
  const agrupacionSelector = (
    <div className="flex items-center gap-1.5">
      <AgrupacionPersonajesDropdown value={agrupacionPersonajes} onChange={setAgrupacionPersonajes} />
      {agrupacionPersonajes !== "items" && (
        <button
          type="button"
          onClick={() => setMostrarPersonajes((v) => !v)}
          title={
            agrupacionPersonajes === "criatura"
              ? mostrarPersonajes
                ? "Ver por ecosistema (criaturas, flora y minerales)"
                : "Ver por especie (personajes agrupados por criatura)"
              : mostrarPersonajes
                ? "Ver por bioma y ecosistema (reinos)"
                : "Ver por reino (ciudades y personajes)"
          }
          aria-pressed={mostrarPersonajes}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-colors ${
            mostrarPersonajes
              ? "bg-accent/10 border-accent/20 text-accent/80"
              : "bg-primary/[0.04] border-primary/10 text-primary/40 hover:bg-primary/10"
          }`}
        >
          {mostrarPersonajes ? <Mountain size={12} /> : <Sprout size={12} />}
        </button>
      )}
    </div>
  );

  // Ícono compartido de descarga (Items / Criaturas / Personajes), se ubica
  // pegado a la izquierda del botón "Añadir" en las 3 vistas jerárquicas.
  const descargarDatosBoton = (
    <DescargarDatosDropdown
      onDescargarItems={() => descargarDatosItems({ items })}
      onDescargarCriaturas={() =>
        descargarDatosCriaturas({ criaturas, personajes, ecosistemas, biomas, flora, minerales })
      }
      onDescargarPersonajes={() => descargarDatosReinos({ reinos, ciudades, personajes })}
    />
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      {agrupacionPersonajes === "items" ? (
        <ItemsJerarquia
          items={items}
          loading={loadingI}
          onCreate={async () => {
            const { data } = await addItem({ nombre: "Nuevo objeto" });
            if (data?.id) openEntity("items", data.id);
          }}
          onMoverItem={(itemId, categoria) => void updateItem(itemId, { categoria: categoria ?? undefined })}
          flora={flora}
          loadingFlora={loadingFlora}
          minerales={minerales}
          loadingMinerales={loadingMinerales}
          ecosistemas={ecosistemas}
          loadingEcosistemas={loadingEco}
          onOpenEcosistema={(id) => openEntity("ecosistemas", id)}
          criaturas={criaturas}
          loadingCriaturas={loadingC}
          gruposItemsPorSubtipo={gruposItemsPorSubtipo}
          grupoSeleccionadoId={grupoItemSeleccionadoId}
          onSeleccionarGrupo={setGrupoItemSeleccionadoId}
          onOpenGrupo={(id) => openEntity("grupos", id)}
          busqueda={busquedaItem}
          onBusquedaChange={setBusquedaItem}
          agrupacionSelector={agrupacionSelector}
          descargarDatosBoton={descargarDatosBoton}
        />
      ) : agrupacionPersonajes === "criatura" ? (
        <CriaturasJerarquica
          criaturas={criaturas}
          personajes={personajes}
          ecosistemas={ecosistemas}
          criaturaIdsDeEcosistema={criaturaIdsDeEcosistema}
          biomas={biomas}
          flora={flora}
          minerales={minerales}
          mostrarPersonajes={mostrarPersonajes}
          loading={loadingC || loadingP || loadingEco || loadingBiomas}
          gruposCriaturasPorSubtipo={gruposCriaturasPorSubtipo}
          grupoSeleccionadoId={grupoCriaturaSeleccionadoId}
          onSeleccionarGrupo={setGrupoCriaturaSeleccionadoId}
          onOpenGrupo={(id) => openEntity("grupos", id)}
          onSelectCancion={(id) => openEntity("letras", id)}
          onNavigateCapitulo={(id) => openEntity("capitulos", id)}
          onUpdatePersonaje={(id, patch) => void updatePersonaje(id, patch)}
          onSelectGrupo={(id) => openEntity("grupos", id)}
          onNavigateReino={(id) => abrirPanel("reino", id)}
          onUpdateCriatura={(id, patch) => void updateCriatura(id, patch)}
          busqueda={busquedaCriatura}
          onBusquedaChange={setBusquedaCriatura}
          agrupacionSelector={agrupacionSelector}
          descargarDatosBoton={descargarDatosBoton}
          onCreateCriatura={async () => {
            const { data } = await addCriatura({ nombre: "Nueva criatura" });
            if (data?.id) openEntity("criaturas", data.id);
          }}
          creatingEcosistema={creatingEco}
          onCreateEcosistema={async () => {
            const nuevo = await crearEcosistema("Nuevo ecosistema");
            return nuevo?.id ?? null;
          }}
          creatingBioma={creatingBiomas}
          onCreateBioma={async () => {
            const nuevo = await crearBioma("Nuevo bioma");
            return nuevo?.id ?? null;
          }}
          creatingFlora={creatingFlora}
          onCreateFlora={async () => {
            const nueva = await crearFlora("Nueva planta");
            if (nueva?.id) openEntity("flora", nueva.id);
          }}
          creatingMineral={creatingMinerales}
          onCreateMineral={async () => {
            const nuevo = await crearMineral("Nuevo mineral");
            if (nuevo?.id) openEntity("minerales", nuevo.id);
          }}
          onCreatePersonaje={async (criatura) => {
            const { data } = await addPersonaje({
              nombre: "Nuevo personaje",
              ...(criatura ? { especie: criatura.nombre } : {}),
            });
            if (data?.id) abrirPanel("personaje", data.id);
          }}
          onAsignarCriaturaAEcosistema={async (criaturaId, ecosistemaId) => {
            await asignarCriaturaAEcosistemaBridge(criaturaId, ecosistemaId);
          }}
          onAsignarEcosistemaABioma={async (ecosistemaId, biomaId) => {
            await actualizarEcosistema(ecosistemaId, { bioma_id: biomaId || null });
          }}
          onMoverPersonaje={async (personajeId, criaturaNombre) => {
            await updatePersonaje(personajeId, { especie: criaturaNombre ?? undefined });
          }}
          onOpen={(section, id) => openEntity(section, id)}
        />
      ) : (
        <GeografiaJerarquica
          reinos={reinos}
          ciudades={ciudades}
          personajes={personajes}
          biomas={biomas}
          mostrarPersonajes={mostrarPersonajes}
          loading={loadingR || loadingCd || loadingP || loadingBiomas}
          onOpen={(section, id) => openEntity(section, id)}
          gruposPersonajesPorSubtipo={gruposPersonajesPorSubtipo}
          grupoSeleccionadoId={grupoPersonajeSeleccionadoId}
          onSeleccionarGrupo={setGrupoPersonajeSeleccionadoId}
          gruposReinosPorSubtipo={gruposReinosPorSubtipo}
          grupoReinoSeleccionadoId={grupoReinoSeleccionadoId}
          onSeleccionarGrupoReino={setGrupoReinoSeleccionadoId}
          onOpenGrupo={(id) => openEntity("grupos", id)}
          onSelectCancion={(id) => openEntity("letras", id)}
          onNavigateCapitulo={(id) => openEntity("capitulos", id)}
          onUpdatePersonaje={(id, patch) => void updatePersonaje(id, patch)}
          busqueda={busquedaReino}
          onBusquedaChange={setBusquedaReino}
          agrupacionSelector={agrupacionSelector}
          descargarDatosBoton={descargarDatosBoton}
          onCreateReino={async () => {
            const { data } = await addReino({ nombre: "Nuevo reino" });
            if (data?.id) abrirPanel("reino", data.id);
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
            if (data?.id) abrirPanel("personaje", data.id);
          }}
          onAsignarReinoABioma={async (reinoId, biomaId) => {
            const bioma = biomas.find((b) => b.id === biomaId);
            if (!bioma || bioma.reino_ids.includes(reinoId)) return;
            await actualizarBioma(bioma.id, { reino_ids: [...bioma.reino_ids, reinoId] });
          }}
          onMoverPersonaje={async (personajeId, ciudadId, reinoNombre) => {
            await updatePersonaje(personajeId, {
              ciudad_id: ciudadId,
              ...(ciudadId === null ? { reino: reinoNombre ?? undefined } : {}),
            });
          }}
        />
      )}
    </div>
  );
}

/**
 * MundoCard
 * ───────────────────────────────────────────────────────────────────────────
 * Card "de mundo" reutilizable — mismo lenguaje visual que usan las cards de
 * Reino (GeografiaJerarquica) y Criatura (CriaturasJerarquica): borde redondeado
 * sutil, título centrado y en negrita sobre el borde superior (sin barra de
 * fondo), y contenido libre debajo. Sirve para unificar cualquier nivel de
 * agrupación de la página (Idioma, Compositor, Tipo de grupo, etc.) bajo un
 * mismo estilo.
 */
function MundoCard({
  title,
  Icon,
  onCreate,
  creating,
  fill = true,
  className,
  children,
}: {
  title: string;
  Icon?: React.ElementType;
  onCreate?: () => void;
  creating?: boolean;
  /** Si es false, la card mide según su contenido en vez de ocupar todo el
   *  ancho — para usarla lado a lado con otras cards (como Reino/Criatura). */
  fill?: boolean;
  /** Clases extra para sobrescribir el ancho por defecto — p.ej. forzar
   *  "w-full" cuando la card vive dentro de una celda de grid (auto-fill),
   *  sin afectar los demás usos de MundoCard con fill=false. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-primary/10 overflow-hidden ${
        className ?? (fill ? "w-full mb-6 last:mb-0" : "flex-none w-fit max-w-full")
      }`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 py-3">
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
      <div className="px-3 pb-3 flex flex-row flex-wrap gap-6 items-start">{children}</div>
    </div>
  );
}

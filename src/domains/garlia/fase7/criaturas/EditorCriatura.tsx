"use client";

/**
 * EditorCriatura.tsx
 * ───────────────────
 * View principal del editor de criaturas. Solo orquesta:
 * conecta hooks con componentes, no contiene lógica de dominio.
 *
 * Componentes extraídos a components/criaturas/:
 *   PickerImagenCriaturaBtn  → botón mobile de imagen
 *   BloqueGrupoCategoria     → selector de grupo por subtipo (Clasificación)
 *
 * Hooks extraídos a components/criaturas/:
 *   usePersonajesDeCriatura  → personajes de la especie + toggle
 *   useCriaturaAsideCatalogs → catálogos globales del aside
 *
 * Ruta destino:
 *   src/features/editorGarlia/views/EditorCriatura.tsx
 */

import {
  Atom,
  Bug,
  Brain,
  Dices,
  Globe,
  Image as ImageIcon,
  Layers,
  MapPin,
  Package,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags,
  UserCircle2,
  Users,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";

import {
  useMobileAsidePanel,
  useRegisterMobileAside,
} from "@/hooks/ui/useMobileAsidePanel";

import type { WikiEntity } from "@/ui/Markdown/commandItems";
import { RichEditor } from "@/editor/lexical";
import { SeccionEntidad } from "@/ui/SeccionEntidad";
import {
  BloqueGrupoCategoria,
  type GrupoMinExt,
} from "@/domains/garlia/criaturas/BloqueGruposCriatura";
import { BloqueSubsistemaMagicoCriatura } from "@/domains/garlia/criaturas/BloqueSubsistemaMagicoCriatura";
import {
  useCriaturaReinos,
  useCriaturaCiudades,
} from "@/domains/garlia/criaturas/CriaturaHabitat";
import { useCraftedItems } from "@/domains/garlia/criaturas/CriaturaItemsCraftedos";
import { CriaturaStatsDndEditor } from "@/domains/garlia/criaturas/CriaturaStatsDnd";
import { PickerImagenCriaturaBtn } from "@/domains/garlia/criaturas/PickerImagenCriaturaBtn";
import {
  SelectorImagen,
} from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import { useCriaturaAsideCatalogs } from "@/domains/garlia/criaturas/useCriaturaAsideCatalogs";
import { useCriaturaOrganos } from "@/domains/garlia/criaturas/useCriaturaOrganos";
import { useMembresiaSubsistemaCriatura } from "@/domains/garlia/criaturas/useMembresiaSubsistemaCriatura";
import { usePersonajesDeCriatura } from "@/domains/garlia/criaturas/usePersonajesDeCriatura";
import { useMembresiaGruposCriatura } from "@/domains/garlia/grupos/useMembresiaGruposCriatura";
import { PanelPerfilCriatura } from "@/domains/garlia/biologia/PerfilAtomicoCriaturaPanel";
import { SeccionGruposVinculados } from "@/domains/garlia/_shared/SeccionGruposVinculados";
import { GrupoCompuestoPanelFlotante } from "@/domains/garlia/elementos/GruposCompuestosPage";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import { useCompuestosConElementos } from "@/domains/garlia/elementos/useCompuestosConElementos";
import { useCelulas } from "@/domains/garlia/elementos/useCelulas";
import { useTejidos } from "@/domains/garlia/elementos/useTejidos";
import { PanelEditorCelula, PanelEditorTejido } from "@/domains/garlia/biologia/CatalogoTejidosBiologia";
import { useOrganos } from "@/domains/garlia/elementos/useOrganos";
import { usePerfilesAtomicosCriatura } from "@/domains/garlia/biologia/useBiologia";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import type { Organo } from "@/domains/garlia/elementos/types";
import { useOris } from "@/domains/garlia/fisica/useFisica";
import { supabase } from "@/infra/supabase/supabase";
import { dexiePut, dexieDelete } from "@/lib/utils/dexieHelpers";

import { type Criatura } from "@/domains/garlia/criaturas/types";
import { type SaveStatus } from "@/ui/saveStatus";

// ─── EditorCriatura ───────────────────────────────────────────────────────────
export function EditorCriatura({
  item,
  onSaved,
  onDeleted,
  entities = [],
  onSelectItem,
  onSelectPersonaje,
  onSelectGrupo,
  onSelectSubsistema,
  onNavigateCiudad,
  onNavigateReino,
  onHeaderControlsChange,
}: {
  item: Criatura;
  onSaved: (c: Criatura) => void;
  onDeleted: (id: string) => void;
  entities?: WikiEntity[];
  onSelectItem?: (itemId: string) => void;
  onSelectPersonaje?: (personajeId: string) => void;
  onSelectGrupo?: (grupoId: string) => void;
  onSelectSubsistema?: (subsistemaId: string) => void;
  onNavigateCiudad?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const [form, setForm] = useState<Criatura>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [showModalDnd, setShowModalDnd] = useState(false);
  const [panelActivo, setPanelActivo] = useState<
    "clasificacion" | "ilustraciones" | "perfilAtomico" | "organos" | null
  >(null);
  const { onWikilink } = useWikilink();

  // ── Grupos ────────────────────────────────────────────────────────────────
  const {
    grupos: gruposActuales,
    todosGrupos,
    addToGrupo,
    removeFromGrupo,
  } = useMembresiaGruposCriatura(form.id);

  // ── Subsistema mágico ────────────────────────────────────────────────────
  const {
    subsistemaActual,
    todosSubsistemas,
    setSubsistema,
  } = useMembresiaSubsistemaCriatura(form.id);

  // ── Personajes de la especie ───────────────────────────────────────────────
  const {
    personajes: personajesDeEspecie,
    loading: loadingPersonajes,
    saving: savingPersonajes,
    toggle: togglePersonaje,
  } = usePersonajesDeCriatura(form.id, item.nombre);

  // ── Perfil atómico (Biología) ────────────────────────────────────────────
  // Mismo panel que antes vivía en su propia sub-tab de Biología —
  // reusado tal cual acá para manejar todo desde el editor de criatura.
  const { items: elementosPerfil, loading: loadingElementosPerfil } = useElementos();
  const { items: orisPerfil, loading: loadingOrisPerfil } = useOris();
  const {
    loading: loadingPerfilesAtomicos,
    obtenerOCrear: obtenerOCrearPerfil,
    actualizar: actualizarPerfil,
  } = usePerfilesAtomicosCriatura();
  const orisDisponiblesPerfil = useMemo(
    () => (orisPerfil ?? []).map((o) => ({ id: o.id, nombre: o.nombre })),
    [orisPerfil],
  );

  // ── Órganos (composición macro, ensamblaje de compuestos) ────────────────
  // Catálogo real "organos" — compartido con Órganos de Flora (tabla propia,
  // separada de "formaciones" que usan Minerales/Items). Distinto del
  // Perfil atómico de arriba, que es composición directa por elemento
  // (nivel micro). La fórmula del Órgano vive vía Tejidos/Células (ver
  // useOrganoTejidos), no como columna inline.
  const [editandoGrupoId, setEditandoGrupoId] = useState<string | null>(null);
  const { items: compuestosOrganos, setItems: setCompuestosOrganos } = useCompuestosConElementos();
  const { items: catalogoOrganos, setItems: setCatalogoOrganos } = useOrganos();
  const organosCriatura = useCriaturaOrganos(form.id, catalogoOrganos);
  // Panel de la Célula abierto al clickear "hecho de: [Célula]" en la fila
  // de fórmula de un Tejido (Órgano→Tejido→Célula→Compuesto). Ver misma
  // nota en MineralEditor.tsx/EditorItem.tsx (su espejo Grano).
  const [editandoCelulaId, setEditandoCelulaId] = useState<string | null>(null);
  const celulasCatalogo = useCelulas();
  // Panel del Tejido abierto desde "Célula → Tejido" dentro de
  // PanelEditorCelula (ver onAbrirTejido abajo) — mismo patrón que
  // editandoCelulaId/editandoGrupoId.
  const [editandoTejidoId, setEditandoTejidoId] = useState<string | null>(null);
  const tejidosCatalogo = useTejidos();

  // Click en un Compuesto (desde el panel de Órgano o desde el de Célula)
  // abre acá su editor completo — mismo patrón que FloraEditor.tsx.
  const [editandoCompuestoId, setEditandoCompuestoId] = useState<string | null>(null);

  function onOrganoActualizadoLocal(id: string, updates: Partial<Organo>) {
    setCatalogoOrganos((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  }

  async function persistirOrgano(id: string, cambios: Partial<Organo>) {
    onOrganoActualizadoLocal(id, cambios);
    await organosCriatura.actualizarOrgano(id, cambios);
  }

  // ── Catálogos del aside ────────────────────────────────────────────────────
  const { allPersonajes, allReinos, allCiudades } = useCriaturaAsideCatalogs();

  // ── Relaciones del aside ───────────────────────────────────────────────────
  const {
    rows: reinoRows,
    loading: loadingReinos,
    add: addReinoSidebar,
    remove: removeReinoSidebar,
  } = useCriaturaReinos(form.id);

  const {
    rows: ciudadRows,
    loading: loadingCiudades,
    add: addCiudadSidebar,
    remove: removeCiudadSidebar,
  } = useCriaturaCiudades(form.id);

  const {
    items: craftedItems,
    allItems: allCraftedItems,
    loading: loadingCrafted,
    add: addCraftedSidebar,
    remove: removeCraftedSidebar,
  } = useCraftedItems(form.id);

  const [savingReinos, setSavingReinos] = useState(false);
  const [savingCiudades, setSavingCiudades] = useState(false);
  const [savingCrafted, setSavingCrafted] = useState(false);
  useRegisterMobileAside();
  const mobileAsideOpen = useMobileAsidePanel((s) => s.open);
  const closeMobileAside = useMobileAsidePanel((s) => s.close);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const reinosSeleccionadosIds = reinoRows.map((r) => r.reinoId);
  const ciudadesConReino = useMemo(
    () =>
      allCiudades.filter(
        (l: { id: string; nombre: string; reino_id: string | null }) =>
          l.reino_id !== null &&
          (reinosSeleccionadosIds.length === 0 ||
            reinosSeleccionadosIds.includes(l.reino_id)),
      ),
    [allCiudades, reinosSeleccionadosIds],
  );

  // ── Sincronizar form cuando cambia el item externo ────────────────────────
  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const field =
    (k: keyof Criatura) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setStatus("saving");
    try {
      const { error } = await supabase
        .from("criaturas")
        .update({
          nombre: form.nombre,
          imagen_url: form.imagen_url || null,
          descripcion: form.descripcion,
          descripcion_dnd: form.descripcion_dnd || null,
          stats_dnd: form.stats_dnd || null,
        })
        .eq("id", form.id);
      if (error) throw error;
      setStatus("saved");
      onSaved(form);
      void dexiePut("criaturas", form);
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  // Confirmación inline en el header compartido — ver EditorHeaderBar.
  const del = async () => {
    await supabase.from("criaturas").delete().eq("id", form.id);
    void dexieDelete("criaturas", form.id);
    onDeleted(form.id);
  };

  const handleTogglePersonaje = (id: string, add: boolean) =>
    togglePersonaje(id, add, form.nombre, allPersonajes);

  const handleToggleReino = async (id: string, add: boolean) => {
    setSavingReinos(true);
    const reino = allReinos.find((r) => r.id === id);
    if (add && reino) await addReinoSidebar(reino);
    else {
      const row = reinoRows.find((r) => r.reinoId === id);
      if (row) await removeReinoSidebar(row.rowId);
    }
    setSavingReinos(false);
  };

  const handleToggleCiudad = async (id: string, add: boolean) => {
    setSavingCiudades(true);
    if (add) {
      const ciudad = allCiudades.find((l) => l.id === id);
      if (ciudad) await addCiudadSidebar(ciudad);
    } else {
      const row = ciudadRows.find((r) => r.ciudadId === id);
      if (row) await removeCiudadSidebar(row.rowId);
    }
    setSavingCiudades(false);
  };

  const handleToggleCrafted = async (id: string, add: boolean) => {
    setSavingCrafted(true);
    if (add) {
      const it = allCraftedItems.find((i) => i.id === id);
      if (it) await addCraftedSidebar(it);
    } else {
      const crafted = craftedItems.find((i) => i.itemId === id);
      if (crafted) await removeCraftedSidebar(crafted.crafterId);
    }
    setSavingCrafted(false);
  };

  // Los cuatro toggles de panel (Clasificación/Ilustraciones/Perfil
  // atómico/Órganos) + el dado D&D son específicos de Criatura, así que
  // viajan juntos como "extra" dentro de los controles de header.
  const extraBotonesHeader = (
    <>
      <button
        className={`shrink-0 flex items-center gap-1 px-2 h-7 rounded-lg border text-micro font-black uppercase tracking-widest transition-all ${
          panelActivo === "clasificacion"
            ? "border-primary/40 text-primary bg-primary/8"
            : "border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
        }`}
        title="Clasificación"
        type="button"
        onClick={() =>
          setPanelActivo((p) => (p === "clasificacion" ? null : "clasificacion"))
        }
      >
        <Tags size={11} />
        <span className="hidden md:inline">Clasificación</span>
      </button>

      <button
        className={`shrink-0 flex items-center gap-1 px-2 h-7 rounded-lg border text-micro font-black uppercase tracking-widest transition-all ${
          panelActivo === "ilustraciones"
            ? "border-primary/40 text-primary bg-primary/8"
            : "border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
        }`}
        title="Ilustraciones"
        type="button"
        onClick={() =>
          setPanelActivo((p) => (p === "ilustraciones" ? null : "ilustraciones"))
        }
      >
        <ImageIcon size={11} />
        <span className="hidden md:inline">Ilustraciones</span>
      </button>

      <button
        className={`shrink-0 flex items-center gap-1 px-2 h-7 rounded-lg border text-micro font-black uppercase tracking-widest transition-all ${
          panelActivo === "perfilAtomico"
            ? "border-primary/40 text-primary bg-primary/8"
            : "border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
        }`}
        title="Perfil atómico"
        type="button"
        onClick={() =>
          setPanelActivo((p) => (p === "perfilAtomico" ? null : "perfilAtomico"))
        }
      >
        <Atom size={11} />
        <span className="hidden md:inline">Perfil atómico</span>
      </button>

      <button
        className={`shrink-0 flex items-center gap-1 px-2 h-7 rounded-lg border text-micro font-black uppercase tracking-widest transition-all ${
          panelActivo === "organos"
            ? "border-primary/40 text-primary bg-primary/8"
            : "border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
        }`}
        title="Órganos"
        type="button"
        onClick={() =>
          setPanelActivo((p) => (p === "organos" ? null : "organos"))
        }
      >
        <Layers size={11} />
        <span className="hidden md:inline">Órganos</span>
      </button>

      <button
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all"
        title="Reglas D&D 2024"
        type="button"
        onClick={() => setShowModalDnd(true)}
      >
        <Dices size={13} />
      </button>
    </>
  );

  const headerControls = {
    imagenUrl: form.imagen_url,
    IconoFallback: Bug,
    nombre: form.nombre ?? "",
    placeholderNombre: "Nombre de la criatura",
    onChangeNombre: (nombre: string) => setForm((f) => ({ ...f, nombre })),
    status,
    onGuardar: save,
    onEliminar: del,
    extra: extraBotonesHeader,
  };
  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden relative">
      {/* ── CONTENIDO PRINCIPAL ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

        {/* ── Contenido superior ───────────────────────────────────────────── */}
        <div
          className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Imagen + Descripción + Panel lateral (Clasificación / Ilustraciones) */}
          <div className="flex gap-3 items-start">
            {/* Imagen + Descripción: se "empujan" (comprimen) cuando hay panel activo */}
            <div
              className={`flex gap-3 min-w-0 transition-all duration-200 ${
                panelActivo ? "flex-1 basis-0" : "flex-1"
              }`}
            >
              <div className="hidden sm:block shrink-0 w-36">
                <SelectorImagen
                  aspect="square"
                  label=""
                  placeholder={<Bug className="opacity-20" size={20} />}
                  value={form.imagen_url ?? ""}
                  onChange={(url) =>
                    setForm((f) => ({ ...f, imagen_url: url }))
                  }
                />
              </div>
              <div className="sm:hidden shrink-0 relative w-24 h-24 rounded-xl overflow-hidden border border-primary/10 bg-primary/3">
                {form.imagen_url ? (
                  <Image
                    alt={form.nombre}
                    className="w-full h-full object-cover"
                    src={form.imagen_url}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Bug className="text-primary/15" size={32} />
                  </div>
                )}
                <div className="absolute top-1.5 right-1.5 z-10">
                  <PickerImagenCriaturaBtn
                    value={form.imagen_url ?? ""}
                    onChange={(url) =>
                      setForm((f) => ({ ...f, imagen_url: url }))
                    }
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
                  Descripción
                </label>
                <RichEditor
                  minHeight="8rem"
                  placeholder="Aspecto físico general…"
                  value={form.descripcion ?? ""}
                  wikiEntities={entities}
                  onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
                  onWikilinkNavigate={onWikilink}
                />
              </div>
            </div>

            {/* Panel lateral: Clasificación o Ilustraciones, según el botón activo */}
            {panelActivo && (
              <div
                className="flex-1 basis-0 min-w-0 rounded-xl p-2.5 animate-[popIn_160ms_cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 2%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
                }}
              >
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <p className="text-[7.5px] font-black uppercase tracking-[0.28em] text-primary/25">
                    {panelActivo === "clasificacion"
                      ? "Clasificación"
                      : panelActivo === "ilustraciones"
                        ? "Ilustraciones"
                        : panelActivo === "organos"
                          ? "Órganos"
                          : "Perfil atómico"}
                  </p>
                  <button
                    className="text-primary/25 hover:text-primary transition-colors"
                    type="button"
                    onClick={() => setPanelActivo(null)}
                  >
                    <X size={11} />
                  </button>
                </div>

                {panelActivo === "clasificacion" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { label: "Hábitat", subtipo: "Hábitat", icon: Globe },
                        {
                          label: "Inteligencia",
                          subtipo: "Inteligencia",
                          icon: Brain,
                        },
                        { label: "Alma", subtipo: "Alma", icon: Wand2 },
                        {
                          label: "Usar Mana",
                          subtipo: "Usar Mana",
                          icon: Sparkles,
                        },
                        {
                          label: "Produce Mana",
                          subtipo: "Produce Mana",
                          icon: Star,
                        },
                      ] as const
                    ).map(({ label, subtipo, icon }) => (
                      <div key={subtipo} className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/30 mb-0.5">
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
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/30 mb-0.5">
                        <Atom size={7} /> Subsistema Mágico
                      </span>
                      <BloqueSubsistemaMagicoCriatura
                        subsistemaActual={subsistemaActual}
                        todosSubsistemas={todosSubsistemas}
                        onChange={setSubsistema}
                        onSelectSubsistema={onSelectSubsistema}
                      />
                    </div>
                  </div>
                ) : panelActivo === "ilustraciones" ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-micro text-primary/35 leading-relaxed px-0.5">
                      Referencias visuales de la criatura (concept art, poses,
                      variantes…).
                    </p>
                    <div className="w-full max-w-[220px]">
                      <SelectorImagen
                        aspect="square"
                        label="Ilustración principal"
                        placeholder={
                          <ImageIcon className="opacity-20" size={20} />
                        }
                        value={form.imagen_url ?? ""}
                        onChange={(url) =>
                          setForm((f) => ({ ...f, imagen_url: url }))
                        }
                      />
                    </div>
                  </div>
                ) : panelActivo === "organos" ? (
                  <SeccionGruposVinculados
                    titulo="Órganos"
                    descripcion="Ensamblaje de compuestos de la criatura — mismo catálogo que Formaciones de Minerales/Items y Órganos de Flora."
                    icono={Layers}
                    items={organosCriatura.organos}
                    catalogo={catalogoOrganos}
                    loading={organosCriatura.loading}
                    onCrearNuevo={async () => {
                      const nuevo = await organosCriatura.crearYVincularOrgano();
                      if (nuevo) setEditandoGrupoId(nuevo.id);
                      return nuevo;
                    }}
                    onUsarExistente={(id) => void organosCriatura.vincularOrganoExistente(id)}
                    onDelete={(vinculoId) => void organosCriatura.desvincularOrgano(vinculoId)}
                    onAbrirGrupo={(id) => setEditandoGrupoId(id)}
                    onAbrirCelula={setEditandoCelulaId}
                  />
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto pr-0.5">
                    {loadingElementosPerfil ||
                    loadingOrisPerfil ||
                    loadingPerfilesAtomicos ? (
                      <div className="py-4 text-xs text-primary/30 text-center">
                        Cargando…
                      </div>
                    ) : (
                      <PanelPerfilCriatura
                        key={form.id}
                        actualizar={actualizarPerfil}
                        criaturaId={form.id}
                        criaturaNombre={form.nombre}
                        elementos={elementosPerfil}
                        obtenerOCrear={obtenerOCrearPerfil}
                        orisDisponibles={orisDisponiblesPerfil}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── BARRA DE ENTIDADES — fila horizontal inferior ────────────────── */}
        <div
          className="shrink-0 hidden sm:flex border-t overflow-y-auto"
          style={{
            maxHeight: "60vh",
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 1.5%, transparent)",
          }}
        >
          {/* Personajes */}
          <div
            className="flex-1 flex flex-col min-w-0 h-full border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <SeccionEntidad
              allEntities={allPersonajes.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                imagen_url: p.img_url,
              }))}
              columns={8}
              emptyLabel="Sin personajes"
              fallbackIcon={<UserCircle2 size={14} strokeWidth={1} />}
              fill={false}
              icon={<Users size={9} />}
              label="Personajes"
              loading={loadingPersonajes}
              saving={savingPersonajes}
              selectedIds={personajesDeEspecie.map((p) => p.id)}
              onEntityClick={(id) => onSelectPersonaje?.(id)}
              onToggle={handleTogglePersonaje}
            />
          </div>

          {/* Territorio */}
          <div
            className="shrink-0 flex flex-col h-full border-r"
            style={{
              width: "max-content",
              minWidth: "110px",
              maxWidth: "220px",
              borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <SeccionEntidad
              allEntities={allReinos.map((r) => ({
                id: r.id,
                nombre: r.nombre,
              }))}
              emptyLabel="Sin territorio"
              fallbackIcon={<Globe size={14} strokeWidth={1} />}
              fill={false}
              icon={<Globe size={9} />}
              label="Territorio"
              loading={loadingReinos}
              saving={savingReinos}
              selectedIds={reinoRows.map((r) => r.reinoId)}
              onEntityClick={(id) => onNavigateReino?.(id)}
              onToggle={(id, add) => handleToggleReino(id, add)}
            />
          </div>

          {/* Ciudades */}
          <div
            className="shrink-0 flex flex-col h-full border-r"
            style={{
              width: "max-content",
              minWidth: "110px",
              maxWidth: "220px",
              borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <SeccionEntidad
              allEntities={ciudadesConReino.map((l) => ({
                id: l.id,
                nombre: l.nombre,
              }))}
              emptyLabel={
                reinosSeleccionadosIds.length > 0
                  ? "Sin ciudades en estos reinos"
                  : "Sin ciudades"
              }
              fallbackIcon={<MapPin size={14} strokeWidth={1} />}
              fill={false}
              icon={<MapPin size={9} />}
              label={
                reinosSeleccionadosIds.length > 0
                  ? `Ciudades (${reinosSeleccionadosIds.length})`
                  : "Ciudades"
              }
              loading={loadingCiudades}
              saving={savingCiudades}
              selectedIds={ciudadRows.map((r) => r.ciudadId)}
              onEntityClick={(id) => onNavigateCiudad?.(id)}
              onToggle={(id, add) => handleToggleCiudad(id, add)}
            />
          </div>

          {/* Creaciones */}
          <div
            className="shrink-0 flex flex-col h-full border-r"
            style={{
              width: "max-content",
              minWidth: "110px",
              maxWidth: "220px",
              borderColor: "color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <SeccionEntidad
              allEntities={allCraftedItems.map((i) => ({
                id: i.id,
                nombre: i.nombre,
                imagen_url: i.imagen_url,
              }))}
              emptyLabel="Sin creaciones"
              fallbackIcon={<Package size={14} strokeWidth={1} />}
              fill={false}
              icon={<Wrench size={9} />}
              label="Creaciones"
              loading={loadingCrafted}
              saving={savingCrafted}
              selectedIds={craftedItems.map((i) => i.itemId)}
              onEntityClick={(id) => onSelectItem?.(id)}
              onToggle={handleToggleCrafted}
            />
          </div>

        </div>
      </div>

      {/* ── BARRA DE ENTIDADES — mobile drawer ───────────────────────────────── */}
      {mobileAsideOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{
              background: "color-mix(in srgb, var(--primary) 20%, transparent)",
            }}
            onClick={closeMobileAside}
          />
          <div
            className="relative flex flex-col h-full overflow-y-auto shadow-2xl"
            style={{
              width: "200px",
              background: "var(--white-custom, var(--bg-main))",
              borderLeft:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
              scrollbarWidth: "none",
            }}
          >
            <div
              className="shrink-0 flex items-center justify-between px-3 py-2 border-b"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
            >
              <span className="text-micro font-black uppercase tracking-[0.2em] flex items-center gap-1.5 text-primary/40">
                <SlidersHorizontal size={9} /> Entidades
              </span>
              <button
                className="p-1 rounded-lg text-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
                onClick={closeMobileAside}
              >
                <X size={13} />
              </button>
            </div>

            <SeccionEntidad
              allEntities={allPersonajes.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                imagen_url: p.img_url,
              }))}
              columns={2}
              emptyLabel="Sin personajes"
              fallbackIcon={<UserCircle2 size={14} strokeWidth={1} />}
              fill={false}
              icon={<Users size={9} />}
              label="Personajes"
              loading={loadingPersonajes}
              saving={savingPersonajes}
              selectedIds={personajesDeEspecie.map((p) => p.id)}
              onEntityClick={(id) => onSelectPersonaje?.(id)}
              onToggle={handleTogglePersonaje}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <SeccionEntidad
              allEntities={allReinos.map((r) => ({
                id: r.id,
                nombre: r.nombre,
              }))}
              emptyLabel="Sin territorio"
              fallbackIcon={<Globe size={14} strokeWidth={1} />}
              fill={false}
              icon={<Globe size={9} />}
              label="Territorio"
              loading={loadingReinos}
              saving={savingReinos}
              selectedIds={reinoRows.map((r) => r.reinoId)}
              onEntityClick={(id) => onNavigateReino?.(id)}
              onToggle={(id, add) => handleToggleReino(id, add)}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <SeccionEntidad
              allEntities={ciudadesConReino.map((l) => ({
                id: l.id,
                nombre: l.nombre,
              }))}
              emptyLabel={
                reinosSeleccionadosIds.length > 0
                  ? "Sin ciudades en estos reinos"
                  : "Sin ciudades"
              }
              fallbackIcon={<MapPin size={14} strokeWidth={1} />}
              fill={false}
              icon={<MapPin size={9} />}
              label={
                reinosSeleccionadosIds.length > 0
                  ? `Ciudades (${reinosSeleccionadosIds.length})`
                  : "Ciudades"
              }
              loading={loadingCiudades}
              saving={savingCiudades}
              selectedIds={ciudadRows.map((r) => r.ciudadId)}
              onEntityClick={(id) => onNavigateCiudad?.(id)}
              onToggle={(id, add) => handleToggleCiudad(id, add)}
            />
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
              }}
            />
            <SeccionEntidad
              allEntities={allCraftedItems.map((i) => ({
                id: i.id,
                nombre: i.nombre,
                imagen_url: i.imagen_url,
              }))}
              emptyLabel="Sin creaciones"
              fallbackIcon={<Package size={14} strokeWidth={1} />}
              fill={false}
              icon={<Wrench size={9} />}
              label="Creaciones"
              loading={loadingCrafted}
              saving={savingCrafted}
              selectedIds={craftedItems.map((i) => i.itemId)}
              onEntityClick={(id) => onSelectItem?.(id)}
              onToggle={handleToggleCrafted}
            />
          </div>
        </div>
      )}

      {showModalDnd && (
        <ModalReglasDndCriatura
          descripcionDnd={form.descripcion_dnd ?? ""}
          nombre={form.nombre}
          statsDnd={form.stats_dnd}
          onChangeDescripcionDnd={(v) =>
            setForm((f) => ({ ...f, descripcion_dnd: v || null }))
          }
          onChangeStatsDnd={(v) => setForm((f) => ({ ...f, stats_dnd: v }))}
          onClose={() => setShowModalDnd(false)}
        />
      )}

      {editandoGrupoId && (
        <GrupoCompuestoPanelFlotante
          grupo={catalogoOrganos.find((g) => g.id === editandoGrupoId)!}
          compuestos={compuestosOrganos}
          onCerrar={() => setEditandoGrupoId(null)}
          onActualizar={persistirOrgano}
          onAbrirCompuesto={setEditandoCompuestoId}
        />
      )}

      {/* Click en "hecho de: [Célula]" en la fila de fórmula de un Tejido —
          la cadena real es Tejido→Célula→Compuesto, así que esto abre la
          Célula (donde vive compuesto_id), no el Compuesto directo. */}
      {editandoCelulaId &&
        (() => {
          const celulaActiva = celulasCatalogo.items.find((c) => c.id === editandoCelulaId);
          if (!celulaActiva) return null;
          return (
            <PanelEditorCelula
              item={celulaActiva}
              compuestos={compuestosOrganos}
              onCerrar={() => setEditandoCelulaId(null)}
              onActualizar={celulasCatalogo.actualizar}
              onEliminar={celulasCatalogo.eliminar}
              onAbrirCompuesto={setEditandoCompuestoId}
              onAbrirTejido={(tejidoId) => {
                setEditandoCelulaId(null);
                setEditandoTejidoId(tejidoId);
              }}
              onAbrirOrgano={(organoId) => {
                setEditandoCelulaId(null);
                setEditandoGrupoId(organoId);
              }}
            />
          );
        })()}

      {/* Panel del Tejido abierto desde "Célula → Tejido" — se apila igual
          que la Célula de arriba. */}
      {editandoTejidoId &&
        (() => {
          const tejidoActivo = tejidosCatalogo.items.find((t) => t.id === editandoTejidoId);
          if (!tejidoActivo) return null;
          return (
            <PanelEditorTejido
              item={tejidoActivo}
              celulas={celulasCatalogo.items}
              loadingCelulas={celulasCatalogo.loading}
              compuestos={compuestosOrganos}
              onCerrar={() => setEditandoTejidoId(null)}
              onActualizar={tejidosCatalogo.actualizar}
              onEliminar={tejidosCatalogo.eliminar}
              onAbrirCompuesto={setEditandoCompuestoId}
              onAbrirCelula={(celulaId) => {
                setEditandoTejidoId(null);
                setEditandoCelulaId(celulaId);
              }}
              onAbrirOrgano={(organoId) => {
                setEditandoTejidoId(null);
                setEditandoGrupoId(organoId);
              }}
            />
          );
        })()}

      {/* Click en un Compuesto (desde el panel de Órgano o de Célula) — el
          editor completo del propio Compuesto, un nivel más adentro. */}
      {editandoCompuestoId &&
        (() => {
          const compuesto = compuestosOrganos.find((c) => c.id === editandoCompuestoId);
          if (!compuesto) return null;
          return (
            <CompuestoPanelFlotante
              compuesto={compuesto}
              elementos={elementosPerfil}
              todosLosCompuestos={compuestosOrganos}
              onCerrar={() => setEditandoCompuestoId(null)}
              onActualizar={(id, cambios) =>
                setCompuestosOrganos((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
                )
              }
            />
          );
        })()}
    </div>
  );
}

// ─── Modal de reglas D&D ────────────────────────────────────────────────────
// Antes "Descripción D&D" y la ficha de combate vivían inline en el cuerpo
// del editor; ahora se acceden desde el botón de dado junto al nombre, así
// el editor principal queda enfocado en lore/hábitat/relaciones y las
// reglas mecánicas (D&D) quedan agrupadas en un modal aparte.
function ModalReglasDndCriatura({
  nombre,
  descripcionDnd,
  statsDnd,
  onChangeDescripcionDnd,
  onChangeStatsDnd,
  onClose,
}: {
  nombre: string;
  descripcionDnd: string;
  statsDnd: Criatura["stats_dnd"];
  onChangeDescripcionDnd: (v: string) => void;
  onChangeStatsDnd: (v: Criatura["stats_dnd"]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center p-4"
      style={{
        background: "color-mix(in srgb, var(--primary) 30%, transparent)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              color: "var(--primary)",
            }}
          >
            <Dices size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-micro font-black uppercase tracking-widest text-primary/40">
              Reglas D&D
            </p>
            <p className="text-xs font-bold text-primary truncate">{nombre || "Sin nombre"}</p>
          </div>
          <button
            className="shrink-0 p-1 rounded-lg text-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
            type="button"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 max-h-[75vh] overflow-y-auto flex flex-col gap-3">
          {/* Descripción D&D — texto plano, se copia a la ficha del
              personaje que elija esta especie (rasgos raciales, etc). */}
          <div className="flex flex-col gap-1">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Descripción D&D
            </label>
            <textarea
              className="w-full bg-primary/[0.03] border border-primary/10 rounded-lg px-2.5 py-1.5 text-micro text-primary outline-none focus:border-primary/25 resize-none placeholder:text-primary/25 leading-relaxed"
              placeholder="Rasgos raciales, resistencias, velocidad especial… lo que verá el jugador en su ficha al elegir esta especie."
              rows={4}
              value={descripcionDnd}
              onChange={(e) => onChangeDescripcionDnd(e.target.value)}
            />
          </div>

          {/* Ficha de combate D&D 2024 — CA, HP, velocidades, stats,
              salvaciones, habilidades, sentidos, RC/PX, resistencias/
              inmunidades, rasgos y acciones. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-0.5">
              <Shield size={11} className="text-primary/35" />
              <span className="text-[7.5px] font-black uppercase tracking-[0.28em] text-primary/25">
                Ficha de combate (D&D 2024)
              </span>
            </div>
            <CriaturaStatsDndEditor valor={statsDnd} onCambiar={onChangeStatsDnd} />
          </div>
        </div>
      </div>
    </div>
  );
}

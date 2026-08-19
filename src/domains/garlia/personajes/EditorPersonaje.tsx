"use client";

/**
 * EditorPersonaje.tsx
 * ────────────────────
 * View principal del editor de personajes. Orquesta hooks del módulo
 * + componentes del módulo. No contiene lógica con estado propia más
 * allá de UI puramente visual (apertura del drawer mobile).
 *
 * Datos:
 *   hooks/useCiudades.ts
 *   hooks/useReinosMin.ts
 *   hooks/usePersonajeForm.ts
 *
 * UI:
 *   components/personajes/PersonajeSidebarPanel.tsx
 *   components/personajes/PersonajeLineaDeTiempo.tsx
 *   components/personajes/PersonajeImagePickers.tsx
 *
 * Ruta: src/features/editorGarlia/views/EditorPersonaje.tsx
 */

import {
  Maximize2,
  UserCircle2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WikiEntity } from "@/ui/Markdown/commandItems";
import {
  useMobileAsidePanel,
  useRegisterMobileAside,
} from "@/hooks/ui/useMobileAsidePanel";
import { ComboSelector } from "@/ui/ComboSelector";
import {
  PersonajeLineaDeTiempo,
  PersonajeSidebarPanel,
  PickerCaraBtn,
  PickerImagen,
  usePersonajeForm,
  type Era,
  type Personaje,
} from "@garlia/personajes";
import { type SaveStatus } from "@/ui/saveStatus";
import { useCiudades } from "@garlia/ciudades";
import { useReinosMin } from "@garlia/reinos";

import { SelectorImagen } from "@/domains/garlia/_shared/UIComponents";
import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";
import { useNombresDeTabla } from "@/domains/garlia/_shared/useNombresDeTabla";

// ─── FormularioPersonaje ──────────────────────────────────────────────────────

export function FormularioPersonaje({
  form,
  setForm,
  status,
  onSave,
  onDelete,
  compacto = false,
  entities: _entities = [],
  onNavigate,
  onSelectPersonaje,
  onOpenGrupo,
  onNavigateCiudad,
  onSelectCancion,
  onNavigateCapitulo,
  onFechaNacimientoChange,
  onHeaderControlsChange,
}: {
  form: Personaje;
  setForm: React.Dispatch<React.SetStateAction<Personaje>>;
  status: SaveStatus;
  onSave: () => void;
  onDelete: () => void;
  compacto?: boolean;
  entities?: WikiEntity[];
  onNavigate?: (tab: "criaturas" | "reinos", nombre: string) => void;
  onSelectPersonaje?: (id: string) => void;
  onOpenGrupo?: (id: string) => void;
  onNavigateCiudad?: (id: string) => void;
  onSelectCancion?: (id: string) => void;
  onNavigateCapitulo?: (capituloId: string) => void;
  onFechaNacimientoChange: (dia: number | null) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const especies = useNombresDeTabla("criaturas");
  const reinosMin = useReinosMin();
  const ciudades = useCiudades();

  useRegisterMobileAside();
  const mobileAsideOpen = useMobileAsidePanel((s) => s.open);
  const closeMobileAside = useMobileAsidePanel((s) => s.close);

  // Era seleccionada en la línea de tiempo: cuando hay una, la columna de
  // imágenes (Cara/Cuerpo) muestra y edita la imagen de ESA era en vez de
  // la del personaje base (con fallback a la del personaje si la era no
  // tiene una propia todavía).
  const [eraSeleccionada, setEraSeleccionada] = useState<Era | null>(null);
  const changeImagenEraRef = useRef<
    (
      era: Era,
      campo: "img_url" | "img_cuerpo_url",
      url: string | null,
    ) => void
  >(() => {});
  const registrarChangeImagenEra = useCallback(
    (fn: typeof changeImagenEraRef.current) => {
      changeImagenEraRef.current = fn;
    },
    [],
  );

  const caraMostrada = eraSeleccionada
    ? eraSeleccionada.img_url || form.img_url
    : form.img_url;
  const cuerpoMostrado = eraSeleccionada
    ? eraSeleccionada.img_cuerpo_url || form.img_cuerpo_url
    : form.img_cuerpo_url;
  const caraEsDeEra = !!(eraSeleccionada && eraSeleccionada.img_url);
  const cuerpoEsDeEra = !!(eraSeleccionada && eraSeleccionada.img_cuerpo_url);

  const onCambiarCara = (url: string) => {
    if (eraSeleccionada) {
      changeImagenEraRef.current(eraSeleccionada, "img_url", url);
    } else {
      setForm((f) => ({ ...f, img_url: url }));
    }
  };
  const onCambiarCuerpo = (url: string) => {
    if (eraSeleccionada) {
      changeImagenEraRef.current(eraSeleccionada, "img_cuerpo_url", url);
    } else {
      setForm((f) => ({ ...f, img_cuerpo_url: url }));
    }
  };

  const reinoSeleccionadoId =
    reinosMin.find((r) => r.nombre === form.reino)?.id ?? null;
  const ciudadesFiltradas = ciudades.filter((l) =>
    reinoSeleccionadoId ? l.reino_id === reinoSeleccionadoId : !l.reino_id,
  );

  const territorioValue = form.reino
    ? reinosMin.find((x) => x.nombre === form.reino)
      ? `reino:${reinosMin.find((x) => x.nombre === form.reino)!.id}`
      : null
    : null;

  const onTerritorioChange = (val: string | null) => {
    if (!val) {
      setForm((f) => ({ ...f, reino: "", ciudad_id: null }) as any);
      return;
    }
    if (val.startsWith("reino:")) {
      const r = reinosMin.find((x) => x.id === val.replace("reino:", ""));
      setForm(
        (f) => ({ ...f, reino: r?.nombre ?? "", ciudad_id: null }) as any,
      );
    }
  };

  const ubicacionValue = (form as any).ciudad_id
    ? `ciudad:${(form as any).ciudad_id}`
    : null;
  const onUbicacionChange = (val: string | null) => {
    setForm(
      (f) =>
        ({
          ...f,
          ciudad_id: val?.startsWith("ciudad:")
            ? val.replace("ciudad:", "")
            : null,
        }) as any,
    );
  };

  const field =
    (k: keyof Personaje) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const sidebarProps = {
    personajeId: form.id,
    nombrePersonaje: form.nombre ?? "",
    onSelectPersonaje,
    onOpenGrupo,
    onSelectCancion,
    onNavigateCapitulo,
  };

  const headerControls = {
    imagenUrl: form.img_url,
    IconoFallback: UserCircle2,
    nombre: form.nombre ?? "",
    placeholderNombre: "Nombre del personaje",
    onChangeNombre: (nombre: string) => setForm((f) => ({ ...f, nombre })),
    status,
    onGuardar: onSave,
    // En modo "compacto" (embebido en otro panel) no se ofrece eliminar,
    // igual que antes — se publica un no-op para no romper el contrato.
    onEliminar: compacto ? () => {} : onDelete,
  };
  // Solo se publica hacia el contenedor cuando NO es compacto: el modo
  // compacto es un uso embebido propio (p. ej. dentro de otro formulario)
  // que no pasa por PanelFlotanteGlobal y siempre debe dibujar su header.
  usePublishHeaderControls(headerControls, compacto ? undefined : onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {(compacto || !onHeaderControlsChange) && <EditorHeaderBar controls={headerControls} />}

      {/* Cuerpo: formulario + sidebar inline desktop */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Imágenes */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="shrink-0 w-full sm:w-52 flex sm:flex-col gap-3 sm:gap-2">
                {/* Mobile: imagen grande */}
                <div
                  className="sm:hidden relative w-full rounded-xl overflow-hidden border border-primary/10 bg-primary/3"
                  style={{ aspectRatio: "1 / 1" }}
                >
                  {caraMostrada ? (
                    <img
                      alt={form.nombre}
                      className="w-full h-full object-cover"
                      src={caraMostrada}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserCircle2 className="text-primary/15" size={48} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 z-10">
                    <PickerCaraBtn
                      value={caraMostrada ?? ""}
                      onChange={onCambiarCara}
                    />
                  </div>
                </div>

                {/* Desktop: selector normal */}
                <div className="hidden sm:block w-full relative">
                  <SelectorImagen
                    aspect="square"
                    label={eraSeleccionada ? "Cara (era)" : "Cara"}
                    placeholder={
                      <UserCircle2 className="opacity-25" size={20} />
                    }
                    value={caraMostrada ?? ""}
                    onChange={onCambiarCara}
                  />
                  {eraSeleccionada && caraEsDeEra && (
                    <button
                      className="mt-1 text-micro text-primary/30 hover:text-accent transition-colors"
                      title="Quitar imagen propia de esta era (usará la del personaje)"
                      type="button"
                      onClick={() =>
                        changeImagenEraRef.current(
                          eraSeleccionada,
                          "img_url",
                          null,
                        )
                      }
                    >
                      Quitar imagen de la era
                    </button>
                  )}
                </div>

                {!compacto && (
                  <div className="hidden sm:block rounded-xl overflow-hidden border border-primary/10">
                    <div className="flex items-center justify-between px-2 py-1 border-b border-primary/[0.06]">
                      <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                        {eraSeleccionada ? "Cuerpo (era)" : "Cuerpo"}
                      </span>
                      {eraSeleccionada && cuerpoEsDeEra && (
                        <button
                          className="text-micro text-primary/25 hover:text-accent transition-colors"
                          title="Quitar imagen propia de esta era (usará la del personaje)"
                          type="button"
                          onClick={() =>
                            changeImagenEraRef.current(
                              eraSeleccionada,
                              "img_cuerpo_url",
                              null,
                            )
                          }
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <div
                      className="relative w-full group bg-primary/2"
                      style={{ aspectRatio: "1 / 2" }}
                    >
                      {cuerpoMostrado ? (
                        <img
                          alt="Cuerpo completo"
                          className="absolute inset-0 w-full h-full object-contain"
                          src={cuerpoMostrado}
                          style={{ objectPosition: "top center" }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Maximize2 className="opacity-15" size={20} />
                        </div>
                      )}
                      <label className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-bg-main/70 backdrop-blur-sm">
                        <Maximize2 className="text-primary/50" size={14} />
                        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 leading-none">
                          Cambiar
                        </span>
                        <SelectorImagen
                          aspect="full"
                          label=""
                          placeholder={null}
                          value={cuerpoMostrado ?? ""}
                          onChange={onCambiarCuerpo}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Mobile: botón cuerpo */}
                {!compacto && (
                  <div className="sm:hidden">
                    <PickerImagen
                      icon={<Maximize2 size={11} />}
                      label={
                        cuerpoMostrado
                          ? "Cambiar cuerpo"
                          : "+ Imagen cuerpo"
                      }
                      titulo="Imagen cuerpo"
                      value={cuerpoMostrado ?? ""}
                      onChange={onCambiarCuerpo}
                    />
                  </div>
                )}
              </div>

              {/* Columna derecha: combos + descripción */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* Mobile: grid 2×2 */}
                <div className="sm:hidden grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <ComboSelector
                      allowNone
                      items={especies.map((e) => ({ id: e, label: e }))}
                      label="Especie"
                      mode="single"
                      noneLabel="Sin especie"
                      placeholder="Humano, elfo…"
                      value={form.especie ?? null}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, especie: v ?? "" }) as any)
                      }
                      onNavigate={
                        onNavigate
                          ? (_id, nombre) => onNavigate("criaturas", nombre)
                          : undefined
                      }
                    />
                  </div>
                  <ComboSelector
                    allowNone
                    groups={[]}
                    items={reinosMin.map((r) => ({
                      id: `reino:${r.id}`,
                      label: r.nombre,
                    }))}
                    label="Territorio"
                    mode="single"
                    noneLabel="Sin territorio"
                    placeholder="Reino…"
                    value={territorioValue}
                    onChange={onTerritorioChange}
                    onNavigate={
                      onNavigate
                        ? (id) => {
                            const r = reinosMin.find(
                              (x) => x.id === id.replace("reino:", ""),
                            );
                            if (r) onNavigate("reinos", r.nombre);
                          }
                        : undefined
                    }
                  />
                  <ComboSelector
                    allowNone
                    groups={[]}
                    items={ciudadesFiltradas.map((l) => ({
                      id: `ciudad:${l.id}`,
                      label: l.nombre,
                    }))}
                    label="Ubicación"
                    mode="single"
                    noneLabel="Sin ubicación"
                    placeholder="Ciudad…"
                    value={ubicacionValue}
                    onChange={onUbicacionChange}
                    onNavigate={
                      onNavigateCiudad
                        ? (id) => {
                            if (id.startsWith("ciudad:"))
                              onNavigateCiudad(id.replace("ciudad:", ""));
                          }
                        : undefined
                    }
                  />
                </div>

                {/* Desktop: layout fila de 3 */}
                <div className="hidden sm:flex flex-col sm:flex-row gap-2 items-start">
                  <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
                    <div className="space-y-1 col-span-1">
                      <ComboSelector
                        allowNone
                        items={especies.map((e) => ({ id: e, label: e }))}
                        label="Especie"
                        mode="single"
                        noneLabel="Sin especie"
                        placeholder="Humano, elfo…"
                        value={form.especie ?? null}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, especie: v ?? "" }) as any)
                        }
                        onNavigate={
                          onNavigate
                            ? (_id, nombre) => onNavigate("criaturas", nombre)
                            : undefined
                        }
                      />
                    </div>
                    <ComboSelector
                      allowNone
                      groups={[]}
                      items={reinosMin.map((r) => ({
                        id: `reino:${r.id}`,
                        label: r.nombre,
                      }))}
                      label="Territorio"
                      mode="single"
                      noneLabel="Sin territorio"
                      placeholder="Reino…"
                      value={territorioValue}
                      onChange={onTerritorioChange}
                      onNavigate={
                        onNavigate
                          ? (id) => {
                              const r = reinosMin.find(
                                (x) => x.id === id.replace("reino:", ""),
                              );
                              if (r) onNavigate("reinos", r.nombre);
                            }
                          : undefined
                      }
                    />
                    <ComboSelector
                      allowNone
                      groups={[]}
                      items={ciudadesFiltradas.map((l) => ({
                        id: `ciudad:${l.id}`,
                        label: l.nombre,
                      }))}
                      label="Ubicación"
                      mode="single"
                      noneLabel="Sin ubicación"
                      placeholder="Ciudad…"
                      value={ubicacionValue}
                      onChange={onUbicacionChange}
                      onNavigate={
                        onNavigateCiudad
                          ? (id) => {
                              if (id.startsWith("ciudad:"))
                                onNavigateCiudad(id.replace("ciudad:", ""));
                            }
                          : undefined
                      }
                    />
                  </div>
                </div>

                {/* Línea de tiempo (reemplaza la descripción general) */}
                <PersonajeLineaDeTiempo
                  fechaNacimiento={(form as any).fecha_nacimiento ?? null}
                  personajeId={form.id}
                  onChangeImagenEra={registrarChangeImagenEra}
                  onEraSeleccionadaChange={setEraSeleccionada}
                  onFechaNacimientoChange={onFechaNacimientoChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar inline desktop */}
        <PersonajeSidebarPanel modo="inline" {...sidebarProps} />
      </div>

      {/* Drawer mobile */}
      {mobileAsideOpen && (
        <PersonajeSidebarPanel
          modo="drawer"
          {...sidebarProps}
          onCerrarDrawer={closeMobileAside}
        />
      )}
    </div>
  );
}

// ─── EditorPersonaje ──────────────────────────────────────────────────────────

export function EditorPersonaje({
  item,
  onSaved,
  onDeleted,
  entities = [],
  onNavigate,
  onSelectPersonaje,
  onOpenGrupo,
  onNavigateCiudad,
  onSelectCancion,
  onNavigateCapitulo,
  onHeaderControlsChange,
}: {
  item: Personaje;
  onSaved: (p: Personaje) => void;
  onDeleted: (id: string) => void;
  entities?: WikiEntity[];
  onNavigate?: (tab: "criaturas" | "reinos", nombre: string) => void;
  onSelectPersonaje?: (id: string) => void;
  onOpenGrupo?: (id: string) => void;
  onNavigateCiudad?: (id: string) => void;
  onSelectCancion?: (id: string) => void;
  onNavigateCapitulo?: (capituloId: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const { form, setForm, status, save, remove, onFechaNacimientoChange } =
    usePersonajeForm(item, onSaved, onDeleted);

  // Confirmación inline en el header compartido — ver EditorHeaderBar.
  const del = async () => {
    await remove();
  };

  return (
    <>
      <FormularioPersonaje
        entities={entities}
        form={form}
        setForm={setForm}
        status={status}
        onDelete={del}
        onFechaNacimientoChange={onFechaNacimientoChange}
        onHeaderControlsChange={onHeaderControlsChange}
        onNavigate={onNavigate}
        onNavigateCapitulo={onNavigateCapitulo}
        onNavigateCiudad={onNavigateCiudad}
        onOpenGrupo={onOpenGrupo}
        onSave={save}
        onSelectCancion={onSelectCancion}
        onSelectPersonaje={onSelectPersonaje}
      />
    </>
  );
}

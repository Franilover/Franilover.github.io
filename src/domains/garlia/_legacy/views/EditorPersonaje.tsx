"use client";

/**
 * EditorPersonaje.tsx
 * ────────────────────
 * View principal del editor de personajes. Orquesta hooks del módulo
 * + componentes del módulo. No contiene lógica con estado propia más
 * allá de UI puramente visual (apertura del drawer mobile).
 *
 * Datos:
 *   hooks/useGruposDeCriatura.ts
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
  Save,
  Trash2,
  UserCircle2,
} from "lucide-react";
import type { WikiEntity } from "@/components/forms/Markdown/commandItems";
import {
  useMobileAsidePanel,
  useRegisterMobileAside,
} from "@/hooks/ui/useMobileAsidePanel";
import { ComboSelector } from "@/components/ui/ComboSelector";
import { useConfirm } from "@/components/ui/ConfirmModal";
import {
  BloqueDones,
  PersonajeLineaDeTiempo,
  PersonajeSidebarPanel,
  PickerCaraBtn,
  PickerImagen,
  usePersonajeForm,
  type Personaje,
} from "@garlia/personajes";
import { type SaveStatus } from "@/components/ui/saveStatus";
import { useCiudades } from "@garlia/ciudades";
import { useGruposDeCriatura } from "@/domains/garlia/_legacy/hooks/grupos/useGruposDeCriatura";
import { useReinosMin } from "@garlia/reinos";

import { SelectorImagen, SaveIndicator } from "@/domains/garlia/_legacy/components/shared/UIComponents";
import { useNombresDeTabla } from "../hooks/misc/useNombresDeTabla";

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
}) {
  const especies = useNombresDeTabla("criaturas");
  const reinosMin = useReinosMin();
  const ciudades = useCiudades();
  const { ids: grupoIds, esMagico: especieEsMagica } = useGruposDeCriatura(
    form.especie,
  );

  useRegisterMobileAside();
  const mobileAsideOpen = useMobileAsidePanel((s) => s.open);
  const closeMobileAside = useMobileAsidePanel((s) => s.close);

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
    grupoIds,
    especieEsMagica,
    onSelectPersonaje,
    onOpenGrupo,
    onSelectCancion,
    onNavigateCapitulo,
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-primary/10 bg-primary/[0.03]">
        <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-primary/15 bg-primary/5 flex items-center justify-center">
          {form.img_url ? (
            <img
              alt={form.nombre}
              className="w-full h-full object-cover"
              src={form.img_url}
            />
          ) : (
            <UserCircle2 className="text-primary/25" size={16} />
          )}
        </div>
        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
          placeholder="Nombre del personaje"
          style={{ letterSpacing: "0.02em" }}
          value={form.nombre ?? ""}
          onChange={field("nombre")}
        />
        <div className="shrink-0 flex items-center gap-1.5">
          <SaveIndicator status={status} />
          {!compacto && (
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
              onClick={onDelete}
            >
              <Trash2 size={10} />
            </button>
          )}
          <button
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
            disabled={status === "saving"}
            onClick={onSave}
          >
            <Save size={10} /> Guardar
          </button>
        </div>
      </div>

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
                  {form.img_url ? (
                    <img
                      alt={form.nombre}
                      className="w-full h-full object-cover"
                      src={form.img_url}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserCircle2 className="text-primary/15" size={48} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 z-10">
                    <PickerCaraBtn
                      value={form.img_url ?? ""}
                      onChange={(url) =>
                        setForm((f) => ({ ...f, img_url: url }))
                      }
                    />
                  </div>
                </div>

                {/* Desktop: selector normal */}
                <div className="hidden sm:block w-full">
                  <SelectorImagen
                    aspect="square"
                    label="Cara"
                    placeholder={
                      <UserCircle2 className="opacity-25" size={20} />
                    }
                    value={form.img_url ?? ""}
                    onChange={(url) => setForm((f) => ({ ...f, img_url: url }))}
                  />
                </div>

                {!compacto && (
                  <div className="hidden sm:block rounded-xl overflow-hidden border border-primary/10">
                    <div className="px-2 py-1 border-b border-primary/[0.06]">
                      <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                        Cuerpo
                      </span>
                    </div>
                    <div
                      className="relative w-full group bg-primary/2"
                      style={{ aspectRatio: "1 / 2" }}
                    >
                      {form.img_cuerpo_url ? (
                        <img
                          alt="Cuerpo completo"
                          className="absolute inset-0 w-full h-full object-contain"
                          src={form.img_cuerpo_url}
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
                          value={form.img_cuerpo_url ?? ""}
                          onChange={(url) =>
                            setForm((f) => ({ ...f, img_cuerpo_url: url }))
                          }
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
                        form.img_cuerpo_url
                          ? "Cambiar cuerpo"
                          : "+ Imagen cuerpo"
                      }
                      titulo="Imagen cuerpo"
                      value={form.img_cuerpo_url ?? ""}
                      onChange={(url) =>
                        setForm((f) => ({ ...f, img_cuerpo_url: url }))
                      }
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
                  <BloqueDones grupoIds={grupoIds} personajeId={form.id} />
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
                  <div className="shrink-0">
                    <BloqueDones grupoIds={grupoIds} personajeId={form.id} />
                  </div>
                </div>

                {/* Línea de tiempo (reemplaza la descripción general) */}
                <PersonajeLineaDeTiempo
                  fechaNacimiento={(form as any).fecha_nacimiento ?? null}
                  personajeId={form.id}
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
}) {
  const { form, setForm, status, save, remove, onFechaNacimientoChange } =
    usePersonajeForm(item, onSaved, onDeleted);
  const { confirm, ConfirmModal } = useConfirm();

  const del = async () => {
    const ok = await confirm({
      message: `¿Eliminar a "${form.nombre}"?`,
      danger: true,
    });
    if (!ok) return;
    await remove();
  };

  return (
    <>
      <ConfirmModal />
      <FormularioPersonaje
        entities={entities}
        form={form}
        setForm={setForm}
        status={status}
        onDelete={del}
        onFechaNacimientoChange={onFechaNacimientoChange}
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

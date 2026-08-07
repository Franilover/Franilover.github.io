"use client";

/**
 * ElementosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la sección "Tabla" (Tabla Química/Alquímica): grid de los 29
 * elementos + detalle inline al seleccionar uno (capas núcleo/media/externa
 * editables). Mismo patrón que RunasPage: sin navegar a otra ruta, toggle
 * de selección adentro de la misma página.
 *
 * Pensado para crecer con tabs hermanas (Iums, Simulador de reacciones) —
 * ver PanelSubTabsElementos más abajo, hoy con un solo tab activo.
 */

import { Atom, Beaker, Download, Info, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { CompuestosPage } from "./CompuestosPage";
import { ElementoEditor } from "./ElementoEditor";
import { useCompuestos } from "./useCompuestos";
import {
  useInfoTablaQuimica,
  type SeccionInfoTablaQuimica,
} from "./useInfoTablaQuimica";
import { formatLayer, type Compuesto, type Elemento } from "./types";

// ─── Descarga: todos los elementos de la Tabla Química en un solo JSON ─────
// Incluye también el contenido del modal de info y los compuestos
// (editables desde Supabase), para que el JSON exportado quede
// autocontenido con la tabla + su explicación + las combinaciones.
function descargarDatosElementos(
  elementos: Elemento[],
  infoTabla: SeccionInfoTablaQuimica[],
  compuestos: Compuesto[],
) {
  const payload = {
    exportado_en: new Date().toISOString(),
    elementos,
    info_tabla_quimica: infoTabla,
    compuestos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tabla-elementos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface Props {
  elementos: Elemento[];
  loading?: boolean;
  creating?: boolean;
  onCreate?: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
  /** Id a dejar seleccionado tras crear (mismo patrón que runaRecienCreadaId). */
  seleccionarId?: string | null;
}

/**
 * Casilla tipo tabla periódica: símbolo (abreviatura) grande y centrado en
 * vez de imagen/ícono genérico, con número atómico arriba y las 3 capas
 * resumidas abajo — toda la info clave visible sin entrar al detalle.
 * Reemplaza a EntityCard/EntityCardGrid acá porque esas dos asumen
 * imagen-o-ícono + una sola línea de subtítulo, insuficiente para lo que
 * se quiere mostrar por elemento.
 */
function ElementoCasilla({
  elemento,
  seleccionado,
  onClick,
}: {
  elemento: Elemento;
  seleccionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-stretch gap-0.5 p-1.5 rounded-md border transition-colors text-left ${
        seleccionado
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-micro font-black text-primary/30 tabular-nums">
          #{elemento.numero_atomico}
        </span>
        {elemento.es_noble && (
          <span
            title="Noble"
            className="w-1.5 h-1.5 rounded-full bg-accent/70 shrink-0 mt-0.5"
          />
        )}
      </div>

      <span className="text-base font-black text-primary text-center leading-none py-0.5">
        {elemento.simbolo || "??"}
      </span>

      <span className="text-micro font-bold text-primary/80 truncate text-center leading-tight">
        {elemento.nombre}
      </span>

      <div className="mt-0.5 pt-0.5 border-t border-primary/10 flex flex-col gap-0.5">
        <span className="text-micro text-primary/40 truncate leading-tight">
          <span className="text-primary/25">N</span> {formatLayer(elemento.nucleo)}
        </span>
        <span className="text-micro text-primary/40 truncate leading-tight">
          <span className="text-primary/25">M</span> {formatLayer(elemento.media)}
        </span>
        <span className="text-micro text-primary/40 truncate leading-tight">
          <span className="text-primary/25">E</span> {formatLayer(elemento.externa)}
        </span>
      </div>
    </button>
  );
}

// ─── Info: reglas de la Tabla Química, editable desde Supabase ────────────
// Solo lo propio de acá (estructura de capas, estabilidad/familias,
// manifestaciones) — la jerarquía Partícula Base→Partículas→Iums y la
// resonancia con Iums ya se explican en la sección Física, no se repiten.
//
// El contenido (lista de secciones título+texto) ya no está hardcodeado:
// vive en la tabla `config_info_tabla_quimica` (useInfoTablaQuimica) y es
// editable inline desde el propio modal con el botón de lápiz.
function InfoTablaQuimica({
  info,
  loading,
  guardarSecciones,
}: {
  info: { secciones: SeccionInfoTablaQuimica[] };
  loading: boolean;
  guardarSecciones: (secciones: SeccionInfoTablaQuimica[]) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [borrador, setBorrador] = useState<SeccionInfoTablaQuimica[]>([]);

  function abrir() {
    setAbierto(true);
    setEditando(false);
  }

  function empezarEdicion() {
    setBorrador(info.secciones.map((s) => ({ ...s })));
    setEditando(true);
  }

  function cancelarEdicion() {
    setEditando(false);
    setBorrador([]);
  }

  async function guardar() {
    setSaving(true);
    try {
      // Descarta secciones vacías (título y contenido en blanco) al guardar.
      const limpio = borrador.filter(
        (s) => s.titulo.trim() || s.contenido.trim(),
      );
      await guardarSecciones(limpio);
      setEditando(false);
    } finally {
      setSaving(false);
    }
  }

  function actualizarSeccion(id: string, cambios: Partial<SeccionInfoTablaQuimica>) {
    setBorrador((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
  }

  function eliminarSeccion(id: string) {
    setBorrador((prev) => prev.filter((s) => s.id !== id));
  }

  function agregarSeccion() {
    setBorrador((prev) => [
      ...prev,
      { id: `seccion-${Date.now()}`, titulo: "", contenido: "" },
    ]);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title="Cómo funciona la Tabla Química"
        className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full border border-primary/25 text-primary/40 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
      >
        <Info size={10} />
      </button>

      {abierto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8 md:p-12">
          <div
            className="absolute inset-0 bg-primary/10 backdrop-blur-sm"
            onClick={() => setAbierto(false)}
          />
          <div
            className="relative z-10 flex flex-col w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] rounded-[var(--radius-card)] border shadow-2xl overflow-hidden"
            style={{
              background: "var(--white-custom, var(--bg-main))",
              borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <div
              style={{ background: "var(--bg-main)" }}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
            >
              <Info size={12} className="text-primary/40" />
              <p className="flex-1 min-w-0 text-micro font-black uppercase tracking-widest text-primary/70">
                Cómo funciona la Tabla Química
              </p>

              {!editando && (
                <button
                  type="button"
                  onClick={empezarEdicion}
                  title="Editar contenido"
                  className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <Pencil size={11} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-micro text-primary/30 text-center">Cargando…</div>
            ) : editando ? (
              <div className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto">
                {borrador.map((seccion) => (
                  <div
                    key={seccion.id}
                    className="flex flex-col gap-1.5 p-2 rounded-lg border border-primary/10 bg-primary/[0.02]"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        value={seccion.titulo}
                        onChange={(e) =>
                          actualizarSeccion(seccion.id, { titulo: e.target.value })
                        }
                        placeholder="Título de la sección"
                        className="flex-1 min-w-0 bg-primary/5 rounded-md px-2 py-1 text-micro font-black uppercase tracking-wide text-primary outline-none border border-primary/10 focus:border-primary/30 placeholder:text-primary/25 placeholder:normal-case placeholder:font-normal"
                      />
                      <button
                        type="button"
                        onClick={() => eliminarSeccion(seccion.id)}
                        title="Eliminar sección"
                        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <textarea
                      value={seccion.contenido}
                      onChange={(e) =>
                        actualizarSeccion(seccion.id, { contenido: e.target.value })
                      }
                      placeholder="Contenido…"
                      rows={4}
                      className="bg-primary/5 rounded-md px-2 py-1.5 text-micro text-primary outline-none border border-primary/10 focus:border-primary/30 resize-none placeholder:text-primary/25 leading-relaxed"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={agregarSeccion}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/40 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <Plus size={10} />
                  Agregar sección
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto text-micro text-primary/70 leading-relaxed">
                {info.secciones.length === 0 ? (
                  <p className="text-primary/30 text-center py-4">
                    Todavía no hay contenido cargado. Tocá el lápiz para agregarlo.
                  </p>
                ) : (
                  info.secciones.map((seccion) => (
                    <div key={seccion.id} className="flex flex-col gap-1">
                      <p className="font-black uppercase tracking-[0.2em] text-primary/40">
                        {seccion.titulo}
                      </p>
                      <p className="whitespace-pre-line">{seccion.contenido}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {editando && (
              <div
                style={{ background: "var(--bg-main)" }}
                className="shrink-0 flex items-center justify-end gap-1.5 px-2.5 py-1.5 border-t border-primary/10"
              >
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? <Loader2 className="animate-spin" size={10} /> : <Save size={10} />}
                  {saving ? "…" : "Guardar"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function ElementosPage({
  elementos,
  loading,
  creating,
  onCreate,
  onActualizar,
  onEliminar,
  seleccionarId,
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const {
    info: infoTabla,
    loading: loadingInfoTabla,
    guardarSecciones,
  } = useInfoTablaQuimica();

  // ── Compuestos: sub-tab hermana de Elementos, mismo bloque "Tabla" ──────
  const [subTab, setSubTab] = useState<"elementos" | "compuestos">("elementos");
  const {
    items: compuestos,
    setItems: setCompuestos,
    loading: loadingCompuestos,
  } = useCompuestos();
  const [creatingCompuesto, setCreatingCompuesto] = useState(false);
  const [compuestoRecienCreadoId, setCompuestoRecienCreadoId] = useState<string | null>(null);

  async function handleCreateCompuesto() {
    setCreatingCompuesto(true);
    try {
      const { data, error } = await supabase
        .from("compuestos")
        .insert([{ nombre: "Nuevo compuesto", simbolo: "??", componentes: [] }])
        .select()
        .single();
      if (error) throw error;
      setCompuestos((prev) => [...prev, data as Compuesto]);
      setCompuestoRecienCreadoId((data as Compuesto).id);
    } catch (e) {
      console.error("[ElementosPage] error creando compuesto:", e);
    } finally {
      setCreatingCompuesto(false);
    }
  }

  async function handleEliminarCompuesto(id: string) {
    try {
      const { error } = await supabase.from("compuestos").delete().eq("id", id);
      if (error) throw error;
      setCompuestos((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("[ElementosPage] error eliminando compuesto:", e);
    }
  }

  const activoId = seleccionadoId ?? seleccionarId ?? null;
  const activo = useMemo(
    () => elementos.find((e) => e.id === activoId) ?? null,
    [elementos, activoId],
  );

  if (subTab === "compuestos") {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <SubTabsElementos subTab={subTab} onCambiar={setSubTab} />
        <CompuestosPage
          compuestos={compuestos}
          elementos={elementos}
          loading={loadingCompuestos}
          creating={creatingCompuesto}
          onCreate={handleCreateCompuesto}
          onActualizar={(id, cambios) =>
            setCompuestos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
          }
          onEliminar={handleEliminarCompuesto}
          seleccionarId={compuestoRecienCreadoId}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SubTabsElementos subTab={subTab} onCambiar={setSubTab} />
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary/40">
            <Atom size={12} />
            <p className="text-micro font-black uppercase tracking-widest">
              Tabla Química · {elementos.length} elementos
            </p>
            <InfoTablaQuimica
              info={infoTabla}
              loading={loadingInfoTabla}
              guardarSecciones={guardarSecciones}
            />
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => descargarDatosElementos(elementos, infoTabla.secciones, compuestos)}
              title="Descargar todos los datos de la Tabla Química como JSON"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Download size={10} />
              <span className="hidden sm:inline">Descargar datos</span>
            </button>
            {onCreate && (
              <button
                type="button"
                disabled={creating}
                onClick={onCreate}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="animate-spin" size={10} /> : <Plus size={10} />}
                Nuevo elemento
              </button>
            )}
          </div>
        </div>

        {loading && elementos.length === 0 ? (
          <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
        ) : elementos.length === 0 ? (
          <div className="py-6 text-micro text-primary/25 text-center">
            Todavía no hay elementos cargados.
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
          >
            {elementos.map((el) => (
              <ElementoCasilla
                key={el.id}
                elemento={el}
                seleccionado={el.id === activoId}
                onClick={() =>
                  setSeleccionadoId((actual) => (actual === el.id ? null : el.id))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel lateral: overlay + drawer a la derecha con el detalle del
          elemento seleccionado. No reemplaza el grid — queda visible
          detrás, para poder seguir eligiendo otros elementos. */}
      {activo && (
        <>
          <div
            className="absolute inset-0 z-30 md:hidden"
            style={{ background: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
            onClick={() => setSeleccionadoId(null)}
          />
          <div
            className="absolute md:sticky md:top-0 inset-y-0 right-0 z-40 flex flex-col w-full sm:w-[380px] md:w-[420px] shrink-0 border-l shadow-2xl md:shadow-none md:h-full md:self-start"
            style={{
              background: "var(--white-custom, var(--bg-main))",
              borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <ElementoEditor
              elemento={activo}
              onBack={() => setSeleccionadoId(null)}
              onActualizar={onActualizar}
              onEliminar={
                onEliminar
                  ? (id) => {
                      onEliminar(id);
                      setSeleccionadoId(null);
                    }
                  : undefined
              }
            />
          </div>
        </>
      )}
      </div>
    </div>
  );
}

// ─── Sub-tabs "Elementos" / "Compuestos" ───────────────────────────────────
// Mini toggle propio del bloque Tabla, independiente del toggle grande
// Sistema/Runas/Tabla/Física de RunasPage. Compuestos combina elementos de
// esta misma tabla, así que vive como pestaña hermana acá adentro.
function SubTabsElementos({
  subTab,
  onCambiar,
}: {
  subTab: "elementos" | "compuestos";
  onCambiar: (tab: "elementos" | "compuestos") => void;
}) {
  return (
    <div className="shrink-0 flex items-center gap-1 px-3 pt-2">
      {(
        [
          { key: "elementos" as const, label: "Elementos", Icon: Atom },
          { key: "compuestos" as const, label: "Compuestos", Icon: Beaker },
        ]
      ).map(({ key, label, Icon }) => {
        const activo = subTab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onCambiar(key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide transition-all cursor-pointer ${
              activo
                ? "bg-primary/10 text-primary"
                : "text-primary/40 hover:text-primary/70 hover:bg-primary/5"
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

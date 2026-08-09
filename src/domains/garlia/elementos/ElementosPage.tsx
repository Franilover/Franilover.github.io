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

import { Atom, Beaker, Download, GitCompare, Info, Loader2, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { calcularParticulaDominante } from "./afinidad";
import { ComparadorElementosModal } from "./ComparadorElementos";
import { CompuestosPage } from "./CompuestosPage";
import { ElementoEditor } from "./ElementoEditor";
import { useCompuestos } from "./useCompuestos";
import {
  useInfoTablaQuimica,
  type SeccionInfoTablaQuimica,
} from "./useInfoTablaQuimica";
import {
  formatLayer,
  ELEMENT_FAMILIES,
  CAPACIDAD_CAPA,
  type Compuesto,
  type Elemento,
  type ElementFamily,
} from "./types";

// ─── Descarga: todos los elementos de la Tabla Química en un solo JSON ─────
// Incluye también el contenido del modal de info y los compuestos
// (editables desde Supabase), para que el JSON exportado quede
// autocontenido con la tabla + su explicación + las combinaciones.
export function descargarDatosElementos(
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

// ─── Subida: leer un JSON con el mismo formato exportado y devolver los ───
// elementos nuevos listos para insertar. No toca Supabase directamente —
// eso lo hace el caller (ElementosSection), mismo espíritu que onCreate:
// esta función solo parsea/valida el archivo del usuario.
//
// Reglas de importación:
// - Solo se leen los campos válidos de Elemento (se ignora "id" si viene,
//   porque Supabase genera uno nuevo — igual que handleCreate en
//   ElementosSection, que tampoco manda id).
// - "numero_atomico" es obligatorio y debe ser único frente a lo ya
//   cargado en la tabla (evita pisar el elemento equivocado sin darse
//   cuenta al importar un lote como el de este chat).
// - Si el archivo trae "info_tabla_quimica" o "compuestos" se devuelven
//   también, sueltos, para que el caller decida si los sube.
export interface ImportacionElementos {
  elementosNuevos: Omit<Elemento, "id">[];
  duplicados: { numero_atomico: number; nombre: string }[];
  infoTablaQuimica?: SeccionInfoTablaQuimica[];
  compuestos?: Compuesto[];
}

export function parsearArchivoElementosJSON(
  raw: string,
  elementosExistentes: Elemento[],
): ImportacionElementos {
  const data = JSON.parse(raw);
  const lista: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.elementos) ? data.elementos : null;
  if (!lista) {
    throw new Error('El JSON debe ser un arreglo de elementos, o un objeto con la clave "elementos".');
  }

  const numerosExistentes = new Set(elementosExistentes.map((e) => e.numero_atomico));
  const elementosNuevos: Omit<Elemento, "id">[] = [];
  const duplicados: { numero_atomico: number; nombre: string }[] = [];

  for (const raw of lista) {
    const e = raw as Partial<Elemento>;
    if (typeof e.numero_atomico !== "number" || !e.nombre || !e.simbolo || !e.familia) {
      throw new Error(
        `Elemento inválido (falta numero_atomico, nombre, simbolo o familia): ${JSON.stringify(e).slice(0, 120)}`,
      );
    }
    if (numerosExistentes.has(e.numero_atomico)) {
      duplicados.push({ numero_atomico: e.numero_atomico, nombre: e.nombre });
      continue;
    }
    numerosExistentes.add(e.numero_atomico); // también evita duplicados dentro del propio archivo
    elementosNuevos.push({
      numero_atomico: e.numero_atomico,
      nombre: e.nombre,
      simbolo: e.simbolo,
      familia: e.familia,
      es_noble: e.es_noble ?? false,
      notas: e.notas ?? null,
      nucleo: e.nucleo ?? {},
      media: e.media ?? {},
      externa: e.externa ?? {},
      es_catalizador: e.es_catalizador ?? false,
    });
  }

  return {
    elementosNuevos,
    duplicados,
    infoTablaQuimica: Array.isArray(data?.info_tabla_quimica) ? data.info_tabla_quimica : undefined,
    compuestos: Array.isArray(data?.compuestos) ? data.compuestos : undefined,
  };
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
  /**
   * Inserta en Supabase un lote de elementos nuevos (sin id) y devuelve
   * cuántos quedaron guardados. El botón "Subir JSON" llama a esto tras
   * parsear el archivo — mismo espíritu que onCreate pero para varios a
   * la vez.
   */
  onImportarElementos?: (elementos: Omit<Elemento, "id">[]) => Promise<number>;
}

// ─── Grupo (columna) tipo tabla periódica real ─────────────────────────────
// En la tabla real, la columna (grupo) predice comportamiento: elementos
// del mismo grupo se comportan parecido porque les falta/sobra la misma
// cantidad de electrones de valencia. Acá usamos el balance de la capa
// externa (falta/sobra) como equivalente directo — mismo espíritu que
// balanceExterna en generarDescripcionElemento (afinidad.ts).
function grupoDeElemento(elemento: Elemento): number {
  const totalExterna = Object.values(elemento.externa ?? {}).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );
  // balance: negativo = falta, positivo = sobra, 0 = completa (Noble).
  return totalExterna - CAPACIDAD_CAPA.externa;
}

/** Agrupa y ordena elementos por su "grupo" (déficit/superávit de capa externa),
 * de más incompleto a más sobrecargado, con los completos (Nobles) al medio —
 * mismo criterio visual que una tabla periódica real, donde los gases nobles
 * cierran la fila de la derecha. */
function agruparComoTablaPeriodica(elementos: Elemento[]): { grupo: number; elementos: Elemento[] }[] {
  const porGrupo = new Map<number, Elemento[]>();
  for (const el of elementos) {
    const g = grupoDeElemento(el);
    if (!porGrupo.has(g)) porGrupo.set(g, []);
    porGrupo.get(g)!.push(el);
  }
  return Array.from(porGrupo.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([grupo, els]) => ({
      grupo,
      elementos: els.sort((x, y) => x.numero_atomico - y.numero_atomico),
    }));
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
  const dominantes = useMemo(() => calcularParticulaDominante(elemento), [elemento]);
  const nombreDominante =
    dominantes.length === 0
      ? null
      : dominantes.length === 1
        ? dominantes[0].particula
        : `${dominantes.length} empatadas`;

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

      {nombreDominante && (
        <span
          title="Partícula dominante"
          className="mt-0.5 self-center text-micro font-bold uppercase tracking-wide text-accent/70 bg-accent/10 rounded px-1 truncate max-w-full leading-tight"
        >
          {nombreDominante}
        </span>
      )}
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
  onImportarElementos,
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [comparadorAbierto, setComparadorAbierto] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [mensajeImportacion, setMensajeImportacion] = useState<string | null>(null);

  async function handleArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo si se reintenta
    if (!archivo || !onImportarElementos) return;

    setImportando(true);
    setMensajeImportacion(null);
    try {
      const texto = await archivo.text();
      const { elementosNuevos, duplicados } = parsearArchivoElementosJSON(texto, elementos);

      if (elementosNuevos.length === 0) {
        setMensajeImportacion(
          duplicados.length > 0
            ? `Los ${duplicados.length} elementos del archivo ya existen (mismo número atómico) — no se subió nada.`
            : "El archivo no traía elementos nuevos.",
        );
        return;
      }

      const insertados = await onImportarElementos(elementosNuevos);
      const partes = [`${insertados} elemento${insertados === 1 ? "" : "s"} nuevo${insertados === 1 ? "" : "s"} subido${insertados === 1 ? "" : "s"}.`];
      if (duplicados.length > 0) {
        partes.push(`${duplicados.length} se saltaron por número atómico repetido.`);
      }
      setMensajeImportacion(partes.join(" "));
    } catch (err) {
      console.error("[ElementosPage] error importando JSON:", err);
      setMensajeImportacion(err instanceof Error ? `Error: ${err.message}` : "Error al leer el archivo.");
    } finally {
      setImportando(false);
    }
  }
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

  // Laboratorio: crea un compuesto ya con componentes definidos (unión de
  // los de dos compuestos existentes) — usado por CompuestosPage.
  async function handleCrearCompuestoConComponentes(
    datos: Pick<Compuesto, "nombre" | "simbolo" | "componentes">,
  ) {
    setCreatingCompuesto(true);
    try {
      const { data, error } = await supabase
        .from("compuestos")
        .insert([datos])
        .select()
        .single();
      if (error) throw error;
      setCompuestos((prev) => [...prev, data as Compuesto]);
      setCompuestoRecienCreadoId((data as Compuesto).id);
    } catch (e) {
      console.error("[ElementosPage] error creando compuesto combinado:", e);
    } finally {
      setCreatingCompuesto(false);
    }
  }

  const activoId = seleccionadoId ?? seleccionarId ?? null;
  const activo = useMemo(
    () => elementos.find((e) => e.id === activoId) ?? null,
    [elementos, activoId],
  );

  const [filtroFamilia, setFiltroFamilia] = useState<ElementFamily | "todas">("todas");
  const elementosFiltrados = useMemo(
    () =>
      filtroFamilia === "todas"
        ? elementos
        : elementos.filter((el) => el.familia === filtroFamilia),
    [elementos, filtroFamilia],
  );

  // Vista "Lista" (orden por número atómico, como hoy) vs "Tabla periódica"
  // (agrupada por columnas de déficit/superávit de capa externa).
  const [vista, setVista] = useState<"lista" | "periodica">("lista");
  const gruposPeriodicos = useMemo(
    () => (vista === "periodica" ? agruparComoTablaPeriodica(elementosFiltrados) : []),
    [vista, elementosFiltrados],
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
          onCrearConComponentes={handleCrearCompuestoConComponentes}
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
            <InfoTablaQuimica
              info={infoTabla}
              loading={loadingInfoTabla}
              guardarSecciones={guardarSecciones}
            />
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="flex items-center rounded-md border border-primary/15 overflow-hidden">
              {(
                [
                  { key: "lista" as const, label: "Lista" },
                  { key: "periodica" as const, label: "Tabla periódica" },
                ]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVista(key)}
                  title={
                    key === "periodica"
                      ? "Agrupar por columnas según déficit/superávit de capa externa, como grupos de la tabla periódica real"
                      : "Orden simple por número atómico"
                  }
                  className={`px-2 py-1 text-micro font-black uppercase tracking-wide transition-all cursor-pointer ${
                    vista === key
                      ? "bg-primary/10 text-primary"
                      : "text-primary/40 hover:text-primary/70 hover:bg-primary/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={filtroFamilia}
              onChange={(e) => setFiltroFamilia(e.target.value as ElementFamily | "todas")}
              title="Filtrar por familia"
              className="bg-primary/5 rounded-md pl-2 pr-1 py-1 text-micro font-black uppercase tracking-wide text-primary/60 outline-none border border-primary/15 hover:border-primary/35 focus:border-primary/40 transition-all cursor-pointer"
            >
              <option value="todas">Todas las familias</option>
              {ELEMENT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={elementos.length < 2}
              onClick={() => setComparadorAbierto(true)}
              title="Comparar 2-3 elementos lado a lado"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <GitCompare size={10} />
              <span className="hidden sm:inline">Comparar</span>
            </button>
            <button
              type="button"
              onClick={() => descargarDatosElementos(elementos, infoTabla.secciones, compuestos)}
              title="Descargar todos los datos de la Tabla Química como JSON"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Download size={10} />
              <span className="hidden sm:inline">Descargar datos</span>
            </button>
            {onImportarElementos && (
              <>
                <input
                  ref={inputArchivoRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleArchivoSeleccionado}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={importando}
                  onClick={() => inputArchivoRef.current?.click()}
                  title='Subir un JSON con elementos nuevos (mismo formato que "Descargar datos")'
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {importando ? <Loader2 className="animate-spin" size={10} /> : <Upload size={10} />}
                  <span className="hidden sm:inline">Subir JSON</span>
                </button>
              </>
            )}
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

        {mensajeImportacion && (
          <div className="text-micro text-primary/60 bg-primary/5 border border-primary/15 rounded-md px-2 py-1.5 flex items-center justify-between gap-2">
            <span>{mensajeImportacion}</span>
            <button
              type="button"
              onClick={() => setMensajeImportacion(null)}
              className="text-primary/30 hover:text-primary/60 cursor-pointer shrink-0"
              title="Cerrar"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {loading && elementos.length === 0 ? (
          <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
        ) : elementos.length === 0 ? (
          <div className="py-6 text-micro text-primary/25 text-center">
            Todavía no hay elementos cargados.
          </div>
        ) : elementosFiltrados.length === 0 ? (
          <div className="py-6 text-micro text-primary/25 text-center">
            Ningún elemento en la familia "{filtroFamilia}".
          </div>
        ) : vista === "periodica" ? (
          <div className="flex flex-col gap-3">
            {gruposPeriodicos.map(({ grupo, elementos: elsDelGrupo }) => (
              <div key={grupo} className="flex flex-col gap-1">
                <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                  {grupo === 0
                    ? "Capa completa (Nobles y estables)"
                    : grupo < 0
                      ? `Grupo ${grupo} · faltan ${-grupo} partícula(s) en capa externa`
                      : `Grupo +${grupo} · sobran ${grupo} partícula(s) en capa externa`}
                </p>
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
                >
                  {elsDelGrupo.map((el) => (
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
              </div>
            ))}
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
          >
            {elementosFiltrados.map((el) => (
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
              todosLosElementos={elementos}
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

      {comparadorAbierto && (
        <ComparadorElementosModal
          elementos={elementos}
          onCerrar={() => setComparadorAbierto(false)}
        />
      )}
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

"use client";

/**
 * ElementosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la sección "Tabla" (Tabla Química/Alquímica): grid de los 29
 * elementos + detalle inline al seleccionar uno (capas núcleo/media/externa
 * editables). Mismo patrón que RunasPage: sin navegar a otra ruta, toggle
 * de selección adentro de la misma página.
 *
 * Elementos, Compuestos y Reglas se apilan verticalmente en una sola
 * columna con scroll (en vez de tabs que muestran una sección a la vez).
 */

import { Atom, Download, GitCompare, Loader2, Plus, Save, Scale, Trash2, Upload, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { RichEditor } from "@/editor/lexical";
import { supabase } from "@/infra/supabase/supabase";
import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";

import { ComparadorElementosModal } from "./ComparadorElementos";
import { CompuestosPage } from "./CompuestosPage";

import { ReaccionesPage } from "./ReaccionesPage";
import { ElementoEditor } from "./ElementoEditor";
import {
  useCompuestosConElementos,
  sincronizarComponentesCompuesto,
} from "./useCompuestosConElementos";
import { useReacciones } from "./useReacciones";
import {
  type EditorHeaderControls,
} from "../_shared/useEditorHeaderControls";
import {
  useInfoTablaQuimica,
  type SeccionInfoTablaQuimica,
} from "./useInfoTablaQuimica";
import {
  ELEMENT_FAMILIES,
  FAMILY_COLOR,
  type Compuesto,
  type Elemento,
  type ElementFamily,
  type Reaccion,
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
  descargarJSON(payload, "tabla-elementos");
}

// ─── Descarga: solo Elementos + Compuestos (sin las reglas) ───────────────
function descargarElementosYCompuestos(elementos: Elemento[], compuestos: Compuesto[]) {
  const payload = {
    exportado_en: new Date().toISOString(),
    elementos,
    compuestos,
  };
  descargarJSON(payload, "elementos-compuestos");
}

// ─── Descarga: solo las reglas de la Química ───────────────────────────────
function descargarReglas(infoTabla: SeccionInfoTablaQuimica[]) {
  const payload = {
    exportado_en: new Date().toISOString(),
    info_tabla_quimica: infoTabla,
  };
  descargarJSON(payload, "reglas-quimica");
}

function descargarJSON(payload: unknown, nombreBase: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreBase}-${new Date().toISOString().slice(0, 10)}.json`;
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
  /**
   * Elementos del archivo que coinciden (mismo número atómico) con uno ya
   * existente en la tabla: se actualizan (upsert) en vez de saltarse.
   * Incluye el id existente para poder hacer el UPDATE.
   */
  elementosActualizar: (Partial<Elemento> & { id: string })[];
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

  const porNumeroAtomico = new Map(elementosExistentes.map((e) => [e.numero_atomico, e]));
  const elementosNuevos: Omit<Elemento, "id">[] = [];
  const elementosActualizar: (Partial<Elemento> & { id: string })[] = [];

  for (const raw of lista) {
    const e = raw as Partial<Elemento>;
    if (typeof e.numero_atomico !== "number" || !e.nombre || !e.simbolo || !e.familia) {
      throw new Error(
        `Elemento inválido (falta numero_atomico, nombre, simbolo o familia): ${JSON.stringify(e).slice(0, 120)}`,
      );
    }
    const datos = {
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
    };

    const existente = porNumeroAtomico.get(e.numero_atomico);
    if (existente) {
      // Actualiza (upsert): mismo número atómico → sobrescribe el existente
      // con los datos del archivo, en vez de saltarlo.
      elementosActualizar.push({ id: existente.id, ...datos });
    } else {
      elementosNuevos.push(datos);
    }
    // También evita tratar dos filas del propio archivo con el mismo
    // número atómico como "nuevas" por separado — la segunda pasa a
    // actualizar la primera (aunque todavía no tenga id real, se resuelve
    // en el insert; este Map solo protege contra los ya existentes en DB).
  }

  return {
    elementosNuevos,
    elementosActualizar,
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
  /**
   * Borra varios elementos de una: usada por la selección múltiple
   * (Shift+Click en el grid). Si no se pasa, se cae a llamar onEliminar
   * uno por uno.
   */
  onEliminarVarios?: (ids: string[]) => Promise<void>;
  /** Id a dejar seleccionado tras crear (mismo patrón que runaRecienCreadaId). */
  seleccionarId?: string | null;
  /**
   * Inserta en Supabase un lote de elementos nuevos (sin id) y devuelve
   * cuántos quedaron guardados. El botón "Subir JSON" llama a esto tras
   * parsear el archivo — mismo espíritu que onCreate pero para varios a
   * la vez.
   */
  onImportarElementos?: (elementos: Omit<Elemento, "id">[]) => Promise<number>;
  /**
   * Actualiza en Supabase un lote de elementos ya existentes (con id) cuyo
   * número atómico coincidió con uno del archivo subido — hace upsert en
   * vez de saltarlos. Devuelve cuántos quedaron actualizados.
   */
  onActualizarVarios?: (elementos: (Partial<Elemento> & { id: string })[]) => Promise<number>;
  /**
   * Notifica cada vez que cambia el elemento abierto en el panel (o se
   * cierra, con null) — usado por RunasPage para persistir el último
   * elemento visto en useMagiaSeccionStore y reabrirlo tras un refresh.
   * Opcional: si no se pasa, el comportamiento es igual que antes.
   */
  onSeleccionarIdChange?: (id: string | null) => void;
}

/** Agrupa y ordena elementos por familia (Noble, Rígido, Intermedio, Reactivo,
 * Inerte) — mismo orden que ELEMENT_FAMILIES — con los elementos de cada
 * familia ordenados por número atómico. */
function agruparComoTablaPeriodica(elementos: Elemento[]): { familia: ElementFamily; elementos: Elemento[] }[] {
  const porFamilia = new Map<ElementFamily, Elemento[]>();
  for (const el of elementos) {
    if (!porFamilia.has(el.familia)) porFamilia.set(el.familia, []);
    porFamilia.get(el.familia)!.push(el);
  }
  return ELEMENT_FAMILIES.filter((familia) => porFamilia.has(familia)).map((familia) => ({
    familia,
    elementos: porFamilia.get(familia)!.sort((x, y) => x.numero_atomico - y.numero_atomico),
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
  enSeleccionMultiple,
  onClick,
}: {
  elemento: Elemento;
  seleccionado?: boolean;
  /** true si esta casilla está marcada dentro de una selección múltiple (Shift+Click). */
  enSeleccionMultiple?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Click: ver detalle · Shift+Click: agregar/quitar de la selección múltiple · Familia: ${elemento.familia}`}
      className={`group flex flex-col items-stretch gap-0.5 p-1.5 rounded-md border transition-colors text-left ${
        enSeleccionMultiple || seleccionado
          ? "border-primary/50 ring-2 ring-primary/40"
          : "hover:brightness-125"
      }`}
      style={
        enSeleccionMultiple || seleccionado
          ? undefined
          : {
              backgroundColor: FAMILY_COLOR[elemento.familia].bg,
              borderColor: FAMILY_COLOR[elemento.familia].border,
            }
      }
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

      <span
        className="text-base font-black text-center leading-none py-0.5"
        style={{ color: FAMILY_COLOR[elemento.familia].text }}
      >
        {elemento.simbolo || "??"}
      </span>

      <span className="text-micro font-bold text-primary/80 truncate text-center leading-tight">
        {elemento.nombre}
      </span>
    </button>
  );
}

/**
 * Panel flotante centrado del detalle de un Elemento — mismo comportamiento
 * visual que PanelFlotanteGlobal usa para Personaje/Criatura (modal grande
 * centrado en pantalla con backdrop blur, animación popIn, Escape para
 * cerrar y bloqueo de scroll del fondo). Se mantiene local a Química (en
 * vez de sumarse al store global usePanelFlotante) porque ElementoEditor
 * necesita onActualizar/onEliminar, que son propios de esta página.
 */
export function ElementoPanelFlotante({
  elemento,
  todosLosElementos,
  onCerrar,
  onActualizar,
  onEliminar,
  compuestos,
  onNavigateCompuesto,
}: {
  elemento: Elemento;
  todosLosElementos: Elemento[];
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
  /** Catálogo de compuestos, para mostrar en qué compuestos se usa este
   *  elemento (columna junto a Notas dentro de ElementoEditor). */
  compuestos?: Compuesto[];
  /** Navega al panel flotante de un Compuesto donde se usa este elemento. */
  onNavigateCompuesto?: (compuestoId: string) => void;
}) {
  const [headerControls, setHeaderControls] = useState<EditorHeaderControls | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCerrar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          {headerControls ? (
            <>
              {headerControls.prefix}
              <input
                className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
                placeholder={headerControls.placeholderNombre}
                value={headerControls.nombre ?? ""}
                onChange={(e) => headerControls.onChangeNombre(e.target.value)}
                onBlur={headerControls.onBlurNombre}
              />
              {headerControls.extra}
              <div className="shrink-0 flex items-center gap-1.5">
                <SaveIndicator status={headerControls.status} />
                <button
                  type="button"
                  onClick={headerControls.onEliminar}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
                >
                  <Trash2 size={10} />
                </button>
                <button
                  type="button"
                  disabled={headerControls.status === "saving"}
                  onClick={headerControls.onGuardar}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
                >
                  <Save size={10} /> Guardar
                </button>
              </div>
            </>
          ) : (
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                background: "color-mix(in srgb, var(--primary) 8%, transparent)",
                borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
              }}
            >
              <Atom className="text-primary/50" size={12} />
            </div>
          )}
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <ElementoEditor
            key={elemento.id}
            elemento={elemento}
            todosLosElementos={todosLosElementos}
            onBack={onCerrar}
            onActualizar={onActualizar}
            onEliminar={
              onEliminar
                ? (id) => {
                    onEliminar(id);
                  }
                : undefined
            }
            onHeaderControlsChange={setHeaderControls}
            compuestos={compuestos}
            onNavigateCompuesto={onNavigateCompuesto}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Reglas: reglas de la Química, editable desde Supabase ────────────────
// Solo lo propio de acá (estructura de capas, estabilidad/familias,
// manifestaciones) — la jerarquía Partícula Base→Partículas→Iums y la
// resonancia con Iums ya se explican en la sección Física, no se repiten.
//
// El contenido (lista de secciones título+texto) ya no está hardcodeado:
// vive en la tabla `config_info_tabla_quimica` (useInfoTablaQuimica). Se
// muestran todas las secciones de una, siempre editables inline (sin modo
// lectura/edición ni barra lateral) — cada cambio se guarda automáticamente
// al salir del campo (onBlur).
function ReglasQuimica({
  info,
  loading,
  guardarSecciones,
}: {
  info: { secciones: SeccionInfoTablaQuimica[] };
  loading: boolean;
  guardarSecciones: (secciones: SeccionInfoTablaQuimica[]) => Promise<void>;
}) {
  const [borrador, setBorrador] = useState<SeccionInfoTablaQuimica[]>(info.secciones);
  const [saving, setSaving] = useState(false);

  // Sincroniza el borrador cuando cambian los datos remotos (primera carga,
  // o si se recargan tras guardar).
  const infoSeccionesRef = useRef(info.secciones);
  if (infoSeccionesRef.current !== info.secciones) {
    infoSeccionesRef.current = info.secciones;
    if (borrador !== info.secciones) setBorrador(info.secciones);
  }

  function actualizarSeccion(id: string, cambios: Partial<SeccionInfoTablaQuimica>) {
    setBorrador((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
  }

  async function persistir(secciones: SeccionInfoTablaQuimica[]) {
    setSaving(true);
    try {
      // Descarta secciones vacías (título y contenido en blanco) al guardar.
      const limpio = secciones.filter((s) => s.titulo.trim() || s.contenido.trim());
      await guardarSecciones(limpio);
    } finally {
      setSaving(false);
    }
  }

  function eliminarSeccion(id: string) {
    const siguiente = borrador.filter((s) => s.id !== id);
    setBorrador(siguiente);
    void persistir(siguiente);
  }

  function agregarSeccion() {
    setBorrador((prev) => [
      ...prev,
      { id: `seccion-${Date.now()}`, titulo: "", contenido: "" },
    ]);
  }

  return (
    <div className="p-3">
      <div className="shrink-0 flex items-center justify-between pb-3">
        <div className="text-primary/40">
          <p className="text-micro font-black uppercase tracking-widest">
            Reglas
            {saving && <Loader2 className="inline-block animate-spin ml-1.5 align-[-2px]" size={10} />}
          </p>
        </div>
        <button
          type="button"
          onClick={agregarSeccion}
          title="Agregar sección"
          className="flex items-center justify-center w-5 h-5 rounded-md text-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
        >
          <Plus size={12} />
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-sm text-primary/30 text-center">Cargando…</div>
      ) : (
        <div className="columns-1 lg:columns-2 gap-x-10">
          {borrador.map((seccion) => (
            <div
              key={seccion.id}
              className="group break-inside-avoid mb-7 pb-6 border-b border-primary/10 last:border-b-0 flex flex-col gap-2"
            >
              <div className="flex items-center gap-1.5">
                <input
                  value={seccion.titulo}
                  onChange={(e) => actualizarSeccion(seccion.id, { titulo: e.target.value })}
                  onBlur={() => persistir(borrador)}
                  placeholder="Título"
                  className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-sm font-black uppercase tracking-[0.15em] text-primary/70 outline-none placeholder:text-primary/25 placeholder:normal-case placeholder:font-normal"
                />
                <button
                  type="button"
                  onClick={() => eliminarSeccion(seccion.id)}
                  title="Eliminar sección"
                  className="shrink-0 flex items-center justify-center w-6 h-6 rounded text-primary/0 group-hover:text-primary/30 hover:!text-red-400 transition-all cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <RichEditor
                minHeight="6rem"
                placeholder="Contenido…"
                value={seccion.contenido}
                onChange={(v) => {
                  const siguiente = borrador.map((s) =>
                    s.id === seccion.id ? { ...s, contenido: v } : s
                  );
                  setBorrador(siguiente);
                  void persistir(siguiente);
                }}
              />
            </div>
          ))}

          {borrador.length === 0 && (
            <button
              type="button"
              onClick={agregarSeccion}
              className="text-sm text-primary/30 hover:text-primary/60 transition-all cursor-pointer"
            >
              + Agregar sección
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dropdown genérico para el botón "Descargar" ───────────────────────────
// Botón icon-only que al hacer click despliega un menú con las opciones de
// descarga. Se cierra al elegir una opción o al hacer click afuera.
function DropdownDescargar({
  opciones,
}: {
  opciones: { key: string; label: string; onClick: () => void }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function handleClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Descargar datos"
        className="flex items-center justify-center p-1.5 rounded-md border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
      >
        <Download size={14} />
      </button>

      {abierto && (
        <div
          style={{ background: "var(--white-custom, var(--bg-main))" }}
          className="absolute right-0 top-full mt-1 z-20 min-w-[10rem] rounded-md border border-primary/15 shadow-lg overflow-hidden"
        >
          {opciones.map((op) => (
            <button
              key={op.key}
              type="button"
              onClick={() => {
                op.onClick();
                setAbierto(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-micro font-black uppercase tracking-wide text-primary/60 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
            >
              {op.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ElementosPage({
  elementos,
  loading,
  creating,
  onCreate,
  onActualizar,
  onEliminar,
  onEliminarVarios,
  seleccionarId,
  onImportarElementos,
  onActualizarVarios,
  onSeleccionarIdChange,
}: Props) {
  const [seleccionadoId, setSeleccionadoIdRaw] = useState<string | null>(null);
  const setSeleccionadoId = (
    valor: string | null | ((actual: string | null) => string | null),
  ) => {
    setSeleccionadoIdRaw((actual) => {
      const nuevo = typeof valor === "function" ? valor(actual) : valor;
      onSeleccionarIdChange?.(nuevo);
      return nuevo;
    });
  };
  // Al clickear un compuesto en "Usado en compuestos" desde el editor de un
  // Elemento: cierra el panel de Elemento y fuerza la apertura de este
  // compuesto en CompuestosPage (más abajo en la misma página).
  const [compuestoAAbrir, setCompuestoAAbrir] = useState<string | null>(null);
  const [seleccionMultiple, setSeleccionMultiple] = useState<Set<string>>(new Set());
  const [eliminandoVarios, setEliminandoVarios] = useState(false);

  function toggleSeleccionMultiple(id: string) {
    setSeleccionMultiple((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClickCasilla(id: string, e: React.MouseEvent) {
    if (e.shiftKey) {
      // Shift+Click: no abre el panel de detalle, solo marca/desmarca
      // para el borrado en lote.
      toggleSeleccionMultiple(id);
      return;
    }
    // Click normal: comportamiento de siempre (abrir/cerrar detalle),
    // y limpia cualquier selección múltiple activa para no mezclar modos.
    setSeleccionMultiple(new Set());
    setSeleccionadoId((actual) => (actual === id ? null : id));
  }

  async function handleEliminarSeleccionMultiple() {
    const ids = Array.from(seleccionMultiple);
    if (ids.length === 0) return;
    const confirmado = window.confirm(
      `¿Eliminar ${ids.length} elemento${ids.length === 1 ? "" : "s"}? Esta acción no se puede deshacer.`,
    );
    if (!confirmado) return;

    setEliminandoVarios(true);
    try {
      if (onEliminarVarios) {
        await onEliminarVarios(ids);
      } else if (onEliminar) {
        // Fallback: sin batch delete disponible, se borra uno por uno.
        for (const id of ids) {
          await onEliminar(id);
        }
      }
      setSeleccionMultiple(new Set());
    } catch (e) {
      console.error("[ElementosPage] error eliminando selección múltiple:", e);
    } finally {
      setEliminandoVarios(false);
    }
  }
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
      const { elementosNuevos, elementosActualizar } = parsearArchivoElementosJSON(texto, elementos);

      if (elementosNuevos.length === 0 && elementosActualizar.length === 0) {
        setMensajeImportacion("El archivo no traía elementos.");
        return;
      }

      const partes: string[] = [];

      if (elementosNuevos.length > 0) {
        const insertados = await onImportarElementos(elementosNuevos);
        partes.push(`${insertados} elemento${insertados === 1 ? "" : "s"} nuevo${insertados === 1 ? "" : "s"} subido${insertados === 1 ? "" : "s"}.`);
      }

      if (elementosActualizar.length > 0) {
        if (onActualizarVarios) {
          const actualizados = await onActualizarVarios(elementosActualizar);
          partes.push(`${actualizados} elemento${actualizados === 1 ? "" : "s"} existente${actualizados === 1 ? "" : "s"} actualizado${actualizados === 1 ? "" : "s"}.`);
        } else {
          partes.push(`${elementosActualizar.length} ya existían y no se actualizaron (falta onActualizarVarios).`);
        }
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

  // ── Compuestos / Reglas: ahora apiladas verticalmente debajo de
  // Elementos en este mismo bloque "Química", sin selector de tabs ─────────
  // Fase 2 del rediseño: useCompuestosConElementos reconstruye
  // "componentes" desde la tabla relacional compuesto_elementos en vez de
  // leer compuestos.componentes (jsonb, @deprecated). Mismo shape de
  // retorno (items/setItems/loading) que useCompuestos — el resto de esta
  // página y CompuestosPage no necesitan cambios.
  const {
    items: compuestos,
    setItems: setCompuestos,
    loading: loadingCompuestos,
  } = useCompuestosConElementos();
  const [creatingCompuesto, setCreatingCompuesto] = useState(false);
  const [compuestoRecienCreadoId, setCompuestoRecienCreadoId] = useState<string | null>(null);

  async function handleCreateCompuesto() {
    setCreatingCompuesto(true);
    try {
      // Fase 2: ya no se manda componentes: [] al jsonb (deprecado) — el
      // compuesto nace sin composición y se completa por
      // sincronizarComponentesCompuesto cuando el usuario agrega elementos
      // desde el editor (ver CompuestoEditor.persist).
      const { data, error } = await supabase
        .from("compuestos")
        .insert([{ nombre: "Nuevo compuesto", simbolo: "??" }])
        .select()
        .single();
      if (error) throw error;
      const nuevoCompuesto = { ...(data as Compuesto), componentes: [] };
      setCompuestos((prev) => [...prev, nuevoCompuesto]);
      setCompuestoRecienCreadoId(nuevoCompuesto.id);
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
      // Fase 2 del rediseño: el insert base ya NO manda componentes al
      // jsonb — se crea la fila "vacía" y la composición real se escribe
      // en compuesto_elementos vía sincronizarComponentesCompuesto, mismo
      // criterio que CompuestoEditor.persist(). El Laboratorio (origen de
      // este flujo) sigue mandando "componentes" en datos porque el tipo
      // Pick<Compuesto,...> no cambió — solo cambia dónde termina viviendo.
      const { componentes, ...datosBase } = datos;
      const { data, error } = await supabase
        .from("compuestos")
        .insert([datosBase])
        .select()
        .single();
      if (error) throw error;

      const nuevoCompuesto = data as Compuesto;

      if (componentes && componentes.length > 0) {
        const ok = await sincronizarComponentesCompuesto(nuevoCompuesto.id, componentes);
        if (!ok) throw new Error("no se pudo guardar la composición del compuesto nuevo");
      }

      setCompuestos((prev) => [...prev, { ...nuevoCompuesto, componentes: componentes ?? [] }]);
      setCompuestoRecienCreadoId(nuevoCompuesto.id);
    } catch (e) {
      console.error("[ElementosPage] error creando compuesto combinado:", e);
    } finally {
      setCreatingCompuesto(false);
    }
  }

  // ── Reacciones: catálogo de recetas reutilizables de consume/produce,
  // apilado debajo de Grupos de Compuestos ────────────────────────────────
  const {
    items: reacciones,
    setItems: setReacciones,
    loading: loadingReacciones,
  } = useReacciones();
  const [creatingReaccion, setCreatingReaccion] = useState(false);

  async function handleCreateReaccion() {
    setCreatingReaccion(true);
    try {
      const { data, error } = await supabase
        .from("reacciones")
        .insert([{ nombre: "Nueva reacción" }])
        .select()
        .single();
      if (error) throw error;
      setReacciones((prev) => [...prev, data as Reaccion]);
    } catch (e) {
      console.error("[ElementosPage] error creando reacción:", e);
    } finally {
      setCreatingReaccion(false);
    }
  }

  async function handleEliminarReaccion(id: string) {
    try {
      const { error } = await supabase.from("reacciones").delete().eq("id", id);
      if (error) throw error;
      setReacciones((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("[ElementosPage] error eliminando reacción:", e);
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
      {/* Elementos */}
      <div className="flex flex-col">
        <div className="shrink-0 px-3 pt-3 text-primary/40">
          <p className="text-micro font-black uppercase tracking-widest">Elementos</p>
        </div>
        <div className="flex relative">
      <div className="flex-1 p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div />
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
              className="flex items-center justify-center p-1.5 rounded-md border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <GitCompare size={14} />
            </button>
            <DropdownDescargar
              opciones={[
                {
                  key: "todo",
                  label: "Descargar todo",
                  onClick: () => descargarDatosElementos(elementos, infoTabla.secciones, compuestos),
                },
                {
                  key: "elementos-compuestos",
                  label: "Elementos y Compuestos",
                  onClick: () => descargarElementosYCompuestos(elementos, compuestos),
                },
                {
                  key: "reglas",
                  label: "Reglas",
                  onClick: () => descargarReglas(infoTabla.secciones),
                },
              ]}
            />
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
                  title='Subir un JSON con elementos: crea los nuevos y actualiza los existentes (mismo número atómico), mismo formato que "Descargar datos"'
                  className="flex items-center justify-center p-1.5 rounded-md border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {importando ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                </button>
              </>
            )}
            {onCreate && (
              <button
                type="button"
                disabled={creating}
                onClick={onCreate}
                title="Nuevo elemento"
                className="flex items-center justify-center p-1.5 rounded-md bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              </button>
            )}
          </div>
        </div>

        {seleccionMultiple.size > 0 && (
          <div className="text-micro font-black uppercase tracking-wide bg-primary/10 border border-primary/20 rounded-md px-2 py-1.5 flex items-center justify-between gap-2">
            <span className="text-primary/70">
              {seleccionMultiple.size} elemento{seleccionMultiple.size === 1 ? "" : "s"} seleccionado
              {seleccionMultiple.size === 1 ? "" : "s"}
              <span className="font-normal normal-case tracking-normal text-primary/40">
                {" "}
                — Shift+Click para agregar o quitar más
              </span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSeleccionMultiple(new Set())}
                className="text-primary/40 hover:text-primary/70 cursor-pointer px-1.5 py-0.5"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={eliminandoVarios || (!onEliminarVarios && !onEliminar)}
                onClick={handleEliminarSeleccionMultiple}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-btn-text bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {eliminandoVarios ? <Loader2 className="animate-spin" size={10} /> : <Trash2 size={10} />}
                Eliminar seleccionados
              </button>
            </div>
          </div>
        )}

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
            {gruposPeriodicos.map(({ familia, elementos: elsDeFamilia }) => (
              <div key={familia} className="flex flex-col gap-1">
                <p className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: FAMILY_COLOR[familia].text }}
                  />
                  {familia} · {elsDeFamilia.length} elemento{elsDeFamilia.length === 1 ? "" : "s"}
                </p>
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
                >
                  {elsDeFamilia.map((el) => (
                    <ElementoCasilla
                      key={el.id}
                      elemento={el}
                      seleccionado={el.id === activoId}
                      enSeleccionMultiple={seleccionMultiple.has(el.id)}
                      onClick={(e) => handleClickCasilla(el.id, e)}
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
                enSeleccionMultiple={seleccionMultiple.has(el.id)}
                onClick={(e) => handleClickCasilla(el.id, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel flotante centrado: mismo patrón que PanelFlotanteGlobal usa
          para Personaje/Criatura (ver usePanelFlotanteStore) — modal grande
          centrado en pantalla con backdrop blur, en vez de drawer lateral.
          Se cierra con click en el backdrop, Escape, o el botón X. */}
      {activo && (
        <ElementoPanelFlotante
          elemento={activo}
          todosLosElementos={elementos}
          onCerrar={() => setSeleccionadoId(null)}
          onActualizar={onActualizar}
          onEliminar={
            onEliminar
              ? (id) => {
                  onEliminar(id);
                  setSeleccionadoId(null);
                }
              : undefined
          }
          compuestos={compuestos}
          onNavigateCompuesto={(compuestoId) => {
            setSeleccionadoId(null);
            setCompuestoAAbrir(compuestoId);
          }}
        />
      )}
        </div>
      </div>

      {/* Compuestos */}
      <div className="flex flex-col border-t border-primary/10">
        <div className="shrink-0 px-3 pt-3 text-primary/40">
          <p className="text-micro font-black uppercase tracking-widest">Compuestos</p>
        </div>
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
          seleccionarId={compuestoAAbrir ?? compuestoRecienCreadoId}
          onSeleccionarIdConsumido={() => {
            setCompuestoAAbrir(null);
            setCompuestoRecienCreadoId(null);
          }}
        />
      </div>

      {/* Reacciones */}
      <div className="flex flex-col border-t border-primary/10">
        <ReaccionesPage
          reacciones={reacciones}
          compuestos={compuestos}
          elementos={elementos}
          loading={loadingReacciones}
          creating={creatingReaccion}
          onCreate={handleCreateReaccion}
          onActualizar={(id, cambios) =>
            setReacciones((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)))
          }
          onEliminar={handleEliminarReaccion}
          onAbrirItem={(item) =>
            item.tipo === "compuesto"
              ? setCompuestoAAbrir(item.id)
              : setSeleccionadoId(item.id)
          }
        />
      </div>

      {/* Reglas */}
      <div className="flex flex-col border-t border-primary/10">
        <div className="shrink-0 flex items-center gap-1.5 px-3 pt-3 text-primary/40">
          <Scale size={12} />
          <p className="text-micro font-black uppercase tracking-widest">Reglas</p>
        </div>
        <ReglasQuimica
          info={infoTabla}
          loading={loadingInfoTabla}
          guardarSecciones={guardarSecciones}
        />
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

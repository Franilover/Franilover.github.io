"use client";

/**
 * PersonajeLineaDeTiempo.tsx
 * ──────────────────────────
 * UI de la línea de tiempo de eras de un personaje.
 *   - Por defecto (si hay cumpleaños + calendario) las eras se agrupan
 *     primero por ETAPA DE VIDA (Bebé, Infancia, Niñez, Adolescencia,
 *     Adultez, Vejez — ver ETAPAS_VIDA) según la edad calculada de cada
 *     era. Cada etapa se muestra siempre, aunque esté vacía, con su
 *     propio botón "+ Era" para crear una directamente dentro de ella.
 *   - Dentro de cada etapa, las eras se agrupan en "carriles" por año,
 *     siguiendo el mismo patrón visual que `ListaEventosConMinimapa` en
 *     EditorLineaTiempo.tsx: el año como encabezado arriba, y debajo sus
 *     eras como botones compactos dispuestos en fila horizontal; los
 *     carriles se disponen lado a lado hasta el borde del contenedor y
 *     continúan en la siguiente línea (wrap).
 *   - Sin cumpleaños o sin calendario no se puede calcular edad, así
 *     que se cae a un listado plano de carriles por año (comportamiento
 *     previo) sin agrupar por etapas.
 *   - El bloque "Nacimiento" es clickeable: abre el mismo selector para
 *     editar la fecha de nacimiento ya asignada (no solo para asignarla
 *     por primera vez).
 *   - Al hacer click en una era se abre un panel de detalle FLOTANTE
 *     (portal, anclado al botón clickeado) con la edición completa:
 *     fecha, edad, título, rasgos y notas. El panel no empuja el layout.
 *
 * Toda la lógica de datos vive en useErasDelPersonaje.
 *
 * NOTA DE ARQUITECTURA: este componente depende de FechaMundoBadge,
 * SelectorFechaMundo y useCalendario, que hoy viven en
 * `features/editorGarlia/views/EditorLineaTiempo.tsx`. Un componente
 * NO puede importar de `views/` (regla de zona). Esas tres piezas
 * deberían moverse a `features/editorGarlia/components/CalendarioMundo.tsx`
 * (son reutilizables, no exclusivas de una pantalla) y la view
 * reexportarlas si necesita mantener compatibilidad. Mientras esa
 * extracción no se haga, este import es una violación pendiente —
 * señalada aquí a propósito en vez de ocultarla.
 *
 * Ruta: src/features/editorGarlia/components/personajes/PersonajeLineaDeTiempo.tsx
 */

import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  FechaMundoBadge,
  SelectorFechaMundo,
  useCalendario,
} from "@/domains/garlia/_legacy/components/shared/CalendarioMundo";
import {
  type Era,
  useErasDelPersonaje,
} from "@/domains/garlia/_legacy/hooks/personajes/useErasDelPersonaje";
import { useGuardarCumpleanos } from "@/domains/garlia/_legacy/hooks/personajes/useGuardarCumpleanos";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularEdad(
  diaAbsolutoEra: number,
  diaAbsolutoNacimiento: number,
  diasPorAnio: number,
): number {
  if (diasPorAnio <= 0) return 0;
  return Math.floor((diaAbsolutoEra - diaAbsolutoNacimiento) / diasPorAnio);
}

// Dada una nueva edad deseada, calcula el nuevo día absoluto manteniendo
// el mismo desfase dentro del año (mismo día/estación) que la era ya
// tenía — solo se "mueve" el año. Es lo que permite que editar la edad
// recalcule la fecha bajando (o subiendo) los años correctamente.
function momentoParaEdad(
  edad: number,
  diaAbsolutoNacimiento: number,
  diasPorAnio: number,
  desfaseActual: number,
): number {
  return diaAbsolutoNacimiento + edad * diasPorAnio + desfaseActual;
}

const LINE_COLOR = "color-mix(in srgb, var(--primary) 10%, transparent)";
const FIELD_BG = "color-mix(in srgb, var(--primary) 3%, transparent)";

// Ancho fijo de cada botón de era en el carril horizontal.
const ANCHO_ERA_BTN = 150;

// ─── Etapas de vida ───────────────────────────────────────────────────────────
// Agrupación por defecto de la línea de tiempo: en vez de un único listado
// de carriles por año, las eras se organizan primero por etapa de vida
// (según la edad calculada de cada era) y, dentro de cada etapa, por año
// (mismos carriles de siempre). `max: null` = sin tope superior.
type EtapaVida = { id: string; label: string; min: number; max: number | null };

const ETAPAS_VIDA: EtapaVida[] = [
  { id: "bebe", label: "Bebé", min: 0, max: 1 },
  { id: "infancia", label: "Infancia", min: 2, max: 6 },
  { id: "ninez", label: "Niñez", min: 7, max: 12 },
  { id: "adolescencia", label: "Adolescencia", min: 13, max: 17 },
  { id: "adultez", label: "Adultez", min: 18, max: 64 },
  { id: "vejez", label: "Vejez", min: 65, max: null },
];

function etapaLabelConRango(etapa: EtapaVida): string {
  return etapa.max == null
    ? `${etapa.label} (${etapa.min}+)`
    : `${etapa.label} (${etapa.min}-${etapa.max})`;
}

function etapaParaEdad(edad: number): EtapaVida {
  return (
    ETAPAS_VIDA.find((e) => edad >= e.min && (e.max == null || edad <= e.max)) ??
    ETAPAS_VIDA[ETAPAS_VIDA.length - 1]
  );
}

// ─── EraBoton ─────────────────────────────────────────────────────────────────
// Botón compacto: lo que se ve en el carril horizontal. Sin edición inline —
// toda la edición vive en el panel flotante que se abre al hacer click.

function EraBoton({
  era,
  edad,
  isSel,
  onClick,
  btnRef,
}: {
  era: Era;
  edad: number | null;
  isSel: boolean;
  onClick: () => void;
  btnRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={btnRef}
      className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg text-left transition-all min-w-0 shrink-0"
      style={{
        width: ANCHO_ERA_BTN,
        background: isSel
          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
          : "color-mix(in srgb, var(--primary) 2%, transparent)",
        border: `1px solid ${
          isSel
            ? "color-mix(in srgb, var(--accent) 32%, transparent)"
            : "color-mix(in srgb, var(--primary) 8%, transparent)"
        }`,
      }}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-center gap-1 min-w-0">
        <Clock
          className="shrink-0"
          size={9}
          style={{
            color: isSel
              ? "var(--accent)"
              : "color-mix(in srgb, var(--primary) 35%, transparent)",
          }}
        />
        <span
          className="text-micro font-bold truncate flex-1"
          style={{
            color: isSel
              ? "var(--primary)"
              : "color-mix(in srgb, var(--primary) 65%, transparent)",
          }}
        >
          {era.label || <span className="italic opacity-40">Sin título</span>}
        </span>
        {era._saving && (
          <Loader2 className="animate-spin shrink-0 text-primary/30" size={8} />
        )}
      </div>
      {edad !== null && edad >= 0 && (
        <span
          className="text-micro font-black tabular-nums"
          style={{ color: "color-mix(in srgb, var(--accent) 60%, transparent)" }}
        >
          {edad} {edad === 1 ? "año" : "años"}
        </span>
      )}
      {era.rasgos.length > 0 && (
        <span className="text-micro text-primary/35 truncate">
          {era.rasgos.slice(0, 3).join(" · ")}
        </span>
      )}
    </button>
  );
}

// ─── EraDetalleFlotante ───────────────────────────────────────────────────────
// Panel de edición completo, anclado (portal) al botón de era clickeado.
// Mismo mecanismo que EventoDetalleFlotante en EditorLineaTiempo.tsx.

function EraDetalleFlotante({
  anchorEl,
  era,
  edad,
  fechaNacimiento,
  diasPorAnio,
  onClose,
  onDelete,
  onAddRasgo,
  onRemoveRasgo,
  onNotasChange,
  onLabelChange,
  onMomentoChange,
}: {
  anchorEl: HTMLElement | null;
  era: Era;
  edad: number | null;
  fechaNacimiento: number | null;
  diasPorAnio: number;
  onClose: () => void;
  onDelete: () => void;
  onAddRasgo: (r: string) => void;
  onRemoveRasgo: (r: string) => void;
  onNotasChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onMomentoChange: (nuevoMomento: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const [nuevoRasgo, setNuevoRasgo] = useState("");
  const [edadStr, setEdadStr] = useState(edad != null ? String(edad) : "");
  const [edadFocused, setEdadFocused] = useState(false);

  const puedeEditarEdad = fechaNacimiento != null && diasPorAnio > 0;

  useEffect(() => {
    if (!edadFocused) setEdadStr(edad != null ? String(edad) : "");
  }, [edad, edadFocused]);

  const commitEdad = () => {
    if (!puedeEditarEdad) return;
    const nuevaEdad = parseInt(edadStr, 10);
    if (isNaN(nuevaEdad) || nuevaEdad < 0 || nuevaEdad === edad) {
      setEdadStr(edad != null ? String(edad) : "");
      return;
    }
    const desfase =
      diasPorAnio > 0
        ? ((era.momento - (fechaNacimiento as number)) % diasPorAnio +
            diasPorAnio) %
          diasPorAnio
        : 0;
    onMomentoChange(
      momentoParaEdad(nuevaEdad, fechaNacimiento as number, diasPorAnio, desfase),
    );
  };

  // Posicionamiento contra el ancla — igual patrón que EventoDetalleFlotante.
  useEffect(() => {
    if (!anchorEl) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      const w = Math.min(Math.max(r.width, 280), 340);
      let left = r.left;
      if (left + w > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - w - 8);
      }
      const estimatedH = 360;
      const spaceBelow = window.innerHeight - r.bottom;
      const top =
        spaceBelow < estimatedH && r.top > estimatedH
          ? Math.max(8, r.top - estimatedH - 6)
          : r.bottom + 6;
      setPos({ top, left, width: w });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorEl, era.id]);

  // Cerrar al click afuera o Escape.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorEl, onClose]);

  if (!pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] rounded-xl border shadow-lg p-3 space-y-2.5"
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: "70vh",
        overflowY: "auto",
        background: "var(--bg-main)",
        borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
      }}
    >
      {/* Cabecera: fecha + edad + cerrar */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5 flex-1">
          <SelectorFechaMundo
            placeholder="Fecha…"
            value={era.momento}
            onChange={(dia) => {
              if (dia != null) onMomentoChange(dia);
            }}
          />
          {puedeEditarEdad && (
            <div className="flex items-center gap-1">
              <input
                className="w-14 rounded-md px-1.5 py-0.5 text-micro font-black tabular-nums text-center outline-none transition-colors"
                min={0}
                style={{
                  background: FIELD_BG,
                  color: "color-mix(in srgb, var(--accent) 80%, transparent)",
                }}
                type="number"
                value={edadStr}
                onChange={(e) => setEdadStr(e.target.value)}
                onFocus={() => setEdadFocused(true)}
                onBlur={() => {
                  setEdadFocused(false);
                  commitEdad();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape")
                    setEdadStr(edad != null ? String(edad) : "");
                }}
              />
              <span
                className="text-micro font-bold"
                style={{
                  color: "color-mix(in srgb, var(--accent) 60%, transparent)",
                }}
              >
                {edad === 1 ? "año" : "años"}
              </span>
            </div>
          )}
        </div>
        <button
          className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md text-primary/25 hover:text-primary transition-colors"
          type="button"
          onClick={onClose}
        >
          <X size={12} />
        </button>
      </div>

      {/* Título */}
      <input
        className="w-full rounded-md border px-2 py-1.5 text-micro font-bold outline-none transition-colors placeholder:font-normal placeholder:text-primary/25"
        maxLength={60}
        placeholder="Nombre del período…"
        style={{
          background: "transparent",
          borderColor: LINE_COLOR,
          color: "var(--primary)",
        }}
        type="text"
        value={era.label}
        onChange={(e) => onLabelChange(e.target.value)}
      />

      {/* Rasgos */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <input
            className="flex-1 min-w-0 rounded-md border px-2 py-1.5 text-micro outline-none transition-colors placeholder:text-primary/25"
            maxLength={40}
            placeholder="Añadir rasgo…"
            style={{
              background: "transparent",
              borderColor: LINE_COLOR,
              color: "var(--primary)",
            }}
            type="text"
            value={nuevoRasgo}
            onChange={(e) => setNuevoRasgo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nuevoRasgo.trim()) {
                e.preventDefault();
                onAddRasgo(nuevoRasgo);
                setNuevoRasgo("");
              }
              if (e.key === "Escape") setNuevoRasgo("");
            }}
          />
          <button
            className="shrink-0 flex items-center justify-center rounded-md transition-colors disabled:opacity-20"
            disabled={!nuevoRasgo.trim()}
            style={{
              width: 26,
              height: 26,
              color: "var(--primary)",
              border: `1px solid ${LINE_COLOR}`,
            }}
            type="button"
            onClick={() => {
              onAddRasgo(nuevoRasgo);
              setNuevoRasgo("");
            }}
          >
            <Plus size={12} />
          </button>
        </div>
        {era.rasgos.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {era.rasgos.map((rasgo) => (
              <span
                key={rasgo}
                className="group flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded text-micro"
                style={{
                  background: "color-mix(in srgb, var(--primary) 6%, transparent)",
                  color: "color-mix(in srgb, var(--primary) 60%, transparent)",
                }}
              >
                {rasgo}
                <button
                  className="opacity-30 hover:opacity-100 transition-opacity"
                  type="button"
                  onClick={() => onRemoveRasgo(rasgo)}
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Notas */}
      <textarea
        className="w-full rounded-md border px-2 py-1.5 text-micro leading-relaxed outline-none transition-colors resize-none placeholder:text-primary/20"
        placeholder="Notas sobre este momento…"
        rows={3}
        style={{
          background: "transparent",
          borderColor: LINE_COLOR,
          color: "var(--primary)",
        }}
        value={era.notas}
        onChange={(e) => onNotasChange(e.target.value)}
      />

      {/* Eliminar */}
      <div className="flex justify-end pt-0.5">
        <button
          className="flex items-center gap-1 px-1.5 py-1 rounded-md text-micro text-primary/30 hover:text-accent transition-colors"
          type="button"
          onClick={onDelete}
        >
          <Trash2 size={11} /> Eliminar era
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ─── Selector de cumpleaños inline ────────────────────────────────────────────

function SelectorCumple({
  draft,
  saving,
  onChange,
  onCancel,
  onGuardar,
}: {
  draft: number | null;
  saving: boolean;
  onChange: (dia: number | null) => void;
  onCancel: () => void;
  onGuardar: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex-1 min-w-0">
        <SelectorFechaMundo
          placeholder="Seleccionar cumpleaños…"
          value={draft}
          onChange={onChange}
        />
      </div>
      <div className="flex gap-1.5 justify-end shrink-0">
        <button
          className="px-2.5 py-1 rounded-lg text-micro text-primary/40 hover:text-primary transition-colors"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-bold transition-colors disabled:opacity-30"
          disabled={draft == null || saving}
          style={{
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: "var(--accent)",
          }}
          type="button"
          onClick={onGuardar}
        >
          {saving ? (
            <Loader2 className="animate-spin" size={10} />
          ) : (
            <Check size={10} />
          )}{" "}
          Guardar
        </button>
      </div>
    </div>
  );
}

// ─── PersonajeLineaDeTiempo ───────────────────────────────────────────────────

export function PersonajeLineaDeTiempo({
  personajeId,
  fechaNacimiento,
  onFechaNacimientoChange,
}: {
  personajeId: string;
  fechaNacimiento?: number | null;
  onFechaNacimientoChange?: (dia: number | null) => void;
}) {
  const { cal } = useCalendario();
  const diasPorAnio = useMemo(() => {
    if (!cal?.estaciones?.length) return 0;
    return cal.estaciones.reduce(
      (sum: number, e: { duracion_dias?: number }) =>
        sum + (e.duracion_dias ?? 0),
      0,
    );
  }, [cal]);

  const {
    eras,
    loading,
    creating,
    addEra,
    deleteEra,
    addRasgo,
    removeRasgo,
    changeNotas,
    changeLabel,
    changeMomento,
    reajustarErasPorNuevaFecha,
  } = useErasDelPersonaje(personajeId, fechaNacimiento);

  const { guardar: guardarCumple, saving: savingCumple } =
    useGuardarCumpleanos(personajeId, onFechaNacimientoChange);

  const [addingNew, setAddingNew] = useState(false);
  const [newMomento, setNewMomento] = useState("");
  const [newLabel, setNewLabel] = useState("");
  // Etapa desde la que se abrió el formulario "+ Era" (null = botón global
  // de la cabecera). Solo se usa para prefijar la fecha sugerida y mostrar
  // un rótulo con contexto en el formulario.
  const [addingEtapa, setAddingEtapa] = useState<EtapaVida | null>(null);

  const [cumpleSelectorOpen, setCumpleSelectorOpen] = useState(false);
  const [cumpleDraft, setCumpleDraft] = useState<number | null>(null);

  // Edición rápida del cumpleaños desde el lápiz del bloque "Nacimiento":
  // va directo al selector de fecha (sin la fila de Cancelar/Guardar, que
  // no tiene sentido cuando el único campo a editar es la fecha).
  const [cumpleQuickEdit, setCumpleQuickEdit] = useState(false);

  // Etapas colapsadas manualmente por el usuario (por defecto todas abiertas).
  const [etapasColapsadas, setEtapasColapsadas] = useState<Set<string>>(
    new Set(),
  );

  const [selId, setSelId] = useState<string | null>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleAddEra = async () => {
    const num = parseInt(newMomento.trim(), 10);
    const era = await addEra(num, newLabel);
    if (era) setSelId(era.id);
    setNewMomento("");
    setNewLabel("");
    setAddingNew(false);
    setAddingEtapa(null);
  };

  const handleGuardarCumple = async () => {
    if (cumpleDraft == null) return;
    const fechaAnterior = fechaNacimiento;
    const ok = await guardarCumple(cumpleDraft);
    if (ok) {
      if (fechaAnterior != null && diasPorAnio > 0) {
        await reajustarErasPorNuevaFecha(fechaAnterior, cumpleDraft, diasPorAnio);
      }
      setCumpleSelectorOpen(false);
      setCumpleDraft(null);
    }
  };

  // El selector de edición rápida confirma solo (ver v3 de
  // SelectorFechaMundo: clickear un día ya es la acción final), así que acá
  // simplemente guardamos apenas llega el nuevo valor y cerramos.
  const handleGuardarCumpleRapido = async (dia: number | null) => {
    if (dia != null) {
      const fechaAnterior = fechaNacimiento;
      await guardarCumple(dia);
      if (fechaAnterior != null && diasPorAnio > 0) {
        await reajustarErasPorNuevaFecha(fechaAnterior, dia, diasPorAnio);
      }
    }
    setCumpleQuickEdit(false);
  };

  // Abre el formulario "+ Era" sugiriendo una fecha dentro de la etapa
  // indicada (el primer día de su edad mínima) para que crear una era
  // "dentro" de una sección quede lo más directo posible.
  const abrirFormularioEnEtapa = (etapa: EtapaVida | null) => {
    setAddingEtapa(etapa);
    if (etapa && fechaNacimiento != null && diasPorAnio > 0) {
      setNewMomento(String(fechaNacimiento + etapa.min * diasPorAnio));
    } else if (fechaNacimiento != null) {
      setNewMomento(String(fechaNacimiento));
    }
    setAddingNew(true);
  };

  const toggleEtapaColapsada = (id: string) => {
    setEtapasColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fechaInvalida =
    fechaNacimiento != null &&
    !!newMomento &&
    parseInt(newMomento, 10) <= fechaNacimiento;

  // ── Agrupar eras en carriles por año ──────────────────────────────────────
  // Mismo criterio que ListaEventosConMinimapa: eras consecutivas (la lista
  // ya viene ordenada por `momento`) del mismo año comparten carril; el año
  // se muestra una vez como encabezado y sus eras van en fila horizontal.
  type Carril = { anio: number | null; eras: Era[] };
  const carriles = useMemo<Carril[]>(() => {
    if (diasPorAnio <= 0 || fechaNacimiento == null) {
      // Sin calendario o sin cumpleaños no podemos calcular año — un único
      // carril "sin año" con todas las eras en fila.
      return eras.length ? [{ anio: null, eras }] : [];
    }
    const out: Carril[] = [];
    for (const era of eras) {
      const anio = Math.floor((era.momento - fechaNacimiento) / diasPorAnio);
      const last = out[out.length - 1];
      if (last && last.anio === anio) {
        last.eras.push(era);
      } else {
        out.push({ anio, eras: [era] });
      }
    }
    return out;
  }, [eras, diasPorAnio, fechaNacimiento]);

  // ── Agrupar carriles por etapa de vida (edad) ──────────────────────────────
  // Solo es posible con cumpleaños + calendario asignados (necesitamos poder
  // calcular la edad de cada era). Cada etapa siempre aparece — aunque no
  // tenga eras — para poder crearlas directamente "dentro" de ella.
  const puedeAgruparPorEtapa = fechaNacimiento != null && diasPorAnio > 0;
  type GrupoEtapa = { etapa: EtapaVida; carriles: Carril[] };
  const gruposPorEtapa = useMemo<GrupoEtapa[]>(() => {
    if (!puedeAgruparPorEtapa) return [];
    const porEtapa = new Map<string, Carril[]>();
    for (const carril of carriles) {
      if (carril.anio == null) continue;
      const etapa = etapaParaEdad(carril.anio);
      const list = porEtapa.get(etapa.id) ?? [];
      list.push(carril);
      porEtapa.set(etapa.id, list);
    }
    return ETAPAS_VIDA.map((etapa) => ({
      etapa,
      carriles: porEtapa.get(etapa.id) ?? [],
    }));
  }, [carriles, puedeAgruparPorEtapa]);

  const selEra = eras.find((e) => e.id === selId) ?? null;

  return (
    <div>
      {/* Cabecera */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-micro font-bold uppercase tracking-wider text-primary/35">
          Línea de tiempo
        </span>
        <span className="flex-1" />
        <button
          className="flex items-center gap-1 text-micro font-bold transition-colors"
          style={{
            color: addingNew
              ? "var(--accent)"
              : "color-mix(in srgb, var(--primary) 40%, transparent)",
          }}
          type="button"
          onClick={() => {
            if (addingNew) {
              setAddingNew(false);
              setAddingEtapa(null);
            } else {
              abrirFormularioEnEtapa(null);
            }
          }}
        >
          {addingNew ? <X size={11} /> : <Plus size={11} />} Era
        </button>
      </div>

      {/* Formulario de nueva era */}
      {addingNew && (
        <div
          className="mb-3 p-2.5 rounded-xl space-y-2"
          style={{ background: FIELD_BG }}
        >
          {addingEtapa && (
            <p
              className="text-micro font-bold"
              style={{ color: "color-mix(in srgb, var(--accent) 70%, transparent)" }}
            >
              Nueva era en {etapaLabelConRango(addingEtapa)}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <SelectorFechaMundo
                placeholder="Fecha…"
                value={newMomento ? parseInt(newMomento, 10) : null}
                onChange={(dia: number | null) =>
                  setNewMomento(dia != null ? String(dia) : "")
                }
              />
            </div>
            <input
              className="flex-1 min-w-0 rounded-md border px-2 py-1.5 text-micro outline-none transition-colors placeholder:text-primary/25"
              placeholder="Etiqueta (opcional)"
              style={{
                background: "var(--bg-main)",
                borderColor: LINE_COLOR,
                color: "var(--primary)",
              }}
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddEra();
                if (e.key === "Escape") setAddingNew(false);
              }}
            />
          </div>
          {fechaInvalida && (
            <p className="text-micro text-accent/70">
              La era debe ser posterior al cumpleaños
            </p>
          )}
          <div className="flex gap-1.5 justify-end">
            <button
              className="px-2.5 py-1 rounded-lg text-micro text-primary/40 hover:text-primary transition-colors"
              type="button"
              onClick={() => {
                setAddingNew(false);
                setAddingEtapa(null);
              }}
            >
              Cancelar
            </button>
            <button
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-micro font-bold transition-colors disabled:opacity-30"
              disabled={!newMomento.trim() || creating || fechaInvalida}
              style={{
                background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                color: "var(--primary)",
              }}
              type="button"
              onClick={handleAddEra}
            >
              {creating ? (
                <Loader2 className="animate-spin" size={10} />
              ) : (
                <Check size={10} />
              )}{" "}
              Crear
            </button>
          </div>
        </div>
      )}

      {/* Cumpleaños: sin fecha asignada, o editable con un click si ya la tiene */}
      {fechaNacimiento == null ? (
        <div className="mb-3">
          {!cumpleSelectorOpen ? (
            <button
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed text-micro font-bold transition-colors"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                color: "color-mix(in srgb, var(--accent) 65%, transparent)",
              }}
              type="button"
              onClick={() => setCumpleSelectorOpen(true)}
            >
              <CalendarPlus size={12} /> Asignar fecha de nacimiento
            </button>
          ) : (
            <SelectorCumple
              draft={cumpleDraft}
              saving={savingCumple}
              onCancel={() => {
                setCumpleSelectorOpen(false);
                setCumpleDraft(null);
              }}
              onChange={setCumpleDraft}
              onGuardar={handleGuardarCumple}
            />
          )}
        </div>
      ) : cumpleSelectorOpen ? (
        <div className="mb-3">
          <SelectorCumple
            draft={cumpleDraft}
            saving={savingCumple}
            onCancel={() => {
              setCumpleSelectorOpen(false);
              setCumpleDraft(null);
            }}
            onChange={setCumpleDraft}
            onGuardar={handleGuardarCumple}
          />
        </div>
      ) : null}

      {/* Contenido: por defecto agrupado en etapas de vida (Bebé, Infancia…);
          si no hay cumpleaños/calendario para calcular edades, cae al listado
          plano de carriles por año de siempre. */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-primary/20" size={14} />
        </div>
      ) : puedeAgruparPorEtapa ? (
        <div className="space-y-3">
          {/* Nacimiento — clickeable para editar la fecha existente, directo
              al selector de fecha (sin la fila de Cancelar/Guardar). */}
          <div className="relative" style={{ width: ANCHO_ERA_BTN }}>
            <button
              className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg text-left transition-colors w-full"
              style={{
                background: "color-mix(in srgb, var(--accent) 6%, transparent)",
                border: `1px solid color-mix(in srgb, var(--accent) 18%, transparent)`,
              }}
              type="button"
              onClick={() => setCumpleQuickEdit(true)}
            >
              <span className="flex items-center gap-1 text-micro font-bold" style={{ color: "var(--accent)" }}>
                Nacimiento
                <Pencil className="opacity-40" size={9} />
              </span>
              <span className="text-micro text-primary/40">
                <FechaMundoBadge diaAbsoluto={fechaNacimiento} />
              </span>
            </button>
            {cumpleQuickEdit && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="pointer-events-auto">
                  <SelectorFechaMundo
                    autoOpen
                    hideTrigger
                    value={fechaNacimiento}
                    onChange={handleGuardarCumpleRapido}
                    onOpenChange={(o) => {
                      if (!o) setCumpleQuickEdit(false);
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-row flex-wrap items-start gap-3">
            {gruposPorEtapa.map(({ etapa, carriles: carrilesEtapa }) => {
              const totalEras = carrilesEtapa.reduce(
                (n, c) => n + c.eras.length,
                0,
              );
              const colapsada = etapasColapsadas.has(etapa.id);
              return (
                <div
                  key={etapa.id}
                  className="rounded-xl border p-2 space-y-1.5"
                  style={{
                    borderColor: LINE_COLOR,
                    minWidth: ANCHO_ERA_BTN + 24,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      className="flex items-center gap-1 shrink-0"
                      type="button"
                      onClick={() => toggleEtapaColapsada(etapa.id)}
                    >
                      {colapsada ? (
                        <ChevronRight className="text-primary/30" size={11} />
                      ) : (
                        <ChevronDown className="text-primary/30" size={11} />
                      )}
                      <span
                        className="text-micro font-black uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{
                          color: "color-mix(in srgb, var(--primary) 55%, transparent)",
                          background: FIELD_BG,
                        }}
                      >
                        {etapaLabelConRango(etapa)}
                      </span>
                      {totalEras > 0 && (
                        <span className="text-micro text-primary/30 tabular-nums">
                          {totalEras}
                        </span>
                      )}
                    </button>
                    <div className="flex-1 h-px" style={{ background: LINE_COLOR }} />
                    <button
                      className="flex items-center gap-0.5 text-micro font-bold text-primary/35 hover:text-accent transition-colors shrink-0"
                      type="button"
                      onClick={() => abrirFormularioEnEtapa(etapa)}
                    >
                      <Plus size={10} /> Era
                    </button>
                  </div>

                  {!colapsada &&
                    (totalEras === 0 ? (
                      <p className="text-micro text-primary/25 pb-1">
                        Sin eras en esta etapa todavía
                      </p>
                    ) : (
                      <div className="flex flex-row items-start gap-3 overflow-x-auto pb-1">
                        {carrilesEtapa.map((carril, ci) => (
                          <div
                            key={`carril-${etapa.id}-${carril.anio ?? "sf"}-${ci}`}
                            className="flex flex-col gap-1 shrink-0"
                            style={{
                              width:
                                ANCHO_ERA_BTN * carril.eras.length +
                                6 * (carril.eras.length - 1),
                            }}
                          >
                            <span
                              className="text-micro font-bold tabular-nums text-primary/30"
                            >
                              Año {carril.anio}
                            </span>
                            <div className="flex flex-row gap-1.5">
                              {carril.eras.map((era) => (
                                <EraBoton
                                  key={era.id}
                                  btnRef={(el) => {
                                    if (el) btnRefs.current.set(era.id, el);
                                    else btnRefs.current.delete(era.id);
                                  }}
                                  edad={calcularEdad(
                                    era.momento,
                                    fechaNacimiento,
                                    diasPorAnio,
                                  )}
                                  era={era}
                                  isSel={era.id === selId}
                                  onClick={() =>
                                    setSelId((prev) =>
                                      prev === era.id ? null : era.id,
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : carriles.length === 0 ? (
        <p className="text-micro text-primary/25 py-1">
          {fechaNacimiento != null
            ? "Agrega una era para continuar la historia"
            : "Asigna un cumpleaños y agrega eras para construir la historia"}
        </p>
      ) : (
        // Sin cumpleaños o sin calendario no se puede calcular edad, así que
        // no hay etapas: se muestra el listado plano de carriles por año.
        <div className="flex flex-row flex-wrap items-start gap-3">
          {fechaNacimiento != null && (
            <div className="flex flex-col gap-1" style={{ width: ANCHO_ERA_BTN }}>
              <div className="flex items-center gap-1.5 w-full">
                <span
                  className="text-micro font-black tabular-nums px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    color: "var(--accent)",
                    background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                  }}
                >
                  Año 0
                </span>
                <div className="flex-1 h-px" style={{ background: LINE_COLOR }} />
              </div>
              <div className="flex flex-row gap-1.5">
                <div className="relative" style={{ width: ANCHO_ERA_BTN }}>
                  <button
                    className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg text-left transition-colors w-full"
                    style={{
                      background: "color-mix(in srgb, var(--accent) 6%, transparent)",
                      border: `1px solid color-mix(in srgb, var(--accent) 18%, transparent)`,
                    }}
                    type="button"
                    onClick={() => setCumpleQuickEdit(true)}
                  >
                    <span className="flex items-center gap-1 text-micro font-bold" style={{ color: "var(--accent)" }}>
                      Nacimiento
                      <Pencil className="opacity-40" size={9} />
                    </span>
                    <span className="text-micro text-primary/40">
                      <FechaMundoBadge diaAbsoluto={fechaNacimiento} />
                    </span>
                  </button>
                  {cumpleQuickEdit && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="pointer-events-auto">
                        <SelectorFechaMundo
                          autoOpen
                          hideTrigger
                          value={fechaNacimiento}
                          onChange={handleGuardarCumpleRapido}
                          onOpenChange={(o) => {
                            if (!o) setCumpleQuickEdit(false);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {carriles.map((carril, ci) => {
            const anchoCarril =
              ANCHO_ERA_BTN * carril.eras.length + 6 * (carril.eras.length - 1);
            return (
              <div
                key={`carril-${carril.anio ?? "sf"}-${ci}`}
                className="flex flex-col gap-1"
                style={{ width: anchoCarril }}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span
                    className="text-micro font-black tabular-nums px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                      background: FIELD_BG,
                    }}
                  >
                    {carril.anio != null ? `Año ${carril.anio}` : "Sin año"}
                  </span>
                  <div className="flex-1 h-px" style={{ background: LINE_COLOR }} />
                </div>
                <div className="flex flex-row gap-1.5">
                  {carril.eras.map((era) => (
                    <EraBoton
                      key={era.id}
                      btnRef={(el) => {
                        if (el) btnRefs.current.set(era.id, el);
                        else btnRefs.current.delete(era.id);
                      }}
                      edad={
                        fechaNacimiento != null && diasPorAnio > 0
                          ? calcularEdad(era.momento, fechaNacimiento, diasPorAnio)
                          : null
                      }
                      era={era}
                      isSel={era.id === selId}
                      onClick={() =>
                        setSelId((prev) => (prev === era.id ? null : era.id))
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panel de detalle flotante */}
      {selEra && (
        <EraDetalleFlotante
          anchorEl={btnRefs.current.get(selEra.id) ?? null}
          diasPorAnio={diasPorAnio}
          edad={
            fechaNacimiento != null && diasPorAnio > 0
              ? calcularEdad(selEra.momento, fechaNacimiento, diasPorAnio)
              : null
          }
          era={selEra}
          fechaNacimiento={fechaNacimiento ?? null}
          onAddRasgo={(r) => addRasgo(selEra, r)}
          onClose={() => setSelId(null)}
          onDelete={() => {
            deleteEra(selEra.id);
            setSelId(null);
          }}
          onLabelChange={(v) => changeLabel(selEra, v)}
          onMomentoChange={(m) => changeMomento(selEra, m)}
          onNotasChange={(v) => changeNotas(selEra, v)}
          onRemoveRasgo={(r) => removeRasgo(selEra, r)}
        />
      )}
    </div>
  );
}

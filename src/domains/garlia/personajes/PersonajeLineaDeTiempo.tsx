"use client";

/**
 * PersonajeLineaDeTiempo.tsx
 * ──────────────────────────
 * UI de la línea de tiempo de eras de un personaje, en formato BARRA LATERAL
 * + PANEL DE DETALLE (layout de 2 columnas):
 *
 *   - Columna izquierda (barra lateral, angosta): el bloque "Nacimiento"
 *     arriba de todo, y debajo las 6 GRANDES ERAS (= las ETAPAS_VIDA: Bebé,
 *     Infancia, Niñez, Adolescencia, Adultez, Vejez). Cada Gran Era es
 *     siempre visible (aunque esté vacía) y se puede expandir/colapsar.
 *     Dentro de cada una, sus SUB-ERAS particulares del personaje se listan
 *     verticalmente (ej. dentro de "Infancia": "Infancia previa al
 *     accidente", "Infancia posterior al accidente"). Cada Gran Era tiene
 *     su propio "+ Sub-era" para crear una directamente dentro de ella.
 *   - Columna derecha (panel de detalle, FIJO — ya no flotante/portal): al
 *     hacer click en una sub-era se abre acá, con — en este orden de
 *     arriba hacia abajo — el nombre de la era particular, los selectores
 *     de fecha/edad, los rasgos, y por último el editor de texto enriquecido
 *     (Lexical) para las notas de esa sub-era.
 *   - Sin cumpleaños o sin calendario no se puede calcular edad; en ese caso
 *     las sub-eras se listan igual pero sin Grandes Eras como agrupador (no
 *     se puede saber a qué Gran Era pertenecen sin poder calcular la edad)
 *     — ver rama `!puedeAgruparPorGranEra` más abajo.
 *   - El bloque "Nacimiento" es clickeable: abre el mismo selector para
 *     editar la fecha de nacimiento ya asignada (no solo para asignarla
 *     por primera vez).
 *
 * Toda la lógica de datos vive en useErasDelPersonaje. El campo `notas` de
 * cada era pasó de texto plano a markdown enriquecido (sigue siendo un
 * `string` en la base — RichEditor serializa/deserializa internamente — así
 * que no hace falta ninguna migración de esquema).
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
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { useConfirm } from "@/ui/ConfirmModal";
import {
  FechaMundoBadge,
  SelectorFechaMundo,
  useCalendario,
} from "@/domains/garlia/calendario/CalendarioMundo";
import {
  type Era,
  useErasDelPersonaje,
} from "./useErasDelPersonaje";
import { useGuardarCumpleanos } from "./useGuardarCumpleanos";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularEdad(
  diaAbsolutoEra: number,
  diaAbsolutoNacimiento: number,
  diasPorAnio: number,
): number {
  if (diasPorAnio <= 0) return 0;
  return Math.floor((diaAbsolutoEra - diaAbsolutoNacimiento) / diasPorAnio);
}

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

const SIDEBAR_WIDTH = 240;

type GranEra = { id: string; label: string; min: number; max: number | null };

const GRANDES_ERAS: GranEra[] = [
  { id: "bebe", label: "Bebé", min: 0, max: 1 },
  { id: "infancia", label: "Infancia", min: 2, max: 6 },
  { id: "ninez", label: "Niñez", min: 7, max: 12 },
  { id: "adolescencia", label: "Adolescencia", min: 13, max: 17 },
  { id: "adultez", label: "Adultez", min: 18, max: 64 },
  { id: "vejez", label: "Vejez", min: 65, max: null },
];

function granEraLabelConRango(era: GranEra): string {
  return era.max == null
    ? `${era.label} (${era.min}+)`
    : `${era.label} (${era.min}-${era.max})`;
}

function granEraParaEdad(edad: number): GranEra {
  return (
    GRANDES_ERAS.find((e) => edad >= e.min && (e.max == null || edad <= e.max)) ??
    GRANDES_ERAS[GRANDES_ERAS.length - 1]
  );
}

function SubEraItem({
  era,
  edad,
  isSel,
  onClick,
}: {
  era: Era;
  edad: number | null;
  isSel: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg text-left transition-all w-full min-w-0"
      style={{
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

function EraDetallePanel({
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
  const [nuevoRasgo, setNuevoRasgo] = useState("");
  const [edadStr, setEdadStr] = useState(edad != null ? String(edad) : "");
  const [edadFocused, setEdadFocused] = useState(false);
  const { confirm, ConfirmModal } = useConfirm();

  const puedeEditarEdad = fechaNacimiento != null && diasPorAnio > 0;

  const handleEliminarEra = async () => {
    const ok = await confirm({
      message: `¿Eliminar permanentemente la era "${era.label || "sin nombre"}"?`,
      danger: true,
      confirmLabel: "Eliminar",
    });
    if (ok) onDelete();
  };

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

  return (
    <div
      className="rounded-xl border p-3 space-y-3 h-full overflow-y-auto"
      style={{
        background: "var(--bg-main)",
        borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
      }}
    >
      <ConfirmModal />
      <div className="flex items-start justify-between gap-2">
        <input
          key={era.id}
          className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-sm font-bold outline-none transition-colors placeholder:font-normal placeholder:text-primary/25"
          maxLength={60}
          placeholder="Nombre del período…"
          style={{
            background: "transparent",
            color: "var(--primary)",
          }}
          type="text"
          value={era.label}
          onChange={(e) => onLabelChange(e.target.value)}
        />
        <button
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-primary/25 hover:text-primary transition-colors"
          type="button"
          onClick={onClose}
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SelectorFechaMundo
            borderless
            placeholder="Fecha…"
            value={era.momento}
            onChange={(dia) => {
              if (dia != null) onMomentoChange(dia);
            }}
          />
        </div>
        {puedeEditarEdad && (
          <div className="flex items-center gap-1 shrink-0">
            <input
              className="w-14 rounded-md px-1.5 py-0.5 text-micro font-black tabular-nums text-center outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              key={`edad-${era.id}`}
              min={0}
              style={{
                background: FIELD_BG,
                color: "color-mix(in srgb, var(--accent) 80%, transparent)",
              }}
              type="number"
              value={edadFocused ? edadStr : edad != null ? String(edad) : ""}
              onChange={(e) => setEdadStr(e.target.value)}
              onFocus={() => {
                setEdadFocused(true);
                setEdadStr(edad != null ? String(edad) : "");
              }}
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

      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <input
            className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-micro outline-none transition-colors placeholder:text-primary/25"
            maxLength={40}
            placeholder="Añadir rasgo…"
            style={{
              background: "transparent",
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

      <div>
        <RichEditor
          key={era.id}
          editable
          minHeight="10rem"
          placeholder="Notas sobre este momento…"
          value={era.notas}
          onChange={onNotasChange}
        />
      </div>

      <div className="flex justify-end pt-0.5">
        <button
          className="flex items-center gap-1 px-1.5 py-1 rounded-md text-micro text-primary/30 hover:text-accent transition-colors"
          type="button"
          onClick={handleEliminarEra}
        >
          <Trash2 size={11} /> Eliminar era
        </button>
      </div>
    </div>
  );
}

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
  const [addingGranEra, setAddingGranEra] = useState<GranEra | null>(null);

  const [cumpleSelectorOpen, setCumpleSelectorOpen] = useState(false);
  const [cumpleDraft, setCumpleDraft] = useState<number | null>(null);

  const [cumpleQuickEdit, setCumpleQuickEdit] = useState(false);

  const [selId, setSelId] = useState<string | null>(null);
  const selEra = eras.find((e) => e.id === selId) ?? null;

  const handleAddEra = async () => {
    const num = parseInt(newMomento.trim(), 10);
    const era = await addEra(num, newLabel);
    if (era) setSelId(era.id);
    setNewMomento("");
    setNewLabel("");
    setAddingNew(false);
    setAddingGranEra(null);
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

  const abrirFormularioEnGranEra = (granEra: GranEra | null) => {
    setAddingGranEra(granEra);
    if (granEra && fechaNacimiento != null && diasPorAnio > 0) {
      setNewMomento(String(fechaNacimiento + granEra.min * diasPorAnio));
    } else if (fechaNacimiento != null) {
      setNewMomento(String(fechaNacimiento));
    }
    setAddingNew(true);
  };

  const fechaInvalida =
    fechaNacimiento != null &&
    !!newMomento &&
    parseInt(newMomento, 10) <= fechaNacimiento;

  const puedeAgruparPorGranEra = fechaNacimiento != null && diasPorAnio > 0;
  type GrupoGranEra = { granEra: GranEra; subEras: Era[] };
  const gruposPorGranEra = useMemo<GrupoGranEra[]>(() => {
    if (!puedeAgruparPorGranEra) return [];
    const porGranEra = new Map<string, Era[]>();
    for (const era of eras) {
      const edad = calcularEdad(
        era.momento,
        fechaNacimiento as number,
        diasPorAnio,
      );
      const granEra = granEraParaEdad(edad);
      const list = porGranEra.get(granEra.id) ?? [];
      list.push(era);
      porGranEra.set(granEra.id, list);
    }
    return GRANDES_ERAS.map((granEra) => ({
      granEra,
      subEras: porGranEra.get(granEra.id) ?? [],
    }));
  }, [eras, fechaNacimiento, diasPorAnio, puedeAgruparPorGranEra]);

  const edadSelEra =
    selEra != null && fechaNacimiento != null && diasPorAnio > 0
      ? calcularEdad(selEra.momento, fechaNacimiento, diasPorAnio)
      : null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-micro font-black uppercase tracking-widest"
          style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
        >
          Línea de tiempo
        </span>
        <div className="flex-1 h-px" style={{ background: LINE_COLOR }} />
        <button
          className="flex items-center gap-1 text-micro font-bold text-primary/40 hover:text-accent transition-colors shrink-0"
          type="button"
          onClick={() => {
            if (addingNew) {
              setAddingNew(false);
              setAddingGranEra(null);
            } else {
              abrirFormularioEnGranEra(null);
            }
          }}
        >
          {addingNew ? <X size={11} /> : <Plus size={11} />} Sub-era
        </button>
      </div>

      {addingNew && (
        <div
          className="mb-3 p-2.5 rounded-xl space-y-2"
          style={{ background: FIELD_BG }}
        >
          {addingGranEra && (
            <p
              className="text-micro font-bold"
              style={{ color: "color-mix(in srgb, var(--accent) 70%, transparent)" }}
            >
              Nueva sub-era en {granEraLabelConRango(addingGranEra)}
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
                setAddingGranEra(null);
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

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-primary/20" size={14} />
        </div>
      ) : (
        <div className="flex flex-row items-start gap-3">
          <div
            className="flex flex-col gap-2 shrink-0"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {fechaNacimiento != null && (
              <div className="relative">
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
            )}

            {puedeAgruparPorGranEra ? (
              gruposPorGranEra.map(({ granEra, subEras }, idx) => (
                <div
                  key={granEra.id}
                  className="flex flex-col gap-1.5 py-2"
                  style={{
                    borderTop: idx === 0 ? undefined : `1px solid ${LINE_COLOR}`,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-micro font-black uppercase tracking-wide truncate"
                      style={{
                        color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                      }}
                    >
                      {granEraLabelConRango(granEra)}
                    </span>
                    {subEras.length > 0 && (
                      <span className="text-micro text-primary/30 tabular-nums shrink-0">
                        {subEras.length}
                      </span>
                    )}
                    <div className="flex-1" />
                    <button
                      className="flex items-center gap-0.5 text-micro font-bold text-primary/35 hover:text-accent transition-colors shrink-0"
                      type="button"
                      onClick={() => abrirFormularioEnGranEra(granEra)}
                    >
                      <Plus size={10} />
                    </button>
                  </div>

                  {subEras.length === 0 ? (
                    <p className="text-micro text-primary/25 py-0.5">
                      Sin sub-eras todavía
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {subEras.map((era) => (
                        <SubEraItem
                          key={era.id}
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
                  )}
                </div>
              ))
            ) : eras.length === 0 ? (
              <p className="text-micro text-primary/25 py-1">
                {fechaNacimiento != null
                  ? "Agrega una sub-era para continuar la historia"
                  : "Asigna un cumpleaños y agrega sub-eras para construir la historia"}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {eras.map((era) => (
                  <SubEraItem
                    key={era.id}
                    edad={null}
                    era={era}
                    isSel={era.id === selId}
                    onClick={() =>
                      setSelId((prev) => (prev === era.id ? null : era.id))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0" style={{ minHeight: 200 }}>
            {selEra ? (
              <EraDetallePanel
                diasPorAnio={diasPorAnio}
                edad={edadSelEra}
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
            ) : (
              <div
                className="flex items-center justify-center h-full rounded-xl border border-dashed text-micro text-primary/25 py-10"
                style={{ borderColor: LINE_COLOR }}
              >
                Selecciona una sub-era para ver y editar su detalle
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

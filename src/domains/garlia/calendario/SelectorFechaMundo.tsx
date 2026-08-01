"use client";

/**
 * SelectorFechaMundo.tsx
 * ────────────────────────
 * Selector de fecha del calendario del mundo: muestra la fecha legible y
 * al hacer click abre un editor inline (año/estación/día) en un portal.
 *
 * Rediseño (v3): foco 100% en velocidad, sin scroll y sin clicks de más.
 *   - Un solo click elige el día Y CONFIRMA (ya no hay botón "Confirmar"
 *     aparte — clickear un día es la acción final).
 *   - Año y estación en una sola fila compacta arriba de la grilla de
 *     días, sin secciones separadas ni encabezados repetidos.
 *   - Todo el panel es lo bastante compacto para no necesitar scroll
 *     interno con calendarios de hasta ~8 estaciones / ~40 días —
 *     conserva overflow como red de seguridad para calendarios enormes,
 *     pero deja de ser el flujo esperado.
 *   - Solo colores del tema (var(--primary), var(--accent), var(--bg-main));
 *     nada de paletas propias por estación.
 *
 * Incluye FechaMundoEditor como componente privado (solo lo usa este
 * selector, no se exporta).
 *
 * Ruta: src/features/editorGarlia/components/calendario/SelectorFechaMundo.tsx
 */

import { CalendarDays, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useCalendario } from "@/domains/garlia/calendario/useCalendario";
import type {
  Estacion,
  CalendarioConfig,
  EraMundo,
} from "@/lib/utils/calendario";
import {
  diaAbsolutoAFecha,
  fechaADiaAbsoluto,
  formatFechaCorta,
} from "@/lib/utils/calendario";

// ─── Etiqueta corta de estación ("Flo 1", "Eri 2", "Siv 1"…) ──────────────────
// Primeras 3 letras del nombre base de la estación (sin el sufijo numérico
// de las estaciones partidas, ej. "Florial1"/"Florial2" → base "Florial")
// + el número de parte dentro de ese grupo (1, 2…), empezando en 1 aunque
// la estación no tenga partes (ej. "Sivial" → "Siv 1"). Se usa SOLO para
// el trigger compacto — nada de nombres completos ahí, solo estas 4-5
// letras y números.
function etiquetaEstacionCorta(estOrden: number, estaciones: Estacion[]): string {
  const est = estaciones.find((e) => e.orden === estOrden);
  if (!est) return String(estOrden);

  const baseDe = (nombre: string) =>
    /\d+$/.test(nombre) ? nombre.replace(/\s*\d+$/, "") : nombre;
  const base = baseDe(est.nombre);

  const grupo = [...estaciones]
    .filter((e) => baseDe(e.nombre) === base)
    .sort((a, b) => a.orden - b.orden);
  const idx = grupo.findIndex((e) => e.orden === est.orden) + 1;

  const abrev = base.slice(0, 3);
  const abrevCapitalizada =
    abrev.charAt(0).toUpperCase() + abrev.slice(1).toLowerCase();

  return `${abrevCapitalizada} ${idx || 1}`;
}

// value: día absoluto | null
// onChange: devuelve el nuevo día absoluto
export function SelectorFechaMundo({
  value,
  onChange,
  placeholder = "Sin fecha asignada",
  autoOpen = false,
  hideTrigger = false,
  compact = false,
  borderless = false,
  onOpenChange,
  inline = false,
}: {
  value: number | null;
  onChange: (diaAbsoluto: number | null) => void;
  placeholder?: string;
  // Si es true, el panel se abre solo al montar el componente — para
  // ancladores externos (ej. un ícono de lápiz) que quieren ir DIRECTO al
  // selector de fecha sin pasar por un trigger propio intermedio.
  autoOpen?: boolean;
  // Si es true, el botón trigger no se renderiza visualmente (queda con
  // tamaño 0) — solo se usa como ancla invisible para posicionar el panel.
  // Pensado para combinarse con `autoOpen` desde un elemento externo.
  hideTrigger?: boolean;
  // Trigger angosto (inline, ancho justo al contenido) en vez de ocupar
  // todo el ancho del contenedor — para meterlo al lado de otros datos
  // (ej. junto a la edad de un personaje) en vez de en su propia fila.
  compact?: boolean;
  // Si es true, el trigger no-compact se muestra sin borde (solo el fondo
  // sutil al abrirse) — para contextos donde el borde propio del selector
  // desentona con campos vecinos también sin borde. No afecta al trigger
  // compact ni al hideTrigger.
  borderless?: boolean;
  // Notifica cuando el panel se abre/cierra — para que un elemento externo
  // que montó este selector "a demanda" (con autoOpen) sepa cuándo
  // desmontarlo tras cerrarse.
  onOpenChange?: (open: boolean) => void;
  // Si es true, el calendario (FechaMundoEditor) se renderiza EMPOTRADO en
  // el flujo normal del documento, justo debajo del trigger — sin portal,
  // sin position:fixed y sin cálculo de posición. Pensado para paneles que
  // YA son flotantes (ej. el detalle de un evento/cumpleaños/canción en un
  // modal): evita el efecto de "panel flotante dentro de otro panel
  // flotante". `hideTrigger`/`autoOpen` se siguen respetando: si además se
  // usa hideTrigger, el editor queda directamente inline sin trigger visible.
  inline?: boolean;
}) {
  const { cal, loading } = useCalendario();
  const [open, setOpen] = useState(autoOpen);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const setOpenNotify = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };

  // Cerrar al click fuera (incluye el dropdown en portal)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpenNotify(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calcular posición y ancho del dropdown al abrir y al hacer scroll/resize.
  // El ancho ya NO se limita al ancho del trigger que lo abre (que puede ser
  // angosto, ej. un campo de fecha en un formulario compacto): se calcula a
  // partir de lo que el calendario necesita para mostrarse cómodo — columnas
  // de día × partes de estación en paralelo (ej. "Florial 1 / Florial 2") —
  // y se acota solo por el viewport.
  useEffect(() => {
    if (!open || inline) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r || !cal) return;

      const maxPartesEnParalelo = Math.max(
        1,
        ...Object.values(
          cal.estaciones.reduce<Record<string, number>>((acc, est) => {
            const base = /\d+$/.test(est.nombre)
              ? est.nombre.replace(/\s*\d+$/, "")
              : `${est.nombre}__${est.id}`;
            acc[base] = (acc[base] ?? 0) + 1;
            return acc;
          }, {}),
        ),
      );

      const CELDA = 26; // ancho aprox. de cada botón de día
      const anchoUnaParte = cal.config.dias_por_semana * CELDA + 16;
      const contenido = maxPartesEnParalelo * anchoUnaParte + 10;
      const dropdownWidth = Math.min(
        Math.max(contenido, r.width, 300),
        window.innerWidth - 16,
      );

      let left = r.left;
      if (left + dropdownWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - dropdownWidth - 8);
      }
      const spaceBelow = window.innerHeight - r.bottom;
      const estimatedHeight = 340;
      const top =
        spaceBelow < estimatedHeight && r.top > estimatedHeight
          ? r.top - estimatedHeight - 4
          : r.bottom + 4;
      setPos({ top, left, width: dropdownWidth });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, cal]);

  const fechaRaw =
    cal && value != null
      ? diaAbsolutoAFecha(value, cal.estaciones, cal.config)
      : null;
  const fecha = fechaRaw && fechaRaw.estacion ? fechaRaw : null;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      {hideTrigger ? (
        <button
          ref={triggerRef}
          className="block w-px h-px overflow-hidden opacity-0 pointer-events-none"
          type="button"
          onClick={() => setOpenNotify(!open)}
        />
      ) : compact ? (
        <div className="inline-flex items-center gap-1.5">
          {/* Botón — SOLO el ícono de calendario */}
          <button
            ref={triggerRef}
            className="flex items-center justify-center w-6 h-6 rounded-md border shrink-0 transition-all"
            style={{
              background: open
                ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                : "transparent",
              borderColor: open
                ? "color-mix(in srgb, var(--primary) 25%, transparent)"
                : "color-mix(in srgb, var(--primary) 14%, transparent)",
              color: "color-mix(in srgb, var(--primary) 55%, transparent)",
            }}
            type="button"
            onClick={() => setOpenNotify(!open)}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={9} />
            ) : (
              <CalendarDays size={11} />
            )}
          </button>
          {/* Fuera del botón — solo números: Año / Estación / Día */}
          <button
            className="text-micro font-black tabular-nums transition-colors"
            style={{
              color: fecha
                ? "var(--primary)"
                : "color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
            type="button"
            onClick={() => setOpenNotify(!open)}
          >
            {fecha
              ? `${fecha.anio} / ${etiquetaEstacionCorta(fecha.estacion.orden, cal?.estaciones ?? [])} / ${fecha.dia_en_estacion}`
              : "—"}
          </button>
        </div>
      ) : (
        <button
          ref={triggerRef}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all"
          style={{
            background: open
              ? "color-mix(in srgb, var(--primary) 5%, transparent)"
              : "transparent",
            border: borderless
              ? "1px solid transparent"
              : `1px solid ${
                  open
                    ? "color-mix(in srgb, var(--primary) 22%, transparent)"
                    : "color-mix(in srgb, var(--primary) 12%, transparent)"
                }`,
          }}
          type="button"
          onClick={() => setOpenNotify(!open)}
        >
          <CalendarDays className="shrink-0 text-primary/30" size={11} />
          {loading ? (
            <Loader2 className="animate-spin text-primary/30" size={9} />
          ) : fecha ? (
            <div className="flex-1 min-w-0">
              <span className="text-micro font-bold text-primary truncate block">
                {formatFechaCorta(fecha)}
              </span>
            </div>
          ) : (
            <span className="flex-1 text-micro text-primary/30 italic">
              {placeholder}
            </span>
          )}
        </button>
      )}

      {/* Dropdown — dos modos de render:
          - inline: empotrado en el flujo normal, justo debajo del trigger,
            sin portal ni position:fixed. Pensado para paneles que YA son
            flotantes (el detalle de un evento en un modal), para no tener
            un panel flotante dentro de otro.
          - normal (default): en portal con position:fixed, para no quedar
            cortado por contenedores con overflow. */}
      {open && cal && inline && (
        <div
          ref={dropdownRef}
          className="mt-1.5 rounded-xl border shadow-sm overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--primary) 2%, transparent)",
            borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
        >
          <FechaMundoEditor
            config={cal.config}
            eras={cal.eras}
            estaciones={cal.estaciones}
            value={value}
            onChange={(dia) => {
              onChange(dia);
              setOpenNotify(false);
            }}
            onClear={
              value != null
                ? () => {
                    onChange(null);
                    setOpenNotify(false);
                  }
                : undefined
            }
          />
        </div>
      )}
      {open &&
        cal &&
        pos &&
        !inline &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl border shadow-lg overflow-hidden"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: "calc(100vh - 16px)",
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <FechaMundoEditor
              config={cal.config}
              eras={cal.eras}
              estaciones={cal.estaciones}
              value={value}
              onChange={(dia) => {
                onChange(dia);
                setOpenNotify(false);
              }}
              onClear={
                value != null
                  ? () => {
                      onChange(null);
                      setOpenNotify(false);
                    }
                  : undefined
              }
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── FechaMundoEditor ─────────────────────────────────────────────────────────
// Editor compacto: año + estación en una fila, grilla de días debajo.
// Clickear un día CONFIRMA directamente (sin paso extra). Privado — solo
// lo usa SelectorFechaMundo, por eso no se exporta.
function FechaMundoEditor({
  value,
  estaciones,
  config,
  eras: _eras,
  onChange,
  onClear,
}: {
  value: number | null;
  estaciones: Estacion[];
  config: CalendarioConfig;
  eras: EraMundo[];
  onChange: (dia: number) => void;
  onClear?: () => void;
}) {
  const estOrdenadas = [...estaciones].sort((a, b) => a.orden - b.orden);

  // ─── Agrupar estaciones por nombre base ──────────────────────────────────
  // "Florial1" / "Florial2" → grupo "Florial" con 2 partes (mostradas como
  // dos calendarios lado a lado). Los nombres SIN sufijo numérico quedan
  // cada uno en su propio grupo, aunque se repitan.
  type GrupoEstacion = { nombre: string; partes: Estacion[] };
  const gruposEstacion: GrupoEstacion[] = [];
  {
    const porNombreBase = new Map<string, Estacion[]>();
    for (const est of estOrdenadas) {
      const tieneSufijo = /\d+$/.test(est.nombre);
      const base = tieneSufijo
        ? est.nombre.replace(/\s*\d+$/, "")
        : `${est.nombre}__${est.id}`;
      const arr = porNombreBase.get(base) ?? [];
      arr.push(est);
      porNombreBase.set(base, arr);
    }
    const vistos = new Set<string>();
    for (const est of estOrdenadas) {
      const tieneSufijo = /\d+$/.test(est.nombre);
      const base = tieneSufijo
        ? est.nombre.replace(/\s*\d+$/, "")
        : `${est.nombre}__${est.id}`;
      if (vistos.has(base)) continue;
      vistos.add(base);
      const partes = porNombreBase.get(base)!;
      gruposEstacion.push({ nombre: tieneSufijo ? base : est.nombre, partes });
    }
  }

  const grupoDeEstacion = (orden: number) =>
    gruposEstacion.find((g) => g.partes.some((p) => p.orden === orden));

  const inicial =
    value != null ? diaAbsolutoAFecha(value, estaciones, config) : null;

  const [anio, setAnio] = useState(inicial?.anio ?? config.anio_inicio);
  const [anioStr, setAnioStr] = useState(
    String(inicial?.anio ?? config.anio_inicio),
  );
  const [estOrden, setEstOrden] = useState(
    inicial?.estacion?.orden ?? estOrdenadas[0]?.orden ?? 1,
  );
  const [parteActiva, setParteActiva] = useState(estOrden);

  const estSel =
    estOrdenadas.find((e) => e.orden === parteActiva) ?? estOrdenadas[0];
  const grupoActual = grupoDeEstacion(parteActiva) ?? gruposEstacion[0];
  const diaSeleccionado =
    inicial && inicial.anio === anio && inicial.estacion?.orden === parteActiva
      ? inicial.dia_en_estacion
      : null;

  // Confirma directo: un click en un día ES la acción completa.
  const elegirDia = (estacionOrden: number, dia: number) => {
    const diaAbsoluto = fechaADiaAbsoluto(
      { anio, estacion_orden: estacionOrden, dia_en_estacion: dia },
      estaciones,
      config,
    );
    onChange(diaAbsoluto);
  };

  const commitAnio = () => {
    const n = parseInt(anioStr, 10);
    if (!isNaN(n)) setAnio(n);
    else setAnioStr(String(anio));
  };

  return (
    <div className="p-2.5 space-y-2">
      {/* Oculta las flechitas nativas (spinner) del input numérico de año
          — se ven inconsistentes con el resto del diseño. Selector global
          porque los inputs type=number no exponen esto vía className. */}
      <style>{`
        .selector-fecha-anio-input::-webkit-outer-spin-button,
        .selector-fecha-anio-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .selector-fecha-anio-input {
          -moz-appearance: textfield;
        }
      `}</style>
      {/* Año + Estación en una sola fila — sin secciones separadas */}
      <div className="flex items-center gap-1.5">
        <button
          className="flex items-center justify-center w-6 h-6 rounded-md border shrink-0 transition-colors"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            color: "var(--primary)",
          }}
          type="button"
          onClick={() => {
            const v = anio - 1;
            setAnio(v);
            setAnioStr(String(v));
          }}
        >
          <ChevronLeft size={11} />
        </button>
        <input
          className="w-14 text-center rounded-md border px-1 py-1 text-micro font-black outline-none shrink-0 selector-fecha-anio-input"
          style={{
            background: "transparent",
            borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
            color: "var(--primary)",
          }}
          type="number"
          value={anioStr}
          onChange={(e) => setAnioStr(e.target.value)}
          onBlur={commitAnio}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <button
          className="flex items-center justify-center w-6 h-6 rounded-md border shrink-0 transition-colors"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            color: "var(--primary)",
          }}
          type="button"
          onClick={() => {
            const v = anio + 1;
            setAnio(v);
            setAnioStr(String(v));
          }}
        >
          <ChevronRight size={11} />
        </button>

        <div className="w-px h-5 shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }} />

        {/* Estaciones: fila compacta que envuelve si no entra */}
        <div className="flex-1 min-w-0 flex flex-wrap gap-1">
          {gruposEstacion.map((grupo) => {
            const activo = grupo.partes.some((p) => p.orden === parteActiva);
            return (
              <button
                key={grupo.nombre}
                className="px-1.5 py-1 rounded-md text-micro font-black uppercase tracking-wide transition-colors"
                style={{
                  background: activo
                    ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                    : "color-mix(in srgb, var(--primary) 4%, transparent)",
                  color: activo
                    ? "var(--accent)"
                    : "color-mix(in srgb, var(--primary) 45%, transparent)",
                }}
                type="button"
                onClick={() => setParteActiva(grupo.partes[0].orden)}
              >
                {grupo.nombre}
              </button>
            );
          })}
        </div>

        {onClear && (
          <button
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-primary/30 hover:text-primary transition-colors"
            title="Quitar fecha"
            type="button"
            onClick={onClear}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Partes de la estación activa (ej. Florial 1 / Florial 2) lado a lado */}
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${grupoActual.partes.length}, 1fr)`,
        }}
      >
        {grupoActual.partes.map((parte, idx) => {
          const esActiva = parte.orden === parteActiva;
          return (
            <div
              key={parte.id}
              className="rounded-lg overflow-hidden"
              style={{
                background: esActiva
                  ? "color-mix(in srgb, var(--primary) 3%, transparent)"
                  : "transparent",
              }}
            >
              {grupoActual.partes.length > 1 && (
                <button
                  className="w-full text-center py-0.5 text-micro font-black uppercase tracking-widest transition-colors"
                  style={{
                    color: esActiva
                      ? "var(--accent)"
                      : "color-mix(in srgb, var(--primary) 35%, transparent)",
                  }}
                  type="button"
                  onClick={() => setParteActiva(parte.orden)}
                >
                  {grupoActual.nombre} {idx + 1}
                </button>
              )}
              <div
                className="grid gap-0.5 p-1"
                style={{
                  gridTemplateColumns: `repeat(${config.dias_por_semana}, 1fr)`,
                }}
              >
                {Array.from({ length: parte.duracion_dias }, (_, i) => {
                  const dia = i + 1;
                  const selected =
                    parte.orden === parteActiva && dia === diaSeleccionado;
                  return (
                    <button
                      key={dia}
                      className="rounded text-center py-1 text-micro font-bold transition-colors"
                      style={{
                        background: selected
                          ? "var(--accent)"
                          : "transparent",
                        color: selected
                          ? "var(--bg-main)"
                          : "color-mix(in srgb, var(--primary) 50%, transparent)",
                        fontWeight: selected ? 900 : undefined,
                      }}
                      type="button"
                      onClick={() => elegirDia(parte.orden, dia)}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

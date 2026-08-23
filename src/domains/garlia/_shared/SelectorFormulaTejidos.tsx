"use client";

/**
 * SelectorFormulaTejidos.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Editor visual de la composición de un Órgano/Formación — reemplaza al
 * viejo SelectorFormulaOrgano (que editaba un array plano `componentes`
 * directo en la fila). Hoy la composición vive en una cadena de 2 niveles
 * (Tejido→Célula para Órganos, Veta→Grano para Formaciones), así que este
 * componente es agnóstico al hook concreto: recibe `items` ya resueltos
 * (ver TejidoDeOrgano/VetaDeFormacion) y callbacks async
 * agregar/actualizar/proporcion/quitar — funciona igual con
 * useOrganoTejidos o useFormacionVetas.
 *
 * Migración ago-2026 (solo Tejido/Célula, Veta/Grano no cambió): Tejido→
 * Célula y Célula→Compuesto pasaron de 1:1 a M:N (tablas puente
 * tejido_celulas/celula_compuestos, ver elementos/types.ts). Este
 * componente NO necesitó cambios: sigue mostrando "1 fila = 1 célula
 * (catalogo_id/catalogo_nombre)", que es la PRIMERA célula vinculada al
 * tejido — useOrganoTejidos.ts resuelve esa simplificación por debajo. Si
 * un Tejido necesita mostrar/editar varias Células o Compuestos de matriz
 * a la vez, no es este componente: usar useTejidoCelulas/
 * useTejidoCompuestos directamente (ver CatalogoTejidosBiologia.tsx).
 *
 * Mismo lenguaje visual que el viejo SelectorFormulaOrgano (buscador +
 * fila con nombre/proporción/menú), pero "cantidad" pasa a ser
 * "proporción" en texto libre (columna `proporcion` de organo_tejidos/
 * formacion_vetas) en vez de un entero — la Célula/Tejido no tienen
 * cantidad propia, son una fila de catálogo reutilizable.
 */

import { Plus, Trash2, MoreVertical, Search, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import type { EntradaCatalogoTejido } from "@/domains/garlia/elementos/useCatalogoTejidos";

/** Shape mínimo de una fila de fórmula ya resuelta — cumplen TejidoDeOrgano y VetaDeFormacion.
 *  `catalogo_id` es el id de la Célula (Órgano) o Grano (Formación) — el
 *  nivel que realmente guarda `compuesto_id` — distinto de `vinculo_id`
 *  (la fila puente organo_tejidos/formacion_vetas). */
export interface FilaFormulaTejido {
  vinculo_id: string;
  /** Id del propio Tejido/Veta (tejido_id/veta_id) — distinto de catalogo_id
   *  (Célula/Grano). Usado para no reofrecer un Tejido ya vinculado en el
   *  picker de "usar existente". Opcional por compatibilidad retro. */
  tejido_o_veta_id?: string;
  /** Nombre propio del Tejido/Veta (columna `nombre` de tejidos/vetas) —
   *  el dato principal de la fila. Distinto del nombre del Compuesto que
   *  lo compone (ver compuesto_id). Opcional por compatibilidad retro. */
  nombre?: string;
  catalogo_id: string | null;
  /** Nombre propio de la Célula/Grano (columna `nombre` de celulas/granos)
   *  — esto es lo que debe mostrar la fila "hecho de". La cadena real es
   *  Tejido→Célula→Compuesto (o Veta→Grano→Compuesto): esta fila de
   *  fórmula NO debe saltearse el nivel Célula/Grano y mostrar/editar el
   *  Compuesto directo. Opcional por compatibilidad retro. */
  catalogo_nombre?: string | null;
  compuesto_id: string | null;
  proporcion: string | null;
}

export function SelectorFormulaTejidos({
  items,
  onVincularExistente,
  onCrearYVincular,
  catalogoDisponible,
  loadingCatalogo,
  onActualizarProporcion,
  onQuitar,
  onAbrirCelula,
  onAbrirTejido,
  ocultarBotonAgregar,
  soloLectura,
  labelCatalogo = "Tejido",
}: {
  items: FilaFormulaTejido[];
  /** Vincula un Tejido/Veta YA EXISTENTE (de otra entidad) sin crear uno nuevo. */
  onVincularExistente?: (tejidoOVetaId: string) => void;
  /** Crea un Tejido/Veta nuevo en el catálogo global (con este nombre) y lo
   *  vincula de una — usado desde el picker cuando la búsqueda no matchea
   *  nada existente. Mismo catálogo que edita Biología > Tejidos/Vetas. */
  onCrearYVincular?: (nombre: string) => void;
  /** Catálogo completo de Tejidos/Vetas ya creados — ver useCatalogoTejidos. */
  catalogoDisponible?: EntradaCatalogoTejido[];
  loadingCatalogo?: boolean;
  onActualizarProporcion: (vinculoId: string, proporcion: string) => void;
  onQuitar: (vinculoId: string) => void;
  /** Abre el editor de la Célula/Grano que compone esta fila (mismo panel
   *  que Biología/Física > Catálogo de Células/Granos) — clickeando "hecho
   *  de: [Célula]". El Compuesto se elige/edita adentro de ESE panel, no
   *  acá: la fórmula del Tejido no debe saltearse el nivel Célula/Grano. */
  onAbrirCelula?: (celulaOGranoId: string) => void;
  /** Abre el editor completo del Tejido/Veta propio de la fila (mismo panel
   *  que Biología/Física > Catálogo de Tejidos/Vetas) — clickeando el
   *  nombre. Si se omite, el nombre se muestra pero no es clickeable. */
  onAbrirTejido?: (tejidoOVetaId: string) => void;
  /** Oculta el botón "Agregar" interno — usar cuando el padre renderiza su propio botón. */
  ocultarBotonAgregar?: boolean;
  /** Modo solo lectura: no agregar, no editar compuesto/proporción, no
   *  quitar — cada fila solo muestra nombre + proporción, con el nombre
   *  clickeable a onAbrirTejido si se provee. Usar en tarjetas embebidas
   *  donde la fórmula se edita desde el editor propio del Órgano/Formación,
   *  no inline. */
  soloLectura?: boolean;
  /** Vocabulario del picker: "Tejido" u "Veta". */
  labelCatalogo?: string;
}) {
  const [pickerAbierto, setPickerAbierto] = useState(false);

  // Ya vinculados a esta fórmula: no tiene sentido ofrecerlos de nuevo en el picker.
  const yaVinculadosIds = useMemo(
    () => new Set(items.map((i) => i.tejido_o_veta_id).filter((id): id is string => !!id)),
    [items],
  );

  const disponiblesParaPicker = useMemo(
    () => (catalogoDisponible ?? []).filter((c) => !yaVinculadosIds.has(c.id)),
    [catalogoDisponible, yaVinculadosIds],
  );

  if (soloLectura) {
    return (
      <div className="flex flex-col">
        {items.length === 0 ? (
          <p className="text-micro text-primary/25 italic">Nada definido todavía.</p>
        ) : (
          <div className="divide-y divide-primary/10">
            {items.map((item) => (
              <FilaFormulaTejidoSoloLectura
                key={item.vinculo_id}
                item={item}
                onAbrirTejido={
                  onAbrirTejido && item.tejido_o_veta_id
                    ? () => onAbrirTejido(item.tejido_o_veta_id as string)
                    : undefined
                }
                onAbrirCelula={
                  onAbrirCelula && item.catalogo_id
                    ? () => onAbrirCelula(item.catalogo_id as string)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {items.length === 0 && (
        <p className="text-micro text-primary/25 italic mb-1.5">Nada definido todavía.</p>
      )}

      {items.length > 0 && (
        <div className="divide-y divide-primary/10 mb-1.5">
          {items.map((item) => (
            <FilaFormulaTejidoRow
              key={item.vinculo_id}
              item={item}
              onCambiarProporcion={(proporcion) => onActualizarProporcion(item.vinculo_id, proporcion)}
              onQuitar={() => onQuitar(item.vinculo_id)}
              onAbrirTejido={
                onAbrirTejido && item.tejido_o_veta_id
                  ? () => onAbrirTejido(item.tejido_o_veta_id as string)
                  : undefined
              }
              onAbrirCelula={
                onAbrirCelula && item.catalogo_id
                  ? () => onAbrirCelula(item.catalogo_id as string)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {!ocultarBotonAgregar && (onVincularExistente || onCrearYVincular) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setPickerAbierto(true)}
            disabled={!!loadingCatalogo}
            title={`Elegir un ${labelCatalogo} existente o crear uno nuevo`}
            className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={10} />
            Agregar
          </button>
        </div>
      )}

      {(pickerAbierto && (onVincularExistente || onCrearYVincular)) && (
        <PickerTejidoExistente
          labelCatalogo={labelCatalogo}
          disponibles={disponiblesParaPicker}
          onElegir={
            onVincularExistente
              ? (id) => {
                  onVincularExistente(id);
                  setPickerAbierto(false);
                }
              : undefined
          }
          onCrear={
            onCrearYVincular
              ? (nombre) => {
                  onCrearYVincular(nombre);
                  setPickerAbierto(false);
                }
              : undefined
          }
          onClose={() => setPickerAbierto(false)}
        />
      )}
    </div>
  );
}

/**
 * Picker unificado: buscar un Tejido/Veta ya existente en TODO el catálogo
 * global (mismo catálogo que edita Biología > Tejidos/Vetas, ver
 * CatalogoTejidosBiologia.tsx) y vincularlo, o crear uno nuevo con el texto
 * buscado si no existe — sin salir del editor del Órgano/Formación.
 */
function PickerTejidoExistente({
  labelCatalogo,
  disponibles,
  onElegir,
  onCrear,
  onClose,
}: {
  labelCatalogo: string;
  disponibles: EntradaCatalogoTejido[];
  onElegir?: (id: string) => void;
  onCrear?: (nombre: string) => void;
  onClose: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((d) => d.nombre.toLowerCase().includes(q));
  }, [disponibles, busqueda]);

  const busquedaLimpia = busqueda.trim();
  // No ofrecer "Crear X" si ya existe una entrada con ese nombre exacto.
  const coincideExacto = filtrados.some(
    (d) => d.nombre.toLowerCase() === busquedaLimpia.toLowerCase(),
  );
  const puedeCrear = !!onCrear && busquedaLimpia.length > 0 && !coincideExacto;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, black 45%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[70vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-primary/10">
          <Search size={13} className="text-primary/30 shrink-0" />
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar o crear ${labelCatalogo.toLowerCase()}…`}
            className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-sm text-primary outline-none placeholder:text-primary/30"
          />
          <span className="text-micro text-primary/30 shrink-0">{disponibles.length}</span>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="overflow-y-auto p-2">
          {puedeCrear && (
            <button
              type="button"
              onClick={() => onCrear?.(busquedaLimpia)}
              className="w-full flex items-center gap-2 text-left px-2 py-2 mb-1 rounded-md border border-dashed border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors cursor-pointer"
            >
              <Plus size={12} className="text-accent shrink-0" />
              <span className="text-micro font-bold text-accent truncate">
                Crear &quot;{busquedaLimpia}&quot;
              </span>
            </button>
          )}

          {filtrados.length === 0 && !puedeCrear ? (
            <p className="text-micro text-primary/25 italic text-center py-6">
              {onElegir ? "Sin resultados" : "Escribí un nombre para crear uno nuevo"}
            </p>
          ) : (
            onElegir && (
              <div className="flex flex-col divide-y divide-primary/10">
                {filtrados.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onElegir(d.id)}
                    className="w-full text-left px-2 py-2 hover:bg-primary/5 transition-colors cursor-pointer rounded"
                  >
                    <p className="text-micro font-bold text-primary truncate">
                      {d.nombre || "Sin nombre"}
                    </p>
                    {d.funcion && (
                      <p className="text-micro text-primary/40 truncate mt-0.5">{d.funcion}</p>
                    )}
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Fila de fórmula en modo solo lectura — usada en tarjetas embebidas
 * (Planta/Criatura/Mineral/Item) donde la fórmula ya no se edita inline;
 * solo muestra nombre (clickeable a onAbrirTejido si se provee) + proporción.
 */
function FilaFormulaTejidoSoloLectura({
  item,
  onAbrirTejido,
  onAbrirCelula,
}: {
  item: FilaFormulaTejido;
  onAbrirTejido?: () => void;
  /** Abre el editor de la Célula/Grano que compone esta fila. */
  onAbrirCelula?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="min-w-0 flex-1 flex flex-col">
        <button
          type="button"
          onClick={onAbrirTejido}
          disabled={!onAbrirTejido}
          title={onAbrirTejido ? `Abrir ${item.nombre || ""}` : undefined}
          className="min-w-0 text-left truncate text-micro font-bold text-primary transition-colors disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
        >
          {item.nombre || "Sin nombre"}
        </button>
        <button
          type="button"
          onClick={onAbrirCelula}
          disabled={!onAbrirCelula}
          title={onAbrirCelula ? `Abrir ${item.catalogo_nombre ?? ""}` : undefined}
          className="min-w-0 text-left px-0 text-[10px] text-primary/40 truncate transition-colors disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
        >
          hecho de: {item.catalogo_nombre || "sin composición asignada"}
        </button>
      </div>
      {item.proporcion && (
        <span className="shrink-0 text-micro font-black text-primary/50 tabular-nums">
          {item.proporcion}
        </span>
      )}
    </div>
  );
}

function FilaFormulaTejidoRow({
  item,
  onCambiarProporcion,
  onQuitar,
  onAbrirTejido,
  onAbrirCelula,
}: {
  item: FilaFormulaTejido;
  onCambiarProporcion: (proporcion: string) => void;
  onQuitar: () => void;
  onAbrirTejido?: () => void;
  /** Abre el editor de la Célula/Grano que compone esta fila — el
   *  Compuesto se elige/edita adentro de ESE panel, no acá. */
  onAbrirCelula?: () => void;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [proporcionLocal, setProporcionLocal] = useState(item.proporcion ?? "");

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {/* Fila principal: nombre propio del Tejido/Veta (link → abre editor completo) + proporción + menú */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAbrirTejido}
          disabled={!onAbrirTejido}
          title={onAbrirTejido ? `Abrir ${item.nombre || ""}` : undefined}
          className="flex-1 min-w-0 text-left px-0 py-1 text-micro font-bold text-primary truncate transition-colors disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
        >
          {item.nombre || "Sin nombre"}
        </button>

        {/* Proporción: texto libre (ej. "60%", "mayoritario", "trazas") */}
        <input
          value={proporcionLocal}
          onChange={(e) => setProporcionLocal(e.target.value)}
          onBlur={() => {
            if (proporcionLocal !== (item.proporcion ?? "")) onCambiarProporcion(proporcionLocal);
          }}
          placeholder="Proporción…"
          className="shrink-0 w-20 bg-transparent px-0 py-1 text-micro font-black text-primary/70 text-right outline-none placeholder:text-primary/25 placeholder:font-normal tabular-nums"
        />

        {/* Menú de 3 puntos: Quitar */}
        <div
          className="relative shrink-0"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenuAbierto(false);
          }}
        >
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            title="Más opciones"
            className="w-5 h-5 flex items-center justify-center rounded text-primary/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <MoreVertical size={12} />
          </button>

          {menuAbierto && (
            <div
              className="absolute z-20 mt-1 right-0 rounded-md border shadow-lg overflow-hidden"
              style={{
                background: "var(--bg-main)",
                borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuAbierto(false);
                  onQuitar();
                }}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-micro font-bold whitespace-nowrap text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={11} /> Quitar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fila secundaria: "hecho de" — la Célula/Grano que compone este
         Tejido/Veta. El Compuesto vive un nivel más abajo (adentro de la
         Célula/Grano) y se elige/edita ahí, no en esta fila. */}
      <div className="flex items-center gap-1.5 pl-0">
        <span className="shrink-0 text-[10px] text-primary/35">hecho de:</span>
        <button
          type="button"
          onClick={onAbrirCelula}
          disabled={!onAbrirCelula}
          title={onAbrirCelula ? `Abrir ${item.catalogo_nombre || ""}` : undefined}
          className="min-w-0 flex-1 text-left px-0 text-[10px] font-bold text-primary/70 truncate transition-colors disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
        >
          {item.catalogo_nombre || "sin composición asignada"}
        </button>
      </div>
    </div>
  );
}

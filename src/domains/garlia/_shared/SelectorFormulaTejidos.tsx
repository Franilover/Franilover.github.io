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
 * Mismo lenguaje visual que el viejo SelectorFormulaOrgano (buscador +
 * fila con nombre/proporción/menú), pero "cantidad" pasa a ser
 * "proporción" en texto libre (columna `proporcion` de organo_tejidos/
 * formacion_vetas) en vez de un entero — la Célula/Tejido no tienen
 * cantidad propia, son una fila de catálogo reutilizable.
 */

import { Plus, Trash2, Pencil, MoreVertical, Search, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import type { Compuesto } from "@/domains/garlia/elementos/types";
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
  catalogo_id: string | null;
  compuesto_id: string | null;
  proporcion: string | null;
}

export function SelectorFormulaTejidos({
  compuestos,
  items,
  onAgregar,
  onVincularExistente,
  catalogoDisponible,
  loadingCatalogo,
  onActualizarCompuesto,
  onActualizarProporcion,
  onQuitar,
  onAbrirCompuesto,
  ocultarBotonAgregar,
  soloLectura,
  labelCatalogo = "Tejido",
}: {
  compuestos: Compuesto[];
  items: FilaFormulaTejido[];
  onAgregar: (compuestoId: string) => void;
  /** Vincula un Tejido/Veta YA EXISTENTE (de otra entidad) sin crear uno nuevo.
   *  Si se omite, no se muestra el botón "Usar existente". */
  onVincularExistente?: (tejidoOVetaId: string) => void;
  /** Catálogo completo de Tejidos/Vetas ya creados — ver useCatalogoTejidos. */
  catalogoDisponible?: EntradaCatalogoTejido[];
  loadingCatalogo?: boolean;
  onActualizarCompuesto: (celulaOGranoId: string, compuestoId: string) => void;
  onActualizarProporcion: (vinculoId: string, proporcion: string) => void;
  onQuitar: (vinculoId: string) => void;
  /** Abre el panel flotante del Compuesto elegido en una fila. */
  onAbrirCompuesto?: (compuestoId: string) => void;
  /** Oculta el botón "Agregar" interno — usar cuando el padre renderiza su propio botón. */
  ocultarBotonAgregar?: boolean;
  /** Modo solo lectura: no agregar, no usar existente, no editar compuesto/
   *  proporción, no quitar — cada fila solo muestra nombre + proporción,
   *  con el nombre clickeable a onAbrirCompuesto si se provee. Usar en
   *  tarjetas embebidas donde la fórmula se edita desde el editor propio
   *  del Órgano/Formación, no inline. */
  soloLectura?: boolean;
  /** Vocabulario del picker de "usar existente": "Tejido" u "Veta". */
  labelCatalogo?: string;
}) {
  const [pickerAbierto, setPickerAbierto] = useState(false);

  function agregar() {
    const elegidos = new Set(items.map((c) => c.compuesto_id));
    const primero = compuestos.find((c) => !elegidos.has(c.id)) ?? compuestos[0];
    if (!primero) return;
    onAgregar(primero.id);
  }

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
                compuestos={compuestos}
                onAbrir={
                  onAbrirCompuesto && item.compuesto_id
                    ? () => onAbrirCompuesto(item.compuesto_id as string)
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
              compuestos={compuestos}
              onCambiarCompuesto={(compuestoId) => {
                if (item.catalogo_id) onActualizarCompuesto(item.catalogo_id, compuestoId);
              }}
              onCambiarProporcion={(proporcion) => onActualizarProporcion(item.vinculo_id, proporcion)}
              onQuitar={() => onQuitar(item.vinculo_id)}
              onAbrir={
                onAbrirCompuesto && item.compuesto_id
                  ? () => onAbrirCompuesto(item.compuesto_id as string)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {!ocultarBotonAgregar && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={agregar}
            disabled={compuestos.length === 0}
            className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={10} />
            Agregar
          </button>

          {onVincularExistente && (
            <button
              type="button"
              onClick={() => setPickerAbierto(true)}
              disabled={!!loadingCatalogo || disponiblesParaPicker.length === 0}
              title={`Reutilizar un ${labelCatalogo} ya creado en otra parte`}
              className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Search size={10} />
              Usar existente
            </button>
          )}
        </div>
      )}

      {compuestos.length === 0 && (
        <p className="text-micro text-primary/25">
          Todavía no hay compuestos en la Tabla Química para asignar.
        </p>
      )}

      {pickerAbierto && onVincularExistente && (
        <PickerTejidoExistente
          labelCatalogo={labelCatalogo}
          disponibles={disponiblesParaPicker}
          onElegir={(id) => {
            onVincularExistente(id);
            setPickerAbierto(false);
          }}
          onClose={() => setPickerAbierto(false)}
        />
      )}
    </div>
  );
}

/**
 * Picker de "Usar existente" a nivel Tejido/Veta — mismo lenguaje visual
 * que PickerUsarExistente (SeccionGruposVinculados.tsx), un nivel más
 * abajo: en vez de elegir un Órgano/Formación completo, elige el Tejido/
 * Veta intermedio y lo vincula sin duplicar Célula/Tejido.
 */
function PickerTejidoExistente({
  labelCatalogo,
  disponibles,
  onElegir,
  onClose,
}: {
  labelCatalogo: string;
  disponibles: EntradaCatalogoTejido[];
  onElegir: (id: string) => void;
  onClose: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    return disponibles.filter((d) => d.nombre.toLowerCase().includes(q));
  }, [disponibles, busqueda]);

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
            placeholder={`Buscar ${labelCatalogo.toLowerCase()}…`}
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
          {filtrados.length === 0 ? (
            <p className="text-micro text-primary/25 italic text-center py-6">Sin resultados</p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Fila de fórmula en modo solo lectura — usada en tarjetas embebidas
 * (Planta/Criatura/Mineral/Item) donde la fórmula ya no se edita inline;
 * solo muestra nombre (clickeable a onAbrir si se provee) + proporción.
 */
function FilaFormulaTejidoSoloLectura({
  item,
  compuestos,
  onAbrir,
}: {
  item: FilaFormulaTejido;
  compuestos: Compuesto[];
  onAbrir?: () => void;
}) {
  const elegido = useMemo(
    () => compuestos.find((c) => c.id === item.compuesto_id) ?? null,
    [compuestos, item.compuesto_id],
  );

  return (
    <div className="flex items-center gap-2 py-1">
      <button
        type="button"
        onClick={onAbrir}
        disabled={!onAbrir}
        title={onAbrir ? `Abrir ${elegido?.nombre ?? ""}` : undefined}
        className="min-w-0 flex-1 text-left px-0 py-1 text-micro font-bold text-primary truncate transition-colors disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
      >
        {elegido?.nombre || "Sin compuesto"}
      </button>
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
  compuestos,
  onCambiarCompuesto,
  onCambiarProporcion,
  onQuitar,
  onAbrir,
}: {
  item: FilaFormulaTejido;
  compuestos: Compuesto[];
  onCambiarCompuesto: (compuestoId: string) => void;
  onCambiarProporcion: (proporcion: string) => void;
  onQuitar: () => void;
  onAbrir?: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [proporcionLocal, setProporcionLocal] = useState(item.proporcion ?? "");

  const elegido = useMemo(
    () => compuestos.find((c) => c.id === item.compuesto_id) ?? null,
    [compuestos, item.compuesto_id],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return compuestos;
    return compuestos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [compuestos, busqueda]);

  const opciones = filtrados.slice(0, 30);

  function elegir(c: Compuesto) {
    onCambiarCompuesto(c.id);
    setBusqueda("");
    setBuscando(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!buscando || opciones.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % opciones.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + opciones.length) % opciones.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = opciones[activo];
      if (c) elegir(c);
    } else if (e.key === "Escape") {
      setBuscando(false);
    }
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Valor elegido (clickeable → abre panel) o buscador */}
      <div className="flex-1 min-w-0 relative">
        {elegido && !buscando ? (
          <div className="flex items-center gap-1 group/item">
            <button
              type="button"
              onClick={onAbrir}
              disabled={!onAbrir}
              title={onAbrir ? `Abrir ${elegido.nombre}` : undefined}
              className="min-w-0 flex-1 text-left px-0 py-1 text-micro font-bold text-primary truncate transition-colors disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
            >
              {elegido.nombre}
            </button>
            <button
              type="button"
              onClick={() => {
                setBuscando(true);
                setBusqueda("");
                setActivo(0);
              }}
              title="Reemplazar"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/25 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover/item:opacity-100 cursor-pointer"
            >
              <Pencil size={10} />
            </button>
          </div>
        ) : (
          <input
            autoFocus={buscando}
            value={busqueda}
            onBlur={() => {
              setTimeout(() => setBuscando(false), 120);
            }}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setActivo(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={elegido ? undefined : "Buscar compuesto…"}
            className="w-full bg-transparent px-0 py-1 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal transition-colors"
          />
        )}
        {buscando && (
          <div
            className="absolute z-20 mt-1 left-0 right-0 max-h-40 overflow-y-auto rounded-md border shadow-lg"
            style={{
              background: "var(--bg-main)",
              borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            {opciones.length === 0 ? (
              <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
            ) : (
              opciones.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onMouseDown={() => elegir(c)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold transition-colors truncate ${
                    i === activo ? "bg-primary/10 text-primary" : "text-primary/75 hover:bg-primary/6 hover:text-primary"
                  }`}
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
        )}
      </div>

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
  );
}

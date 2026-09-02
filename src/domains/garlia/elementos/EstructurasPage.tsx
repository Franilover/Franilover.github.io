"use client";

import { Box, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PropiedadesFisicasGenerico } from "@/domains/garlia/_shared/GridPropiedadesCalculadas";
import { ComboSelector } from "@/ui/ComboSelector";
import { useConfirm } from "@/ui/ConfirmModal";

import {
  esUnionExplicita,
  useCatalogosPolimorficos,
  useEstructuraSubcomponentes,
  useEstructuraUniones,
  type OpcionPolimorfica,
  type SubcomponenteResuelto,
  type UnionResuelta,
} from "./useEstructuraCapas";
import { useEstructuraComposicion, type CompuestoDeEstructura } from "./useEstructuraComposicion";
import { useEstructuras } from "./useEstructuras";
import { useCompuestos } from "./useCompuestos";
import type { Estructura } from "./types";

const ESTADO_LABEL: Record<string, string> = {
  calculado: "Calculado",
  calculable: "Calculado",
  pendiente: "Pendiente",
};

/** Selector de tipo polimórfico (compuesto/estructura/material) — mismo
 *  criterio visual compacto que el resto de los controles micro del panel. */
const TIPOS_COMPONENTE: { value: "compuesto" | "estructura" | "material"; label: string }[] = [
  { value: "compuesto", label: "Compuesto" },
  { value: "estructura", label: "Estructura" },
  { value: "material", label: "Material" },
];

/**
 * Fila editable de un Compuesto ya vinculado a la Estructura
 * (estructura_compuestos). Mismo criterio de commit-on-blur que
 * FilaComponente/FilaEstructura en materiales/MaterialesPage.tsx: estado
 * local propio para los inputs, se persiste recién en onBlur y solo si el
 * valor final es válido.
 */
function FilaCompuesto({
  fila,
  onActualizar,
  onEliminar,
}: {
  fila: CompuestoDeEstructura;
  onActualizar: (
    cambios: Partial<
      Pick<CompuestoDeEstructura, "cantidad" | "proporcion" | "unidad" | "rol">
    >,
  ) => void;
  onEliminar: () => void;
}) {
  const [cantidadTexto, setCantidadTexto] = useState(
    fila.cantidad === null ? "" : String(fila.cantidad),
  );
  const [proporcionTexto, setProporcionTexto] = useState(
    fila.proporcion === null ? "" : String(fila.proporcion),
  );
  const [unidadTexto, setUnidadTexto] = useState(fila.unidad ?? "");
  const [rolTexto, setRolTexto] = useState(fila.rol ?? "");

  const cantidadGuardada = fila.cantidad === null ? "" : String(fila.cantidad);
  const proporcionGuardada = fila.proporcion === null ? "" : String(fila.proporcion);
  const unidadGuardada = fila.unidad ?? "";
  const rolGuardado = fila.rol ?? "";

  function commitCantidad() {
    if (cantidadTexto.trim() === "") {
      if (fila.cantidad !== null) onActualizar({ cantidad: null });
      return;
    }
    const n = Number(cantidadTexto);
    if (Number.isNaN(n) || n <= 0) {
      setCantidadTexto(cantidadGuardada);
      return;
    }
    if (n !== fila.cantidad) onActualizar({ cantidad: n });
  }

  function commitProporcion() {
    if (proporcionTexto.trim() === "") {
      if (fila.proporcion !== null) onActualizar({ proporcion: null });
      return;
    }
    const n = Number(proporcionTexto);
    if (Number.isNaN(n) || n < 0 || n > 1) {
      setProporcionTexto(proporcionGuardada);
      return;
    }
    if (n !== fila.proporcion) onActualizar({ proporcion: n });
  }

  function commitUnidad() {
    const v = unidadTexto.trim();
    if (v !== unidadGuardada) onActualizar({ unidad: v === "" ? null : v });
  }

  function commitRol() {
    const v = rolTexto.trim();
    if (v !== rolGuardado) onActualizar({ rol: v === "" ? null : v });
  }

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 rounded-md border border-primary/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-bold text-primary/70 truncate">{fila.compuesto.nombre}</span>
        <button
          type="button"
          onClick={onEliminar}
          title="Quitar compuesto"
          className="shrink-0 rounded-md p-1 text-primary/25 hover:text-red-500 hover:bg-red-500/8 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Cant.
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={cantidadTexto}
            onChange={(e) => setCantidadTexto(e.target.value)}
            onBlur={commitCantidad}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Prop.
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            max={1}
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={proporcionTexto}
            onChange={(e) => setProporcionTexto(e.target.value)}
            onBlur={commitProporcion}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Unidad
          <input
            className="w-14 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="—"
            type="text"
            value={unidadTexto}
            onChange={(e) => setUnidadTexto(e.target.value)}
            onBlur={commitUnidad}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Rol
          <input
            className="w-20 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="—"
            type="text"
            value={rolTexto}
            onChange={(e) => setRolTexto(e.target.value)}
            onBlur={commitRol}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * Composición real de la estructura (tabla puente estructura_compuestos):
 * de qué Compuestos está hecha, con su cantidad/proporción/unidad/rol.
 * Editable — mismo criterio que el bloque "Componentes" de
 * materiales/MaterialesPage.tsx: agregar desde el catálogo de Compuestos,
 * editar cada fila con commit-on-blur, quitar con confirmación.
 */
function ComposicionEstructuraBloque({ estructuraId }: { estructuraId: string }) {
  const { confirm, ConfirmModal } = useConfirm();
  const { items, loading, agregar, actualizar, eliminar } = useEstructuraComposicion(estructuraId);
  const { items: compuestosCatalogo, loading: loadingCatalogo } = useCompuestos();

  const [agregandoId, setAgregandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const disponibles = compuestosCatalogo.filter(
    (c) => !items.some((item) => item.compuesto_id === c.id),
  );

  async function handleAgregar() {
    if (!agregandoId) return;
    setGuardando(true);
    try {
      await agregar({ compuesto_id: agregandoId, cantidad: 1 });
      setAgregandoId(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id: string, nombre: string) {
    const ok = await confirm({
      title: "Quitar compuesto",
      message: `¿Quitar "${nombre}" de los compuestos de esta estructura?`,
    });
    if (ok) await eliminar(id);
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-0 p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Compuestos
        </span>
      </div>
      {loading ? (
        <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.length === 0 && (
            <p className="py-1 text-micro text-primary/30">Sin compuestos asociados.</p>
          )}
          {items.map((item) => (
            <FilaCompuesto
              key={item.vinculo_id}
              fila={item}
              onActualizar={(cambios) => actualizar(item.vinculo_id, cambios)}
              onEliminar={() => handleEliminar(item.vinculo_id, item.compuesto.nombre)}
            />
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <ComboSelector
            icon={<Plus size={11} />}
            items={disponibles.map((c) => ({ id: c.id, label: c.nombre }))}
            label=""
            loading={loadingCatalogo}
            mode="single"
            placeholder="Elegir compuesto del catálogo…"
            value={agregandoId}
            onChange={setAgregandoId}
          />
        </div>
        <button
          type="button"
          disabled={!agregandoId || guardando}
          onClick={handleAgregar}
          className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary disabled:opacity-30 transition-all px-1"
        >
          {guardando ? "Agregando…" : "Agregar"}
        </button>
      </div>
      <ConfirmModal />
    </div>
  );
}

/** Fila editable de una capa (estructura_subcomponentes). geometria_id no
 *  se edita acá (referencia una geometría propia fuera del alcance de este
 *  panel) pero sí se sigue mostrando su estado como antes. */
function FilaCapa({
  fila,
  onActualizar,
  onEliminar,
}: {
  fila: SubcomponenteResuelto;
  onActualizar: (
    cambios: Partial<Pick<SubcomponenteResuelto, "cantidad" | "proporcion" | "rol" | "orden">>,
  ) => void;
  onEliminar: () => void;
}) {
  const [ordenTexto, setOrdenTexto] = useState(fila.orden === null ? "" : String(fila.orden));
  const [cantidadTexto, setCantidadTexto] = useState(
    fila.cantidad === null ? "" : String(fila.cantidad),
  );
  const [proporcionTexto, setProporcionTexto] = useState(
    fila.proporcion === null ? "" : String(fila.proporcion),
  );
  const [rolTexto, setRolTexto] = useState(fila.rol ?? "");

  const ordenGuardado = fila.orden === null ? "" : String(fila.orden);
  const cantidadGuardada = fila.cantidad === null ? "" : String(fila.cantidad);
  const proporcionGuardada = fila.proporcion === null ? "" : String(fila.proporcion);
  const rolGuardado = fila.rol ?? "";

  function commitOrden() {
    if (ordenTexto.trim() === "") {
      if (fila.orden !== null) onActualizar({ orden: null });
      return;
    }
    const n = Number(ordenTexto);
    if (!Number.isInteger(n) || n < 0) {
      setOrdenTexto(ordenGuardado);
      return;
    }
    if (n !== fila.orden) onActualizar({ orden: n });
  }

  function commitCantidad() {
    if (cantidadTexto.trim() === "") {
      if (fila.cantidad !== null) onActualizar({ cantidad: null });
      return;
    }
    const n = Number(cantidadTexto);
    if (Number.isNaN(n) || n <= 0) {
      setCantidadTexto(cantidadGuardada);
      return;
    }
    if (n !== fila.cantidad) onActualizar({ cantidad: n });
  }

  function commitProporcion() {
    if (proporcionTexto.trim() === "") {
      if (fila.proporcion !== null) onActualizar({ proporcion: null });
      return;
    }
    const n = Number(proporcionTexto);
    if (Number.isNaN(n) || n < 0 || n > 1) {
      setProporcionTexto(proporcionGuardada);
      return;
    }
    if (n !== fila.proporcion) onActualizar({ proporcion: n });
  }

  function commitRol() {
    const v = rolTexto.trim();
    if (v !== rolGuardado) onActualizar({ rol: v === "" ? null : v });
  }

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 rounded-md border border-primary/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-bold text-primary/70 truncate">{fila.nombre}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`rounded px-1.5 py-0.5 text-micro font-bold ${
              fila.geometria_id ? "bg-primary/8 text-primary/60" : "bg-amber-500/10 text-amber-500/70"
            }`}
            title={
              fila.geometria_id
                ? `geometria_id: ${fila.geometria_id}`
                : "geometria_id = NULL — sin geometría estructural explícita enlazada"
            }
          >
            {fila.geometria_id ? "Geometría enlazada" : "Sin geometría"}
          </span>
          <button
            type="button"
            onClick={onEliminar}
            title="Quitar capa"
            className="rounded-md p-1 text-primary/25 hover:text-red-500 hover:bg-red-500/8 transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Orden
          <input
            className="w-10 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            placeholder="—"
            step={1}
            type="number"
            value={ordenTexto}
            onChange={(e) => setOrdenTexto(e.target.value)}
            onBlur={commitOrden}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Cant.
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={cantidadTexto}
            onChange={(e) => setCantidadTexto(e.target.value)}
            onBlur={commitCantidad}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Prop.
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            max={1}
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={proporcionTexto}
            onChange={(e) => setProporcionTexto(e.target.value)}
            onBlur={commitProporcion}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Rol
          <input
            className="w-20 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="—"
            type="text"
            value={rolTexto}
            onChange={(e) => setRolTexto(e.target.value)}
            onBlur={commitRol}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Fila editable de una unión estructural (estructura_uniones). Los dos
 *  extremos (a/b) no se re-eligen tras crear la unión — cambiar de qué se
 *  une a qué es equivalente a crear una unión distinta; se edita todo lo
 *  demás (intensidad/flexibilidad/reversibilidad/rol/tipo/área/estado). */
function FilaUnion({
  fila,
  onActualizar,
  onEliminar,
}: {
  fila: UnionResuelta;
  onActualizar: (
    cambios: Partial<
      Pick<
        UnionResuelta,
        "intensidad" | "flexibilidad" | "reversibilidad" | "rol" | "tipo_unidad" | "area_relativa" | "estado"
      >
    >,
  ) => void;
  onEliminar: () => void;
}) {
  const [intensidadTexto, setIntensidadTexto] = useState(
    fila.intensidad === null ? "" : String(fila.intensidad),
  );
  const [flexibilidadTexto, setFlexibilidadTexto] = useState(
    fila.flexibilidad === null ? "" : String(fila.flexibilidad),
  );
  const [reversibilidadTexto, setReversibilidadTexto] = useState(
    fila.reversibilidad === null ? "" : String(fila.reversibilidad),
  );
  const [areaTexto, setAreaTexto] = useState(fila.area_relativa === null ? "" : String(fila.area_relativa));
  const [tipoUnidadTexto, setTipoUnidadTexto] = useState(fila.tipo_unidad ?? "");
  const [rolTexto, setRolTexto] = useState(fila.rol ?? "");
  const [estadoTexto, setEstadoTexto] = useState(fila.estado ?? "");

  function commitNumero01(
    texto: string,
    setTexto: (v: string) => void,
    valorGuardado: number | null,
    campo: "intensidad" | "flexibilidad" | "reversibilidad",
  ) {
    if (texto.trim() === "") {
      if (valorGuardado !== null) onActualizar({ [campo]: null });
      return;
    }
    const n = Number(texto);
    if (Number.isNaN(n) || n < 0 || n > 1) {
      setTexto(valorGuardado === null ? "" : String(valorGuardado));
      return;
    }
    if (n !== valorGuardado) onActualizar({ [campo]: n });
  }

  function commitArea() {
    if (areaTexto.trim() === "") {
      if (fila.area_relativa !== null) onActualizar({ area_relativa: null });
      return;
    }
    const n = Number(areaTexto);
    if (Number.isNaN(n) || n < 0) {
      setAreaTexto(fila.area_relativa === null ? "" : String(fila.area_relativa));
      return;
    }
    if (n !== fila.area_relativa) onActualizar({ area_relativa: n });
  }

  function commitTipoUnidad() {
    const v = tipoUnidadTexto.trim();
    if (v !== (fila.tipo_unidad ?? "")) onActualizar({ tipo_unidad: v === "" ? null : v });
  }

  function commitRol() {
    const v = rolTexto.trim();
    if (v !== (fila.rol ?? "")) onActualizar({ rol: v === "" ? null : v });
  }

  function commitEstado() {
    const v = estadoTexto.trim();
    if (v !== (fila.estado ?? "")) onActualizar({ estado: v === "" ? null : v });
  }

  return (
    <div className="flex flex-col gap-1.5 px-2 py-1.5 rounded-lg bg-primary/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-bold text-primary/70 truncate">
          {fila.nombre_a} ── {fila.tipo_unidad ?? "unión"} ── {fila.nombre_b}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`rounded px-1.5 py-0.5 text-micro font-bold ${
              esUnionExplicita(fila.estado)
                ? "bg-emerald-500/10 text-emerald-500/70"
                : "bg-primary/8 text-primary/50"
            }`}
            title={
              esUnionExplicita(fila.estado)
                ? "Unión con geometría de contacto declarada explícitamente"
                : "Unión asumida por orden de capas, sin geometría de contacto declarada"
            }
          >
            {fila.estado ?? "sin estado"}
          </span>
          <button
            type="button"
            onClick={onEliminar}
            title="Quitar unión"
            className="rounded-md p-1 text-primary/25 hover:text-red-500 hover:bg-red-500/8 transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Intensidad
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            max={1}
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={intensidadTexto}
            onChange={(e) => setIntensidadTexto(e.target.value)}
            onBlur={() => commitNumero01(intensidadTexto, setIntensidadTexto, fila.intensidad, "intensidad")}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Flexibilidad
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            max={1}
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={flexibilidadTexto}
            onChange={(e) => setFlexibilidadTexto(e.target.value)}
            onBlur={() =>
              commitNumero01(flexibilidadTexto, setFlexibilidadTexto, fila.flexibilidad, "flexibilidad")
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Reversibilidad
          <input
            className="w-12 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            max={1}
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={reversibilidadTexto}
            onChange={(e) => setReversibilidadTexto(e.target.value)}
            onBlur={() =>
              commitNumero01(reversibilidadTexto, setReversibilidadTexto, fila.reversibilidad, "reversibilidad")
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Área rel.
          <input
            className="w-14 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            min={0}
            placeholder="—"
            step="any"
            type="number"
            value={areaTexto}
            onChange={(e) => setAreaTexto(e.target.value)}
            onBlur={commitArea}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Tipo
          <input
            className="w-20 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="—"
            type="text"
            value={tipoUnidadTexto}
            onChange={(e) => setTipoUnidadTexto(e.target.value)}
            onBlur={commitTipoUnidad}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Rol
          <input
            className="w-20 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="—"
            type="text"
            value={rolTexto}
            onChange={(e) => setRolTexto(e.target.value)}
            onBlur={commitRol}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-micro font-bold text-primary/40">
          Estado
          <input
            className="w-24 bg-transparent px-0 py-0.5 text-xs font-bold text-primary outline-none border-0 border-b border-primary/15 focus:border-primary/40 transition-colors"
            placeholder="declarada / inferida…"
            type="text"
            value={estadoTexto}
            onChange={(e) => setEstadoTexto(e.target.value)}
            onBlur={commitEstado}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Selector compacto de "tipo" (compuesto/estructura/material) + opción
 *  concreta dentro de ese tipo, para agregar capas o extremos de unión.
 *  Filtra el catálogo polimórfico por el tipo elegido. */
function SelectorPolimorfico({
  opciones,
  loading,
  tipo,
  setTipo,
  valorId,
  setValorId,
  excluirIds = [],
}: {
  opciones: OpcionPolimorfica[];
  loading: boolean;
  tipo: "compuesto" | "estructura" | "material";
  setTipo: (t: "compuesto" | "estructura" | "material") => void;
  valorId: string | null;
  setValorId: (id: string | null) => void;
  excluirIds?: string[];
}) {
  const filtradas = opciones.filter((o) => o.tipo === tipo && !excluirIds.includes(o.id));
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <select
        className="shrink-0 bg-transparent text-micro font-bold text-primary/60 outline-none border-0 border-b border-primary/15 focus:border-primary/40 py-0.5"
        value={tipo}
        onChange={(e) => {
          setTipo(e.target.value as "compuesto" | "estructura" | "material");
          setValorId(null);
        }}
      >
        {TIPOS_COMPONENTE.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="flex-1 min-w-0">
        <ComboSelector
          icon={<Plus size={11} />}
          items={filtradas.map((o) => ({ id: o.id, label: o.nombre }))}
          label=""
          loading={loading}
          mode="single"
          placeholder="Elegir del catálogo…"
          value={valorId}
          onChange={setValorId}
        />
      </div>
    </div>
  );
}

/**
 * Capas ordenadas (estructura_subcomponentes) + uniones estructurales
 * (estructura_uniones) de la estructura. Editable — agregar/editar/quitar
 * capas y uniones, mismo criterio de commit-on-blur y confirmación al
 * eliminar que el resto de bloques.
 *
 * geometria_id NULL se muestra explícitamente como "Sin geometría" en vez
 * de omitirse — es información real (el vacío existe en los datos), no un
 * campo vacío que deba ocultarse; no se edita desde acá (referencia una
 * geometría propia fuera del alcance de este panel).
 *
 * `estado` de cada unión se muestra y edita como texto libre (tal cual
 * viene de Supabase, ej. "inferida"/"declarada") con una etiqueta que
 * distingue visualmente una adyacencia inferida por orden de capas de una
 * unión con geometría de contacto declarada explícitamente.
 */
function CapasYUnionesBloque({ estructuraId }: { estructuraId: string }) {
  const { confirm, ConfirmModal } = useConfirm();
  const {
    items: subcomponentes,
    loading: loadingSub,
    agregar: agregarCapa,
    actualizar: actualizarCapa,
    eliminar: eliminarCapa,
  } = useEstructuraSubcomponentes(estructuraId);
  const {
    items: uniones,
    loading: loadingUniones,
    agregar: agregarUnion,
    actualizar: actualizarUnion,
    eliminar: eliminarUnion,
  } = useEstructuraUniones(estructuraId);
  const { opciones: opcionesCatalogo, loading: loadingCatalogo } = useCatalogosPolimorficos();

  const [tipoCapa, setTipoCapa] = useState<"compuesto" | "estructura" | "material">("compuesto");
  const [capaId, setCapaId] = useState<string | null>(null);
  const [guardandoCapa, setGuardandoCapa] = useState(false);

  const [tipoA, setTipoA] = useState<"compuesto" | "estructura" | "material">("compuesto");
  const [idA, setIdA] = useState<string | null>(null);
  const [tipoB, setTipoB] = useState<"compuesto" | "estructura" | "material">("compuesto");
  const [idB, setIdB] = useState<string | null>(null);
  const [guardandoUnion, setGuardandoUnion] = useState(false);

  async function handleAgregarCapa() {
    if (!capaId) return;
    setGuardandoCapa(true);
    try {
      await agregarCapa({ componente_tipo: tipoCapa, componente_id: capaId, cantidad: 1 });
      setCapaId(null);
    } finally {
      setGuardandoCapa(false);
    }
  }

  async function handleEliminarCapa(id: string, nombre: string) {
    const ok = await confirm({
      title: "Quitar capa",
      message: `¿Quitar "${nombre}" de las capas de esta estructura?`,
    });
    if (ok) await eliminarCapa(id);
  }

  async function handleAgregarUnion() {
    if (!idA || !idB) return;
    setGuardandoUnion(true);
    try {
      await agregarUnion({
        componente_a_tipo: tipoA,
        componente_a_id: idA,
        componente_b_tipo: tipoB,
        componente_b_id: idB,
      });
      setIdA(null);
      setIdB(null);
    } finally {
      setGuardandoUnion(false);
    }
  }

  async function handleEliminarUnion(id: string, nombreA: string, nombreB: string) {
    const ok = await confirm({
      title: "Quitar unión",
      message: `¿Quitar la unión entre "${nombreA}" y "${nombreB}"?`,
    });
    if (ok) await eliminarUnion(id);
  }

  const loading = loadingSub || loadingUniones;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 min-w-0 p-2">
        <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
          Capas
        </span>
        {loading ? (
          <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {subcomponentes.length === 0 && (
              <p className="py-1 text-micro text-primary/30">Sin capas registradas.</p>
            )}
            {subcomponentes.map((s) => (
              <FilaCapa
                key={s.id}
                fila={s}
                onActualizar={(cambios) => actualizarCapa(s.id, cambios)}
                onEliminar={() => handleEliminarCapa(s.id, s.nombre)}
              />
            ))}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <SelectorPolimorfico
            opciones={opcionesCatalogo}
            loading={loadingCatalogo}
            tipo={tipoCapa}
            setTipo={setTipoCapa}
            valorId={capaId}
            setValorId={setCapaId}
          />
          <button
            type="button"
            disabled={!capaId || guardandoCapa}
            onClick={handleAgregarCapa}
            className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary disabled:opacity-30 transition-all px-1"
          >
            {guardandoCapa ? "Agregando…" : "Agregar"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 min-w-0 p-2">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3 w-3 text-primary/30" />
          <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
            Uniones estructurales
          </span>
        </div>
        {loading ? (
          <div className="flex items-center gap-1.5 py-2 text-micro text-primary/40">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {uniones.length === 0 && (
              <p className="py-1 text-micro text-primary/30">Sin uniones registradas.</p>
            )}
            {uniones.map((u) => (
              <FilaUnion
                key={u.id}
                fila={u}
                onActualizar={(cambios) => actualizarUnion(u.id, cambios)}
                onEliminar={() => handleEliminarUnion(u.id, u.nombre_a, u.nombre_b)}
              />
            ))}
          </div>
        )}

        <div className="mt-1 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-micro font-black text-primary/30">A</span>
            <SelectorPolimorfico
              opciones={opcionesCatalogo}
              loading={loadingCatalogo}
              tipo={tipoA}
              setTipo={setTipoA}
              valorId={idA}
              setValorId={setIdA}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-micro font-black text-primary/30">B</span>
            <SelectorPolimorfico
              opciones={opcionesCatalogo}
              loading={loadingCatalogo}
              tipo={tipoB}
              setTipo={setTipoB}
              valorId={idB}
              setValorId={setIdB}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!idA || !idB || guardandoUnion}
              onClick={handleAgregarUnion}
              className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary disabled:opacity-30 transition-all px-1"
            >
              {guardandoUnion ? "Agregando…" : "Agregar unión"}
            </button>
          </div>
        </div>
      </div>
      <ConfirmModal />
    </div>
  );
}

function EstructuraDetail({ estructura }: { estructura: Estructura }) {
  const propiedades = estructura.propiedades_calculadas ?? {};
  const estadoCalculo = estructura.estado_calculo ?? "pendiente";

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-micro text-primary/40">
            {estructura.tipo && (
              <span className="rounded px-1.5 py-0.5 bg-primary/5 font-bold">{estructura.tipo}</span>
            )}
            <span className="rounded px-1.5 py-0.5 bg-primary/5 font-bold">
              {ESTADO_LABEL[estadoCalculo] ?? estadoCalculo}
            </span>
          </div>
          {estructura.descripcion && (
            <p className="mt-1.5 text-xs leading-relaxed text-primary/55">{estructura.descripcion}</p>
          )}
          {estructura.funcion && (
            <p className="mt-1 text-xs leading-relaxed text-primary/45">
              <span className="font-bold text-primary/55">Función: </span>
              {estructura.funcion}
            </p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="flex flex-col gap-2 min-w-0">
          <PropiedadesFisicasGenerico propiedades={propiedades} columnas={2} />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <ComposicionEstructuraBloque estructuraId={estructura.id} />
          <CapasYUnionesBloque estructuraId={estructura.id} />
          {estructura.notas && (
            <div className="flex flex-col gap-1.5 min-w-0 p-2">
              <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
                Notas
              </span>
              <p className="whitespace-pre-wrap text-micro leading-relaxed text-primary/50">
                {estructura.notas}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mismo shell exacto que el resto de paneles flotantes del dominio
 *  (Elemento/Compuesto/Material/Fenómeno/Proceso): createPortal a
 *  document.body, fixed inset-0 z-[9999] con backdrop blur, contenedor
 *  w-full h-full max-w-6xl rounded-2xl, header shrink-0 con caja de ícono
 *  7×7 + botón cerrar, cuerpo flex-1 overflow-y-auto. Las propiedades
 *  calculadas (propiedades_calculadas) siguen siendo de solo lectura, pero
 *  Compuestos/Capas/Uniones sí son editables desde acá (agregar/editar/
 *  quitar) — mismo criterio que MaterialEditorFlotante: header "default"
 *  (caja de ícono), no el sistema headerControls editable, porque la
 *  edición vive dentro de cada bloque con su propio guardado inmediato. */
function EstructuraPanelFlotante({
  estructura,
  onClose,
}: {
  estructura: Estructura;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            }}
          >
            <Box className="text-primary/50" size={12} />
          </div>
          <span className="flex-1 min-w-0 truncate text-sm font-black text-primary">
            {estructura.nombre}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          <EstructuraDetail estructura={estructura} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function EstructurasPage() {
  const { items, loading } = useEstructuras();
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const seleccionada = items.find((e) => e.id === seleccionadaId) ?? null;

  return (
    <div className="px-3 pb-4 pt-2">
      {loading ? (
        <p className="py-5 text-center text-micro text-primary/35">Cargando…</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((estructura) => (
            <button
              key={estructura.id}
              type="button"
              onClick={() => setSeleccionadaId(estructura.id)}
              title={estructura.nombre}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-bold tracking-wide transition-colors truncate max-w-full ${
                estructura.id === seleccionadaId
                  ? "text-primary border border-primary/40 ring-2 ring-primary/30"
                  : "hover:bg-primary/10 text-primary/70 border border-primary/15"
              }`}
            >
              <span className="truncate">{estructura.nombre}</span>
            </button>
          ))}
        </div>
      )}
      {seleccionada && (
        <EstructuraPanelFlotante estructura={seleccionada} onClose={() => setSeleccionadaId(null)} />
      )}
    </div>
  );
}

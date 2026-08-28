"use client";

/**
 * CatalogoTejidosBiologia.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Biblioteca global de Células y Tejidos — dos grids navegables, cada una
 * con su editor propio (crear/editar/borrar), sin necesidad de pasar por
 * ningún Órgano. Nace del pedido explícito de mostrar en Biología, arriba
 * de Órganos, la misma jerarquía Compuesto→Célula→Tejido pero como
 * catálogo de solo composición — separado de "Usar existente" (que vive
 * dentro de la fórmula de un Órgano puntual, ver SelectorFormulaTejidos.tsx).
 *
 * Migración ago-2026 (ver elementos/types.ts): Célula→Compuesto y
 * Tejido→Célula dejaron de ser 1:1 (compuesto_id/celula_id, legacy) y
 * pasaron a M:N vía tablas puente:
 *   - celula_estructuras (useCelulaEstructuras) → de qué Estructura(s)
 *     real(es) está hecha la Célula (celula_compuestos, el vínculo directo
 *     Célula→Compuesto, quedó vacía tras esta migración — ver nota en
 *     types.ts; el panel de Célula ya no la usa ni permite editarla)
 *   - tejido_celulas    (useTejidoCelulas)     → qué Células pueblan el Tejido
 *   - tejido_compuestos (useTejidoCompuestos)  → matriz extracelular directa
 * El panel de Tejido sigue con selector M:N editable (ListaVinculosMN,
 * agregar por búsqueda, quitar por fila) — el de Célula pasó a solo
 * lectura porque su composición real ahora viene de una migración/trigger,
 * no de edición manual (ver ListaEstructurasDeCelula).
 *
 * Mismo lenguaje visual que GridCatalogoGrupo (grid de 3 columnas, click
 * abre panel flotante centrado).
 */

import { Beaker, Boxes, Layers, Plus, Trash2, X, Search } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useConfirm } from "@/ui/ConfirmModal";
import { useCelulas } from "@/domains/garlia/elementos/useCelulas";
import { useTejidos } from "@/domains/garlia/elementos/useTejidos";
import {
  useEstructuraComposicion,
  type CompuestoDeEstructura,
} from "@/domains/garlia/elementos/useEstructuraComposicion";
import { useCelulaEstructuras, type EstructuraDeCelula } from "@/domains/garlia/elementos/useCelulaEstructuras";
import { useTejidoCelulas, type CelulaDeTejido } from "@/domains/garlia/elementos/useTejidoCelulas";
import { useTejidoCompuestos, type CompuestoDeTejido } from "@/domains/garlia/elementos/useTejidoCompuestos";
import { useTejidosDeUnaCelula } from "@/domains/garlia/elementos/useTejidosDeUnaCelula";
import { useOrganosDeUnTejido } from "@/domains/garlia/elementos/useOrganosDeUnTejido";
import { useOrganosDeUnaCelula } from "@/domains/garlia/elementos/useOrganosDeUnaCelula";
import type { Celula, Compuesto, Estructura, Tejido } from "@/domains/garlia/elementos/types";
import { GridPropiedadesCalculadas } from "@/domains/garlia/_shared/GridPropiedadesCalculadas";
import { BreadcrumbJerarquia } from "./BreadcrumbJerarquia";
import { PillCatalogoItem } from "@/domains/garlia/_shared/PillCatalogoItem";

interface Props {
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
  /** Navegar a un Órgano desde el breadcrumb de un Tejido — el padre
   *  (BiologiaPage/GruposCompuestosPage) decide cómo abrir su editor,
   *  ya que el Órgano vive fuera de este catálogo (ver GrupoCompuestoPanelFlotante). */
  onAbrirOrgano?: (organoId: string) => void;
}

export function CatalogoTejidosBiologia({
  compuestos,
  loadingCompuestos,
  onCompuestoCreado,
  onAbrirCompuesto,
  onAbrirOrgano,
}: Props) {
  const celulas = useCelulas();
  const tejidos = useTejidos();

  const [celulaSeleccionadaId, setCelulaSeleccionadaId] = useState<string | null>(null);
  const [tejidoSeleccionadoId, setTejidoSeleccionadoId] = useState<string | null>(null);

  const celulaActiva = celulas.items.find((c) => c.id === celulaSeleccionadaId) ?? null;
  const tejidoActivo = tejidos.items.find((t) => t.id === tejidoSeleccionadoId) ?? null;

  return (
    <div className="flex flex-wrap gap-4">
      {/* ── Células ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-2 min-w-[220px]"
        style={{ flexGrow: Math.max(celulas.items.length, 1), flexBasis: 0 }}
      >
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Células · {celulas.items.length}
          </p>
          <button
            type="button"
            onClick={() => void celulas.crear()}
            disabled={celulas.creando}
            title="Crear célula nueva"
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus size={10} /> Nueva
          </button>
        </div>

        <GridSimple
          items={celulas.items}
          loading={celulas.loading}
          icono={<Beaker size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={celulaSeleccionadaId}
          onSeleccionar={setCelulaSeleccionadaId}
          labelVacio="células"
        />

        {celulaActiva && (
          <PanelEditorCelula
            item={celulaActiva}
            compuestos={compuestos}
            loadingCompuestos={loadingCompuestos}
            onCerrar={() => setCelulaSeleccionadaId(null)}
            onActualizar={celulas.actualizar}
            onEliminar={async (id) => {
              const res = await celulas.eliminar(id);
              if (res.ok) setCelulaSeleccionadaId(null);
              return res;
            }}
            onCompuestoCreado={onCompuestoCreado}
            onAbrirCompuesto={
              onAbrirCompuesto
                ? (compuestoId) => {
                    // Cierra este panel de Célula antes de subir el id: si
                    // no, CompuestoPanelFlotante (montado por el padre,
                    // portal aparte) queda apilado ENCIMA de este — mismo
                    // z-[9999] fijo en ambos, así que un tercer nivel
                    // abierto desde el Compuesto podía terminar tapado por
                    // este panel de Célula que seguía vivo de fondo.
                    setCelulaSeleccionadaId(null);
                    onAbrirCompuesto(compuestoId);
                  }
                : undefined
            }
            onAbrirTejido={(tejidoId) => {
              setCelulaSeleccionadaId(null);
              setTejidoSeleccionadoId(tejidoId);
            }}
            onAbrirOrgano={
              onAbrirOrgano
                ? (organoId) => {
                    setCelulaSeleccionadaId(null);
                    onAbrirOrgano(organoId);
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* ── Tejidos ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-2 min-w-[220px]"
        style={{ flexGrow: Math.max(tejidos.items.length, 1), flexBasis: 0 }}
      >
        <div className="flex items-center justify-between">
          <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/50">
            Tejidos · {tejidos.items.length}
          </p>
          <button
            type="button"
            onClick={() => void tejidos.crear()}
            disabled={tejidos.creando}
            title="Crear tejido nuevo"
            className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Plus size={10} /> Nuevo
          </button>
        </div>

        <GridSimple
          items={tejidos.items}
          loading={tejidos.loading}
          icono={<Layers size={12} className="text-primary/40 shrink-0" />}
          seleccionadoId={tejidoSeleccionadoId}
          onSeleccionar={setTejidoSeleccionadoId}
          labelVacio="tejidos"
        />

        {tejidoActivo && (
          <PanelEditorTejido
            item={tejidoActivo}
            celulas={celulas.items}
            loadingCelulas={celulas.loading}
            compuestos={compuestos}
            loadingCompuestos={loadingCompuestos}
            onCerrar={() => setTejidoSeleccionadoId(null)}
            onActualizar={tejidos.actualizar}
            onEliminar={async (id) => {
              const res = await tejidos.eliminar(id);
              if (res.ok) setTejidoSeleccionadoId(null);
              return res;
            }}
            onAbrirCelula={(celulaId) => {
              setTejidoSeleccionadoId(null);
              setCelulaSeleccionadaId(celulaId);
            }}
            onCompuestoCreado={onCompuestoCreado}
            onAbrirCompuesto={
              onAbrirCompuesto
                ? (compuestoId) => {
                    // Mismo motivo que en PanelEditorCelula arriba: cerrar
                    // este panel de Tejido antes de subir el id evita que
                    // quede apilado bajo/con CompuestoPanelFlotante (mismo
                    // z-[9999] fijo, portal aparte montado por el padre).
                    setTejidoSeleccionadoId(null);
                    onAbrirCompuesto(compuestoId);
                  }
                : undefined
            }
            onAbrirOrgano={
              onAbrirOrgano
                ? (organoId) => {
                    setTejidoSeleccionadoId(null);
                    onAbrirOrgano(organoId);
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

// ─── Grid genérica (solo lista + click, sin lógica de edición) ─────────────

function GridSimple<T extends { id: string; nombre: string }>({
  items,
  loading,
  icono,
  seleccionadoId,
  onSeleccionar,
  labelVacio,
}: {
  items: T[];
  loading: boolean;
  icono: React.ReactNode;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  labelVacio: string;
}) {
  // Mismo fix que CatalogoVetasFisica.tsx: no tapar la grid con "Cargando…"
  // si ya hay items (Dexie o fetch previo) — solo cuando no hay nada todavía.
  if (loading && items.length === 0) {
    return <p className="text-micro text-primary/25 italic py-2">Cargando…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-4 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
        Sin {labelVacio} todavía
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <PillCatalogoItem
          key={item.id}
          nombre={item.nombre}
          icono={icono}
          seleccionado={seleccionadoId === item.id}
          onClick={() => onSeleccionar(item.id)}
        />
      ))}
    </div>
  );
}

// ─── Lista de Estructuras de una Célula (solo lectura) ─────────────────────
// Reemplaza a ListaVinculosMN<CompuestoDeCelula> en el panel de Célula:
// celula_estructuras se puebla por migración/triggers, no por edición
// manual, así que acá no hay buscador ni botón de quitar — solo se
// muestra la Estructura real y, anidados debajo, sus Compuestos (vía
// estructura_compuestos), para no perder de vista "de qué está hecha en
// el fondo" sin tener que abrir la Estructura aparte.
function ListaEstructurasDeCelula({
  items,
  loading,
  onAbrirCompuesto,
}: {
  items: EstructuraDeCelula[];
  loading: boolean;
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  if (loading) {
    return <p className="text-micro text-primary/25 italic py-1">Cargando…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-micro text-primary/25 italic py-1">
        Sin Estructura vinculada todavía.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((v) => (
        <div
          key={v.vinculo_id}
          className="flex flex-col gap-1.5 bg-primary/5 rounded-md px-2.5 py-2 border border-primary/10"
        >
          <div className="flex items-center gap-1.5">
            <Boxes size={11} className="text-primary/40 shrink-0" />
            <span className="text-micro font-black text-primary/80 truncate">
              {v.estructura.nombre}
            </span>
            {v.rol && (
              <span className="text-micro text-primary/40 truncate">· {v.rol}</span>
            )}
          </div>

          {v.compuestos.length > 0 && (
            <div className="flex flex-col gap-1 pl-3 border-l border-primary/10">
              {v.compuestos.map((c) => (
                <button
                  key={c.vinculo_id}
                  type="button"
                  onClick={() => onAbrirCompuesto?.(c.compuesto_id)}
                  disabled={!onAbrirCompuesto}
                  className="flex items-center gap-1.5 text-left text-micro text-primary/60 disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer w-fit"
                >
                  {c.compuesto.nombre}
                  {c.rol && <span className="text-primary/35"> · {c.rol}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Panel Célula: nombre, función, notas, Estructura real (vía
// celula_estructuras) ────────────────────────────────────────────────────
// Exportado: reutilizado directo desde SelectorFormulaTejidos (fila "hecho
// de" de un Tejido en la fórmula de un Órgano) — clickear ahí debe abrir
// ESTE panel (Célula), no el del Compuesto directo, ver cadena real en el
// comentario de arriba del archivo.

export function PanelEditorCelula({
  item,
  compuestos,
  loadingCompuestos,
  onCerrar,
  onActualizar,
  onEliminar,
  onCompuestoCreado,
  onAbrirCompuesto,
  onAbrirTejido,
  onAbrirOrgano,
}: {
  item: Celula;
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Celula>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
  /** Cierra este panel y abre el del Tejido elegido — navegación hacia arriba. */
  onAbrirTejido?: (tejidoId: string) => void;
  /** Cierra este panel y abre el del Órgano elegido — navegación transitiva
   *  (Célula → Tejido → Órgano, unión de todos los Órganos alcanzables). */
  onAbrirOrgano?: (organoId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const estructurasDeCelula = useCelulaEstructuras(item.id);
  const tejidosQueUsanEstaCelula = useTejidosDeUnaCelula(item.id);
  const organosQueUsanEstaCelula = useOrganosDeUnaCelula(item.id);

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar célula",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si algún Tejido la usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente algún Tejido todavía la usa. Quitala de ahí primero.",
      );
    }
  }

  return (
    <PanelFlotanteBase onCerrar={onCerrar}>
      <ConfirmModal />
      <PanelFlotanteHeader
        icono={<Beaker className="text-primary/50" size={12} />}
        nombre={item.nombre ?? ""}
        placeholder="Nombre…"
        onChangeNombre={(nombre) => onActualizar(item.id, { nombre })}
        onEliminar={handleEliminar}
        eliminando={eliminando}
        onCerrar={onCerrar}
      />

      <div className="shrink-0 px-3 pt-2">
        <BreadcrumbJerarquia
          niveles={[
            { label: "Célula", icono: <Beaker size={10} />, activo: true },
            {
              label: "Tejido",
              icono: <Layers size={10} />,
              activo: false,
              items: tejidosQueUsanEstaCelula.items.map((v) => ({
                id: v.tejido_id,
                nombre: v.tejido.nombre,
              })),
              loading: tejidosQueUsanEstaCelula.loading,
              onNavegar: onAbrirTejido,
            },
            {
              label: "Órgano",
              icono: <Boxes size={10} />,
              activo: false,
              items: organosQueUsanEstaCelula.items.map((o) => ({
                id: o.id,
                nombre: o.nombre,
              })),
              loading: organosQueUsanEstaCelula.loading,
              onNavegar: onAbrirOrgano,
            },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {errorEliminar && <ErrorBanner texto={errorEliminar} />}

        <div className="flex flex-col md:flex-row gap-3 md:gap-5 mt-1">
          {/* Columna izquierda: composición real — Estructura(s) de la que
              viene la célula, con sus Compuestos. Solo lectura: se puebla
              por migración/triggers (celula_estructuras +
              estructura_compuestos), no por edición manual acá — ver
              useCelulaEstructuras. */}
          <div className="md:w-1/2 min-w-0">
            <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
              Estructura · de qué está hecha la célula
            </p>
            <ListaEstructurasDeCelula
              items={estructurasDeCelula.items}
              loading={estructurasDeCelula.loading}
              onAbrirCompuesto={onAbrirCompuesto}
            />
          </div>

          {/* Columna derecha: bloques de texto — función + notas */}
          <div className="md:w-1/2 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
                Función
              </p>
              <input
                className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none placeholder:text-primary/25"
                placeholder="Función…"
                value={item.funcion ?? ""}
                onChange={(e) => onActualizar(item.id, { funcion: e.target.value })}
              />
            </div>

            <NotasField
              value={item.notas ?? ""}
              onChange={(notas) => onActualizar(item.id, { notas })}
            />

            <NotaReutilizable />
          </div>
        </div>
      </div>
    </PanelFlotanteBase>
  );
}

// ─── Panel Tejido: nombre, función, notas, Células + Compuestos de matriz
// (M:N vía tejido_celulas / tejido_compuestos) ──────────────────────────
// Exportado: reutilizado directo desde SelectorFormulaTejidos/GruposCompuestosPage
// (editor de la fórmula de un Órgano) para abrir el mismo editor completo al
// clickear el nombre de una fila — un solo editor de Tejido en toda la app.

export function PanelEditorTejido({
  item,
  celulas,
  loadingCelulas,
  compuestos,
  loadingCompuestos,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirCelula,
  onAbrirOrgano,
  onCompuestoCreado,
  onAbrirCompuesto,
}: {
  item: Tejido;
  celulas: Celula[];
  loadingCelulas?: boolean;
  compuestos: Compuesto[];
  loadingCompuestos?: boolean;
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<Tejido>) => void;
  onEliminar: (id: string) => Promise<{ ok: boolean; error: unknown }>;
  /** Cierra este panel y abre el de la Célula elegida — navegación cruzada. */
  onAbrirCelula?: (celulaId: string) => void;
  /** Cierra este panel y abre el del Órgano elegido — navegación hacia arriba. */
  onAbrirOrgano?: (organoId: string) => void;
  onCompuestoCreado?: (c: Compuesto) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  const { confirm, ConfirmModal } = useConfirm();
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const vinculosCelula = useTejidoCelulas(item.id);
  const vinculosCompuesto = useTejidoCompuestos(item.id);
  const organosQueUsanEsteTejido = useOrganosDeUnTejido(item.id);

  async function handleEliminar() {
    const ok = await confirm({
      title: "Eliminar tejido",
      message: `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer. Si algún Órgano lo usa, no se va a poder borrar.`,
    });
    if (!ok) return;
    setEliminando(true);
    setErrorEliminar(null);
    const res = await onEliminar(item.id);
    setEliminando(false);
    if (!res.ok) {
      setErrorEliminar(
        "No se pudo eliminar — probablemente algún Órgano todavía lo usa. Quitalo de esa fórmula primero.",
      );
    }
  }

  return (
    <PanelFlotanteBase onCerrar={onCerrar}>
      <ConfirmModal />
      <PanelFlotanteHeader
        icono={<Layers className="text-primary/50" size={12} />}
        nombre={item.nombre ?? ""}
        placeholder="Nombre…"
        onChangeNombre={(nombre) => onActualizar(item.id, { nombre })}
        onEliminar={handleEliminar}
        eliminando={eliminando}
        onCerrar={onCerrar}
      />

      <div className="shrink-0 px-3 pt-2">
        <BreadcrumbJerarquia
          niveles={[
            {
              label: "Célula",
              icono: <Beaker size={10} />,
              activo: false,
              items: vinculosCelula.items.map((v) => ({
                id: v.celula_id,
                nombre: v.celula.nombre,
              })),
              loading: vinculosCelula.loading,
              onNavegar: onAbrirCelula,
            },
            { label: "Tejido", icono: <Layers size={10} />, activo: true },
            {
              label: "Órgano",
              icono: <Boxes size={10} />,
              activo: false,
              items: organosQueUsanEsteTejido.items.map((v) => ({
                id: v.organo_id,
                nombre: v.organo.nombre,
              })),
              loading: organosQueUsanEsteTejido.loading,
              onNavegar: onAbrirOrgano,
            },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {errorEliminar && <ErrorBanner texto={errorEliminar} />}

        <div className="flex flex-col md:flex-row gap-3 md:gap-5 mt-1">
          {/* Columna izquierda: composición / vínculos */}
          <div className="md:w-1/2 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
                Células · qué tipos celulares lo pueblan
              </p>
              <ListaVinculosMN<CelulaDeTejido>
                items={vinculosCelula.items}
                loading={vinculosCelula.loading}
                catalogo={celulas}
                loadingCatalogo={loadingCelulas}
                getNombre={(v) => v.celula.nombre}
                getCatalogoId={(v) => v.celula_id}
                rolPlaceholder="Rol (ej. célula principal)…"
                iconoCatalogo={<Beaker size={11} className="text-accent/60 shrink-0" />}
                onAgregar={(celulaId) => void vinculosCelula.vincularExistente(celulaId)}
                onActualizarRol={vinculosCelula.actualizarRol}
                onQuitar={vinculosCelula.quitar}
                onAbrirItem={onAbrirCelula}
              />
            </div>

            <div>
              <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
                Compuestos de matriz · material directo, sin pasar por una célula
              </p>
              <ListaVinculosMN<CompuestoDeTejido>
                items={vinculosCompuesto.items}
                loading={vinculosCompuesto.loading}
                catalogo={compuestos}
                loadingCatalogo={loadingCompuestos}
                getNombre={(v) => v.compuesto.nombre}
                getCatalogoId={(v) => v.compuesto_id}
                rolPlaceholder="Rol (ej. matriz extracelular)…"
                onAgregar={(compuestoId) => void vinculosCompuesto.vincularExistente(compuestoId)}
                onActualizarRol={vinculosCompuesto.actualizarRol}
                onQuitar={vinculosCompuesto.quitar}
                onAbrirCompuesto={onAbrirCompuesto}
                onCompuestoCreado={onCompuestoCreado}
              />
            </div>
          </div>

          {/* Columna derecha: bloques de texto — función + notas */}
          <div className="md:w-1/2 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">
                Función
              </p>
              <input
                className="w-full bg-transparent px-0 py-0.5 text-micro font-bold text-primary/60 outline-none placeholder:text-primary/25"
                placeholder="Función…"
                value={item.funcion ?? ""}
                onChange={(e) => onActualizar(item.id, { funcion: e.target.value })}
              />
            </div>

            <NotasField
              value={item.notas ?? ""}
              onChange={(notas) => onActualizar(item.id, { notas })}
            />

            <NotaReutilizable />
          </div>
        </div>
      </div>
    </PanelFlotanteBase>
  );
}

// ─── ListaVinculosMN: lista genérica de vínculos M:N con rol libre —
// reemplaza a los viejos SelectorCompuesto/SelectorCelula (single-pick) en
// este archivo. Cada fila: nombre del item vinculado (clickeable si se
// provee onAbrirItem/onAbrirCompuesto) + input de rol + botón quitar.
// Debajo, un buscador para agregar un vínculo nuevo del catálogo — no crea
// entradas nuevas de Célula/Compuesto desde acá, solo vincula existentes,
// igual que useOrganoTejidos con "usar existente". ──────────────────────

interface VinculoConNombre {
  vinculo_id: string;
  rol: string | null;
}

function ListaVinculosMN<T extends VinculoConNombre>({
  items,
  loading,
  catalogo,
  loadingCatalogo,
  getNombre,
  getCatalogoId,
  rolPlaceholder,
  iconoCatalogo,
  onAgregar,
  onActualizarRol,
  onQuitar,
  onAbrirItem,
  onAbrirCompuesto,
}: {
  items: T[];
  loading: boolean;
  catalogo: { id: string; nombre: string }[];
  loadingCatalogo?: boolean;
  getNombre: (v: T) => string;
  getCatalogoId: (v: T) => string;
  rolPlaceholder: string;
  iconoCatalogo?: React.ReactNode;
  onAgregar: (catalogoId: string) => void;
  onActualizarRol: (vinculoId: string, rol: string) => void;
  onQuitar: (vinculoId: string) => void;
  /** Navegación cruzada genérica (ej. abrir la Célula vinculada). */
  onAbrirItem?: (catalogoId: string) => void;
  /** Navegación cruzada específica para Compuesto (nombre distinto por claridad). */
  onAbrirCompuesto?: (compuestoId: string) => void;
  onCompuestoCreado?: (c: Compuesto) => void;
}) {
  const [buscando, setBuscando] = useState(false);

  const yaVinculadosIds = useMemo(() => new Set(items.map(getCatalogoId)), [items, getCatalogoId]);
  const disponibles = useMemo(
    () => catalogo.filter((c) => !yaVinculadosIds.has(c.id)),
    [catalogo, yaVinculadosIds],
  );

  const abrir = onAbrirItem ?? onAbrirCompuesto;

  return (
    <div className="flex flex-col gap-1.5">
      {loading ? (
        <p className="text-micro text-primary/25 italic py-1">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-micro text-primary/25 italic py-1">Sin vínculos todavía</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((v) => (
            <div
              key={v.vinculo_id}
              className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/10"
            >
              {iconoCatalogo}
              <button
                type="button"
                onClick={() => abrir?.(getCatalogoId(v))}
                disabled={!abrir}
                className="shrink-0 max-w-[45%] truncate text-left text-micro font-bold text-primary/80 disabled:cursor-default hover:enabled:text-accent hover:enabled:underline cursor-pointer"
              >
                {getNombre(v) || "Sin nombre"}
              </button>
              <input
                value={v.rol ?? ""}
                onChange={(e) => onActualizarRol(v.vinculo_id, e.target.value)}
                placeholder={rolPlaceholder}
                className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-micro text-primary/60 outline-none placeholder:text-primary/25"
              />
              <button
                type="button"
                onClick={() => onQuitar(v.vinculo_id)}
                title="Quitar"
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-primary/40 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {buscando ? (
        <PickerCatalogoExistente
          disponibles={disponibles}
          loading={loadingCatalogo}
          onElegir={(id) => {
            onAgregar(id);
            setBuscando(false);
          }}
          onClose={() => setBuscando(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setBuscando(true)}
          className="flex items-center gap-1 self-start text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors cursor-pointer"
        >
          <Plus size={10} /> Agregar
        </button>
      )}
    </div>
  );
}

function PickerCatalogoExistente({
  disponibles,
  loading,
  onElegir,
  onClose,
}: {
  disponibles: { id: string; nombre: string }[];
  loading?: boolean;
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
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2.5 pr-1.5 py-1.5 border border-primary/15">
        <Search size={12} className="text-primary/30 shrink-0" />
        <input
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onBlur={() => setTimeout(onClose, 120)}
          placeholder={loading ? "Cargando…" : "Buscar para vincular…"}
          className="flex-1 min-w-0 bg-transparent px-0 py-0.5 text-micro font-bold text-primary outline-none placeholder:text-primary/30 placeholder:font-normal"
        />
        <button
          type="button"
          onMouseDown={onClose}
          title="Cancelar"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-primary/30 hover:text-primary transition-colors cursor-pointer"
        >
          <X size={10} />
        </button>
      </div>

      <div
        className="absolute z-20 mt-1 left-0 right-0 max-h-48 overflow-y-auto rounded-md border shadow-lg"
        style={{
          background: "var(--bg-main)",
          borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
        }}
      >
        {filtrados.length === 0 ? (
          <p className="text-micro text-primary/25 italic text-center py-2">Sin resultados</p>
        ) : (
          filtrados.slice(0, 30).map((d) => (
            <button
              key={d.id}
              type="button"
              onMouseDown={() => onElegir(d.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-micro font-bold text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate"
            >
              {d.nombre || "Sin nombre"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Piezas chicas compartidas ──────────────────────────────────────────────

function PanelFlotanteBase({
  children,
  onCerrar,
}: {
  children: React.ReactNode;
  onCerrar: () => void;
}) {
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
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Header estándar del panel flotante grande — mismo look que
 * ElementoPanelFlotante/CompuestoPanelFlotante: cuadro con ícono a la
 * izquierda, input de nombre grande, botón eliminar y botón cerrar a la
 * derecha. A diferencia de Elemento/Compuesto (que publican headerControls
 * con botón "Guardar" explícito), acá se mantiene el autosave on-change ya
 * existente en Tejido/Célula/Grano/Veta — solo se iguala la cáscara visual.
 */
function PanelFlotanteHeader({
  icono,
  nombre,
  placeholder,
  onChangeNombre,
  onEliminar,
  eliminando,
  onCerrar,
}: {
  icono: React.ReactNode;
  nombre: string;
  placeholder: string;
  onChangeNombre: (nombre: string) => void;
  onEliminar: () => void;
  eliminando?: boolean;
  onCerrar: () => void;
}) {
  return (
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
        {icono}
      </div>
      <input
        className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
        placeholder={placeholder}
        value={nombre}
        onChange={(e) => onChangeNombre(e.target.value)}
      />
      <button
        type="button"
        onClick={onEliminar}
        disabled={eliminando}
        title="Eliminar"
        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all disabled:opacity-40 cursor-pointer"
      >
        <Trash2 size={10} />
      </button>
      <button
        type="button"
        onClick={onCerrar}
        title="Cerrar (Esc)"
        className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors cursor-pointer"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function ErrorBanner({ texto }: { texto: string }) {
  return (
    <p className="text-micro text-red-500/80 bg-red-500/5 border border-red-500/15 rounded-md px-2 py-1.5">
      {texto}
    </p>
  );
}

function NotasField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-1">Notas</p>
      <textarea
        className="w-full min-h-[4rem] bg-transparent px-0 py-1 text-primary/70 resize-none outline-none placeholder:text-primary/25"
        placeholder="Notas…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NotaReutilizable() {
  return (
    <p className="text-micro text-primary/25 italic">
      Reutilizable: se puede vincular a varios Órganos desde el botón &quot;Usar existente&quot;
      en la fórmula de cada Órgano.
    </p>
  );
}

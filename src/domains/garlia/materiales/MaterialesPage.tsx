"use client";

import {
  Box,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import React, { useMemo, useState } from "react";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useEstructuras } from "@/domains/garlia/elementos/useEstructuras";

import { useMaterialComponentes } from "./useMaterialComponentes";
import { useMaterialEstructuras } from "./useMaterialEstructuras";
import { useMateriales } from "./useMateriales";
import type { Material } from "./types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(3);
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function PropertyRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-primary/10 last:border-b-0">
      <span className="text-sm text-primary/55">{label}</span>
      <span className="text-sm font-medium text-primary">
        {formatValue(value)}
      </span>
    </div>
  );
}

function MaterialProperties({
  material,
}: {
  material: Material;
}) {
  const propiedades = material.propiedades_calculadas ?? {};

  const knownProperties = [
    ["masa", "Masa"],
    ["carga", "Carga"],
    ["rigidez", "Rigidez"],
    ["estabilidad", "Estabilidad"],
    ["flexibilidad", "Flexibilidad"],
    ["dureza", "Dureza"],
    ["conductividad", "Conductividad"],
    ["transparencia", "Transparencia"],
  ] as const;

  const visibles = knownProperties.filter(
    ([key]) => propiedades[key] !== undefined,
  );

  return (
    <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-primary">
          Propiedades físicas
        </h3>

        <p className="mt-1 text-xs text-primary/45">
          Calculadas por Supabase · solo lectura
        </p>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-primary/40">
          No hay propiedades calculadas disponibles.
        </p>
      ) : (
        <div>
          {visibles.map(([key, label]) => (
            <PropertyRow
              key={key}
              label={label}
              value={propiedades[key]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MaterialDetail({
  material,
}: {
  material: Material;
}) {
  const { items: componentes, loading: loadingComponentes } =
    useMaterialComponentes(material.id);

  const { items: estructuras, loading: loadingEstructuras } =
    useMaterialEstructuras(material.id);

  const { items: compuestos } = useCompuestos();
  const { items: estructurasCatalogo } = useEstructuras();

  return (
    <div className="space-y-4">
      <header className="border-b border-primary/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-primary/15 bg-primary/5 p-2">
            <Box className="h-5 w-5 text-primary/70" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-primary">
              {material.nombre}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary/45">
              <span>{material.tipo_material}</span>

              <span>·</span>

              <span>
                {material.estado_calculo || "sin estado"}
              </span>
            </div>
          </div>
        </div>

        {material.descripcion && (
          <p className="mt-4 text-sm leading-relaxed text-primary/60">
            {material.descripcion}
          </p>
        )}
      </header>

      <MaterialProperties material={material} />

      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <h3 className="text-sm font-semibold text-primary">
          Componentes
        </h3>

        <p className="mt-1 text-xs text-primary/45">
          Composición normalizada del material
        </p>

        {loadingComponentes ? (
          <div className="flex items-center gap-2 py-5 text-sm text-primary/45">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando componentes…
          </div>
        ) : componentes.length === 0 ? (
          <p className="py-4 text-sm text-primary/40">
            Este material no tiene componentes registrados.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {componentes.map((componente) => {
              const compuesto =
                componente.componente_tipo === "compuesto"
                  ? compuestos.find(
                      (item) => item.id === componente.componente_id,
                    )
                  : null;

              return (
                <div
                  key={componente.id}
                  className="rounded-lg border border-primary/10 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-primary">
                      {compuesto?.nombre ??
                        `${componente.componente_tipo} · ${componente.componente_id.slice(0, 8)}`}
                    </span>

                    <span className="text-xs text-primary/50">
                      {formatValue(componente.cantidad)}
                      {componente.unidad
                        ? ` ${componente.unidad}`
                        : ""}
                    </span>
                  </div>

                  {(componente.rol ||
                    componente.proporcion_min !== null ||
                    componente.proporcion_max !== null) && (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-primary/40">
                      {componente.rol && (
                        <span>{componente.rol}</span>
                      )}

                      {componente.proporcion_min !== null && (
                        <span>
                          mín. {formatValue(componente.proporcion_min)}
                        </span>
                      )}

                      {componente.proporcion_max !== null && (
                        <span>
                          máx. {formatValue(componente.proporcion_max)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
        <h3 className="text-sm font-semibold text-primary">
          Estructuras
        </h3>

        <p className="mt-1 text-xs text-primary/45">
          Estructuras físicas utilizadas por el material
        </p>

        {loadingEstructuras ? (
          <div className="flex items-center gap-2 py-5 text-sm text-primary/45">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando estructuras…
          </div>
        ) : estructuras.length === 0 ? (
          <p className="py-4 text-sm text-primary/40">
            No hay estructuras asociadas.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {estructuras.map((relacion) => {
              const estructura = estructurasCatalogo.find(
                (item) => item.id === relacion.estructura_id,
              );

              return (
                <div
                  key={relacion.id}
                  className="flex items-center justify-between rounded-lg border border-primary/10 px-3 py-2"
                >
                  <span className="text-sm text-primary">
                    {estructura?.nombre ??
                      relacion.estructura_id.slice(0, 8)}
                  </span>

                  <span className="text-xs text-primary/50">
                    × {formatValue(relacion.cantidad)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {material.notas && (
        <section className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
          <h3 className="text-sm font-semibold text-primary">
            Notas
          </h3>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-primary/55">
            {material.notas}
          </p>
        </section>
      )}
    </div>
  );
}

function MaterialCard({
  material,
  selected,
  onClick,
}: {
  material: Material;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-primary/30 bg-primary/10"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-primary/10 bg-primary/5 p-2">
          <Box className="h-4 w-4 text-primary/60" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-primary">
            {material.nombre}
          </div>

          <div className="mt-0.5 text-xs text-primary/40">
            {material.tipo_material}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-primary/30" />
      </div>
    </button>
  );
}

export function MaterialesPage() {
  const { items: materiales, loading } = useMateriales();

  const [busqueda, setBusqueda] = useState("");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(
    null,
  );

  const filtrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();

    if (!query) return materiales;

    return materiales.filter((material) => {
      return (
        material.nombre.toLowerCase().includes(query) ||
        material.tipo_material.toLowerCase().includes(query) ||
        material.descripcion?.toLowerCase().includes(query)
      );
    });
  }, [materiales, busqueda]);

  const seleccionado =
    materiales.find((material) => material.id === seleccionadoId) ??
    null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-primary/10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-primary">
              Materiales
            </h1>

            <p className="mt-0.5 text-xs text-primary/45">
              Catálogo físico · {materiales.length} materiales
            </p>
          </div>

          <div className="relative w-64 max-w-[45vw]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/35" />

            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar material…"
              className="w-full rounded-lg border border-primary/10 bg-primary/[0.02] py-2 pl-9 pr-3 text-sm text-primary outline-none placeholder:text-primary/30 focus:border-primary/25"
            />
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-b border-primary/10 p-3 lg:border-b-0 lg:border-r">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-primary/45">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando materiales…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-10 text-center text-sm text-primary/40">
              No se encontraron materiales.
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  selected={material.id === seleccionadoId}
                  onClick={() => setSeleccionadoId(material.id)}
                />
              ))}
            </div>
          )}
        </aside>

        <main className="min-h-0 overflow-y-auto p-5">
          {seleccionado ? (
            <div className="mx-auto max-w-3xl">
              <MaterialDetail material={seleccionado} />
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Box className="mx-auto h-8 w-8 text-primary/20" />

                <p className="mt-3 text-sm text-primary/45">
                  Selecciona un material
                </p>

                <p className="mt-1 text-xs text-primary/30">
                  Sus propiedades y composición aparecerán aquí.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default MaterialesPage;

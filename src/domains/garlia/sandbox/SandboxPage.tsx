"use client";

/**
 * SandboxPage.tsx
 *
 * Sandbox experimental conectado al catálogo real de Elementos/Compuestos.
 *
 * El catálogo sigue siendo responsabilidad del dominio elementos.
 * El Sandbox solo:
 *
 *   1. permite seleccionar un elemento/compuesto,
 *   2. muestra una previsualización,
 *   3. copia sus propiedades iniciales al Sandbox,
 *   4. conserva entidad_origen_id,
 *   5. deja al motor de Supabase modificar estado_actual.
 */

import {
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";

import {
  useCompuestos,
  useElementos,
} from "@/domains/garlia/elementos";
import type {
  Compuesto,
  Elemento,
} from "@/domains/garlia/elementos/types";

import { Btn } from "@/ui/Buttons";
import { Badge, EmptyState, Loading } from "@/ui/Feedback";
import { Card, PageHeader } from "@/ui/Layout";
import { Input, Select } from "@/ui/Inputs";
import { Text } from "@/ui/Tipografia";

import {
  useCrearSandbox,
  useListaSandboxes,
  useSandbox,
} from "./useSandbox";

type TipoCatalogo = "elemento" | "compuesto";

function EtiquetaSeccion({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p
      className="text-micro font-black uppercase tracking-[0.2em] mb-3"
      style={{
        color:
          "color-mix(in srgb, var(--primary) 45%, transparent)",
      }}
    >
      {children}
    </p>
  );
}

/**
 * Convierte los datos físicos ya calculados por Supabase
 * en propiedades iniciales experimentales del Sandbox.
 *
 * IMPORTANTE:
 * No recalcula ninguna propiedad física.
 * Solo copia valores que ya existen en el catálogo.
 */
function estadoInicialDeElemento(
  elemento: Elemento,
): Record<string, unknown> {
  const propiedades: Record<string, unknown> = {};

  const propiedadesFisicas = [
    "masa_base",
    "estabilidad",
    "rigidez",
    "flexibilidad",
    "dureza",
    "conductividad",
    "transparencia",
    "capacidad_transformacion",
    "dinamismo_particular",
    "valencia_estructural",
    "capacidad_enlace",
    "polaridad_estructural",
    "saturacion_enlace",
    "regimen_estructural",
  ] as const;

  for (const clave of propiedadesFisicas) {
    const valor = elemento[clave];

    if (valor !== null && valor !== undefined) {
      propiedades[clave] = valor;
    }
  }

  propiedades.numero_atomico = elemento.numero_atomico;
  propiedades.es_noble = elemento.es_noble;
  propiedades.es_catalizador = elemento.es_catalizador ?? false;

  propiedades.nucleo = elemento.nucleo;
  propiedades.media = elemento.media;
  propiedades.externa = elemento.externa;

  return {
    propiedades,
    estados: {},
  };
}

/**
 * Igual que para Elementos, pero respetando las propiedades
 * calculadas que ya proporciona Supabase para Compuestos.
 */
function estadoInicialDeCompuesto(
  compuesto: Compuesto,
): Record<string, unknown> {
  const propiedades: Record<string, unknown> = {};

  const propiedadesFisicas = [
    "masa",
    "carga",
    "estabilidad",
    "rigidez",
    "flexibilidad",
    "compatibilidad",
    "energia_enlace",
  ] as const;

  for (const clave of propiedadesFisicas) {
    const valor = compuesto[clave];

    if (valor !== null && valor !== undefined) {
      propiedades[clave] = valor;
    }
  }

  if (compuesto.tipo_compuesto != null) {
    propiedades.tipo_compuesto = compuesto.tipo_compuesto;
  }

  if (compuesto.estado_estructura != null) {
    propiedades.estado_estructura =
      compuesto.estado_estructura;
  }

  if (compuesto.formula_canonica != null) {
    propiedades.formula_canonica =
      compuesto.formula_canonica;
  }

  if (compuesto.clasificacion != null) {
    propiedades.clasificacion =
      compuesto.clasificacion;
  }

  if (compuesto.tipo_estructura != null) {
    propiedades.tipo_estructura =
      compuesto.tipo_estructura;
  }

  if (compuesto.estado != null) {
    propiedades.estado = compuesto.estado;
  }

  return {
    propiedades,
    estados: {},
  };
}

function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "—";
  }

  if (typeof valor === "number") {
    return Number.isInteger(valor)
      ? String(valor)
      : valor.toFixed(3);
  }

  if (typeof valor === "boolean") {
    return valor ? "Sí" : "No";
  }

  return String(valor);
}

function PropiedadPreview({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span
        className="text-micro font-bold"
        style={{
          color:
            "color-mix(in srgb, var(--primary) 55%, transparent)",
        }}
      >
        {label}
      </span>

      <span className="text-micro font-black text-primary tabular-nums">
        {formatearValor(value)}
      </span>
    </div>
  );
}

export function SandboxPage() {
  const [simulacionId, setSimulacionId] =
    useState<string | null>(null);

  const [nombreNuevo, setNombreNuevo] = useState("");

  const { crear, creando } = useCrearSandbox();

  const {
    simulaciones,
    loading: cargandoLista,
    refetch: refetchLista,
  } = useListaSandboxes();

  const {
    simulacion,
    entidades,
    eventos,
    catalogoEventos,
    loading,
    error,
    ejecutandoAccion,
    play,
    pause,
    step,
    reset,
    dispararEvento,
    agregarEntidadDesdeCatalogo,
  } = useSandbox(simulacionId);

  const {
    items: elementos,
    loading: cargandoElementos,
  } = useElementos();

  const {
    items: compuestos,
    loading: cargandoCompuestos,
  } = useCompuestos();

  const [tipoCatalogo, setTipoCatalogo] =
    useState<TipoCatalogo>("elemento");

  const [catalogoSeleccionado, setCatalogoSeleccionado] =
    useState("");

  const [agregandoEntidad, setAgregandoEntidad] =
    useState(false);

  const [entidadSeleccionada, setEntidadSeleccionada] =
    useState("");

  const [eventoSeleccionado, setEventoSeleccionado] =
    useState("");

  async function handleCrear() {
    if (!nombreNuevo.trim()) return;

    const id = await crear(nombreNuevo.trim());

    if (id) {
      setSimulacionId(id);
      setNombreNuevo("");
      refetchLista();
    }
  }

  const entidadCatalogoSeleccionada = useMemo(() => {
    if (!catalogoSeleccionado) {
      return null;
    }

    if (tipoCatalogo === "elemento") {
      return (
        elementos.find(
          (elemento) =>
            elemento.id === catalogoSeleccionado,
        ) ?? null
      );
    }

    return (
      compuestos.find(
        (compuesto) =>
          compuesto.id === catalogoSeleccionado,
      ) ?? null
    );
  }, [
    tipoCatalogo,
    catalogoSeleccionado,
    elementos,
    compuestos,
  ]);

  const estadoInicialSeleccionado = useMemo(() => {
    if (!entidadCatalogoSeleccionada) {
      return null;
    }

    if (tipoCatalogo === "elemento") {
      return estadoInicialDeElemento(
        entidadCatalogoSeleccionada as Elemento,
      );
    }

    return estadoInicialDeCompuesto(
      entidadCatalogoSeleccionada as Compuesto,
    );
  }, [
    tipoCatalogo,
    entidadCatalogoSeleccionada,
  ]);

  async function handleAgregarDesdeCatalogo() {
    if (
      !entidadCatalogoSeleccionada ||
      !estadoInicialSeleccionado
    ) {
      return;
    }

    setAgregandoEntidad(true);

    try {
      const id =
        await agregarEntidadDesdeCatalogo({
          entidadTipo: tipoCatalogo,
          entidadOrigenId:
            entidadCatalogoSeleccionada.id,
          estadoInicial:
            estadoInicialSeleccionado,
        });

      if (id) {
        setCatalogoSeleccionado("");
      }
    } finally {
      setAgregandoEntidad(false);
    }
  }

  function cambiarTipoCatalogo(
    tipo: TipoCatalogo,
  ) {
    setTipoCatalogo(tipo);
    setCatalogoSeleccionado("");
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <PageHeader
        icon={<Zap size={20} />}
        subtitle="Entorno experimental aislado — el motor de reglas vive en Supabase"
        title="Sandbox"
      />

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-[var(--radius-btn)] text-micro font-bold"
          style={{
            background:
              "color-mix(in srgb, var(--primary) 10%, transparent)",
            border:
              "var(--border-width) solid color-mix(in srgb, var(--primary) 25%, transparent)",
            color: "var(--primary)",
          }}
        >
          {error}
        </div>
      )}

      <Card className="mb-6" padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <EtiquetaSeccion>
              Cargar existente
            </EtiquetaSeccion>

            <Select
              onChange={(e) =>
                setSimulacionId(
                  e.target.value || null,
                )
              }
              options={[
                {
                  value: "",
                  label: cargandoLista
                    ? "Cargando..."
                    : "— Elegir sandbox —",
                },
                ...simulaciones.map((s) => ({
                  value: s.id,
                  label: `${s.nombre} (t=${s.tiempo_simulado})`,
                })),
              ]}
              value={simulacionId ?? ""}
            />
          </div>

          <div>
            <EtiquetaSeccion>
              Crear nueva
            </EtiquetaSeccion>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  onChange={(e) =>
                    setNombreNuevo(e.target.value)
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    handleCrear()
                  }
                  placeholder="Nombre del sandbox"
                  value={nombreNuevo}
                />
              </div>

              <Btn
                icon={<Plus size={14} />}
                loading={creando}
                onClick={handleCrear}
              >
                Crear
              </Btn>
            </div>
          </div>
        </div>

        {simulacionId && (
          <p
            className="mt-3 text-micro font-bold"
            style={{
              color:
                "color-mix(in srgb, var(--primary) 35%, transparent)",
            }}
          >
            simulacion_id activo ·{" "}
            <code className="font-mono">
              {simulacionId}
            </code>
          </p>
        )}
      </Card>

      {!simulacionId && (
        <EmptyState
          icon={<Zap size={28} />}
          label="Crea o carga un sandbox para empezar"
        />
      )}

      {simulacionId && loading && (
        <Loading
          fullScreen={false}
          text="Cargando sandbox..."
        />
      )}

      {simulacionId && simulacion && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 items-start">
          <div className="flex flex-col gap-6">
            <Card padding="md">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <EtiquetaSeccion>
                    tiempo_simulado
                  </EtiquetaSeccion>

                  <Text
                    as="p"
                    className="text-primary font-black"
                    variant="xl"
                  >
                    {simulacion.tiempo_simulado}
                  </Text>
                </div>

                <Badge active>
                  {simulacion.estado}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Btn
                  icon={<Play size={14} />}
                  loading={ejecutandoAccion}
                  onClick={play}
                  size="sm"
                  variant="primary"
                >
                  Play
                </Btn>

                <Btn
                  icon={<Pause size={14} />}
                  loading={ejecutandoAccion}
                  onClick={pause}
                  size="sm"
                  variant="outline"
                >
                  Pause
                </Btn>

                <Btn
                  icon={<SkipForward size={14} />}
                  loading={ejecutandoAccion}
                  onClick={() => step(1)}
                  size="sm"
                  variant="outline"
                >
                  Step
                </Btn>

                <Btn
                  icon={<RotateCcw size={14} />}
                  loading={ejecutandoAccion}
                  onClick={reset}
                  size="sm"
                  variant="danger"
                >
                  Reset
                </Btn>
              </div>
            </Card>

            {/* ─────────────────────────────────────────────
                CATÁLOGO → SANDBOX
            ────────────────────────────────────────────── */}
            <Card padding="md">
              <EtiquetaSeccion>
                Agregar desde catálogo
              </EtiquetaSeccion>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <Btn
                  size="sm"
                  variant={
                    tipoCatalogo === "elemento"
                      ? "primary"
                      : "outline"
                  }
                  onClick={() =>
                    cambiarTipoCatalogo(
                      "elemento",
                    )
                  }
                >
                  Elemento
                </Btn>

                <Btn
                  size="sm"
                  variant={
                    tipoCatalogo === "compuesto"
                      ? "primary"
                      : "outline"
                  }
                  onClick={() =>
                    cambiarTipoCatalogo(
                      "compuesto",
                    )
                  }
                >
                  Compuesto
                </Btn>
              </div>

              <Select
                label={
                  tipoCatalogo === "elemento"
                    ? "Elemento"
                    : "Compuesto"
                }
                onChange={(e) =>
                  setCatalogoSeleccionado(
                    e.target.value,
                  )
                }
                options={[
                  {
                    value: "",
                    label:
                      tipoCatalogo === "elemento"
                        ? cargandoElementos
                          ? "Cargando elementos..."
                          : "— Elegir elemento —"
                        : cargandoCompuestos
                          ? "Cargando compuestos..."
                          : "— Elegir compuesto —",
                  },

                  ...(tipoCatalogo === "elemento"
                    ? elementos.map((elemento) => ({
                        value: elemento.id,
                        label: `${elemento.simbolo} — ${elemento.nombre}`,
                      }))
                    : compuestos.map(
                        (compuesto) => ({
                          value: compuesto.id,
                          label: `${compuesto.simbolo ? `${compuesto.simbolo} — ` : ""}${compuesto.nombre}`,
                        }),
                      )),
                ]}
                value={catalogoSeleccionado}
              />

              {entidadCatalogoSeleccionada && (
                <div
                  className="mt-4 rounded-[var(--radius-btn)] p-3"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 5%, transparent)",
                    border:
                      "var(--border-width) solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Text
                        as="p"
                        className="text-primary font-black"
                        variant="sm"
                      >
                        {entidadCatalogoSeleccionada.nombre}
                      </Text>

                      <span
                        className="text-micro font-bold"
                        style={{
                          color:
                            "color-mix(in srgb, var(--primary) 45%, transparent)",
                        }}
                      >
                        {tipoCatalogo}
                        {" · "}
                        {entidadCatalogoSeleccionada.id.slice(
                          0,
                          8,
                        )}
                      </span>
                    </div>

                    <Badge>
                      catálogo
                    </Badge>
                  </div>

                  {tipoCatalogo ===
                    "elemento" && (
                    <div>
                      {(() => {
                        const el =
                          entidadCatalogoSeleccionada as Elemento;

                        return (
                          <>
                            <PropiedadPreview
                              label="Masa"
                              value={
                                el.masa_base
                              }
                            />
                            <PropiedadPreview
                              label="Estabilidad"
                              value={
                                el.estabilidad
                              }
                            />
                            <PropiedadPreview
                              label="Rigidez"
                              value={
                                el.rigidez
                              }
                            />
                            <PropiedadPreview
                              label="Flexibilidad"
                              value={
                                el.flexibilidad
                              }
                            />
                            <PropiedadPreview
                              label="Capacidad de enlace"
                              value={
                                el.capacidad_enlace
                              }
                            />
                            <PropiedadPreview
                              label="Régimen"
                              value={
                                el.regimen_estructural
                              }
                            />
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {tipoCatalogo ===
                    "compuesto" && (
                    <div>
                      {(() => {
                        const compuesto =
                          entidadCatalogoSeleccionada as Compuesto;

                        return (
                          <>
                            <PropiedadPreview
                              label="Masa"
                              value={
                                compuesto.masa
                              }
                            />
                            <PropiedadPreview
                              label="Carga"
                              value={
                                compuesto.carga
                              }
                            />
                            <PropiedadPreview
                              label="Estabilidad"
                              value={
                                compuesto.estabilidad
                              }
                            />
                            <PropiedadPreview
                              label="Rigidez"
                              value={
                                compuesto.rigidez
                              }
                            />
                            <PropiedadPreview
                              label="Flexibilidad"
                              value={
                                compuesto.flexibilidad
                              }
                            />
                            <PropiedadPreview
                              label="Compatibilidad"
                              value={
                                compuesto.compatibilidad
                              }
                            />
                            <PropiedadPreview
                              label="Energía de enlace"
                              value={
                                compuesto.energia_enlace
                              }
                            />
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <Btn
                    className="mt-4 w-full"
                    disabled={
                      !entidadCatalogoSeleccionada
                    }
                    icon={<Plus size={14} />}
                    loading={agregandoEntidad}
                    onClick={
                      handleAgregarDesdeCatalogo
                    }
                    size="sm"
                    variant="primary"
                  >
                    Copiar al Sandbox
                  </Btn>
                </div>
              )}
            </Card>

            {/* ─────────────────────────────────────────────
                DISPARAR EVENTO
            ────────────────────────────────────────────── */}
            <Card padding="md">
              <EtiquetaSeccion>
                Disparar evento
              </EtiquetaSeccion>

              <div className="grid grid-cols-1 gap-3">
                <Select
                  label="Entidad"
                  onChange={(e) =>
                    setEntidadSeleccionada(
                      e.target.value,
                    )
                  }
                  options={[
                    {
                      value: "",
                      label: "—",
                    },
                    ...entidades.map((e) => ({
                      value: e.id,
                      label: e.entidad_tipo,
                    })),
                  ]}
                  value={entidadSeleccionada}
                />

                <Select
                  label="Evento"
                  onChange={(e) =>
                    setEventoSeleccionado(
                      e.target.value,
                    )
                  }
                  options={[
                    {
                      value: "",
                      label: "—",
                    },
                    ...catalogoEventos.map(
                      (ev) => ({
                        value: ev.id,
                        label: String(
                          ev.nombre ?? ev.id,
                        ),
                      }),
                    ),
                  ]}
                  value={eventoSeleccionado}
                />
              </div>

              <Btn
                className="mt-4 w-full"
                disabled={
                  !entidadSeleccionada ||
                  !eventoSeleccionado
                }
                icon={<Zap size={14} />}
                onClick={() =>
                  dispararEvento({
                    eventoId:
                      eventoSeleccionado,
                    entidadId:
                      entidadSeleccionada,
                  })
                }
                size="sm"
              >
                Encolar evento
              </Btn>
            </Card>
          </div>

          {/* ─────────────────────────────────────────────
              ESTADO EN VIVO
          ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <EtiquetaSeccion>
                  Entidades
                </EtiquetaSeccion>

                <span
                  className="text-micro font-black tabular-nums"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 35%, transparent)",
                  }}
                >
                  {entidades.length}
                </span>
              </div>

              {entidades.length === 0 ? (
                <EmptyState label="Sin entidades todavía" />
              ) : (
                <div
                  className="flex flex-col divide-y"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--primary) 8%, transparent)",
                  }}
                >
                  {entidades.map((e) => (
                    <div
                      className="py-3 first:pt-0 last:pb-0"
                      key={e.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Text
                          as="p"
                          className="text-primary font-black"
                          variant="sm"
                        >
                          {e.entidad_tipo}
                        </Text>

                        <Badge>
                          {e.entidad_origen_id
                            ? "catálogo"
                            : "manual"}
                        </Badge>
                      </div>

                      {e.entidad_origen_id && (
                        <p
                          className="mt-1 text-micro font-bold"
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 35%, transparent)",
                          }}
                        >
                          origen ·{" "}
                          <code className="font-mono">
                            {e.entidad_origen_id.slice(
                              0,
                              8,
                            )}
                          </code>
                        </p>
                      )}

                      <pre
                        className="mt-2 text-micro overflow-x-auto rounded-[var(--radius-btn)] p-2 leading-relaxed"
                        style={{
                          color:
                            "color-mix(in srgb, var(--primary) 60%, transparent)",
                          background:
                            "color-mix(in srgb, var(--primary) 5%, transparent)",
                        }}
                      >
                        {JSON.stringify(
                          e.estado_actual,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <EtiquetaSeccion>
                  Event log
                </EtiquetaSeccion>

                <span
                  className="text-micro font-black tabular-nums"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 35%, transparent)",
                  }}
                >
                  {eventos.length}
                </span>
              </div>

              {eventos.length === 0 ? (
                <EmptyState label="Sin eventos todavía" />
              ) : (
                <div
                  className="flex flex-col divide-y"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--primary) 8%, transparent)",
                  }}
                >
                  {eventos.map((ev) => (
                    <div
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      key={ev.id}
                    >
                      <span
                        className="text-micro font-bold truncate"
                        style={{
                          color:
                            "color-mix(in srgb, var(--primary) 70%, transparent)",
                        }}
                      >
                        t={ev.tiempo_programado} ·{" "}
                        {ev.evento_id.slice(0, 8)}
                      </span>

                      <Badge
                        variant={
                          ev.estado ===
                          "procesado"
                            ? "success"
                            : "default"
                        }
                      >
                        {ev.estado}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

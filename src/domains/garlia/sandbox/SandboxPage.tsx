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
 *
 * Rediseño de UI (sobre la versión con Card/Badge/color-mix):
 * Se alinea al lenguaje visual del resto del dominio (ver MaterialesPage,
 * AuditoriaSection): texto pequeño (text-micro/text-xs), opacidades
 * Tailwind sobre --primary (text-primary/NN) en vez de color-mix inline
 * por ítem, sin cajas de color de fondo por fila, sin badges/iconos
 * decorativos que no aportan información nueva. Las opacidades Tailwind
 * heredan el valor de --primary del tema activo (claro u oscuro), así que
 * no hay contraste roto en tema oscuro como pasaba con los `color-mix`
 * fijos calculados sobre un --primary que a veces es claro y a veces
 * oscuro según el tema.
 */

import {
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import React, { useMemo, useState } from "react";

import { useCompuestos } from "@/domains/garlia/elementos/useCompuestos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";

import type {
  Compuesto,
  Elemento,
} from "@/domains/garlia/elementos/types";

import { Btn } from "@/ui/Buttons";
import { Input, Select } from "@/ui/Inputs";

import {
  useCrearSandbox,
  useListaSandboxes,
  useSandbox,
} from "./useSandbox";

type TipoCatalogo = "elemento" | "compuesto";

function EtiquetaSeccion({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/30 mb-2">
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
    propiedades.estado_estructura = compuesto.estado_estructura;
  }

  if (compuesto.formula_canonica != null) {
    propiedades.formula_canonica = compuesto.formula_canonica;
  }

  if (compuesto.clasificacion != null) {
    propiedades.clasificacion = compuesto.clasificacion;
  }

  if (compuesto.tipo_estructura != null) {
    propiedades.tipo_estructura = compuesto.tipo_estructura;
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
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(3);
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
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-micro font-bold text-primary/45 truncate">
        {label}
      </span>
      <span className="text-micro font-black text-primary/70 tabular-nums shrink-0">
        {formatearValor(value)}
      </span>
    </div>
  );
}

/** Encabezado de bloque interno (Entidades / Event log): label + conteo,
 *  mismo patrón discreto que el resto del dominio (ver MaterialPerfilReactivo,
 *  bloque "Componentes" en MaterialesPage) — sin Card ni Badge alrededor. */
function BloqueHeader({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/30">
        {label}
      </span>
      <span className="text-micro font-bold text-primary/35 tabular-nums">
        {count}
      </span>
    </div>
  );
}

export function SandboxPage() {
  const [simulacionId, setSimulacionId] = useState<string | null>(null);

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

  const { items: elementos, loading: cargandoElementos } = useElementos();

  const { items: compuestos, loading: cargandoCompuestos } = useCompuestos();

  const [tipoCatalogo, setTipoCatalogo] = useState<TipoCatalogo>("elemento");

  const [catalogoSeleccionado, setCatalogoSeleccionado] = useState("");

  const [agregandoEntidad, setAgregandoEntidad] = useState(false);

  const [entidadSeleccionada, setEntidadSeleccionada] = useState("");

  const [eventoSeleccionado, setEventoSeleccionado] = useState("");

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
          (elemento) => elemento.id === catalogoSeleccionado,
        ) ?? null
      );
    }

    return (
      compuestos.find(
        (compuesto) => compuesto.id === catalogoSeleccionado,
      ) ?? null
    );
  }, [tipoCatalogo, catalogoSeleccionado, elementos, compuestos]);

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
  }, [tipoCatalogo, entidadCatalogoSeleccionada]);

  async function handleAgregarDesdeCatalogo() {
    if (!entidadCatalogoSeleccionada || !estadoInicialSeleccionado) {
      return;
    }

    setAgregandoEntidad(true);

    try {
      const id = await agregarEntidadDesdeCatalogo({
        entidadTipo: tipoCatalogo,
        entidadOrigenId: entidadCatalogoSeleccionada.id,
        estadoInicial: estadoInicialSeleccionado,
      });

      if (id) {
        setCatalogoSeleccionado("");
      }
    } finally {
      setAgregandoEntidad(false);
    }
  }

  function cambiarTipoCatalogo(tipo: TipoCatalogo) {
    setTipoCatalogo(tipo);
    setCatalogoSeleccionado("");
  }

  return (
    <div className="max-w-6xl mx-auto px-3 pb-4 pt-2">
      <div className="mb-5">
        <h1 className="text-sm font-black text-primary">Sandbox</h1>
        <p className="mt-0.5 text-micro text-primary/40">
          Entorno experimental aislado — el motor de reglas vive en Supabase
        </p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-md border border-primary/15 text-micro font-bold text-primary/70">
          {error}
        </div>
      )}

      <div className="mb-5 pb-5 border-b border-primary/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <EtiquetaSeccion>Cargar existente</EtiquetaSeccion>

            <Select
              onChange={(e) => setSimulacionId(e.target.value || null)}
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
            <EtiquetaSeccion>Crear nueva</EtiquetaSeccion>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCrear()}
                  placeholder="Nombre del sandbox"
                  value={nombreNuevo}
                />
              </div>

              <Btn
                icon={<Plus size={14} />}
                loading={creando}
                onClick={handleCrear}
                size="sm"
              >
                Crear
              </Btn>
            </div>
          </div>
        </div>

        {simulacionId && (
          <p className="mt-2 text-micro text-primary/35">
            simulacion_id activo ·{" "}
            <code className="font-mono">{simulacionId}</code>
          </p>
        )}
      </div>

      {!simulacionId && (
        <p className="py-5 text-center text-micro text-primary/35">
          Crea o carga un sandbox para empezar
        </p>
      )}

      {simulacionId && loading && (
        <p className="py-5 text-center text-micro text-primary/35">
          Cargando sandbox...
        </p>
      )}

      {simulacionId && simulacion && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 items-start">
          <div className="flex flex-col gap-5">
            <div className="pb-5 border-b border-primary/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <EtiquetaSeccion>tiempo_simulado</EtiquetaSeccion>
                  <span className="text-lg font-black text-primary tabular-nums">
                    {simulacion.tiempo_simulado}
                  </span>
                </div>

                <span className="text-micro font-bold text-primary/45 uppercase tracking-wide">
                  {simulacion.estado}
                </span>
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
            </div>

            {/* CATÁLOGO → SANDBOX */}
            <div className="pb-5 border-b border-primary/10">
              <EtiquetaSeccion>Agregar desde catálogo</EtiquetaSeccion>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <Btn
                  size="sm"
                  variant={
                    tipoCatalogo === "elemento" ? "primary" : "outline"
                  }
                  onClick={() => cambiarTipoCatalogo("elemento")}
                >
                  Elemento
                </Btn>

                <Btn
                  size="sm"
                  variant={
                    tipoCatalogo === "compuesto" ? "primary" : "outline"
                  }
                  onClick={() => cambiarTipoCatalogo("compuesto")}
                >
                  Compuesto
                </Btn>
              </div>

              <Select
                label={tipoCatalogo === "elemento" ? "Elemento" : "Compuesto"}
                onChange={(e) => setCatalogoSeleccionado(e.target.value)}
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
                    : compuestos.map((compuesto) => ({
                        value: compuesto.id,
                        label: `${compuesto.simbolo ? `${compuesto.simbolo} — ` : ""}${compuesto.nombre}`,
                      }))),
                ]}
                value={catalogoSeleccionado}
              />

              {entidadCatalogoSeleccionada && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-primary truncate">
                      {entidadCatalogoSeleccionada.nombre}
                    </span>

                    <span className="text-micro font-bold text-primary/40 shrink-0">
                      {tipoCatalogo} ·{" "}
                      {entidadCatalogoSeleccionada.id.slice(0, 8)}
                    </span>
                  </div>

                  {tipoCatalogo === "elemento" &&
                    (() => {
                      const el = entidadCatalogoSeleccionada as Elemento;

                      return (
                        <div>
                          <PropiedadPreview label="Masa" value={el.masa_base} />
                          <PropiedadPreview
                            label="Estabilidad"
                            value={el.estabilidad}
                          />
                          <PropiedadPreview
                            label="Rigidez"
                            value={el.rigidez}
                          />
                          <PropiedadPreview
                            label="Flexibilidad"
                            value={el.flexibilidad}
                          />
                          <PropiedadPreview
                            label="Capacidad de enlace"
                            value={el.capacidad_enlace}
                          />
                          <PropiedadPreview
                            label="Régimen"
                            value={el.regimen_estructural}
                          />
                        </div>
                      );
                    })()}

                  {tipoCatalogo === "compuesto" &&
                    (() => {
                      const compuesto =
                        entidadCatalogoSeleccionada as Compuesto;

                      return (
                        <div>
                          <PropiedadPreview label="Masa" value={compuesto.masa} />
                          <PropiedadPreview label="Carga" value={compuesto.carga} />
                          <PropiedadPreview
                            label="Estabilidad"
                            value={compuesto.estabilidad}
                          />
                          <PropiedadPreview
                            label="Rigidez"
                            value={compuesto.rigidez}
                          />
                          <PropiedadPreview
                            label="Flexibilidad"
                            value={compuesto.flexibilidad}
                          />
                          <PropiedadPreview
                            label="Compatibilidad"
                            value={compuesto.compatibilidad}
                          />
                          <PropiedadPreview
                            label="Energía de enlace"
                            value={compuesto.energia_enlace}
                          />
                        </div>
                      );
                    })()}

                  <Btn
                    className="mt-3 w-full"
                    disabled={!entidadCatalogoSeleccionada}
                    icon={<Plus size={14} />}
                    loading={agregandoEntidad}
                    onClick={handleAgregarDesdeCatalogo}
                    size="sm"
                    variant="primary"
                  >
                    Copiar al Sandbox
                  </Btn>
                </div>
              )}
            </div>

            {/* DISPARAR EVENTO */}
            <div>
              <EtiquetaSeccion>Disparar evento</EtiquetaSeccion>

              <div className="grid grid-cols-1 gap-2">
                <Select
                  label="Entidad"
                  onChange={(e) => setEntidadSeleccionada(e.target.value)}
                  options={[
                    { value: "", label: "—" },
                    ...entidades.map((e) => ({
                      value: e.id,
                      label: e.entidad_tipo,
                    })),
                  ]}
                  value={entidadSeleccionada}
                />

                <Select
                  label="Evento"
                  onChange={(e) => setEventoSeleccionado(e.target.value)}
                  options={[
                    { value: "", label: "—" },
                    ...catalogoEventos.map((ev) => ({
                      value: ev.id,
                      label: String(ev.nombre ?? ev.id),
                    })),
                  ]}
                  value={eventoSeleccionado}
                />
              </div>

              <Btn
                className="mt-3 w-full"
                disabled={!entidadSeleccionada || !eventoSeleccionado}
                onClick={() =>
                  dispararEvento({
                    eventoId: eventoSeleccionado,
                    entidadId: entidadSeleccionada,
                  })
                }
                size="sm"
              >
                Encolar evento
              </Btn>
            </div>
          </div>

          {/* ESTADO EN VIVO */}
          <div className="flex flex-col gap-5">
            <div className="pb-5 border-b border-primary/10 lg:border-b-0">
              <BloqueHeader label="Entidades" count={entidades.length} />

              {entidades.length === 0 ? (
                <p className="py-2 text-micro text-primary/30">
                  Sin entidades todavía
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-primary/8">
                  {entidades.map((e) => (
                    <div className="py-2.5 first:pt-0 last:pb-0" key={e.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-primary">
                          {e.entidad_tipo}
                        </span>

                        <span className="text-micro font-bold text-primary/35 shrink-0">
                          {e.entidad_origen_id ? "catálogo" : "manual"}
                        </span>
                      </div>

                      {e.entidad_origen_id && (
                        <p className="mt-0.5 text-micro text-primary/30">
                          origen ·{" "}
                          <code className="font-mono">
                            {e.entidad_origen_id.slice(0, 8)}
                          </code>
                        </p>
                      )}

                      <pre className="mt-1.5 text-micro text-primary/50 overflow-x-auto leading-relaxed">
                        {JSON.stringify(e.estado_actual, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <BloqueHeader label="Event log" count={eventos.length} />

              {eventos.length === 0 ? (
                <p className="py-2 text-micro text-primary/30">
                  Sin eventos todavía
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-primary/8">
                  {eventos.map((ev) => (
                    <div
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                      key={ev.id}
                    >
                      <span className="text-micro font-bold text-primary/60 truncate">
                        t={ev.tiempo_programado} · {ev.evento_id.slice(0, 8)}
                      </span>

                      <span
                        className={`text-micro font-bold shrink-0 ${
                          ev.estado === "procesado"
                            ? "text-primary/70"
                            : "text-primary/35"
                        }`}
                      >
                        {ev.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

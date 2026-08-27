"use client";

/**
 * SandboxPage.tsx — dominio Sandbox
 * ───────────────────────────────────────────────────────────────────────────
 * Vertical slice del Sandbox. Rediseñada para usar EXCLUSIVAMENTE el sistema
 * de theming real del proyecto (var(--primary) + color-mix), igual que
 * AlertasPanel/FisicaPage/RunasPage — nunca clases Tailwind de color literal
 * (red-500, green-50, etc.), que es justamente lo que rompía el contraste
 * en tema oscuro: esas clases no reaccionan a --primary ni a color-mix.
 *
 * Layout: 2 columnas en desktop (izquierda = control + disparar evento,
 * derecha = estado en vivo: entidades + event log), colapsando a 1 columna
 * en mobile — mismo criterio de aprovechamiento de espacio que FisicaPage.
 *
 * No duplica ninguna regla del motor: solo muestra estado_actual tal cual
 * viene de Supabase y dispara RPCs vía useSandbox().
 */

import { Pause, Play, Plus, RotateCcw, SkipForward, Zap } from "lucide-react";
import React, { useState } from "react";

import { Btn } from "@/ui/Buttons";
import { Badge, EmptyState, Loading } from "@/ui/Feedback";
import { Card, PageHeader } from "@/ui/Layout";
import { Input, Select } from "@/ui/Inputs";
import { Text } from "@/ui/Tipografia";

import { useCrearSandbox, useListaSandboxes, useSandbox } from "./useSandbox";

/** Etiqueta de sub-sección dentro de una Card — mismo tratamiento tipográfico
 *  que el resto del dominio (micro, black, uppercase, tracking amplio,
 *  color derivado de --primary con opacidad, nunca un gris fijo). */
function EtiquetaSeccion({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-micro font-black uppercase tracking-[0.2em] mb-3"
      style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
    >
      {children}
    </p>
  );
}

export function SandboxPage() {
  const [simulacionId, setSimulacionId] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const { crear, creando } = useCrearSandbox();
  const { simulaciones, loading: cargandoLista, refetch: refetchLista } = useListaSandboxes();

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
    agregarEntidad,
  } = useSandbox(simulacionId);

  const [tipoEntidadNueva, setTipoEntidadNueva] = useState("");
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

  async function handleAgregarEntidad() {
    if (!tipoEntidadNueva.trim()) return;
    setAgregandoEntidad(true);
    try {
      await agregarEntidad({ entidadTipo: tipoEntidadNueva.trim() });
      setTipoEntidadNueva("");
    } finally {
      setAgregandoEntidad(false);
    }
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
            background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            border: "var(--border-width) solid color-mix(in srgb, var(--primary) 25%, transparent)",
            color: "var(--primary)",
          }}
        >
          {error}
        </div>
      )}

      {/* Crear / cargar simulación — siempre visible arriba, ocupa el ancho completo */}
      <Card className="mb-6" padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <EtiquetaSeccion>Cargar existente</EtiquetaSeccion>
            <Select
              onChange={(e) => setSimulacionId(e.target.value || null)}
              options={[
                { value: "", label: cargandoLista ? "Cargando..." : "— Elegir sandbox —" },
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
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCrear()}
                  placeholder="Nombre del sandbox"
                  value={nombreNuevo}
                />
              </div>
              <Btn icon={<Plus size={14} />} loading={creando} onClick={handleCrear}>
                Crear
              </Btn>
            </div>
          </div>
        </div>
        {simulacionId && (
          <p
            className="mt-3 text-micro font-bold"
            style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
          >
            simulacion_id activo · <code className="font-mono">{simulacionId}</code>
          </p>
        )}
      </Card>

      {!simulacionId && (
        <EmptyState icon={<Zap size={28} />} label="Crea o carga un sandbox para empezar" />
      )}

      {simulacionId && loading && <Loading fullScreen={false} text="Cargando sandbox..." />}

      {simulacionId && simulacion && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 items-start">
          {/* ─── Columna izquierda: reloj, controles, disparar evento ─── */}
          <div className="flex flex-col gap-6">
            <Card padding="md">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <EtiquetaSeccion>tiempo_simulado</EtiquetaSeccion>
                  <Text as="p" className="text-primary font-black" variant="xl">
                    {simulacion.tiempo_simulado}
                  </Text>
                </div>
                <Badge active>{simulacion.estado}</Badge>
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

            <Card padding="md">
              <EtiquetaSeccion>Disparar evento</EtiquetaSeccion>
              <div className="grid grid-cols-1 gap-3">
                <Select
                  label="Entidad"
                  onChange={(e) => setEntidadSeleccionada(e.target.value)}
                  options={[
                    { value: "", label: "—" },
                    ...entidades.map((e) => ({ value: e.id, label: e.entidad_tipo })),
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
                className="mt-4 w-full"
                disabled={!entidadSeleccionada || !eventoSeleccionado}
                icon={<Zap size={14} />}
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
            </Card>
          </div>

          {/* ─── Columna derecha: estado en vivo ─── */}
          <div className="flex flex-col gap-6">
            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <EtiquetaSeccion>Entidades</EtiquetaSeccion>
                <span
                  className="text-micro font-black tabular-nums"
                  style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
                >
                  {entidades.length}
                </span>
              </div>

              <div className="flex items-end gap-2 mb-4">
                <div className="flex-1">
                  <Input
                    onChange={(e) => setTipoEntidadNueva(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAgregarEntidad()}
                    placeholder="Tipo de entidad (ej. material, criatura)"
                    value={tipoEntidadNueva}
                  />
                </div>
                <Btn
                  icon={<Plus size={14} />}
                  loading={agregandoEntidad}
                  onClick={handleAgregarEntidad}
                  size="sm"
                  variant="outline"
                >
                  Agregar
                </Btn>
              </div>

              {entidades.length === 0 ? (
                <EmptyState label="Sin entidades todavía" />
              ) : (
                <div
                  className="flex flex-col divide-y"
                  style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}
                >
                  {entidades.map((e) => (
                    <div className="py-3 first:pt-0 last:pb-0" key={e.id}>
                      <Text as="p" className="text-primary font-black" variant="sm">
                        {e.entidad_tipo}
                      </Text>
                      <pre
                        className="mt-1.5 text-micro overflow-x-auto rounded-[var(--radius-btn)] p-2 leading-relaxed"
                        style={{
                          color: "color-mix(in srgb, var(--primary) 60%, transparent)",
                          background: "color-mix(in srgb, var(--primary) 5%, transparent)",
                        }}
                      >
                        {JSON.stringify(e.estado_actual, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <EtiquetaSeccion>Event log</EtiquetaSeccion>
                <span
                  className="text-micro font-black tabular-nums"
                  style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
                >
                  {eventos.length}
                </span>
              </div>
              {eventos.length === 0 ? (
                <EmptyState label="Sin eventos todavía" />
              ) : (
                <div
                  className="flex flex-col divide-y"
                  style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}
                >
                  {eventos.map((ev) => (
                    <div
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      key={ev.id}
                    >
                      <span
                        className="text-micro font-bold truncate"
                        style={{ color: "color-mix(in srgb, var(--primary) 70%, transparent)" }}
                      >
                        t={ev.tiempo_programado} · {ev.evento_id.slice(0, 8)}
                      </span>
                      <Badge variant={ev.estado === "procesado" ? "success" : "default"}>
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

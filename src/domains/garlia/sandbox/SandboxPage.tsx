"use client";

/**
 * SandboxPage.tsx — dominio Sandbox
 * ───────────────────────────────────────────────────────────────────────────
 * Página mínima del vertical slice: crear/cargar sandbox → ver entidades
 * → disparar evento → Play/Pause/Step/Reset → ver eventos (event log
 * embrionario) → ver tiempo_simulado (reloj).
 *
 * A propósito NO tiene Timeline visual ni Inspector de entidad todavía —
 * eso es Fase 2 tardía. Esta página existe para validar el recorrido
 * completo Frontend → Supabase → motor → cambio real → Frontend antes de
 * invertir en UX/UI.
 *
 * No duplica ninguna regla del motor: solo muestra estado_actual tal cual
 * viene de Supabase y dispara RPCs vía useSandbox().
 */

import { Pause, Play, Plus, RotateCcw, SkipForward, Zap } from "lucide-react";
import React, { useState } from "react";

import { Btn } from "@/ui/Buttons";
import { Loading, EmptyState, Badge } from "@/ui/Feedback";
import { Card, PageHeader } from "@/ui/Layout";
import { Input, Select } from "@/ui/Inputs";

import { useCrearSandbox, useSandbox } from "./useSandbox";

export function SandboxPage() {
  const [simulacionId, setSimulacionId] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const { crear, creando } = useCrearSandbox();

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
  } = useSandbox(simulacionId);

  const [entidadSeleccionada, setEntidadSeleccionada] = useState("");
  const [eventoSeleccionado, setEventoSeleccionado] = useState("");

  async function handleCrear() {
    if (!nombreNuevo.trim()) return;
    const id = await crear(nombreNuevo.trim());
    if (id) {
      setSimulacionId(id);
      setNombreNuevo("");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <PageHeader
        icon={<Zap size={20} />}
        subtitle="Vertical slice — Fase 2"
        title="Sandbox"
      />

      {error && (
        <Card className="mb-4 border border-red-200 bg-red-50" padding="sm">
          <span className="text-micro font-bold text-red-500">{error}</span>
        </Card>
      )}

      {/* Crear / cargar simulación */}
      <Card className="mb-6" padding="md">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Nueva simulación"
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Nombre del sandbox"
              value={nombreNuevo}
            />
          </div>
          <Btn icon={<Plus size={14} />} loading={creando} onClick={handleCrear}>
            Crear
          </Btn>
        </div>
        {simulacionId && (
          <p className="mt-3 text-micro font-bold text-primary/40">
            simulacion_id activo: <code>{simulacionId}</code>
          </p>
        )}
      </Card>

      {!simulacionId && (
        <EmptyState icon={<Zap size={28} />} label="Crea o carga un sandbox para empezar" />
      )}

      {simulacionId && loading && <Loading fullScreen={false} text="Cargando sandbox..." />}

      {simulacionId && simulacion && (
        <>
          {/* Reloj + controles */}
          <Card className="mb-6" padding="md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-micro font-black uppercase tracking-widest text-primary/40">
                  tiempo_simulado
                </span>
                <p className="text-xl font-black text-primary">{simulacion.tiempo_simulado}</p>
              </div>
              <Badge>{simulacion.estado}</Badge>
            </div>
            <div className="flex gap-2">
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

          {/* Entidades */}
          <Card className="mb-6" padding="md">
            <span className="text-micro font-black uppercase tracking-widest text-primary/40">
              Entidades ({entidades.length})
            </span>
            {entidades.length === 0 ? (
              <EmptyState label="Sin entidades todavía" />
            ) : (
              <div className="mt-3 space-y-2">
                {entidades.map((e) => (
                  <div className="border-b border-primary/5 pb-2" key={e.id}>
                    <p className="text-sm font-black text-primary">{e.entidad_tipo}</p>
                    <pre className="text-micro text-primary/50 overflow-x-auto">
                      {JSON.stringify(e.estado_actual, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Disparar evento */}
          <Card className="mb-6" padding="md">
            <span className="text-micro font-black uppercase tracking-widest text-primary/40">
              Disparar evento
            </span>
            <div className="mt-3 grid grid-cols-2 gap-3">
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
              className="mt-4"
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

          {/* Event log embrionario */}
          <Card padding="md">
            <span className="text-micro font-black uppercase tracking-widest text-primary/40">
              Eventos ({eventos.length})
            </span>
            {eventos.length === 0 ? (
              <EmptyState label="Sin eventos todavía" />
            ) : (
              <div className="mt-3 space-y-1">
                {eventos.map((ev) => (
                  <div
                    className="flex items-center justify-between text-micro font-bold"
                    key={ev.id}
                  >
                    <span className="text-primary/70">
                      t={ev.tiempo_programado} · {ev.evento_id.slice(0, 8)}
                    </span>
                    <Badge>{ev.estado}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

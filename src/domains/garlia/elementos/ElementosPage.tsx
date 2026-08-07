"use client";

/**
 * ElementosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Vista de la sección "Tabla" (Tabla Química/Alquímica): grid de los 29
 * elementos + detalle inline al seleccionar uno (capas núcleo/media/externa
 * editables). Mismo patrón que RunasPage: sin navegar a otra ruta, toggle
 * de selección adentro de la misma página.
 *
 * Pensado para crecer con tabs hermanas (Iums, Simulador de reacciones) —
 * ver PanelSubTabsElementos más abajo, hoy con un solo tab activo.
 */

import { Atom, Download, Info, Loader2, Plus, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import { ElementoEditor } from "./ElementoEditor";
import { formatLayer, type Elemento } from "./types";

// ─── Descarga: todos los elementos de la Tabla Química en un solo JSON ─────
function descargarDatosElementos(elementos: Elemento[]) {
  const payload = {
    exportado_en: new Date().toISOString(),
    elementos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tabla-elementos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface Props {
  elementos: Elemento[];
  loading?: boolean;
  creating?: boolean;
  onCreate?: () => void;
  onActualizar: (id: string, cambios: Partial<Elemento>) => void;
  onEliminar?: (id: string) => void;
  /** Id a dejar seleccionado tras crear (mismo patrón que runaRecienCreadaId). */
  seleccionarId?: string | null;
}

/**
 * Casilla tipo tabla periódica: símbolo (abreviatura) grande y centrado en
 * vez de imagen/ícono genérico, con número atómico arriba y las 3 capas
 * resumidas abajo — toda la info clave visible sin entrar al detalle.
 * Reemplaza a EntityCard/EntityCardGrid acá porque esas dos asumen
 * imagen-o-ícono + una sola línea de subtítulo, insuficiente para lo que
 * se quiere mostrar por elemento.
 */
function ElementoCasilla({
  elemento,
  seleccionado,
  onClick,
}: {
  elemento: Elemento;
  seleccionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-stretch gap-0.5 p-1.5 rounded-md border transition-colors text-left ${
        seleccionado
          ? "border-primary/50 bg-primary/10 ring-2 ring-primary/40"
          : "border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-micro font-black text-primary/30 tabular-nums">
          #{elemento.numero_atomico}
        </span>
        {elemento.es_noble && (
          <span
            title="Noble"
            className="w-1.5 h-1.5 rounded-full bg-accent/70 shrink-0 mt-0.5"
          />
        )}
      </div>

      <span className="text-base font-black text-primary text-center leading-none py-0.5">
        {elemento.simbolo || "??"}
      </span>

      <span className="text-micro font-bold text-primary/80 truncate text-center leading-tight">
        {elemento.nombre}
      </span>

      <div className="mt-0.5 pt-0.5 border-t border-primary/10 flex flex-col gap-0.5">
        <span className="text-micro text-primary/40 truncate leading-tight">
          <span className="text-primary/25">N</span> {formatLayer(elemento.nucleo)}
        </span>
        <span className="text-micro text-primary/40 truncate leading-tight">
          <span className="text-primary/25">M</span> {formatLayer(elemento.media)}
        </span>
        <span className="text-micro text-primary/40 truncate leading-tight">
          <span className="text-primary/25">E</span> {formatLayer(elemento.externa)}
        </span>
      </div>
    </button>
  );
}

// ─── Info: reglas de la Tabla Química, resumidas ───────────────────────────
// Solo lo propio de acá (estructura de capas, estabilidad/familias,
// manifestaciones) — la jerarquía Partícula Base→Partículas→Iums y la
// resonancia con Iums ya se explican en la sección Física, no se repiten.
function InfoTablaQuimica() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Cómo funciona la Tabla Química"
        className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full border border-primary/25 text-primary/40 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
      >
        <Info size={10} />
      </button>

      {abierto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8 md:p-12">
          <div
            className="absolute inset-0 bg-primary/10 backdrop-blur-sm"
            onClick={() => setAbierto(false)}
          />
          <div
            className="relative z-10 flex flex-col w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] rounded-[var(--radius-card)] border shadow-2xl overflow-hidden"
            style={{
              background: "var(--white-custom, var(--bg-main))",
              borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <div
              style={{ background: "var(--bg-main)" }}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-primary/10"
            >
              <Info size={12} className="text-primary/40" />
              <p className="flex-1 min-w-0 text-micro font-black uppercase tracking-widest text-primary/70">
                Cómo funciona la Tabla Química
              </p>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>

            <div className="flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto text-micro text-primary/70 leading-relaxed">
              <div className="flex flex-col gap-1">
                <p className="font-black uppercase tracking-[0.2em] text-primary/40">
                  Número atómico
                </p>
                <p>
                  Es el total de partículas del elemento. Se reparten en 3 capas de
                  capacidad creciente (2 / 4 / 6). En los elementos #1 y #2, Percepción y
                  Voluntad ocupan temporalmente el núcleo — desde el #3 el núcleo se
                  estabiliza con Masa/Cinética/Equilibrio.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-black uppercase tracking-[0.2em] text-primary/40">
                  Las 3 capas
                </p>
                <div className="rounded-lg border border-primary/10 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/[0.03] border-b border-primary/10">
                    <span className="w-14 shrink-0 font-bold text-primary/60">Núcleo</span>
                    <span className="text-primary/50">
                      Identidad y ancla gravitacional — Masa, Cinética, Equilibrio.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/[0.03] border-b border-primary/10">
                    <span className="w-14 shrink-0 font-bold text-primary/60">Media</span>
                    <span className="text-primary/50">
                      Motor energético — Potencial, Información, Ciclo, Entropía.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/[0.03]">
                    <span className="w-14 shrink-0 font-bold text-primary/60">Externa</span>
                    <span className="text-primary/50">
                      Reactividad y resonancia — Voluntad, Percepción, Transición, Catálisis.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-black uppercase tracking-[0.2em] text-primary/40">
                  Estabilidad y familias
                </p>
                <p>
                  Capa externa completa → elemento <span className="font-bold text-primary/70">Noble</span> (inerte,
                  raro, resistente a interferencia mágica). Incompleta → elemento{" "}
                  <span className="font-bold text-primary/70">Inestable</span>, forma compuestos.
                  Los <span className="font-bold text-primary/70">Sensibles</span> (Percepción/Transición) cambian
                  fácil ante estímulos; los <span className="font-bold text-primary/70">Reactivos</span>{" "}
                  (Voluntad/Catálisis) se combinan activamente.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-black uppercase tracking-[0.2em] text-primary/40">
                  Manifestaciones naturales
                </p>
                <p>
                  <span className="font-bold text-primary/70">Cristalio</span> (sólido): núcleo pesado, externa
                  inerte. <span className="font-bold text-primary/70">Fluxio</span> (fluido): núcleo balanceado,
                  externa dinámica. <span className="font-bold text-primary/70">Nebulio</span> (gaseoso): núcleo
                  ligero, externa con Entropía/Transición.{" "}
                  <span className="font-bold text-primary/70">Plasmio</span> (energético): externa saturada de
                  Catálisis/Transición, reacciona violento a estímulos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ElementosPage({
  elementos,
  loading,
  creating,
  onCreate,
  onActualizar,
  onEliminar,
  seleccionarId,
}: Props) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const activoId = seleccionadoId ?? seleccionarId ?? null;
  const activo = useMemo(
    () => elementos.find((e) => e.id === activoId) ?? null,
    [elementos, activoId],
  );

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden relative">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary/40">
            <Atom size={12} />
            <p className="text-micro font-black uppercase tracking-widest">
              Tabla Química · {elementos.length} elementos
            </p>
            <InfoTablaQuimica />
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => descargarDatosElementos(elementos)}
              title="Descargar todos los datos de la Tabla Química como JSON"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Download size={10} />
              <span className="hidden sm:inline">Descargar datos</span>
            </button>
            {onCreate && (
              <button
                type="button"
                disabled={creating}
                onClick={onCreate}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="animate-spin" size={10} /> : <Plus size={10} />}
                Nuevo elemento
              </button>
            )}
          </div>
        </div>

        {loading && elementos.length === 0 ? (
          <div className="py-6 text-micro text-primary/30 text-center">Cargando…</div>
        ) : elementos.length === 0 ? (
          <div className="py-6 text-micro text-primary/25 text-center">
            Todavía no hay elementos cargados.
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
          >
            {elementos.map((el) => (
              <ElementoCasilla
                key={el.id}
                elemento={el}
                seleccionado={el.id === activoId}
                onClick={() =>
                  setSeleccionadoId((actual) => (actual === el.id ? null : el.id))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel lateral: overlay + drawer a la derecha con el detalle del
          elemento seleccionado. No reemplaza el grid — queda visible
          detrás, para poder seguir eligiendo otros elementos. */}
      {activo && (
        <>
          <div
            className="absolute inset-0 z-30 md:hidden"
            style={{ background: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
            onClick={() => setSeleccionadoId(null)}
          />
          <div
            className="absolute md:sticky md:top-0 inset-y-0 right-0 z-40 flex flex-col w-full sm:w-[380px] md:w-[420px] shrink-0 border-l shadow-2xl md:shadow-none md:h-full md:self-start"
            style={{
              background: "var(--white-custom, var(--bg-main))",
              borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <ElementoEditor
              elemento={activo}
              onBack={() => setSeleccionadoId(null)}
              onActualizar={onActualizar}
              onEliminar={
                onEliminar
                  ? (id) => {
                      onEliminar(id);
                      setSeleccionadoId(null);
                    }
                  : undefined
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

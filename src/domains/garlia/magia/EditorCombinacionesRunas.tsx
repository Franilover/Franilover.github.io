"use client";

/**
 * EditorCombinacionesRunas.tsx
 * ────────────────────────────
 * Panel de admin (montado dentro de FormularioMagico cuando modo==="runas")
 * para crear/editar "combinaciones" — hechizos compuestos que se activan
 * cuando el jugador dibuja runas específicas en celdas específicas del
 * tablero de /garlia/runas (ver formasLimite.ts: Rejilla/Celda).
 *
 * Cada combinación define, por celda (identificada por su id estable
 * "s{seccion}-a{anillo}", independiente de la forma exterior elegida por
 * el jugador), qué runa debe estar dibujada ahí. El match en la página
 * pública es exacto (ver matchCombinacion.ts).
 *
 * La rejilla usada acá para armar el selector de celdas es configurable
 * con el mismo SelectorRejilla que usa la página pública, así el admin
 * puede definir combinaciones para cualquier tamaño de tablero que
 * planee ofrecer a los jugadores.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/EditorCombinacionesRunas.tsx
 */

import { ChevronDown, Layers, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { FORMA_CIRCULO, generarCeldas, labelCelda, REJILLA_SIMPLE, type Rejilla } from "./formasLimite";
import { PickerImagenRunaBtn } from "./PickerImagenRunaBtn";
import { SelectorRejilla } from "./public/SelectorRejilla";
import { TableroCeldas } from "./public/TableroCeldas";
import type { CombinacionRuna, EntidadMagica } from "./types";

export function EditorCombinacionesRunas({ runas }: { runas: EntidadMagica[] }) {
  const [abierto, setAbierto] = useState(false);
  const [combinaciones, setCombinaciones] = useState<CombinacionRuna[]>([]);
  const [loading, setLoading] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || cargado) return;
    let activo = true;
    const cargarCombinaciones = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("combinaciones_runas")
        .select("id, nombre, explicacion, imagen_url, celdas")
        .order("nombre");
      if (!activo) return;
      if (!error && data) setCombinaciones(data as unknown as CombinacionRuna[]);
      setLoading(false);
      setCargado(true);
    };
    void cargarCombinaciones();
    return () => {
      activo = false;
    };
  }, [abierto, cargado]);

  const crear = async () => {
    const { data, error } = await supabase
      .from("combinaciones_runas")
      .insert([{ nombre: "Nueva combinación", celdas: {} }])
      .select("id, nombre, explicacion, imagen_url, celdas")
      .single();
    if (error || !data) return;
    const nueva = data as unknown as CombinacionRuna;
    setCombinaciones((prev) => [nueva, ...prev]);
    setEditandoId(nueva.id);
  };

  const editando = combinaciones.find((c) => c.id === editandoId) ?? null;

  return (
    <div className="rounded-xl border border-primary/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-primary/5 hover:bg-primary/8 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.25em] text-primary/50">
          <Layers size={12} /> Combinaciones (hechizos compuestos)
        </span>
        <ChevronDown
          size={14}
          className={`text-primary/30 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="p-3 border-t border-primary/10 space-y-3">
          <p className="text-micro text-primary/30 leading-relaxed">
            Definí qué combinación exacta de runas por celda del tablero
            produce un resultado especial. Independiente de esta runa en
            particular — cualquier runa puede formar parte de una combinación.
          </p>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-primary/20" size={18} />
            </div>
          )}

          {!loading && editando && (
            <EditorUnaCombinacion
              combinacion={editando}
              runas={runas}
              onCerrar={() => setEditandoId(null)}
              onEliminada={(id) => {
                setCombinaciones((prev) => prev.filter((c) => c.id !== id));
                setEditandoId(null);
              }}
              onGuardada={(actualizada) => {
                setCombinaciones((prev) =>
                  prev.map((c) => (c.id === actualizada.id ? actualizada : c)),
                );
              }}
            />
          )}

          {!loading && !editando && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => void crear()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-semibold text-primary"
              >
                <Plus size={13} /> Nueva combinación
              </button>

              {combinaciones.length === 0 ? (
                <p className="text-micro text-primary/25 text-center py-3">
                  Sin combinaciones definidas todavía
                </p>
              ) : (
                combinaciones.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEditandoId(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left text-primary/70 hover:bg-primary/5 transition-colors border border-primary/8"
                  >
                    <Sparkles size={12} className="shrink-0 opacity-40" />
                    <span className="truncate flex-1">{c.nombre}</span>
                    <span className="text-micro text-primary/25 shrink-0">
                      {Object.keys(c.celdas ?? {}).length} celda
                      {Object.keys(c.celdas ?? {}).length === 1 ? "" : "s"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditorUnaCombinacion({
  combinacion,
  runas,
  onGuardada,
  onEliminada,
  onCerrar,
}: {
  combinacion: CombinacionRuna;
  runas: EntidadMagica[];
  onGuardada: (c: CombinacionRuna) => void;
  onEliminada: (id: string) => void;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState<CombinacionRuna>(combinacion);
  const [rejilla, setRejilla] = useState<Rejilla>(REJILLA_SIMPLE);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setForm(combinacion);
  }, [combinacion.id]);

  // Al abrir, arrancamos con una rejilla que al menos cubra las celdas ya
  // guardadas (si las hay), para no perderlas de vista visualmente.
  useEffect(() => {
    const idsGuardados = Object.keys(combinacion.celdas ?? {});
    if (idsGuardados.length === 0) return;
    let mejorSecciones = 1;
    let mejorAnillos = 1;
    for (let secciones = 1; secciones <= 8; secciones++) {
      for (let anillos = 1; anillos <= 4; anillos++) {
        const ids = new Set(generarCeldas({ secciones, anillos }).map((c) => c.id));
        if (idsGuardados.every((id) => ids.has(id))) {
          mejorSecciones = secciones;
          mejorAnillos = anillos;
          break;
        }
      }
    }
    setRejilla({ secciones: mejorSecciones, anillos: mejorAnillos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinacion.id]);

  const celdas = generarCeldas(rejilla);

  const asignarRunaACelda = (celdaId: string, runaId: string | null) => {
    setForm((f) => {
      const nuevasCeldas = { ...f.celdas };
      if (runaId) nuevasCeldas[celdaId] = runaId;
      else delete nuevasCeldas[celdaId];
      return { ...f, celdas: nuevasCeldas };
    });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const { error } = await supabase
        .from("combinaciones_runas")
        .update({
          nombre: form.nombre,
          explicacion: form.explicacion || null,
          imagen_url: form.imagen_url || null,
          celdas: form.celdas,
        })
        .eq("id", form.id);
      if (!error) onGuardada(form);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    await supabase.from("combinaciones_runas").delete().eq("id", form.id);
    onEliminada(form.id);
  };

  const runaPorCelda: Record<string, EntidadMagica | null | undefined> = {};
  for (const [celdaId, runaId] of Object.entries(form.celdas)) {
    runaPorCelda[celdaId] = runas.find((r) => r.id === runaId) ?? null;
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-bold text-primary outline-none border-b border-primary/10 pb-1 placeholder:text-primary/25"
          placeholder="Nombre de la combinación…"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />
        <PickerImagenRunaBtn
          Icon={Sparkles}
          color="var(--primary)"
          value={form.imagen_url ?? ""}
          onChange={(url) => setForm((f) => ({ ...f, imagen_url: url }))}
        />
      </div>

      {form.imagen_url && (
        <div className="w-16 h-16 rounded-lg overflow-hidden border border-primary/10">
          <Image
            alt={form.nombre}
            className="w-full h-full object-cover"
            height={64}
            src={form.imagen_url}
            width={64}
          />
        </div>
      )}

      <textarea
        className="w-full bg-primary/3 rounded-lg p-2 text-xs text-primary/70 outline-none resize-none placeholder:text-primary/25"
        placeholder="Explicación del resultado compuesto…"
        rows={2}
        value={form.explicacion ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, explicacion: e.target.value }))}
      />

      <div className="space-y-2">
        <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
          Tamaño del tablero
        </label>
        <SelectorRejilla value={rejilla} onChange={setRejilla} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <TableroCeldas
          celdaActivaId={null}
          forma={FORMA_CIRCULO}
          rejilla={rejilla}
          runaPorCelda={runaPorCelda}
          onSeleccionarCelda={() => {}}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/35">
          Runa por celda
        </label>
        {celdas.map((celda) => (
          <div key={celda.id} className="flex items-center gap-2">
            <span className="text-micro text-primary/40 w-32 shrink-0 truncate">
              {labelCelda(celda, rejilla)}
            </span>
            <select
              className="flex-1 min-w-0 bg-primary/3 rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
              value={form.celdas[celda.id] ?? ""}
              onChange={(e) => asignarRunaACelda(celda.id, e.target.value || null)}
            >
              <option value="">— vacía —</option>
              {runas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onCerrar}
          className="text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors"
        >
          Volver
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void eliminar()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
          >
            <Trash2 size={10} />
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          >
            {guardando ? <Loader2 size={10} className="animate-spin" /> : null}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

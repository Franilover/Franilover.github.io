"use client";

/**
 * FormularioMagico.tsx
 * ─────────────────────
 * Formulario de edición de un hechizo/don/runa: header con nombre,
 * imagen, grupos de criaturas asignados, explicación markdown y
 * botones de guardar/eliminar.
 *
 * Recibe todo por props — no fetchea nada directamente.
 * El estado del formulario (form, status) es local porque
 * corresponde a la edición en curso, no a datos compartidos.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/magia/FormularioMagico.tsx
 */


import { Save, Trash2 } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { useConfirm } from "@/ui/ConfirmModal";
import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import { supabase } from "@/infra/supabase/supabase";
import { dexiePut, dexieDelete as dexieDel } from "@/lib/utils/dexieHelpers";

import { PanelGruposAsignados } from "./PanelGruposAsignados";
import { PickerImagenRunaBtn } from "./PickerImagenRunaBtn";
import { PanelPatronRuna } from "./PanelPatronRuna";
import { CONFIG, type EntidadMagica, type GrupoMin, type Modo } from "./types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function FormularioMagico({
  item,
  modo,
  grupos,
  loadingGrupos,
  onSaved,
  onDeleted,
  onNavigateGrupo,
  todasLasRunas,
}: {
  item: EntidadMagica;
  modo: Modo;
  grupos: GrupoMin[];
  loadingGrupos: boolean;
  onSaved: (i: EntidadMagica) => void;
  onDeleted: (id: string) => void;
  /** Si se pasa, el nombre de cada grupo asignado navega a su editor. */
  onNavigateGrupo?: (id: string) => void;
  /** Catálogo completo de runas. Ya no se usa acá directamente — el
   *  probador de reconocimiento y el editor de combinaciones se movieron
   *  a la página de Magia — se mantiene por compatibilidad con llamadores. */
  todasLasRunas?: EntidadMagica[];
}) {
  const [form, setForm] = useState<EntidadMagica>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const { confirm, ConfirmModal } = useConfirm();
  const { onWikilink } = useWikilink();
  const cfg = CONFIG[modo];

  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  const save = async () => {
    setStatus("saving");
    try {
      const updatePayload: any = {
        nombre: form.nombre,
        explicacion: form.explicacion || null,
      };
      if (modo === "runas") {
        updatePayload.patron_trazos = form.patron_trazos ?? null;
      } else {
        updatePayload.imagen_url = (form as any).imagen_url || null;
      }
      updatePayload.grupo_ids = form.grupo_ids ?? [];
      const { error } = await supabase
        .from(cfg.tabla)
        .update(updatePayload)
        .eq("id", form.id);
      if (error) throw error;

      // grupo_ids (acá) y miembro_ids (en grupos_mundo) son dos lados de la
      // misma relación N:N guardados por separado — si solo actualizamos
      // grupo_ids, el grupo se queda pensando que esta entidad sigue siendo
      // miembro (o que nunca lo fue). Reflejamos el diff en miembro_ids de
      // cada grupo afectado para que ambos lados queden consistentes.
      const originalIds = new Set(item.grupo_ids ?? []);
      const currentIds = new Set(form.grupo_ids ?? []);
      const agregados = [...currentIds].filter((id) => !originalIds.has(id));
      const quitados = [...originalIds].filter((id) => !currentIds.has(id));

      await Promise.all(
        [...agregados, ...quitados].map(async (grupoId) => {
          const grupo = grupos.find((g) => g.id === grupoId);
          if (!grupo) return;
          const nuevosMiembros = agregados.includes(grupoId)
            ? grupo.miembro_ids.includes(form.id)
              ? grupo.miembro_ids
              : [...grupo.miembro_ids, form.id]
            : grupo.miembro_ids.filter((id) => id !== form.id);
          await supabase
            .from("grupos_mundo")
            .update({ miembro_ids: nuevosMiembros })
            .eq("id", grupoId);
        }),
      );

      setStatus("saved");
      onSaved(form);
      void dexiePut(cfg.tabla, form);
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const del = async () => {
    const ok = await confirm({
      message: `¿Eliminar "${form.nombre}"?`,
      danger: true,
    });
    if (!ok) return;
    await supabase.from(cfg.tabla).delete().eq("id", form.id);
    void dexieDel(cfg.tabla, form.id);
    onDeleted(form.id);
  };

  // Bloque de imagen compartido entre runas y hechizos/dones
  const bloqueImagen = (
    <div className="relative w-full rounded-xl overflow-hidden border border-primary/10 bg-primary/3"
      style={{ aspectRatio: "1 / 1" }}>
      {(form as any).imagen_url ? (
        <Image
          alt={form.nombre}
          className="w-full h-full object-cover"
          src={(form as any).imagen_url}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <cfg.Icon size={64} style={{ color: cfg.color, opacity: 0.15 }} />
        </div>
      )}
      <div className="absolute top-2 right-2 z-10">
        <PickerImagenRunaBtn
          Icon={cfg.Icon}
          color={cfg.color}
          value={(form as any).imagen_url ?? ""}
          onChange={(url) => setForm((f) => ({ ...f, imagen_url: url } as any))}
        />
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ConfirmModal />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col gap-1.5 px-3 py-2 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          background: "color-mix(in srgb, var(--primary) 3%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden flex items-center justify-center border"
            style={{
              background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${cfg.color} 25%, transparent)`,
            }}
          >
            <cfg.Icon size={15} style={{ color: cfg.color }} />
          </div>
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
            placeholder={`Nombre del ${cfg.labelSing.toLowerCase()}…`}
            value={form.nombre ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <SaveIndicator status={status} />
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
            onClick={del}
          >
            <Trash2 size={10} />
          </button>
          <button
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
            disabled={status === "saving"}
            onClick={save}
          >
            <Save size={10} /> Guardar
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {modo === "runas" ? (
          // Runas: sin imagen — mitad izquierda para dibujar el patrón,
          // mitad derecha para el resto (grupos, explicación). El probador
          // de reconocimiento y el editor de combinaciones viven ahora en
          // la página de Magia (son herramientas globales, no de una runa
          // en particular).
          <div className="flex flex-col sm:flex-row gap-0 h-full">
            <div
              className="sm:w-1/2 min-w-0 p-4 sm:border-r"
              style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}
            >
              <PanelPatronRuna
                key={form.id}
                color={cfg.color}
                patronTrazos={(form.patron_trazos as any) ?? []}
                onChange={(trazos) =>
                  setForm((f) => ({ ...f, patron_trazos: trazos }))
                }
              />
            </div>

            <div className="sm:w-1/2 min-w-0 p-4 space-y-4">
              <PanelGruposAsignados
                color={cfg.color}
                entidadId={form.id}
                grupoIds={form.grupo_ids ?? []}
                grupos={grupos}
                label="Grupos de runas"
                labelMiembros="runas"
                loadingGrupos={loadingGrupos}
                mensajeVacio="Sin grupos asignados — categorizá esta runa (ej. Naturales, De fuego, Impacto rápido…)"
                modo={modo}
                placeholderBusqueda="Buscar grupo de runas…"
                textoBoton="Agregar grupo de runas"
                onGrupoIdsChange={(ids) =>
                  setForm((f) => ({ ...f, grupo_ids: ids }))
                }
                onNavigateGrupo={onNavigateGrupo}
              />
              <div className="space-y-1.5">
                <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
                  Explicación
                </label>
                <RichEditor
                  minHeight="20rem"
                  placeholder={cfg.placeholder}
                  value={form.explicacion ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, explicacion: v }))}
                  onWikilinkNavigate={onWikilink}
                />
              </div>
            </div>
          </div>
        ) : (
          // Hechizos / dones: layout original con columna de imagen.
          <div className="flex flex-col sm:flex-row gap-0 h-full">
            {/* Columna izquierda: imagen */}
            <div
              className="shrink-0 sm:w-64 p-4 sm:border-r flex flex-col gap-3"
              style={{ borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}
            >
              {bloqueImagen}
              <p
                className="text-micro font-black uppercase tracking-[0.25em] text-center truncate"
                style={{ color: `color-mix(in srgb, ${cfg.color} 50%, transparent)` }}
              >
                {form.nombre || `${cfg.labelSing} sin nombre`}
              </p>
            </div>

            {/* Columna derecha: grupos + explicación */}
            <div className="flex-1 min-w-0 p-4 space-y-4">
              <PanelGruposAsignados
                color={cfg.color}
                entidadId={form.id}
                grupoIds={form.grupo_ids ?? []}
                grupos={grupos}
                loadingGrupos={loadingGrupos}
                modo={modo}
                onGrupoIdsChange={(ids) =>
                  setForm((f) => ({ ...f, grupo_ids: ids }))
                }
                onNavigateGrupo={onNavigateGrupo}
              />
              <div className="space-y-1.5">
                <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
                  Explicación
                </label>
                <RichEditor
                  minHeight="17.5rem"
                  placeholder={cfg.placeholder}
                  value={form.explicacion ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, explicacion: v }))}
                  onWikilinkNavigate={onWikilink}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

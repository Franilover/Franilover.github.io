"use client";

/**
 * PanelRunaSeleccionada.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Reemplaza al viejo editor de runa a pantalla completa (FormularioRuna).
 * Ahora, al clickear una runa en el grid de RunasPage, este panel se abre
 * inline debajo del grid, en dos columnas:
 *
 *   - Columna A: el patrón de trazo de la runa (PanelPatronRuna) — ocupa
 *     el mismo lugar donde vive el probador de reconocimiento cuando no
 *     hay ninguna runa seleccionada (ver RunasPage).
 *   - Columna B: nombre + explicación (markdown) y, debajo, los grupos
 *     asignados a esta runa.
 *
 * Volver a clickear la misma runa la deselecciona y este panel desaparece
 * (el toggle vive en RunasPage, acá solo se renderiza si hay selección).
 *
 * El guardado es manual (botón "Guardar"), igual que antes.
 */

import { Save, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { RichEditor } from "@/editor/lexical";
import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import { useConfirm } from "@/ui/ConfirmModal";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import { supabase } from "@/infra/supabase/supabase";
import { dexiePut, dexieDelete as dexieDel } from "@/lib/utils/dexieHelpers";

import { PanelGruposAsignados } from "./PanelGruposAsignados";
import { PanelPatronRuna } from "./PanelPatronRuna";
import { CONFIG, type EntidadMagica, type GrupoMin } from "./types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function PanelRunaSeleccionada({
  item,
  grupos,
  loadingGrupos,
  onSaved,
  onDeleted,
  onNavigateGrupo,
  onCerrar,
}: {
  item: EntidadMagica;
  grupos: GrupoMin[];
  loadingGrupos: boolean;
  onSaved: (i: EntidadMagica) => void;
  onDeleted: (id: string) => void;
  /** Si se pasa, el nombre de cada grupo asignado navega a su editor. */
  onNavigateGrupo?: (id: string) => void;
  /** Cierra el panel (equivalente a volver a clickear la runa). */
  onCerrar: () => void;
}) {
  const [form, setForm] = useState<EntidadMagica>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const { confirm, ConfirmModal } = useConfirm();
  const { onWikilink } = useWikilink();

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
        patron_trazos: form.patron_trazos ?? null,
        grupo_ids: form.grupo_ids ?? [],
      };
      const { error } = await supabase
        .from(CONFIG.tabla)
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
      void dexiePut(CONFIG.tabla, form);
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
    await supabase.from(CONFIG.tabla).delete().eq("id", form.id);
    void dexieDel(CONFIG.tabla, form.id);
    onDeleted(form.id);
  };

  return (
    <div className="rounded-2xl border border-primary/15 bg-white-custom/60 p-4">
      <ConfirmModal />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0 pb-3 mb-1 border-b border-primary/10">
        <div
          className="shrink-0 w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center border"
          style={{
            background: `color-mix(in srgb, ${CONFIG.color} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${CONFIG.color} 25%, transparent)`,
          }}
        >
          <CONFIG.Icon size={15} style={{ color: CONFIG.color }} />
        </div>
        <input
          className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
          placeholder={`Nombre de la ${CONFIG.labelSing.toLowerCase()}…`}
          value={form.nombre ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />
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
        <button
          type="button"
          onClick={onCerrar}
          title="Cerrar"
          className="shrink-0 text-micro font-black uppercase tracking-widest text-primary/30 hover:text-primary/60 transition-colors px-1"
        >
          ✕
        </button>
      </div>

      {/* ── Body: dos columnas ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Columna A: patrón — ocupa el lugar del probador */}
        <div className="flex-1 min-w-0">
          <PanelPatronRuna
            key={form.id}
            color={CONFIG.color}
            patronTrazos={(form.patron_trazos as any) ?? []}
            onChange={(trazos) => setForm((f) => ({ ...f, patron_trazos: trazos }))}
          />
        </div>

        {/* Columna B: explicación + grupos debajo */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
              Explicación
            </label>
            <RichEditor
              minHeight="14rem"
              placeholder={CONFIG.placeholder}
              value={form.explicacion ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, explicacion: v }))}
              onWikilinkNavigate={onWikilink}
            />
          </div>

          <PanelGruposAsignados
            color={CONFIG.color}
            entidadId={form.id}
            grupoIds={form.grupo_ids ?? []}
            grupos={grupos}
            label="Grupos de runas"
            labelMiembros="runas"
            loadingGrupos={loadingGrupos}
            mensajeVacio="Sin grupos asignados — categorizá esta runa (ej. Naturales, De fuego, Impacto rápido…)"
            modo="runas"
            placeholderBusqueda="Buscar grupo de runas…"
            textoBoton="Agregar grupo de runas"
            onGrupoIdsChange={(ids) => setForm((f) => ({ ...f, grupo_ids: ids }))}
            onNavigateGrupo={onNavigateGrupo}
          />
        </div>
      </div>
    </div>
  );
}

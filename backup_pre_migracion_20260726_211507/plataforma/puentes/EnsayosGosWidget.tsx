"use client";

/**
 * EnsayosGosWidget
 * ───────────────────────────────────────────────────────────────────────────
 * Puente entre Ensayos (feature independiente de notas tipo Obsidian) y el
 * editor de Garlia: muestra en la tab "Inicio" los ensayos etiquetados "GOS"
 * (case-insensitive), con botón para crear uno nuevo directo con esa tag.
 * Al clickear un ensayo, el padre (MundoHomeContent) abre <EnsayoGosScreen />
 * — el editor de ensayos completo reusado DENTRO de /myself/garlia — vía la
 * prop onOpen, sin salir de la página.
 *
 * Lectura + creación via useEnsayoEditorLogic (misma lógica que usa
 * EnsayosShell) — no hay estado compartido más allá de esas dos cosas.
 */

import { FileText, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";

import NewNoteModal from "@/editor/notas/components/newNoteModal";
import { useEnsayoEditorLogic } from "@/editor/notas/hooks/useEnsayoEditorLogic";

interface Props {
  onOpen: (ensayoId: string) => void;
}

export function EnsayosGosWidget({ onOpen }: Props) {
  const { ensayos, loading, crearNotaPendiente } = useEnsayoEditorLogic(null);
  const [showModal, setShowModal] = useState(false);

  const gosEnsayos = useMemo(
    () =>
      ensayos.filter((e: any) =>
        (e.tags ?? []).some((t: string) => t.trim().toLowerCase() === "gos"),
      ),
    [ensayos],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-micro font-black uppercase tracking-widest text-primary/30">
          Ensayos · GOS
        </h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-micro font-bold text-primary/40 hover:text-primary transition-colors"
        >
          <Plus size={12} /> Nuevo
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-primary/30">Cargando…</div>
      ) : gosEnsayos.length === 0 ? (
        <div className="text-xs text-primary/25">Sin ensayos con tag GOS todavía</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {gosEnsayos.map((e: any) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/10 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/25 transition-colors text-xs font-semibold text-primary/80"
            >
              <FileText size={12} className="text-primary/40 shrink-0" />
              {e.titulo || "Sin título"}
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <NewNoteModal
          onClose={() => setShowModal(false)}
          onConfirm={async (titulo) => {
            const id = await crearNotaPendiente(titulo, ["gos"]);
            setShowModal(false);
            if (id) onOpen(id);
          }}
        />
      )}
    </div>
  );
}


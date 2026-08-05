"use client";

/**
 * EnsayoGosScreen
 * ───────────────────────────────────────────────────────────────────────────
 * Pantalla completa que reusa <Editor /> de Ensayos (components/notas/
 * EditorEnsayo.tsx) DENTRO del editor de Garlia, para poder abrir un ensayo
 * con tag "GOS" sin salir de /myself/garlia.
 *
 * Usa useEnsayoEditorLogic (hooks/notas/useEnsayoEditorLogic.ts) — la misma
 * lógica de guardado/wikilinks/auto-creación de páginas que usa EnsayosShell
 * en /myself/escritorio — así el comportamiento es idéntico en ambos lugares
 * sin duplicar esa lógica dos veces.
 *
 * Se usa en dos lugares:
 *   1. EditorMundoRoot, sección "notas-gos" — participa del sistema de tabs
 *      de Mundo (useMundoNavigation): "Volver" llama a closeTab, que cierra
 *      esta pestaña y activa la vecina (o vuelve a Inicio si no queda
 *      ninguna).
 *   2. Cualquier otro lugar que la use standalone, pasando ensayoId/onClose
 *      directo, sin depender de useMundoNavigation.
 */

import { Loader2, ArrowLeft } from "lucide-react";
import React from "react";

import { Editor } from "@/editor/notas/components/EditorEnsayo";
import NewNoteModal from "@/editor/notas/components/newNoteModal";
import { useEnsayoEditorLogic } from "@/editor/notas/hooks/useEnsayoEditorLogic";
import { useZotero } from "@/editor/notas/hooks/useZotero";

interface Props {
  ensayoId: string;
  onClose: () => void;
}

export function EnsayoGosScreen({ ensayoId, onClose }: Props) {
  const {
    ensayos,
    loading,
    ensayoActivo,
    setEnsayoActivoId,
    saveStatus,
    actualizarLocal,
    navigateToPage,
    pendingNoteTitle,
    showNewNoteModal,
    setShowNewNoteModal,
    crearNotaPendiente,
  } = useEnsayoEditorLogic(ensayoId);
  const { sources } = useZotero();
  const [editMode, setEditMode] = React.useState(true);
  const [tocOpen, setTocOpen] = React.useState(false);

  React.useEffect(() => {
    setEnsayoActivoId(ensayoId);
  }, [ensayoId, setEnsayoActivoId]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <header
        className="shrink-0 flex items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/50 hover:text-primary transition-colors"
        >
          <ArrowLeft size={11} /> Volver
        </button>
        <div className="w-px h-3.5 bg-primary/15" />
        <span className="text-micro font-black uppercase tracking-widest text-primary/70 truncate">
          {ensayoActivo?.titulo || "Ensayo"}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading || !ensayoActivo ? (
          <div className="flex-1 h-full flex items-center justify-center text-primary/30">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <Editor
            key={ensayoActivo.id}
            editMode={editMode}
            ensayo={ensayoActivo}
            ensayos={ensayos}
            sources={sources}
            tocOpen={tocOpen}
            onNavigateToPage={(name) => navigateToPage(name, false)}
            onTagClick={(tag) => void navigateToPage(tag, true)}
            onTocToggle={() => setTocOpen((p) => !p)}
            onToggleEditMode={() => setEditMode((p) => !p)}
            onUpdateField={actualizarLocal}
            saveStatus={saveStatus}
          />
        )}
      </div>

      {showNewNoteModal && (
        <NewNoteModal
          initialTitle={pendingNoteTitle ?? undefined}
          onClose={() => setShowNewNoteModal(false)}
          onConfirm={async (titulo) => {
            const id = await crearNotaPendiente(titulo);
            if (id) setEnsayoActivoId(id);
          }}
        />
      )}
    </div>
  );
}

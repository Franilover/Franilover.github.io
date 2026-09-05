"use client";
// Migrado desde _legacy/views/EditorReino.tsx a domains/garlia/reinos/components.
// Las llamadas sueltas a supabase.from("reinos") (save/delete) pasaron a
// reinosQueries. dexiePut/dexieDelete y SaveIndicator/useWikilink siguen
// viniendo de _legacy — son compartidos entre entidades, mismo patrón que
// criaturas/items.
import {
  Map,
  Loader2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import React, { useState, useEffect } from "react";

import {
  useMobileAsidePanel,
  useRegisterMobileAside,
} from "@/hooks/ui/useMobileAsidePanel";

import type { WikiEntity } from "@/ui/Markdown/commandItems";
import { type SaveStatus } from "@/domains/garlia/_shared/types";
import { type Ciudad } from "@/domains/garlia/ciudades";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import { usePersonajesDelReino } from "@garlia/personajes";
import { dexiePut, dexieDelete } from "@/infra/sync/useOfflineSync";
import { supabase } from "@/infra/supabase/supabase";
import { loadCiudadesPorReino } from "@/infra/sync/syncEngine";

import { EditorHeaderBar } from "@/domains/garlia/_shared/EditorHeaderBar";
import {
  usePublishHeaderControls,
  type OnHeaderControlsChange,
} from "@/domains/garlia/_shared/useEditorHeaderControls";

import { type Reino } from "../types";
import { reinosQueries } from "../queries";
import { LoreTab } from "./LoreTab";

// ─── Hook: ciudades del reino ─────────────────────────────────────────────────
function useCiudadesDelReino(reinoId: string) {
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadCiudadesPorReino(reinoId, (data) => {
      if (!cancelled) setCiudades(data as Ciudad[]);
    }).then((data) => {
      if (!cancelled) setCiudades(data as Ciudad[]);
    });
    return () => {
      cancelled = true;
    };
  }, [reinoId]);

  return { ciudades, setCiudades };
}

// ─── ImagePickerModal ─────────────────────────────────────────────────────────
function ImagePickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [SimpleImagePicker, setComponent] =
    useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    void import("@/ui/SimpleImagePicker").then(
      (m) => setComponent(() => m.default),
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white-custom rounded-t-2xl sm:rounded-2xl shadow-2xl border border-primary/15 w-full sm:max-w-lg p-5 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
            <ImageIcon size={11} /> Imagen del mapa
          </h3>
          <button
            className="text-primary/30 hover:text-primary transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {SimpleImagePicker ? (
          <SimpleImagePicker onClose={onClose} onSelect={onSelect} />
        ) : (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary/20" size={16} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EditorReino ──────────────────────────────────────────────────────────────
export function EditorReino({
  item,
  onSaved,
  onDeleted,
  entities = [],
  onSelectPersonaje,
  onSelectCiudad,
  onSelectCriatura,
  onSelectItem,
  onHeaderControlsChange,
}: {
  item: Reino;
  onSaved: (r: Reino) => void;
  onDeleted: (id: string) => void;
  entities?: WikiEntity[];
  onSelectPersonaje?: (personaje: any) => void;
  onSelectCiudad?: (id: string) => void;
  onSelectCriatura?: (id: string) => void;
  onSelectItem?: (id: string) => void;
  onHeaderControlsChange?: OnHeaderControlsChange;
}) {
  const [form, setForm] = useState<Reino>(item);
  const [status, setStatus] = useState<SaveStatus>("idle");
  useRegisterMobileAside();
  const mobileAsideOpen = useMobileAsidePanel((s) => s.open);
  const closeMobileAside = useMobileAsidePanel((s) => s.close);
  const openMobileAside = useMobileAsidePanel((s) => s.openPanel);
  // LoreTab espera un setter booleano genérico (lo comparte con el resto de
  // sus consumidores) — lo adaptamos al store global sin tocar su contrato.
  const setMobileAsideOpen = (v: boolean) => (v ? openMobileAside() : closeMobileAside());
  const { ciudades: detalles, setCiudades: setDetalles } = useCiudadesDelReino(
    item.id,
  );
  const { onSnippetAction: _onSnippetAction } = useWikilink();
  const {
    personajes,
    setPersonajes: _setPersonajes,
    loading: loadingPersonajes,
  } = usePersonajesDelReino(form.nombre);

  useEffect(() => {
    setForm(item);
    setStatus("idle");
  }, [item.id]);

  const save = async () => {
    setStatus("saving");
    try {
      await reinosQueries.update(form.id, form);
      setStatus("saved");
      onSaved(form);
      void dexiePut("reinos", form);
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  // Confirmación inline en el header compartido — ver EditorHeaderBar.
  const del = async () => {
    await reinosQueries.delete(form.id);
    void dexieDelete("reinos", form.id);
    onDeleted(form.id);
  };

  const handleDetallesMapChange = async (updated: Ciudad[]) => {
    setDetalles(updated);
    await Promise.all(
      updated.map((d) =>
        supabase
          .from("ciudades")
          .update({ coord_x: d.coord_x, coord_y: d.coord_y })
          .eq("id", d.id),
      ),
    );
  };

  const headerControls = {
    imagenUrl: form.mapa_url,
    IconoFallback: Map,
    nombre: form.nombre ?? "",
    placeholderNombre: "Nombre del reino",
    onChangeNombre: (nombre: string) => setForm((f) => ({ ...f, nombre })),
    status,
    onGuardar: save,
    onEliminar: del,
  };
  usePublishHeaderControls(headerControls, onHeaderControlsChange);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!onHeaderControlsChange && <EditorHeaderBar controls={headerControls} />}

        {/* LoreTab — ocupa todo el espacio restante */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <LoreTab
            // MapaConPuntosComponent (mapa propio del reino, vía
            // ReinoTileCanvas) desactivado: ReinoTileCanvas quedó
            // desactualizado frente al mapa global de mapaGarlia.tsx y ya no
            // se usa en ningún flujo — ver nota en reinos/components/
            // ReinoTileCanvas.tsx. LoreTab soporta el prop como opcional,
            // así que simplemente no se pasa; sin mapa propio, el reino se
            // sigue viendo y editando desde el mapa global.
            detalles={detalles}
            entities={entities}
            form={form}
            loadingPersonajes={loadingPersonajes}
            mapaUrl={form.mapa_url ?? ""}
            mobileAsideOpen={mobileAsideOpen}
            personajes={personajes}
            setForm={setForm}
            setMobileAsideOpen={setMobileAsideOpen}
            onDetalleDelete={(id) =>
              setDetalles((prev) => prev.filter((x) => x.id !== id))
            }
            onDetalleUpdate={(d) =>
              setDetalles((prev) => prev.map((x) => (x.id === d.id ? d : x)))
            }
            onDetallesArrayChange={handleDetallesMapChange}
            onMapaChange={(url) => setForm((f) => ({ ...f, mapa_url: url }))}
            onOpenDetalleEditor={onSelectCiudad}
            onSelectCriatura={onSelectCriatura}
            onSelectItem={onSelectItem}
            onSelectPersonaje={onSelectPersonaje}
          />
        </div>
      </div>
    </div>
  );
}

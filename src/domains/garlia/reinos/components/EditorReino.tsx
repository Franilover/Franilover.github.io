"use client";
// Migrado desde _legacy/views/EditorReino.tsx a domains/garlia/reinos/components.
// Las llamadas sueltas a supabase.from("reinos") (save/delete) pasaron a
// reinosQueries. dexiePut/dexieDelete y SaveIndicator/useWikilink siguen
// viniendo de _legacy — son compartidos entre entidades, mismo patrón que
// criaturas/items.
import {
  Map,
  Trash2,
  Save,
  Loader2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect } from "react";

import {
  useMobileAsidePanel,
  useRegisterMobileAside,
} from "@/hooks/ui/useMobileAsidePanel";

import type { WikiEntity } from "@/components/forms/Markdown/commandItems";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { SaveIndicator } from "@/domains/garlia/_shared/UIComponents";
import { type SaveStatus } from "@/domains/garlia/_shared/types";
import { type Ciudad } from "@/domains/garlia/ciudades";
import { useWikilink } from "@/domains/garlia/_shared/WikilinkContext";
import { usePersonajesDelReino } from "@garlia/personajes";
import { dexiePut, dexieDelete } from "@/hooks/data/useOfflineSync";
import { supabase } from "@/infra/supabase/supabase";
import { loadCiudadesPorReino } from "@/infra/sync/syncEngine";

import { type Reino } from "../model";
import { reinosQueries } from "../queries";
import { LoreTab } from "./LoreTab";
import { ReinoTileCanvas } from "./ReinoTileCanvas";

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
    void import("@/components/ui/SimpleImagePicker").then(
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
}: {
  item: Reino;
  onSaved: (r: Reino) => void;
  onDeleted: (id: string) => void;
  entities?: WikiEntity[];
  onSelectPersonaje?: (personaje: any) => void;
  onSelectCiudad?: (id: string) => void;
  onSelectCriatura?: (id: string) => void;
  onSelectItem?: (id: string) => void;
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
  const { confirm, ConfirmModal } = useConfirm();
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

  const del = async () => {
    const ok = await confirm({
      message: `¿Eliminar el reino "${form.nombre}"?`,
      danger: true,
    });
    if (!ok) return;
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

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      <ConfirmModal />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div
          className="shrink-0 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 2%, transparent)",
          }}
        >
          <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5 sm:px-4 sm:py-2.5">
            {/* Thumbnail */}
            <div
              className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border flex items-center justify-center"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 15%, transparent)",
                background:
                  "color-mix(in srgb, var(--primary) 6%, transparent)",
              }}
            >
              {form.mapa_url ? (
                <Image
                  alt={form.nombre}
                  className="w-full h-full object-cover"
                  src={form.mapa_url}
                />
              ) : (
                <Map className="text-primary/25" size={14} />
              )}
            </div>

            {/* Nombre */}
            <input
              className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
              placeholder="Nombre del reino"
              value={form.nombre ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre: e.target.value }))
              }
            />

            <SaveIndicator status={status} />

            <button
              className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all"
              onClick={del}
            >
              <Trash2 size={10} />
              <span className="hidden sm:inline">Eliminar</span>
            </button>

            <button
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-micro font-black uppercase tracking-widest bg-primary text-btn-text hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
              disabled={status === "saving"}
              onClick={save}
            >
              <Save size={10} />
              <span className="hidden sm:inline">Guardar</span>
            </button>
          </div>
        </div>

        {/* LoreTab — ocupa todo el espacio restante */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <LoreTab
            MapaConPuntosComponent={(props) => (
              <ReinoTileCanvas
                detalles={props.detalles}
                editMode={true}
                reinoId={form.id}
                onDetallesChange={props.onDetallesChange}
                onPinClick={(ciudad) => onSelectCiudad?.(ciudad.id)}
              />
            )}
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

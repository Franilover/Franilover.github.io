"use client";


import { AnimatePresence } from "framer-motion";
import {
  Trash2, Save, X, Loader2, ZoomIn, Plus, Image as ImageIcon,
  Pencil, SlidersHorizontal, Sparkles,
} from "lucide-react";
import Image from "next/image";
import React, { useState, useMemo } from "react";

import { MotionDiv, MotionButton } from "@/ui/Motion";
import SimpleImagePicker from "@/ui/SimpleImagePicker";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { cn } from "@/lib/utils/index";

type Temporada = "Primavera" | "Verano" | "Otoño" | "Invierno";
type Vibra     = "Casual" | "Formal" | "Sport" | "Noche" | "Aesthetic";
type Color     = "Negro" | "Blanco" | "Gris" | "Rosa" | "Rojo" | "Azul" | "Verde" | "Beige" | "Marrón" | "Lila";

interface Outfit {
  id: string;
  nombre: string;
  descripcion?: string;
  imagen_url: string;
  temporadas?: Temporada[];
  vibras?: Vibra[];
  colores?: Color[];
}

interface FormData {
  nombre: string;
  descripcion: string;
  imagen_url: string;
  temporadas: Temporada[];
  vibras: Vibra[];
  colores: Color[];
}

const TEMPORADAS: Temporada[] = ["Primavera", "Verano", "Otoño", "Invierno"];
const VIBRAS: Vibra[]         = ["Casual", "Formal", "Sport", "Noche", "Aesthetic"];
const COLORES: Color[]        = ["Negro", "Blanco", "Gris", "Rosa", "Rojo", "Azul", "Verde", "Beige", "Marrón", "Lila"];

const COLOR_DOT: Record<Color, string> = {
  Negro: "#1a1a1a", Blanco: "#f5f5f5", Gris: "#9ca3af", Rosa: "#f9a8d4",
  Rojo: "#ef4444", Azul: "#3b82f6", Verde: "#22c55e", Beige: "#d4b896",
  Marrón: "#92400e", Lila: "#c084fc",
};

const EMPTY_FORM: FormData = {
  nombre: "", descripcion: "", imagen_url: "",
  temporadas: [], vibras: [], colores: [],
};

function toggleArr<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

function ChipGroup<T extends string>({
  options, selected, onToggle, colorDot,
}: {
  options: T[]; selected: T[]; onToggle: (v: T) => void; colorDot?: Record<T, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all border",
              active
                ? "bg-primary text-btn-text border-primary"
                : "bg-primary/5 text-muted-on-surface border-primary/10 hover:border-primary/30"
            )}
            style={{ borderRadius: "var(--radius-btn)" }}
            onClick={() => onToggle(opt)}
          >
            {colorDot && (
              <span
                className="w-2 h-2 rounded-full shrink-0 border border-white/20"
                style={{ background: colorDot[opt] }}
              />
            )}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

interface OutfitFormProps {
  initial: FormData;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  title: string;
  icon: React.ReactNode;
}

function OutfitForm({ initial, onSave, onClose, saving, title, icon }: OutfitFormProps) {
  const [form, setForm]             = useState<FormData>(initial);
  const [showPicker, setShowPicker] = useState(false);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      {}
      <div className="flex items-center justify-between p-5 border-b border-primary/10">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">{title}</h3>
        </div>
        <button
          className="p-1.5 text-muted-on-surface hover:text-on-surface transition-colors"
          style={{ borderRadius: "9999px" }}
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: "80vh" }}>
        {}
        {!showPicker ? (
          <button
            className={cn(
              "relative w-full aspect-video border-2 border-dashed transition-all overflow-hidden group",
              form.imagen_url ? "border-primary/20" : "border-primary/10 hover:border-primary/30"
            )}
            style={{ borderRadius: "var(--radius-card)" }}
            onClick={() => setShowPicker(true)}
          >
            {form.imagen_url ? (
              <>
                <Image alt="preview" className="w-full h-full object-cover" src={form.imagen_url} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <ImageIcon className="text-white" size={16} />
                  <span className="text-[10px] font-black uppercase text-white tracking-widest">Cambiar foto</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-primary/5">
                <ImageIcon className="text-primary/20" size={28} />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-on-surface">Elegir foto</span>
              </div>
            )}
          </button>
        ) : (
          <div className="border border-primary/10 overflow-hidden" style={{ borderRadius: "var(--radius-card)" }}>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-on-surface">Selecciona una foto</p>
              <button className="text-muted-on-surface hover:text-on-surface" onClick={() => setShowPicker(false)}><X size={14} /></button>
            </div>
            <div className="px-4 pb-4">
              <SimpleImagePicker
                onClose={() => setShowPicker(false)}
                onSelect={(url) => { set("imagen_url", url); setShowPicker(false); }}
              />
            </div>
          </div>
        )}

        {!showPicker && (
          <>
            {}
            <input
              className="input-brand text-[10px] font-black"
              placeholder="NOMBRE DEL OUTFIT..."
              type="text"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value.toUpperCase())}
            />

            {}
            <textarea
              className="input-brand text-[10px] resize-none"
              placeholder="Descripción o notas (opcional)..."
              rows={2}
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
            />

            {}
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-on-surface mb-2">Temporada</p>
              <ChipGroup
                options={TEMPORADAS}
                selected={form.temporadas}
                onToggle={(v) => set("temporadas", toggleArr(form.temporadas, v))}
              />
            </div>

            {}
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-on-surface mb-2">Vibra</p>
              <ChipGroup
                options={VIBRAS}
                selected={form.vibras}
                onToggle={(v) => set("vibras", toggleArr(form.vibras, v))}
              />
            </div>

            {}
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-on-surface mb-2">Colores</p>
              <ChipGroup
                colorDot={COLOR_DOT}
                options={COLORES}
                selected={form.colores}
                onToggle={(v) => set("colores", toggleArr(form.colores, v))}
              />
            </div>

            <button
              className="btn-brand w-full text-[10px] uppercase tracking-widest"
              disabled={!form.nombre || !form.imagen_url || saving}
              onClick={() => onSave(form)}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar outfit
            </button>
          </>
        )}
      </div>
    </>
  );
}

export default function ArmarioPage() {
  const {
    data: outfits = [],
    loading,
    addRow: addOutfit,
    updateRow: updateOutfit,
    deleteRow: deleteOutfit,
    refetch: refetchOutfits,
  } = useSupabaseData<Outfit>("ropa", {
    order: { campo: "created_at", asc: false },
  });

  const [lightbox, setLightbox]           = useState<Outfit | null>(null);
  const [showNuevo, setShowNuevo]         = useState(false);
  const [editando, setEditando]           = useState<Outfit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Outfit | null>(null);
  const [savingOutfit, setSavingOutfit]   = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  
  const [filtroTemporada, setFiltroTemporada] = useState<Temporada | null>(null);
  const [filtroVibra, setFiltroVibra]         = useState<Vibra | null>(null);
  const [filtroColor, setFiltroColor]         = useState<Color | null>(null);
  const [showFiltros, setShowFiltros]         = useState(false);

  const hayFiltros = filtroTemporada || filtroVibra || filtroColor;

  const outfitsFiltrados = useMemo(() => {
    return outfits.filter((o: Outfit) => {
      if (filtroTemporada && !o.temporadas?.includes(filtroTemporada)) return false;
      if (filtroVibra     && !o.vibras?.includes(filtroVibra))         return false;
      if (filtroColor     && !o.colores?.includes(filtroColor))        return false;
      return true;
    });
  }, [outfits, filtroTemporada, filtroVibra, filtroColor]);

  const limpiarFiltros = () => {
    setFiltroTemporada(null);
    setFiltroVibra(null);
    setFiltroColor(null);
  };

  
  const guardarNuevo = async (data: FormData) => {
    setSavingOutfit(true);
    const { error } = await addOutfit(data);
    if (!error) { setShowNuevo(false); await refetchOutfits(); }
    setSavingOutfit(false);
  };

  const guardarEdicion = async (data: FormData) => {
    if (!editando) return;
    setSavingOutfit(true);
    const { error } = await updateOutfit(editando.id, data);
    if (!error) { setEditando(null); await refetchOutfits(); }
    setSavingOutfit(false);
  };

  const confirmarBorrado = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    await deleteOutfit(confirmDelete.id);
    setConfirmDelete(null);
    setDeletingId(null);
    await refetchOutfits();
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-bg-main">
      <Loader2 className="animate-spin text-primary/20" size={40} />
    </div>
  );

  

  const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <MotionDiv
      animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4" exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onClick={onClose}
    >
      <MotionDiv
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="modal-surface relative shadow-2xl w-full max-w-md overflow-hidden"
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        style={{ borderRadius: "var(--radius-card)" }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </MotionDiv>
    </MotionDiv>
  );

  

  return (
    <div className="min-h-screen bg-bg-main">

      {}
      <AnimatePresence>
        {showNuevo && (
          <Modal onClose={() => setShowNuevo(false)}>
            <OutfitForm
              icon={<Sparkles className="text-primary" size={16} />}
              initial={EMPTY_FORM}
              saving={savingOutfit}
              title="Nuevo Outfit"
              onClose={() => setShowNuevo(false)}
              onSave={guardarNuevo}
            />
          </Modal>
        )}
      </AnimatePresence>

      {}
      <AnimatePresence>
        {editando && (
          <Modal onClose={() => setEditando(null)}>
            <OutfitForm
              icon={<Pencil className="text-primary" size={16} />}
              initial={{
                nombre: editando.nombre,
                descripcion: editando.descripcion ?? "",
                imagen_url: editando.imagen_url,
                temporadas: editando.temporadas ?? [],
                vibras: editando.vibras ?? [],
                colores: editando.colores ?? [],
              }}
              saving={savingOutfit}
              title="Editar Outfit"
              onClose={() => setEditando(null)}
              onSave={guardarEdicion}
            />
          </Modal>
        )}
      </AnimatePresence>

      {}
      <AnimatePresence>
        {confirmDelete && (
          <Modal onClose={() => setConfirmDelete(null)}>
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full" style={{ background: "color-mix(in srgb, #ef4444 10%, transparent)" }}>
                  <Trash2 className="text-red-400" size={18} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-on-surface">¿Borrar este outfit?</p>
                  <p className="text-[9px] text-muted-on-surface mt-0.5 uppercase tracking-widest">{confirmDelete.nombre}</p>
                </div>
              </div>
              {confirmDelete.imagen_url && (
                <div className="w-full aspect-video overflow-hidden bg-primary/5 opacity-50" style={{ borderRadius: "var(--radius-btn)" }}>
                  <Image alt="" className="w-full h-full object-cover" src={confirmDelete.imagen_url} />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-muted-on-surface hover:text-on-surface transition-colors border border-primary/10"
                  style={{ borderRadius: "var(--radius-btn)" }}
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={!!deletingId}
                  style={{ borderRadius: "var(--radius-btn)" }}
                  onClick={confirmarBorrado}
                >
                  {deletingId ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  Borrar
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {}
      <AnimatePresence>
        {lightbox && (
          <Modal onClose={() => setLightbox(null)}>
            {}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <button
                className="modal-surface p-2 shadow-md text-muted-on-surface hover:text-primary transition-colors"
                style={{ borderRadius: "9999px" }}
                onClick={() => { setEditando(lightbox); setLightbox(null); }}
              >
                <Pencil size={14} />
              </button>
              <button
                className="modal-surface p-2 shadow-md text-muted-on-surface hover:text-red-500 transition-colors"
                style={{ borderRadius: "9999px" }}
                onClick={() => { setConfirmDelete(lightbox); setLightbox(null); }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <button
              className="absolute top-4 right-4 z-10 modal-surface p-2 shadow-md text-muted-on-surface hover:text-on-surface transition-colors"
              style={{ borderRadius: "9999px" }}
              onClick={() => setLightbox(null)}
            >
              <X size={16} />
            </button>

            {}
            <div className="aspect-[3/4] w-full bg-primary/5 overflow-hidden flex items-center justify-center">
              {lightbox.imagen_url
                ? <Image alt={lightbox.nombre} className="w-full h-full object-cover" src={lightbox.imagen_url} />
                : <Sparkles className="text-primary/20" size={64} />
              }
            </div>

            {}
            <div className="p-5 border-t border-primary/10">
              <p className="text-xs font-black uppercase text-on-surface">{lightbox.nombre}</p>
              {lightbox.descripcion && (
                <p className="text-[9px] text-muted-on-surface mt-1 leading-relaxed">{lightbox.descripcion}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-3">
                {lightbox.temporadas?.map(t => (
                  <span key={t} className="px-2 py-0.5 text-[7px] font-black uppercase tracking-widest bg-primary/10 text-primary" style={{ borderRadius: "var(--radius-btn)" }}>{t}</span>
                ))}
                {lightbox.vibras?.map(v => (
                  <span key={v} className="px-2 py-0.5 text-[7px] font-black uppercase tracking-widest bg-accent/20 text-primary" style={{ borderRadius: "var(--radius-btn)" }}>{v}</span>
                ))}
                {lightbox.colores?.map(c => (
                  <span key={c} className="flex items-center gap-1 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest bg-primary/5 text-muted-on-surface" style={{ borderRadius: "var(--radius-btn)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_DOT[c] }} />{c}
                  </span>
                ))}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {}
      <div
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--bg-main) 90%, transparent)",
          borderBottom: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-primary italic leading-none">
              Outfits
            </h1>
            <p className="text-muted-on-surface text-[9px] font-black uppercase tracking-widest mt-0.5">
              {outfitsFiltrados.length}
              {outfitsFiltrados.length !== outfits.length ? ` de ${outfits.length}` : ""} looks
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-all border",
                showFiltros || hayFiltros
                  ? "bg-primary text-btn-text border-primary"
                  : "bg-primary/5 text-muted-on-surface border-primary/10 hover:border-primary/30"
              )}
              style={{ borderRadius: "var(--radius-btn)" }}
              onClick={() => setShowFiltros(!showFiltros)}
            >
              <SlidersHorizontal size={12} />
              Filtros
              {hayFiltros && (
                <span className="bg-btn-text/20 text-btn-text px-1 rounded-full text-[7px]">
                  {[filtroTemporada, filtroVibra, filtroColor].filter(Boolean).length}
                </span>
              )}
            </button>

            <button
              className="btn-brand flex items-center gap-2 text-[10px] uppercase tracking-widest"
              onClick={() => setShowNuevo(true)}
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Nuevo</span>
            </button>
          </div>
        </div>

        {}
        <AnimatePresence>
          {showFiltros && (
            <MotionDiv
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden border-t border-primary/8"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4">

                {}
                <div className="flex items-start gap-4 flex-wrap">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-on-surface w-20 shrink-0 pt-1">Temporada</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPORADAS.map(t => (
                      <button
                        key={t}
                        className={cn(
                          "px-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all border",
                          filtroTemporada === t
                            ? "bg-primary text-btn-text border-primary"
                            : "bg-primary/5 text-muted-on-surface border-primary/10 hover:border-primary/30"
                        )}
                        style={{ borderRadius: "var(--radius-btn)" }}
                        onClick={() => setFiltroTemporada(filtroTemporada === t ? null : t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {}
                <div className="flex items-start gap-4 flex-wrap">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-on-surface w-20 shrink-0 pt-1">Vibra</p>
                  <div className="flex flex-wrap gap-1.5">
                    {VIBRAS.map(v => (
                      <button
                        key={v}
                        className={cn(
                          "px-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all border",
                          filtroVibra === v
                            ? "bg-primary text-btn-text border-primary"
                            : "bg-primary/5 text-muted-on-surface border-primary/10 hover:border-primary/30"
                        )}
                        style={{ borderRadius: "var(--radius-btn)" }}
                        onClick={() => setFiltroVibra(filtroVibra === v ? null : v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {}
                <div className="flex items-start gap-4 flex-wrap">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-on-surface w-20 shrink-0 pt-1">Color</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORES.map(c => (
                      <button
                        key={c}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all border",
                          filtroColor === c
                            ? "bg-primary text-btn-text border-primary"
                            : "bg-primary/5 text-muted-on-surface border-primary/10 hover:border-primary/30"
                        )}
                        style={{ borderRadius: "var(--radius-btn)" }}
                        onClick={() => setFiltroColor(filtroColor === c ? null : c)}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0 border border-black/10" style={{ background: COLOR_DOT[c] }} />
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {}
                {hayFiltros && (
                  <button
                    className="self-start text-[8px] font-black uppercase tracking-widest text-muted-on-surface hover:text-on-surface transition-colors underline underline-offset-2"
                    onClick={limpiarFiltros}
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      {}
      <main className="max-w-7xl mx-auto p-6 md:p-10">

        {}
        {hayFiltros && (
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              filtroTemporada && { label: filtroTemporada, clear: () => setFiltroTemporada(null) },
              filtroVibra     && { label: filtroVibra,     clear: () => setFiltroVibra(null) },
              filtroColor     && { label: filtroColor,     clear: () => setFiltroColor(null) },
            ].filter(Boolean).map((f: any, i) => (
              <button
                key={i}
                className="flex items-center gap-1.5 px-3 py-1 bg-primary text-btn-text text-[8px] font-black uppercase tracking-widest"
                style={{ borderRadius: "var(--radius-btn)" }}
                onClick={f.clear}
              >
                {f.label} <X size={10} />
              </button>
            ))}
          </div>
        )}

        {}
        {outfitsFiltrados.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-primary/10"
            style={{ borderRadius: "var(--radius-card)" }}
          >
            {hayFiltros ? (
              <>
                <SlidersHorizontal className="text-primary/10 mb-4" size={40} />
                <p className="text-[10px] font-black uppercase text-muted-on-surface mb-3">Sin resultados</p>
                <button className="btn-brand text-[9px]" onClick={limpiarFiltros}>Limpiar filtros</button>
              </>
            ) : (
              <>
                <Sparkles className="text-primary/20 mb-4" size={48} />
                <p className="text-[10px] font-black uppercase text-muted-on-surface">Añade tu primer outfit</p>
              </>
            )}
          </div>
        ) : (
          
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {outfitsFiltrados.map((outfit: Outfit) => (
              <div key={outfit.id} className="relative group/card">
                <MotionButton
                  className="card-main w-full relative overflow-hidden group p-0 transition-all border-primary/10 hover:border-primary/30"
                  style={{ aspectRatio: "3/4" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setLightbox(outfit)}
                >
                  {}
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/5">
                    {outfit.imagen_url
                      ? <img
                          alt={outfit.nombre}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          src={outfit.imagen_url}
                        />
                      : <Sparkles className="text-primary/10" size={32} />
                    }
                  </div>

                  {}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="modal-surface p-3 rounded-full shadow-lg">
                      <ZoomIn className="text-primary" size={18} />
                    </div>
                  </div>

                  {}
                  {outfit.colores && outfit.colores.length > 0 && (
                    <div className="absolute top-2 right-2 flex gap-0.5">
                      {outfit.colores.slice(0, 4).map(c => (
                        <span
                          key={c}
                          className="w-2.5 h-2.5 rounded-full border border-white/40 shadow"
                          style={{ background: COLOR_DOT[c] }}
                        />
                      ))}
                    </div>
                  )}

                  {}
                  <div
                    className="absolute inset-x-0 bottom-0 p-3"
                    style={{
                      background: "linear-gradient(to top, color-mix(in srgb, var(--bg-main) 85%, transparent) 0%, transparent 100%)",
                    }}
                  >
                    <p className="text-[9px] font-black text-foreground uppercase truncate">{outfit.nombre}</p>
                    {outfit.vibras && outfit.vibras.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {outfit.vibras.slice(0, 2).map(v => (
                          <span
                            key={v}
                            className="px-1.5 py-0.5 text-[6px] font-black uppercase"
                            style={{
                              borderRadius: "var(--radius-btn)",
                              background: "color-mix(in srgb, var(--primary) 20%, transparent)",
                              color: "var(--foreground)",
                            }}
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </MotionButton>

                {}
                <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
                  <button
                    className="modal-surface p-1.5 shadow-md text-muted-on-surface hover:text-primary transition-colors"
                    style={{ borderRadius: "var(--radius-btn)" }}
                    onClick={() => setEditando(outfit)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="modal-surface p-1.5 shadow-md text-muted-on-surface hover:text-red-500 transition-colors"
                    style={{ borderRadius: "var(--radius-btn)" }}
                    onClick={() => setConfirmDelete(outfit)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}

            {}
            <MotionButton
              className="relative border-2 border-dashed border-primary/10 hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-3 text-muted-on-surface hover:text-primary"
              style={{ aspectRatio: "3/4", borderRadius: "var(--radius-card)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowNuevo(true)}
            >
              <Plus className="opacity-30" size={24} />
              <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Añadir</p>
            </MotionButton>
          </div>
        )}
      </main>
    </div>
  );
}
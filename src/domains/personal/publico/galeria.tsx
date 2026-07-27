"use client";

import { AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Loader2,
  Pencil,
  Trash2,
  ImageIcon,
  Save,
  Pipette,
} from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect, useCallback, useRef } from "react";

import SimpleImagePicker from "@/ui/SimpleImagePicker";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import { useAuth } from "@/providers/AuthProvider";

interface GaleriaItem {
  id: number;
  url_imagen: string;
  bg_color: string;
  aspect_ratio: "square" | "wide" | "portrait";
  orden: number;
  creado_en: string;
}

const CANVAS_RATIO = 9 / 16;

function paddingForRatio(ratio: "square" | "wide" | "portrait" | undefined) {
  if (ratio === "wide") return `${CANVAS_RATIO * 100}%`;
  if (ratio === "portrait") return "125%";
  return "100%";
}

// ─── Helpers Dexie para galería ───────────────────────────────────────────────
async function readGaleriaFromDexie(): Promise<GaleriaItem[]> {
  try {
    if (!db) return [];
    const rows = await (db as any).galeria?.orderBy("orden").toArray();
    return (rows ?? []) as GaleriaItem[];
  } catch {
    return [];
  }
}

async function writeGaleriaToDexie(items: GaleriaItem[]): Promise<void> {
  try {
    if (!db || items.length === 0) return;
    await (db as any).galeria?.bulkPut(items);
  } catch (e) {
    console.warn("[Dexie] galeria bulkPut falló:", e);
  }
}

async function deleteGaleriaFromDexie(id: number): Promise<void> {
  try {
    if (!db) return;
    await (db as any).galeria?.delete(id);
  } catch {}
}

// ─── Hook galería: local-first ────────────────────────────────────────────────

function useGaleria() {
  const [items, setItems] = useState<GaleriaItem[]>([]);
  // loading=true solo cuando no hay nada local todavía
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isMounted = useRef(true);

  const fetchRemote = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("galeria")
        .select("*")
        .order("orden", { ascending: true })
        .order("creado_en", { ascending: false });
      if (error || !data) return;
      if (!isMounted.current) return;
      const sorted = data as GaleriaItem[];
      setItems(sorted);
      void writeGaleriaToDexie(sorted);
    } catch {
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    // 1. Mostrar caché local instantáneamente
    void readGaleriaFromDexie().then((local) => {
      if (!isMounted.current) return;
      if (local.length > 0) {
        setItems(local);
        setLoading(false);
        // 2. Refrescar desde Supabase en background sin bloquear UI
        void fetchRemote(true);
      } else {
        // Sin datos locales: fetch normal con loading
        setLoading(true);
        void fetchRemote(false).finally(() => {
          if (isMounted.current) setLoading(false);
        });
      }
    });

    return () => {
      isMounted.current = false;
    };
  }, [fetchRemote]);

  const reload = useCallback(() => fetchRemote(false), [fetchRemote]);

  return { items, setItems, loading, refreshing, reload };
}

function ImageLightbox({
  src,
  alt,
  bgColor,
  onClose,
}: {
  src: string;
  alt: string;
  bgColor: string;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const touchState = useRef({
    lastTap: 0,
    startDist: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const applyTransform = useCallback((scale: number, x: number, y: number) => {
    scaleRef.current = scale;
    offsetRef.current = { x, y };
    setTransform({ scale, x, y });
  }, []);

  const clampOffset = (scale: number, x: number, y: number) => {
    if (!imgRef.current) return { x, y };
    const el = imgRef.current;
    const maxX = Math.max(0, (el.offsetWidth * (scale - 1)) / 2);
    const maxY = Math.max(0, (el.offsetHeight * (scale - 1)) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const ts = touchState.current;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      ts.startX = t.clientX - offsetRef.current.x;
      ts.startY = t.clientY - offsetRef.current.y;
      ts.moved = false;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      ts.startDist = Math.hypot(dx, dy);
      ts.startScale = scaleRef.current;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const ts = touchState.current;
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = Math.max(
          1,
          Math.min(5, ts.startScale * (dist / ts.startDist)),
        );
        const clamped = clampOffset(
          scale,
          offsetRef.current.x,
          offsetRef.current.y,
        );
        applyTransform(scale, clamped.x, clamped.y);
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        const t = e.touches[0];
        const x = t.clientX - ts.startX;
        const y = t.clientY - ts.startY;
        ts.moved = true;
        const clamped = clampOffset(scaleRef.current, x, y);
        applyTransform(scaleRef.current, clamped.x, clamped.y);
      }
    },
    [applyTransform],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const ts = touchState.current;
      const now = Date.now();
      if (e.changedTouches.length === 1 && !ts.moved) {
        if (now - ts.lastTap < 300) {
          if (scaleRef.current > 1) {
            applyTransform(1, 0, 0);
          } else {
            const t = e.changedTouches[0];
            const el = imgRef.current;
            if (el) {
              const rect = el.getBoundingClientRect();
              const cx = t.clientX - rect.left - rect.width / 2;
              const cy = t.clientY - rect.top - rect.height / 2;
              const s = 2.5;
              const clamped = clampOffset(s, -cx * (s - 1), -cy * (s - 1));
              applyTransform(s, clamped.x, clamped.y);
            }
          }
          ts.lastTap = 0;
          return;
        }
        ts.lastTap = now;
      }
      if (scaleRef.current <= 1) applyTransform(1, 0, 0);
    },
    [applyTransform],
  );

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: bgColor,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease",
      }}
      onClick={() => {
        if (!touchState.current.moved && scaleRef.current <= 1) onClose();
      }}
    >
      <button
        className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full transition-all"
        style={{
          background: "rgba(0,0,0,0.45)",
          color: "white",
          backdropFilter: "blur(6px)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={16} />
      </button>

      <img
        ref={imgRef}
        alt={alt}
        className="max-w-[92vw] max-h-[85vh] object-contain select-none"
        draggable={false}
        src={src}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transition: transform.scale === 1 ? "transform 0.3s ease" : "none",
          transformOrigin: "center",
          touchAction: "none",
          cursor: transform.scale > 1 ? "grab" : "default",
          opacity: visible ? 1 : 0,
          transitionProperty:
            transform.scale === 1 ? "transform, opacity" : "opacity",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
      />
    </div>
  );
}

function EditModal({
  item,
  onSave,
  onClose,
}: {
  item: GaleriaItem;
  onSave: (updates: Partial<GaleriaItem>) => Promise<void>;
  onClose: () => void;
}) {
  const [bgColor, setBgColor] = useState(item.bg_color ?? "#111111");
  const [aspectRatio, setAspectRatio] = useState<
    "square" | "wide" | "portrait"
  >(item.aspect_ratio ?? "portrait");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);

  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

  const handlePickColor = useCallback(() => {
    const canvas = canvasRef.current;
    const imgEl = imgElRef.current;
    if (!canvas || !imgEl) return;
    canvas.width = imgEl.naturalWidth || imgEl.width;
    canvas.height = imgEl.naturalHeight || imgEl.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    setPicking(true);
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      setBgColor(rgbToHex(r, g, b));
      setHoverColor(null);
      setPicking(false);
    },
    [],
  );

  const handleCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      setHoverColor(rgbToHex(r, g, b));
    },
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    await onSave({ bg_color: bgColor, aspect_ratio: aspectRatio });
    setSaving(false);
    onClose();
  };

  const ratios: Array<{
    value: "square" | "wide" | "portrait";
    label: string;
  }> = [
    { value: "portrait", label: "Portrait" },
    { value: "square", label: "Cuadrado" },
    { value: "wide", label: "Wide 9:16" },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-primary/30 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-[var(--radius-card)] overflow-hidden shadow-2xl"
        style={{
          background: "var(--white-custom)",
          border:
            "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50">
            Editar obra
          </h3>
          <button
            className="text-primary/30 hover:text-primary transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview / eyedropper */}
          <div
            className="relative w-full rounded-xl overflow-hidden"
            style={{
              aspectRatio: "1/1",
              background: bgColor,
              border:
                "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            {picking ? (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain"
                style={{ cursor: "crosshair" }}
                onClick={handleCanvasClick}
                onMouseLeave={() => setHoverColor(null)}
                onMouseMove={handleCanvasMove}
              />
            ) : (
              <img
                ref={imgElRef}
                alt="preview"
                className="absolute inset-0 w-full h-full object-contain"
                crossOrigin="anonymous"
                src={item.url_imagen}
              />
            )}
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg border flex-shrink-0 transition-colors"
              style={{
                background: hoverColor ?? bgColor,
                borderColor:
                  "color-mix(in srgb, var(--primary) 20%, transparent)",
              }}
            />
            <input
              className="flex-1 h-8 rounded-lg border cursor-pointer"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 20%, transparent)",
              }}
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
            />
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all hover:opacity-80"
              style={{
                background: picking ? "var(--primary)" : "transparent",
                color: picking ? "var(--btn-text)" : "var(--primary)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 20%, transparent)",
              }}
              title="Seleccionar color de la imagen"
              onClick={handlePickColor}
            >
              <Pipette size={13} />
            </button>
          </div>

          {/* Aspect ratio */}
          <div className="flex gap-2">
            {ratios.map((r) => (
              <button
                key={r.value}
                className="flex-1 py-2 rounded-xl text-micro font-black uppercase tracking-widest transition-all border"
                style={{
                  background:
                    aspectRatio === r.value ? "var(--primary)" : "transparent",
                  color:
                    aspectRatio === r.value
                      ? "var(--btn-text)"
                      : "var(--primary)",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 20%, transparent)",
                  opacity: aspectRatio === r.value ? 1 : 0.5,
                }}
                onClick={() => setAspectRatio(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 py-2.5 rounded-xl border text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-all"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 15%, transparent)",
              }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-micro font-black uppercase tracking-widest transition-all"
              disabled={saving}
              style={{ background: "var(--primary)", color: "var(--btn-text)" }}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="animate-spin" size={11} />
              ) : (
                <Save size={11} />
              )}
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddModal({
  onClose,
  onSuccess,
  nextOrden,
}: {
  onClose: () => void;
  onSuccess: () => void;
  nextOrden: number;
}) {
  const [step, setStep] = useState<"pick" | "preview">("pick");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("galeria")
      .insert([
        {
          url_imagen: url,
          bg_color: "#111111",
          aspect_ratio: "portrait",
          orden: nextOrden,
        },
      ])
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      // Guardar en caché local inmediatamente
      void writeGaleriaToDexie([data as GaleriaItem]);
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-primary/30 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-[var(--radius-card)] overflow-hidden shadow-2xl"
        style={{
          background: "var(--white-custom)",
          border:
            "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
            <ImageIcon size={11} /> Nueva Obra
          </h3>
          <button
            className="text-primary/30 hover:text-primary transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {step === "pick" ? (
            <div className="space-y-3">
              <p className="text-micro font-black uppercase tracking-widest text-primary/30 text-center pb-2">
                Selecciona la imagen
              </p>
              <SimpleImagePicker
                onClose={onClose}
                onSelect={(u) => {
                  setUrl(u);
                  setStep("preview");
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="w-full rounded-xl overflow-hidden flex items-center justify-center"
                style={{
                  aspectRatio: "1/1",
                  background: "#111",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                }}
              >
                <Image
                  alt="preview"
                  className="max-w-full max-h-full object-contain"
                  src={url}
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2.5 rounded-xl border text-micro font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-all"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--primary) 15%, transparent)",
                  }}
                  onClick={() => setStep("pick")}
                >
                  Atrás
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-micro font-black uppercase tracking-widest transition-all"
                  disabled={saving}
                  style={{
                    background: "var(--primary)",
                    color: "var(--btn-text)",
                  }}
                  onClick={save}
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={11} />
                  ) : (
                    <Plus size={11} />
                  )}
                  {saving ? "Guardando…" : "Añadir"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GaleriaPage() {
  const { perfil } = useAuth() as any;
  const isAdmin = perfil?.rol === "admin";
  const { items, setItems, loading, refreshing, reload } = useGaleria();
  const [showAdd, setShowAdd] = useState(false);
  const [lightbox, setLightbox] = useState<GaleriaItem | null>(null);
  const [editing, setEditing] = useState<GaleriaItem | null>(null);

  const handleUpdate = useCallback(
    async (id: number, updates: Partial<GaleriaItem>) => {
      const { error } = await supabase
        .from("galeria")
        .update(updates)
        .eq("id", id);
      if (!error) {
        const updated = items.map((it) =>
          it.id === id ? { ...it, ...updates } : it,
        );
        setItems(updated);
        void writeGaleriaToDexie(updated);
      }
    },
    [items, setItems],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm("¿Eliminar esta obra?")) return;
      const { error } = await supabase.from("galeria").delete().eq("id", id);
      if (!error) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        void deleteGaleriaFromDexie(id);
      }
    },
    [setItems],
  );

  return (
    <div className="w-full bg-bg-main min-h-screen">
      {isAdmin && (
        <div className="flex justify-between items-center px-3 pt-4 pb-2">
          {/* Indicador de refresco en background — sutil, no bloquea */}
          <div className="w-5 h-5 flex items-center justify-center">
            {refreshing && (
              <Loader2 className="animate-spin text-primary/30" size={12} />
            )}
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-micro font-black uppercase tracking-widest border border-dashed transition-all hover:opacity-80"
            style={{
              borderColor:
                "color-mix(in srgb, var(--primary) 30%, transparent)",
              color: "color-mix(in srgb, var(--primary) 60%, transparent)",
            }}
            onClick={() => setShowAdd(true)}
          >
            <Plus size={12} /> Añadir obra
          </button>
        </div>
      )}

      <main>
        {loading ? (
          // Solo llega aquí si NO hay nada en Dexie todavía (primera carga ever)
          <div className="flex items-center justify-center py-32 text-primary/30">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-32 text-primary/20">
            <ImageIcon size={48} strokeWidth={1} />
            <p className="text-sm font-black uppercase tracking-widest">
              {isAdmin ? "Añade la primera obra" : "La galería está vacía"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0.5 p-0.5">
            {items.map((item) => {
              const isWide = (item.aspect_ratio ?? "portrait") === "wide";
              return (
                <div
                  key={item.id}
                  className="relative w-full overflow-hidden"
                  style={{
                    paddingBottom: paddingForRatio(item.aspect_ratio),
                    backgroundColor: item.bg_color,
                    gridColumn: isWide ? "span 2" : undefined,
                  }}
                >
                  <img
                    alt="Obra"
                    className="absolute inset-0 w-full h-full object-contain cursor-zoom-in"
                    draggable={false}
                    src={item.url_imagen}
                    style={{ objectPosition: "50% 50%" }}
                    onClick={() => setLightbox(item)}
                  />

                  {isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-white/20"
                        style={{
                          background: "rgba(0,0,0,0.5)",
                          color: "white",
                          backdropFilter: "blur(4px)",
                        }}
                        onClick={() => setEditing(item)}
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-red-600"
                        style={{
                          background: "rgba(0,0,0,0.5)",
                          color: "white",
                          backdropFilter: "blur(4px)",
                        }}
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {lightbox && (
        <ImageLightbox
          alt="Obra"
          bgColor={lightbox.bg_color}
          src={lightbox.url_imagen}
          onClose={() => setLightbox(null)}
        />
      )}

      {editing && (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(updates) => handleUpdate(editing.id, updates)}
        />
      )}

      <AnimatePresence>
        {showAdd && (
          <AddModal
            nextOrden={
              items.length ? Math.min(...items.map((i) => i.orden)) - 1 : 0
            }
            onClose={() => setShowAdd(false)}
            onSuccess={reload}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

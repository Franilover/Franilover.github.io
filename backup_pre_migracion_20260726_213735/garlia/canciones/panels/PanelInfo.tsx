"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  Mic2,
  Music,
  PenLine,
  Globe,
  Beaker,
  FileText,
  ChevronDown,
  Heart,
  Clock,
  Tag,
  Eye,
  EyeOff,
  Users,
  MapPin,
  Crown,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";

import { ComboSelector, type ComboItem } from "@/components/ui/ComboSelector";
import { SelectorFechaMundo } from "@/domains/garlia/calendario/SelectorFechaMundo";
import { ESTADOS } from "@/domains/garlia/canciones/constants";
import type { Cancion } from "@/domains/garlia/canciones/types";
import { supabase } from "@/lib/api/client/supabase";

// Mapa de etiquetas legibles por estado
const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  "EN PROCESO": "WIP",
  TERMINADA: "Terminada",
};

// Colores por estado (clases Tailwind inline)
const ESTADO_STYLES: Record<string, { active: string; dot: string }> = {
  BORRADOR: {
    active: "bg-primary/8 text-primary border-primary/20",
    dot: "bg-primary/30",
  },
  "EN PROCESO": {
    active: "bg-amber-500/10 text-amber-400 border-amber-400/30",
    dot: "bg-amber-400",
  },
  TERMINADA: {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-400/30",
    dot: "bg-emerald-400",
  },
};

// Emociones disponibles con colores
const EMOCIONES = [
  {
    label: "Alegría",
    color:
      "bg-yellow-400/15 text-yellow-400 border-yellow-400/25 hover:bg-yellow-400/25",
  },
  {
    label: "Melancolía",
    color:
      "bg-blue-400/15 text-blue-400 border-blue-400/25 hover:bg-blue-400/25",
  },
  {
    label: "Nostalgia",
    color:
      "bg-violet-400/15 text-violet-400 border-violet-400/25 hover:bg-violet-400/25",
  },
  {
    label: "Amor",
    color:
      "bg-rose-400/15 text-rose-400 border-rose-400/25 hover:bg-rose-400/25",
  },
  {
    label: "Angustia",
    color: "bg-red-400/15 text-red-400 border-red-400/25 hover:bg-red-400/25",
  },
  {
    label: "Esperanza",
    color:
      "bg-emerald-400/15 text-emerald-400 border-emerald-400/25 hover:bg-emerald-400/25",
  },
  {
    label: "Soledad",
    color:
      "bg-slate-400/15 text-slate-400 border-slate-400/25 hover:bg-slate-400/25",
  },
  {
    label: "Euforia",
    color:
      "bg-orange-400/15 text-orange-400 border-orange-400/25 hover:bg-orange-400/25",
  },
];

// Formatea segundos → mm:ss
function formatDuracion(segundos: number): string {
  if (!segundos || segundos <= 0) return "";
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Parsea "mm:ss" o número de segundos en texto → segundos
function parseDuracion(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [mStr, sStr] = trimmed.split(":");
    const m = parseInt(mStr, 10);
    const s = parseInt(sStr ?? "0", 10);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? null : n;
}

export const PanelInfo = ({
  cancionId,
  cancion,
  onCancionUpdate,
}: {
  cancionId: string;
  cancion: any;
  onCancionUpdate: (updates: any) => void;
}) => {
  const [localData, setLocalData] = useState({
    titulo: cancion.titulo || "",
    cantante: cancion.cantante || "",
    compositor: cancion.compositor || "",
    idioma: cancion.idioma || "",
    info_cancion: cancion.info_cancion || "",
    estado: (cancion.estado as Cancion["estado"]) || "BORRADOR",
    emocion: cancion.emocion || "",
    tema: cancion.tema || "",
    duracion_segundos: cancion.duracion_segundos ?? (null as number | null),
    visible: cancion.visible ?? false,
    personaje_id: cancion.personaje_id ?? (null as string | null),
  });

  // ── Selector reino / ciudad ──────────────────────────────────────────────────
  const [reinoId, setReinoId] = useState<string | null>(
    cancion.reino_id ?? null,
  );
  const [ciudadId, setCiudadId] = useState<string | null>(
    cancion.ciudad_id ?? null,
  );
  const [reinos, setReinos] = useState<ComboItem[]>([]);
  const [ciudades, setCiudades] = useState<ComboItem[]>([]); // todas
  const [savingUbi, setSavingUbi] = useState(false);

  // Input visual de duración (mm:ss)
  const [duracionInput, setDuracionInput] = useState(
    cancion.duracion_segundos ? formatDuracion(cancion.duracion_segundos) : "",
  );

  // ── Posición en línea de tiempo (calendario del mundo) ───────────────────────
  const [diaAbsoluto, setDiaAbsoluto] = useState<number | null>(
    cancion.dia_absoluto ?? null,
  );
  const [savingDia, setSavingDia] = useState(false);

  const [suggestions, setSuggestions] = useState<{ [key: string]: string[] }>(
    {},
  );
  const [activeField, setActiveField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [_dirty, setDirty] = useState(false);
  const [personajes, setPersonajes] = useState<ComboItem[]>([]);
  const timer = useRef<any>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const [
        { data: cancData },
        { data: persData },
        { data: reinosData },
        { data: ciudadesData },
      ] = await Promise.all([
        supabase.from("canciones").select("cantante, compositor, idioma, tema"),
        supabase
          .from("personajes")
          .select("id, nombre, img_url")
          .order("nombre"),
        supabase.from("reinos").select("id, nombre").order("nombre"),
        supabase
          .from("ciudades")
          .select("id, nombre, reino_id")
          .order("nombre"),
      ]);
      if (cancData) {
        const unique = (field: string) =>
          Array.from(
            new Set(cancData.map((item: any) => item[field]).filter(Boolean)),
          ) as string[];
        setSuggestions({
          cantante: unique("cantante"),
          compositor: unique("compositor"),
          idioma: unique("idioma"),
          tema: unique("tema"),
        });
      }
      if (persData) {
        setPersonajes(
          persData.map((p: any) => ({
            id: p.id,
            label: p.nombre,
            imgUrl: p.img_url ?? null,
          })),
        );
      }
      if (reinosData)
        setReinos(reinosData.map((r: any) => ({ id: r.id, label: r.nombre })));
      if (ciudadesData)
        setCiudades(
          ciudadesData.map((c: any) => ({
            id: c.id,
            label: c.nombre,
            meta: c.reino_id,
          })),
        );
    };
    void fetchSuggestions();
  }, []);

  const doSave = useCallback(
    async (data: typeof localData) => {
      clearTimeout(timer.current);
      setSaving(true);
      try {
        const { error } = await supabase
          .from("canciones")
          .update({
            titulo: data.titulo || null,
            cantante: data.cantante || null,
            compositor: data.compositor || null,
            idioma: data.idioma || null,
            info_cancion: data.info_cancion || null,
            estado: data.estado,
            emocion: data.emocion || null,
            tema: data.tema || null,
            duracion_segundos: data.duracion_segundos ?? null,
            visible: data.visible,
            personaje_id: data.personaje_id ?? null,
          })
          .eq("id", cancionId);

        if (error) throw error;
        onCancionUpdate(data);
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        console.error("Error al guardar:", e);
      }
      setSaving(false);
    },
    [cancionId, onCancionUpdate],
  );

  const handleChange = (field: string, value: string) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    setDirty(true);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => doSave(newData), 1500);
  };

  const handleEstadoChange = (nuevoEstado: Cancion["estado"]) => {
    const newData = { ...localData, estado: nuevoEstado };
    setLocalData(newData);
    setDirty(true);
    setSaved(false);
    clearTimeout(timer.current);
    void doSave(newData);
  };

  const handleEmocionChange = (emocion: string) => {
    // Toggle: si ya está activa, la quita
    const nueva = localData.emocion === emocion ? "" : emocion;
    const newData = { ...localData, emocion: nueva };
    setLocalData(newData);
    setDirty(true);
    setSaved(false);
    clearTimeout(timer.current);
    void doSave(newData);
  };

  const handleDuracionBlur = () => {
    const parsed = parseDuracion(duracionInput);
    const formatted = parsed !== null ? formatDuracion(parsed) : "";
    setDuracionInput(formatted);
    const newData = { ...localData, duracion_segundos: parsed };
    setLocalData(newData);
    setDirty(true);
    setSaved(false);
    clearTimeout(timer.current);
    void doSave(newData);
  };

  const getFilteredSuggestions = (field: string) => {
    const val = (localData as any)[field]?.toLowerCase() ?? "";
    if (!val) return [];
    return (suggestions[field] || [])
      .filter((s) => s.toLowerCase().includes(val) && s.toLowerCase() !== val)
      .slice(0, 5);
  };

  const handlePersonajeChange = (id: string | null) => {
    const newData = { ...localData, personaje_id: id };
    setLocalData(newData);
    setDirty(true);
    setSaved(false);
    clearTimeout(timer.current);
    void doSave(newData);
  };

  const handleVisibleChange = (visible: boolean) => {
    const newData = { ...localData, visible };
    setLocalData(newData);
    setDirty(true);
    setSaved(false);
    clearTimeout(timer.current);
    void doSave(newData);
  };

  const handleUbicacionChange = async (
    nuevoReinoId: string | null,
    nuevaCiudadId: string | null,
  ) => {
    setReinoId(nuevoReinoId);
    setCiudadId(nuevaCiudadId);
    setSavingUbi(true);
    try {
      await supabase
        .from("canciones")
        .update({ reino_id: nuevoReinoId, ciudad_id: nuevaCiudadId } as any)
        .eq("id", cancionId);
      onCancionUpdate({ reino_id: nuevoReinoId, ciudad_id: nuevaCiudadId });
    } catch {}
    setSavingUbi(false);
  };

  const handleReinoChange = (id: string | null) => {
    // Al cambiar reino, limpiar ciudad si no pertenece al nuevo reino
    const ciudadActualEsDeEsteReino = id
      ? ciudades.some((c) => c.id === ciudadId && (c as any).meta === id)
      : false;
    const nuevaCiudad = ciudadActualEsDeEsteReino ? ciudadId : null;
    void handleUbicacionChange(id, nuevaCiudad);
  };

  const handleCiudadChange = (id: string | null) => {
    // Al seleccionar ciudad, auto-seleccionar su reino si no hay uno
    if (id) {
      const ciudad = ciudades.find((c) => c.id === id);
      const ciudadReinoId = (ciudad as any)?.meta ?? null;
      void handleUbicacionChange(ciudadReinoId ?? reinoId, id);
    } else {
      void handleUbicacionChange(reinoId, null);
    }
  };

  // Ciudades filtradas por reino seleccionado
  const ciudadesFiltradas = reinoId
    ? ciudades.filter((c) => (c as any).meta === reinoId)
    : ciudades;

  const handleDiaAbsolutoChange = async (dia: number | null) => {
    setDiaAbsoluto(dia);
    setSavingDia(true);
    try {
      await supabase
        .from("canciones")
        .update({ dia_absoluto: dia, orden_linea_tiempo: dia } as any)
        .eq("id", cancionId);
      onCancionUpdate({ dia_absoluto: dia, orden_linea_tiempo: dia } as any);
    } catch {}
    setSavingDia(false);
  };

  const estadoActual =
    ESTADO_STYLES[localData.estado] ?? ESTADO_STYLES["BORRADOR"];
  const emocionActiva = EMOCIONES.find((e) => e.label === localData.emocion);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto px-6 py-10"
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary/40">
            <Beaker size={16} />
          </div>
          <div>
            <h3 className="text-micro font-black uppercase tracking-[0.25em] text-primary">
              Ficha Técnica
            </h3>
            <p className="text-micro font-medium text-primary/30 uppercase tracking-widest">
              Metadatos y créditos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <Loader2 className="animate-spin text-primary/20" size={10} />
          )}
          {saved && <CheckCircle2 className="text-emerald-500" size={10} />}
        </div>
      </div>

      {/* DOS COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* COLUMNA IZQUIERDA */}
        <section className="space-y-8">
          {/* Estado */}
          <div className="space-y-2">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${estadoActual.dot}`}
              />
              Estado
            </label>
            <div className="flex gap-2">
              {([...ESTADOS] as Cancion["estado"][]).map((e) => {
                const isActive = localData.estado === e;
                const styles = ESTADO_STYLES[e] ?? ESTADO_STYLES["BORRADOR"];
                return (
                  <button
                    key={e}
                    className={`flex-1 py-2 rounded-xl text-micro font-black uppercase tracking-widest border transition-all ${
                      isActive
                        ? styles.active
                        : "border-primary/10 text-primary/30 hover:border-primary/25 hover:text-primary/50"
                    }`}
                    type="button"
                    onClick={() => handleEstadoChange(e)}
                  >
                    {ESTADO_LABEL[e] ?? e}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <div className="group relative space-y-2">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2 group-focus-within:text-primary/50 transition-colors">
              <Music size={12} /> Título
            </label>
            <input
              className="w-full bg-transparent border-b border-primary/10 py-2 text-sm font-bold text-primary outline-none focus:border-primary/40 transition-all"
              placeholder="Nombre de la canción..."
              value={localData.titulo}
              onChange={(e) => handleChange("titulo", e.target.value)}
            />
          </div>

          {/* Idioma */}
          <div className="group relative space-y-2">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2 group-focus-within:text-primary/50 transition-colors">
              <Globe size={12} /> Idioma
            </label>
            <div className="relative">
              <select
                className="w-full bg-transparent border-b border-primary/10 py-2 text-sm font-bold text-primary outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer"
                value={localData.idioma}
                onChange={(e) => handleChange("idioma", e.target.value)}
              >
                <option value="">Sin idioma</option>
                <option value="Español">Español</option>
                <option value="Japonés">Japonés</option>
                <option value="Inglés">Inglés</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-primary/30"
                size={12}
              />
            </div>
          </div>

          {/* Cantante / Compositor / Tema con sugerencias */}
          {[
            {
              label: "Cantante",
              key: "cantante",
              icon: <Mic2 size={12} />,
              placeholder: "Hatsune Miku...",
            },
            {
              label: "Compositor",
              key: "compositor",
              icon: <PenLine size={12} />,
              placeholder: "Deco*27...",
            },
            {
              label: "Tema",
              key: "tema",
              icon: <Tag size={12} />,
              placeholder: "Amor, soledad, guerra…",
            },
          ].map((field) => {
            const filtered = getFilteredSuggestions(field.key);
            return (
              <div key={field.key} className="group relative space-y-2">
                <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2 group-focus-within:text-primary/50 transition-colors">
                  {field.icon} {field.label}
                </label>
                <input
                  className="w-full bg-transparent border-b border-primary/10 py-2 text-sm font-bold text-primary outline-none focus:border-primary/40 transition-all"
                  placeholder={field.placeholder}
                  value={(localData as any)[field.key]}
                  onBlur={() => setTimeout(() => setActiveField(null), 200)}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  onFocus={() => setActiveField(field.key)}
                />
                <AnimatePresence>
                  {activeField === field.key && filtered.length > 0 && (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute z-10 w-full mt-1 bg-bg-main border border-primary/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                      exit={{ opacity: 0 }}
                      initial={{ opacity: 0, y: -5 }}
                    >
                      {filtered.map((s) => (
                        <button
                          key={s}
                          className="w-full px-4 py-2 text-left text-micro font-bold text-primary/60 hover:bg-primary/5 hover:text-primary transition-colors flex items-center justify-between group"
                          onClick={() => handleChange(field.key, s)}
                        >
                          {s}
                          <ChevronDown
                            className="-rotate-90 opacity-0 group-hover:opacity-100 transition-opacity"
                            size={10}
                          />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Línea de tiempo */}
          <div className="group relative space-y-2">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2 group-focus-within:text-primary/50 transition-colors">
              <Clock size={12} /> Línea de tiempo
            </label>
            <div className="relative max-w-xs">
              {savingDia && (
                <Loader2
                  className="animate-spin absolute right-2 top-1/2 -translate-y-1/2 z-10 text-primary/30"
                  size={10}
                />
              )}
              <SelectorFechaMundo
                placeholder="Sin fecha en la línea de tiempo"
                value={diaAbsoluto}
                onChange={handleDiaAbsolutoChange}
              />
            </div>
            <p className="text-micro text-primary/20 leading-tight">
              Fecha de la canción en el calendario del mundo
            </p>
          </div>

          {/* Duración */}
          <div className="group relative space-y-2">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2 group-focus-within:text-primary/50 transition-colors">
              <Clock size={12} /> Duración
            </label>
            <div className="flex items-center gap-3">
              <input
                className="w-32 bg-transparent border-b border-primary/10 py-2 text-sm font-bold text-primary outline-none focus:border-primary/40 transition-all tabular-nums"
                placeholder="3:45"
                value={duracionInput}
                onBlur={handleDuracionBlur}
                onChange={(e) => setDuracionInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              {localData.duracion_segundos && (
                <span className="text-micro text-primary/25 font-bold uppercase tracking-widest">
                  {localData.duracion_segundos}s
                </span>
              )}
            </div>
          </div>

          {/* Personaje */}
          <div className="space-y-2">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2">
              <Users size={12} /> Personaje
            </label>
            <ComboSelector
              emptyText="No hay personajes"
              items={personajes}
              mode="single"
              noneLabel="Sin personaje"
              placeholder="Sin personaje asignado…"
              value={localData.personaje_id}
              onChange={handlePersonajeChange}
            />
          </div>

          {/* Reino */}
          <div className="space-y-2">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2">
              <Crown size={12} /> Reino
              {savingUbi && (
                <Loader2
                  className="ml-auto animate-spin text-primary/20"
                  size={9}
                />
              )}
            </label>
            <ComboSelector
              emptyText="No hay reinos"
              items={reinos}
              mode="single"
              noneLabel="Sin reino"
              placeholder="Sin reino asignado…"
              value={reinoId}
              onChange={handleReinoChange}
            />
          </div>

          {/* Ciudad — solo visible si hay reino seleccionado */}
          {reinoId && (
            <div className="space-y-2">
              <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2">
                <MapPin size={12} /> Ciudad
              </label>
              <ComboSelector
                emptyText="Este reino no tiene ciudades"
                items={ciudadesFiltradas}
                mode="single"
                noneLabel="Sin ciudad"
                placeholder="Sin ciudad asignada…"
                value={ciudadId}
                onChange={handleCiudadChange}
              />
            </div>
          )}
        </section>

        {/* COLUMNA DERECHA */}
        <section className="space-y-8 flex flex-col">
          {/* Emoción */}
          <div className="space-y-3">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2">
              <Heart size={12} /> Emoción
              {emocionActiva && (
                <span
                  className={`ml-auto text-micro font-black px-2 py-0.5 rounded-full border ${emocionActiva.color}`}
                >
                  {emocionActiva.label}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOCIONES.map((e) => {
                const isActive = localData.emocion === e.label;
                return (
                  <button
                    key={e.label}
                    className={`px-3 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest border transition-all cursor-pointer ${
                      isActive
                        ? e.color
                        : "border-primary/10 text-primary/25 hover:border-primary/25 hover:text-primary/50"
                    }`}
                    type="button"
                    onClick={() => handleEmocionChange(e.label)}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visible */}
          <div className="space-y-2">
            <label className="text-micro font-black text-primary/25 uppercase tracking-[0.2em] flex items-center gap-2">
              {localData.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              Visibilidad
            </label>
            <button
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                localData.visible
                  ? "bg-emerald-500/8 border-emerald-400/25 text-emerald-400"
                  : "bg-primary/4 border-primary/10 text-primary/30 hover:border-primary/20 hover:text-primary/50"
              }`}
              type="button"
              onClick={() => handleVisibleChange(!localData.visible)}
            >
              <div className="flex items-center gap-2.5">
                {localData.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                <span className="text-micro font-black uppercase tracking-widest">
                  {localData.visible ? "Pública" : "Oculta"}
                </span>
              </div>
              {/* Toggle pill */}
              <div
                className={`relative w-8 h-4 rounded-full transition-all ${localData.visible ? "bg-emerald-400/40" : "bg-primary/10"}`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                    localData.visible
                      ? "left-[18px] bg-emerald-400"
                      : "left-0.5 bg-primary/25"
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Notas / contexto */}
          <div className="space-y-3 flex flex-col flex-1">
            <div className="flex items-center gap-3 border-b border-primary/5 pb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center text-primary/40">
                <FileText size={14} />
              </div>
              <div>
                <h3 className="text-micro font-black uppercase tracking-[0.25em] text-primary">
                  Contexto y Notas
                </h3>
                <p className="text-micro text-primary/25 font-medium mt-0.5">
                  Inspiración, historia, referencias…
                </p>
              </div>
            </div>
            <textarea
              className="flex-1 w-full bg-transparent border-l-2 border-primary/5 focus:border-primary/20 px-4 py-1 text-sm text-primary/80 placeholder:text-primary/20 outline-none transition-all resize-none min-h-[180px]"
              placeholder="¿De qué trata la canción? ¿Qué la inspiró?…"
              value={localData.info_cancion}
              onChange={(e) => handleChange("info_cancion", e.target.value)}
            />
          </div>
        </section>
      </div>
    </motion.div>
  );
};

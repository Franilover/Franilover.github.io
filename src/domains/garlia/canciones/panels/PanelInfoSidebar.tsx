"use client";

import { AnimatePresence, motion } from "framer-motion";
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
  X,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";

import { ComboSelector, type ComboItem } from "@/ui/ComboSelector";
import { SelectorFechaMundo } from "@/domains/garlia/calendario/SelectorFechaMundo";
import { CancionGrupos } from "@/domains/garlia/canciones/CancionGrupos";
import { ESTADOS } from "@/domains/garlia/canciones/constants";
import type { Cancion } from "@/domains/garlia/canciones/types";
import { supabase } from "@/infra/supabase/supabase";

// Mapa de etiquetas legibles por estado
const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  "EN PROCESO": "WIP",
  TERMINADA: "Terminada",
};

const ESTADO_DOT: Record<string, string> = {
  BORRADOR: "bg-primary/30",
  "EN PROCESO": "bg-amber-400",
  TERMINADA: "bg-emerald-400",
};

// Emociones disponibles (ahora en selector, no en botonera)
const EMOCIONES = [
  "Alegría",
  "Melancolía",
  "Nostalgia",
  "Amor",
  "Angustia",
  "Esperanza",
  "Soledad",
  "Euforia",
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

// ─── Campo de texto compacto con label ─────────────────────────────────────
const CampoTexto = ({
  label,
  icon,
  placeholder,
  value,
  onChange,
  suggestions,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) => {
  const [focused, setFocused] = useState(false);
  const filtered = value
    ? suggestions
        .filter(
          (s) =>
            s.toLowerCase().includes(value.toLowerCase()) &&
            s.toLowerCase() !== value.toLowerCase(),
        )
        .slice(0, 5)
    : [];

  return (
    <div className="group relative space-y-0.5">
      <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1 group-focus-within:text-primary/50 transition-colors">
        {icon} {label}
      </label>
      <input
        className="w-full bg-transparent border-b border-primary/10 py-0.5 text-micro font-bold text-primary outline-none focus:border-primary/40 transition-all"
        placeholder={placeholder}
        value={value}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
      />
      <AnimatePresence>
        {focused && filtered.length > 0 && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-20 w-full mt-1 bg-bg-main border border-primary/10 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0, y: -5 }}
          >
            {filtered.map((s) => (
              <button
                key={s}
                className="w-full px-2.5 py-1 text-left text-micro font-bold text-primary/60 hover:bg-primary/5 hover:text-primary transition-colors"
                onClick={() => onChange(s)}
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Selector nativo minimalista (reemplaza botoneras de Estado/Emoción) ───
const SelectorNativo = ({
  label,
  icon,
  value,
  onChange,
  options,
  allowEmpty,
  emptyLabel = "Sin definir",
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowEmpty?: boolean;
  emptyLabel?: string;
}) => (
  <div className="space-y-0.5">
    <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1">
      {icon} {label}
    </label>
    <div className="relative">
      <select
        className="w-full appearance-none bg-primary/[0.03] border border-primary/10 rounded-lg pl-2 pr-5 py-1 text-micro font-black uppercase tracking-wider text-primary outline-none focus:border-primary/30 transition-all cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-primary/30"
        size={10}
      />
    </div>
  </div>
);

export const PanelInfoSidebar = ({
  cancionId,
  cancion,
  onCancionUpdate,
  mobileOpen = false,
  onMobileClose,
  onNavigatePersonaje,
  onNavigateReino,
  onNavigateCiudad,
  onNavigateGrupo,
}: {
  cancionId: string;
  cancion: any;
  onCancionUpdate: (updates: any) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  // Navegación cruzada: saltar al editor del personaje/reino/ciudad
  // actualmente asignado a la canción (lápiz de edición en el ComboSelector).
  // Opcionales: si el padre no los pasa, el ComboSelector simplemente no
  // muestra el lápiz, como pasaba antes.
  onNavigatePersonaje?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
  onNavigateCiudad?: (id: string) => void;
  onNavigateGrupo?: (id: string) => void;
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

  // ── Selector reino / ciudad ────────────────────────────────────────────
  const [reinoId, setReinoId] = useState<string | null>(
    cancion.reino_id ?? null,
  );
  const [ciudadId, setCiudadId] = useState<string | null>(
    cancion.ciudad_id ?? null,
  );
  const [reinos, setReinos] = useState<ComboItem[]>([]);
  const [ciudades, setCiudades] = useState<ComboItem[]>([]);
  const [savingUbi, setSavingUbi] = useState(false);

  const [duracionInput, setDuracionInput] = useState(
    cancion.duracion_segundos ? formatDuracion(cancion.duracion_segundos) : "",
  );

  const [diaAbsoluto, setDiaAbsoluto] = useState<number | null>(
    cancion.dia_absoluto ?? null,
  );
  const [savingDia, setSavingDia] = useState(false);

  const [suggestions, setSuggestions] = useState<{ [key: string]: string[] }>(
    {},
  );
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

  const handleEstadoChange = (nuevoEstado: string) => {
    const newData = {
      ...localData,
      estado: nuevoEstado as Cancion["estado"],
    };
    setLocalData(newData);
    setDirty(true);
    setSaved(false);
    clearTimeout(timer.current);
    void doSave(newData);
  };

  const handleEmocionChange = (emocion: string) => {
    const newData = { ...localData, emocion };
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
    const ciudadActualEsDeEsteReino = id
      ? ciudades.some((c) => c.id === ciudadId && (c as any).meta === id)
      : false;
    const nuevaCiudad = ciudadActualEsDeEsteReino ? ciudadId : null;
    void handleUbicacionChange(id, nuevaCiudad);
  };

  const handleCiudadChange = (id: string | null) => {
    if (id) {
      const ciudad = ciudades.find((c) => c.id === id);
      const ciudadReinoId = (ciudad as any)?.meta ?? null;
      void handleUbicacionChange(ciudadReinoId ?? reinoId, id);
    } else {
      void handleUbicacionChange(reinoId, null);
    }
  };

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

  const innerContent = (
    <div className="px-2.5 py-2.5 space-y-2.5">
      {/* Indicador de guardado (sin título, para aprovechar espacio) */}
      {(saving || saved) && (
        <div className="flex items-center justify-end gap-1.5 -mb-1">
          {saving && (
            <Loader2 className="animate-spin text-primary/25" size={9} />
          )}
          {saved && <CheckCircle2 className="text-emerald-500" size={9} />}
        </div>
      )}

      {/* Estado + Visibilidad (interruptor) lado a lado */}
      <div className="flex gap-1.5 items-end">
        <div className="flex-1">
          <SelectorNativo
            icon={
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${ESTADO_DOT[localData.estado] ?? ESTADO_DOT.BORRADOR}`}
              />
            }
            label="Estado"
            options={([...ESTADOS] as string[]).map((e) => ({
              value: e,
              label: ESTADO_LABEL[e] ?? e,
            }))}
            value={localData.estado}
            onChange={handleEstadoChange}
          />
        </div>
        <div className="shrink-0 space-y-0.5">
          <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1">
            {localData.visible ? <Eye size={9} /> : <EyeOff size={9} />}
            Visible
          </label>
          <button
            aria-label="Alternar visibilidad"
            className={`relative w-8 h-[22px] rounded-full border transition-all cursor-pointer ${
              localData.visible
                ? "bg-emerald-500/15 border-emerald-400/30"
                : "bg-primary/4 border-primary/10"
            }`}
            title={localData.visible ? "Pública" : "Oculta"}
            type="button"
            onClick={() => handleVisibleChange(!localData.visible)}
          >
            <div
              className={`absolute top-0.5 w-[15px] h-[15px] rounded-full transition-all ${
                localData.visible
                  ? "left-[16px] bg-emerald-400"
                  : "left-0.5 bg-primary/25"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Título */}
      <CampoTexto
        icon={<Music size={9} />}
        label="Título"
        placeholder="Nombre de la canción…"
        suggestions={[]}
        value={localData.titulo}
        onChange={(v) => handleChange("titulo", v)}
      />

      {/* Cantante / Compositor */}
      <div className="grid grid-cols-2 gap-1.5">
        <CampoTexto
          icon={<Mic2 size={9} />}
          label="Cantante"
          placeholder="Hatsune Miku…"
          suggestions={suggestions.cantante || []}
          value={localData.cantante}
          onChange={(v) => handleChange("cantante", v)}
        />
        <CampoTexto
          icon={<PenLine size={9} />}
          label="Compositor"
          placeholder="Deco*27…"
          suggestions={suggestions.compositor || []}
          value={localData.compositor}
          onChange={(v) => handleChange("compositor", v)}
        />
      </div>

      {/* Emoción / Tema */}
      <div className="grid grid-cols-2 gap-1.5">
        <SelectorNativo
          allowEmpty
          emptyLabel="Sin emoción"
          icon={<Heart size={9} />}
          label="Emoción"
          options={EMOCIONES.map((e) => ({ value: e, label: e }))}
          value={localData.emocion}
          onChange={handleEmocionChange}
        />
        <CampoTexto
          icon={<Tag size={9} />}
          label="Tema"
          placeholder="Amor, soledad…"
          suggestions={suggestions.tema || []}
          value={localData.tema}
          onChange={(v) => handleChange("tema", v)}
        />
      </div>

      {/* Idioma / Duración */}
      <div className="grid grid-cols-2 gap-1.5">
        <SelectorNativo
          allowEmpty
          emptyLabel="Sin idioma"
          icon={<Globe size={9} />}
          label="Idioma"
          options={[
            { value: "Español", label: "Español" },
            { value: "Japonés", label: "Japonés" },
            { value: "Inglés", label: "Inglés" },
          ]}
          value={localData.idioma}
          onChange={(v) => handleChange("idioma", v)}
        />
        <div className="space-y-0.5">
          <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1">
            <Clock size={9} /> Duración
          </label>
          <input
            className="w-full bg-transparent border-b border-primary/10 py-0.5 text-micro font-bold text-primary outline-none focus:border-primary/40 transition-all tabular-nums"
            placeholder="3:45"
            value={duracionInput}
            onBlur={handleDuracionBlur}
            onChange={(e) => setDuracionInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>
      </div>

      {/* Línea de tiempo */}
      <div className="space-y-0.5">
        <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1">
          <Clock size={9} /> Línea de tiempo
          {savingDia && (
            <Loader2 className="ml-auto animate-spin text-primary/25" size={9} />
          )}
        </label>
        <SelectorFechaMundo
          placeholder="Sin fecha"
          value={diaAbsoluto}
          onChange={handleDiaAbsolutoChange}
        />
      </div>

      {/* Personaje */}
      <div className="space-y-0.5">
        <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1">
          <Users size={9} /> Personaje
        </label>
        <ComboSelector
          emptyText="No hay personajes"
          items={personajes}
          mode="single"
          noneLabel="Sin personaje"
          placeholder="Sin asignar…"
          value={localData.personaje_id}
          onChange={handlePersonajeChange}
          onNavigate={
            onNavigatePersonaje
              ? (id) => onNavigatePersonaje(id)
              : undefined
          }
        />
      </div>

      {/* Reino / Ciudad */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-0.5">
          <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1">
            <Crown size={9} /> Reino
            {savingUbi && (
              <Loader2 className="ml-auto animate-spin text-primary/20" size={9} />
            )}
          </label>
          <ComboSelector
            emptyText="No hay reinos"
            items={reinos}
            mode="single"
            noneLabel="Sin reino"
            placeholder="Sin asignar…"
            value={reinoId}
            onChange={handleReinoChange}
            onNavigate={
              onNavigateReino ? (id) => onNavigateReino(id) : undefined
            }
          />
        </div>

        <div className="space-y-0.5">
          <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1">
            <MapPin size={9} /> Ciudad
          </label>
          <ComboSelector
            emptyText={reinoId ? "Sin ciudades" : "Elige un reino"}
            items={ciudadesFiltradas}
            mode="single"
            noneLabel="Sin ciudad"
            placeholder="Sin asignar…"
            value={ciudadId}
            onChange={handleCiudadChange}
            onNavigate={
              onNavigateCiudad ? (id) => onNavigateCiudad(id) : undefined
            }
          />
        </div>
      </div>

      {/* Grupos (álbumes, playlists, etc.) */}
      <CancionGrupos cancionId={cancionId} onOpenGrupo={onNavigateGrupo} />

      {/* Notas / contexto */}
      <div className="space-y-1">
        <label className="text-micro font-black text-primary/25 uppercase tracking-[0.12em] flex items-center gap-1">
          <FileText size={9} /> Notas
        </label>
        <textarea
          className="w-full bg-primary/[0.02] border border-primary/8 rounded-lg px-1.5 py-1 text-micro text-primary/80 placeholder:text-primary/20 outline-none focus:border-primary/20 transition-all resize-none min-h-[90px]"
          placeholder="¿De qué trata? ¿Qué la inspiró?…"
          value={localData.info_cancion}
          onChange={(e) => handleChange("info_cancion", e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: panel fijo lateral, angosto y minimalista */}
      <div
        className="hidden lg:flex flex-col shrink-0 border-l overflow-y-auto"
        style={{
          width: "260px",
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          background: "color-mix(in srgb, var(--primary) 2%, transparent)",
        }}
      >
        {innerContent}
      </div>

      {/* Mobile: drawer desde la derecha */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{
              background: "color-mix(in srgb, var(--primary) 20%, transparent)",
            }}
            onClick={onMobileClose}
          />
          <div
            className="relative flex flex-col h-full overflow-y-auto shadow-2xl"
            style={{
              width: "280px",
              background: "var(--white-custom, var(--bg-main))",
              borderLeft:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <div
              className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
            >
              <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/40 flex items-center gap-1.5">
                <Beaker size={9} />
                Ficha Técnica
              </span>
              <button
                className="p-1 rounded-lg text-primary/30 hover:text-primary hover:bg-primary/8 transition-all"
                onClick={onMobileClose}
              >
                <X size={14} />
              </button>
            </div>
            {innerContent}
          </div>
        </div>
      )}
    </>
  );
};

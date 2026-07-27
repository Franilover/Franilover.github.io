"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Check,
  X,
  Plus,
  ChevronDown,
  Dumbbell,
  HeartPulse,
  PersonStanding,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";

import { Btn, BtnIcon, Badge, Loading, EmptyState } from "@/components/ui";
import { MotionDiv } from "@/components/ui/Motion";
import {
  rutinasQueries,
  ejerciciosQueries,
} from "@/lib/api/queries/personal/ejercicios";
import { cn } from "@/lib/utils/index";

interface Ejercicio {
  id: string;
  nombre: string;
  series: number;
  reps: string;
  descanso: number;
  musculo: string;
  notas?: string;
  orden?: number;
}
interface Rutina {
  id: string;
  nombre: string;
  descripcion: string;
  tag: string;
  ejercicios: Ejercicio[];
}

const TAGS = ["Todas", "Fuerza", "Cardio", "Flexibilidad", "Movilidad"];
const TAG_ICONS: Record<string, LucideIcon> = {
  Fuerza: Dumbbell,
  Cardio: HeartPulse,
  Flexibilidad: PersonStanding,
  Movilidad: RotateCcw,
};
const beep = (freq = 880, dur = 0.15) => {
  try {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch {}
};

const EjecutarRutina = ({
  rutina,
  onCerrar,
}: {
  rutina: Rutina;
  onCerrar: () => void;
}) => {
  const [ejercicioIdx, setEjercicioIdx] = useState(0);
  const [serieActual, setSerieActual] = useState(1);
  const [fase, setFase] = useState<"ejercicio" | "descanso" | "fin">(
    "ejercicio",
  );
  const [segundos, setSegundos] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [completados, setCompletados] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const ejercicio = (rutina.ejercicios ?? [])[ejercicioIdx];
  const esUltimoEjercicio =
    ejercicioIdx === (rutina.ejercicios ?? []).length - 1;
  const esUltimaSerie = serieActual === ejercicio?.series;

  useEffect(() => {
    if (fase !== "descanso") return;
    setSegundos(ejercicio.descanso);
    setCorriendo(true);
  }, [fase, ejercicioIdx, serieActual]);
  useEffect(() => {
    if (!corriendo || fase !== "descanso") return;
    intervalRef.current = setInterval(() => {
      setSegundos((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setCorriendo(false);
          beep(1046, 0.3);
          setFase("ejercicio");
          return 0;
        }
        if (prev <= 4) beep(660, 0.08);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [corriendo, fase]);

  const completarSerie = () => {
    beep(880, 0.1);
    setCompletados((p) => [...p, `${ejercicioIdx}-${serieActual}`]);
    if (esUltimaSerie && esUltimoEjercicio) setFase("fin");
    else if (esUltimaSerie) {
      setEjercicioIdx((i) => i + 1);
      setSerieActual(1);
      setFase("descanso");
    } else {
      setSerieActual((s) => s + 1);
      setFase("descanso");
    }
  };

  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = fase === "descanso" ? segundos / ejercicio.descanso : 1;

  if (fase === "fin")
    return (
      <MotionDiv
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary"
        initial={{ opacity: 0 }}
      >
        <MotionDiv
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
          initial={{ scale: 0.8, opacity: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="text-micro font-black uppercase tracking-[0.4em] text-[color-mix(in_srgb,var(--btn-text)_40%,transparent)] italic">
            Completado
          </span>
          <h2 className="text-5xl font-black text-btn-text italic tracking-tighter text-center">
            {rutina.nombre}
          </h2>
          <p className="text-[color-mix(in_srgb,var(--btn-text)_40%,transparent)] text-sm font-bold uppercase tracking-widest">
            {rutina.ejercicios.length} ejercicios ·{" "}
            {(rutina.ejercicios ?? []).reduce((a, e) => a + e.series, 0)} series
          </p>
          <Btn
            className="mt-8 bg-white-custom text-primary hover:bg-white-custom/90 shadow-2xl"
            size="lg"
            onClick={onCerrar}
          >
            Terminar
          </Btn>
        </MotionDiv>
      </MotionDiv>
    );

  return (
    <MotionDiv
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col bg-primary"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div>
          <span className="text-micro font-black uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--btn-text)_30%,transparent)] italic">
            Rutina
          </span>
          <h2 className="text-lg font-black text-btn-text italic tracking-tight">
            {rutina.nombre}
          </h2>
        </div>
        <BtnIcon
          className="bg-btn-text/10 hover:bg-btn-text/20 border-none"
          variant="ghost"
          onClick={onCerrar}
        >
          <X
            className="text-[color-mix(in_srgb,var(--btn-text)_60%,transparent)]"
            size={18}
          />
        </BtnIcon>
      </div>
      <div className="px-6 mb-6">
        <div className="flex gap-1.5">
          {(rutina.ejercicios ?? []).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-500",
                i < ejercicioIdx
                  ? "bg-white-custom"
                  : i === ejercicioIdx
                    ? "bg-btn-text/60"
                    : "bg-btn-text/15",
              )}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-micro font-black text-[color-mix(in_srgb,var(--btn-text)_30%,transparent)] uppercase tracking-widest">
            Ejercicio {ejercicioIdx + 1} de {(rutina.ejercicios ?? []).length}
          </span>
          <span className="text-micro font-black text-[color-mix(in_srgb,var(--btn-text)_30%,transparent)] uppercase tracking-widest">
            Serie {serieActual} de {ejercicio.series}
          </span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        <AnimatePresence mode="wait">
          <MotionDiv
            key={ejercicioIdx}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 text-center"
            exit={{ opacity: 0, y: -20 }}
            initial={{ opacity: 0, y: 20 }}
          >
            <span className="text-micro font-black uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--btn-text)_30%,transparent)] italic">
              {ejercicio.musculo}
            </span>
            <h1 className="text-4xl sm:text-6xl font-black text-btn-text italic tracking-tighter leading-none">
              {ejercicio.nombre}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              {(
                [
                  ["Series", String(ejercicio.series)],
                  ["Reps", ejercicio.reps],
                  ["Descanso", `${ejercicio.descanso}s`],
                ] as [string, string][]
              ).map(([label, val], i, arr) => (
                <React.Fragment key={label}>
                  <div className="flex flex-col items-center">
                    <span className="text-micro font-black uppercase tracking-widest text-[color-mix(in_srgb,var(--btn-text)_30%,transparent)]">
                      {label}
                    </span>
                    <span className="text-2xl font-black text-btn-text tabular-nums">
                      {val}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-px h-8 bg-btn-text/15" />
                  )}
                </React.Fragment>
              ))}
            </div>
            {ejercicio.notas && (
              <span className="text-micro font-bold text-[color-mix(in_srgb,var(--btn-text)_30%,transparent)] italic mt-1">
                * {ejercicio.notas}
              </span>
            )}
          </MotionDiv>
        </AnimatePresence>
        {fase === "descanso" ? (
          <div className="flex flex-col items-center gap-4">
            <span className="text-micro font-black uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--btn-text)_40%,transparent)]">
              Descansando
            </span>
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  fill="none"
                  opacity="0.1"
                  r={r}
                  stroke="white"
                  strokeWidth="5"
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  fill="none"
                  r={r}
                  stroke="white"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - pct)}
                  strokeLinecap="round"
                  strokeWidth="5"
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-btn-text tabular-nums tracking-tighter">
                  {segundos}
                </span>
                <span className="text-micro font-black text-[color-mix(in_srgb,var(--btn-text)_40%,transparent)] uppercase tracking-widest">
                  seg
                </span>
              </div>
            </div>
            <Btn
              className="border-[color-mix(in_srgb,var(--btn-text)_15%,transparent)] text-[color-mix(in_srgb,var(--btn-text)_40%,transparent)]"
              size="sm"
              variant="outline"
              onClick={() => {
                clearInterval(intervalRef.current!);
                setCorriendo(false);
                setFase("ejercicio");
              }}
            >
              Saltar descanso
            </Btn>
          </div>
        ) : (
          <div className="flex gap-2">
            {Array.from({ length: ejercicio.series }).map((_, i) => {
              const done =
                completados.includes(`${ejercicioIdx}-${i + 1}`) ||
                i < serieActual - 1;
              const actual = i === serieActual - 1;
              return (
                <div
                  key={i}
                  className={cn(
                    "w-9 h-9 rounded-[var(--radius-btn)] flex items-center justify-center font-black text-xs transition-all",
                    done
                      ? "bg-white-custom text-primary"
                      : actual
                        ? "bg-btn-text/20 text-btn-text border-[length:var(--border-width)] border-[color-mix(in_srgb,var(--btn-text)_40%,transparent)]"
                        : "bg-btn-text/8 text-[color-mix(in_srgb,var(--btn-text)_20%,transparent)] border border-[color-mix(in_srgb,var(--btn-text)_10%,transparent)]",
                  )}
                >
                  {done ? <Check size={14} /> : i + 1}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {fase === "ejercicio" && (
        <div className="px-6 pb-10">
          <Btn
            fullWidth
            className="bg-white-custom text-primary hover:bg-white-custom/90 shadow-2xl"
            icon={<Check size={20} />}
            size="lg"
            onClick={completarSerie}
          >
            {esUltimaSerie && esUltimoEjercicio
              ? "Finalizar rutina"
              : `Serie ${serieActual} completada`}
          </Btn>
        </div>
      )}
    </MotionDiv>
  );
};

const CardRutina = ({
  rutina,
  onIniciar,
  onEliminar,
  expandida,
  onToggle,
}: {
  rutina: Rutina;
  onIniciar: () => void;
  onEliminar: () => void;
  expandida: boolean;
  onToggle: () => void;
}) => {
  const ejercicios = rutina.ejercicios ?? [];
  const totalSeries = ejercicios.reduce((a, e) => a + e.series, 0);
  const Icon = TAG_ICONS[rutina.tag] ?? Dumbbell;

  return (
    <div className="bg-white-custom border-[length:var(--border-width)] border-primary/10 rounded-[var(--radius-card)] overflow-hidden group">
      <div className="p-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2.5">
          {/* Icono */}
          <div className="w-8 h-8 rounded-[var(--radius-btn)] flex items-center justify-center shrink-0 bg-primary/8 text-primary/50">
            <Icon size={15} />
          </div>

          {/* Nombre + meta */}
          <div className="flex-1 min-w-0" title={rutina.descripcion}>
            <span className="text-sm font-black text-primary tracking-tight truncate leading-none block">
              {rutina.nombre}
            </span>
            <span className="text-micro font-bold text-primary/35 leading-none mt-0.5 block truncate">
              {rutina.tag} · {ejercicios.length} ejerc. · {totalSeries} series
            </span>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="w-6 h-6 flex items-center justify-center rounded text-primary/25 hover:text-accent hover:bg-accent/8 transition-all opacity-0 group-hover:opacity-100"
              title="Eliminar"
              onClick={(e) => {
                e.stopPropagation();
                onEliminar();
              }}
            >
              <X size={12} />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-btn)] bg-primary text-btn-text hover:opacity-90 transition-all shrink-0"
              title="Iniciar rutina"
              onClick={(e) => {
                e.stopPropagation();
                onIniciar();
              }}
            >
              <Play fill="currentColor" size={11} />
            </button>
            <MotionDiv
              animate={{ rotate: expandida ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="text-primary/30" size={14} />
            </MotionDiv>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expandida && (
          <MotionDiv
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3 border-t border-primary/5">
              <div className="pt-2.5 space-y-1.5">
                {ejercicios.map((ej, i) => (
                  <MotionDiv
                    key={ej.id}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 p-2 bg-primary/3 rounded-[var(--radius-btn)] border-[length:var(--border-width)] border-primary/5"
                    initial={{ opacity: 0, x: -8 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <span className="text-micro font-black text-primary/30 w-3.5 shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-micro font-black text-primary truncate leading-tight">
                        {ej.nombre}
                      </p>
                      <p className="text-micro font-bold text-primary/35 uppercase tracking-wide leading-tight">
                        {ej.musculo}
                      </p>
                    </div>
                    <span className="text-micro font-black text-primary/50 shrink-0">
                      {ej.series}×{ej.reps}
                    </span>
                    <span className="text-micro font-bold text-primary/25 shrink-0">
                      {ej.descanso}s
                    </span>
                  </MotionDiv>
                ))}
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};

const FormNuevaRutina = ({
  onGuardar,
  onCancelar,
  guardando,
}: {
  onGuardar: (
    datos: { nombre: string; descripcion: string; tag: string },
    ejercicios: Omit<Ejercicio, "id">[],
  ) => Promise<void>;
  onCancelar: () => void;
  guardando: boolean;
}) => {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tag, setTag] = useState("Fuerza");
  const [ejercicios, setEjercicios] = useState<Omit<Ejercicio, "id">[]>([]);
  const [nuevoEj, setNuevoEj] = useState({
    nombre: "",
    series: "3",
    reps: "10",
    descanso: "60",
    musculo: "",
  });
  const inputCls =
    "bg-white-custom border-[length:var(--border-width)] border-primary/10 rounded-[var(--radius-btn)] px-3 py-2 text-xs font-bold text-primary outline-none focus:border-primary/30 placeholder:text-primary/20";

  const addEjercicio = () => {
    if (!nuevoEj.nombre.trim()) return;
    setEjercicios((p) => [
      ...p,
      {
        nombre: nuevoEj.nombre,
        series: parseInt(nuevoEj.series) || 3,
        reps: nuevoEj.reps || "10",
        descanso: parseInt(nuevoEj.descanso) || 60,
        musculo: nuevoEj.musculo || "General",
        orden: p.length,
      },
    ]);
    setNuevoEj({
      nombre: "",
      series: "3",
      reps: "10",
      descanso: "60",
      musculo: "",
    });
  };

  return (
    <MotionDiv
      animate={{ opacity: 1, y: 0 }}
      className="bg-white-custom border-[length:var(--border-width)] border-primary/10 rounded-[var(--radius-card)] p-4 shadow-lg shadow-primary/5"
      initial={{ opacity: 0, y: 12 }}
    >
      <p className="text-micro font-black uppercase tracking-widest text-primary/40 mb-3">
        Nueva rutina
      </p>
      <div className="space-y-2 mb-3">
        <input
          className="w-full bg-primary/5 border-[length:var(--border-width)] border-transparent focus:border-primary/15 focus:bg-white-custom rounded-[var(--radius-btn)] py-2 px-3 text-sm font-bold text-primary outline-none placeholder:text-primary/25 transition-all"
          placeholder="Nombre de la rutina..."
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          className="w-full bg-primary/5 border-[length:var(--border-width)] border-transparent focus:border-primary/15 focus:bg-white-custom rounded-[var(--radius-btn)] py-2 px-3 text-sm font-bold text-primary outline-none placeholder:text-primary/25 transition-all"
          placeholder="Descripción..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <div className="flex gap-1.5 flex-wrap">
          {TAGS.filter((t) => t !== "Todas").map((t) => (
            <Badge key={t} active={tag === t} onClick={() => setTag(t)}>
              {t}
            </Badge>
          ))}
        </div>
      </div>
      {ejercicios.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {ejercicios.map((ej, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 bg-primary/4 rounded-[var(--radius-btn)]"
            >
              <span className="text-micro font-black text-primary/30 w-3.5 shrink-0">
                {i + 1}
              </span>
              <span className="text-micro font-black text-primary flex-1 truncate">
                {ej.nombre}
              </span>
              <span className="text-micro text-primary/40 font-bold shrink-0">
                {ej.series}×{ej.reps}
              </span>
              <button
                className="w-5 h-5 flex items-center justify-center rounded text-primary/30 hover:text-accent hover:bg-accent/8 transition-all shrink-0"
                onClick={() =>
                  setEjercicios((p) => p.filter((_, j) => j !== i))
                }
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="bg-primary/4 rounded-[var(--radius-btn)] p-3 mb-3 border-[length:var(--border-width)] border-primary/8">
        <p className="text-micro font-black uppercase tracking-widest text-primary/30 mb-2">
          Añadir ejercicio
        </p>
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <input
            className={`col-span-2 ${inputCls}`}
            placeholder="Nombre..."
            value={nuevoEj.nombre}
            onChange={(e) =>
              setNuevoEj((p) => ({ ...p, nombre: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && addEjercicio()}
          />
          <input
            className={inputCls}
            placeholder="Músculo..."
            value={nuevoEj.musculo}
            onChange={(e) =>
              setNuevoEj((p) => ({ ...p, musculo: e.target.value }))
            }
          />
          <input
            className={inputCls}
            placeholder="Series"
            type="number"
            value={nuevoEj.series}
            onChange={(e) =>
              setNuevoEj((p) => ({ ...p, series: e.target.value }))
            }
          />
          <input
            className={inputCls}
            placeholder="Reps (ej: 12 o 30s)"
            value={nuevoEj.reps}
            onChange={(e) =>
              setNuevoEj((p) => ({ ...p, reps: e.target.value }))
            }
          />
          <input
            className={inputCls}
            placeholder="Descanso (seg)"
            type="number"
            value={nuevoEj.descanso}
            onChange={(e) =>
              setNuevoEj((p) => ({ ...p, descanso: e.target.value }))
            }
          />
        </div>
        <Btn
          fullWidth
          disabled={!nuevoEj.nombre.trim()}
          size="sm"
          variant="ghost"
          onClick={addEjercicio}
        >
          + Añadir ejercicio
        </Btn>
      </div>
      <div className="flex gap-2">
        <Btn
          className="flex-1"
          disabled={guardando}
          size="sm"
          variant="outline"
          onClick={onCancelar}
        >
          Cancelar
        </Btn>
        <Btn
          className="flex-1"
          disabled={!nombre.trim() || ejercicios.length === 0 || guardando}
          loading={guardando}
          size="sm"
          onClick={() => onGuardar({ nombre, descripcion, tag }, ejercicios)}
        >
          Guardar rutina
        </Btn>
      </div>
    </MotionDiv>
  );
};

export const PaginaEjercicios = () => {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [cargando, setCargando] = useState(true);

  const fetchRutinas = useCallback(async () => {
    setCargando(true);
    try {
      const { supabase } = await import("@/lib/api/client/supabase");
      const { data, error } = await supabase
        .from("rutinas")
        .select("*, ejercicios(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRutinas(
        (data ?? []).map((r: any) => ({
          ...r,
          ejercicios: (r.ejercicios ?? []).sort(
            (a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0),
          ),
        })),
      );
    } catch (err) {
      console.error("[PaginaEjercicios] fetch:", err);
      setRutinas([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void fetchRutinas();
  }, [fetchRutinas]);

  const refetch = fetchRutinas;
  const [rutinaActiva, setRutinaActiva] = useState<Rutina | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [filtroTag, setFiltroTag] = useState("Todas");
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const rutinasFiltradas = useMemo(
    () =>
      filtroTag === "Todas"
        ? rutinas
        : rutinas.filter((r) => r.tag === filtroTag),
    [rutinas, filtroTag],
  );

  const handleGuardar = async (
    datos: { nombre: string; descripcion: string; tag: string },
    ejercicios: Omit<Ejercicio, "id">[],
  ) => {
    if (!datos.nombre.trim() || ejercicios.length === 0) return;
    setGuardando(true);
    try {
      const rutinaCreada = await rutinasQueries.add(datos);
      await ejerciciosQueries.reemplazar(
        rutinaCreada.id,
        ejercicios.map((e, i) => ({ ...e, orden: i })),
      );
      void refetch();
      setCreando(false);
    } catch (err) {
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    try {
      await rutinasQueries.delete(id);
      void refetch();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <AnimatePresence>
        {rutinaActiva && (
          <EjecutarRutina
            rutina={rutinaActiva}
            onCerrar={() => setRutinaActiva(null)}
          />
        )}
      </AnimatePresence>
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-white-custom border-[length:var(--border-width)] border-primary/10 rounded-[var(--radius-btn)] p-1 flex-wrap shadow-sm">
            {TAGS.map((t) => (
              <Badge
                key={t}
                active={filtroTag === t}
                onClick={() => setFiltroTag(t)}
              >
                {t}
              </Badge>
            ))}
          </div>
          <Btn
            className="ml-auto shrink-0"
            icon={creando ? <X size={11} /> : <Plus size={11} />}
            size="sm"
            onClick={() => setCreando((v) => !v)}
          >
            {creando ? "Cancelar" : "Añadir"}
          </Btn>
        </div>
        <AnimatePresence>
          {creando && (
            <FormNuevaRutina
              guardando={guardando}
              onCancelar={() => setCreando(false)}
              onGuardar={handleGuardar}
            />
          )}
        </AnimatePresence>
        {cargando ? (
          <Loading fullScreen={false} text="Cargando rutinas..." />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {rutinasFiltradas.map((rutina) => (
                <MotionDiv
                  key={rutina.id}
                  layout
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  initial={{ opacity: 0, y: 8 }}
                >
                  <CardRutina
                    expandida={expandida === rutina.id}
                    rutina={rutina}
                    onEliminar={() => handleEliminar(rutina.id)}
                    onIniciar={() => setRutinaActiva(rutina)}
                    onToggle={() =>
                      setExpandida(expandida === rutina.id ? null : rutina.id)
                    }
                  />
                </MotionDiv>
              ))}
            </AnimatePresence>
            {rutinasFiltradas.length === 0 && (
              <EmptyState
                label={
                  filtroTag === "Todas"
                    ? "Aún no tienes rutinas"
                    : `No hay rutinas de ${filtroTag}`
                }
              />
            )}
          </div>
        )}
      </div>
    </>
  );
};

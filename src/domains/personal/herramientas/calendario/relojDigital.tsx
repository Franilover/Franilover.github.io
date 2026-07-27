"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronUp, ChevronDown, CheckSquare, Circle } from "lucide-react";
import React, { useState, useEffect, useMemo, useRef } from "react";

import { MotionDiv } from "@/components/ui/Motion";

const PRESETS = [
  { label: "5m",   min: 5,  h: 0 },
  { label: "15m",  min: 15, h: 0 },
  { label: "25m",  min: 25, h: 0 },
  { label: "45m",  min: 45, h: 0 },
  { label: "1h",   min: 0,  h: 1 },
  { label: "1h30", min: 30, h: 1 },
  { label: "2h",   min: 0,  h: 2 },
];

const reproducirSonidoFin = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notas = [523, 659, 784, 1047];
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.18 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.4);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch (e) { console.warn("Audio no disponible", e); }
};

const pedirPermisoNotificaciones = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
};

const enviarNotificacion = (titulo: string, cuerpo?: string) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(titulo, {
    body: cuerpo,
    icon: "/icon-192.png", 
    silent: true,          
  });
};

const NumSpinner = ({
  value, min, max, onChange, label, disabled,
}: {
  value: number; min: number; max: number;
  onChange: (v: number) => void; label: string; disabled?: boolean;
}) => {
  const inc = () => !disabled && onChange(value >= max ? min : value + 1);
  const dec = () => !disabled && onChange(value <= min ? max : value - 1);
  const btnStyle = {
    color: "color-mix(in srgb, var(--menu-text) 40%, transparent)",
    transition: "color 0.15s",
  };
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="text-micro font-black uppercase tracking-widest mb-0.5"
        style={{ color: "color-mix(in srgb, var(--menu-text) 30%, transparent)" }}>
        {label}
      </span>
      <button disabled={disabled} style={btnStyle}
        onClick={inc}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--menu-text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "color-mix(in srgb, var(--menu-text) 40%, transparent)")}
      >
        <ChevronUp size={18} />
      </button>
      <span className="text-4xl font-black tabular-nums tracking-tighter w-14 text-center"
        style={{ color: "var(--menu-text)" }}>
        {String(value).padStart(2, "0")}
      </span>
      <button disabled={disabled} style={btnStyle}
        onClick={dec}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--menu-text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "color-mix(in srgb, var(--menu-text) 40%, transparent)")}
      >
        <ChevronDown size={18} />
      </button>
    </div>
  );
};

interface Props {
  horario: any[];
  tareas?: any[];
}

export const RelojDigital = ({ horario, tareas = [] }: Props) => {
  const [hora, setHora] = useState(new Date());

  
  const [pomHoras, setPomHoras]       = useState(0);
  const [pomMins, setPomMins]         = useState(25);
  const [pomSegundos, setPomSegundos] = useState(25 * 60);
  const [pomActivo, setPomActivo]     = useState(false);
  const [pomTerminado, setPomTerminado] = useState(false);
  const [pomPantallaCompleta, setPomPantallaCompleta] = useState(false);

  
  const [tareaSeleccionada, setTareaSeleccionada] = useState<any | null>(null);

  
  const tareaRef = useRef(tareaSeleccionada);
  useEffect(() => { tareaRef.current = tareaSeleccionada; }, [tareaSeleccionada]);

  const totalSegundosConfig = pomHoras * 3600 + pomMins * 60;

  
  useEffect(() => {
    void pedirPermisoNotificaciones();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pomActivo) return;
    const interval = setInterval(() => {
      setPomSegundos(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setPomActivo(false);
          setPomTerminado(true);
          reproducirSonidoFin();
          enviarNotificacion(
            "¡Pomodoro terminado!",
            tareaRef.current
              ? `Sesión de "${tareaRef.current.titulo}" completada`
              : "Sesión completada"
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomActivo]);

  const formatoHora = hora.toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });

  const actividadActual = useMemo(() => {
    if (!horario?.length) return null;
    const diaActual = hora.getDay();
    const ahoraStr  = hora.toLocaleTimeString("es-CL", { hour12: false });
    return horario.find(item =>
      item.dias_semana?.includes(diaActual) &&
      ahoraStr >= item.hora_inicio &&
      ahoraStr <= item.hora_fin
    );
  }, [hora, horario]);

  const seleccionarPreset = (h: number, m: number) => {
    if (pomActivo) return;
    setPomHoras(h); setPomMins(m);
    setPomSegundos(h * 3600 + m * 60);
    setPomTerminado(false);
  };

  const cambiarHoras = (h: number) => {
    if (pomActivo) return;
    setPomHoras(h);
    setPomSegundos(h * 3600 + pomMins * 60);
    setPomTerminado(false);
  };

  const cambiarMins = (m: number) => {
    if (pomActivo) return;
    setPomMins(m);
    setPomSegundos(pomHoras * 3600 + m * 60);
    setPomTerminado(false);
  };

  const togglePomodoro = () => {
    if (pomTerminado) {
      setPomSegundos(totalSegundosConfig);
      setPomTerminado(false);
    }
    setPomActivo(prev => !prev);
  };

  const resetPomodoro = () => {
    setPomActivo(false);
    setPomTerminado(false);
    setPomSegundos(totalSegundosConfig);
  };

  
  const hDisplay   = Math.floor(pomSegundos / 3600);
  const minDisplay = Math.floor((pomSegundos % 3600) / 60).toString().padStart(2, "0");
  const secDisplay = (pomSegundos % 60).toString().padStart(2, "0");
  const timerStr   = hDisplay > 0
    ? `${hDisplay}:${minDisplay}:${secDisplay}`
    : `${minDisplay}:${secDisplay}`;

  const pct = totalSegundosConfig > 0 ? 1 - pomSegundos / totalSegundosConfig : 0;

  
  const tareasPendientes = tareas.filter((t: any) => !t.completada);

  const styMuted = { color: "color-mix(in srgb, var(--menu-text) 30%, transparent)" };
  const styBorder = { border: "1px solid color-mix(in srgb, var(--menu-text) 12%, transparent)" };

  return (
    <div className="relative z-10 shrink-0">

      {/* Trigger compacto — sin borde/sombra propios, vive dentro del bloque padre */}
      <MotionDiv
        layout
        className="flex flex-col items-center gap-1 px-4 py-4 cursor-pointer hover:bg-primary/3 transition-all select-none"
        onClick={() => setPomPantallaCompleta(true)}
      >
        {/* Hora grande */}
        <span className="text-2xl font-black tracking-tighter tabular-nums text-primary leading-none">
          {formatoHora}
        </span>
        {/* Actividad */}
        <span className="text-micro font-black uppercase tracking-widest text-primary/30 text-center leading-tight">
          {actividadActual ? actividadActual.actividad : "Tiempo libre"}
        </span>
        {/* Indicador pomodoro */}
        <span className="text-micro font-black uppercase tracking-widest text-primary/20 mt-0.5">
          ↗ Pomodoro
        </span>
      </MotionDiv>

      {}
      <AnimatePresence>
        {pomPantallaCompleta && (
          <MotionDiv
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[9999] overflow-hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{ backgroundColor: "var(--bg-menu)", color: "var(--menu-text)" }}
            transition={{ duration: 0.25 }}
          >
            {}
            <div className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: "1px solid color-mix(in srgb, var(--menu-text) 8%, transparent)" }}
            >
              <span className="text-sm font-black tabular-nums tracking-tighter italic" style={styMuted}>
                {formatoHora}
              </span>
              {tareaSeleccionada && (
                <span className="text-micro font-black uppercase tracking-widest truncate max-w-xs px-4"
                  style={{ color: "var(--menu-text)" }}>
                  ▶ {tareaSeleccionada.titulo}
                </span>
              )}
              {}
              <button
                className="flex items-center gap-2 text-micro font-black uppercase tracking-widest px-3 py-2 rounded-[var(--radius-btn)] transition-all"
                style={styBorder}
                onClick={() => setPomPantallaCompleta(false)}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "color-mix(in srgb, var(--menu-text) 10%, transparent)";
                  e.currentTarget.style.color = "var(--menu-text)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "color-mix(in srgb, var(--menu-text) 50%, transparent)";
                }}
              >
                <X size={14} /> Salir
              </button>
            </div>

            {}
            <div className="flex h-[calc(100%-57px)]">

              {}
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">

                {}
                <div
                  className="relative cursor-pointer"
                  style={{ width: "min(45vw, 320px)", height: "min(45vw, 320px)" }}
                  onClick={togglePomodoro}
                >
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" fill="none" opacity="0.08"
                      r="88" stroke="var(--menu-text)" strokeWidth="5" />
                    <motion.circle
                      cx="100" cy="100" fill="none" opacity={pomTerminado ? 0 : 0.85}
                      r="88" stroke="var(--menu-text)"
                      strokeDasharray={2 * Math.PI * 88}
                      strokeDashoffset={2 * Math.PI * 88 * (1 - pct)}
                      strokeLinecap="round"
                      strokeWidth="5"
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                    {pomTerminado && (
                      <circle cx="100" cy="100" fill="none" opacity="0.9"
                        r="88" stroke="#34d399" strokeWidth="5" />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    {pomTerminado ? (
                      <>
                        <span className="text-3xl font-black text-emerald-400 uppercase tracking-tight">¡Listo!</span>
                        <span className="text-micro font-black uppercase tracking-widest" style={styMuted}>
                          Sesión completada
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-black tabular-nums tracking-tighter leading-none italic"
                          style={{ fontSize: "min(12vw, 72px)", color: "var(--menu-text)" }}>
                          {timerStr}
                        </span>
                        <span className="text-micro font-black uppercase tracking-[0.3em]" style={styMuted}>
                          {pomActivo ? "concentrado" : "en pausa"}
                        </span>
                        {tareaSeleccionada && (
                          <span className="text-micro font-black uppercase tracking-tight mt-1 px-3 py-1 rounded-full"
                            style={{
                              background: "color-mix(in srgb, var(--menu-text) 8%, transparent)",
                              color: "color-mix(in srgb, var(--menu-text) 60%, transparent)",
                              maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                            {tareaSeleccionada.titulo}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {}
                <div className="flex items-end gap-3">
                  <NumSpinner disabled={pomActivo} label="Horas" max={9}
                    min={0} value={pomHoras} onChange={cambiarHoras} />
                  <span className="text-3xl font-black mb-3" style={styMuted}>:</span>
                  <NumSpinner disabled={pomActivo} label="Minutos" max={59}
                    min={0} value={pomMins} onChange={cambiarMins} />
                </div>

                {}
                <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
                  {PRESETS.map(p => {
                    const activo = pomHoras === p.h && pomMins === p.min;
                    return (
                      <button key={p.label}
                        className="text-micro font-black uppercase tracking-wide px-3 py-1.5 rounded-[var(--radius-btn)] transition-all disabled:opacity-40"
                        disabled={pomActivo}
                        style={activo ? {
                          background: "color-mix(in srgb, var(--menu-text) 14%, transparent)",
                          color: "var(--menu-text)",
                          border: "1px solid color-mix(in srgb, var(--menu-text) 28%, transparent)",
                        } : {
                          color: "color-mix(in srgb, var(--menu-text) 35%, transparent)",
                          border: "1px solid transparent",
                        }}
                        onClick={() => seleccionarPreset(p.h, p.min)}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {}
                <div className="flex items-center gap-3">
                  <button
                    className="font-black uppercase tracking-widest px-10 py-3 rounded-[var(--radius-btn)] transition-all text-sm hover:scale-105 active:scale-95 disabled:opacity-30"
                    disabled={totalSegundosConfig === 0 && !pomActivo}
                    style={pomActivo ? {
                      background: "color-mix(in srgb, var(--menu-text) 10%, transparent)",
                      color: "var(--menu-text)",
                      border: "1px solid color-mix(in srgb, var(--menu-text) 20%, transparent)",
                    } : {
                      background: "var(--primary)",
                      color: "var(--btn-text)",
                      boxShadow: "0 8px 30px color-mix(in srgb, var(--primary) 35%, transparent)",
                    }}
                    onClick={togglePomodoro}
                  >
                    {pomTerminado ? "Reiniciar" : pomActivo ? "Pausar" : "Iniciar"}
                  </button>
                  {(pomActivo || pomSegundos !== totalSegundosConfig) && !pomTerminado && (
                    <button
                      className="text-micro font-black uppercase tracking-widest px-4 py-3 rounded-[var(--radius-btn)] transition-all"
                      style={{
                        color: "color-mix(in srgb, var(--menu-text) 30%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--menu-text) 10%, transparent)",
                      }}
                      onClick={resetPomodoro}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--menu-text)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "color-mix(in srgb, var(--menu-text) 30%, transparent)")}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {}
              <div className="w-px shrink-0 my-8"
                style={{ background: "color-mix(in srgb, var(--menu-text) 8%, transparent)" }} />

              {}
              <div className="w-72 xl:w-80 flex flex-col px-6 py-6 gap-4 overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                  <CheckSquare size={14} style={styMuted} />
                  <span className="text-micro font-black uppercase tracking-widest" style={styMuted}>
                    Enfocar en tarea
                  </span>
                </div>

                {}
                {!tareaSeleccionada ? (
                  <p className="text-micro italic" style={{ color: "color-mix(in srgb, var(--menu-text) 20%, transparent)" }}>
                    Selecciona una tarea para dedicarle este pomodoro.
                  </p>
                ) : (
                  <div className="flex items-start gap-2 p-3 rounded-[var(--radius-btn)]"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                    }}>
                    <span className="text-micro font-black uppercase tracking-tight flex-1"
                      style={{ color: "var(--menu-text)" }}>
                      {tareaSeleccionada.titulo}
                    </span>
                    <button onClick={() => setTareaSeleccionada(null)}>
                      <X size={12} style={styMuted} />
                    </button>
                  </div>
                )}

                {}
                <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                  {tareasPendientes.length === 0 ? (
                    <p className="text-micro italic" style={{ color: "color-mix(in srgb, var(--menu-text) 20%, transparent)" }}>
                      Sin tareas pendientes.
                    </p>
                  ) : tareasPendientes.map((t: any) => {
                    const seleccionada = tareaSeleccionada?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-btn)] text-left transition-all"
                        style={seleccionada ? {
                          background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                        } : {
                          background: "color-mix(in srgb, var(--menu-text) 4%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--menu-text) 8%, transparent)",
                        }}
                        onClick={() => setTareaSeleccionada(seleccionada ? null : t)}
                        onMouseEnter={e => !seleccionada && (e.currentTarget.style.background = "color-mix(in srgb, var(--menu-text) 8%, transparent)")}
                        onMouseLeave={e => !seleccionada && (e.currentTarget.style.background = "color-mix(in srgb, var(--menu-text) 4%, transparent)")}
                      >
                        <Circle size={10} style={{ color: seleccionada ? "var(--primary)" : "color-mix(in srgb, var(--menu-text) 25%, transparent)", flexShrink: 0 }} />
                        <span className="text-micro font-bold uppercase tracking-tight truncate"
                          style={{ color: seleccionada ? "var(--menu-text)" : "color-mix(in srgb, var(--menu-text) 55%, transparent)" }}>
                          {t.titulo}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};
"use client";

/**
 * Aventura (público)
 * ───────────────────────────────────────────────────────────────────────────
 * /garlia/aventura — el jugador primero ve una lista de aventuras
 * existentes (ej "El Bosque Sombrío"), elige una, y entra a su feed: solo
 * las entidades que el DM haya marcado como publicadas dentro de ESA
 * aventura, más reciente primero. Realtime: al publicar algo en admin,
 * este feed se actualiza solo.
 */

import { AnimatePresence } from "framer-motion";
import { ArrowLeft, BedDouble, Check, Loader2, Maximize2, MoreVertical, Plus, Sparkles, Swords, Trash2, X } from "lucide-react";
import React, { useState } from "react";

import { MotionDiv } from "@/ui/Motion";
import { Text } from "@/ui/Tipografia";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/infra/supabase/supabase";

import {
  TABLERO_CARD_SIZE,
  TABLERO_TOKEN_SIZE,
  TableroAventura,
  type TableroItem,
} from "@/domains/garlia/aventuras/TableroAventura";
import { celdasBloqueadas, GRID_SIZE } from "@/domains/garlia/aventuras/visionUtils";
import {
  TABLA_LABEL,
  useAventuraEntidades,
  useAventuraExploracion,
  useAventuraObstaculos,
  useAventurasList,
  type Aventura as AventuraType,
  type AventuraEntidad,
} from "@/domains/garlia/aventuras/useAventuras";
import { useFichasDnd, type CampoFichaValor, type FichaDnd, type NuevaFicha } from "./useFichasDnd";
import { CARD_SCALE_MAX, CARD_SCALE_MIN, useTableroEscala } from "./useTableroEscala";
import { FichaStatsPanel, TiradaDados } from "./misiones";

// Valores por defecto para una ficha recién creada: se crea directo (sin
// modal) y el jugador la termina de completar editando en el panel lateral.
const FICHA_DEFAULT: NuevaFicha = {
  nombre: "Nuevo aventurero",
  clase: null,
  raza: null,
  alineamiento: null,
  nivel: 1,
  fuerza: 10,
  destreza: 10,
  constitucion: 10,
  inteligencia: 10,
  sabiduria: 10,
  carisma: 10,
  hp_max: 10,
  hp_actual: 10,
  ca: 10,
  velocidad: 30,
};

function formatFecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

export default function Aventura() {
  const [aventuraId, setAventuraId] = useState<string | null>(null);

  // ── Tema forzado: /garlia/aventura siempre se ve con el tema "Antiguo"
  // (sepia), sin importar qué tema tenga elegido el usuario en el resto de
  // la app — encaja mejor con el ambiente de mesa de rol. Al salir de esta
  // página se restaura el tema que tenía antes de entrar. No se persiste
  // como preferencia nueva (no es "cambiar el tema", es "mientras estás
  // acá se ve así"): el valor original queda guardado solo en un ref de
  // este componente. ──
  const { theme, setTheme } = useTheme();
  const temaAnteriorRef = React.useRef<typeof theme | null>(null);
  React.useEffect(() => {
    temaAnteriorRef.current = theme;
    setTheme("sepia");
    return () => {
      if (temaAnteriorRef.current) setTheme(temaAnteriorRef.current);
    };
    // Solo se ejecuta al montar/desmontar la página — no queremos que un
    // cambio posterior de `theme` (ej. si algo más lo modifica mientras
    // estamos acá) dispare este efecto de nuevo y pise el valor a
    // restaurar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative flex flex-col p-4 md:p-8 gap-6"
      style={{ minHeight: "calc(100svh - 64px)" }}
    >
      {/* ── Dos columnas: 70% contenido (selector o feed, con scroll propio) /
          30% identidad activa (fija, con su propio scroll interno) — el
          panel de identidad solo aparece una vez adentro de una aventura,
          no en el selector. En mobile (flex-col) va primero arriba del
          feed; en desktop vuelve a la derecha con order-none.
          items-start (no stretch): así la columna de identidad no se
          fuerza a la altura de la fila — FichaStatsPanel maneja su propio
          sticky + scroll interno (ver misiones.tsx), independiente de la
          página y del feed. ── */}
      <div className="flex-1 w-full flex flex-col md:flex-row gap-6 items-start min-h-0 md:h-[calc(100svh-140px)]">
        <div
          className={`w-full flex flex-col gap-6 overflow-y-auto order-2 md:order-none md:h-full ${
            aventuraId ? "md:w-[70%]" : ""
          }`}
        >
          {aventuraId ? (
            <AventuraFeed aventuraId={aventuraId} onVolver={() => setAventuraId(null)} />
          ) : (
            <SelectorAventuras onSeleccionar={setAventuraId} />
          )}
        </div>

        {aventuraId && (
          <div className="w-full md:w-[30%] shrink-0 flex flex-col gap-3 order-1 md:order-none">
            <PanelIdentidad />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panel de identidad: ficha activa (con menú de tres puntos para
// cambiar/crear/editar identidades) + botón de Misiones debajo ──────────────

function PanelIdentidad() {
  const { perfil, isAdmin } = useAuth();
  const { fichas, activa, loading, crear, actualizar, eliminar, elegirActiva, descansarLargo, refetch } =
    useFichasDnd(perfil?.id ?? null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [descansando, setDescansando] = useState(false);
  // En /aventura la ficha siempre es editable por defecto (sin botón lápiz/check).
  const editando = true;
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  if (!perfil || loading) return null;

  // Crea la ficha directo con valores por defecto (sin modal); queda
  // editable de inmediato en el panel lateral.
  const handleCrearFicha = async () => {
    setCreando(true);
    try {
      await crear(FICHA_DEFAULT);
    } finally {
      setCreando(false);
    }
  };

  // Sin identidades todavía: tarjeta simple invitando a crear una.
  if (fichas.length === 0) {
    return (
      <div
        className="p-5 text-center"
        style={{
          background: "var(--white-custom)",
          borderRadius: "var(--radius-card)",
          border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
        }}
      >
        <Swords size={18} className="mx-auto mb-2 text-primary/20" />
        <p className="text-micro font-black uppercase tracking-wider text-primary/40 mb-3">
          Todavía no tenés ninguna identidad
        </p>
        <button
          type="button"
          onClick={handleCrearFicha}
          disabled={creando}
          className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full border transition-colors disabled:opacity-50"
          style={{
            background: "var(--primary)",
            borderColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
          }}
        >
          {creando ? (
            <Loader2 size={12} className="animate-spin" style={{ color: "var(--btn-text)" }} />
          ) : (
            <Plus size={12} style={{ color: "var(--btn-text)" }} />
          )}
          <span className="text-xs font-bold" style={{ color: "var(--btn-text)" }}>
            Crear ficha
          </span>
        </button>
      </div>
    );
  }

  const handleEditarCampo = async (
    campo: keyof FichaDnd,
    valor: CampoFichaValor,
  ) => {
    if (!activa) return;
    setGuardando(true);
    try {
      await actualizar(activa.id, { [campo]: valor } as Partial<FichaDnd>);
    } finally {
      setGuardando(false);
    }
  };

  // El dueño puede tocar stats de combate SOLO mientras la ficha no esté
  // confirmada (recién creada, todavía armándola). Admin siempre puede.
  const puedeEditarStats = activa
    ? isAdmin || !activa.stats_confirmadas
    : false;

  return (
    <>
      {activa && (
        <FichaStatsPanel
          ficha={activa}
          editable={editando}
          editableStats={puedeEditarStats}
          editableCondiciones={false}
          mostrarCondiciones={false}
          onEditarCampo={handleEditarCampo}
          onFichaActualizada={refetch}
          headerAction={
            <div className="relative flex items-center gap-1">
              {guardando && (
                <Loader2 size={12} className="animate-spin text-primary/30" />
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!activa || descansando) return;
                  if (
                    !confirm(
                      `¿Descanso largo de ${activa.nombre}? Recupera HP, dados de golpe y espacios de conjuro al máximo, y baja el agotamiento en 1.`,
                    )
                  ) {
                    return;
                  }
                  setDescansando(true);
                  try {
                    await descansarLargo(activa.id);
                  } finally {
                    setDescansando(false);
                  }
                }}
                disabled={!activa || descansando}
                className="p-1 rounded-full text-primary/30 hover:bg-primary/10 hover:text-primary/70 transition-colors disabled:opacity-50"
                title="Descanso largo: recupera HP, dados de golpe, espacios de conjuro y -1 agotamiento"
              >
                {descansando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <BedDouble size={16} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMenuAbierto((v) => !v)}
                className="p-1 rounded-full text-primary/30 hover:bg-primary/10 hover:text-primary/70 transition-colors"
                title="Cambiar o crear identidad"
              >
                <MoreVertical size={16} />
              </button>

              <AnimatePresence>
                {menuAbierto && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(false)} />
                    <MotionDiv
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-xl border overflow-hidden shadow-lg"
                      exit={{ opacity: 0, y: -6 }}
                      initial={{ opacity: 0, y: -6 }}
                      style={{
                        background: "var(--white-custom)",
                        borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
                      }}
                    >
                      {fichas.map((f) => (
                        <div
                          key={f.id}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-primary/5 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!f.activa) elegirActiva(f.id);
                              setMenuAbierto(false);
                            }}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <div className="w-6 h-6 shrink-0 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                              {f.imagen_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={f.imagen_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Swords size={11} className="text-primary/40" />
                              )}
                            </div>
                            <span className="flex-1 min-w-0 text-xs text-primary/80 truncate">
                              {f.nombre}
                            </span>
                            {f.activa && <Check size={13} className="text-primary shrink-0" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`¿Eliminar a ${f.nombre}? Esto no se puede deshacer.`)) {
                                eliminar(f.id);
                              }
                              setMenuAbierto(false);
                            }}
                            className="shrink-0 p-1 rounded-full text-primary/30 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title="Eliminar ficha"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={async () => {
                          setMenuAbierto(false);
                          await handleCrearFicha();
                        }}
                        disabled={creando}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-primary/5 transition-colors disabled:opacity-50"
                        style={{
                          borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                        }}
                      >
                        <div className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center bg-primary/5">
                          {creando ? (
                            <Loader2 size={12} className="animate-spin text-primary/50" />
                          ) : (
                            <Plus size={12} className="text-primary/50" />
                          )}
                        </div>
                        <span className="flex-1 text-xs font-bold text-primary/60">Nueva ficha</span>
                      </button>
                    </MotionDiv>
                  </>
                )}
              </AnimatePresence>
            </div>
          }
        />
      )}

    </>
  );
}

// ── Selector de aventuras ────────────────────────────────────────────────

function SelectorAventuras({ onSeleccionar }: { onSeleccionar: (id: string) => void }) {
  const { aventuras, loading } = useAventurasList();

  return (
    <>
      <MotionDiv
        animate={{ opacity: 1, y: 0 }}
        className="text-center shrink-0"
        initial={{ opacity: 0, y: -20 }}
      >
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-primary italic">
          Aventuras
        </h1>
      </MotionDiv>

      <div className="flex-1 max-w-3xl w-full mx-auto">
        {loading && aventuras.length === 0 ? (
          <div className="py-24 flex items-center justify-center text-primary/30">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : aventuras.length === 0 ? (
          <div className="py-24 text-center">
            <Sparkles className="mx-auto mb-3 text-primary/20" size={28} />
            <Text as="p" variant="md" className="text-primary/40">
              Todavía no hay ninguna aventura creada. Vuelve pronto.
            </Text>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {aventuras.map((a, i) => (
              <MotionDiv
                key={a.id}
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 12 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
              >
                <button
                  type="button"
                  onClick={() => onSeleccionar(a.id)}
                  className="group w-full flex flex-col text-left p-5 rounded-2xl border transition-all"
                  style={{
                    background: "var(--white-custom)",
                    borderColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "color-mix(in srgb, var(--primary) 28%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "color-mix(in srgb, var(--primary) 10%, transparent)";
                  }}
                >
                  <h3 className="font-serif italic text-xl text-primary mb-1">{a.nombre}</h3>
                  {a.descripcion && (
                    <p className="text-xs text-primary/50 line-clamp-2">{a.descripcion}</p>
                  )}
                </button>
              </MotionDiv>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Feed de una aventura ─────────────────────────────────────────────────

/** Distancia (en las mismas unidades lógicas que pos_x/pos_y, sin zoom)
 *  por debajo de la cual se considera que el jugador movió su ficha
 *  "hasta" una criatura — dispara el modo combate. Se calcula sumando
 *  medio token del jugador + media tarjeta de criatura + un margen, así
 *  no hace falta llegar pixel-perfecto encima. */
const UMBRAL_COMBATE =
  TABLERO_TOKEN_SIZE / 2 + TABLERO_CARD_SIZE.height / 2 + 40;

function distancia(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

// ── Pantalla de combate ──────────────────────────────────────────────────
// Reemplaza el feed/pizarrón normal mientras `enCombate` está activo: cara
// a cara entre la ficha del jugador y la criatura que gatilló el combate,
// más los dados a mano para resolver tiradas. Salir vuelve al pizarrón tal
// como estaba (las posiciones no se tocan).

function BarraVida({ actual, max }: { actual: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (actual / max) * 100)) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-micro font-black uppercase tracking-widest text-primary/35">HP</span>
        <span className="text-micro font-bold text-primary/50 tabular-nums">
          {actual}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct > 50 ? "#22c55e" : pct > 20 ? "#f59e0b" : "#ef4444",
          }}
        />
      </div>
    </div>
  );
}

function LadoCombate({
  imagen,
  nombre,
  subtitulo,
  children,
}: {
  imagen: string | null;
  nombre: string;
  subtitulo?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl"
      style={{
        background: "var(--white-custom)",
        border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
      }}
    >
      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-primary/5 relative shrink-0">
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt={nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Swords size={22} className="text-primary/15" />
          </div>
        )}
      </div>
      <div className="text-center">
        {subtitulo && (
          <span className="block text-micro font-black uppercase tracking-widest text-primary/35">
            {subtitulo}
          </span>
        )}
        <h3 className="font-serif italic text-xl text-primary">{nombre}</h3>
      </div>
      {children && <div className="w-full mt-1">{children}</div>}
    </div>
  );
}

/** Tarjeta compacta de un rival dentro de la horda: mismo contenido que
 *  LadoCombate pero pensada para caber varias en fila/grid cuando el
 *  combate es contra un grupo entero. */
function TarjetaRival({ rival }: { rival: AventuraEntidad }) {
  return (
    <div
      className="flex flex-col items-center gap-2 p-3 rounded-xl"
      style={{
        background: "var(--white-custom)",
        border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
      }}
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-primary/5 relative shrink-0">
        {rival.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rival.imagen_url} alt={rival.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Swords size={16} className="text-primary/15" />
          </div>
        )}
      </div>
      <div className="text-center">
        <h4 className="font-serif italic text-sm text-primary leading-tight">{rival.nombre}</h4>
        {(rival.stats_dnd?.tamano || rival.stats_dnd?.tipo) && (
          <span className="block text-micro text-primary/35">
            {[rival.stats_dnd?.tamano, rival.stats_dnd?.tipo].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      {rival.stats_dnd?.hp_max != null ? (
        <div className="w-full flex flex-col gap-1">
          <BarraVida actual={rival.stats_dnd.hp_max} max={rival.stats_dnd.hp_max} />
          <div className="flex items-center justify-center gap-2 text-micro font-bold text-primary/50">
            {rival.stats_dnd.ca != null && <span>CA {rival.stats_dnd.ca}</span>}
            {rival.stats_dnd.rc && (
              <>
                <span>·</span>
                <span>RC {rival.stats_dnd.rc}</span>
              </>
            )}
          </div>
        </div>
      ) : rival.descripcion ? (
        <p className="text-micro text-primary/60 text-center leading-relaxed line-clamp-3">
          {rival.descripcion}
        </p>
      ) : (
        <p className="text-micro text-primary/30 italic text-center">Sin descripción todavía.</p>
      )}
    </div>
  );
}

function PantallaCombate({
  ficha,
  rivales,
  onSalir,
}: {
  ficha: FichaDnd | null;
  rivales: AventuraEntidad[];
  onSalir: () => void;
}) {
  const esGrupo = rivales.length > 1;
  const nombreGrupo = esGrupo ? rivales[0]?.grupo_nombre : null;

  return (
    <MotionDiv
      animate={{ opacity: 1 }}
      className="flex-1 w-full flex flex-col gap-6"
      initial={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSalir}
          className="flex items-center gap-1.5 text-xs font-bold text-primary/40 hover:text-primary/70 transition-colors"
        >
          <ArrowLeft size={14} />
          Salir de combate
        </button>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "var(--primary)" }}>
          <Swords size={12} style={{ color: "var(--btn-text)" }} />
          <span className="text-micro font-black uppercase tracking-widest" style={{ color: "var(--btn-text)" }}>
            {esGrupo && nombreGrupo ? nombreGrupo : "Combate"}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-3">
        <LadoCombate
          imagen={ficha?.imagen_url ?? null}
          nombre={ficha?.nombre ?? "Tu personaje"}
          subtitulo={[ficha?.clase, ficha?.nivel ? `Nivel ${ficha.nivel}` : null].filter(Boolean).join(" · ") || undefined}
        >
          {ficha && (
            <div className="flex flex-col gap-2">
              <BarraVida actual={ficha.hp_actual} max={ficha.hp_max} />
              <div className="flex items-center justify-center gap-3 text-micro font-bold text-primary/50">
                <span>CA {ficha.ca}</span>
                <span>·</span>
                <span>{ficha.velocidad} ft</span>
              </div>
            </div>
          )}
        </LadoCombate>

        <div className="flex md:flex-col items-center justify-center shrink-0 py-2">
          <span className="font-serif italic text-2xl text-primary/25">VS</span>
        </div>

        {/* ── Rival único: mismo bloque grande de siempre. Grupo/horda: grid
            de tarjetas compactas, una por cada criatura del grupo — así el
            jugador ve a toda la horda de un vistazo. ── */}
        {esGrupo ? (
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
            {rivales.map((r) => (
              <TarjetaRival key={r.id} rival={r} />
            ))}
          </div>
        ) : (
          rivales[0] && (
            <LadoCombate
              imagen={rivales[0].imagen_url}
              nombre={rivales[0].nombre}
              subtitulo={
                [
                  rivales[0].stats_dnd?.tamano,
                  rivales[0].stats_dnd?.tipo ?? TABLA_LABEL[rivales[0].tabla].singular,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            >
              {rivales[0].stats_dnd?.hp_max != null ? (
                <div className="flex flex-col gap-2">
                  <BarraVida actual={rivales[0].stats_dnd.hp_max} max={rivales[0].stats_dnd.hp_max} />
                  <div className="flex items-center justify-center gap-3 text-micro font-bold text-primary/50">
                    {rivales[0].stats_dnd.ca != null && <span>CA {rivales[0].stats_dnd.ca}</span>}
                    {rivales[0].stats_dnd.rc && (
                      <>
                        <span>·</span>
                        <span>RC {rivales[0].stats_dnd.rc}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : rivales[0].descripcion ? (
                <p className="text-xs text-primary/60 text-center leading-relaxed line-clamp-4">
                  {rivales[0].descripcion}
                </p>
              ) : (
                <p className="text-xs text-primary/30 italic text-center">Sin descripción todavía.</p>
              )}
            </LadoCombate>
          )
        )}
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-xs">
          <TiradaDados />
        </div>
      </div>
    </MotionDiv>
  );
}

function AventuraFeed({ aventuraId, onVolver }: { aventuraId: string; onVolver: () => void }) {
  const { perfil } = useAuth();
  const { aventuras } = useAventurasList();
  const { entidades, loading, agregar, moverPosicion } = useAventuraEntidades(aventuraId);
  const { obstaculos } = useAventuraObstaculos(aventuraId);
  const { activa: fichaActiva } = useFichasDnd(perfil?.id ?? null);
  const aventura = aventuras.find((a) => a.id === aventuraId) as AventuraType | undefined;
  const [seleccion, setSeleccion] = useState<AventuraEntidad | null>(null);
  const [fichaSeleccion, setFichaSeleccion] = useState<FichaDnd | null>(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const { escala, actualizar: actualizarEscala } = useTableroEscala(aventuraId);

  // ── Al seleccionar una entidad tipo "fichas_dnd" (el token de otro
  // jugador), se trae la ficha completa para mostrar sus stats reales
  // (no solo nombre/descripción, que es lo único que resuelve
  // useAventuraEntidades). Solo lectura acá — el jugador no puede editar
  // la ficha de otro. ──
  React.useEffect(() => {
    if (!seleccion || seleccion.tabla !== "fichas_dnd") {
      setFichaSeleccion(null);
      return;
    }
    let cancelado = false;
    setCargandoFicha(true);
    supabase
      .from("fichas_dnd")
      .select("*")
      .eq("id", seleccion.entidad_id)
      .single()
      .then(({ data, error }) => {
        if (cancelado) return;
        setFichaSeleccion(!error && data ? (data as FichaDnd) : null);
        setCargandoFicha(false);
      });
    return () => {
      cancelado = true;
    };
  }, [seleccion]);

  const publicadas = entidades
    .filter((e) => e.publicado)
    .sort((a, b) => {
      const ta = a.publicado_at ? new Date(a.publicado_at).getTime() : 0;
      const tb = b.publicado_at ? new Date(b.publicado_at).getTime() : 0;
      return tb - ta;
    });

  // ── Ficha propia en el tablero: a diferencia de antes, NO se agrega
  // sola — recién existe la fila en aventura_entidades después de que el
  // jugador confirme "Unirme" (ver modal más abajo). Así el pizarrón del
  // DM no se llena de fichas de cuentas de prueba que solo entraron a
  // mirar la aventura sin jugarla. ──
  const relacionPropia = entidades.find(
    (e) => e.tabla === "fichas_dnd" && e.entidad_id === fichaActiva?.id,
  );
  // ── Niebla de guerra: solo aplica si el DM la activó Y el jugador ya
  // tiene un token propio en el pizarrón (sin token no hay desde dónde
  // calcular line-of-sight). El DM (AventuraSection) nunca pasa esto —
  // siempre ve todo el tablero completo. ──
  const { celdasVistas, registrarVisibles } = useAventuraExploracion(
    aventuraId,
    fichaActiva?.id ?? null,
  );
  const [pidiendoUnion, setPidiendoUnion] = useState(false);
  const [uniendose, setUniendose] = useState(false);
  // ── Modo combate: se activa solo cuando el jugador clickea el tablero
  // para mover su ficha y el destino queda cerca de una criatura
  // publicada. Se guardan solo los IDs (no una copia de los objetos): así,
  // si el DM edita la ficha de combate de alguna mientras el jugador ya
  // está en pantalla de combate, `rivalesCombate` de abajo se recalcula
  // con el dato fresco de `entidades` en cada render — no queda una foto
  // vieja. Si la criatura que gatilló el combate pertenece a un grupo/
  // horda (grupo_nombre), se suman automáticamente todas las demás
  // criaturas publicadas de ese mismo grupo como rivales adicionales — el
  // jugador ve a toda la horda, no solo a la que tocó. Se puede salir
  // manualmente con "Salir de combate".
  const [enCombate, setEnCombate] = useState(false);
  const [rivalesCombateIds, setRivalesCombateIds] = useState<string[]>([]);
  const rivalesCombate = rivalesCombateIds
    .map((id) => entidades.find((e) => e.id === id))
    .filter((e): e is AventuraEntidad => Boolean(e));
  // Solo se ofrece unirse una vez por sesión de este componente (si el
  // jugador cierra el modal sin confirmar, no se lo vuelve a interrumpir
  // hasta que salga y vuelva a entrar a la aventura).
  const [unionDescartada, setUnionDescartada] = useState(false);

  React.useEffect(() => {
    if (fichaActiva && !relacionPropia && !loading && !unionDescartada) {
      setPidiendoUnion(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaActiva?.id, loading, unionDescartada]);

  const handleUnirse = async () => {
    if (!fichaActiva) return;
    setUniendose(true);
    try {
      await agregar("fichas_dnd", fichaActiva.id);
      setPidiendoUnion(false);
    } finally {
      setUniendose(false);
    }
  };

  // Activa el modo combate contra una criatura puntual. Si pertenece a un
  // grupo/horda (grupo_nombre), se entra en combate contra TODAS las
  // criaturas publicadas de ese mismo grupo, no solo la que gatilló — así
  // el jugador ve a toda la horda de una. Se usa tanto desde el click
  // directo sobre la tarjeta de la criatura como desde el click en el
  // pizarrón que acerca la ficha propia a una criatura.
  const entrarEnCombateContra = (criatura: AventuraEntidad) => {
    setEnCombate(true);
    const idsGrupo = criatura.grupo_nombre
      ? publicadas
          .filter((e) => e.tabla === "criaturas" && e.grupo_nombre === criatura.grupo_nombre)
          .map((e) => e.id)
      : [criatura.id];
    setRivalesCombateIds(idsGrupo);
  };

  // ── Movimiento de una sola celda por vez ────────────────────────────────
  // Antes se podía clickear cualquier punto del pizarrón y la ficha viajaba
  // ahí (con pathfinding esquivando obstáculos). Ahora el jugador solo se
  // puede mover una celda de grilla a la vez: con WASD, o clickeando una de
  // las 8 celdas adyacentes al token propio. `moverUnaCelda` es la única
  // puerta de entrada a ambos casos — valida que la celda destino no esté
  // bloqueada por un obstáculo antes de mover.
  // Se guarda la posición "creída" del jugador en un ref, no solo en el
  // estado — así, si se presiona una segunda tecla antes de que React
  // termine de re-renderizar con la posición del primer paso (algo muy
  // común con WASD mantenido, ya que el teclado dispara eventos mucho más
  // rápido que un ciclo de render+efecto), el segundo paso se calcula
  // desde la posición correcta y no desde una vieja. Antes esto hacía que
  // el segundo/tercer paso se "perdiera" o se recalculara mal, y cuando el
  // fetch de la posición real llegaba de vuelta, la ficha pegaba un salto
  // visible a donde "debía" estar. El ref se sincroniza con el estado real
  // cada vez que este cambia (por ejemplo si otro cliente movió la ficha,
  // caso raro pero posible), y también se actualiza al toque en cada paso.
  const posActualRef = React.useRef<{ x: number; y: number } | null>(null);
  React.useEffect(() => {
    if (relacionPropia && relacionPropia.pos_x !== null && relacionPropia.pos_y !== null) {
      posActualRef.current = { x: relacionPropia.pos_x, y: relacionPropia.pos_y };
    }
  }, [relacionPropia?.pos_x, relacionPropia?.pos_y]);

  const moverUnaCelda = React.useCallback(
    (dx: number, dy: number) => {
      if (!relacionPropia) return;
      const base = posActualRef.current ?? { x: relacionPropia.pos_x ?? 0, y: relacionPropia.pos_y ?? 0 };
      const cxActual = Math.floor(base.x / GRID_SIZE);
      const cyActual = Math.floor(base.y / GRID_SIZE);
      const cxDestino = cxActual + dx;
      const cyDestino = cyActual + dy;
      if (cxDestino < 0 || cyDestino < 0) return;

      const bloqueadas = celdasBloqueadas(
        obstaculos.map((o) => ({ id: o.id, forma: o.forma, pos_x: o.pos_x, pos_y: o.pos_y, ancho: o.ancho, alto: o.alto })),
      );
      if (bloqueadas.has(`${cxDestino},${cyDestino}`)) return;

      const destinoX = cxDestino * GRID_SIZE;
      const destinoY = cyDestino * GRID_SIZE;
      // Se actualiza el ref ANTES de esperar la respuesta del servidor:
      // el siguiente paso (si llega mientras este todavía está en vuelo)
      // ya lo ve reflejado.
      posActualRef.current = { x: destinoX, y: destinoY };
      void moverPosicion(relacionPropia.id, destinoX, destinoY);

      const criaturaCercana = publicadas.find(
        (e) =>
          e.tabla === "criaturas" &&
          e.pos_x !== null &&
          e.pos_y !== null &&
          distancia(destinoX, destinoY, e.pos_x, e.pos_y) < UMBRAL_COMBATE,
      );
      if (criaturaCercana) entrarEnCombateContra(criaturaCercana);
    },
    [relacionPropia, obstaculos, moverPosicion, publicadas],
  );

  // ── Teclado WASD: mueve una celda por tecla presionada. Se ignora si el
  // foco está en un input/textarea (por ejemplo el buscador o el modal de
  // detalle), para no interferir con la escritura normal. Se throttlea a
  // un paso cada ~130ms: sin esto, mantener apretada una tecla dispara
  // eventos de auto-repeat del sistema operativo mucho más rápido de lo
  // que la animación/red pueden seguir, y eso es lo que se sentía como
  // tirones — se "amontonaban" varios pasos y después se resolvían todos
  // de golpe. ──
  const ultimoPasoRef = React.useRef(0);
  const PASO_MIN_MS = 130;
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (!relacionPropia) return;

      const esTeclaDeMovimiento = ["w", "a", "s", "d"].includes(e.key.toLowerCase());
      if (!esTeclaDeMovimiento) return;
      e.preventDefault();

      const ahora = Date.now();
      if (ahora - ultimoPasoRef.current < PASO_MIN_MS) return;
      ultimoPasoRef.current = ahora;

      switch (e.key.toLowerCase()) {
        case "w":
          moverUnaCelda(0, -1);
          break;
        case "s":
          moverUnaCelda(0, 1);
          break;
        case "a":
          moverUnaCelda(-1, 0);
          break;
        case "d":
          moverUnaCelda(1, 0);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [relacionPropia, moverUnaCelda]);


  // El pizarrón del jugador muestra las entidades publicadas por el DM +
  // su propia ficha (aunque el DM no la haya marcado "publicado": es su
  // personaje, siempre visible para sí mismo una vez que se unió). Si el
  // DM también la marcó publicada, no se duplica.
  const itemsTablero = [
    ...publicadas,
    ...(relacionPropia && !relacionPropia.publicado ? [relacionPropia] : []),
  ];

  // ── Modo combate activo: reemplaza todo el feed por una pantalla propia
  // (ficha vs criatura + dados), en vez de mostrar el pizarrón normal. ──
  if (enCombate && rivalesCombate.length > 0) {
    return (
      <PantallaCombate
        ficha={fichaActiva}
        rivales={rivalesCombate}
        onSalir={() => {
          setEnCombate(false);
          setRivalesCombateIds([]);
        }}
      />
    );
  }

  return (
    <>
      {/* ── Modal: unirse a la aventura con la ficha activa. Bloquea el
          feed hasta que el jugador decide (unirse o descartar) — así no
          hay fichas "fantasma" apareciendo solas en el pizarrón del DM
          apenas alguien entra a mirar. ── */}
      <AnimatePresence>
        {pidiendoUnion && fichaActiva && (
          <MotionDiv
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <MotionDiv
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-sm rounded-2xl p-6 text-center"
              exit={{ opacity: 0, scale: 0.96 }}
              initial={{ opacity: 0, scale: 0.96 }}
              style={{ background: "var(--white-custom)" }}
            >
              <Swords size={22} className="mx-auto mb-3 text-primary/30" />
              <p className="font-serif italic text-lg text-primary mb-1">
                ¿Unir a {fichaActiva.nombre}?
              </p>
              <p className="text-xs text-primary/50 mb-5 leading-relaxed">
                Tu personaje va a aparecer en el pizarrón de{" "}
                {aventura?.nombre ?? "esta aventura"} y vas a poder moverlo
                con WASD o clickeando las celdas de al lado.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnionDescartada(true)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-primary/50 hover:text-primary/70 transition-colors"
                >
                  Solo mirar
                </button>
                <button
                  type="button"
                  onClick={handleUnirse}
                  disabled={uniendose}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {uniendose && (
                    <Loader2 size={12} className="animate-spin" style={{ color: "var(--btn-text)" }} />
                  )}
                  <span className="text-xs font-bold" style={{ color: "var(--btn-text)" }}>
                    Unirme
                  </span>
                </button>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      <MotionDiv
        animate={{ opacity: 1, y: 0 }}
        className="text-center shrink-0 relative"
        initial={{ opacity: 0, y: -20 }}
      >
        <button
          type="button"
          onClick={onVolver}
          className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-bold text-primary/40 hover:text-primary/70 transition-colors"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Aventuras</span>
        </button>
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-primary italic">
          {aventura?.nombre ?? "Aventura"}
        </h1>
      </MotionDiv>

      <div className="flex-1 w-full relative">
        {!loading && itemsTablero.length > 0 && (
          <div className="flex items-center justify-between mb-2 gap-2">
            {relacionPropia ? (
              <span className="text-micro font-bold text-primary/35">
                Movete con WASD o clickeá una celda adyacente para mover a{" "}
                {fichaActiva?.nombre ?? "tu personaje"}.
              </span>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1.5">
              <Maximize2 size={11} className="text-primary/35" />
              <input
                type="range"
                min={CARD_SCALE_MIN}
                max={CARD_SCALE_MAX}
                step={0.05}
                value={escala}
                onChange={(e) => actualizarEscala(Number(e.target.value))}
                className="w-24 accent-[var(--primary)]"
                title="Zoom del pizarrón (solo en tu vista)"
              />
              <span className="text-micro font-bold tabular-nums text-primary/40 w-9">
                {Math.round(escala * 100)}%
              </span>
            </div>
          </div>
        )}
        {loading && entidades.length === 0 ? (
          <div className="py-24 flex items-center justify-center text-primary/30">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : itemsTablero.length === 0 ? (
          <div className="py-24 text-center">
            <Sparkles className="mx-auto mb-3 text-primary/20" size={28} />
            <Text as="p" variant="md" className="text-primary/40">
              Todavía no hay nada revelado en esta aventura. El DM irá
              publicando cosas a medida que las descubráis.
            </Text>
          </div>
        ) : (
          <>
            <TableroAventura
              editable={false}
              items={itemsTablero.map(
                (entidad): TableroItem => ({
                  id: entidad.id,
                  nombre: entidad.nombre,
                  imagen_url: entidad.imagen_url,
                  subtitulo: TABLA_LABEL[entidad.tabla].singular,
                  pos_x: entidad.pos_x,
                  pos_y: entidad.pos_y,
                  destacado: entidad.tabla === "fichas_dnd",
                  grupoNombre: entidad.tabla === "criaturas" ? entidad.grupo_nombre : null,
                  ancho: entidad.ancho,
                  alto: entidad.alto,
                  contenedorId: entidad.contenedor_id,
                }),
              )}
              zoom={escala}
              centrarEnId={relacionPropia?.id ?? null}
              obstaculos={obstaculos.map((o) => ({ ...o, bloqueaVision: o.bloquea_vision }))}
              nieblaOrigenId={
                aventura?.niebla_activa && relacionPropia ? relacionPropia.id : null
              }
              celdasExploradas={celdasVistas}
              onCeldasVisibles={registrarVisibles}
              onClickItem={(id) => {
                // El click sobre la propia tarjeta no hace nada (no tiene
                // sentido "atacarse a uno mismo" ni "ver detalle" propio).
                if (id === relacionPropia?.id) return;
                const entidad = publicadas.find((e) => e.id === id);
                if (!entidad) return;
                if (entidad.tabla === "criaturas") {
                  // Click corto sobre una criatura: entra directo en
                  // combate contra ella (y contra el resto de su
                  // grupo/horda, si tiene uno), sin pasar por el modal de
                  // detalle.
                  entrarEnCombateContra(entidad);
                } else {
                  setSeleccion(entidad);
                }
              }}
              onLongPressItem={(id) => {
                // Mantener presionado: siempre muestra la descripción,
                // incluso para criaturas (donde el click corto ya está
                // reservado para entrar en combate).
                if (id === relacionPropia?.id) return;
                const entidad = publicadas.find((e) => e.id === id);
                if (entidad) setSeleccion(entidad);
              }}
              onCanvasClick={
                relacionPropia && relacionPropia.pos_x !== null && relacionPropia.pos_y !== null
                  ? (x, y) => {
                      // Solo se acepta el click si cae en una de las 8
                      // celdas adyacentes al token propio (mismo criterio
                      // que WASD, y misma fuente de verdad: el ref, no el
                      // estado, para que no se desincronice con un
                      // movimiento por teclado que todavía no terminó de
                      // reflejarse en el render).
                      const base = posActualRef.current ?? { x: relacionPropia.pos_x!, y: relacionPropia.pos_y! };
                      const cxActual = Math.floor(base.x / GRID_SIZE);
                      const cyActual = Math.floor(base.y / GRID_SIZE);
                      const cxClick = Math.floor(x / GRID_SIZE);
                      const cyClick = Math.floor(y / GRID_SIZE);
                      const dx = cxClick - cxActual;
                      const dy = cyClick - cyActual;
                      if (dx === 0 && dy === 0) return;
                      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return;
                      moverUnaCelda(dx, dy);
                    }
                  : undefined
              }
            />

            {/* ── Dados: flotan fijos sobre el pizarrón, esquina inferior
                derecha del viewport, siempre a mano sin ocupar espacio en
                el flujo ni tapar el panel de identidad. El acceso a Runas
                se movió al navbar (ver layout/navbar.tsx). ── */}
            <div className="fixed z-40 shadow-lg bottom-20 left-4 md:bottom-6 md:left-[64px]">
              <TiradaDados />
            </div>
          </>
        )}
      </div>


      {/* ── Modal de detalle ─────────────────────────────────────────── */}
      <AnimatePresence>
        {seleccion && (
          <MotionDiv
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setSeleccion(null)}
          >
            <MotionDiv
              animate={{ opacity: 1, scale: 1 }}
              className={`relative w-full max-h-[85vh] overflow-y-auto rounded-2xl p-6 ${
                seleccion.tabla === "fichas_dnd" ? "max-w-2xl" : "max-w-lg"
              }`}
              exit={{ opacity: 0, scale: 0.96 }}
              initial={{ opacity: 0, scale: 0.96 }}
              style={{ background: "var(--white-custom)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSeleccion(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                <X size={14} className="text-primary/60" />
              </button>

              {seleccion.tabla === "fichas_dnd" ? (
                cargandoFicha ? (
                  <div className="py-16 flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary/30" size={20} />
                  </div>
                ) : fichaSeleccion ? (
                  // Vista de otro jugador: siempre solo lectura, sin
                  // condiciones (eso lo maneja el DM) y sin campos
                  // secundarios de mecánica interna.
                  <FichaStatsPanel
                    ficha={fichaSeleccion}
                    mostrarCondiciones={false}
                    mostrarSecundarias={false}
                  />
                ) : (
                  <p className="text-sm text-primary/30 italic py-8 text-center">
                    No se pudo cargar esta ficha.
                  </p>
                )
              ) : (
                <>
                  {seleccion.imagen_url && (
                    <div className="w-full h-48 rounded-xl overflow-hidden mb-4 bg-primary/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={seleccion.imagen_url}
                        alt={seleccion.nombre}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                    {TABLA_LABEL[seleccion.tabla].singular}
                  </span>
                  <h2 className="font-serif italic text-2xl text-primary mb-3">{seleccion.nombre}</h2>

                  {seleccion.descripcion ? (
                    <p className="text-sm text-primary/70 whitespace-pre-wrap leading-relaxed">
                      {seleccion.descripcion}
                    </p>
                  ) : (
                    <p className="text-sm text-primary/30 italic">Sin descripción todavía.</p>
                  )}

                  {seleccion.publicado_at && (
                    <p className="mt-4 text-micro text-primary/30">
                      Publicado el {formatFecha(seleccion.publicado_at)}
                    </p>
                  )}
                </>
              )}
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </>
  );
}

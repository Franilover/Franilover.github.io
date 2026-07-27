"use client";

import { AnimatePresence } from "framer-motion";
import {
  Award,
  Bug,
  Check,
  Clock,
  Coins,
  Globe,
  Loader2,
  Lock,
  MapPin,
  Scroll,
  Star,
  Sword,
  User,
  X,
} from "lucide-react";
import React from "react";

import { MotionDiv } from "@/components/ui/Motion";
import { supabase } from "@/lib/api/client/supabase";


// ─── Tipos ──────────────────────────────────────────────────────────────────

export type Dificultad = "facil" | "media" | "dificil" | "epica";

export interface RecompensaMision {
  xp: number;
  monedas?: number;
  item_nombre?: string;
  item_imagen_url?: string;
}

export type RolEntidad = "relacionado" | "objetivo" | "recompensa";
export type TipoEntidad =
  | "personaje"
  | "criatura"
  | "item"
  | "ciudad"
  | "reino";

export interface EntidadMision {
  id: string;
  entidad_id: string;
  tipo: TipoEntidad;
  rol: RolEntidad;
  nombre: string;
  imagen_url?: string | null;
}

export interface Mision {
  id: string;
  titulo: string;
  descripcion?: string;
  dificultad: Dificultad;
  categoria?: string;
  imagen_url?: string;
  recompensa: RecompensaMision;
  recompensa_item_id?: string | null;
  requisitos?: string;
  vence_en?: string | null;
  bloqueada?: boolean;
}

export type EstadoMisionUsuario = "en_curso" | "completada" | "reclamada";

export interface MisionUsuario {
  mision_id: string;
  estado: EstadoMisionUsuario;
  progreso: number; // 0-100
  fecha_aceptada?: string;
  fecha_completada?: string | null;
}

export interface MisionConProgreso extends Mision {
  user_estado?: EstadoMisionUsuario | null;
  progreso?: number;
}

// ─── Constantes visuales ───────────────────────────────────────────────────

export const DIFICULTAD_LABEL: Record<Dificultad, string> = {
  facil: "Fácil",
  media: "Media",
  dificil: "Difícil",
  epica: "Épica",
};

// Cada dificultad pinta sobre --primary con distinta intensidad, manteniendo
// una sola fuente de verdad de color para que todo el módulo respete el tema
// activo del usuario (igual que en personal.tsx).
export const DIFICULTAD_INTENSIDAD: Record<Dificultad, number> = {
  facil: 35,
  media: 55,
  dificil: 75,
  epica: 95,
};

// ─── EmptyTab equivalente ───────────────────────────────────────────────────

export function EmptyMisiones({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Scroll
        size={26}
        style={{
          color: "color-mix(in srgb, var(--primary) 16%, transparent)",
        }}
      />
      <p
        className="font-serif italic text-micro text-center"
        style={{
          color: "color-mix(in srgb, var(--primary) 30%, transparent)",
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ─── Barra de progreso de misión ───────────────────────────────────────────

export function BarraProgreso({ progreso }: { progreso: number }) {
  const pct = Math.max(0, Math.min(100, progreso));
  return (
    <div
      className="w-full h-1.5 overflow-hidden"
      style={{
        borderRadius: "2px",
        background: "color-mix(in srgb, var(--primary) 8%, transparent)",
      }}
    >
      <div
        className="h-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: "color-mix(in srgb, var(--primary) 55%, transparent)",
          borderRadius: "2px",
        }}
      />
    </div>
  );
}

// ─── Pastilla de dificultad ─────────────────────────────────────────────────

export function PastillaDificultad({ dificultad }: { dificultad: Dificultad }) {
  const intensidad = DIFICULTAD_INTENSIDAD[dificultad];
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <Star
          key={i}
          fill={
            i < Math.ceil((intensidad / 100) * 4) ? "var(--primary)" : "none"
          }
          size={10}
          strokeWidth={1.5}
          style={{
            color:
              i < Math.ceil((intensidad / 100) * 4)
                ? "var(--primary)"
                : "color-mix(in srgb, var(--primary) 25%, transparent)",
          }}
        />
      ))}
    </span>
  );
}

// ─── Hook: carga entidades vinculadas a una misión (Dexie-first) ───────────────

const TIPO_ICON: Record<TipoEntidad, React.ReactNode> = {
  personaje: <User size={9} />,
  criatura: <Bug size={9} />,
  item: <Sword size={9} />,
  ciudad: <MapPin size={9} />,
  reino: <Globe size={9} />,
};

const ROL_COLOR: Record<RolEntidad, string> = {
  relacionado: "color-mix(in srgb, var(--primary) 40%, transparent)",
  objetivo: "var(--primary)",
  recompensa: "#16a34a",
};

const ROL_LABEL: Record<RolEntidad, string> = {
  relacionado: "Relacionado",
  objetivo: "Objetivo",
  recompensa: "Recompensa",
};

function useEntidadesMision(misionId: string) {
  const [entidades, setEntidades] = React.useState<EntidadMision[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      // 1️⃣ Dexie primero — instantáneo
      try {
        const { db } = await import("@/lib/api/client/db");
        if (db?.mision_entidades) {
          const local = await db.mision_entidades
            .where("mision_id")
            .equals(misionId)
            .toArray();
          if (!cancelled && local.length > 0) {
            setEntidades(local as EntidadMision[]);
            setLoading(false);
          }
        }
      } catch {}

      // 2️⃣ Supabase en background
      try {
        const { data } = await supabase
          .from("mision_entidades")
          .select("id, tipo, entidad_id, rol")
          .eq("mision_id", misionId);

        if (cancelled || !data) return;

        // Resolver nombres: agrupar por tipo para hacer una sola query por tipo
        const porTipo: Record<string, string[]> = {};
        for (const row of data) {
          if (!porTipo[row.tipo]) porTipo[row.tipo] = [];
          porTipo[row.tipo].push(row.entidad_id);
        }

        const nombreMap = new Map<
          string,
          { nombre: string; imagen_url: string | null }
        >();

        await Promise.all(
          Object.entries(porTipo).map(async ([tipo, ids]) => {
            const tabla =
              tipo === "personaje"
                ? "personajes"
                : tipo === "criatura"
                  ? "criaturas"
                  : tipo === "item"
                    ? "items"
                    : tipo === "ciudad"
                      ? "ciudades"
                      : "reinos";
            const imgCol = tipo === "personaje" ? "img_url" : "imagen_url";
            const { data: ents } = await supabase
              .from(tabla)
              .select(`id, nombre, ${imgCol}`)
              .in("id", ids);
            for (const e of ents ?? []) {
              nombreMap.set(e.id, {
                nombre: e.nombre,
                imagen_url: (e as any)[imgCol] ?? null,
              });
            }
          }),
        );

        const resolved: EntidadMision[] = data.map((row: any) => ({
          id: row.id,
          entidad_id: row.entidad_id,
          tipo: row.tipo as TipoEntidad,
          rol: row.rol as RolEntidad,
          nombre: nombreMap.get(row.entidad_id)?.nombre ?? "—",
          imagen_url: nombreMap.get(row.entidad_id)?.imagen_url ?? null,
        }));

        if (!cancelled) {
          setEntidades(resolved);
          setLoading(false);
          // Cachear en Dexie para la próxima vez
          try {
            const { db } = await import("@/lib/api/client/db");
            if (db?.mision_entidades) {
              await db.mision_entidades.bulkPut(
                resolved.map((e) => ({ ...e, mision_id: misionId })),
              );
            }
          } catch {}
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [misionId]);

  return { entidades, loading };
}

// ─── Panel de entidades vinculadas (se muestra en el ModalMision) ───────────

function EntidadesMision({ misionId }: { misionId: string }) {
  const { entidades, loading } = useEntidadesMision(misionId);

  if (loading && entidades.length === 0) return null;
  if (!loading && entidades.length === 0) return null;

  const porRol = {
    objetivo: entidades.filter((e) => e.rol === "objetivo"),
    recompensa: entidades.filter((e) => e.rol === "recompensa"),
    relacionado: entidades.filter((e) => e.rol === "relacionado"),
  };

  const divider =
    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)";

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex-1 h-px"
          style={{
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        />
        <span
          className="font-serif italic text-micro font-black uppercase tracking-widest"
          style={{
            color: "color-mix(in srgb, var(--primary) 28%, transparent)",
          }}
        >
          Involucrados
        </span>
        <div
          className="flex-1 h-px"
          style={{
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        {(["objetivo", "recompensa", "relacionado"] as RolEntidad[]).map(
          (rol) => {
            const grupo = porRol[rol];
            if (grupo.length === 0) return null;
            return (
              <div key={rol}>
                <p
                  className="text-micro font-black uppercase tracking-widest mb-1.5"
                  style={{ color: ROL_COLOR[rol] }}
                >
                  {ROL_LABEL[rol]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {grupo.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary) 4%, transparent)",
                        border: divider,
                      }}
                    >
                      <div
                        className="w-5 h-5 shrink-0 overflow-hidden flex items-center justify-center rounded"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 8%, transparent)",
                        }}
                      >
                        {e.imagen_url ? (
                          <img
                            alt={e.nombre}
                            className="w-full h-full object-cover"
                            src={e.imagen_url}
                          />
                        ) : (
                          <span
                            style={{
                              color:
                                "color-mix(in srgb, var(--primary) 35%, transparent)",
                            }}
                          >
                            {TIPO_ICON[e.tipo]}
                          </span>
                        )}
                      </div>
                      <span
                        className="text-micro font-bold capitalize"
                        style={{ color: "var(--primary)" }}
                      >
                        {e.nombre}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

// ─── Modal de detalle de misión ────────────────────────────────────────────

interface ModalMisionProps {
  mision: MisionConProgreso;
  onClose: () => void;
  onAceptar?: (mision: MisionConProgreso) => void;
  onReclamar?: (mision: MisionConProgreso) => void;
  aceptando?: boolean;
  reclamando?: boolean;
}

export function ModalMision({
  mision,
  onClose,
  onAceptar,
  onReclamar,
  aceptando,
  reclamando,
}: ModalMisionProps) {
  const estado = mision.user_estado;
  const progreso = mision.progreso ?? 0;

  return (
    <AnimatePresence>
      <MotionDiv
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-40 backdrop-blur-sm"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      />
      <MotionDiv
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 md:inset-x-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[28rem]"
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        style={{
          background: "var(--white-custom)",
          borderRadius: "var(--radius-card)",
          border:
            "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
          boxShadow:
            "0 24px 64px color-mix(in srgb, var(--primary) 18%, transparent), 0 4px 16px color-mix(in srgb, var(--primary) 10%, transparent)",
          maxHeight: "88dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
      >
        {/* Hero */}
        <div
          className="w-full shrink-0 overflow-hidden relative"
          style={{
            height: mision.imagen_url ? "200px" : "72px",
            background: "color-mix(in srgb, var(--primary) 6%, var(--bg-main))",
          }}
        >
          {mision.imagen_url && (
            <img
              alt={mision.titulo}
              className="w-full h-full object-cover"
              src={mision.imagen_url}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--white-custom) 0%, color-mix(in srgb, var(--white-custom) 30%, transparent) 45%, transparent 100%)",
            }}
          />
          <button
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center transition-all hover:scale-110"
            style={{
              color: "var(--primary)",
              background:
                "color-mix(in srgb, var(--white-custom) 85%, transparent)",
              borderRadius: "var(--radius-btn)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
              backdropFilter: "blur(6px)",
            }}
            onClick={onClose}
          >
            <X size={13} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex flex-col gap-1.5">
            <PastillaDificultad dificultad={mision.dificultad} />
            <h2
              className="font-serif italic capitalize leading-tight"
              style={{
                fontSize: "1.5rem",
                color: "var(--primary)",
                lineHeight: 1.15,
              }}
            >
              {mision.titulo}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5">
          {mision.descripcion && (
            <p
              className="font-serif italic leading-relaxed mb-5"
              style={{
                fontSize: "0.88rem",
                color: "color-mix(in srgb, var(--foreground) 68%, transparent)",
                lineHeight: 1.7,
              }}
            >
              {mision.descripcion}
            </p>
          )}

          {mision.requisitos && (
            <div
              className="flex items-center gap-2 mb-4 px-3 py-2"
              style={{
                borderRadius: "var(--radius-btn)",
                background:
                  "color-mix(in srgb, var(--primary) 4%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            >
              <Lock
                size={11}
                style={{
                  color: "color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
              />
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{
                  color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                }}
              >
                {mision.requisitos}
              </span>
            </div>
          )}

          {/* Progreso si está en curso */}
          {estado === "en_curso" && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-micro font-black uppercase tracking-wider"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 40%, transparent)",
                  }}
                >
                  Progreso
                </span>
                <span
                  className="text-micro font-black tabular-nums"
                  style={{ color: "var(--primary)" }}
                >
                  {progreso}%
                </span>
              </div>
              <BarraProgreso progreso={progreso} />
            </div>
          )}

          {/* Entidades vinculadas */}
          <EntidadesMision misionId={mision.id} />

          {/* Recompensas */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex-1 h-px"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            />
            <div className="flex items-center gap-1.5">
              <Award
                size={10}
                style={{
                  color: "color-mix(in srgb, var(--primary) 28%, transparent)",
                }}
              />
              <span
                className="font-serif italic text-micro font-black uppercase tracking-widest"
                style={{
                  color: "color-mix(in srgb, var(--primary) 28%, transparent)",
                }}
              >
                Recompensa
              </span>
            </div>
            <div
              className="flex-1 h-px"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5"
              style={{
                borderRadius: "var(--radius-btn)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                background:
                  "color-mix(in srgb, var(--primary) 3%, transparent)",
              }}
            >
              <span
                className="text-micro font-black tabular-nums"
                style={{ color: "var(--primary)" }}
              >
                {mision.recompensa.xp} XP
              </span>
            </div>

            {!!mision.recompensa.monedas && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5"
                style={{
                  borderRadius: "var(--radius-btn)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  background:
                    "color-mix(in srgb, var(--primary) 3%, transparent)",
                }}
              >
                <Coins
                  size={11}
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 45%, transparent)",
                  }}
                />
                <span
                  className="text-micro font-black tabular-nums"
                  style={{ color: "var(--primary)" }}
                >
                  {mision.recompensa.monedas}
                </span>
              </div>
            )}

            {mision.recompensa.item_nombre && (
              <div
                className="flex items-center gap-2 px-2.5 py-1.5"
                style={{
                  borderRadius: "var(--radius-btn)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  background:
                    "color-mix(in srgb, var(--primary) 3%, transparent)",
                }}
              >
                {mision.recompensa.item_imagen_url ? (
                  <img
                    alt={mision.recompensa.item_nombre}
                    className="w-4 h-4 object-contain"
                    src={mision.recompensa.item_imagen_url}
                  />
                ) : null}
                <span
                  className="font-serif italic text-micro"
                  style={{ color: "var(--primary)" }}
                >
                  {mision.recompensa.item_nombre}
                </span>
              </div>
            )}
          </div>

          {/* Acción */}
          {mision.bloqueada ? (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 py-3 cursor-not-allowed"
              style={{
                borderRadius: "var(--radius-btn)",
                background:
                  "color-mix(in srgb, var(--primary) 5%, transparent)",
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              <Lock size={12} />
              <span className="text-micro font-black uppercase tracking-wider">
                Bloqueada
              </span>
            </button>
          ) : estado === "completada" ? (
            <button
              className="w-full flex items-center justify-center gap-2 py-3 transition-opacity hover:opacity-90 disabled:opacity-60"
              disabled={reclamando}
              style={{
                borderRadius: "var(--radius-btn)",
                background: "var(--primary)",
                color: "var(--btn-text)",
              }}
              onClick={() => onReclamar?.(mision)}
            >
              {reclamando ? (
                <Loader2 className="animate-spin" size={13} />
              ) : (
                <Check size={13} />
              )}
              <span className="text-micro font-black uppercase tracking-wider">
                Reclamar recompensa
              </span>
            </button>
          ) : estado === "en_curso" ? (
            <div
              className="w-full flex items-center justify-center gap-2 py-3"
              style={{
                borderRadius: "var(--radius-btn)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
                color: "color-mix(in srgb, var(--primary) 50%, transparent)",
              }}
            >
              <Clock size={12} />
              <span className="text-micro font-black uppercase tracking-wider">
                Misión en curso
              </span>
            </div>
          ) : estado === "reclamada" ? (
            <div
              className="w-full flex items-center justify-center gap-2 py-3"
              style={{
                borderRadius: "var(--radius-btn)",
                background:
                  "color-mix(in srgb, var(--primary) 5%, transparent)",
                color: "color-mix(in srgb, var(--primary) 35%, transparent)",
              }}
            >
              <Check size={12} />
              <span className="text-micro font-black uppercase tracking-wider">
                Completada
              </span>
            </div>
          ) : (
            <button
              className="w-full flex items-center justify-center gap-2 py-3 transition-opacity hover:opacity-90 disabled:opacity-60"
              disabled={aceptando}
              style={{
                borderRadius: "var(--radius-btn)",
                background: "var(--primary)",
                color: "var(--btn-text)",
              }}
              onClick={() => onAceptar?.(mision)}
            >
              {aceptando ? (
                <Loader2 className="animate-spin" size={13} />
              ) : (
                <Scroll size={13} />
              )}
              <span className="text-micro font-black uppercase tracking-wider">
                Aceptar misión
              </span>
            </button>
          )}
        </div>
      </MotionDiv>
    </AnimatePresence>
  );
}

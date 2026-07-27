"use client";
import { AnimatePresence } from "framer-motion";
import {
  Star,
  FileText,
  ArrowRight,
  Hash,
  CheckSquare,
  Plus,
  X,
  ChevronLeft,
  Heart,
  BookOpen,
} from "lucide-react";
import React, { useMemo, useState } from "react";

import { useAppPanels } from "@/components/command/";
import { MotionDiv } from "@/ui/Motion";
import { RelojDigital } from "@/domains/personal/herramientas/calendario/relojDigital";
import ArmarioPage from "@/domains/personal/herramientas/ropa/ropa";
import type { ModoCalendario } from "@/domains/personal/herramientas/calendario/types";
import { VistaMes } from "@/domains/personal/herramientas/calendario/vistaMes";
import { VistaSemanal } from "@/domains/personal/herramientas/calendario/vistaSemanal";
import { PaginaEjercicios } from "@/domains/personal/herramientas/ejercicios/ejerciciosComponent";
import { PaginaHobbys } from "@/domains/personal/herramientas/hobbys/hobbysComponent";
import { IngredientesPage } from "@/domains/personal/herramientas/cocina/ingredientes";
import { LibrosDashboard } from "@/domains/personal/herramientas/notas/LibrosDashboard";
import { PaginaPendientes } from "@/domains/personal/herramientas/pendientes/pendientesComponent";
import RecetasPage from "@/domains/personal/herramientas/cocina/recetas";

interface HomeDashboardProps {
  ensayos: any[];
  todosLosTags: string[];
  tagActivo?: string | null;
  onNavigate: (titulo: string) => void;
  onTagClick: (tag: string) => void;
  tareas?: any[];
  onToggleTarea?: (id: string, completada: boolean) => void;
  onAddTarea?: (titulo: string) => void;
  eventos?: any[];
  capitulosRaw?: any[];
  horario?: any[];
  isAddingEvento?: boolean;
  onAddEvento?: (
    fechaISO: string,
    titulo: string,
    tipo: string,
  ) => Promise<void>;
  onUpdateEvento?: (
    id: string,
    datos: { titulo?: string; tipo?: string; fecha?: string },
  ) => Promise<void>;
  onDeleteEvento?: (id: string) => Promise<void>;
  onToggleEstado?: (
    libroId: string,
    estado: "leyendo" | "leido" | "pendiente",
    add: boolean,
  ) => void;
  onCrearLibro?: () => void;
}

export function HomeDashboard({
  ensayos,
  todosLosTags,
  tagActivo,
  onNavigate,
  onTagClick,
  tareas = [],
  onToggleTarea,
  onAddTarea,
  eventos = [],
  capitulosRaw = [],
  horario = [],
  isAddingEvento = false,
  onAddEvento,
  onUpdateEvento,
  onDeleteEvento,
  onToggleEstado,
  onCrearLibro,
}: HomeDashboardProps) {
  const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };
  const serif: React.CSSProperties = {
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
  };

  const [nuevaTarea, setNuevaTarea] = useState("");
  const [modoCalendario, setModoCalendario] = useState<ModoCalendario>("mes");
  const { panelAbierto, vistaPersonal, setPanelAbierto, setVistaPersonal } =
    useAppPanels();

  const favoritos = useMemo(
    () => ensayos.filter((e) => e.tags?.includes("favorito")).slice(0, 10),
    [ensayos],
  );

  const totalPalabras = useMemo(
    () =>
      ensayos.reduce(
        (acc, e) =>
          acc + (e.contenido?.split(/\s+/).filter(Boolean).length || 0),
        0,
      ),
    [ensayos],
  );

  const tagMasUsado = useMemo(() => {
    const freq: Record<string, number> = {};
    ensayos.forEach((e) =>
      e.tags?.forEach((t: string) => {
        freq[t] = (freq[t] || 0) + 1;
      }),
    );
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [ensayos]);

  const pendientes = useMemo(
    () => tareas.filter((t) => !t.completada).slice(0, 10),
    [tareas],
  );

  const notasFiltradas = useMemo(
    () =>
      tagActivo ? ensayos.filter((e) => e.tags?.includes(tagActivo)) : ensayos,
    [ensayos, tagActivo],
  );

  const handleAddTarea = () => {
    if (!nuevaTarea.trim() || !onAddTarea) return;
    onAddTarea(nuevaTarea.trim());
    setNuevaTarea("");
  };

  const formatRelative = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 2) return "ahora";
    if (mins < 60) return `${mins}m`;
    if (hrs < 24) return `${hrs}h`;
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    });
  };

  const handleAddEvento = onAddEvento ?? (async () => {});

  const gap = 1;
  const divColor = "color-mix(in srgb, var(--foreground) 5%, transparent)";

  /* ── Sección reutilizable ── */
  const SectionHeader = ({
    icon,
    label,
    count,
  }: {
    icon: React.ReactNode;
    label: string;
    count?: number;
  }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 18,
      }}
    >
      {icon}
      <span
        style={{
          ...mono,
          fontSize: 9,
          color: "color-mix(in srgb, var(--foreground) 28%, transparent)",
          textTransform: "uppercase",
          letterSpacing: "0.13em",
          flex: 1,
        }}
      >
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span
          style={{
            ...mono,
            fontSize: 7,
            background: "color-mix(in srgb, var(--foreground) 8%, transparent)",
            color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
            padding: "1px 5px",
            borderRadius: 99,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );

  return (
    <MotionDiv
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto"
      initial={{ opacity: 0 }}
      style={{ background: "var(--bg-main)" }}
      transition={{ duration: 0.25 }}
    >
      <style>{`
        @media (max-width: 767px) {
          .hd-main-grid {
            display: flex !important;
            flex-direction: column !important;
            min-height: unset !important;
          }
          .hd-mes { min-height: 340px !important; }
          .hd-mes-row {
            flex-direction: column !important;
          }
          .hd-reloj-tareas {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid color-mix(in srgb, var(--foreground) 5%, transparent) !important;
            flex-direction: row !important;
            max-height: 220px !important;
          }
          .hd-reloj-tareas > div:first-child {
            border-bottom: none !important;
            border-right: 1px solid color-mix(in srgb, var(--foreground) 5%, transparent) !important;
          }
          .hd-notas-tags-grid {
            display: flex !important;
            flex-direction: column !important;
          }
          .hd-side-panel { display: none !important; }
          .hd-recientes, .hd-tags, .hd-favoritos {
            padding: 14px 16px !important;
          }
          .hd-tags, .hd-favoritos {
            min-height: 160px !important;
          }
          .hd-notes-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .hd-outer-padding {
            padding: 18px 18px 88px !important;
          }
          .hd-stats {
            font-size: 10px !important;
            margin-bottom: 12px !important;
          }
        }
      `}</style>
      <div
        className="hd-outer-padding"
        style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 40px 80px" }}
      >
        {/* ── Stats mínimo arriba ── */}
        <p
          className="hd-stats"
          style={{
            ...mono,
            fontSize: 10,
            color: "color-mix(in srgb, var(--foreground) 22%, transparent)",
            marginBottom: 24,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          {ensayos.length} notas · {totalPalabras.toLocaleString("es-ES")}{" "}
          palabras
          {tagMasUsado && ` · #${tagMasUsado}`}
          {pendientes.length > 0 &&
            ` · ${pendientes.length} pendiente${pendientes.length !== 1 ? "s" : ""}`}
        </p>

        {/* ══════════════════════════════════════════
            FILA PRINCIPAL — grid con areas
            cols: Apps | Calendario + Reloj/Tareas (fijo)
        ══════════════════════════════════════════ */}
        <div
          className="hd-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gridTemplateRows: "1fr 1fr",
            gridTemplateAreas: `
            "mes"
            "mes"
          `,
            gap: gap,
            background: divColor,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: gap,
            /* altura fija para que el span funcione bien */
            minHeight: 680,
          }}
        >
          {/* ── Calendario — span 2 rows (expanded) ── */}
          <div
            className="hd-mes hd-mes-row"
            style={{
              gridArea: "mes",
              background: "var(--bg-main)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "row",
              position: "relative",
            }}
          >
            {/* Área principal del calendario */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              {/* Toggle Mes / Semana */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 2,
                  padding: "8px 10px 0",
                  flexShrink: 0,
                }}
              >
                {(["mes", "semana"] as ModoCalendario[]).map((modo) => (
                  <button
                    key={modo}
                    style={{
                      ...mono,
                      fontSize: 7,
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      transition: "all 0.12s",
                      background:
                        modoCalendario === modo
                          ? "color-mix(in srgb, var(--foreground) 10%, transparent)"
                          : "transparent",
                      color:
                        modoCalendario === modo
                          ? "color-mix(in srgb, var(--foreground) 70%, transparent)"
                          : "color-mix(in srgb, var(--foreground) 25%, transparent)",
                    }}
                    onClick={() => setModoCalendario(modo)}
                  >
                    {modo}
                  </button>
                ))}
              </div>

              {/* Vista activa */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <AnimatePresence mode="wait">
                  {modoCalendario === "mes" ? (
                    <MotionDiv
                      key="mes"
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      initial={{ opacity: 0, y: 6 }}
                      style={{ height: "100%" }}
                      transition={{ duration: 0.15 }}
                    >
                      <VistaMes
                        capitulosRaw={capitulosRaw}
                        eventos={eventos}
                        isAddingEvento={isAddingEvento}
                        onAddEvento={handleAddEvento}
                        onDeleteEvento={onDeleteEvento}
                        onUpdateEvento={onUpdateEvento}
                      />
                    </MotionDiv>
                  ) : (
                    <MotionDiv
                      key="semana"
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      initial={{ opacity: 0, y: 6 }}
                      style={{
                        height: "100%",
                        padding: "12px 16px",
                        overflow: "auto",
                      }}
                      transition={{ duration: 0.15 }}
                    >
                      <VistaSemanal
                        capitulosRaw={capitulosRaw}
                        eventos={eventos}
                        isAddingEvento={isAddingEvento}
                        onAddEvento={handleAddEvento}
                      />
                    </MotionDiv>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {/* end left calendar column */}

            {/* Columna derecha fija: Reloj + Tareas (siempre visibles) */}
            <div
              className="hd-reloj-tareas"
              style={{
                width: 160,
                flexShrink: 0,
                borderLeft: `1px solid ${divColor}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Reloj */}
              <div
                style={{
                  flexShrink: 0,
                  borderBottom: `1px solid ${divColor}`,
                  padding: "14px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <RelojDigital horario={horario} tareas={tareas} />
              </div>

              {/* Tareas / Pendientes */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  padding: "10px 12px",
                  overflow: "hidden",
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 8,
                    flexShrink: 0,
                  }}
                >
                  <CheckSquare
                    size={9}
                    style={{
                      color:
                        "color-mix(in srgb, var(--foreground) 25%, transparent)",
                      marginRight: 6,
                    }}
                  />
                  <span
                    style={{
                      ...mono,
                      fontSize: 8,
                      color:
                        "color-mix(in srgb, var(--foreground) 25%, transparent)",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      flex: 1,
                    }}
                  >
                    Pendientes
                    {pendientes.length > 0 && (
                      <span
                        style={{
                          marginLeft: 5,
                          fontSize: 7,
                          background:
                            "color-mix(in srgb, var(--foreground) 8%, transparent)",
                          color:
                            "color-mix(in srgb, var(--foreground) 40%, transparent)",
                          padding: "1px 5px",
                          borderRadius: 99,
                        }}
                      >
                        {pendientes.length}
                      </span>
                    )}
                  </span>
                </div>

                {onAddTarea && (
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      marginBottom: 8,
                      flexShrink: 0,
                    }}
                  >
                    <input
                      placeholder="Nueva tarea..."
                      style={{
                        ...mono,
                        flex: 1,
                        fontSize: 9,
                        padding: "4px 8px",
                        borderRadius: 5,
                        border:
                          "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                        background:
                          "color-mix(in srgb, var(--foreground) 3%, transparent)",
                        color:
                          "color-mix(in srgb, var(--foreground) 70%, transparent)",
                        outline: "none",
                        minWidth: 0,
                      }}
                      type="text"
                      value={nuevaTarea}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor =
                          "color-mix(in srgb, var(--foreground) 8%, transparent)";
                        e.currentTarget.style.background =
                          "color-mix(in srgb, var(--foreground) 3%, transparent)";
                      }}
                      onChange={(e) => setNuevaTarea(e.target.value)}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor =
                          "color-mix(in srgb, var(--foreground) 20%, transparent)";
                        e.currentTarget.style.background =
                          "color-mix(in srgb, var(--foreground) 5%, transparent)";
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTarea()}
                    />
                    <button
                      disabled={!nuevaTarea.trim()}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        border: "none",
                        cursor: "pointer",
                        background: nuevaTarea.trim()
                          ? "color-mix(in srgb, var(--foreground) 12%, transparent)"
                          : "color-mix(in srgb, var(--foreground) 4%, transparent)",
                        color:
                          "color-mix(in srgb, var(--foreground) 40%, transparent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.1s",
                        flexShrink: 0,
                      }}
                      onClick={handleAddTarea}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    flex: 1,
                    overflowY: "auto",
                  }}
                >
                  {pendientes.length === 0 && (
                    <p
                      style={{
                        ...mono,
                        fontSize: 9,
                        color:
                          "color-mix(in srgb, var(--foreground) 15%, transparent)",
                        fontStyle: "italic",
                      }}
                    >
                      Sin pendientes.
                    </p>
                  )}
                  {pendientes.map((t, i) => (
                    <MotionDiv
                      key={t.id}
                      animate={{ opacity: 1, x: 0 }}
                      initial={{ opacity: 0, x: 4 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <button
                        className="w-full text-left group flex items-center gap-2"
                        style={{
                          padding: "5px 6px",
                          borderRadius: 5,
                          background: "transparent",
                          border: "none",
                          cursor: onToggleTarea ? "pointer" : "default",
                          transition: "background 0.1s",
                        }}
                        onClick={() => onToggleTarea?.(t.id, t.completada)}
                        onMouseEnter={(e) =>
                          onToggleTarea &&
                          (e.currentTarget.style.background =
                            "color-mix(in srgb, var(--foreground) 4%, transparent)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            flexShrink: 0,
                            border:
                              "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        />
                        <span
                          style={{
                            ...mono,
                            fontSize: 10,
                            color:
                              "color-mix(in srgb, var(--foreground) 65%, transparent)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {t.titulo}
                        </span>
                      </button>
                    </MotionDiv>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Panel flotante: Apps personales — cubre todo hd-mes ── */}
            <AnimatePresence>
              {panelAbierto && (
                <MotionDiv
                  key={`panel-${panelAbierto}`}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "var(--bg-main)",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                  transition={{ duration: 0.15 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      padding: "8px 10px 0",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        border: "none",
                        cursor: "pointer",
                        background:
                          "color-mix(in srgb, var(--foreground) 5%, transparent)",
                        color:
                          "color-mix(in srgb, var(--foreground) 35%, transparent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.1s",
                      }}
                      onClick={() => setPanelAbierto(null)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "color-mix(in srgb, var(--foreground) 10%, transparent)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "color-mix(in srgb, var(--foreground) 5%, transparent)";
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <div style={{ flex: 1, overflow: "auto" }}>
                    {panelAbierto === "ejercicios" && <PaginaEjercicios />}
                    {panelAbierto === "ingredientes" && <IngredientesPage />}
                    {panelAbierto === "recetas" && <RecetasPage />}
                    {panelAbierto === "ropa" && <ArmarioPage />}
                  </div>
                </MotionDiv>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Pendientes + Hobbys ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.7fr 1fr",
            gap: gap,
            background: divColor,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: gap,
            minHeight: 260,
          }}
        >
          {/* Pendientes */}
          <div
            style={{
              background: "var(--bg-main)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "9px 14px 7px",
                borderBottom: `1px solid ${divColor}`,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <BookOpen
                size={8}
                style={{
                  color:
                    "color-mix(in srgb, var(--foreground) 25%, transparent)",
                }}
              />
              <span
                style={{
                  ...mono,
                  fontSize: 8,
                  color:
                    "color-mix(in srgb, var(--foreground) 25%, transparent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.13em",
                }}
              >
                Pendientes
              </span>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                scrollbarWidth: "none",
                zoom: 0.82,
              }}
            >
              <PaginaPendientes />
            </div>
          </div>

          {/* Hobbys */}
          <div
            style={{
              background: "var(--bg-main)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "9px 14px 7px",
                borderBottom: `1px solid ${divColor}`,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Heart
                size={8}
                style={{
                  color:
                    "color-mix(in srgb, var(--foreground) 25%, transparent)",
                }}
              />
              <span
                style={{
                  ...mono,
                  fontSize: 8,
                  color:
                    "color-mix(in srgb, var(--foreground) 25%, transparent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.13em",
                }}
              >
                Hobbys
              </span>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                scrollbarWidth: "none",
                zoom: 0.82,
              }}
            >
              <PaginaHobbys />
            </div>
          </div>
        </div>

        {/* ── Todas las notas + Tags ── */}
        <div
          className="hd-notas-tags-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "3.2fr 1fr",
            gap: gap,
            borderRadius: 12,
            overflow: "hidden",
            background: divColor,
          }}
        >
          <div style={{ background: "var(--bg-main)", padding: "26px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 16,
              }}
            >
              <FileText
                size={9}
                style={{
                  color:
                    "color-mix(in srgb, var(--foreground) 25%, transparent)",
                }}
              />
              <span
                style={{
                  ...mono,
                  fontSize: 8,
                  color:
                    "color-mix(in srgb, var(--foreground) 25%, transparent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                }}
              >
                {tagActivo ? "Notas" : "Todas las notas"} ·{" "}
                {notasFiltradas.length}
              </span>
              {tagActivo && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    ...mono,
                    fontSize: 8,
                    padding: "1px 6px 1px 8px",
                    borderRadius: 99,
                    background:
                      "color-mix(in srgb, var(--accent) 12%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                    color: "color-mix(in srgb, var(--accent) 80%, transparent)",
                  }}
                >
                  #{tagActivo}
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      color: "inherit",
                      opacity: 0.6,
                    }}
                    title="Ver página del tag"
                    onClick={() => onTagClick(tagActivo)}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.opacity = "1")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.opacity = "0.6")
                    }
                  >
                    <ArrowRight size={8} />
                  </button>
                </span>
              )}
            </div>
            <div
              className="hd-notes-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 1,
                background: divColor,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {notasFiltradas.map((e, i) => (
                <MotionDiv
                  key={e.id}
                  animate={{ opacity: 1 }}
                  initial={{ opacity: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.4) }}
                >
                  <button
                    className="w-full text-left group"
                    style={{
                      display: "block",
                      padding: "13px 15px",
                      background: "var(--bg-main)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.08s",
                    }}
                    onClick={() => onNavigate(e.titulo)}
                    onMouseEnter={(el) =>
                      (el.currentTarget.style.background =
                        "color-mix(in srgb, var(--foreground) 4%, transparent)")
                    }
                    onMouseLeave={(el) =>
                      (el.currentTarget.style.background = "var(--bg-main)")
                    }
                  >
                    <p
                      style={{
                        ...serif,
                        fontSize: 12,
                        color:
                          "color-mix(in srgb, var(--foreground) 68%, transparent)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: 4,
                      }}
                    >
                      {e.titulo || "Sin título"}
                    </p>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {e.tags?.slice(0, 2).map((t: string) => (
                        <span
                          key={t}
                          style={{
                            ...mono,
                            fontSize: 7,
                            color:
                              "color-mix(in srgb, var(--foreground) 20%, transparent)",
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                      {(!e.tags || e.tags.length === 0) && (
                        <span
                          style={{
                            ...mono,
                            fontSize: 7,
                            color:
                              "color-mix(in srgb, var(--foreground) 10%, transparent)",
                          }}
                        >
                          {formatRelative(e.updated_at)}
                        </span>
                      )}
                    </div>
                  </button>
                </MotionDiv>
              ))}
            </div>
          </div>

          {/* ── Columna derecha: Favoritos + Tags ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: gap,
              overflow: "hidden",
            }}
          >
            {/* Favoritos */}
            <div
              className="hd-favoritos"
              style={{
                background: "var(--bg-main)",
                padding: "26px 24px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                flex: "0 1 auto",
                maxHeight: "50%",
              }}
            >
              <SectionHeader
                icon={
                  <Star
                    size={9}
                    style={{
                      color:
                        "color-mix(in srgb, var(--foreground) 25%, transparent)",
                    }}
                  />
                }
                label={`Favoritos · ${favoritos.length}`}
              />
              {favoritos.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {favoritos.map((f, i) => (
                    <MotionDiv
                      key={f.id}
                      animate={{ opacity: 1, x: 0 }}
                      initial={{ opacity: 0, x: -4 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <button
                        className="w-full text-left group flex items-center justify-between"
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          transition: "background 0.1s",
                        }}
                        onClick={() => onNavigate(f.titulo)}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "color-mix(in srgb, var(--foreground) 4%, transparent)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <span
                          style={{
                            ...serif,
                            fontSize: 13,
                            color:
                              "color-mix(in srgb, var(--foreground) 72%, transparent)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {f.titulo}
                        </span>
                        <ArrowRight
                          className="group-hover:opacity-100"
                          size={8}
                          style={{
                            color:
                              "color-mix(in srgb, var(--foreground) 15%, transparent)",
                            flexShrink: 0,
                            marginLeft: 4,
                            opacity: 0,
                            transition: "opacity 0.1s",
                          }}
                        />
                      </button>
                    </MotionDiv>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    ...mono,
                    fontSize: 9,
                    color:
                      "color-mix(in srgb, var(--foreground) 15%, transparent)",
                    lineHeight: 1.6,
                  }}
                >
                  Agrega{" "}
                  <span
                    style={{
                      color:
                        "color-mix(in srgb, var(--foreground) 30%, transparent)",
                    }}
                  >
                    #favorito
                  </span>{" "}
                  a una nota.
                </p>
              )}
            </div>

            {/* Tags */}
            <div
              className="hd-tags"
              style={{
                background: "var(--bg-main)",
                padding: "26px 24px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                flex: 1,
              }}
            >
              <SectionHeader
                icon={
                  <Hash
                    size={9}
                    style={{
                      color:
                        "color-mix(in srgb, var(--foreground) 25%, transparent)",
                    }}
                  />
                }
                label={`Tags · ${todosLosTags.length}`}
              />
              {todosLosTags.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {todosLosTags.map((tag, i) => {
                    const count = ensayos.filter((e) =>
                      e.tags?.includes(tag),
                    ).length;
                    return (
                      <MotionDiv
                        key={tag}
                        animate={{ opacity: 1, x: 0 }}
                        initial={{ opacity: 0, x: -4 }}
                        transition={{ delay: i * 0.02 }}
                      >
                        <button
                          className="w-full text-left group flex items-center justify-between"
                          style={{
                            padding: "8px 10px",
                            borderRadius: 6,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            transition: "background 0.1s",
                          }}
                          onClick={() => onTagClick(tag)}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "color-mix(in srgb, var(--foreground) 4%, transparent)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <span
                            style={{
                              ...serif,
                              fontSize: 13,
                              color:
                                "color-mix(in srgb, var(--foreground) 72%, transparent)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                              textTransform: "capitalize",
                            }}
                          >
                            #{tag}
                          </span>
                          <span
                            style={{
                              ...mono,
                              fontSize: 8,
                              color:
                                "color-mix(in srgb, var(--foreground) 20%, transparent)",
                              flexShrink: 0,
                              marginLeft: 6,
                            }}
                          >
                            {count}
                          </span>
                          <ArrowRight
                            className="group-hover:opacity-100"
                            size={8}
                            style={{
                              color:
                                "color-mix(in srgb, var(--foreground) 15%, transparent)",
                              flexShrink: 0,
                              marginLeft: 4,
                              opacity: 0,
                              transition: "opacity 0.1s",
                            }}
                          />
                        </button>
                      </MotionDiv>
                    );
                  })}
                </div>
              ) : (
                <p
                  style={{
                    ...mono,
                    fontSize: 9,
                    color:
                      "color-mix(in srgb, var(--foreground) 15%, transparent)",
                    lineHeight: 1.6,
                  }}
                >
                  Aún sin tags.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          OVERLAY PANTALLA COMPLETA — Biblioteca
      ══════════════════════════════════════════ */}
      <AnimatePresence>
        {vistaPersonal === "libros" && (
          <MotionDiv
            key="libros"
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-0 md:left-[68px] z-50 flex flex-col overflow-hidden"
            exit={{ opacity: 0, y: 12 }}
            initial={{ opacity: 0, y: 12 }}
            style={{ background: "var(--bg-main)" }}
            transition={{ duration: 0.18 }}
          >
            {/* ── Barra superior ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderBottom:
                  "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)",
                flexShrink: 0,
                background: "var(--bg-main)",
              }}
            >
              {/* Botón volver */}
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    "color-mix(in srgb, var(--foreground) 5%, transparent)",
                  color:
                    "color-mix(in srgb, var(--foreground) 55%, transparent)",
                  cursor: "pointer",
                  transition: "all 0.1s",
                  flexShrink: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
                onClick={() => setVistaPersonal(null)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "color-mix(in srgb, var(--foreground) 10%, transparent)";
                  (e.currentTarget as HTMLElement).style.color =
                    "color-mix(in srgb, var(--foreground) 80%, transparent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "color-mix(in srgb, var(--foreground) 5%, transparent)";
                  (e.currentTarget as HTMLElement).style.color =
                    "color-mix(in srgb, var(--foreground) 55%, transparent)";
                }}
              >
                <ChevronLeft size={12} />
                Menú
              </button>
            </div>

            {/* ── Contenido ── */}
            <div className="flex-1 overflow-auto pb-14 md:pb-0">
              <LibrosDashboard
                ensayos={ensayos}
                onCrearLibro={onCrearLibro}
                onNavigate={(titulo) => {
                  onNavigate(titulo);
                  setVistaPersonal(null);
                }}
                onTagClick={onTagClick}
                onToggleEstado={onToggleEstado}
              />
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}

"use client";
import { AnimatePresence } from "framer-motion";
import {
  X,
  ArrowLeft,
  Save,
  Edit3,
  Move,
  CheckCircle2,
  AlertCircle,
  UserX,
  ZoomIn,
  ZoomOut,
  User,
  BookOpen,
  BookMarked,
  Bug,
  Package,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";

import { MotionDiv, MotionButton } from "@/components/ui/Motion";
import { navegarRutaDinamica } from "@/lib/utils/navegacionTauri";
import { ReinoTileCanvas } from "@garlia/reinos";
import {
  UnifiedTileCanvas,
  type MapTile,
} from "@/domains/garlia/_shared/UnifiedTileCanvas";
import { ModalDetalle } from "@/domains/garlia/perfil-jugador/PersonalComponents";
import { useIsAdmin } from "@/hooks/auth/useIsAdmin";
import { useSupabaseData } from "@/hooks/data/useSupabaseData";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";

// ─── Hourglass — reemplaza Loader2 en todos los indicadores de carga ──────────
function Hourglass({ size = 14 }: { size?: number }) {
  return (
    <svg
      fill="none"
      height={size * 1.45}
      style={{
        animation: "hg-flip 2.4s ease-in-out infinite",
        transformOrigin: "center",
        flexShrink: 0,
      }}
      viewBox="0 0 22 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
        @keyframes hg-flip {
          0%,40%  { transform: rotate(0deg); }
          50%,90% { transform: rotate(180deg); }
          100%    { transform: rotate(180deg); }
        }
      `}</style>
      <rect
        fill="currentColor"
        height="2.5"
        opacity="0.7"
        rx="0"
        width="20"
        x="1"
        y="0"
      />
      <rect
        fill="currentColor"
        height="2.5"
        opacity="0.7"
        rx="0"
        width="20"
        x="1"
        y="29.5"
      />
      <path
        d="M2 2.5 L11 16 L20 2.5 Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="0.8"
      />
      <path
        d="M2 29.5 L11 16 L20 29.5 Z"
        fill="currentColor"
        fillOpacity="0.5"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="0.8"
      />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type EntidadModal =
  | { tipo: "personaje"; data: any }
  | { tipo: "criatura"; data: any }
  | { tipo: "item"; data: any }
  | { tipo: "item_inv"; data: any };
type ToastType = "success" | "error";

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <MotionDiv
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-300 flex items-center gap-3 px-5 py-3 shadow-lg text-micro font-bold uppercase tracking-widest"
      exit={{ opacity: 0, y: 20 }}
      initial={{ opacity: 0, y: 20 }}
      style={{
        background:
          type === "success" ? "rgba(5,150,105,0.92)" : "rgba(185,28,28,0.92)",
        color: "var(--btn-text, #fff)",
        border: `1px solid ${type === "success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
        borderRadius: "1px",
        letterSpacing: "0.15em",
      }}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      {message}
    </MotionDiv>
  );
}

// ─── Panel Contenido ──────────────────────────────────────────────────────────
function PanelContenido({
  editMode,
  reinoSeleccionado,
  puntoSeleccionado,
  setPuntoSeleccionado,
  setDetallesReino,
  setModifiedDetalles,
  setReinoSeleccionado,
  personajesReino,
  personajesDesbloqueados,
  handlePersonajeClick,
  _modifiedDetalles,
  isSaving,
  handleSaveChanges,
  _isUploadingImg,
  _handleImageUpload,
  _imgInputRef,
  librosReino,
  _librosColeccion,
  capitulosReino,
  loadingLibros,
  personajesCiudad,
  criaturasCiudad,
  itemsCiudad,
  capitulosCiudad,
  loadingCiudad,
}: any) {
  const router = useRouter();
  if (editMode) {
    return (
      <div className="flex flex-col gap-4 grow">
        <div className="flex flex-col gap-1">
          <label
            className="text-micro font-bold uppercase tracking-widest ml-1"
            style={{
              color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
            }}
          >
            Nombre
          </label>
          <input
            className="input-brand font-bold uppercase text-xl outline-none px-4 py-3"
            style={{ borderRadius: "1px", letterSpacing: "0.08em" }}
            type="text"
            value={
              puntoSeleccionado
                ? puntoSeleccionado.nombre
                : reinoSeleccionado.nombre
            }
            onChange={(e) => {
              if (puntoSeleccionado) {
                setPuntoSeleccionado({
                  ...puntoSeleccionado,
                  nombre: e.target.value,
                });
                setDetallesReino((prev: any[]) =>
                  prev.map((p) =>
                    p.id === puntoSeleccionado.id
                      ? { ...p, nombre: e.target.value }
                      : p,
                  ),
                );
                setModifiedDetalles((prev: Set<string>) =>
                  new Set(prev).add(puntoSeleccionado.id),
                );
              } else
                setReinoSeleccionado({
                  ...reinoSeleccionado,
                  nombre: e.target.value,
                });
            }}
          />
        </div>
        <div className="flex flex-col gap-1 grow">
          <label
            className="text-micro font-bold uppercase tracking-widest ml-1"
            style={{
              color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
            }}
          >
            Descripción / Lore
          </label>
          <textarea
            className="input-brand text-sm italic leading-relaxed h-36 resize-none outline-none px-4 py-3"
            value={
              puntoSeleccionado
                ? puntoSeleccionado.descripcion
                : reinoSeleccionado.descripcion
            }
            onChange={(e) => {
              if (puntoSeleccionado) {
                setPuntoSeleccionado({
                  ...puntoSeleccionado,
                  descripcion: e.target.value,
                });
                setDetallesReino((prev: any[]) =>
                  prev.map((p) =>
                    p.id === puntoSeleccionado.id
                      ? { ...p, descripcion: e.target.value }
                      : p,
                  ),
                );
                setModifiedDetalles((prev: Set<string>) =>
                  new Set(prev).add(puntoSeleccionado.id),
                );
              } else
                setReinoSeleccionado({
                  ...reinoSeleccionado,
                  descripcion: e.target.value,
                });
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-micro font-bold uppercase tracking-widest ml-1 flex items-center gap-1"
            style={{
              color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
            }}
          >
            <Move size={9} /> Coordenadas
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              [
                "X",
                puntoSeleccionado
                  ? puntoSeleccionado.coord_x
                  : reinoSeleccionado.coord_x,
              ],
              [
                "Y",
                puntoSeleccionado
                  ? puntoSeleccionado.coord_y
                  : reinoSeleccionado.coord_y,
              ],
            ].map(([label, val]) => (
              <div
                key={label}
                className="p-3 text-center border"
                style={{
                  background:
                    "color-mix(in srgb, var(--bg-main) 70%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 20%, transparent)",
                }}
              >
                <span
                  className="block text-micro font-bold uppercase"
                  style={{
                    color:
                      "color-mix(in srgb, var(--foreground) 40%, transparent)",
                  }}
                >
                  {label}
                </span>
                <span
                  className="text-sm font-black"
                  style={{ color: "var(--accent)" }}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {!puntoSeleccionado && (
          <div
            className="flex items-center gap-2 px-3 py-2.5 border text-micro font-bold uppercase tracking-wide"
            style={{
              borderColor:
                "color-mix(in srgb, var(--primary) 15%, transparent)",
              background: "color-mix(in srgb, var(--primary) 6%, transparent)",
              color: "color-mix(in srgb, var(--foreground) 55%, transparent)",
            }}
          >
            <Move className="shrink-0" size={11} />
            Click en un espacio vacío del mapa para crear un tile, o doble-click
            en un tile para elegir su imagen.
          </div>
        )}
        <button
          className="btn-brand w-full justify-center text-micro uppercase py-4 mt-auto disabled:opacity-50"
          disabled={isSaving}
          style={{ letterSpacing: "0.12em" }}
          onClick={handleSaveChanges}
        >
          {isSaving ? <Hourglass size={14} /> : <Save size={14} />}
          Guardar cambios
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Title with decorative line */}
      <div className="relative mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
            }}
          />
          <div
            className="w-1.5 h-1.5 rotate-45"
            style={{ background: "var(--accent)" }}
          />
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to left, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
            }}
          />
        </div>
        <h2
          className="font-bold text-2xl uppercase tracking-[0.18em] leading-none text-center"
          style={{ fontFamily: "'Cinzel', serif", color: "var(--foreground)" }}
        >
          {puntoSeleccionado
            ? puntoSeleccionado.nombre
            : reinoSeleccionado.nombre}
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
            }}
          />
          <div
            className="w-1.5 h-1.5 rotate-45"
            style={{ background: "var(--accent)" }}
          />
          <div
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to left, transparent, color-mix(in srgb, var(--accent) 40%, transparent))`,
            }}
          />
        </div>
      </div>

      <div className="space-y-6 grow overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-accent/20">
        {/* Lore text */}
        <div
          className="relative p-5 border"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <div
            className="absolute top-0 left-0 w-3 h-3 border-t border-l"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 border-t border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 border-b border-l"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 border-b border-r"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          />
          <p
            className="text-sm italic leading-relaxed"
            style={{
              color: "color-mix(in srgb, var(--foreground) 70%, transparent)",
            }}
          >
            &ldquo;
            {puntoSeleccionado
              ? puntoSeleccionado.descripcion
              : reinoSeleccionado.descripcion}
            &rdquo;
          </p>
        </div>

        {/* ── Habitantes de la ciudad seleccionada ── */}
        {puntoSeleccionado &&
          (loadingCiudad ? (
            <div
              className="flex justify-center py-6"
              style={{
                color: "color-mix(in srgb, var(--accent) 50%, transparent)",
              }}
            >
              <Hourglass size={14} />
            </div>
          ) : (
            <>
              {/* Personajes */}
              {personajesCiudad.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      <User className="inline mr-1" size={8} />
                      Habitantes
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {personajesCiudad.map((p: any) => {
                      const desbloqueado = personajesDesbloqueados.has(p.id);
                      return (
                        <button
                          key={p.id}
                          className="flex items-center gap-2 p-2 w-full text-left transition-all"
                          style={{
                            background: desbloqueado
                              ? "color-mix(in srgb, var(--primary) 15%, transparent)"
                              : "color-mix(in srgb, var(--bg-main) 50%, transparent)",
                            border: `1px solid ${desbloqueado ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "color-mix(in srgb, var(--accent) 7%, transparent)"}`,
                            opacity: desbloqueado ? 1 : 0.5,
                            cursor: desbloqueado ? "pointer" : "default",
                          }}
                          onClick={
                            desbloqueado
                              ? () => handlePersonajeClick(p)
                              : undefined
                          }
                        >
                          <div
                            className="shrink-0 w-9 h-9 overflow-hidden flex items-center justify-center border"
                            style={{
                              borderColor: desbloqueado
                                ? "color-mix(in srgb, var(--accent) 25%, transparent)"
                                : "color-mix(in srgb, var(--accent) 8%, transparent)",
                              background:
                                "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                              filter: desbloqueado
                                ? "none"
                                : "grayscale(100%) blur(2px)",
                              borderRadius: "1px",
                            }}
                          >
                            {desbloqueado && p.img_url ? (
                              <Image
                                alt={p.nombre}
                                className="w-full h-full object-cover"
                                src={p.img_url}
                              />
                            ) : (
                              <UserX
                                size={14}
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--accent) 30%, transparent)",
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-micro font-semibold uppercase leading-tight truncate"
                              style={{
                                color: desbloqueado
                                  ? "var(--foreground)"
                                  : "color-mix(in srgb, var(--accent) 30%, transparent)",
                              }}
                            >
                              {desbloqueado ? p.nombre : "???"}
                            </p>
                            {p.especie && (
                              <p
                                className="text-micro mt-0.5 truncate"
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--accent) 55%, transparent)",
                                }}
                              >
                                {desbloqueado ? p.especie : "Desconocido"}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Criaturas */}
              {criaturasCiudad.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      <Bug className="inline mr-1" size={8} />
                      Criaturas avistadas
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {criaturasCiudad.map((c: any) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2.5 px-3 py-2 border"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 10%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--accent) 12%, transparent)",
                          borderRadius: "1px",
                        }}
                      >
                        <div
                          className="shrink-0 w-8 h-8 overflow-hidden border"
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--accent) 20%, transparent)",
                            background:
                              "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                            borderRadius: "1px",
                          }}
                        >
                          {c.imagen_url ? (
                            <Image
                              alt={c.nombre}
                              className="w-full h-full object-cover"
                              src={c.imagen_url}
                            />
                          ) : (
                            <Bug
                              className="m-auto mt-1"
                              size={14}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--accent) 40%, transparent)",
                              }}
                            />
                          )}
                        </div>
                        <p
                          className="text-micro font-semibold uppercase truncate"
                          style={{ color: "var(--foreground)" }}
                        >
                          {c.nombre}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items */}
              {itemsCiudad.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      <Package className="inline mr-1" size={8} />
                      Objetos encontrables
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {itemsCiudad.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2.5 px-3 py-2 border"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 10%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--accent) 12%, transparent)",
                          borderRadius: "1px",
                        }}
                      >
                        <div
                          className="shrink-0 w-8 h-8 overflow-hidden border"
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--accent) 20%, transparent)",
                            background:
                              "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                            borderRadius: "1px",
                          }}
                        >
                          {item.imagen_url ? (
                            <Image
                              alt={item.nombre}
                              className="w-full h-full object-cover"
                              src={item.imagen_url}
                            />
                          ) : (
                            <Package
                              className="m-auto mt-1"
                              size={14}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--accent) 40%, transparent)",
                              }}
                            />
                          )}
                        </div>
                        <p
                          className="text-micro font-semibold uppercase truncate"
                          style={{ color: "var(--foreground)" }}
                        >
                          {item.nombre}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capítulos que ocurren en esta ciudad (solo de colecciones: One Shot, Poemario…) */}
              {capitulosCiudad.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      <BookOpen className="inline mr-1" size={8} />
                      Capítulos aquí
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {capitulosCiudad.map((cap: any) => (
                      <button
                        key={cap.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 border w-full text-left transition-all hover:opacity-80 active:scale-[0.98]"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 10%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--accent) 12%, transparent)",
                          borderRadius: "1px",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          router.push(
                            `/garlia/libros/${cap.libro_id}/leer/${cap.id}`,
                          )
                        }
                      >
                        <BookMarked
                          size={12}
                          style={{
                            color:
                              "color-mix(in srgb, var(--accent) 55%, transparent)",
                            flexShrink: 0,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-micro font-semibold uppercase truncate"
                            style={{ color: "var(--foreground)" }}
                          >
                            {cap.titulo_capitulo ?? `Capítulo ${cap.orden}`}
                          </p>
                          {cap.libro_titulo && (
                            <p
                              className="text-micro mt-0.5 truncate"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--accent) 50%, transparent)",
                              }}
                            >
                              {cap.libro_categoria &&
                              cap.libro_categoria !== cap.libro_titulo
                                ? `${cap.libro_categoria} — ${cap.libro_titulo}`
                                : cap.libro_titulo}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Vacío */}
              {personajesCiudad.length === 0 &&
                criaturasCiudad.length === 0 &&
                itemsCiudad.length === 0 &&
                capitulosCiudad.length === 0 && (
                  <p
                    className="text-center text-micro font-black uppercase tracking-widest py-4"
                    style={{
                      color:
                        "color-mix(in srgb, var(--accent) 25%, transparent)",
                    }}
                  >
                    Sin habitantes registrados
                  </p>
                )}
            </>
          ))}

        {/* Characters grid — 2 per row, no "ver" button */}
        {!puntoSeleccionado && personajesReino.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "color-mix(in srgb, var(--accent) 20%, transparent)",
                }}
              />
              <span
                className="text-micro font-black uppercase tracking-[0.3em]"
                style={{
                  color: "color-mix(in srgb, var(--accent) 60%, transparent)",
                }}
              >
                Habitantes conocidos
              </span>
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "color-mix(in srgb, var(--accent) 20%, transparent)",
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {personajesReino.map((p: any) => {
                const desbloqueado = personajesDesbloqueados.has(p.id);
                return (
                  <button
                    key={p.id}
                    className="flex items-center gap-2 p-2 w-full text-left transition-all group"
                    style={{
                      background: desbloqueado
                        ? "color-mix(in srgb, var(--primary) 15%, transparent)"
                        : "color-mix(in srgb, var(--bg-main) 50%, transparent)",
                      border: `1px solid ${desbloqueado ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "color-mix(in srgb, var(--accent) 7%, transparent)"}`,
                      opacity: desbloqueado ? 1 : 0.5,
                      cursor: desbloqueado ? "pointer" : "default",
                    }}
                    onClick={
                      desbloqueado ? () => handlePersonajeClick(p) : undefined
                    }
                  >
                    {/* Avatar — izquierda */}
                    <div
                      className="shrink-0 w-10 h-10 overflow-hidden flex items-center justify-center border"
                      style={{
                        borderColor: desbloqueado
                          ? "color-mix(in srgb, var(--accent) 25%, transparent)"
                          : "color-mix(in srgb, var(--accent) 8%, transparent)",
                        background:
                          "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                        filter: desbloqueado
                          ? "none"
                          : "grayscale(100%) blur(2px)",
                        borderRadius: "1px",
                      }}
                    >
                      {desbloqueado && p.img_url ? (
                        <Image
                          alt={p.nombre}
                          className="w-full h-full object-cover"
                          src={p.img_url}
                        />
                      ) : (
                        <UserX
                          size={16}
                          style={{
                            color:
                              "color-mix(in srgb, var(--accent) 30%, transparent)",
                          }}
                        />
                      )}
                    </div>
                    {/* Nombre + especie — derecha */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-micro font-semibold uppercase leading-tight truncate"
                        style={{
                          color: desbloqueado
                            ? "var(--foreground)"
                            : "color-mix(in srgb, var(--accent) 30%, transparent)",
                          textDecoration: desbloqueado
                            ? "none"
                            : "line-through",
                          textDecorationColor:
                            "color-mix(in srgb, var(--accent) 30%, transparent)",
                        }}
                      >
                        {desbloqueado ? p.nombre : "???"}
                      </p>
                      {p.especie && (
                        <p
                          className="text-micro font-medium mt-0.5 truncate"
                          style={{
                            color:
                              "color-mix(in srgb, var(--accent) 55%, transparent)",
                          }}
                        >
                          {desbloqueado ? p.especie : "Desconocido"}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Books of this kingdom */}
        {!puntoSeleccionado &&
          (loadingLibros ? (
            <div
              className="flex justify-center py-6"
              style={{
                color: "color-mix(in srgb, var(--accent) 50%, transparent)",
              }}
            >
              <Hourglass size={14} />
            </div>
          ) : (
            <>
              {/* ── Libros propiamente dichos: portada + título + sinopsis, click navega al libro ── */}
              {librosReino && librosReino.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-[0.3em] flex items-center gap-1.5"
                      style={{
                        color:
                          "color-mix(in srgb, var(--accent) 60%, transparent)",
                      }}
                    >
                      <BookOpen size={9} /> Libros de este reino
                    </span>
                    <div
                      className="h-px flex-1"
                      style={{
                        background:
                          "color-mix(in srgb, var(--accent) 20%, transparent)",
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    {librosReino.map((libro: any) => (
                      <button
                        key={libro.id}
                        className="flex gap-3 p-3 border w-full text-left transition-all hover:opacity-80 active:scale-[0.98]"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 10%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--accent) 15%, transparent)",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          navegarRutaDinamica(`/garlia/libros/${libro.id}`, () =>
                            router.push(`/garlia/libros/${libro.id}`),
                          )
                        }
                      >
                        {libro.portada_url && (
                          <img
                            alt={libro.titulo}
                            className="w-14 h-20 object-cover shrink-0"
                            src={libro.portada_url}
                            style={{ filter: "brightness(0.92)" }}
                          />
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                          <p
                            className="text-sm font-bold uppercase leading-tight"
                            style={{
                              color: "var(--foreground)",
                              fontFamily: "'Cinzel', serif",
                            }}
                          >
                            {libro.titulo}
                          </p>
                          {libro.estado && (
                            <p
                              className="text-micro font-black uppercase"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--accent) 60%, transparent)",
                                letterSpacing: "0.12em",
                              }}
                            >
                              {libro.estado}
                            </p>
                          )}
                          {libro.sinopsis && (
                            <p
                              className="text-micro italic leading-snug line-clamp-3"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--foreground) 60%, transparent)",
                              }}
                            >
                              {libro.sinopsis}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Capítulos de colecciones (One Shot / Poemario), agrupados por libro ── */}
              {capitulosReino &&
                capitulosReino.length > 0 &&
                (() => {
                  // Agrupar por libro_id
                  const grupos: Record<
                    string,
                    { titulo: string; categoria: string; caps: any[] }
                  > = {};
                  for (const cap of capitulosReino) {
                    const lid = cap.libro_id ?? "sin_libro";
                    if (!grupos[lid])
                      grupos[lid] = {
                        titulo: cap.libro_titulo ?? "Sin título",
                        categoria: cap.libro_categoria ?? "",
                        caps: [],
                      };
                    grupos[lid].caps.push(cap);
                  }
                  return Object.entries(grupos).map(([libroId, grupo]) => (
                    <div key={libroId}>
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="h-px flex-1"
                          style={{
                            background:
                              "color-mix(in srgb, var(--accent) 20%, transparent)",
                          }}
                        />
                        <span
                          className="text-micro font-black uppercase tracking-[0.3em] flex items-center gap-1.5"
                          style={{
                            color:
                              "color-mix(in srgb, var(--accent) 60%, transparent)",
                          }}
                        >
                          <BookMarked size={9} />
                          {grupo.categoria && grupo.categoria !== "Libro"
                            ? grupo.categoria
                            : grupo.titulo}
                          {grupo.categoria && grupo.categoria !== "Libro" && (
                            <span className="font-normal opacity-70">
                              — {grupo.titulo}
                            </span>
                          )}
                        </span>
                        <div
                          className="h-px flex-1"
                          style={{
                            background:
                              "color-mix(in srgb, var(--accent) 20%, transparent)",
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {grupo.caps.map((cap: any) => (
                          <button
                            key={cap.id}
                            className="flex items-center gap-2 px-3 py-2.5 border w-full text-left transition-all hover:opacity-80 active:scale-[0.98]"
                            style={{
                              background:
                                "color-mix(in srgb, var(--primary) 8%, transparent)",
                              borderColor:
                                "color-mix(in srgb, var(--accent) 10%, transparent)",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              router.push(
                                `/garlia/libros/${cap.libro_id}/leer/${cap.id}`,
                              )
                            }
                          >
                            <span
                              className="text-micro font-black shrink-0 px-1.5 py-0.5"
                              style={{
                                background:
                                  "color-mix(in srgb, var(--accent) 12%, transparent)",
                                color: "var(--accent)",
                              }}
                            >
                              {cap.orden}
                            </span>
                            <p
                              className="text-micro font-semibold uppercase truncate flex-1 min-w-0"
                              style={{ color: "var(--foreground)" }}
                            >
                              {cap.titulo_capitulo ?? `Capítulo ${cap.orden}`}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
            </>
          ))}
      </div>
    </>
  );
}

// ─── Canvas Map ───────────────────────────────────────────────────────────────
interface CanvasMapProps {
  imageSrc: string;
  markers: any[];
  hiddenMarkers: any[]; // markers that are hidden (fog covered)
  editMode: boolean;
  onMarkerClick: (marker: any) => void;
  onMapClick: (
    x: number,
    y: number,
    tile_col?: number,
    tile_row?: number,
  ) => void;
  selectedMarkerId?: string | null;
  tipo: "global" | "reino";
  isFirstOpen?: boolean; // true only the very first time the map opens in a session
  fondoColor?: string | null; // color de fondo del mar (guardado en Supabase)
  eyedropperActive?: boolean; // cuando está activo, el siguiente click samplea el color
  onEyedropperPick?: (color: string) => void; // devuelve el hex del pixel clickeado
}

function CanvasMap({
  imageSrc,
  markers,
  hiddenMarkers,
  editMode,
  onMarkerClick,
  onMapClick,
  selectedMarkerId,
  tipo,
  onOpenPanel,
  isFirstOpen,
  fondoColor,
  eyedropperActive,
  onEyedropperPick,
}: CanvasMapProps & { onOpenPanel?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  // showCompass: true while compass should be displayed (first open only, ≥5s)
  const [showCompass, setShowCompass] = useState(true);
  // mapFading: subtle fade overlay when switching maps (non-first transitions)
  const [mapFading, setMapFading] = useState(false);
  const compassTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // hasShownCompass: consumed once — prevents re-showing compass on subsequent imageSrc changes
  const hasShownCompassRef = useRef(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number>(0);
  // Camera state
  const camRef = useRef({ x: 0, y: 0, scale: 1 });
  // Factor backing-store/CSS del canvas, actualizado solo en resize — evita
  // tener que leer el DOM (getBoundingClientRect, que fuerza reflow) en cada
  // evento de mousemove/touchmove durante el pan.
  const renderScaleRef = useRef(1);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  // Pinch
  const lastPinchDist = useRef<number | null>(null);
  // Pulse animation
  const pulseRef = useRef(0);
  const compassStartRef = useRef<number | null>(null); // timestamp when compass started spinning
  // Theme CSS vars read at draw time
  const cssColorsRef = useRef({
    primary: "#6b4423",
    accent: "#c08040",
    bg: "#f0e6d0",
    fg: "#2a1304",
    bgMenu: "#3d2010",
    parchBg: "#3d2010",
    parchText: "#2a1304",
    whiteCustom: "#fdf6ee",
    isDark: false,
    labelBg: "#fdf6ee",
    labelText: "#2a1304",
  });
  // Fog cache — rebuilt only when markers/size change, not every frame
  const fogCacheRef = useRef<{
    canvas: OffscreenCanvas;
    deep: OffscreenCanvas;
    iw: number;
    ih: number;
    bg: string;
  } | null>(null);

  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const get = (v: string) => s.getPropertyValue(v).trim();
      const bgMain = get("--bg-main") || "#f0e6d0";
      const wc = get("--white-custom") || "#fdf6ee";
      const fgColor = get("--foreground") || "#2a1304";
      const bgMenuColor = get("--bg-menu") || "#3d2010";
      // Detect dark theme by luminance of --bg-main
      const hexToLuma = (hex: string) => {
        const h = hex.replace("#", "");
        if (h.length < 6) return 0.5;
        const r = parseInt(h.slice(0, 2), 16) / 255;
        const g = parseInt(h.slice(2, 4), 16) / 255;
        const b = parseInt(h.slice(4, 6), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const dark = hexToLuma(bgMain) < 0.35;
      // In light themes: label bg = white-custom (light), text = foreground (dark)
      // In dark themes:  label bg = bg-menu (dark), text = foreground (light)
      cssColorsRef.current = {
        primary: get("--primary") || "#6b4423",
        accent: get("--accent") || "#c08040",
        bg: bgMain,
        fg: fgColor,
        bgMenu: bgMenuColor,
        parchBg: bgMenuColor,
        parchText: fgColor,
        whiteCustom: wc,
        isDark: dark,
        labelBg: dark ? bgMenuColor : wc,
        labelText: fgColor,
      };
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => obs.disconnect();
  }, []);

  const centerImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const scale =
      Math.min(canvas.width / img.width, canvas.height / img.height) * 0.95;
    camRef.current = {
      x: (canvas.width - img.width * scale) / 2,
      y: (canvas.height - img.height * scale) / 2,
      scale,
    };
  }, []);

  useEffect(() => {
    // Clear any pending compass timer
    if (compassTimerRef.current) clearTimeout(compassTimerRef.current);

    // shouldShowCompass: only true the very first time this component loads
    const shouldShowCompass = isFirstOpen && !hasShownCompassRef.current;

    if (shouldShowCompass) {
      // First open: show full compass animation — mark it as consumed immediately
      hasShownCompassRef.current = true;
      setShowCompass(true);
      setMapFading(false);
    } else {
      // Any subsequent image change: subtle fade overlay, no compass
      setShowCompass(false);
      if (hasShownCompassRef.current) {
        // Only fade if we've already shown the first load (not during initial mount)
        setMapFading(true);
        setTimeout(() => setMapFading(false), 600);
      }
    }

    setImgLoaded(false);
    compassStartRef.current = null;
    imgRef.current = null;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      centerImage();
      setImgLoaded(true);
      if (shouldShowCompass) {
        // Keep compass visible for at least 5 seconds after the image is ready
        compassTimerRef.current = setTimeout(() => setShowCompass(false), 5000);
      } else {
        setShowCompass(false);
      }
    };
    img.onerror = () => {
      setTimeout(() => {
        const retry = new window.Image();
        retry.crossOrigin = "anonymous";
        retry.src =
          imageSrc + (imageSrc.includes("?") ? "&" : "?") + "_r=" + Date.now();
        retry.onload = () => {
          imgRef.current = retry;
          centerImage();
          setImgLoaded(true);
          if (shouldShowCompass) {
            compassTimerRef.current = setTimeout(
              () => setShowCompass(false),
              5000,
            );
          } else {
            setShowCompass(false);
          }
        };
      }, 800);
    };
    return () => {
      if (compassTimerRef.current) clearTimeout(compassTimerRef.current);
    };
  }, [imageSrc, centerImage, isFirstOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // En compu la ventana puede ser varias veces más grande (en px CSS) que
    // una pantalla de celular — y el costo por frame (clearRect/fillRect/
    // drawImage) escala directo con la cantidad de píxeles del canvas. Sin
    // capar esto, una ventana grande de escritorio hace 5-6x más trabajo por
    // frame que un celular, aunque el hardware sea mejor. Capamos la
    // resolución interna y dejamos que el CSS (w-full h-full) estire el
    // canvas para llenar el contenedor igual.
    const MAX_DIM = 1400;
    const capDims = (w: number, h: number) => {
      const largest = Math.max(w, h);
      if (largest <= MAX_DIM) return { w, h };
      const f = MAX_DIM / largest;
      return { w: Math.round(w * f), h: Math.round(h * f) };
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const updateScaleRef = (canvasW: number) => {
      const cw = container.clientWidth;
      renderScaleRef.current = cw ? canvasW / cw : 1;
    };

    const resize = () => {
      const { w: newW, h: newH } = capDims(
        container.clientWidth,
        container.clientHeight,
      );
      // El factor de escala se actualiza siempre (es barato), aunque no haga
      // falta reasignar canvas.width — si no, onMouseMove/onPointerMove
      // quedarían con un factor viejo y el pan se desalinearía.
      updateScaleRef(newW);
      // Si el tamaño no cambió, no tocar el canvas — evita parpadeo por limpieza
      if (canvas.width === newW && canvas.height === newH) return;
      // Debounce: durante la animación del panel el contenedor cambia frame a frame.
      // Esperamos a que se detenga antes de reasignar canvas.width (lo que lo borra).
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const { w: finalW, h: finalH } = capDims(
          container.clientWidth,
          container.clientHeight,
        );
        updateScaleRef(finalW);
        if (canvas.width === finalW && canvas.height === finalH) return;
        canvas.width = finalW;
        canvas.height = finalH;
        if (imgRef.current) centerImage();
      }, 150); // 150ms — más que un frame, menos que la animación del panel (350ms)
    };

    // Primera llamada inmediata (sin debounce, el panel no está animando todavía)
    const initial = capDims(container.clientWidth, container.clientHeight);
    canvas.width = initial.w;
    canvas.height = initial.h;
    updateScaleRef(initial.w);
    if (imgRef.current) centerImage();

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => {
      ro.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [centerImage]);

  // ── Render loop with fog effect ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cap to ~30fps on mobile to avoid lag and battery drain
    const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(
      navigator.userAgent,
    );
    const FRAME_MS = isMobileDevice ? 34 : 16;
    let lastFrameTime = 0;

    // Cache vignette so it's not rebuilt every frame
    let vignetteCanvas: OffscreenCanvas | null = null;
    let vignetteW = 0;
    let vignetteH = 0;
    let vignetteBg = "";

    const draw = (t: number) => {
      // Throttle frame rate on mobile
      if (t - lastFrameTime < FRAME_MS) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = t;

      pulseRef.current = t;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const {
        primary,
        accent,
        bg,
        fg: _fg,
        parchBg: _parchBg,
        parchText: _parchText,
        whiteCustom,
        isDark: _isDark,
        labelBg,
        labelText,
      } = cssColorsRef.current;

      ctx.fillStyle = fondoColor || bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { x: cx, y: cy, scale } = camRef.current;
      const img = imgRef.current;

      if (img && imgLoaded && !showCompass) {
        const iw = img.width * scale;
        const ih = img.height * scale;

        ctx.save();
        ctx.translate(cx, cy);

        // ── Draw base map ──────────────────────────────────────────────────
        // Este loop redibuja SIEMPRE (sin dirty-flag) por el pulso continuo de
        // los pines, así que reescalar la imagen entera del mapa a resolución
        // nativa en cada frame es carísimo. Recortamos al viewport visible y
        // bajamos la calidad de resampling — el mapa no necesita reescalarse
        // fuera de lo que efectivamente se ve en pantalla.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "low";

        const visX0 = Math.max(0, -cx);
        const visY0 = Math.max(0, -cy);
        const visX1 = Math.min(iw, canvas.width - cx);
        const visY1 = Math.min(ih, canvas.height - cy);

        if (visX1 > visX0 && visY1 > visY0) {
          const srcX0 = visX0 / scale;
          const srcY0 = visY0 / scale;
          const srcW = (visX1 - visX0) / scale;
          const srcH = (visY1 - visY0) / scale;
          ctx.drawImage(
            img,
            srcX0,
            srcY0,
            srcW,
            srcH,
            visX0,
            visY0,
            visX1 - visX0,
            visY1 - visY0,
          );
        }

        // ── FOG OF WAR — cached, rebuilt only when markers/bg changes ─────
        if (tipo === "global" && !editMode && hiddenMarkers.length > 0) {
          const cache = fogCacheRef.current;
          const FOG_W = Math.min(img.width, 1200);
          const FOG_H = Math.round(FOG_W * (img.height / img.width));
          const fogBg = fondoColor || bg;

          const needsRebuild =
            !cache ||
            cache.iw !== FOG_W ||
            cache.ih !== FOG_H ||
            cache.bg !== fogBg;

          if (needsRebuild) {
            const maxDim = Math.max(FOG_W, FOG_H);
            const clearRadius = maxDim * 0.05;
            const fadeRadius = maxDim * 0.12;

            // ── Layer 1: main opaque fog with reveal holes ────────────────
            const fogCanvas = new OffscreenCanvas(FOG_W, FOG_H);
            const fogCtx = fogCanvas.getContext("2d")!;

            fogCtx.fillStyle = fogBg;
            fogCtx.globalAlpha = 0.92;
            fogCtx.fillRect(0, 0, FOG_W, FOG_H);
            fogCtx.globalAlpha = 1;

            fogCtx.globalCompositeOperation = "destination-out";
            for (const m of markers) {
              const mx = (m.coord_x / 100) * FOG_W;
              const my = (m.coord_y / 100) * FOG_H;
              const grad = fogCtx.createRadialGradient(
                mx,
                my,
                clearRadius * 0.2,
                mx,
                my,
                fadeRadius,
              );
              grad.addColorStop(0, "rgba(0,0,0,1)");
              grad.addColorStop(0.45, "rgba(0,0,0,0.98)");
              grad.addColorStop(0.72, "rgba(0,0,0,0.7)");
              grad.addColorStop(0.88, "rgba(0,0,0,0.25)");
              grad.addColorStop(1, "rgba(0,0,0,0)");
              fogCtx.fillStyle = grad;
              fogCtx.beginPath();
              fogCtx.arc(mx, my, fadeRadius, 0, Math.PI * 2);
              fogCtx.fill();
            }
            fogCtx.globalCompositeOperation = "source-over";

            // ── Layer 2: semi-transparent overlay for depth ───────────────
            const deepCanvas = new OffscreenCanvas(FOG_W, FOG_H);
            const deepCtx = deepCanvas.getContext("2d")!;
            deepCtx.fillStyle = fogBg;
            deepCtx.globalAlpha = 0.45;
            deepCtx.fillRect(0, 0, FOG_W, FOG_H);
            deepCtx.globalAlpha = 1;
            deepCtx.globalCompositeOperation = "destination-out";
            for (const m of markers) {
              const mx = (m.coord_x / 100) * FOG_W;
              const my = (m.coord_y / 100) * FOG_H;
              const grad2 = deepCtx.createRadialGradient(
                mx,
                my,
                clearRadius * 0.5,
                mx,
                my,
                fadeRadius * 0.7,
              );
              grad2.addColorStop(0, "rgba(0,0,0,1)");
              grad2.addColorStop(0.6, "rgba(0,0,0,0.85)");
              grad2.addColorStop(1, "rgba(0,0,0,0)");
              deepCtx.fillStyle = grad2;
              deepCtx.beginPath();
              deepCtx.arc(mx, my, fadeRadius * 0.7, 0, Math.PI * 2);
              deepCtx.fill();
            }
            deepCtx.globalCompositeOperation = "source-over";

            fogCacheRef.current = {
              canvas: fogCanvas,
              deep: deepCanvas,
              iw: FOG_W,
              ih: FOG_H,
              bg: fogBg,
            };
          }

          const fc = fogCacheRef.current!;
          ctx.drawImage(fc.canvas, 0, 0, iw, ih);
          ctx.drawImage(fc.deep, 0, 0, iw, ih);
        }

        // No internal map vignette — edge fog handles blending instead

        ctx.restore();

        // ── Draw visible markers ──────────────────────────────────────────
        for (const m of markers) {
          const mx = cx + (m.coord_x / 100) * (img.width * scale);
          const my = cy + (m.coord_y / 100) * (img.height * scale);
          const isSelected = m.id === selectedMarkerId;
          const pulse = (Math.sin(t * 0.002 + m.coord_x) + 1) / 2;

          ctx.save();
          ctx.translate(mx, my);

          // ── Antique map pin — teardrop with body ─────────────────────────
          // Pin body uses --white-custom, same as panel surfaces
          const pinBody = whiteCustom;
          const pinBorder = isSelected ? primary : `${primary}88`;
          const pinRing = isSelected ? `${accent}99` : `${primary}55`;
          const pinDot = accent;

          // Pin dimensions
          const headR = isSelected ? 9 : 7; // circle head radius
          const tailH = isSelected ? 14 : 11; // tail length below head

          // Drop shadow (offset, no blur on canvas so fake with alpha)
          ctx.save();
          ctx.translate(1.5, 2);
          ctx.globalAlpha = 0.22;
          ctx.beginPath();
          ctx.arc(0, -tailH * 0.4, headR, 0, Math.PI * 2);
          ctx.fillStyle = "#000";
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-headR * 0.4, -tailH * 0.15);
          ctx.quadraticCurveTo(0, tailH * 0.6, 0, tailH * 0.85);
          ctx.quadraticCurveTo(0, tailH * 0.6, headR * 0.4, -tailH * 0.15);
          ctx.fillStyle = "#000";
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = 1;

          // Tail (teardrop point, drawn first so head covers seam)
          ctx.beginPath();
          ctx.moveTo(-headR * 0.42, -tailH * 0.18);
          ctx.quadraticCurveTo(-headR * 0.15, tailH * 0.55, 0, tailH);
          ctx.quadraticCurveTo(
            headR * 0.15,
            tailH * 0.55,
            headR * 0.42,
            -tailH * 0.18,
          );
          ctx.fillStyle = pinBody;
          ctx.fill();
          ctx.strokeStyle = pinBorder;
          ctx.lineWidth = isSelected ? 1.2 : 0.9;
          ctx.stroke();

          // Head circle (filled)
          ctx.beginPath();
          ctx.arc(0, -tailH * 0.4, headR, 0, Math.PI * 2);
          ctx.fillStyle = pinBody;
          ctx.fill();
          ctx.strokeStyle = pinBorder;
          ctx.lineWidth = isSelected ? 1.4 : 1.0;
          ctx.stroke();

          // Inner ring — lighter, gives depth
          ctx.beginPath();
          ctx.arc(0, -tailH * 0.4, headR * 0.52, 0, Math.PI * 2);
          ctx.strokeStyle = pinRing;
          ctx.lineWidth = isSelected ? 1.0 : 0.7;
          ctx.stroke();

          // Center dot
          ctx.beginPath();
          ctx.arc(0, -tailH * 0.4, isSelected ? 2.2 : 1.6, 0, Math.PI * 2);
          ctx.fillStyle = pinDot;
          ctx.fill();

          // Subtle pulsing outer ring (very faint, only visible)
          if (!editMode) {
            const haloR = headR + 3 + pulse * 3;
            ctx.beginPath();
            ctx.arc(0, -tailH * 0.4, haloR, 0, Math.PI * 2);
            ctx.strokeStyle = isSelected
              ? `${accent}${Math.round(0.22 * (1 - pulse) * 255)
                  .toString(16)
                  .padStart(2, "0")}`
              : `${primary}${Math.round(0.15 * (1 - pulse) * 255)
                  .toString(16)
                  .padStart(2, "0")}`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }

          if (editMode) {
            ctx.beginPath();
            ctx.arc(headR, -tailH * 0.4 - headR, 3, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.fill();
            if (true) {
              ctx.beginPath();
              ctx.arc(-headR, -tailH * 0.4 - headR, 3, 0, Math.PI * 2);
              ctx.fillStyle = "#f97316";
              ctx.fill();
            }
          }

          // ── Label — themed background strip ──────────────────────────────
          const fontSize = scale > 0.7 ? 10 : 9;
          ctx.font = `${isSelected ? "600" : "500"} ${fontSize}px 'Cinzel', serif`;
          ctx.textAlign = "center";
          const label = m.nombre;
          const metrics = ctx.measureText(label);
          const lw = metrics.width + 12;
          const lh = fontSize + 6;
          const labelY = -(tailH * 0.4 + headR + lh + 5);

          // Background from theme — smart light/dark
          ctx.fillStyle = isSelected ? `${labelBg}f0` : `${labelBg}d8`;
          ctx.beginPath();
          ctx.rect(-lw / 2, labelY, lw, lh);
          ctx.fill();

          // Border from primary
          ctx.strokeStyle = isSelected ? `${primary}88` : `${primary}44`;
          ctx.lineWidth = 0.6;
          ctx.stroke();

          // Text — always contrasting with labelBg
          ctx.fillStyle = isSelected ? labelText : `${labelText}ee`;
          ctx.fillText(label, 0, labelY + lh - 4);

          ctx.restore();
        }

        // ── Draw hidden markers (admin only, faded) ───────────────────────
        if (editMode) {
          for (const m of hiddenMarkers) {
            const mx = cx + (m.coord_x / 100) * (img.width * scale);
            const my = cy + (m.coord_y / 100) * (img.height * scale);
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.translate(mx, my);
            ctx.save();
            // Small teardrop, orange-tinted for hidden
            const hR = 5;
            const hT = 8;
            ctx.beginPath();
            ctx.moveTo(-hR * 0.4, -hT * 0.18);
            ctx.quadraticCurveTo(-hR * 0.1, hT * 0.5, 0, hT);
            ctx.quadraticCurveTo(hR * 0.1, hT * 0.5, hR * 0.4, -hT * 0.18);
            ctx.fillStyle = "rgba(180,90,20,0.7)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, -hT * 0.4, hR, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(180,90,20,0.7)";
            ctx.fill();
            ctx.strokeStyle = "rgba(120,55,10,0.6)";
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();
            ctx.font = `bold 9px 'Cinzel', serif`;
            ctx.textAlign = "center";
            const label = m.nombre;
            const metrics = ctx.measureText(label);
            const lw = metrics.width + 12;
            ctx.fillStyle = `${bg}cc`;
            ctx.beginPath();
            ctx.rect(-lw / 2, -27, lw, 14);
            ctx.fill();
            ctx.fillStyle = "#f97316";
            ctx.fillText(label, 0, -17);
            ctx.restore();
          }
        }
      } else if (!img || !imgLoaded || showCompass) {
        // ── Antique compass rose — shown on first open for ≥5s, or while image loads ──
        const { accent, primary: _primary, isDark: _isDark } = cssColorsRef.current;
        const cx2 = canvas.width / 2;
        const cy2 = canvas.height / 2;

        // Track when the compass first appeared
        if (compassStartRef.current === null) compassStartRef.current = t;
        const elapsed = t - compassStartRef.current;
        const SPIN_DURATION = 9000; // ms to complete the spin
        const progress = Math.min(elapsed / SPIN_DURATION, 1);
        // ease-out quint: very gradual deceleration
        const eased = 1 - Math.pow(1 - progress, 5);

        // Outer ring: 1 full rotation; inner rose: 1.5 rotations (opposite)
        const angleOuter = eased * Math.PI * 2;
        const angleInner = -eased * Math.PI * 3;

        // Pulse fades in, then settles once stopped
        // When image is loaded but still in 5s hold window, fade the compass out
        // compassStartRef tracks when compass first appeared; 5s hold starts at load
        // We fade out in the last 1.2s of the 5s window via imgLoaded flag
        const basePulse =
          progress < 1 ? 0.55 + 0.2 * Math.sin(t * 0.0018) : 0.65;
        const pulse = basePulse;

        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.translate(cx2, cy2);

        const R = Math.min(canvas.width, canvas.height) * 0.22; // overall scale

        // ── Outer ring with tick marks ──────────────────────────────────
        ctx.save();
        ctx.rotate(angleOuter);
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.strokeStyle = `${accent}55`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 9]);
        ctx.stroke();
        ctx.setLineDash([]);
        // 16 tick marks
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const long = i % 4 === 0;
          const r1 = long ? R * 0.84 : R * 0.9;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
          ctx.strokeStyle = long ? `${accent}77` : `${accent}40`;
          ctx.lineWidth = long ? 1.2 : 0.6;
          ctx.stroke();
        }
        // Second inner ring
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = `${accent}30`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.restore();

        // ── 8-pointed compass rose ────────────────────────────────────
        ctx.save();
        ctx.rotate(angleInner);
        const drawPoint = (len: number, width: number, alpha: number) => {
          ctx.beginPath();
          ctx.moveTo(0, -len);
          ctx.lineTo(-width, 0);
          ctx.lineTo(0, len * 0.18);
          ctx.lineTo(width, 0);
          ctx.closePath();
          ctx.fillStyle =
            accent +
            Math.round(alpha * 255)
              .toString(16)
              .padStart(2, "0");
          ctx.fill();
        };
        // 4 cardinal points
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i / 4) * Math.PI * 2);
          drawPoint(R * 0.62, R * 0.07, i === 0 ? 0.85 : 0.45);
          ctx.restore();
        }
        // 4 diagonal points (smaller)
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i / 4) * Math.PI * 2 + Math.PI / 4);
          drawPoint(R * 0.38, R * 0.045, 0.28);
          ctx.restore();
        }
        // Center jewel
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.09, 0, Math.PI * 2);
        ctx.strokeStyle = `${accent}66`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.045, 0, Math.PI * 2);
        ctx.fillStyle = `${accent}cc`;
        ctx.fill();
        ctx.restore();

        ctx.restore();
      }

      // ── Edge vignette — subtle fade at canvas borders ─────────────────
      // Rebuild only when canvas size or bg color changes
      const { bg: bgNow } = cssColorsRef.current;
      const vigBg = fondoColor || bgNow;
      if (
        !vignetteCanvas ||
        vignetteW !== canvas.width ||
        vignetteH !== canvas.height ||
        vignetteBg !== vigBg
      ) {
        vignetteW = canvas.width;
        vignetteH = canvas.height;
        vignetteBg = vigBg;
        vignetteCanvas = new OffscreenCanvas(vignetteW, vignetteH);
        const vc = vignetteCanvas.getContext("2d")!;
        // Smaller fade zones — 18% of each dimension instead of 45%
        const eT = vignetteH * 0.18;
        const eS = vignetteW * 0.18;

        const topFog = vc.createLinearGradient(0, 0, 0, eT);
        topFog.addColorStop(0, `${vigBg}cc`);
        topFog.addColorStop(0.4, `${vigBg}55`);
        topFog.addColorStop(1, `${vigBg}00`);
        vc.fillStyle = topFog;
        vc.fillRect(0, 0, vignetteW, eT);

        const botFog = vc.createLinearGradient(0, vignetteH - eT, 0, vignetteH);
        botFog.addColorStop(0, `${vigBg}00`);
        botFog.addColorStop(0.6, `${vigBg}55`);
        botFog.addColorStop(1, `${vigBg}cc`);
        vc.fillStyle = botFog;
        vc.fillRect(0, vignetteH - eT, vignetteW, eT);

        const leftFog = vc.createLinearGradient(0, 0, eS, 0);
        leftFog.addColorStop(0, `${vigBg}cc`);
        leftFog.addColorStop(0.4, `${vigBg}44`);
        leftFog.addColorStop(1, `${vigBg}00`);
        vc.fillStyle = leftFog;
        vc.fillRect(0, 0, eS, vignetteH);

        const rightFog = vc.createLinearGradient(
          vignetteW - eS,
          0,
          vignetteW,
          0,
        );
        rightFog.addColorStop(0, `${vigBg}00`);
        rightFog.addColorStop(0.6, `${vigBg}44`);
        rightFog.addColorStop(1, `${vigBg}cc`);
        vc.fillStyle = rightFog;
        vc.fillRect(vignetteW - eS, 0, eS, vignetteH);
      }
      ctx.drawImage(vignetteCanvas, 0, 0);

      animFrameRef.current = requestAnimationFrame(draw);
    };
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [
    imgLoaded,
    showCompass,
    markers,
    hiddenMarkers,
    editMode,
    selectedMarkerId,
    tipo,
    fondoColor,
  ]);

  // Invalidate fog cache when markers, edit mode, or fondoColor changes
  useEffect(() => {
    fogCacheRef.current = null;
  }, [markers, editMode, tipo, fondoColor]);

  const hitTest = useCallback(
    (clientX: number, clientY: number): any | null => {
      const canvas = canvasRef.current;
      if (!canvas || !imgRef.current) return null;
      const rect = canvas.getBoundingClientRect();
      const s = canvas.width / rect.width;
      const px = (clientX - rect.left) * s;
      const py = (clientY - rect.top) * s;
      const { x: cx, y: cy, scale } = camRef.current;
      const iw = imgRef.current.width * scale;
      const ih = imgRef.current.height * scale;
      for (const m of [...markers].reverse()) {
        const mx = cx + (m.coord_x / 100) * iw;
        const my = cy + (m.coord_y / 100) * ih;
        const dist = Math.hypot(px - mx, py - my);
        if (dist < 16) return m;
      }
      return null;
    },
    [markers],
  );

  const canvasToMapPct = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const canvas = canvasRef.current;
      if (!canvas || !imgRef.current) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      const s = canvas.width / rect.width;
      const px = (clientX - rect.left) * s;
      const py = (clientY - rect.top) * s;
      const { x: cx, y: cy, scale } = camRef.current;
      const iw = imgRef.current.width * scale;
      const ih = imgRef.current.height * scale;
      const x = parseFloat((((px - cx) / iw) * 100).toFixed(2));
      const y = parseFloat((((py - cy) / ih) * 100).toFixed(2));
      return [x, y];
    },
    [],
  );

  const zoom = useCallback(
    (factor: number, pivotX?: number, pivotY?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const px = pivotX ?? canvas.width / 2;
      const py = pivotY ?? canvas.height / 2;
      const cam = camRef.current;
      const newScale = Math.min(8, Math.max(0.2, cam.scale * factor));
      const sf = newScale / cam.scale;
      cam.x = px - sf * (px - cam.x);
      cam.y = py - sf * (py - cam.y);
      cam.scale = newScale;
    },
    [],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      camX: camRef.current.x,
      camY: camRef.current.y,
    };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const s = renderScaleRef.current;
    const dx = (e.clientX - dragStart.current.x) * s;
    const dy = (e.clientY - dragStart.current.y) * s;
    if (Math.hypot(dx, dy) > 3) isDragging.current = true;
    if (isDragging.current) {
      camRef.current.x = dragStart.current.camX + dx;
      camRef.current.y = dragStart.current.camY + dy;
    }
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) {
      // ── Eyedropper mode — sample pixel color from the map image ──────
      if (eyedropperActive && onEyedropperPick) {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (canvas && img) {
          const rect = canvas.getBoundingClientRect();
          const s = canvas.width / rect.width;
          const px = (e.clientX - rect.left) * s;
          const py = (e.clientY - rect.top) * s;
          // Sample from the image at clicked position (account for camera transform)
          const { x: cx, y: cy, scale } = camRef.current;
          const imgX = Math.round((px - cx) / scale);
          const imgY = Math.round((py - cy) / scale);
          // Draw just the image to a tiny offscreen canvas to read pixel
          const tmp = new OffscreenCanvas(img.width, img.height);
          const tmpCtx = tmp.getContext("2d")!;
          tmpCtx.drawImage(img, 0, 0);
          const pixel = tmpCtx.getImageData(
            Math.max(0, Math.min(imgX, img.width - 1)),
            Math.max(0, Math.min(imgY, img.height - 1)),
            1,
            1,
          ).data;
          const hex =
            "#" +
            [pixel[0], pixel[1], pixel[2]]
              .map((v) => v.toString(16).padStart(2, "0"))
              .join("");
          onEyedropperPick(hex);
        }
        return;
      }
      if (editMode) {
        const hit = hitTest(e.clientX, e.clientY);
        if (hit) {
          onMarkerClick(hit);
          return;
        }
        const [x, y] = canvasToMapPct(e.clientX, e.clientY);
        onMapClick(x, y);
      } else {
        const hit = hitTest(e.clientX, e.clientY);
        if (hit) onMarkerClick(hit);
      }
    }
    isDragging.current = false;
  };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = canvas.width / rect.width;
    zoom(factor, (e.clientX - rect.left) * s, (e.clientY - rect.top) * s);
  };

  const touchStartHandler = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      isDragging.current = false;
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        camX: camRef.current.x,
        camY: camRef.current.y,
      };
      lastPinchDist.current = null;
    } else if (e.touches.length === 2) {
      e.preventDefault();
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    }
  }, []);

  const touchMoveHandler = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      const s = renderScaleRef.current;
      if (e.touches.length === 1) {
        const dx = (e.touches[0].clientX - dragStart.current.x) * s;
        const dy = (e.touches[0].clientY - dragStart.current.y) * s;
        if (Math.hypot(dx, dy) > 3) isDragging.current = true;
        if (isDragging.current) {
          camRef.current.x = dragStart.current.camX + dx;
          camRef.current.y = dragStart.current.camY + dy;
        }
      } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const pivotX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const pivotY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect)
          zoom(
            dist / lastPinchDist.current,
            (pivotX - rect.left) * s,
            (pivotY - rect.top) * s,
          );
        lastPinchDist.current = dist;
      }
    },
    [zoom],
  );

  const touchEndHandler = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          camX: camRef.current.x,
          camY: camRef.current.y,
        };
        isDragging.current = false;
        lastPinchDist.current = null;
        return;
      }
      if (
        !isDragging.current &&
        e.changedTouches.length === 1 &&
        e.touches.length === 0
      ) {
        const t = e.changedTouches[0];
        const hit = hitTest(t.clientX, t.clientY);
        if (hit) onMarkerClick(hit);
      }
      isDragging.current = false;
      lastPinchDist.current = null;
    },
    [hitTest, onMarkerClick],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const opts = { passive: false };
    canvas.addEventListener("touchstart", touchStartHandler, opts);
    canvas.addEventListener("touchmove", touchMoveHandler, opts);
    canvas.addEventListener("touchend", touchEndHandler, opts);
    return () => {
      canvas.removeEventListener("touchstart", touchStartHandler);
      canvas.removeEventListener("touchmove", touchMoveHandler);
      canvas.removeEventListener("touchend", touchEndHandler);
    };
  }, [touchStartHandler, touchMoveHandler, touchEndHandler]);

  // Ctrl/Cmd + "+"/"-" para zoom desde teclado (desktop) — evita depender
  // de los botones flotantes, que se ocultan en desktop en favor de esto.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoom(1.25);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoom(0.8);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoom]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className={`w-full h-full block ${eyedropperActive ? "cursor-crosshair" : editMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
        style={{ touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* ── Subtle map-switch fade overlay (non-first transitions) ── */}
      {mapFading && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: fondoColor || "var(--bg-main)",
            animation: "mapFadeOut 0.6s ease-out forwards",
          }}
        />
      )}

      {/* ── Inline keyframes for fade overlay ── */}
      <style>{`
        @keyframes mapFadeOut {
          0%   { opacity: 0.55; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className="absolute right-4 bottom-[calc(56px+1rem)] md:bottom-6 flex flex-col gap-1.5 z-10">
        {/* Zoom con botones — solo mobile, en desktop se usa Ctrl +/- */}
        {[
          { icon: <ZoomIn size={14} />, fn: () => zoom(1.25) },
          { icon: <ZoomOut size={14} />, fn: () => zoom(0.8) },
        ].map((btn, i) => (
          <button
            key={i}
            className="w-9 h-9 flex md:hidden items-center justify-center transition-all border"
            style={{
              background: "color-mix(in srgb, var(--bg-menu) 88%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--primary) 30%, transparent)",
              color: "var(--accent)",
              borderRadius: "2px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
            onClick={btn.fn}
          >
            {btn.icon}
          </button>
        ))}
        {onOpenPanel && (
          <button
            className="w-9 h-9 flex items-center justify-center transition-all border md:hidden"
            style={{
              background: "color-mix(in srgb, var(--primary) 80%, transparent)",
              borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
              color: "var(--btn-text, #fff)",
              borderRadius: "2px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
            onClick={onOpenPanel}
          >
            <User size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapaInteractivo() {
  const isAdmin = useIsAdmin();

  // reinos con caché Dexie automático — instantáneo en visitas posteriores
  const {
    data: reinos,
    setData: setReinos,
    loading,
  } = useSupabaseData<any>("reinos");

  // isFirstOpen: true only the very first time the map is visited in this session
  const [isFirstOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const seen = sessionStorage.getItem("garlia_map_seen");
    if (!seen) {
      sessionStorage.setItem("garlia_map_seen", "1");
      return true;
    }
    return false;
  });

  const [detallesReino, setDetallesReino] = useState<any[]>([]);
  const [vistaActual, setVistaActual] = useState<"global" | "reino">("global");
  const [reinoSeleccionado, setReinoSeleccionado] = useState<any>(null);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modifiedDetalles, setModifiedDetalles] = useState<Set<string>>(
    new Set(),
  );
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [personajesReino, setPersonajesReino] = useState<any[]>([]);
  const [personajesDesbloqueados, setPersonajesDesbloqueados] = useState<
    Set<string>
  >(new Set());
  const [reinosDesbloqueados, setReinosDesbloqueados] = useState<Set<string>>(
    new Set(),
  );
  const [ciudadesDesbloqueadas, setCiudadesDesbloqueadas] = useState<
    Set<string>
  >(new Set());
  const [modalEntidad, setModalEntidad] = useState<EntidadModal | null>(null);
  const [cancionesPersonaje, setCancionesPersonaje] = useState<any[]>([]);
  const [cargandoCanciones, setCargandoCanciones] = useState(false);
  // Books & chapters
  const [librosReino, setLibrosReino] = useState<any[]>([]);
  const [librosColeccion, setLibrosColeccion] = useState<any[]>([]); // One Shots, Poemarios, etc.
  const [capitulosReino, setCapitulosReino] = useState<any[]>([]);
  const [loadingLibros, setLoadingLibros] = useState(false);
  // Habitantes de la ciudad seleccionada
  const [personajesCiudad, setPersonajesCiudad] = useState<any[]>([]);
  const [criaturasCiudad, setCriaturasCiudad] = useState<any[]>([]);
  const [itemsCiudad, setItemsCiudad] = useState<any[]>([]);
  const [capitulosCiudad, setCapitulosCiudad] = useState<any[]>([]);
  const [loadingCiudad, setLoadingCiudad] = useState(false);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const currentReinoIdRef = useRef<string | null>(null);
  const showToast = (message: string, type: ToastType) =>
    setToast({ message, type });

  // ── Tiles del mapa global ────────────────────────────────────────────────────
  const [mapTiles, setMapTiles] = useState<MapTile[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Dexie primero — render instantáneo en visitas posteriores
      try {
        if (db) {
          const local: any[] = (await (db as any).map_tiles?.toArray()) ?? [];
          const filtrados = local.filter((t: any) => t.world_id === "garlia");
          if (filtrados.length && !cancelled) {
            setMapTiles(
              filtrados.sort(
                (a: any, b: any) => a.row - b.row || a.col - b.col,
              ) as MapTile[],
            );
          }
        }
      } catch {}
      if (!navigator.onLine) return;
      // Luego Supabase — fuente de verdad
      const { data } = await supabase
        .from("map_tiles")
        .select("id, col, row, image_url, label, world_id")
        .eq("world_id", "garlia")
        .order("row")
        .order("col");
      if (!cancelled && data) {
        setMapTiles(data as MapTile[]);
        try {
          if (db) await (db as any).map_tiles?.bulkPut(data);
        } catch {}
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Fondo color (color del mar) ──────────────────────────────────────────────
  // fondoColorGlobal: color del mapa del continente (guardado en config_mapa)
  // fondoColorReino: color del mapa del reino activo (guardado en reinos.fondo_color)
  const [fondoColorGlobal, setFondoColorGlobal] = useState<string | null>(null);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const fondoColorInputRef = useRef<HTMLInputElement>(null);

  // Color activo según la vista actual
  const fondoColor =
    vistaActual === "reino"
      ? (reinoSeleccionado?.fondo_color ?? null)
      : fondoColorGlobal;

  // Cargar color de fondo global desde Supabase al montar
  useEffect(() => {
    supabase
      .from("config_mapa")
      .select("value")
      .eq("key", "fondo_color")
      .single()
      .then(({ data }) => {
        if (data?.value) setFondoColorGlobal(data.value);
      });
  }, []);

  const handleFondoColorChange = async (color: string) => {
    setEyedropperActive(false);
    if (vistaActual === "reino" && reinoSeleccionado) {
      // Guardar en la columna fondo_color del reino activo
      setReinoSeleccionado((prev: any) => ({
        ...prev,
        fondo_color: color || null,
      }));
      setReinos((prev) =>
        prev.map((r) =>
          r.id === reinoSeleccionado.id
            ? { ...r, fondo_color: color || null }
            : r,
        ),
      );
      try {
        await supabase
          .from("reinos")
          .update({ fondo_color: color || null })
          .eq("id", reinoSeleccionado.id);
        showToast("Color del reino guardado", "success");
      } catch {
        showToast("Error al guardar el color", "error");
      }
    } else {
      // Guardar en config_mapa (mapa global)
      setFondoColorGlobal(color || null);
      try {
        await supabase
          .from("config_mapa")
          .upsert({ key: "fondo_color", value: color }, { onConflict: "key" });
        showToast("Color del mar guardado", "success");
      } catch {
        showToast("Error al guardar el color", "error");
      }
    }
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Descubrimientos — personajes, reinos y ciudades del perfil
  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void Promise.all([
        supabase
          .from("descubrimientos_personajes")
          .select("personaje_id")
          .eq("perfil_id", user.id),
        supabase
          .from("descubrimientos_reinos")
          .select("reino_id")
          .eq("perfil_id", user.id),
        supabase
          .from("ciudades_desbloqueadas")
          .select("ciudad_id")
          .eq("user_id", user.id),
      ]).then(([pRes, rRes, lRes]) => {
        if (pRes.data)
          setPersonajesDesbloqueados(
            new Set(pRes.data.map((r: any) => r.personaje_id)),
          );
        if (rRes.data)
          setReinosDesbloqueados(
            new Set(rRes.data.map((r: any) => r.reino_id)),
          );
        if (lRes.data)
          setCiudadesDesbloqueadas(
            new Set(lRes.data.map((r: any) => r.ciudad_id)),
          );
      });
    });
  }, []);

  // Cargar personajes, criaturas e items cuando se selecciona una ciudad
  useEffect(() => {
    if (!puntoSeleccionado) {
      setPersonajesCiudad([]);
      setCriaturasCiudad([]);
      setItemsCiudad([]);
      setCapitulosCiudad([]);
      return;
    }
    const ciudadId = puntoSeleccionado.id;
    const currentId = ciudadId;
    setLoadingCiudad(true);

    const run = async () => {
      // 1. Dexie cache
      if (db) {
        try {
          const [cachedP, cachedC, cachedI] = await Promise.all([
            (db as any).personajes
              ?.filter((p: any) => p.ciudad_id === ciudadId && !p.deleted)
              .toArray()
              .catch(() => []) ?? [],
            (db as any).criaturas
              ?.filter((c: any) => c.ciudad_id === ciudadId && !c.deleted)
              .toArray()
              .catch(() => []) ?? [],
            (db as any).items
              ?.filter((i: any) => i.ciudad_id === ciudadId && !i.deleted)
              .toArray()
              .catch(() => []) ?? [],
          ]);
          if (currentId !== ciudadId) return;
          if (cachedP.length) setPersonajesCiudad(cachedP);
          if (cachedC.length) setCriaturasCiudad(cachedC);
          if (cachedI.length) setItemsCiudad(cachedI);
          if (!navigator.onLine) {
            setLoadingCiudad(false);
            return;
          }
        } catch {}
      }

      // 2. Supabase
      const [pRes, cRes, iRes, capRes] = await Promise.all([
        supabase
          .from("personajes")
          .select("id, nombre, img_url, especie")
          .eq("ciudad_id", ciudadId)
          .order("nombre"),
        supabase
          .from("criaturas")
          .select("id, nombre, imagen_url")
          .eq("ciudad_id", ciudadId)
          .order("nombre"),
        supabase
          .from("items")
          .select("id, nombre, imagen_url")
          .eq("ciudad_id", ciudadId)
          .order("nombre"),
        supabase
          .from("capitulos")
          .select(
            "id, titulo_capitulo, orden, libro_id, libros(titulo, categoria)",
          )
          .contains("ciudades_ids", [ciudadId])
          .eq("visibilidad", "publico")
          .order("orden", { ascending: true }),
      ]);
      if (currentId !== ciudadId) return;
      if (!pRes.error) setPersonajesCiudad(pRes.data ?? []);
      if (!cRes.error) setCriaturasCiudad(cRes.data ?? []);
      if (!iRes.error) setItemsCiudad(iRes.data ?? []);
      if (!capRes.error) {
        const caps = (capRes.data ?? [])
          // En ciudades solo mostramos capítulos de colecciones (One Shot, Poemario…), no de Libros
          .filter((c: any) => c.libros?.categoria !== "Libro")
          .map((c: any) => ({
            ...c,
            libro_titulo: c.libros?.titulo ?? null,
            libro_categoria: c.libros?.categoria ?? null,
          }));
        setCapitulosCiudad(caps);
      }
      setLoadingCiudad(false);
    };
    void run();
  }, [puntoSeleccionado?.id]);

  // Ref para detectar si el usuario cambió de reino antes de que lleguen los datos

  const handleReinoClick = async (reino: any) => {
    if (editMode) {
      setReinoSeleccionado(reino);
      setPanelOpen(true);
      return;
    }

    // Marcar qué reino estamos cargando — cualquier respuesta async va a chequear esto
    currentReinoIdRef.current = reino.id;

    // Limpiar todo inmediatamente para no mostrar datos del reino anterior
    setReinoSeleccionado(reino);
    setPuntoSeleccionado(null);
    setVistaActual("reino");
    setPanelOpen(true);
    setDetallesReino([]);
    setPersonajesReino([]);
    setLibrosReino([]);
    setLibrosColeccion([]);
    setCapitulosReino([]);

    // Helper — solo aplica el set si el usuario no cambió de reino mientras esperábamos
    const apply = (fn: () => void) => {
      if (currentReinoIdRef.current === reino.id) fn();
    };

    // ── 1. Caché Dexie — mostrar lo que ya tenemos guardado ──────────────
    if (db) {
      try {
        const [cachedDetalles, cachedPersonajes, _cachedLibros, _cachedCaps] =
          await Promise.all([
            (db as any).ciudades
              .where("reino_id")
              .equals(reino.id)
              .toArray()
              .catch(() => []) ?? [],
            db.personajes
              .filter((p: any) => p.reino === reino.nombre)
              .toArray()
              .catch(() => []),
            db.libros
              .filter((l: any) => l.reino_id === reino.id)
              .toArray()
              .catch(() => []),
            db.capitulos
              .filter(
                (c: any) =>
                  Array.isArray(c.reinos_ids) &&
                  c.reinos_ids.includes(reino.id),
              )
              .toArray()
              .catch(() => []),
          ]);
        apply(() => {
          if (cachedDetalles.length > 0)
            setDetallesReino(cachedDetalles.filter((d: any) => !d.deleted));
          if (cachedPersonajes.length > 0) setPersonajesReino(cachedPersonajes);
          // libros y capítulos NO se aplican desde caché para evitar spoilers —
          // se esperan los datos frescos de Supabase antes de mostrarlos
        });
      } catch {
        /* caché falló — no importa, el fetch de abajo lo cubre */
      }
    }

    // ── 2. Fetch Supabase — siempre pisa el caché con datos frescos ──────
    const [detallesRes, personajesRes, librosRes, capitulosRes] =
      await Promise.all([
        supabase.from("ciudades").select("*").eq("reino_id", reino.id),
        supabase
          .from("personajes")
          .select("id, nombre, img_url, especie, reino, sobre, fecha_nacimiento")
          .eq("reino", reino.nombre),
        supabase
          .from("libros")
          .select("id, titulo, portada_url, estado, categoria, sinopsis")
          .eq("reino_id", reino.id)
          .eq("visibilidad", "publico"),
        supabase
          .from("capitulos")
          .select(
            "id, titulo_capitulo, orden, libro_id, libros(titulo, tags, categoria)",
          )
          .contains("reinos_ids", [reino.id])
          .eq("visibilidad", "publico")
          .order("orden", { ascending: true }),
      ]);

    // Si el usuario ya clickeó otro reino, descartar todo
    if (currentReinoIdRef.current !== reino.id) return;

    // Aplicar resultados — siempre setear aunque sea array vacío, para no dejar datos stale
    if (!detallesRes.error) {
      setDetallesReino(detallesRes.data ?? []);
      try {
        if (db && detallesRes.data?.length)
          await (db as any).ciudades.bulkPut(detallesRes.data);
      } catch {}
    }

    if (!personajesRes.error) {
      setPersonajesReino(personajesRes.data ?? []);
      try {
        if (db && personajesRes.data?.length)
          await db.personajes.bulkPut(personajesRes.data);
      } catch {}
    }

    if (!librosRes.error) {
      const todos = librosRes.data ?? [];
      // "Libro" = libros propiamente dichos (portada, navega al libro)
      setLibrosReino(todos.filter((l: any) => l.categoria === "Libro"));
      // Colecciones (One Shot, Poemario, etc.) → sus capítulos se muestran en el mapa
      setLibrosColeccion(todos.filter((l: any) => l.categoria !== "Libro"));
      try {
        if (db && todos.length) await db.libros.bulkPut(todos);
      } catch {}
    }

    if (!capitulosRes.error) {
      const caps = (capitulosRes.data ?? [])
        .filter((c: any) => {
          const cat = c.libros?.categoria;
          // Solo capítulos de libros tipo colección (One Shot, Poemario, etc.), NO de Libros propiamente dichos
          return cat !== "Libro";
        })
        .map((c: any) => ({
          ...c,
          libro_titulo: c.libros?.titulo ?? null,
          libro_categoria: c.libros?.categoria ?? null,
        }));
      setCapitulosReino(caps);
      try {
        if (db && caps.length) await db.capitulos.bulkPut(caps);
      } catch {}
    }

    // Libros y capítulos ya están seteados — ocultar spinner
    if (currentReinoIdRef.current === reino.id) setLoadingLibros(false);
  };

  // Abrir un reino o ciudad ya desbloqueados cuando lo pide el
  // GlobalCommandPalette (evento "mapa-open-entity" o buzón en
  // sessionStorage si la navegación llegó recién).
  const buzonMapaProcesadoRef = useRef(false);
  useEffect(() => {
    const abrirReino = async (reinoId: string) => {
      const reino = reinos.find((r) => r.id === reinoId);
      if (!reino) return false;
      await handleReinoClick(reino);
      return true;
    };

    const abrirCiudad = async (
      ciudadId: string,
      reinoIdHint?: string | null,
    ) => {
      // Buscamos primero en el reino ya cargado, si aplica
      let ciudad = detallesReino.find((d) => d.id === ciudadId);

      if (!ciudad) {
        // Traemos la ciudad directo para saber a qué reino pertenece
        const { data } = await supabase
          .from("ciudades")
          .select("*")
          .eq("id", ciudadId)
          .maybeSingle();
        if (!data) return false;
        ciudad = data;
        const reino = reinos.find(
          (r) => r.id === (reinoIdHint ?? data.reino_id),
        );
        if (!reino) return false;
        await handleReinoClick(reino);
      }

      setPuntoSeleccionado(ciudad);
      setPanelOpen(true);
      return true;
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | {
            tipo: "reino" | "ciudad";
            entidad_id: string;
            reino_id?: string | null;
          }
        | undefined;
      if (!detail) return;
      if (detail.tipo === "reino") void abrirReino(detail.entidad_id);
      else if (detail.tipo === "ciudad")
        void abrirCiudad(detail.entidad_id, detail.reino_id);
    };
    window.addEventListener("mapa-open-entity", handler);

    // Buzón: por si la navegación llegó antes de que "reinos" cargara.
    // Se procesa UNA sola vez (buzonMapaProcesadoRef) para no reabrir el
    // mismo reino/ciudad cada vez que "reinos" se actualiza por otro motivo
    // (por ejemplo, mientras handleReinoClick va seteando datos) — eso era
    // lo que causaba el parpadeo entre vista global y vista de reino.
    if (!buzonMapaProcesadoRef.current && reinos.length) {
      buzonMapaProcesadoRef.current = true;
      void (async () => {
        try {
          const raw = sessionStorage.getItem("mapa-pending-open-entity");
          if (!raw) return;
          const pending = JSON.parse(raw) as {
            tipo: "reino" | "ciudad";
            entidad_id: string;
            reino_id?: string | null;
            ts: number;
          };
          sessionStorage.removeItem("mapa-pending-open-entity");
          // Ignorar solicitudes viejas (>10s) para no reabrir algo obsoleto
          if (Date.now() - pending.ts >= 10000) return;
          if (pending.tipo === "reino") await abrirReino(pending.entidad_id);
          else await abrirCiudad(pending.entidad_id, pending.reino_id);
        } catch {}
      })();
    }

    return () => window.removeEventListener("mapa-open-entity", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reinos]);

  const handlePersonajeClick = async (p: any) => {
    setCancionesPersonaje([]);
    setModalEntidad({
      tipo: "personaje",
      data: {
        tipo: "personaje",
        entidad_id: p.id,
        nombre: p.nombre,
        imagen_url: p.img_url,
        descripcion: p.sobre,
        reino: p.reino,
        especie: p.especie,
        fecha_descubrimiento: "",
      },
    });
    if (!p.id) return;
    setCargandoCanciones(true);
    try {
      const { data, error } = await supabase
        .from("canciones")
        .select("id, titulo, portada_url, info_cancion, personaje_id")
        .eq("personaje_id", p.id)
        .eq("visible", true);
      if (!error && data) setCancionesPersonaje(data);
    } catch (err) {
      console.warn("[Mapa] Error cargando canciones:", err);
    } finally {
      setCargandoCanciones(false);
    }
  };

  const handleMapClick = (
    x: number,
    y: number,
    tile_col?: number,
    tile_row?: number,
  ) => {
    if (!editMode) return;
    if (puntoSeleccionado) {
      setPuntoSeleccionado({ ...puntoSeleccionado, coord_x: x, coord_y: y });
      setDetallesReino((prev) =>
        prev.map((p) =>
          p.id === puntoSeleccionado.id ? { ...p, coord_x: x, coord_y: y } : p,
        ),
      );
      setModifiedDetalles((prev) => new Set(prev).add(puntoSeleccionado.id));
    } else if (reinoSeleccionado && vistaActual === "global") {
      setReinoSeleccionado({
        ...reinoSeleccionado,
        coord_x: x,
        coord_y: y,
        tile_col: tile_col ?? reinoSeleccionado.tile_col ?? null,
        tile_row: tile_row ?? reinoSeleccionado.tile_row ?? null,
      });
      setReinos((prev) =>
        prev.map((r) =>
          r.id === reinoSeleccionado.id
            ? {
                ...r,
                coord_x: x,
                coord_y: y,
                tile_col: tile_col ?? r.tile_col ?? null,
                tile_row: tile_row ?? r.tile_row ?? null,
              }
            : r,
        ),
      );
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !reinoSeleccionado) return;
    setIsUploadingImg(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `mapas/reino_${reinoSeleccionado.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("wiki")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("wiki")
        .getPublicUrl(path);
      const mapa_url = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from("reinos")
        .update({ mapa_url })
        .eq("id", reinoSeleccionado.id);
      if (updateError) throw updateError;
      setReinoSeleccionado({ ...reinoSeleccionado, mapa_url });
      setReinos((prev) =>
        prev.map((r) =>
          r.id === reinoSeleccionado.id ? { ...r, mapa_url } : r,
        ),
      );
      showToast("Imagen actualizada", "success");
    } catch {
      showToast("Error al subir la imagen", "error");
    } finally {
      setIsUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      if (vistaActual === "reino" && modifiedDetalles.size > 0) {
        const toSave = detallesReino.filter((p) => modifiedDetalles.has(p.id));
        await Promise.all(
          toSave.map((p) =>
            supabase
              .from("ciudades")
              .update({
                nombre: p.nombre,
                descripcion: p.descripcion,
                coord_x: p.coord_x,
                coord_y: p.coord_y,
                tile_col: p.tile_col ?? null,
                tile_row: p.tile_row ?? null,
              })
              .eq("id", p.id),
          ),
        );
        setModifiedDetalles(new Set());
      } else if (reinoSeleccionado && vistaActual === "global") {
        const { error } = await supabase
          .from("reinos")
          .update({
            nombre: reinoSeleccionado.nombre,
            descripcion: reinoSeleccionado.descripcion,
            coord_x: reinoSeleccionado.coord_x,
            coord_y: reinoSeleccionado.coord_y,
            tile_col: reinoSeleccionado.tile_col ?? null,
            tile_row: reinoSeleccionado.tile_row ?? null,
          })
          .eq("id", reinoSeleccionado.id);
        if (error) throw error;
        setReinos((prev) =>
          prev.map((r) =>
            r.id === reinoSeleccionado.id ? reinoSeleccionado : r,
          ),
        );
      }
      showToast("Cambios guardados", "success");
      setEditMode(false);
    } catch {
      showToast("No se pudieron guardar los cambios", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const volverAlGlobal = () => {
    setVistaActual("global");
    setReinoSeleccionado(null);
    setPuntoSeleccionado(null);
    setDetallesReino([]);
    setPersonajesReino([]);
    setLibrosReino([]);
    setLibrosColeccion([]);
    setCapitulosReino([]);
    setLoadingLibros(false);
    setModifiedDetalles(new Set());
    setEditMode(false);
    setPanelOpen(false);
  };

  // Visible markers: admins ven todos los reinos; usuarios solo los que desbloquearon
  const visibleMarkers =
    vistaActual === "global"
      ? reinos.filter((r) => (isAdmin ? true : reinosDesbloqueados.has(r.id)))
      : detallesReino.filter((l) =>
          isAdmin ? true : ciudadesDesbloqueadas.has(l.id),
        );

  // hiddenMarkers: para usuarios son los marcadores no desbloqueados (se muestran en niebla)
  const hiddenMarkers =
    vistaActual === "global"
      ? isAdmin
        ? []
        : reinos.filter((r) => !reinosDesbloqueados.has(r.id))
      : isAdmin
        ? []
        : detallesReino.filter((l) => !ciudadesDesbloqueadas.has(l.id));

  const _currentImage =
    vistaActual === "reino" && reinoSeleccionado?.mapa_url
      ? reinoSeleccionado.mapa_url
      : "/dibujos/reinos/mapa.png";

  const panelProps = {
    editMode,
    reinoSeleccionado,
    puntoSeleccionado,
    setPuntoSeleccionado,
    setDetallesReino,
    setModifiedDetalles,
    setReinoSeleccionado,
    personajesReino,
    personajesDesbloqueados,
    handlePersonajeClick,
    modifiedDetalles,
    isSaving,
    handleSaveChanges,
    isUploadingImg,
    handleImageUpload,
    imgInputRef,
    librosReino,
    librosColeccion,
    capitulosReino,
    loadingLibros,
    personajesCiudad,
    criaturasCiudad,
    itemsCiudad,
    capitulosCiudad,
    loadingCiudad,
  };

  // Solo bloquea la UI si no hay absolutamente ningún dato todavía (primera carga ever)
  if (loading && reinos.length === 0)
    return (
      <div
        className="fixed inset-0 md:left-[68px]"
        style={{ background: fondoColor || "var(--bg-main)" }}
      />
    );

  return (
    <div
      className="fixed inset-0 flex overflow-hidden md:left-[68px]"
      style={{
        background: fondoColor || "var(--bg-main)",
        transition: "background 0.5s ease",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap');`}</style>

      {modalEntidad && (
        <ModalDetalle
          canciones={cancionesPersonaje}
          cargandoCanciones={cargandoCanciones}
          entidad={modalEntidad}
          onClose={() => {
            setModalEntidad(null);
            setCancionesPersonaje([]);
          }}
        />
      )}

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* ── MAP AREA ── */}
      <div
        className={`relative flex-1 min-h-0 overflow-hidden transition-all duration-500 pb-14 md:pb-0 ${panelOpen && !isMobile ? "" : "w-full"}`}
      >
        {isAdmin && (
          <div
            className="absolute z-70 flex gap-2"
            style={{
              top:
                !panelOpen && (reinoSeleccionado || puntoSeleccionado)
                  ? "3rem"
                  : "1rem",
              right: "1rem",
              transition: "top 0.2s ease",
            }}
          >
            <button
              className="flex items-center gap-2 px-4 py-2 text-micro font-semibold uppercase tracking-widest transition-all border"
              style={{
                background: editMode
                  ? "color-mix(in srgb, #c43030 85%, var(--bg-menu))"
                  : "color-mix(in srgb, var(--bg-menu) 88%, transparent)",
                borderColor: editMode
                  ? "color-mix(in srgb, #c43030 50%, transparent)"
                  : "color-mix(in srgb, var(--primary) 30%, transparent)",
                color: editMode ? "var(--btn-text, #fff)" : "var(--accent)",
                borderRadius: "2px",
                letterSpacing: "0.12em",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <X size={14} /> : <Edit3 size={14} />}
              {editMode ? "Cancelar" : "Editar Mapa"}
            </button>
            {editMode && (
              <button
                className="flex items-center gap-2 px-4 py-2 text-micro font-semibold uppercase tracking-widest disabled:opacity-50 transition-all"
                disabled={isSaving}
                style={{
                  background: "color-mix(in srgb, var(--accent) 70%, #1a5c30)",
                  color: "var(--btn-text, #fff)",
                  border:
                    "1px solid color-mix(in srgb, var(--accent) 40%, #1a5c30)",
                  borderRadius: "2px",
                  letterSpacing: "0.12em",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
                onClick={handleSaveChanges}
              >
                {isSaving ? <Hourglass size={14} /> : <Save size={14} />}
                Guardar
              </button>
            )}
          </div>
        )}

        <AnimatePresence>
          {editMode && (reinoSeleccionado || puntoSeleccionado) && (
            <MotionDiv
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-1/2 -translate-x-1/2 z-50 text-micro font-semibold uppercase px-4 py-2 shadow-md flex items-center gap-2 bottom-[calc(56px+1rem)] md:bottom-16"
              exit={{ opacity: 0, y: 10 }}
              initial={{ opacity: 0, y: 10 }}
              style={{
                background:
                  "color-mix(in srgb, var(--bg-menu) 92%, transparent)",
                color: "var(--accent)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                borderRadius: "2px",
                letterSpacing: "0.1em",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
            >
              <Move size={12} /> Clickeá para mover el marcador
              {modifiedDetalles.size > 1 && (
                <span
                  className="px-1.5 py-0.5 text-micro"
                  style={{
                    background:
                      "color-mix(in srgb, var(--bg-main) 20%, transparent)",
                  }}
                >
                  {modifiedDetalles.size} pendientes
                </span>
              )}
            </MotionDiv>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {vistaActual === "reino" && (
            <MotionButton
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 text-micro font-semibold uppercase tracking-widest transition-colors"
              exit={{ opacity: 0, x: -20 }}
              initial={{ opacity: 0, x: -20 }}
              style={{
                background:
                  "color-mix(in srgb, var(--bg-menu) 88%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                color: "var(--accent)",
                borderRadius: "2px",
                letterSpacing: "0.12em",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
              onClick={volverAlGlobal}
            >
              <ArrowLeft size={14} /> Volver
            </MotionButton>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!panelOpen && (reinoSeleccionado || puntoSeleccionado) && (
            <MotionButton
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-4 z-50 flex items-center gap-2.5 px-3 py-2 text-micro font-bold uppercase transition-all"
              exit={{ opacity: 0, x: 20 }}
              initial={{ opacity: 0, x: 20 }}
              style={{
                right: "1rem",
                background:
                  "color-mix(in srgb, var(--bg-menu) 92%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                color: "var(--accent)",
                borderRadius: "2px",
                letterSpacing: "0.12em",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
              onClick={() => setPanelOpen(true)}
            >
              <BookOpen size={13} />
              <span
                className="max-w-[120px] truncate"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {puntoSeleccionado?.nombre ?? reinoSeleccionado?.nombre}
              </span>
            </MotionButton>
          )}
        </AnimatePresence>

        {/* ── FONDO COLOR PICKER (edit mode only) ── */}
        {isAdmin && editMode && (
          <div
            className="absolute bottom-[calc(56px+0.75rem)] md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2"
            style={{
              background: "color-mix(in srgb, var(--bg-menu) 94%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
              borderRadius: "2px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              backdropFilter: "blur(4px)",
            }}
          >
            {/* Label */}
            <span
              className="text-micro font-black uppercase tracking-widest whitespace-nowrap"
              style={{ color: "var(--accent)", letterSpacing: "0.15em" }}
            >
              {vistaActual === "reino" ? "Color Fondo Reino" : "Color Mar"}
            </span>

            {/* Color swatch — opens native color picker */}
            <div className="relative">
              <button
                className="w-7 h-7 border-2 transition-all"
                style={{
                  background: fondoColor || "var(--bg-main)",
                  borderColor:
                    "color-mix(in srgb, var(--accent) 50%, transparent)",
                  borderRadius: "1px",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
                }}
                title="Elegir color manual"
                onClick={() => fondoColorInputRef.current?.click()}
              />
              <input
                ref={fondoColorInputRef}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                type="color"
                value={fondoColor || "#5a8fa8"}
                onBlur={(e) => handleFondoColorChange(e.target.value)}
                onChange={(e) => {
                  // Preview en tiempo real sin guardar en Supabase todavía
                  if (vistaActual === "reino" && reinoSeleccionado) {
                    setReinoSeleccionado((prev: any) => ({
                      ...prev,
                      fondo_color: e.target.value,
                    }));
                    setReinos((prev) =>
                      prev.map((r) =>
                        r.id === reinoSeleccionado.id
                          ? { ...r, fondo_color: e.target.value }
                          : r,
                      ),
                    );
                  } else {
                    setFondoColorGlobal(e.target.value);
                  }
                }}
              />
            </div>

            {/* Eyedropper button */}
            <button
              className="w-7 h-7 flex items-center justify-center border transition-all"
              style={{
                background: eyedropperActive
                  ? "color-mix(in srgb, var(--accent) 30%, transparent)"
                  : "color-mix(in srgb, var(--primary) 15%, transparent)",
                borderColor: eyedropperActive
                  ? "var(--accent)"
                  : "color-mix(in srgb, var(--primary) 30%, transparent)",
                color: eyedropperActive
                  ? "var(--accent)"
                  : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                borderRadius: "1px",
              }}
              title="Cuentagotas — click en el mapa para samplear"
              onClick={() => setEyedropperActive((v) => !v)}
            >
              {/* Eyedropper SVG icon */}
              <svg
                fill="none"
                height="13"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="13"
              >
                <path d="m2 22 1-1h3l9-9" />
                <path d="M3 21v-3l9-9" />
                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8-1.6 1.6" />
              </svg>
            </button>

            {/* Reset */}
            {fondoColor && (
              <button
                className="w-7 h-7 flex items-center justify-center border transition-all"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--primary) 25%, transparent)",
                  color:
                    "color-mix(in srgb, var(--foreground) 45%, transparent)",
                  borderRadius: "1px",
                }}
                title="Resetear a color del tema"
                onClick={() => handleFondoColorChange("")}
              >
                <X size={10} />
              </button>
            )}

            {/* Eyedropper hint */}
            {eyedropperActive && (
              <span
                className="text-micro font-semibold uppercase animate-pulse whitespace-nowrap"
                style={{ color: "var(--accent)", letterSpacing: "0.1em" }}
              >
                Clickeá el mapa
              </span>
            )}
          </div>
        )}

        {vistaActual === "global" ? (
          <UnifiedTileCanvas
            className="absolute inset-0"
            editMode={editMode}
            eyedropperActive={eyedropperActive}
            fondoColor={fondoColor}
            hiddenMarkers={hiddenMarkers}
            isFirstOpen={isFirstOpen}
            markers={
              editMode ? [...visibleMarkers, ...hiddenMarkers] : visibleMarkers
            }
            selectedMarkerId={reinoSeleccionado?.id ?? null}
            tiles={mapTiles}
            onEyedropperPick={handleFondoColorChange}
            onMapClick={handleMapClick}
            onMarkerClick={handleReinoClick}
            onMarkerMove={() => {}}
            onMarkerSelect={() => {}}
            onOpenPanel={
              isMobile && reinoSeleccionado
                ? () => setPanelOpen(true)
                : undefined
            }
            onTileCreate={() => {}}
            onTileDelete={() => {}}
            onTilePick={() => {}}
          />
        ) : (
          <ReinoTileCanvas
            className="absolute inset-0"
            detalles={
              editMode ? [...visibleMarkers, ...hiddenMarkers] : visibleMarkers
            }
            editMode={editMode}
            eyedropperActive={eyedropperActive}
            fondoColor={fondoColor}
            hiddenMarkers={editMode ? [] : hiddenMarkers}
            isFirstOpen={isFirstOpen}
            reinoId={reinoSeleccionado.id}
            selectedMarkerId={puntoSeleccionado?.id ?? null}
            onDetallesChange={(nuevos) => {
              setDetallesReino(nuevos);
              // Marcamos como modificados los que cambiaron de posición, para
              // que handleSaveChanges (línea ~2866) los incluya al guardar.
              const cambiados = nuevos.filter((n) => {
                const prev = detallesReino.find((d) => d.id === n.id);
                return (
                  prev &&
                  (prev.coord_x !== n.coord_x ||
                    prev.coord_y !== n.coord_y ||
                    prev.tile_col !== n.tile_col ||
                    prev.tile_row !== n.tile_row)
                );
              });
              if (cambiados.length) {
                setModifiedDetalles(
                  (prev) => new Set([...prev, ...cambiados.map((c) => c.id)]),
                );
              }
            }}
            onEyedropperPick={handleFondoColorChange}
            onMarkerSelect={(id) =>
              setPuntoSeleccionado(
                id ? (detallesReino.find((d) => d.id === id) ?? null) : null,
              )
            }
            onOpenPanel={
              isMobile && (reinoSeleccionado || puntoSeleccionado)
                ? () => setPanelOpen(true)
                : undefined
            }
            onPinClick={(m) => {
              setPuntoSeleccionado(m);
              setPanelOpen(true);
            }}
          />
        )}
      </div>

      {/* ── SIDE PANEL (desktop) ── */}
      <AnimatePresence>
        {!isMobile && panelOpen && (reinoSeleccionado || puntoSeleccionado) && (
          <MotionDiv
            animate={{ width: 380, opacity: 1 }}
            className="relative overflow-hidden shrink-0"
            exit={{ width: 0, opacity: 0 }}
            initial={{ width: 0, opacity: 0 }}
            style={{
              background: "var(--white-custom)",
              borderLeft:
                "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.4)",
            }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 50%, transparent), transparent)",
              }}
            />
            <button
              className="absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center transition-colors border"
              style={{
                background:
                  "color-mix(in srgb, var(--bg-main) 80%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 20%, transparent)",
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
                borderRadius: "1px",
              }}
              onClick={() => {
                setPanelOpen(false);
                setPuntoSeleccionado(null);
              }}
            >
              <X size={12} />
            </button>
            <div className="p-8 pt-10 flex flex-col gap-4 h-full overflow-y-auto">
              <PanelContenido {...panelProps} />
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* ── BOTTOM PANEL (mobile) ── */}
      <AnimatePresence>
        {isMobile && panelOpen && (reinoSeleccionado || puntoSeleccionado) && (
          <MotionDiv
            animate={{ y: 0 }}
            className="fixed left-0 right-0 z-999 overflow-hidden"
            exit={{ y: "100%" }}
            initial={{ y: "100%" }}
            style={{
              bottom: "56px",
              background: "var(--white-custom)",
              borderTop:
                "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
              maxHeight: "60dvh",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
            }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 60%, transparent), transparent)",
              }}
            />
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-0.5"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 30%, transparent)",
                }}
              />
            </div>
            <button
              className="absolute top-3 right-4 w-7 h-7 flex items-center justify-center transition-colors"
              style={{
                color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
              }}
              onClick={() => {
                setPanelOpen(false);
                setPuntoSeleccionado(null);
              }}
            >
              <X size={14} />
            </button>
            <div
              className="px-6 pb-8 pt-2 overflow-y-auto flex flex-col gap-4"
              style={{ maxHeight: "calc(65dvh - 40px)" }}
            >
              <PanelContenido {...panelProps} />
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

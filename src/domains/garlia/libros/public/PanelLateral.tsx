// ─────────────────────────────────────────────────────────────────────────────
// PanelLateral.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Extraído de leerLibro.tsx (antes vivía inline, ~500 líneas mezcladas con
// el componente Lector principal). Sin cambios de comportamiento — solo
// separación de archivo para que leerLibro.tsx se quede con la orquestación
// de datos/navegación y este archivo con la UI de la sidebar del lector.
//
// Incluye: BarraProgresoVertical, PersonajesPanel, LugaresPanel y el
// PanelLateral que los compone junto al Hero (imagen del narrador + fecha
// del mundo) y el índice de capítulos.

"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import React, { useEffect, useState } from "react";

import { FechaMundoBadge } from "@/domains/garlia/calendario/FechaMundoBadge";
import type { CapituloScrollItem } from "@/domains/garlia/libros/capitulos/types";
import { useLectorEntidadesStore } from "@/domains/garlia/libros/useLectorEntidadesStore";
import { useLectorStore } from "@/domains/garlia/libros/useLectorStore";

interface NarradorInfo {
  id: string;
  nombre: string;
  img_url?: string | null;
}

/* ─────────────────────────────────────────────
   Barra de progreso VERTICAL — rail sobre borde derecho
   ───────────────────────────────────────────── */
export function BarraProgresoVertical({ capId }: { capId: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!capId) return;
    const container = document.getElementById("lector-scroll-container");
    if (!container) return;

    const calc = () => {
      const el = document.getElementById(`cap-${capId}`);
      if (!el) return;
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      const total = bottom - top;
      const scrolled = container.scrollTop + container.clientHeight - top;
      setProgress(Math.min(100, Math.max(0, (scrolled / total) * 100)));
    };
    calc();
    container.addEventListener("scroll", calc, { passive: true });
    return () => container.removeEventListener("scroll", calc);
  }, [capId]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <motion.div
        animate={{ height: `${progress}%` }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          originY: 0,
          background:
            "linear-gradient(to bottom, var(--accent, var(--primary)), color-mix(in srgb, var(--primary) 60%, transparent))",
          borderRadius: 99,
        }}
        transition={{ duration: 0.18, ease: "linear" }}
      />
      <motion.div
        animate={{ top: `${progress}%` }}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--primary)",
          opacity: 0.6,
          marginLeft: -1,
        }}
        transition={{ duration: 0.18, ease: "linear" }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Personajes del capítulo activo
   — Lookup puro sobre el mapa precargado para todo el libro
   (ver cargarEntidades en el efecto principal de leerLibro.tsx). Sin fetch
   propio: así cambiar de capítulo no dispara red/IO y no parpadea.
   ───────────────────────────────────────────── */
export function PersonajesPanel({
  ids,
  border,
}: {
  ids: string[];
  border: string;
}) {
  // Selector granular: este panel solo re-renderiza cuando cambia
  // personajesMap, no cuando cambia capId, activeCapTitle, etc.
  const personajesMap = useLectorEntidadesStore((s) => s.personajesMap);
  const personajes = ids.map((id) => personajesMap[id]).filter(Boolean) as {
    id: string;
    nombre: string;
    img_url?: string | null;
  }[];

  if (personajes.length === 0) return null;

  return (
    <div style={{ paddingTop: 14, borderTop: border }}>
      <p
        style={{
          fontSize: 8,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--primary)",
          opacity: 0.25,
          marginBottom: 10,
        }}
      >
        Personajes
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {personajes.map((p) => (
          <div
            key={p.id}
            style={{ display: "flex", alignItems: "center", gap: 9 }}
          >
            {p.img_url ? (
              <Image
                alt={p.nombre}
                src={p.img_url}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "var(--radius-btn, 4px)",
                  objectFit: "cover",
                  border,
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "var(--radius-btn, 4px)",
                  border,
                  flexShrink: 0,
                  background:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 800,
                  color: "var(--primary)",
                  opacity: 0.4,
                }}
              >
                {p.nombre.charAt(0)}
              </div>
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--primary)",
                opacity: 0.65,
                lineHeight: 1.2,
              }}
            >
              {p.nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Reinos y ciudades del capítulo activo
   — Igual que PersonajesPanel: lookup puro sobre los mapas
   precargados para todo el libro, sin fetch propio por capítulo.
   ───────────────────────────────────────────── */
export function LugaresPanel({
  reinosIds,
  ciudadesIds,
}: {
  reinosIds: string[];
  ciudadesIds: string[];
  /** @deprecated no se usa — mantenido para no romper llamadas existentes */
  border?: string;
}) {
  // Selectores granulares: no re-renderiza con cambios de capId ni de
  // personajesMap — solo con reinosMap/ciudadesMap.
  const reinosMap = useLectorEntidadesStore((s) => s.reinosMap);
  const ciudadesMap = useLectorEntidadesStore((s) => s.ciudadesMap);
  const reinos = reinosIds.map((id) => reinosMap[id]).filter(Boolean) as {
    id: string;
    nombre: string;
  }[];
  const ciudades = ciudadesIds.map((id) => ciudadesMap[id]).filter(Boolean) as {
    id: string;
    nombre: string;
  }[];

  if (reinos.length === 0 && ciudades.length === 0) return null;

  return (
    <div
      style={{
        padding: "14px 16px 0",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {reinos.length > 0 && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {reinos.map((r) => (
              <div
                key={r.id}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--primary)",
                    opacity: 0.2,
                    lineHeight: 1,
                  }}
                >
                  ♛
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontStyle: "italic",
                    color: "var(--primary)",
                    opacity: 0.55,
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    lineHeight: 1.2,
                  }}
                >
                  {r.nombre}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ciudades.length > 0 && (
        <div>
          <p
            style={{
              fontSize: 8,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--primary)",
              opacity: 0.25,
              marginBottom: 7,
            }}
          >
            {ciudades.length === 1 ? "Ciudad" : "Ciudades"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {ciudades.map((c) => (
              <div
                key={c.id}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--primary)",
                    opacity: 0.2,
                    lineHeight: 1,
                  }}
                >
                  ♖
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--primary)",
                    opacity: 0.45,
                    textTransform: "uppercase",
                    lineHeight: 1.2,
                  }}
                >
                  {c.nombre}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Panel lateral izquierdo — compone Hero + fecha mundo + Lugares +
   Personajes + índice de capítulos + barra de progreso.
   ───────────────────────────────────────────── */
export function PanelLateral({
  libroTitulo: _libroTitulo,
  capActual,
  esExtra,
  onVolver,
  onSelectCap,
  isMobile,
}: {
  libroTitulo?: string;
  capActual: CapituloScrollItem | null;
  esExtra?: boolean;
  onVolver: () => void;
  onSelectCap?: (capId: string) => void;
  isMobile?: boolean;
}) {
  // Selectores granulares: cambiar capId (navegar de capítulo) SÍ toca este
  // panel (resalta el ítem activo), pero cambiar personajesMap/reinosMap NO
  // dispara un re-render de la lista de índice — cada bloque hijo
  // (PersonajesPanel/LugaresPanel) tiene su propio selector.
  const capitulos = useLectorStore((s) => s.capitulos);
  const loading = useLectorStore((s) => s.loading);
  const capIdActual = useLectorStore((s) => s.capId);

  const border =
    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)";
  const narrador = (capActual as any)?._narrador as
    | NarradorInfo
    | null
    | undefined;
  const personajesIds = Array.from(new Set(capActual?.personajes_ids ?? []));

  return (
    <div
      style={{
        width: isMobile ? "100%" : "clamp(220px, 22vw, 300px)",
        flexShrink: 0,
        height: "100vh",
        borderRight: border,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        background: "var(--bg-main)",
      }}
    >
      {/* ── Hero: imagen del narrador con degradado ── */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {narrador?.img_url ? (
          <img
            alt={narrador.nombre}
            src={narrador.img_url}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                "color-mix(in srgb, var(--primary) 6%, var(--bg-main))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {narrador?.nombre && (
              <span
                style={{
                  fontSize: 56,
                  fontWeight: 900,
                  color: "var(--primary)",
                  opacity: 0.06,
                  fontStyle: "italic",
                  textTransform: "uppercase",
                }}
              >
                {narrador.nombre.charAt(0)}
              </span>
            )}
          </div>
        )}

        {/* Degradado sobre la imagen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, color-mix(in srgb, var(--bg-main) 0%, transparent) 0%, color-mix(in srgb, var(--bg-main) 55%, transparent) 55%, var(--bg-main) 100%)",
          }}
        />

        {/* Botón volver — arriba izquierda */}
        <button
          style={{
            position: "absolute",
            top: 12,
            left: 14,
            display: "flex",
            alignItems: "center",
            gap: 5,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--primary)",
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            opacity: 0.55,
            transition: "opacity 0.15s",
            textShadow: "0 1px 6px var(--bg-main)",
          }}
          onClick={onVolver}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}
        >
          ← Volver
        </button>
      </div>

      {/* Fecha del mundo — justo debajo de la imagen del narrador */}
      {(capActual as any)?.dia_absoluto != null && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 16px 0",
          }}
        >
          <FechaMundoBadge
            diaAbsoluto={(capActual as any).dia_absoluto}
            mostrarEraDot={false}
          />
        </div>
      )}

      {/* ── Scroll único: metadata + separador + índice ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Metadata */}
        {!loading && capActual && !esExtra && (
          <LugaresPanel
            ciudadesIds={(capActual as any).ciudades_ids ?? []}
            reinosIds={(capActual as any).reinos_ids ?? []}
          />
        )}
        {!loading && !esExtra && personajesIds.length > 0 && (
          <div style={{ padding: "10px 16px 0" }}>
            <PersonajesPanel border={border} ids={personajesIds} />
          </div>
        )}

        {/* Separador */}
        <div
          style={{
            margin: "10px 16px 4px",
            height: 1,
            background: border.replace("1px solid ", ""),
          }}
        />

        {/* Índice */}
        <div style={{ padding: "0 8px 16px" }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "8px",
              }}
            >
              {[80, 60, 100, 50, 75].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 9,
                    width: `${w}%`,
                    borderRadius: 4,
                    background:
                      "color-mix(in srgb, var(--primary) 7%, transparent)",
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {capitulos.map((cap) => {
                const esActual = cap.id === capIdActual;
                return (
                  <button
                    key={cap.id}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: esActual
                        ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                        : "transparent",
                      cursor: "pointer",
                      transition: "background 0.12s",
                      color: esActual
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 45%, transparent)",
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      lineHeight: 1.4,
                    }}
                    onClick={() => onSelectCap?.(cap.id)}
                    onMouseEnter={(e) => {
                      if (!esActual)
                        e.currentTarget.style.background =
                          "color-mix(in srgb, var(--primary) 6%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      if (!esActual)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        opacity: 0.35,
                        marginRight: 6,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {String(cap.orden).padStart(2, "0")}
                    </span>
                    {cap.titulo_capitulo}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Barra de progreso vertical */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: "color-mix(in srgb, var(--primary) 6%, transparent)",
          borderRadius: 99,
        }}
      >
        <BarraProgresoVertical capId={capIdActual} />
      </div>
    </div>
  );
}

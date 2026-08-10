"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, List, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useRef, useCallback } from "react";

import { Btn } from "@/ui";
import { FechaMundoBadge } from "@/domains/garlia/calendario/FechaMundoBadge";
import type {
  CapituloLista,
  CapituloScrollItem,
} from "@/domains/garlia/libros/capitulos/types";
import {
  CapituloScrollBlock,
  ToastPortal,
} from "@/domains/garlia/libros/public/CapituloScrollBlock";
import { Vignette, AjustesLectura } from "@/domains/garlia/libros/public/LectorUI";
import { useLectorAjustes } from "@/domains/garlia/libros/public/useLectorAjustes";
import {
  useLectorStore,
  capActualDe,
  capVecino,
} from "@/domains/garlia/libros/useLectorStore";
import { useLectorEntidadesStore } from "@/domains/garlia/libros/useLectorEntidadesStore";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
// ⚠️ Ajustar esta ruta si syncEngine.ts vive en otra carpeta del proyecto.
import {
  collectIds,
  loadCiudadesMap,
  loadPersonajesMap,
  loadReinosMap,
} from "@/infra/sync/syncEngine";
import { toSlug, esUUID } from "@/lib/utils/slugify";
import { IS_TAURI_BUILD } from "@/lib/config/buildTarget";

// Arma la URL al índice de capítulos de un libro, condicional según build.
// Acepta tanto slug canónico como UUID legacy (leerLibro/detallesLibro
// resuelven el UUID a slug real en un efecto posterior y canonicalizan la URL).
export function rutaLibro(slug: string): string {
  return IS_TAURI_BUILD
    ? `/garlia/libros/detalle?slug=${slug}`
    : `/garlia/libros/${slug}`;
}

// Arma la URL al lector de un capítulo puntual, condicional según build.
// `orden` acepta tanto el número de orden canónico como un UUID de capítulo
// legacy (el componente Lector resuelve ambos casos vía esUUID()).
export function rutaLeer(slug: string, orden: number | string): string {
  return IS_TAURI_BUILD
    ? `/garlia/libros/leer?slug=${slug}&orden=${orden}`
    : `/garlia/libros/${slug}/leer/${orden}`;
}

/* ─────────────────────────────────────────────
   Tipos
   ───────────────────────────────────────────── */
interface NarradorInfo {
  id: string;
  nombre: string;
  img_url?: string | null;
}

/* ─────────────────────────────────────────────
   useContenidoCapitulo — fetch de contenido bajo demanda
   ───────────────────────────────────────────────────────────────────────────
   Reemplaza al viejo modelo de "traer el contenido de todos los capítulos
   de una". Cada capítulo pide su `contenido` recién cuando:
     a) el lector lo abre (capId activo sin entrada en contenidoPorCapId), o
     b) se prefetchea en silencio apenas se resuelve `capSiguiente` (ver
        efecto de prefetch en el componente Lector más abajo) — así
        "Siguiente capítulo" se siente instantáneo.
   En ambos casos: si ya está en el mapa (memoria) o `cargandoContenidoIds`
   ya lo tiene en vuelo, no repite el fetch. Al resolver, persiste en Dexie
   (cache por capítulo individual, no el libro entero).
   ───────────────────────────────────────────── */
function useCargadorContenido() {
  const contenidoPorCapId = useLectorStore((s) => s.contenidoPorCapId);
  const cargandoContenidoIds = useLectorStore((s) => s.cargandoContenidoIds);
  const setContenidoCap = useLectorStore((s) => s.setContenidoCap);
  const setCargandoContenido = useLectorStore((s) => s.setCargandoContenido);

  const cargar = useCallback(
    async (capId: string) => {
      if (!capId) return;
      const estado = useLectorStore.getState();
      if (estado.contenidoPorCapId[capId] !== undefined) return; // ya en memoria
      if (estado.cargandoContenidoIds[capId]) return; // ya en vuelo

      setCargandoContenido(capId, true);
      try {
        // Dexie primero: si el capítulo ya se leyó antes, esto resuelve
        // instantáneo sin tocar red.
        try {
          if (db && (db as any).capitulos) {
            const local = await (db as any).capitulos.get(capId);
            if (local?.contenido) {
              setContenidoCap(capId, local.contenido);
              return;
            }
          }
        } catch {}

        const { data, error } = await supabase
          .from("capitulos")
          .select("contenido")
          .eq("id", capId)
          .single();

        if (error || !data) {
          setCargandoContenido(capId, false);
          return;
        }

        const contenido = (data as any).contenido ?? "";
        setContenidoCap(capId, contenido);

        // Cache individual en Dexie — solo este capítulo, no el libro entero.
        try {
          if (db && (db as any).capitulos) {
            await (db as any).capitulos.update(capId, {
              contenido,
              status: "synced",
            });
          }
        } catch {}
      } catch {
        setCargandoContenido(capId, false);
      }
    },
    [setContenidoCap, setCargandoContenido],
  );

  return { contenidoPorCapId, cargandoContenidoIds, cargar };
}

/* ─────────────────────────────────────────────
   Barra de progreso VERTICAL — rail sobre borde derecho
   ───────────────────────────────────────────── */
function BarraProgresoVertical({ capId }: { capId: string }) {
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
   (ver cargarEntidades en el efecto principal). Sin fetch propio:
   así cambiar de capítulo no dispara red/IO y no parpadea.
   ───────────────────────────────────────────── */
function PersonajesPanel({ ids, border }: { ids: string[]; border: string }) {
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
function LugaresPanel({
  reinosIds,
  ciudadesIds,
  border: _border,
}: {
  reinosIds: string[];
  ciudadesIds: string[];
  border: string;
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
   Panel lateral izquierdo
   ───────────────────────────────────────────── */
function PanelLateral({
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
            border={border}
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
/* ─────────────────────────────────────────────
   Componente principal del lector
   ───────────────────────────────────────────── */
export default function Lector({
  slug,
  orden,
}: { slug?: string; orden?: string } = {}) {
  // OJO: `slug`/`orden` que llegan por prop desde el server component NO son
  // confiables en web. vercel.json reescribe internamente cualquier
  // `/garlia/libros/:id/leer/:capId` hacia
  // `/garlia/libros/placeholder/leer/placeholder` para servir el único HTML
  // prerrenderizado — el rewrite deja la URL del navegador intacta, pero los
  // `params` que recibe el server component en Vercel SÍ pasan a ser
  // literalmente "placeholder", no los valores reales. Por eso hay que
  // leerlos siempre del lado del cliente, desde la URL visible
  // (`window.location`), igual que en la ruta del APK
  // (/garlia/libros/leer?slug=...&orden=...) donde tampoco hay prop y se
  // leen de los query params.
  //
  // Nota: acá NO usamos next/navigation useSearchParams() a propósito. Ese
  // hook obliga a Next a hacer "bail out to client-side rendering" en
  // cualquier página que lo use sin un <Suspense> boundary alrededor, y en
  // esta ruta ese bailout terminaba tirando 500 en vez de degradar bien.
  // Leer directo de window.location logra lo mismo sin ese problema, porque
  // solo corre en el cliente dentro de useEffect.
  const [slugParam, setSlugParam] = useState<string>("");
  const [ordenParam, setOrdenParam] = useState<string>("");
  useEffect(() => {
    const segmentos = window.location.pathname.split("/").filter(Boolean);
    // .../garlia/libros/:slug/leer/:orden
    const idxLibros = segmentos.indexOf("libros");
    const slugDePath =
      idxLibros >= 0 ? (segmentos[idxLibros + 1] ?? "") : "";
    const idxLeer = segmentos.indexOf("leer");
    const ordenDePath = idxLeer >= 0 ? (segmentos[idxLeer + 1] ?? "") : "";
    const query = new URLSearchParams(window.location.search);
    setSlugParam(slugDePath || query.get("slug") || "");
    setOrdenParam(ordenDePath || query.get("orden") || "");
  }, []);

  const router = useRouter();
  const { fontScale, texturaPapel } = useLectorAjustes();

  // ── Estado de navegación/datos: leído del store, no de useState local ──────
  // Selectores granulares — cada uno solo re-renderiza el componente cuando
  // ESE campo cambia, no cuando cambia cualquier otro campo del store.
  const capId = useLectorStore((s) => s.capId);
  const capitulos = useLectorStore((s) => s.capitulos);
  const loading = useLectorStore((s) => s.loading);
  const error = useLectorStore((s) => s.error);
  const esExtra = useLectorStore((s) => s.esExtra);
  const activeCapTitle = useLectorStore((s) => s.activeCapTitle);
  const showSidebar = useLectorStore((s) => s.showSidebar);
  const slugCanonico = useLectorStore((s) => s.slugCanonico);

  const resetLibro = useLectorStore((s) => s.resetLibro);
  const setLoading = useLectorStore((s) => s.setLoading);
  const setError = useLectorStore((s) => s.setError);
  const setLibroResuelto = useLectorStore((s) => s.setLibroResuelto);
  const setCapitulosStore = useLectorStore((s) => s.setCapitulos);
  const setCapId = useLectorStore((s) => s.setCapId);
  const setActiveCapTitle = useLectorStore((s) => s.setActiveCapTitle);
  const setShowSidebar = useLectorStore((s) => s.setShowSidebar);
  const setContenidoCapBatch = useLectorStore((s) => s.setContenidoCapBatch);

  const resetEntidades = useLectorEntidadesStore((s) => s.resetEntidades);
  const mergePersonajes = useLectorEntidadesStore((s) => s.mergePersonajes);
  const mergeReinos = useLectorEntidadesStore((s) => s.mergeReinos);
  const mergeCiudades = useLectorEntidadesStore((s) => s.mergeCiudades);

  const hasScrolled = useRef(false);

  // ── Efecto A: resolver libro + cargar el ÍNDICE de capítulos (liviano) ─────
  // Trae metadata de TODOS los capítulos del libro (id, orden, título, ids
  // de entidades) pero NUNCA su `contenido` — eso se pide aparte, capítulo
  // por capítulo, bajo demanda (ver useCargadorContenido). Depende solo de
  // slugParam (no de ordenParam): cambiar de capítulo NO debe re-disparar
  // esta carga (Dexie+Supabase) ni el setLoading(true) que hace parpadear el
  // skeleton del índice y ocultar Personajes/Lugares.
  useEffect(() => {
    if (!slugParam) return;
    let cancelled = false;
    let resolvedLibroId: string | null = null;
    resetLibro();
    resetEntidades();
    setLoading(true);
    setError(null);

    const getDexieTable = async () => {
      try {
        if (!db || !(db as any).capitulos) return null;
        return (db as any).capitulos;
      } catch {
        return null;
      }
    };

    // Cachea SOLO metadata (sin contenido) — se llama con la lista completa
    // liviana del libro, una vez, al resolver el índice. No pisa el
    // `contenido` que ya estuviera guardado de lecturas previas (lo
    // preserva vía `prev?.contenido`), pero tampoco lo trae de red acá.
    const cachearMetaEnDexie = async (rows: any[]) => {
      const table = await getDexieTable();
      if (!table || rows.length === 0) return;
      try {
        const ids = rows.map((r) => r.id);
        const existing = (await table.bulkGet(ids)) as (any | undefined)[];
        const merged = rows.map((row: any, i: number) => {
          const prev = existing[i];
          return {
            ...prev,
            ...row,
            contenido: prev?.contenido ?? undefined,
            status: "synced",
          };
        });
        await table.bulkPut(merged);
      } catch (e) {
        console.warn("[Dexie] Error cacheando metadata de caps:", e);
      }
    };

    /**
     * Precarga (Dexie-first, con fallback a Supabase para lo que falte) los
     * reinos / ciudades / personajes referenciados por TODO el libro, no por
     * capítulo individual. Así, cambiar de capítulo es luego un simple
     * lookup sincrónico sobre el mapa ya en memoria — sin red, sin Dexie,
     * sin parpadeo.
     */
    const cargarEntidades = (caps: any[]) => {
      const personajesIds = collectIds(caps, "personajes_ids");
      const reinosIds = collectIds(caps, "reinos_ids");
      const ciudadesIds = collectIds(caps, "ciudades_ids");

      void loadPersonajesMap(personajesIds, (m) => {
        if (!cancelled) mergePersonajes(m);
      }).then((m) => {
        if (!cancelled) mergePersonajes(m);
      });

      void loadReinosMap(reinosIds, (m) => {
        if (!cancelled) mergeReinos(m);
      }).then((m) => {
        if (!cancelled) mergeReinos(m);
      });

      void loadCiudadesMap(ciudadesIds, (m) => {
        if (!cancelled) mergeCiudades(m);
      }).then((m) => {
        if (!cancelled) mergeCiudades(m);
      });
    };

    const aplicarCaps = (
      capsValidas: any[],
      libroId: string,
      esExtraLocal: boolean,
      actualSlug: string,
    ) => {
      if (cancelled) return;
      // ── Filtro de seguridad en cliente ────────────────────────────────────
      // Descarta caps que no sean públicos o que tengan fecha futura,
      // independientemente de la fuente (Supabase, Dexie, caché).
      const ahora = new Date();
      const caps = capsValidas.filter((c) => {
        const vis = c.visibilidad ?? "publico"; // fallback para datos Dexie sin campo
        if (vis === "oculto") return false;
        if (vis === "publico") return true;
        if (vis === "programado") {
          if (!c.fecha_publicacion) return false;
          return new Date(c.fecha_publicacion) <= ahora;
        }
        return false; // cualquier otro valor desconocido → ocultar
      });

      const lista: CapituloLista[] = caps.map((c) => ({
        id: c.id,
        orden: c.orden,
        titulo_capitulo: c.titulo_capitulo,
        fecha_publicacion: c.fecha_publicacion,
      }));

      setLibroResuelto({
        libroId,
        slugCanonico: actualSlug,
        esExtra: esExtraLocal,
      });
      setCapitulosStore(caps as unknown as CapituloScrollItem[], lista);
      cargarEntidades(caps);
      // La resolución de capId a partir de ordenParam queda a cargo del
      // Efecto B (más abajo), que reacciona a este nuevo `capitulos`.
    };

    const run = async () => {
      const hoy = new Date().toISOString();

      // ── 1. Resolver UUID del libro ────────────────────────────────────────
      let libroId: string;
      let esExtraLocal = false;
      let actualSlug = slugParam; // <--- Inicializamos con el parámetro actual

      if (esUUID(slugParam)) {
        const { data } = await supabase
          .from("libros")
          .select("id, titulo, categoria")
          .eq("id", slugParam)
          .single();
        if (!data) {
          if (!cancelled) setError("Libro no encontrado");
          return;
        }
        libroId = data.id;
        actualSlug = toSlug(data.titulo); // <--- Obtenemos el slug real si vino un UUID
        // Detectar tipo de grupo: poemario u otros sin navegación lineal
        if (data.categoria && esUUID(data.categoria)) {
          const { data: grupo } = await supabase
            .from("grupos_mundo")
            .select("nombre")
            .eq("id", data.categoria)
            .single();
          if (
            grupo?.nombre?.toLowerCase().includes("poemario") ||
            grupo?.nombre?.toLowerCase().includes("extra")
          ) {
            esExtraLocal = true;
          }
        }
        // Canonicalizamos el slug del libro en la URL de inmediato (link
        // legacy con UUID), conservando el segmento de capítulo actual.
        if (!cancelled) {
          router.replace(rutaLeer(actualSlug, ordenParam), {
            scroll: false,
          });
        }
      } else {
        let encontrado: {
          id: string;
          titulo: string;
          categoria?: string;
        } | null = null;
        try {
          if (db?.libros) {
            const dexieLibros = (await db.libros.toArray()) as any[];
            // Simplificamos la comparación manual usando la función toSlug importada arriba
            encontrado =
              dexieLibros.find(
                (l: any) => toSlug(l.titulo ?? "") === slugParam,
              ) ?? null;
          }
        } catch {}
        if (!encontrado) {
          const { data: todos } = await supabase
            .from("libros")
            .select("id, titulo, categoria");
          if (!todos) {
            if (!cancelled) setError("Libro no encontrado");
            return;
          }
          try {
            await db?.libros?.bulkPut(todos as any[]);
          } catch {}
          encontrado =
            todos.find((l) => toSlug(l.titulo) === slugParam) ?? null;
        }
        if (!encontrado) {
          if (!cancelled) setError("Libro no encontrado");
          return;
        }
        libroId = encontrado.id;
        actualSlug = toSlug(encontrado.titulo); // <--- Nos aseguramos de tener el slug formateado correctamente
        // Detectar tipo de grupo
        if (encontrado.categoria && esUUID(encontrado.categoria)) {
          const { data: grupo } = await supabase
            .from("grupos_mundo")
            .select("nombre")
            .eq("id", encontrado.categoria)
            .single();
          if (
            grupo?.nombre?.toLowerCase().includes("poemario") ||
            grupo?.nombre?.toLowerCase().includes("extra")
          ) {
            esExtraLocal = true;
          }
        }
        // El slug pudo venir con formato distinto al canónico (mayúsculas,
        // acentos, etc.) — lo normalizamos sin tocar el capítulo actual.
        if (actualSlug !== slugParam && !cancelled) {
          router.replace(rutaLeer(actualSlug, ordenParam), {
            scroll: false,
          });
        }
      }

      resolvedLibroId = libroId;

      // ── 2. Dexie-first: render instantáneo del ÍNDICE si hay caché ─────────
      // Ya no exige `c.contenido` para considerar el capítulo "cacheado" —
      // el índice (título, orden, ids de entidades) es útil aunque el texto
      // todavía no se haya leído nunca. De paso, hidrata `contenidoPorCapId`
      // con lo que sí esté cacheado (capítulos que el usuario ya leyó
      // antes), para que reabrir un capítulo leído sea instantáneo.
      let yaRenderizoDesdeCache = false;
      try {
        const table = await getDexieTable();
        if (table) {
          const cached: any[] = (await table
            .where("libro_id")
            .equals(libroId)
            .toArray()) as any[];
          const capsCached = cached.filter((c) => !c.deleted);
          if (capsCached.length > 0) {
            aplicarCaps(capsCached, libroId, esExtraLocal, actualSlug);
            const contenidoCacheado: Record<string, string> = {};
            for (const c of capsCached) {
              if (c.contenido) contenidoCacheado[c.id] = c.contenido;
            }
            if (Object.keys(contenidoCacheado).length > 0 && !cancelled) {
              setContenidoCapBatch(contenidoCacheado);
            }
            if (!cancelled) setLoading(false);
            yaRenderizoDesdeCache = true;
          }
        }
      } catch {}

      // ── 3. Fetch desde Supabase (siempre, para índice fresco) ─────────────
      // LIVIANO A PROPÓSITO: no pide `contenido`. Esto es solo para armar el
      // índice/navegación — el texto de cada capítulo se pide aparte, uno
      // por uno, cuando el lector realmente lo abre (ver
      // useContenidoCapitulo). Antes este único select traía el `contenido`
      // completo de TODOS los capítulos del libro; con un libro largo eso
      // eran decenas de miles de palabras bajadas y guardadas en memoria/
      // Dexie solo para mostrar un índice.
      type CapRaw = {
        id: string;
        orden: number;
        titulo_capitulo: string;
        fecha_publicacion: string;
        dia_absoluto: number | null;
        personajes_ids: string[];
        reinos_ids: string[] | null;
        ciudades_ids: string[] | null;
        libros: { titulo: string } | { titulo: string }[] | null;
        narrador: any;
      };

      const { data: indice, error: capsError } = await supabase
        .from("capitulos")
        .select(
          `id, orden, titulo_capitulo, fecha_publicacion, dia_absoluto, visibilidad, personajes_ids, reinos_ids, ciudades_ids, libros(titulo), narrador:personajes!narrador_id(id, nombre, img_url)`,
        )
        .eq("libro_id", libroId)
        .or(
          `visibilidad.eq.publico,and(visibilidad.eq.programado,fecha_publicacion.lte.${hoy.split("T")[0]})`,
        )
        .not("titulo_capitulo", "like", "[Ruta]%")
        .order("orden", { ascending: true });

      if (capsError) {
        if (!yaRenderizoDesdeCache && !cancelled) setError(capsError.message);
        return;
      }

      const normOne = <T,>(v: T | T[] | null | undefined): T | null => {
        if (!v) return null;
        return Array.isArray(v) ? (v[0] ?? null) : v;
      };

      const rawList = (indice as unknown as CapRaw[]) ?? [];
      const capsValidas = rawList.map((c) => ({
        id: c.id,
        orden: c.orden,
        titulo_capitulo: c.titulo_capitulo,
        // Sin `contenido` a propósito — ver comentario del select de arriba.
        fecha_publicacion: c.fecha_publicacion,
        dia_absoluto: c.dia_absoluto,
        personajes_ids: c.personajes_ids,
        reinos_ids: c.reinos_ids ?? [],
        ciudades_ids: c.ciudades_ids ?? [],
        libro_id: libroId,
        libros: normOne(c.libros) ?? undefined,
        _narrador: normOne(c.narrador),
      }));

      void cachearMetaEnDexie(capsValidas);
      aplicarCaps(capsValidas, libroId, esExtraLocal, actualSlug);
    };

    run()
      .catch(async (err) => {
        console.error("Error crítico en Lector:", err);
        try {
          const table = await getDexieTable();
          if (table && resolvedLibroId) {
            const todos = (await table.toArray()) as any[];
            const cached = todos.filter(
              (c) => !c.deleted && c.libro_id === resolvedLibroId,
            );
            if (cached.length > 0) {
              const estadoActual = useLectorStore.getState();
              aplicarCaps(
                cached,
                resolvedLibroId,
                estadoActual.esExtra,
                estadoActual.slugCanonico,
              );
              const contenidoCacheado: Record<string, string> = {};
              for (const c of cached) {
                if (c.contenido) contenidoCacheado[c.id] = c.contenido;
              }
              if (Object.keys(contenidoCacheado).length > 0) {
                setContenidoCapBatch(contenidoCacheado);
              }
              return;
            }
          }
        } catch {}
        if (!cancelled) setError("Error al abrir el pergamino");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugParam]);

  // ── Efecto B: resolver capId a partir de ordenParam ─────────────────────────
  // Se dispara al navegar entre capítulos (ordenParam cambia) o cuando los
  // capítulos terminan de cargar. A propósito NO toca `loading`: por eso
  // cambiar de capítulo no muestra de nuevo el skeleton ni hace desaparecer
  // los paneles de Personajes/Lugares — solo actualiza qué capítulo está
  // activo, de forma sincrónica.
  useEffect(() => {
    if (!ordenParam || capitulos.length === 0) return;

    let capActivo: CapituloScrollItem | null = null;
    if (esUUID(ordenParam)) {
      // URL legacy con UUID → encontrar el cap por ID
      capActivo =
        capitulos.find((c) => c.id === ordenParam) ?? capitulos[0] ?? null;
    } else {
      // URL numérica normal → buscar por número de orden
      const n = parseInt(ordenParam, 10);
      capActivo =
        (!isNaN(n) ? capitulos.find((c) => c.orden === n) : null) ??
        capitulos[0] ??
        null;
    }
    if (!capActivo) return;

    // Canonicalizar URL si el parámetro no era el número de orden correcto
    // (link legacy con UUID, o número fuera de rango).
    if (ordenParam !== String(capActivo.orden)) {
      router.replace(rutaLeer(slugCanonico, capActivo.orden), {
        scroll: false,
      });
    }

    hasScrolled.current = false;
    setCapId(capActivo.id);
    setActiveCapTitle(`${capActivo.orden}. ${capActivo.titulo_capitulo}`);
  }, [ordenParam, capitulos, slugCanonico, router]);

  // ── Navegación entre capítulos ─────────────────────────────────────────────
  /** Navegar a un cap por su ID (desde selector de índice, botones, etc.) */
  const handleNavigate = useCallback(
    (targetCapId: string) => {
      const cap = capitulos.find((c) => c.id === targetCapId);
      if (!cap) return;
      const url = rutaLeer(slugParam, cap.orden);
      // IMPORTANTE: el lector solo monta un capítulo a la vez (nunca todos).
      // El destino ya está disponible como METADATA en `capitulos` (cargado
      // por el Efecto A), sin necesidad de una navegación completa — pero su
      // `contenido` puede no estarlo todavía: el efecto de carga más abajo
      // (useCargadorContenido, disparado por el cambio de capId) se encarga
      // de pedirlo si hace falta (normalmente ya llegó vía el prefetch del
      // capítulo siguiente). Usamos history.pushState directo — NO
      // router.push/replace — porque
      // esta ruta usa `orden` como segmento de path dinámico ([orden]), y
      // cualquier navegación vía el router de Next hace que vuelva a
      // resolverse el Server Component de la página (aunque sea con
      // router.replace), lo que remonta el árbol un par de segundos después
      // y reinicia todo el estado del lector. history.pushState cambia la
      // URL visible (compartible, indexable si se visita directo — ver
      // generateMetadata en page.tsx) sin pasar por ese ciclo.
      window.history.pushState(null, "", url);
      setCapId(targetCapId);
      setActiveCapTitle(`${cap.orden}. ${cap.titulo_capitulo}`);
      hasScrolled.current = false;
      requestAnimationFrame(() => {
        document
          .getElementById(`cap-${targetCapId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [capitulos, slugParam],
  );

  const capActual = capActualDe(capitulos, capId);
  const capAnterior = capActual
    ? capVecino(capitulos, capActual.orden, -1)
    : null;
  const capSiguiente = capActual
    ? capVecino(capitulos, capActual.orden, 1)
    : null;
  const libroTitulo = capitulos[0]?.libros?.titulo;

  // ── Contenido bajo demanda ──────────────────────────────────────────────
  const { contenidoPorCapId, cargar: cargarContenido } = useCargadorContenido();

  // Cargar el contenido del capítulo activo apenas se resuelve capId.
  useEffect(() => {
    if (capId) void cargarContenido(capId);
  }, [capId, cargarContenido]);

  // Prefetch silencioso del capítulo siguiente — así "Siguiente" se siente
  // instantáneo aunque el lector nunca haya estado ahí. Se dispara junto
  // con el capítulo activo (no espera a que el lector llegue al final);
  // es un único fetch liviano por chapter-open, no una descarga masiva.
  useEffect(() => {
    if (capSiguiente) void cargarContenido(capSiguiente.id);
  }, [capSiguiente, cargarContenido]);

  // El objeto que le pasamos a CapituloScrollBlock necesita el contenido
  // "inyectado" desde el mapa — capActual (que viene de `capitulos`) nunca
  // lo trae.
  const capActualConContenido = capActual
    ? { ...capActual, contenido: contenidoPorCapId[capActual.id] ?? "" }
    : null;
  const contenidoListo =
    !!capActual && contenidoPorCapId[capActual.id] !== undefined;
  const _personajesIds = Array.from(new Set(capActual?.personajes_ids ?? []));

  // Scroll inicial al cap activo — espera a `contenidoListo`: el elemento
  // `cap-${capId}` recién existe en el DOM una vez que CapituloScrollBlock
  // se monta (que ahora ocurre después del fetch puntual de contenido, no
  // apenas resuelve el índice).
  useEffect(() => {
    if (loading || hasScrolled.current || !capId || !contenidoListo) return;
    hasScrolled.current = true;
    setTimeout(() => {
      document
        .getElementById(`cap-${capId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  }, [loading, capId, contenidoListo]);

  // Observar qué capítulo es visible para actualizar el título.
  // Depende también de `contenidoListo`: el elemento `cap-${capId}` recién
  // existe una vez que CapituloScrollBlock se monta (después del fetch
  // puntual de contenido) — sin esta dependencia, si el contenido tardaba
  // en cargar, el observer nunca se registraba.
  useEffect(() => {
    if (!capId || !contenidoListo) return;
    const container = document.getElementById("lector-scroll-container");
    const el = document.getElementById(`cap-${capId}`);
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const cap = capitulos.find((c) => c.id === capId);
          if (cap) setActiveCapTitle(`${cap.orden}. ${cap.titulo_capitulo}`);
        }
      },
      { root: container, threshold: 0.15, rootMargin: "-10% 0px -60% 0px" },
    );
    const t = setTimeout(() => {
      obs.observe(el);
    }, 300);
    return () => {
      clearTimeout(t);
      obs.disconnect();
    };
  }, [capId, capitulos, contenidoListo]);

  if (!loading && (error || capitulos.length === 0))
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-bg-main text-primary p-6 text-center">
        <h2 className="font-black uppercase text-xl mb-4 italic tracking-tighter">
          {error || "No hay capítulos disponibles"}
        </h2>
        <Btn
          size="sm"
          variant="outline"
          onClick={() => router.push(rutaLibro(slugParam))}
        >
          Volver al índice
        </Btn>
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg-main)",
      }}
    >
      {/* ── Barra superior fija en móvil ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-12 border-b border-primary/8 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--bg-main) 92%, transparent)",
        }}
      >
        <button
          className="flex items-center gap-2 text-primary/40 hover:text-primary transition-colors font-black text-micro uppercase tracking-widest"
          onClick={() => router.push(rutaLibro(slugParam))}
        >
          <ChevronLeft size={14} /> Volver
        </button>
        {libroTitulo && (
          <span className="text-primary/50 font-black text-micro uppercase tracking-wider italic truncate max-w-[45%] text-center">
            {libroTitulo}
          </span>
        )}
        <button
          className="flex items-center gap-1.5 text-primary/40 hover:text-primary transition-colors font-black text-micro uppercase tracking-widest"
          onClick={() => setShowSidebar(true)}
        >
          <List size={13} /> Índice
        </button>
        <AjustesLectura compact />
      </div>

      {/* ── Drawer lateral en móvil ── */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="md:hidden fixed inset-0 z-50"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 30%, transparent)",
                backdropFilter: "blur(2px)",
              }}
              transition={{ duration: 0.18 }}
              onClick={() => setShowSidebar(false)}
            />
            <motion.div
              animate={{ x: 0 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50"
              exit={{ x: "-100%" }}
              initial={{ x: "-100%" }}
              style={{
                width: "clamp(260px, 80vw, 340px)",
                background: "var(--bg-main)",
                borderRight:
                  "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <PanelLateral
                capActual={capActual}
                esExtra={esExtra}
                isMobile={true}
                libroTitulo={libroTitulo}
                onSelectCap={(id) => {
                  handleNavigate(id);
                  setShowSidebar(false);
                }}
                onVolver={() => router.push(rutaLibro(slugParam))}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Panel lateral — solo desktop ── */}
      <div className="hidden md:flex">
        <PanelLateral
          capActual={capActual}
          esExtra={esExtra}
          libroTitulo={libroTitulo}
          onSelectCap={handleNavigate}
          onVolver={() => router.push(rutaLibro(slugParam))}
        />
      </div>

      {/* ── Columna derecha: texto scrolleable ── */}
      <div
        className={`bg-bg-main text-primary-dark${texturaPapel ? " lector-textura-papel" : ""}`}
        id="lector-scroll-container"
        style={{
          flex: 1,
          height: "100vh",
          overflowY: "auto",
          position: "relative",
          ["--lector-font-scale" as any]: fontScale,
        }}
      >
        <Vignette />

        {/* Indicador de capítulo activo */}
        {activeCapTitle && (
          <div
            className="hidden md:flex sticky top-0 z-30 items-center justify-between gap-3 px-8 py-2.5 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in srgb, var(--bg-main) 90%, transparent), transparent)",
            }}
          >
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/25 italic truncate max-w-sm">
              {activeCapTitle}
            </span>
            <div className="pointer-events-auto">
              <AjustesLectura />
            </div>
          </div>
        )}

        {/* Padding top en móvil */}
        <div className="md:hidden h-12" />

        {/* Capítulo activo — uno solo a la vez.
            Mientras su `contenido` puntual está en vuelo (fetch bajo
            demanda, ver useCargadorContenido), mostramos un skeleton chico
            en vez de montar ContenidoInteractivo con texto vacío. */}
        {!loading && capActual && !contenidoListo && (
          <div
            className="max-w-2xl mx-auto px-6 py-24 flex flex-col gap-3"
            aria-hidden
          >
            {[95, 88, 92, 60, 0, 90, 85, 70].map((w, i) =>
              w === 0 ? (
                <div key={i} className="h-4" />
              ) : (
                <div
                  key={i}
                  style={{
                    height: 14,
                    width: `${w}%`,
                    borderRadius: 4,
                    background:
                      "color-mix(in srgb, var(--primary) 6%, transparent)",
                  }}
                />
              ),
            )}
          </div>
        )}

        {!loading && capActual && contenidoListo && capActualConContenido && (
          <CapituloScrollBlock
            key={capActual.id}
            cap={capActualConContenido}
            esExtra={esExtra}
            haySegSiguiente={!!capSiguiente}
            onNavigate={handleNavigate}
          />
        )}

        {/* Footer de navegación */}
        {!loading && capActual && contenidoListo && (
          <footer className="max-w-2xl mx-auto px-6 pb-20 pt-4 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 w-full max-w-xs">
              <div
                className="flex-1 h-px"
                style={{
                  background:
                    "linear-gradient(to right, transparent, color-mix(in srgb, var(--primary) 20%, transparent))",
                }}
              />
              {!capSiguiente && (
                <span
                  className="font-serif text-base"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                >
                  — Fin —
                </span>
              )}
              <div
                className="flex-1 h-px"
                style={{
                  background:
                    "linear-gradient(to left, transparent, color-mix(in srgb, var(--primary) 20%, transparent))",
                }}
              />
            </div>

            {esExtra ? (
              /* Poemario / extra: solo botón volver al índice, sin anterior/siguiente */
              <button
                className="flex items-center gap-2 text-primary/40 hover:text-primary font-black text-micro uppercase tracking-widest transition-all"
                onClick={() => router.push(rutaLibro(slugParam))}
              >
                <List size={16} /> Índice
              </button>
            ) : (
              /* Novela / libro: navegación anterior + índice + siguiente */
              <div className="flex items-center justify-between w-full gap-4">
                {capAnterior ? (
                  <button
                    className="flex items-center gap-2 text-primary/40 hover:text-primary font-black text-micro uppercase tracking-widest transition-all"
                    onClick={() => handleNavigate(capAnterior.id)}
                  >
                    <ChevronLeft size={14} /> Cap. {capAnterior.orden}
                  </button>
                ) : (
                  <div />
                )}

                <button
                  className="flex items-center gap-2 text-primary/40 hover:text-primary font-black text-micro uppercase tracking-widest transition-all"
                  onClick={() => router.push(rutaLibro(slugParam))}
                >
                  <List size={16} /> Índice
                </button>

                {capSiguiente ? (
                  <button
                    className="flex items-center gap-2 text-primary/40 hover:text-primary font-black text-micro uppercase tracking-widest transition-all"
                    onClick={() => handleNavigate(capSiguiente.id)}
                  >
                    Cap. {capSiguiente.orden} <ChevronRight size={14} />
                  </button>
                ) : (
                  <div />
                )}
              </div>
            )}
          </footer>
        )}
      </div>

      {/* Toast portal — una sola instancia */}
      <ToastPortal />
    </div>
  );
}

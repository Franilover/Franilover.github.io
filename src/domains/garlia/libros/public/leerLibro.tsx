"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, List, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState, useRef, useCallback } from "react";

import { Btn } from "@/components/ui";
import type {
  CapituloLista,
  CapituloScrollItem,
} from "@/domains/garlia/libros/capitulos/types";
import {
  CapituloScrollBlock,
  ToastPortal,
} from "@/domains/garlia/libros/public/CapituloScrollBlock";
import { Vignette } from "@/domains/garlia/libros/public/LectorUI";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import { navegarRutaDinamica } from "@/lib/utils/navegacionTauri";
// ⚠️ Ajustar esta ruta si syncEngine.ts vive en otra carpeta del proyecto.
import {
  collectIds,
  loadCiudadesMap,
  loadPersonajesMap,
  loadReinosMap,
} from "@/infra/sync/syncEngine";
import { toSlug, esUUID } from "@/lib/utils/slugify";

/* ─────────────────────────────────────────────
   Tipos
   ───────────────────────────────────────────── */
interface NarradorInfo {
  id: string;
  nombre: string;
  img_url?: string | null;
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
function PersonajesPanel({
  ids,
  border,
  personajesMap,
}: {
  ids: string[];
  border: string;
  personajesMap: Record<
    string,
    { id: string; nombre: string; img_url?: string | null }
  >;
}) {
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
  reinosMap,
  ciudadesMap,
}: {
  reinosIds: string[];
  ciudadesIds: string[];
  border: string;
  reinosMap: Record<string, { id: string; nombre: string }>;
  ciudadesMap: Record<string, { id: string; nombre: string }>;
}) {
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
  capitulos,
  capIdActual,
  loading,
  esExtra,
  onVolver,
  onSelectCap,
  isMobile,
  personajesMap,
  reinosMap,
  ciudadesMap,
}: {
  libroTitulo?: string;
  capActual: CapituloScrollItem | null;
  capitulos: CapituloScrollItem[];
  capIdActual: string;
  loading?: boolean;
  esExtra?: boolean;
  onVolver: () => void;
  onSelectCap?: (capId: string) => void;
  isMobile?: boolean;
  personajesMap: Record<string, any>;
  reinosMap: Record<string, any>;
  ciudadesMap: Record<string, any>;
}) {
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
            ciudadesMap={ciudadesMap}
            reinosIds={(capActual as any).reinos_ids ?? []}
            reinosMap={reinosMap}
          />
        )}
        {!loading && !esExtra && personajesIds.length > 0 && (
          <div style={{ padding: "10px 16px 0" }}>
            <PersonajesPanel
              border={border}
              ids={personajesIds}
              personajesMap={personajesMap}
            />
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
export default function Lector() {
  const params = useParams();
  const idFromNext = params?.id as string;
  const capIdFromNext = params?.capId as string;
  // En output:"export" + rewrite de Vercel a /placeholder/leer/placeholder,
  // useParams() devuelve los valores horneados en build, no los reales de
  // la URL. Si detectamos ese caso, leemos ambos segmentos reales desde
  // window.location, que sí refleja la URL que ve el usuario.
  const [slugParam, setSlugParam] = useState<string>(idFromNext);
  const [ordenParam, setOrdenParam] = useState<string>(capIdFromNext);

  useEffect(() => {
    if (idFromNext !== "placeholder" && capIdFromNext !== "placeholder") {
      setSlugParam(idFromNext);
      setOrdenParam(capIdFromNext);
      return;
    }
    if (typeof window === "undefined") return;
    // /garlia/libros/:id/leer/:capId
    const partes = window.location.pathname.split("/").filter(Boolean);
    const leerIdx = partes.indexOf("leer");
    if (leerIdx > 0 && partes[leerIdx + 1]) {
      setSlugParam(partes[leerIdx - 1]);
      setOrdenParam(partes[leerIdx + 1]);
    }
  }, [idFromNext, capIdFromNext]);

  const router = useRouter();

  const [_id, setId] = useState<string>("");
  const [capId, setCapId] = useState<string>("");
  const [capitulos, setCapitulos] = useState<CapituloScrollItem[]>([]);
  const [_listaCapitulos, setListaCapitulos] = useState<CapituloLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [esExtra, setEsExtra] = useState(false); // poemario / sin grupo
  const [activeCapTitle, setActiveCapTitle] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false); // móvil: drawer lateral
  // Slug canónico del libro (puede diferir de slugParam si llegó un UUID legacy).
  const [slugCanonico, setSlugCanonico] = useState(slugParam);
  // Mapas de entidades (reino / ciudad / personaje) cacheados vía Dexie,
  // precargados una sola vez para TODO el libro. Cambiar de capítulo es
  // luego un simple lookup sincrónico sobre estos mapas — sin red, sin
  // parpadeo. Se rellenan en el efecto de carga del libro (ver más abajo).
  const [personajesMap, setPersonajesMap] = useState<Record<string, any>>({});
  const [reinosMap, setReinosMap] = useState<Record<string, any>>({});
  const [ciudadesMap, setCiudadesMap] = useState<Record<string, any>>({});
  const hasScrolled = useRef(false);

  // ── Efecto A: resolver libro + cargar TODOS los capítulos ──────────────────
  // Depende solo de slugParam (no de ordenParam): cambiar de capítulo NO debe
  // re-disparar esta carga pesada (Dexie+Supabase) ni el setLoading(true) que
  // hace parpadear el skeleton del índice y ocultar Personajes/Lugares. Eso es
  // justamente lo que causaba el parpadeo al cambiar de capítulo.
  useEffect(() => {
    if (!slugParam) return;
    let cancelled = false;
    let resolvedLibroId: string | null = null;
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

    const cachearEnDexie = async (rows: any[]) => {
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
            contenido: row.contenido ?? prev?.contenido ?? "",
            status: "synced",
          };
        });
        await table.bulkPut(merged);
      } catch (e) {
        console.warn("[Dexie] Error cacheando caps:", e);
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
        if (!cancelled) setPersonajesMap((prev) => ({ ...prev, ...m }));
      }).then((m) => {
        if (!cancelled) setPersonajesMap((prev) => ({ ...prev, ...m }));
      });

      void loadReinosMap(reinosIds, (m) => {
        if (!cancelled) setReinosMap((prev) => ({ ...prev, ...m }));
      }).then((m) => {
        if (!cancelled) setReinosMap((prev) => ({ ...prev, ...m }));
      });

      void loadCiudadesMap(ciudadesIds, (m) => {
        if (!cancelled) setCiudadesMap((prev) => ({ ...prev, ...m }));
      }).then((m) => {
        if (!cancelled) setCiudadesMap((prev) => ({ ...prev, ...m }));
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

      setId(libroId);
      setEsExtra(esExtraLocal);
      setSlugCanonico(actualSlug);
      setListaCapitulos(lista);
      setCapitulos(caps as unknown as CapituloScrollItem[]);
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
          router.replace(`/garlia/libros/${actualSlug}/leer/${ordenParam}`, {
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
          router.replace(`/garlia/libros/${actualSlug}/leer/${ordenParam}`, {
            scroll: false,
          });
        }
      }

      resolvedLibroId = libroId;

      // ── 2. Dexie-first: render instantáneo si hay caché ───────────────────
      let yaRenderizoDesdeCache = false;
      try {
        const table = await getDexieTable();
        if (table) {
          const cached: any[] = (await table
            .where("libro_id")
            .equals(libroId)
            .toArray()) as any[];
          const capsCached = cached.filter((c) => c.contenido && !c.deleted);
          if (capsCached.length > 0) {
            aplicarCaps(capsCached, libroId, esExtraLocal, actualSlug);
            if (!cancelled) setLoading(false);
            yaRenderizoDesdeCache = true;
          }
        }
      } catch {}

      // ── 3. Fetch desde Supabase (siempre, para datos frescos) ─────────────
      type CapRaw = {
        id: string;
        orden: number;
        titulo_capitulo: string;
        contenido: string;
        fecha_publicacion: string;
        personajes_ids: string[];
        reinos_ids: string[] | null;
        ciudades_ids: string[] | null;
        libros: { titulo: string } | { titulo: string }[] | null;
        narrador: any;
      };

      const { data: contenidos, error: capsError } = await supabase
        .from("capitulos")
        .select(
          `id, orden, titulo_capitulo, contenido, fecha_publicacion, visibilidad, personajes_ids, reinos_ids, ciudades_ids, libros(titulo), narrador:personajes!narrador_id(id, nombre, img_url)`,
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

      const rawList = (contenidos as unknown as CapRaw[]) ?? [];
      const capsValidas = rawList.map((c) => ({
        id: c.id,
        orden: c.orden,
        titulo_capitulo: c.titulo_capitulo,
        contenido: c.contenido,
        fecha_publicacion: c.fecha_publicacion,
        personajes_ids: c.personajes_ids,
        reinos_ids: c.reinos_ids ?? [],
        ciudades_ids: c.ciudades_ids ?? [],
        libro_id: libroId,
        libros: normOne(c.libros) ?? undefined,
        _narrador: normOne(c.narrador),
      }));

      void cachearEnDexie(capsValidas);
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
              (c) =>
                !c.deleted && c.libro_id === resolvedLibroId && c.contenido,
            );
            if (cached.length > 0) {
              aplicarCaps(cached, resolvedLibroId, esExtra, slugCanonico);
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
      router.replace(`/garlia/libros/${slugCanonico}/leer/${capActivo.orden}`, {
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
      const url = `/garlia/libros/${slugParam}/leer/${cap.orden}`;
      const el = document.getElementById(`cap-${targetCapId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        router.replace(url, { scroll: false });
      } else {
        router.push(url);
      }
      setCapId(targetCapId);
      setActiveCapTitle(`${cap.orden}. ${cap.titulo_capitulo}`);
    },
    [capitulos, slugParam, router],
  );

  const capActual = capitulos.find((c) => c.id === capId) ?? null;
  const capAnterior = capActual
    ? (capitulos.find((c) => c.orden === capActual.orden - 1) ?? null)
    : null;
  const capSiguiente = capActual
    ? (capitulos.find((c) => c.orden === capActual.orden + 1) ?? null)
    : null;
  const libroTitulo = capitulos[0]?.libros?.titulo;
  const _personajesIds = Array.from(new Set(capActual?.personajes_ids ?? []));

  // Scroll inicial al cap activo
  useEffect(() => {
    if (loading || hasScrolled.current || !capId) return;
    hasScrolled.current = true;
    setTimeout(() => {
      document
        .getElementById(`cap-${capId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  }, [loading, capId]);

  // Observar qué capítulo es visible para actualizar el título
  useEffect(() => {
    if (!capId) return;
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
  }, [capId, capitulos]);

  if (!loading && (error || capitulos.length === 0))
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-bg-main text-primary p-6 text-center">
        <h2 className="font-black uppercase text-xl mb-4 italic tracking-tighter">
          {error || "No hay capítulos disponibles"}
        </h2>
        <Btn
          size="sm"
          variant="outline"
          onClick={() => navegarRutaDinamica(`/garlia/libros/${slugParam}`, () => router.push(`/garlia/libros/${slugParam}`))}
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
          onClick={() => navegarRutaDinamica(`/garlia/libros/${slugParam}`, () => router.push(`/garlia/libros/${slugParam}`))}
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
                capIdActual={capId}
                capitulos={capitulos}
                ciudadesMap={ciudadesMap}
                esExtra={esExtra}
                isMobile={true}
                libroTitulo={libroTitulo}
                loading={loading}
                personajesMap={personajesMap}
                reinosMap={reinosMap}
                onSelectCap={(id) => {
                  handleNavigate(id);
                  setShowSidebar(false);
                }}
                onVolver={() => navegarRutaDinamica(`/garlia/libros/${slugParam}`, () => router.push(`/garlia/libros/${slugParam}`))}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Panel lateral — solo desktop ── */}
      <div className="hidden md:flex">
        <PanelLateral
          capActual={capActual}
          capIdActual={capId}
          capitulos={capitulos}
          ciudadesMap={ciudadesMap}
          esExtra={esExtra}
          libroTitulo={libroTitulo}
          loading={loading}
          personajesMap={personajesMap}
          reinosMap={reinosMap}
          onSelectCap={handleNavigate}
          onVolver={() => navegarRutaDinamica(`/garlia/libros/${slugParam}`, () => router.push(`/garlia/libros/${slugParam}`))}
        />
      </div>

      {/* ── Columna derecha: texto scrolleable ── */}
      <div
        className="bg-bg-main text-primary-dark"
        id="lector-scroll-container"
        style={{
          flex: 1,
          height: "100vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <Vignette />

        {/* Indicador de capítulo activo */}
        {activeCapTitle && (
          <div
            className="hidden md:flex sticky top-0 z-30 items-center gap-3 px-8 py-2.5 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in srgb, var(--bg-main) 90%, transparent), transparent)",
            }}
          >
            <span className="text-micro font-black uppercase tracking-[0.2em] text-primary/25 italic truncate max-w-sm">
              {activeCapTitle}
            </span>
          </div>
        )}

        {/* Padding top en móvil */}
        <div className="md:hidden h-12" />

        {/* Capítulo activo — uno solo a la vez */}
        {!loading && capActual && (
          <CapituloScrollBlock
            key={capActual.id}
            cap={capActual}
            esExtra={esExtra}
            haySegSiguiente={!!capSiguiente}
            onNavigate={handleNavigate}
          />
        )}

        {/* Footer de navegación */}
        {!loading && capActual && (
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
                onClick={() => navegarRutaDinamica(`/garlia/libros/${slugParam}`, () => router.push(`/garlia/libros/${slugParam}`))}
              >
                <List size={16} /> Índice
              </button>
            ) : (
              /* Novela / libro: navegación anterior + índice + siguiente */
              <div className="flex items-center justify-between w-full gap-4">
                {capAnterior ? (
                  <button
                    className="flex items-center gap-2 text-primary/40 hover:text-primary font-black text-micro uppercase tracking-widest transition-all"
                    onClick={() =>
                      router.push(
                        `/garlia/libros/${slugParam}/leer/${capAnterior.orden}`,
                      )
                    }
                  >
                    <ChevronLeft size={14} /> Cap. {capAnterior.orden}
                  </button>
                ) : (
                  <div />
                )}

                <button
                  className="flex items-center gap-2 text-primary/40 hover:text-primary font-black text-micro uppercase tracking-widest transition-all"
                  onClick={() => navegarRutaDinamica(`/garlia/libros/${slugParam}`, () => router.push(`/garlia/libros/${slugParam}`))}
                >
                  <List size={16} /> Índice
                </button>

                {capSiguiente ? (
                  <button
                    className="flex items-center gap-2 text-primary/40 hover:text-primary font-black text-micro uppercase tracking-widest transition-all"
                    onClick={() =>
                      router.push(
                        `/garlia/libros/${slugParam}/leer/${capSiguiente.orden}`,
                      )
                    }
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

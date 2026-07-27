"use client";
import { AlertCircle, Music, ExternalLink, ChevronLeft, Info } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { Btn, Loading } from "@/components/ui";
import { MotionDiv } from "@/components/ui/Motion";
import { SmartImage } from "@/components/ui/SmartImage";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import { navegarRutaDinamica } from "@/lib/utils/navegacionTauri";
import { toSlug, esUUID } from "@/lib/utils/slugify";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 680px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export interface Seccion {
  id: string;
  nombre_seccion: string;
  letra_es?: string;
  letra_en?: string;
  letra_jp?: string;
  letra_romaji?: string;
  orden: number;
  timings_es?:     Record<string, number> | null;
  timings_en?:     Record<string, number> | null;
  timings_jp?:     Record<string, number> | null;
  timings_romaji?: Record<string, number> | null;
}

const getLetra = (sec: Seccion, lang: "es" | "en" | "jp" | "romaji"): string =>
  (lang === "es" ? sec.letra_es : lang === "en" ? sec.letra_en : lang === "jp" ? sec.letra_jp : sec.letra_romaji) || "";

interface PersonajeRef {
  id: string;
  nombre: string;
  img_url?: string | null;
}

interface Cancion {
  id: string;
  titulo: string;
  personaje_id?: string | null;
  personaje?: PersonajeRef | PersonajeRef[] | null;
  estado: string;
  portada_url?: string;
  visible: boolean;
  links?: { titulo: string; url: string }[];
  info_cancion?: string | null;
}

function normPersonaje(v: PersonajeRef | PersonajeRef[] | null | undefined): PersonajeRef | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// ── Bloque imagen/info con flip al tocar ────────────────────────────────────
function CoverFlip({
  portada_url,
  titulo,
  info,
  border: _border,
  size,
}: {
  portada_url?: string;
  titulo: string;
  info?: string | null;
  border: string;
  size: string; // CSS value, e.g. "clamp(250px, 80%, 480px)"
}) {
  const [flipped, setFlipped] = useState(false);
  const hasInfo = !!info?.trim();

  return (
    <div
      style={{
        width: size,
        aspectRatio: "1 / 1",
        position: "relative",
        cursor: hasInfo ? "pointer" : "default",
        flexShrink: 0,
        perspective: "1200px", // necesario para que el flip 3D tenga profundidad
      }}
      onClick={() => hasInfo && setFlipped((f) => !f)}
    >
      {/* Sombra offset estilo impresión antigua — fuera del contexto 3D */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "2px",
          boxShadow: "5px 5px 0 color-mix(in srgb, var(--primary) 10%, transparent)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Card container */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          borderRadius: "2px",
          border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
          zIndex: 1,
          // overflow: "hidden" NO VA ACÁ — destruye el contexto 3D
        }}
      >
        {/* Frente: portada */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          {/* Filtro sepia sobre la imagen */}
          <div style={{ width: "100%", height: "100%", filter: "sepia(25%) contrast(0.93) brightness(0.93)" }}>
            <SmartImage
              alt={titulo}
              className="w-full h-full object-cover"
              fallbackIcon={<Music size={28} />}
              src={portada_url || "/placeholder-cover.jpg"}
            />
          </div>
          {/* Esquina doblada estilo papel antiguo */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 22,
              height: 22,
              background: "var(--bg-main)",
              clipPath: "polygon(100% 0, 0 0, 100% 100%)",
              opacity: 0.65,
            }}
          />
          {/* Hint sutil: borde inferior con gradiente cuando hay info */}
          {hasInfo && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                background: "linear-gradient(to right, transparent, color-mix(in srgb, var(--primary) 30%, transparent), transparent)",
              }}
            />
          )}
        </div>

        {/* Reverso: info_cancion */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "var(--bg-main)",
            overflowY: "auto",
            padding: "20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <p
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.8,
              color: "var(--primary)",
              opacity: 0.75,
              whiteSpace: "pre-wrap",
              margin: 0,
              flex: 1,
            }}
          >
            {info}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <span
              style={{
                fontSize: 7.5,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--primary)",
                opacity: 0.2,
              }}
            >
              Toca para volver
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CancionDetallesPage() {
  const params = useParams();
  const router = useRouter();
  const paramFromNext = Array.isArray(params?.id)
    ? params.id[0]
    : (params?.id as string);
  // En output:"export" + rewrite de Vercel a /placeholder, useParams()
  // devuelve el valor horneado en build ("placeholder"), no el slug real
  // de la URL. Si detectamos ese caso, leemos el segmento real desde
  // window.location, que sí refleja la URL que ve el usuario.
  const [slugParam, setSlugParam] = useState<string>(paramFromNext);

  useEffect(() => {
    if (paramFromNext !== "placeholder") {
      setSlugParam(paramFromNext);
      return;
    }
    if (typeof window === "undefined") return;
    const partes = window.location.pathname.split("/").filter(Boolean);
    // /garlia/canciones/:slug
    const real = partes[partes.length - 1];
    if (real) setSlugParam(real);
  }, [paramFromNext]);

  // id es el UUID real resuelto a partir del slug
  const [id, setId] = useState<string>("");

  const [cancion, setCancion] = useState<Cancion | null>(null);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorAcceso, setErrorAcceso] = useState(false);
  const isMobile = useIsMobile();

  // ── Resolver slug → UUID ─────────────────────────────────────────────────
  useEffect(() => {
    if (!slugParam) return;

    const resolver = async () => {
      // Caso 1: ya es UUID (links viejos) → redirigir a slug canónico
      if (esUUID(slugParam)) {
        const { data } = await supabase
          .from("canciones").select("id, titulo").eq("id", slugParam).single();
        if (data) {
          navegarRutaDinamica(`/garlia/canciones/${toSlug(data.titulo)}`, () =>
            router.replace(`/garlia/canciones/${toSlug(data.titulo)}`),
          );
          setId(data.id);
        }
        return;
      }
      // Caso 2: es un slug → buscar comparando
      const { data: todas } = await supabase.from("canciones").select("id, titulo");
      if (!todas) return;
      const encontrada = todas.find(c => toSlug(c.titulo) === slugParam);
      if (encontrada) setId(encontrada.id);
      else setErrorAcceso(true);
    };

    void resolver();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugParam]);

  // Reemplaza el useEffect del fetch (líneas ~187-238)

useEffect(() => {
  if (!id) return;

  void (async () => {
    try {
      if (db) {
        const [cachedCancion, cachedSecciones] = await Promise.all([
          db.canciones.get(id),
          db.secciones_cancion.where("cancion_id").equals(id).sortBy("orden"),
        ]);

        // ✅ Solo desbloquear loading si tenemos AMBAS cosas
        if (cachedCancion && cachedSecciones && cachedSecciones.length > 0) {
          setCancion(cachedCancion as unknown as Cancion);
          setSecciones(cachedSecciones as Seccion[]);
          setLoading(false); // ← solo aquí, cuando hay letra también
        } else if (cachedCancion) {
          // Tenemos canción pero no secciones: mostramos canción
          // pero dejamos loading=true para esperar la letra del servidor
          setCancion(cachedCancion as unknown as Cancion);
        }
      }
    } catch {}

    try {
      const [{ data: c, error: ec }, { data: s, error: es }] = await Promise.all([
        supabase
          .from("canciones")
          .select("*, personaje:personajes!personaje_id(id, nombre, img_url)")
          .eq("id", id)
          .eq("visible", true)
          .single(),
        supabase
          .from("secciones_cancion")
          .select("id, nombre_seccion, letra_es, letra_en, letra_jp, letra_romaji, orden")
          .eq("cancion_id", id)
          .order("orden", { ascending: true }),
      ]);

      if (ec || !c) {
        setErrorAcceso(true);
        setLoading(false);
        return;
      }
      if (es) throw es;
      setCancion(c as Cancion);
      setSecciones((s || []) as Seccion[]);
      try {
        if (db && s && s.length > 0) await db.secciones_cancion.bulkPut(s as any);
      } catch {}
    } catch {
      setErrorAcceso(true);
    } finally {
      setLoading(false);
    }
  })();
}, [id]);

  if (loading) return <Loading text="Cargando..." />;

  if (errorAcceso)
    return (
      <div className="h-screen flex items-center justify-center bg-bg-main flex-col gap-4 text-center px-6">
        <AlertCircle className="text-red-400" size={48} />
        <p className="text-primary uppercase text-micro tracking-widest italic font-black">
          Canción no encontrada
        </p>
        <Btn className="mt-4 rounded-full" onClick={() => router.push("/garlia/canciones")}>
          Volver
        </Btn>
      </div>
    );

  const personaje = normPersonaje(cancion?.personaje);
  const border = "1px solid var(--color-border, color-mix(in srgb, var(--primary) 12%, transparent))";

  // ---------------------------------------------------------------------------
  // VISTA CELULAR (MOBILE) — rediseñada
  // ---------------------------------------------------------------------------
  if (isMobile) {
    return (
      <div
        style={{
          minHeight: "100%",
          background: "var(--bg-main)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 48,
        }}
      >
        {/* Botón volver */}
        <div style={{ padding: "16px 24px 0" }}>
          <button
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--primary)",
              opacity: 0.3,
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "opacity 0.15s",
            }}
            onClick={() => router.push("/garlia/canciones")}
          >
            <ChevronLeft size={10} />
            Volver
          </button>
        </div>

        {/* ── Hero con imagen con márgenes y flip igual que desktop ── */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "center" }}>
          <CoverFlip
            border={border}
            info={cancion?.info_cancion}
            portada_url={cancion?.portada_url}
            size="min(100%, 400px)"
            titulo={cancion?.titulo ?? ""}
          />
        </div>

        {/* Título y personaje debajo de la imagen */}
        <div style={{ padding: "20px 24px 0", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "clamp(1.7rem, 8vw, 2.4rem)",
              fontWeight: 900,
              color: "var(--primary)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              textTransform: "uppercase",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            {cancion?.titulo}
          </h1>
          {personaje && (
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--primary)",
                opacity: 0.55,
                margin: 0,
                letterSpacing: "0.04em",
              }}
            >
              {personaje.nombre}
            </p>
          )}
        </div>

        {/* ── Links ── */}
        {cancion?.links && cancion.links.length > 0 && (
          <MotionDiv
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 10 }}
            style={{ padding: "18px 32px 0" }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
                scrollbarWidth: "none",
              }}
            >
              {cancion.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    border,
                    borderRadius: "var(--radius-btn, 99px)",
                    textDecoration: "none",
                    color: "var(--primary)",
                    fontSize: 10.5,
                    fontWeight: 600,
                    opacity: 0.7,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    background: "color-mix(in srgb, var(--primary) 4%, transparent)",
                  }}
                  target="_blank"
                >
                  {link.titulo}
                  <ExternalLink size={9} style={{ opacity: 0.5 }} />
                </a>
              ))}
            </div>
          </MotionDiv>
        )}

        {/* ── Separador Letra ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "32px 32px 0",
            paddingBottom: 4,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "color-mix(in srgb, var(--primary) 8%, transparent)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Music size={9} style={{ color: "var(--primary)", opacity: 0.25 }} />
            <span
              style={{
                fontSize: 8,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--primary)",
                opacity: 0.25,
              }}
            >
              Letra
            </span>
          </div>
          <div style={{ flex: 1, height: 1, background: "color-mix(in srgb, var(--primary) 8%, transparent)" }} />
        </div>

        {/* ── Letra ── */}
        <div style={{ padding: "24px 32px 0" }}>
          {secciones.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {secciones.map((sec, i) => {
                const texto = getLetra(sec, "es");
                if (!texto.trim()) return null;
                return (
                  <MotionDiv
                    key={sec.id}
                    animate={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: 8 }}
                    style={{ paddingBottom: 40 }}
                    transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}
                  >
                    {sec.nombre_seccion && (
                      <p
                        style={{
                          fontSize: 8,
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "var(--primary)",
                          opacity: 0.25,
                          marginBottom: 12,
                          margin: "0 0 12px",
                        }}
                      >
                        {sec.nombre_seccion}
                      </p>
                    )}
                    <p
                      style={{
                        fontSize: "1rem",
                        fontFamily: "var(--font-lora, serif)",
                        fontStyle: "italic",
                        lineHeight: 1.85,
                        color: "var(--primary)",
                        opacity: 0.85,
                        whiteSpace: "pre-wrap",
                        margin: 0,
                      }}
                    >
                      {texto}
                    </p>
                  </MotionDiv>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                height: "30vh",
              }}
            >
              <Music size={28} style={{ color: "var(--primary)", opacity: 0.12 }} />
              <p
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--primary)",
                  opacity: 0.2,
                }}
              >
                Letra en proceso
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VISTA COMPUTADORA (DESKTOP)
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "52px", // ancho del sidebar
        right: 0,
        bottom: 0,
        overflow: "hidden",
        background: "var(--bg-main)",
        display: "flex",
      }}
    >
      {/* ── Columna izquierda: 50%, scrolleable ── */}
      <MotionDiv
        animate={{ opacity: 1, x: 0 }}
        initial={{ opacity: 0, x: -16 }}
        style={{
          flex: "0 0 50%",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflowY: "auto",
          padding: "40px clamp(24px, 4vw, 56px)",
          gap: 32,
        }}
        transition={{ duration: 0.4 }}
      >
        {/* Volver */}
        <div>
          <button
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--primary)",
              opacity: 0.3,
              transition: "opacity 0.15s",
            }}
            onClick={() => router.push("/garlia/canciones")}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.3")}
          >
            ← Volver
          </button>
        </div>

        {/* Imagen con flip a info */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <CoverFlip
            border={border}
            info={cancion?.info_cancion}
            portada_url={cancion?.portada_url}
            size="clamp(250px, 80%, 480px)"
            titulo={cancion?.titulo ?? ""}
          />
        </div>

        {/* Título, personaje y links */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
              fontWeight: 900,
              color: "var(--primary)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              textTransform: "uppercase",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            {cancion?.titulo}
          </h1>

          {personaje && (
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--primary)",
                opacity: 0.7,
                margin: 0,
              }}
            >
              {personaje.nombre}
            </p>
          )}

          {cancion?.links && cancion.links.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, paddingTop: 8 }}>
              {cancion.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    border,
                    borderRadius: "var(--radius-btn, 20px)",
                    textDecoration: "none",
                    color: "var(--primary)",
                    fontSize: 11,
                    fontWeight: 600,
                    opacity: 0.7,
                    transition: "opacity 0.15s",
                  }}
                  target="_blank"
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                >
                  <span>{link.titulo}</span>
                  <ExternalLink size={10} style={{ opacity: 0.5 }} />
                </a>
              ))}
            </div>
          )}
        </div>
      </MotionDiv>

      {/* ── Columna derecha: letra, scrolleable ── */}
      <MotionDiv
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 12 }}
        style={{
          flex: 1,
          overflowY: "auto",
          height: "100%",
          padding: "48px clamp(24px, 4vw, 64px)",
        }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 20 }}>
          <Music size={11} style={{ color: "var(--primary)", opacity: 0.3 }} />
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--primary)",
              opacity: 0.3,
            }}
          >
            Letra
          </span>
        </div>

        {secciones.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {secciones.map((sec, i) => {
              const texto = getLetra(sec, "es");
              if (!texto.trim()) return null;
              return (
                <MotionDiv
                  key={sec.id}
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                >
                  {sec.nombre_seccion && (
                    <p
                      style={{
                        fontSize: 8.5,
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "var(--primary)",
                        opacity: 0.25,
                        marginBottom: 14,
                      }}
                    >
                      {sec.nombre_seccion}
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: "1.08rem",
                      fontFamily: "var(--font-lora, serif)",
                      fontStyle: "italic",
                      lineHeight: 1.85,
                      color: "var(--primary)",
                      opacity: 0.85,
                      whiteSpace: "pre-wrap",
                      margin: 0,
                    }}
                  >
                    {texto}
                  </p>
                </MotionDiv>
              );
            })}
            <div style={{ height: 80 }} />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              height: "50vh",
            }}
          >
            <Music size={32} style={{ color: "var(--primary)", opacity: 0.12 }} />
            <p
              style={{
                fontSize: 9.5,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--primary)",
                opacity: 0.2,
              }}
            >
              Letra en proceso
            </p>
          </div>
        )}
      </MotionDiv>
    </div>
  );
}

// ── Componente flip inline para mobile ──────────────────────────────────────
function InfoFlipMobile({ info, border }: { info: string; border: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "color-mix(in srgb, var(--primary) 5%, transparent)",
          border,
          borderRadius: open ? "var(--radius-btn, 12px) var(--radius-btn, 12px) 0 0" : "var(--radius-btn, 12px)",
          padding: "10px 14px",
          cursor: "pointer",
          color: "var(--primary)",
          transition: "border-radius 0.2s",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Info size={10} style={{ opacity: 0.5 }} />
          <span
            style={{
              fontSize: 8.5,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: 0.5,
            }}
          >
            Información
          </span>
        </div>
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            opacity: 0.3,
            transition: "transform 0.2s",
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <MotionDiv
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: -4 }}
          style={{
            border,
            borderTop: "none",
            borderRadius: "0 0 var(--radius-btn, 12px) var(--radius-btn, 12px)",
            padding: "14px 16px 16px",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
          transition={{ duration: 0.2 }}
        >
          <p
            style={{
              fontSize: "0.82rem",
              lineHeight: 1.75,
              color: "var(--primary)",
              opacity: 0.72,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {info}
          </p>
        </MotionDiv>
      )}
    </div>
  );
}
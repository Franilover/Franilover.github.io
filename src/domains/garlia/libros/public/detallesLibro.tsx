"use client";

import {
  Play,
  Clock,
  CheckCircle2,
  TriangleAlert,
  ArrowLeft,
  BookOpen,
  User,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { navegarRutaDinamica } from "@/lib/utils/navegacionTauri";
import React, { useEffect, useState, useRef } from "react";

import { Loading, BackBtn } from "@/components/ui";
import { SmartImage } from "@/components/ui/SmartImage";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import {
  loadCapitulos,
  loadCapituloProximo,
  loadPersonajesMap,
  loadReinosMap,
  loadCiudadesMap,
  collectIds,
} from "@/lib/api/client/syncEngine";
import { toSlug, esUUID } from "@/lib/utils/slugify";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Capitulo {
  id: string;
  titulo_capitulo: string;
  orden: number;
  fecha_publicacion: string | null;
  libro_id: string;
  narrador_id: string | null;
  personajes_ids: string[] | null;
  reinos_ids: string[] | null;
  ciudades_ids: string[] | null;
}

interface Libro {
  id: string;
  titulo: string;
  sinopsis: string;
  portada_url: string;
  categoria: string | null;
  trigger_warnings?: string[] | null;
}

interface Personaje {
  id: string;
  nombre: string;
  img_url: string | null;
}

interface CapituloProximo {
  titulo_capitulo: string;
  fecha_publicacion: string;
}

// ─── Persistencia de aceptación de Trigger Warnings ──────────────────────────
const TW_STORAGE_KEY = "tw_aceptados";

function libroYaAceptoTW(libroId: string): boolean {
  try {
    const raw = localStorage.getItem(TW_STORAGE_KEY);
    if (!raw) return false;
    const set: string[] = JSON.parse(raw);
    return set.includes(libroId);
  } catch {
    return false;
  }
}

function marcarLibroTWAceptado(libroId: string) {
  try {
    const raw = localStorage.getItem(TW_STORAGE_KEY);
    const set: string[] = raw ? JSON.parse(raw) : [];
    if (!set.includes(libroId)) {
      set.push(libroId);
      localStorage.setItem(TW_STORAGE_KEY, JSON.stringify(set));
    }
  } catch {}
}

// ─── Resolver slug → libro (Dexie first) ─────────────────────────────────────
async function resolverLibroPorSlug(slugParam: string): Promise<Libro | null> {
  try {
    if (db?.libros) {
      const todos = (await db.libros.toArray()) as any[];
      if (todos.length > 0) {
        const encontrado = todos.find(
          (l: any) =>
            toSlug(l.titulo ?? "") === slugParam &&
            (l.visibilidad === "publico" || l.visibilidad === "programado"),
        );
        // Solo usar caché si ya tiene trigger_warnings (campo nuevo)
        if (encontrado && Array.isArray(encontrado.trigger_warnings)) {
          return encontrado as Libro;
        }
      }
    }
  } catch {}

  const { data } = await supabase
    .from("libros")
    .select("id, titulo, sinopsis, portada_url, categoria, trigger_warnings")
    .in("visibilidad", ["publico", "programado"]);
  if (!data) return null;

  try {
    await db?.libros?.bulkPut(data as any[]);
  } catch {}
  return (data.find((l: any) => toSlug(l.titulo ?? "") === slugParam) ??
    null) as Libro | null;
}

// ─── Modal Trigger Warning ────────────────────────────────────────────────────

function ModalTriggerWarning({
  titulo,
  warnings,
  onAceptar,
  onRechazar,
}: {
  titulo: string;
  warnings: string[];
  onAceptar: () => void;
  onRechazar: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "color-mix(in srgb, var(--bg-main) 75%, transparent)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-main)",
          border:
            "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
          borderRadius: 14,
          boxShadow:
            "0 24px 64px color-mix(in srgb, var(--primary) 18%, transparent)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 22px 16px",
            borderBottom:
              "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <TriangleAlert
              size={16}
              style={{ color: "var(--primary)", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                fontWeight: 900,
                textTransform: "uppercase" as const,
                letterSpacing: "0.2em",
                color: "var(--primary)",
              }}
            >
              Trigger Warnings
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "color-mix(in srgb, var(--primary) 55%, transparent)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            <strong style={{ color: "var(--primary)", fontStyle: "italic" }}>
              {titulo}
            </strong>{" "}
            contiene contenido sensible. Asegúrate de estar en condiciones de
            leerlo.
          </p>
        </div>

        {/* Chips de warnings */}
        <div
          style={{
            padding: "16px 22px",
            display: "flex",
            flexWrap: "wrap" as const,
            gap: 6,
          }}
        >
          {warnings.map((tw) => (
            <span
              key={tw}
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                fontWeight: 900,
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
                padding: "4px 11px",
                borderRadius: 99,
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                color: "var(--primary)",
                background:
                  "color-mix(in srgb, var(--primary) 8%, transparent)",
              }}
            >
              {tw}
            </span>
          ))}
        </div>

        {/* Botones */}
        <div
          style={{
            padding: "0 22px 22px",
            display: "flex",
            flexDirection: "column" as const,
            gap: 8,
          }}
        >
          <button
            className="w-full py-3 rounded-[var(--radius-btn)] bg-primary font-black uppercase tracking-widest transition-opacity hover:opacity-85"
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--btn-text, var(--bg-main))",
              border: "none",
              cursor: "pointer",
            }}
            onClick={onAceptar}
          >
            Soy consciente · Continuar
          </button>
          <button
            className="w-full py-2.5 rounded-[var(--radius-btn)] font-black uppercase tracking-widest transition-all hover:bg-primary/8"
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "color-mix(in srgb, var(--primary) 40%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: "transparent",
            }}
            onClick={onRechazar}
          >
            <ArrowLeft size={10} />
            Volver a la biblioteca
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function LibroDetalle() {
  const params = useParams();
  const paramFromNext = params?.id as string;
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
    // /garlia/libros/:slug
    const real = partes[partes.length - 1];
    if (real) setSlugParam(real);
  }, [paramFromNext]);

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadingCaps, setLoadingCaps] = useState(true);
  const [libro, setLibro] = useState<Libro | null>(null);
  const [libroId, setLibroId] = useState<string | null>(null);
  const [capitulos, setCapitulos] = useState<Capitulo[]>([]);
  const [capituloProximo, setCapituloProximo] = useState<
    CapituloProximo | null | false
  >(null);
  const [notFound, setNotFound] = useState(false);
  const [leidos, setLeidos] = useState<Set<string>>(new Set());
  const [personajesMap, setPersonajesMap] = useState<Record<string, Personaje>>(
    {},
  );
  const [reinosMap, setReinosMap] = useState<Record<string, any>>({});
  const [ciudadesMap, setCiudadesMap] = useState<Record<string, any>>({});
  const [twAceptado, setTwAceptado] = useState(false);
  const [mostrarModalTW, setMostrarModalTW] = useState(false);
  const pendingRouteRef = useRef<string | null>(null);

  // ── Mostrar modal TW al cargar el libro (recordando aceptación previa) ─────
  useEffect(() => {
    if (!libro) return;
    const tws = libro.trigger_warnings?.filter(Boolean) ?? [];
    if (tws.length === 0) return;

    if (libroYaAceptoTW(libro.id)) {
      setTwAceptado(true);
      setMostrarModalTW(false);
      return;
    }

    if (!twAceptado) {
      setMostrarModalTW(true);
    }
  }, [libro]);

  // ── Capítulos leídos desde Supabase ────────────────────────────────────────
  useEffect(() => {
    if (!libroId) return;
    let mounted = true;

    const cargarLeidos = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || !mounted) return;

      const { data } = await supabase
        .from("capitulos_leidos")
        .select("capitulo_id")
        .eq("perfil_id", session.user.id)
        .eq("libro_id", libroId);

      if (mounted && data) {
        setLeidos(new Set(data.map((r: any) => r.capitulo_id)));
      }
    };

    void cargarLeidos();

    // Refrescar al volver al tab (el lector pudo marcar nuevos leídos mientras tanto)
    const onVisible = () => {
      if (document.visibilityState === "visible") void cargarLeidos();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", cargarLeidos);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", cargarLeidos);
    };
  }, [libroId]);

  // ── Carga principal ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slugParam) return;
    let mounted = true;

    setLoading(true);
    setLoadingCaps(true);
    setNotFound(false);
    setLibro(null);
    setLibroId(null);
    setCapitulos([]);
    setCapituloProximo(null);
    setPersonajesMap({});
    setReinosMap({});
    setCiudadesMap({});

    const cargar = async () => {
      let libroData: Libro | null = null;

      // ── Resolver libro ──────────────────────────────────────────────────────
      if (esUUID(slugParam)) {
        try {
          libroData = ((await db?.libros?.get(slugParam)) as any) ?? null;
        } catch {}
        if (!libroData) {
          const { data } = await supabase
            .from("libros")
            .select(
              "id, titulo, sinopsis, portada_url, categoria, trigger_warnings",
            )
            .eq("id", slugParam)
            .in("visibilidad", ["publico", "programado"])
            .single();
          libroData = data as Libro | null;
          if (libroData) {
            try {
              await db?.libros?.put(libroData as any);
            } catch {}
          }
        }
        if (!libroData) {
          if (mounted) {
            setNotFound(true);
            setLoading(false);
            setLoadingCaps(false);
          }
          return;
        }
        const slug = toSlug(libroData.titulo);
        if (slug) navegarRutaDinamica(`/garlia/libros/${slug}`, () => router.replace(`/garlia/libros/${slug}`));
      } else {
        libroData = await resolverLibroPorSlug(slugParam);
        if (!libroData) {
          if (mounted) {
            setNotFound(true);
            setLoading(false);
            setLoadingCaps(false);
          }
          return;
        }
      }

      if (!mounted) return;
      setLibro(libroData);
      setLibroId(libroData.id);
      setLoading(false);

      const esLibroRico = libroData.categoria === "Libro";

      // ── Capítulos: Dexie-first → Supabase en background ────────────────────
      const caps = await loadCapitulos(libroData.id, (frescos) => {
        if (!mounted) return;
        setCapitulos(frescos as Capitulo[]);
        if (esLibroRico) void cargarEntidades(frescos as Capitulo[], mounted);
      });

      if (!mounted) return;
      setCapitulos(caps as Capitulo[]);
      if (mounted) setLoadingCaps(false);

      // ── Entidades relacionadas (personajes, reinos, ciudades) ───────────────
      if (esLibroRico) await cargarEntidades(caps as Capitulo[], mounted);

      // ── Próximo capítulo (siempre fresco) ───────────────────────────────────
      const proximo = await loadCapituloProximo(libroData.id);
      if (mounted) setCapituloProximo(proximo ?? false);
    };

    // Carga personajes, reinos y ciudades que aparecen en los capítulos
    const cargarEntidades = async (caps: Capitulo[], mounted: boolean) => {
      // IDs únicos de personajes
      const personajeIds = [
        ...new Set([
          ...caps.flatMap((c) => (c.narrador_id ? [c.narrador_id] : [])),
          ...collectIds(caps, "personajes_ids"),
        ]),
      ];

      // IDs únicos de reinos y ciudades
      const reinoIds = collectIds(caps, "reinos_ids");
      const ciudadIds = collectIds(caps, "ciudades_ids");

      // Carga en paralelo: Dexie-first para cada grupo
      const [pMap, rMap, cMap] = await Promise.all([
        loadPersonajesMap(personajeIds, (fresh) => {
          if (mounted) setPersonajesMap({ ...fresh });
        }),
        loadReinosMap(reinoIds, (fresh) => {
          if (mounted) setReinosMap({ ...fresh });
        }),
        loadCiudadesMap(ciudadIds, (fresh) => {
          if (mounted) setCiudadesMap({ ...fresh });
        }),
      ]);

      if (mounted) {
        setPersonajesMap(pMap);
        setReinosMap(rMap);
        setCiudadesMap(cMap);
      }
    };

    cargar().catch(() => {
      if (mounted) {
        setLoading(false);
        setLoadingCaps(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [slugParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early returns ───────────────────────────────────────────────────────────
  if (loading) return <Loading text="Cargando libro…" />;
  if (notFound || !libro || !libroId)
    return (
      <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center gap-4">
        <p className="text-primary/30 font-black uppercase text-xs tracking-widest italic">
          Libro no encontrado
        </p>
        <BackBtn onClick={() => router.push("/garlia/libros")} />
      </div>
    );

  const esLibro = libro.categoria === "Libro";
  const twsDelLibro = libro.trigger_warnings?.filter(Boolean) ?? [];
  const tieneTW = twsDelLibro.length > 0;

  // Intercepta la navegación al lector: muestra el modal si hay TW y no fue aceptado aún
  const navegarAlLector = (ruta: string) => {
    if (tieneTW && !twAceptado) {
      // Guardamos la ruta en un ref para navegar tras aceptar
      pendingRouteRef.current = ruta;
      setMostrarModalTW(true);
    } else {
      navegarRutaDinamica(ruta, () => router.push(ruta));
    }
  };

  const rutaLector = (primerCapId: string, targetCapId?: string): string => {
    const targetId = targetCapId ?? primerCapId;
    const cap =
      capitulos.find((c) => c.id === targetId) ??
      capitulos.find((c) => c.id === primerCapId);
    const orden = cap?.orden ?? 1;
    return `/garlia/libros/${slugParam}/leer/${orden}`;
  };

  // ── Fila de personajes ──────────────────────────────────────────────────────
  const PersonajesRow = ({ cap }: { cap: Capitulo }) => {
    const ids = [
      ...(cap.narrador_id ? [cap.narrador_id] : []),
      ...(cap.personajes_ids ?? []).filter((id) => id !== cap.narrador_id),
    ];
    const personajes = ids.map((id) => personajesMap[id]).filter(Boolean);
    if (personajes.length === 0) return null;
    return (
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {personajes.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1">
            <div
              className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border ${i === 0 && cap.narrador_id === p.id ? "border-primary/30" : "border-primary/10"}`}
            >
              {p.img_url ? (
                <SmartImage
                  alt={p.nombre}
                  className="w-full h-full object-cover"
                  fallbackIcon={<User size={10} />}
                  src={p.img_url}
                />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-micro font-black text-primary/40">
                  {p.nombre[0]}
                </div>
              )}
            </div>
            <span
              className={`text-micro font-black uppercase tracking-wide ${i === 0 && cap.narrador_id === p.id ? "text-primary/60" : "text-primary/30"}`}
            >
              {p.nombre}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // ── Fila de reinos y ciudades ───────────────────────────────────────────────
  const LugarRow = ({ cap }: { cap: Capitulo }) => {
    const reinos = (cap.reinos_ids ?? [])
      .map((id) => reinosMap[id])
      .filter(Boolean);
    const ciudades = (cap.ciudades_ids ?? [])
      .map((id) => ciudadesMap[id])
      .filter(Boolean);
    if (reinos.length === 0 && ciudades.length === 0) return null;
    return (
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        {reinos.map((r: any) => (
          <span
            key={r.id}
            className="text-micro font-black uppercase tracking-wide text-primary/40 bg-primary/5 px-1.5 py-0.5 rounded"
          >
            ♛ {r.nombre}
          </span>
        ))}
        {ciudades.map((c: any) => (
          <span
            key={c.id}
            className="text-micro font-bold uppercase tracking-wide text-primary/30 bg-primary/[0.03] px-1.5 py-0.5 rounded border border-primary/8"
          >
            ♖{c.nombre}
          </span>
        ))}
      </div>
    );
  };

  // ── Lista de capítulos ──────────────────────────────────────────────────────
  const ListaCaps = ({ withPersonajes }: { withPersonajes: boolean }) => {
    if (loadingCaps && capitulos.length === 0)
      return (
        <p className="text-center text-primary/25 font-bold text-micro uppercase tracking-widest py-12 italic animate-pulse">
          Cargando capítulos…
        </p>
      );
    if (capitulos.length === 0)
      return (
        <p className="text-center text-primary/30 font-bold text-xs uppercase tracking-widest py-12 italic">
          Aún no hay capítulos publicados
        </p>
      );
    return (
      <div className="grid gap-3">
        {capitulos.map((cap) => {
          const esRuta = cap.titulo_capitulo?.startsWith("[Ruta]");
          const leido = leidos.has(cap.id);
          return (
            <button
              key={cap.id}
              className={`w-full flex items-center justify-between p-4 transition-all text-left group rounded-btn shadow-card ${esRuta ? "bg-blue-50/60" : leido ? "bg-primary/[0.03]" : "bg-white-custom"}`}
              style={{
                border: `var(--border-width) solid ${esRuta ? "rgb(219 234 254)" : leido ? "color-mix(in srgb, var(--primary) 5%, transparent)" : "color-mix(in srgb, var(--primary) 8%, transparent)"}`,
                boxShadow: leido ? "none" : undefined,
                opacity: leido ? 0.55 : 1,
              }}
              onClick={() => {
                navegarAlLector(rutaLector(cap.id));
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.borderColor =
                  "color-mix(in srgb, var(--primary) 25%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = leido ? "0.55" : "1";
                e.currentTarget.style.borderColor = esRuta
                  ? "rgb(219 234 254)"
                  : leido
                    ? "color-mix(in srgb, var(--primary) 5%, transparent)"
                    : "color-mix(in srgb, var(--primary) 8%, transparent)";
              }}
            >
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {withPersonajes && <PersonajesRow cap={cap} />}
                {withPersonajes && <LugarRow cap={cap} />}
                {esRuta && (
                  <span className="text-micro font-black uppercase tracking-widest text-blue-400">
                    ↳ Nodo de ruta
                  </span>
                )}
                <span
                  className={`font-black uppercase text-sm group-hover:translate-x-1 transition-transform leading-snug ${leido ? "text-primary/40 line-through decoration-primary/20" : "text-primary"}`}
                >
                  {cap.orden}.{" "}
                  {esRuta
                    ? cap.titulo_capitulo.replace("[Ruta] ", "")
                    : cap.titulo_capitulo}
                </span>
                {cap.fecha_publicacion && (
                  <span className="text-primary/40 font-bold text-micro uppercase tracking-wider italic">
                    {new Date(cap.fecha_publicacion).toLocaleDateString(
                      "es-ES",
                    )}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 ml-4">
                {leido ? (
                  <CheckCircle2 className="text-primary/25" size={14} />
                ) : (
                  <Play
                    className="text-primary"
                    fill="currentColor"
                    size={14}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // ── Modal TW ────────────────────────────────────────────────────────────────
  const modalTW =
    mostrarModalTW && tieneTW ? (
      <ModalTriggerWarning
        titulo={libro.titulo}
        warnings={twsDelLibro}
        onAceptar={() => {
          setTwAceptado(true);
          setMostrarModalTW(false);
          marcarLibroTWAceptado(libro.id);
          if (pendingRouteRef.current) {
            const ruta = pendingRouteRef.current;
            pendingRouteRef.current = null;
            navegarRutaDinamica(ruta, () => router.push(ruta));
          }
        }}
        onRechazar={() => {
          setMostrarModalTW(false);
          router.push("/garlia/libros");
        }}
      />
    ) : null;

  // ── Interfaz SIMPLE ─────────────────────────────────────────────────────────
  if (!esLibro) {
    return (
      <div className="min-h-screen bg-bg-main pb-20 relative">
        {modalTW}
        <BackBtn onClick={() => router.push("/garlia/libros")} />
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-[340px_1fr] gap-12 mt-4 items-start">
          <div
            className="rounded-[var(--radius-card)] overflow-hidden bg-white-custom md:sticky md:top-8"
            style={{
              border:
                "var(--border-width) solid color-mix(in srgb, var(--primary) 15%, transparent)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <SmartImage
              alt={libro.titulo}
              className="w-full h-full"
              fallbackIcon={<BookOpen size={24} />}
              src={libro.portada_url || "/placeholder-cover.jpg"}
            />
          </div>
          <main>
            <h1 className="text-4xl font-black text-primary italic tracking-tighter leading-[0.9] mb-10 uppercase text-center">
              {libro.titulo}
            </h1>
            <ListaCaps withPersonajes={false} />
          </main>
        </div>
      </div>
    );
  }

  // ── Interfaz RICA ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-main pb-20 relative">
      {modalTW}
      <BackBtn onClick={() => router.push("/garlia/libros")} />

      <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-[280px_1fr] gap-12 mt-4 items-start">
        {/* ── Sidebar ── */}
        <aside className="md:sticky md:top-8 flex flex-col gap-6">
          <div
            style={{
              aspectRatio: "3/4",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
              border:
                "var(--border-width) solid color-mix(in srgb, var(--primary) 15%, transparent)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <SmartImage
              alt={libro.titulo}
              className="w-full h-full"
              fallbackIcon={<BookOpen size={24} />}
              src={libro.portada_url || "/placeholder-cover.jpg"}
            />
          </div>

          <div className="flex flex-col gap-3">
            {capitulos.length > 0 && (
              <button
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[var(--radius-btn)] bg-primary text-[var(--btn-text)] font-black uppercase text-micro tracking-widest hover:opacity-90 transition-opacity"
                onClick={() => {
                  navegarAlLector(rutaLector(capitulos[0].id));
                }}
              >
                <Play fill="currentColor" size={10} />
                {leidos.size > 0 ? "Continuar leyendo" : "Empezar a leer"}
              </button>
            )}

            <p className="text-primary/40 text-micro italic leading-relaxed font-medium">
              {libro.sinopsis}
            </p>

            {capituloProximo && (
              <div className="flex items-start gap-2 mt-1 p-3 rounded-[var(--radius-btn)] bg-primary/3 border border-primary/8">
                <Clock
                  className="text-primary/30 flex-shrink-0 mt-0.5"
                  size={10}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-micro font-black uppercase tracking-widest text-primary/30">
                    Próximamente
                  </span>
                  <span className="text-micro font-bold text-primary/50 italic">
                    {capituloProximo.titulo_capitulo}
                  </span>
                  <span className="text-micro font-bold text-primary/25 uppercase tracking-wide">
                    {new Date(
                      capituloProximo.fecha_publicacion,
                    ).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Capítulos ── */}
        <main>
          <ListaCaps withPersonajes={true} />
        </main>
      </div>
    </div>
  );
}

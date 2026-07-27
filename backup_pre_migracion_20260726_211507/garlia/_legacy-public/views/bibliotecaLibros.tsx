"use client";

import { Lock, Timer, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";

import { estaEnTauri, navegarRutaDinamica } from "@/lib/utils/navegacionTauri";
import React, { useMemo, useState, useEffect, useRef } from "react";

import { Loading } from "@/components/ui";
import { MotionDiv } from "@/components/ui/Motion";
import { SmartImage } from "@/components/ui/SmartImage";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import { toSlug } from "@/lib/utils/slugify";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Libro {
  id: string;
  titulo: string;
  sinopsis: string;
  portada_url: string;
  estado: string;
  visibilidad: string;
  created_at: string;
  categoria: string | null; // id del grupo en grupos_mundo (tipo="libros"), o null
}

interface GrupoLibro {
  id: string;
  nombre: string;
  created_at: string;
  miembro_ids: string[];
}

interface CapsInfo {
  count: number;
  ultimaFecha: string | null;
}

// ─── Caché en módulo (sobrevive navegación SPA) ───────────────────────────────
// TTL de 5 minutos: si el usuario vuelve a la página antes de eso, ve datos
// instantáneos sin ningún fetch.
const CACHE_TTL_MS = 5 * 60 * 1_000;
const DEXIE_CAPS_KEY = "biblioteca_caps_v1"; // versionar la key para evitar datos corruptos
const DEXIE_GRUPOS_KEY = "biblioteca_grupos_v1"; // grupos/categorías de libros

let _librosCache: { data: Libro[]; ts: number } | null = null;
let _capsCache: { data: Record<string, CapsInfo>; ts: number } | null = null;
let _gruposCache: { data: GrupoLibro[]; ts: number } | null = null;

function isFresh(cache: { ts: number } | null): boolean {
  return !!cache && Date.now() - cache.ts < CACHE_TTL_MS;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esReciente(fecha: string | null | undefined, dias = 14): boolean {
  if (!fecha) return false;
  return Date.now() - new Date(fecha).getTime() < dias * 86_400_000;
}

/** Construye el mapa CapsInfo desde rows crudos de Supabase. */
function buildCapsMap(
  rows: { libro_id: string; fecha_publicacion: string | null }[],
): Record<string, CapsInfo> {
  const map: Record<string, CapsInfo> = {};
  for (const row of rows) {
    if (!map[row.libro_id]) map[row.libro_id] = { count: 0, ultimaFecha: null };
    map[row.libro_id].count++;
    const f = row.fecha_publicacion;
    if (
      f &&
      (!map[row.libro_id].ultimaFecha || f > map[row.libro_id].ultimaFecha!)
    ) {
      map[row.libro_id].ultimaFecha = f;
    }
  }
  return map;
}

// ─── Hook de datos ────────────────────────────────────────────────────────────
// Estrategia de tres capas:
//   1. Caché de módulo  → 0 ms  (sobrevive entre páginas SPA, no recarga)
//   2. Dexie (IndexedDB) → ~5 ms (sobrevive recarga, offline)
//   3. Supabase          → red   (fuente de verdad, solo si la capa anterior no está fresca)
//
// Bugs corregidos vs. versión anterior:
//   • .limit(5000) en caps: Supabase corta en 1000 rows por defecto → libros con más
//     de 1000 caps aparecían con count=0.
//   • El mapa de caps ahora se persiste en session_cache de Dexie → si el usuario
//     recarga la página, ve los conteos instantáneamente en vez de esperar a Supabase.
//   • Si ambos caches de módulo están frescos se hace return inmediato: cero requests.
//   • Si solo uno de los dos está fresco, se fetchea solo el que falta.
//   • bulkDelete limpia libros que Supabase ya no devuelve, evitando datos fantasma.
//   • Si capsRes falla por red, se usa el mapa guardado en Dexie como fallback.
function useBibliotecaData() {
  const [libros, setLibros] = useState<Libro[]>([]);
  const [capsInfo, setCapsInfo] = useState<Record<string, CapsInfo>>({});
  const [grupos, setGrupos] = useState<GrupoLibro[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function load() {
      const librosOk = isFresh(_librosCache);
      const capsOk = isFresh(_capsCache);
      const gruposOk = isFresh(_gruposCache);

      // ── 1. Caché de módulo: instantáneo ─────────────────────────────────
      if (librosOk) {
        setLibros(_librosCache!.data);
        setLoading(false);
      }
      if (capsOk) {
        setCapsInfo(_capsCache!.data);
      }
      if (gruposOk) {
        setGrupos(_gruposCache!.data);
      }

      if (librosOk && capsOk && gruposOk) return;

      // ── 2. Dexie ─────────────────────────────────────────────────────────
      const dexiePromises: [
        Promise<Libro[] | undefined>,
        Promise<{ key: string; value: any; updated_at: number } | undefined>,
        Promise<{ key: string; value: any; updated_at: number } | undefined>,
      ] = [
        !librosOk
          ? (
              db?.libros?.toArray() as unknown as Promise<Libro[] | undefined>
            ).catch(() => undefined)
          : Promise.resolve(undefined),
        !capsOk
          ? (db?.session_cache?.get(DEXIE_CAPS_KEY) as Promise<any>).catch(
              () => undefined,
            )
          : Promise.resolve(undefined),
        !gruposOk
          ? (db?.session_cache?.get(DEXIE_GRUPOS_KEY) as Promise<any>).catch(
              () => undefined,
            )
          : Promise.resolve(undefined),
      ];

      const [dexieLibros, dexieCapsEntry, dexieGruposEntry] =
        await Promise.all(dexiePromises);

      if (!mounted.current) return;

      if (!librosOk && dexieLibros?.length) {
        setLibros(
          dexieLibros.filter(
            (l) =>
              l.visibilidad === "publico" || l.visibilidad === "programado",
          ),
        );
        setLoading(false);
      }

      if (!capsOk && dexieCapsEntry?.value) {
        try {
          const mapDexie = JSON.parse(dexieCapsEntry.value) as Record<
            string,
            CapsInfo
          >;
          setCapsInfo(mapDexie);
        } catch {}
      }

      if (!gruposOk && dexieGruposEntry?.value) {
        try {
          const gruposDexie = JSON.parse(
            dexieGruposEntry.value,
          ) as GrupoLibro[];
          setGrupos(gruposDexie);
        } catch {}
      }

      // ── 3. Supabase ───────────────────────────────────────────────────────
      try {
        const [librosRes, capsRes, gruposRes] = await Promise.all([
          librosOk
            ? Promise.resolve(null)
            : supabase
                .from("libros")
                .select(
                  "id, titulo, sinopsis, portada_url, estado, visibilidad, created_at, categoria",
                )
                .in("visibilidad", ["publico", "programado"])
                .order("created_at", { ascending: false }),

          capsOk
            ? Promise.resolve(null)
            : supabase
                .from("capitulos")
                .select("libro_id, fecha_publicacion")
                .eq("visibilidad", "publico")
                .not("titulo_capitulo", "like", "[Ruta]%")
                .limit(5000),

          gruposOk
            ? Promise.resolve(null)
            : supabase
                .from("grupos_mundo")
                .select("id, nombre, created_at, miembro_ids")
                .eq("tipo", "libros")
                .order("created_at", { ascending: true }),
        ]);

        if (!mounted.current) return;

        // ── Libros ──────────────────────────────────────────────────────────
        if (librosRes && librosRes.data) {
          const nuevosLibros = librosRes.data as Libro[];
          _librosCache = { data: nuevosLibros, ts: Date.now() };
          setLibros(nuevosLibros);
          setLoading(false);

          try {
            await db?.libros?.bulkPut(nuevosLibros as any[]);
            const idsActuales = new Set(nuevosLibros.map((l) => l.id));
            const todos = (await db?.libros?.toArray()) as Libro[] | undefined;
            const stale =
              todos?.filter((l) => !idsActuales.has(l.id)).map((l) => l.id) ??
              [];
            if (stale.length) await db?.libros?.bulkDelete(stale);
          } catch {}
        } else if (!librosOk && mounted.current) {
          setLoading(false);
        }

        // ── Capítulos → mapa de conteos ────────────────────────────────────
        if (capsRes && capsRes.data) {
          const map = buildCapsMap(
            capsRes.data as {
              libro_id: string;
              fecha_publicacion: string | null;
            }[],
          );
          _capsCache = { data: map, ts: Date.now() };
          setCapsInfo(map);

          try {
            await db?.session_cache?.put({
              key: DEXIE_CAPS_KEY,
              value: JSON.stringify(map),
              updated_at: Date.now(),
            });
          } catch {}
        }

        // ── Grupos de libros ───────────────────────────────────────────────
        if (gruposRes && gruposRes.data) {
          const g = gruposRes.data as GrupoLibro[];
          _gruposCache = { data: g, ts: Date.now() };
          setGrupos(g);

          try {
            await db?.session_cache?.put({
              key: DEXIE_GRUPOS_KEY,
              value: JSON.stringify(g),
              updated_at: Date.now(),
            });
          } catch {}
        }
      } catch {
        if (mounted.current) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted.current = false;
    };
  }, []);

  return { libros, capsInfo, grupos, loading };
}

// ─── Tarjeta de libro ─────────────────────────────────────────────────────────
function LibroCard({
  libro,
  index,
  numCaps,
  nuevo,
  leidosCount,
}: {
  libro: Libro;
  index: number;
  numCaps: number;
  nuevo: boolean;
  leidosCount: number;
}) {
  const progreso = numCaps > 0 ? Math.round((leidosCount / numCaps) * 100) : 0;
  const slug = toSlug(libro.titulo);
  const href = `/garlia/libros/${slug}`;

  return (
    <MotionDiv
      animate={{ y: 0, opacity: 1 }}
      className="relative group"
      initial={{ y: 20, opacity: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        className="block"
        href={href}
        onClick={(e) => {
          if (estaEnTauri()) {
            e.preventDefault();
            navegarRutaDinamica(href);
          }
        }}
      >
        {/* MÓVIL: layout horizontal */}
        <div className="flex sm:hidden items-center gap-4 p-3 rounded-[var(--radius-card)] border border-primary/8 bg-white-custom shadow-sm group-hover:border-primary/20 transition-colors">
          <div className="relative flex-shrink-0 w-16 aspect-[3/4] rounded-[var(--radius-btn)] overflow-hidden">
            <SmartImage
              alt={libro.titulo}
              className="w-full h-full object-cover"
              fallbackIcon={<BookOpen size={20} />}
              src={libro.portada_url || "/placeholder-cover.jpg"}
            />
            {nuevo && (
              <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-[var(--accent,var(--primary))] shadow-sm" />
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-primary font-black uppercase text-micro leading-tight tracking-tight line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                {libro.titulo}
              </h2>
              {libro.visibilidad !== "publico" && (
                <div className="flex items-center gap-1 flex-shrink-0 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                  {libro.visibilidad === "programado" && (
                    <Timer className="text-primary" size={8} />
                  )}
                  {libro.visibilidad === "oculto" && (
                    <Lock className="text-primary" size={8} />
                  )}
                  <span className="text-micro font-black uppercase text-primary tracking-widest">
                    {libro.estado}
                  </span>
                </div>
              )}
            </div>
            <p className="text-primary/40 text-micro italic leading-relaxed font-medium line-clamp-2">
              {libro.sinopsis}
            </p>
            {numCaps > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-0.5 rounded-full bg-primary/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/30 transition-all"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
                <span className="text-micro font-bold text-primary/30 uppercase tracking-wider whitespace-nowrap">
                  {leidosCount > 0
                    ? `${leidosCount}/${numCaps}`
                    : `${numCaps} caps`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP: portada con hover overlay */}
        <div className="hidden sm:block">
          <MotionDiv
            className="relative aspect-[3/4] rounded-[var(--radius-card)] overflow-hidden shadow-xl border border-primary/10 bg-white-custom"
            whileHover={{ y: -8 }}
          >
            <SmartImage
              alt={libro.titulo}
              className="w-full h-full object-cover"
              fallbackIcon={<BookOpen size={20} />}
              src={libro.portada_url || "/placeholder-cover.jpg"}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
              <p className="text-white/90 text-micro italic leading-relaxed font-medium line-clamp-5">
                &ldquo;{libro.sinopsis}&rdquo;
              </p>
            </div>

            {libro.visibilidad !== "publico" && (
              <div className="absolute top-4 left-4 z-20 bg-white-custom/90 backdrop-blur-md px-3 py-1 rounded-full border border-primary/10 flex items-center gap-1.5">
                {libro.visibilidad === "programado" && (
                  <Timer className="text-primary" size={9} />
                )}
                {libro.visibilidad === "oculto" && (
                  <Lock className="text-primary" size={9} />
                )}
                <span className="text-micro font-black uppercase text-primary tracking-widest">
                  {libro.estado}
                </span>
              </div>
            )}

            {nuevo && (
              <div className="absolute top-4 right-4 z-20 bg-[var(--accent,var(--primary))]/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5">
                <Sparkles className="text-white" size={8} />
                <span className="text-micro font-black uppercase text-white tracking-widest">
                  Nuevo
                </span>
              </div>
            )}

            {numCaps > 0 && (
              <div className="absolute bottom-4 right-4 z-20 bg-white-custom/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-primary/10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <BookOpen className="text-primary/60" size={8} />
                <span className="text-micro font-bold text-primary/70 tracking-wide">
                  {numCaps} cap{numCaps !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </MotionDiv>

          <div className="mt-5 px-1">
            <h2 className="text-primary font-black uppercase text-sm group-hover:text-[var(--accent)] transition-colors leading-tight tracking-tight">
              {libro.titulo}
            </h2>
            {numCaps > 0 && leidosCount > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-0.5 rounded-full bg-primary/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/25 transition-all"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
                <span className="text-micro font-bold text-primary/25 uppercase tracking-wider whitespace-nowrap">
                  {leidosCount}/{numCaps}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </MotionDiv>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
const Biblioteca = () => {
  const { libros, capsInfo, grupos, loading } = useBibliotecaData();

  const [leidosMap, setLeidosMap] = useState<Record<string, number>>({});

  // Una sola query trae el conteo de leídos de todos los libros a la vez.
  useEffect(() => {
    if (libros.length === 0) return;
    let mounted = true;

    const cargar = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || !mounted) return;

      const { data } = await supabase
        .from("capitulos_leidos")
        .select("libro_id, capitulo_id")
        .eq("perfil_id", session.user.id)
        .in(
          "libro_id",
          libros.map((l) => l.id),
        );

      if (!mounted || !data) return;

      const mapa: Record<string, number> = {};
      for (const row of data as { libro_id: string; capitulo_id: string }[]) {
        mapa[row.libro_id] = (mapa[row.libro_id] ?? 0) + 1;
      }
      setLeidosMap(mapa);
    };

    void cargar();
    return () => {
      mounted = false;
    };
  }, [libros]);

  // Agrupar usando miembro_ids de cada grupo (fuente de verdad en grupos_mundo).
  // Un libro puede aparecer en varios grupos; si no está en ninguno, va a "Sin grupo".
  const gruposOrdenados = useMemo(() => {
    // Construir mapa libro_id → primer grupo que lo contiene (orden de creación)
    const libroAGrupo = new Map<string, string>(); // libro_id → grupo_id
    for (const g of grupos) {
      for (const libroId of g.miembro_ids ?? []) {
        if (!libroAGrupo.has(libroId)) libroAGrupo.set(libroId, g.id);
      }
    }

    const grupoMap = new Map<string | null, Libro[]>();
    for (const g of grupos) grupoMap.set(g.id, []);
    grupoMap.set(null, []); // "Sin grupo" al final

    for (const libro of libros) {
      const grupoId = libroAGrupo.get(libro.id) ?? null;
      grupoMap.get(grupoId)!.push(libro);
    }

    const resultado: { id: string | null; nombre: string; items: Libro[] }[] =
      [];
    for (const g of grupos) {
      const items = grupoMap.get(g.id) ?? [];
      if (items.length > 0)
        resultado.push({ id: g.id, nombre: g.nombre, items });
    }
    const sinGrupo = grupoMap.get(null) ?? [];
    if (sinGrupo.length > 0)
      resultado.push({ id: null, nombre: "Sin grupo", items: sinGrupo });

    return resultado;
  }, [libros, grupos]);

  // Mostrar secciones si hay al menos un grupo con nombre real (id !== null)
  const hayGruposReales = gruposOrdenados.some((g) => g.id !== null);

  if (loading && libros.length === 0)
    return <Loading text="Abriendo archivos..." />;

  const renderLibro = (libro: Libro, index: number) => {
    const info = capsInfo[libro.id];
    const numCaps = info?.count ?? 0;
    const nuevo = esReciente(info?.ultimaFecha);
    const leidos = leidosMap[libro.id] ?? 0;
    return (
      <LibroCard
        key={libro.id}
        index={index}
        leidosCount={leidos}
        libro={libro}
        nuevo={nuevo}
        numCaps={numCaps}
      />
    );
  };

  return (
    <div className="min-h-screen bg-bg-main pb-20">
      <br />
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {libros.length === 0 ? (
          <p className="text-center text-primary/30 font-bold text-xs uppercase tracking-widest py-24 italic">
            No hay libros disponibles por el momento
          </p>
        ) : hayGruposReales ? (
          <div className="flex flex-col gap-16">
            {gruposOrdenados.map(({ id, nombre, items }) => (
              <section key={id ?? "__sin_grupo__"}>
                <h2
                  className="text-primary font-black uppercase text-micro tracking-[0.25em] italic mb-8 pb-3 flex items-center gap-3"
                  style={{
                    borderBottom:
                      "var(--border-width) solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  }}
                >
                  {nombre}
                  <span className="text-primary/30 font-bold text-micro">
                    ({items.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-12">
                  {items.map((libro, index) => renderLibro(libro, index))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-12">
            {libros.map((libro, index) => renderLibro(libro, index))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Biblioteca;

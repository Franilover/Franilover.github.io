"use client";

import { Command } from "cmdk";
import { AnimatePresence } from "framer-motion";
import {
  Compass,
  BookText,
  Music,
  Star,
  Palette,
  PenTool,
  Moon,
  Sun,
  Cat,
  Flower2,
  CircleUser,
  Search,
  User,
  Crown,
  Swords,
  Building2,
  Loader2,
  WifiOff,
  BookOpen,
  FileText,
  Clock,
  Layers,
  MapPin,
  ScrollText,
  Users,
  Package,
  Dumbbell,
  UtensilsCrossed,
  Shirt,
  Library,
  Sparkles,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect, useState, useCallback, useRef } from "react";

import { MotionDiv } from "@/ui/Motion";
import { isReallyOnline } from "@/infra/sync/useOfflineSync";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import { useGlobalSearch } from "@/lib/api/queries/search";
import { toSlug } from "@/lib/utils/slugify";
import { rutaLibro, rutaLeer } from "@/domains/garlia/libros/public/leerLibro";
import { rutaCancion } from "@/domains/garlia/canciones/public/detallesCancion";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

import { useAppPanels } from "./useAppPanels";
import { useCommandPalette } from "./useCommandPalette";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  avatar?: string | null;
  keywords?: string[];
  action: () => void;
  group: string;
  isAdminResult?: boolean;
}

// Tipos para resultados públicos
interface CancionPublica {
  id: string;
  titulo: string;
  cantante?: string | null;
  portada_url?: string | null;
  visible?: boolean;
}

interface CapituloPublico {
  id: string;
  titulo_capitulo: string;
  orden: number;
  libro_id: string;
  libro_titulo?: string; // viene del join con libros
  libro_portada?: string; // viene del join con libros
}

interface LibroPublico {
  id: string;
  titulo: string;
  portada_url?: string | null;
  visibilidad?: string;
  sinopsis?: string | null;
  estado?: string;
}

// Lo que el usuario tiene desbloqueado en su página personal (/garlia/personal)
// o en el mapa (/garlia/mapa)
interface DescubrimientoPersonal {
  entidad_id: string;
  tipo: "personaje" | "criatura" | "item" | "reino" | "ciudad";
  nombre?: string | null;
  imagen_url?: string | null;
  reino_id?: string | null; // solo para ciudades — necesario para abrir su reino primero
}

/**
 * Lee del cache local (Dexie) los descubrimientos de un usuario, opcionalmente
 * filtrados por texto. Instantáneo — no toca la red.
 */
async function readDescubrimientosFromDexie(
  userId: string,
  q?: string,
): Promise<DescubrimientoPersonal[]> {
  try {
    if (!db) return [];
    const rows = await db.descubrimientos
      .where("perfil_id")
      .equals(userId)
      .toArray();
    const qLower = q?.trim().toLowerCase();
    const filtered = qLower
      ? rows.filter((r) => (r.nombre ?? "").toLowerCase().includes(qLower))
      : rows;
    return filtered.map((r) => ({
      entidad_id: r.entidad_id,
      tipo: r.tipo,
      nombre: r.nombre,
      imagen_url: r.imagen_url,
      reino_id: r.reino_id ?? null,
    }));
  } catch {
    return [];
  }
}

/** Reemplaza el cache local completo de descubrimientos de un usuario. */
async function _writeDescubrimientosToDexie(
  userId: string,
  items: DescubrimientoPersonal[],
): Promise<void> {
  try {
    if (!db) return;
    const rows = items.map((it) => ({
      id: `${userId}_${it.tipo}_${it.entidad_id}`,
      perfil_id: userId,
      tipo: it.tipo,
      entidad_id: it.entidad_id,
      nombre: it.nombre ?? null,
      imagen_url: it.imagen_url ?? null,
      reino_id: it.reino_id ?? null,
      cached_at: Date.now(),
    }));
    await db.descubrimientos.where("perfil_id").equals(userId).delete();
    if (rows.length > 0) await db.descubrimientos.bulkPut(rows);
  } catch (e) {
    console.warn("[Dexie] No se pudo guardar 'descubrimientos':", e);
  }
}

/**
 * Búsqueda pública en Supabase — libros, canciones y capítulos visibles. */
function usePublicSearch(query: string) {
  const [canciones, setCanciones] = useState<CancionPublica[]>([]);
  const [capitulos, setCapitulos] = useState<CapituloPublico[]>([]);
  const [libros, setLibros] = useState<LibroPublico[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCanciones([]);
      setCapitulos([]);
      setLibros([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsFetching(true);
      try {
        const [canRes, capRes, libRes] = await Promise.all([
          supabase
            .from("canciones")
            .select("id, titulo, cantante, portada_url, visible")
            .eq("visible", true)
            .ilike("titulo", `%${q}%`)
            .limit(6),
          supabase
            .from("capitulos")
            .select(
              "id, titulo_capitulo, orden, libro_id, libros!libro_id(titulo, portada_url)",
            )
            .eq("visibilidad", "publico")
            .not("titulo_capitulo", "like", "[Ruta]%")
            .ilike("titulo_capitulo", `%${q}%`)
            .limit(8),
          supabase
            .from("libros")
            .select("id, titulo, portada_url, visibilidad, sinopsis, estado")
            .eq("visibilidad", "publico")
            .ilike("titulo", `%${q}%`)
            .limit(5),
        ]);

        setCanciones((canRes.data ?? []) as CancionPublica[]);
        setLibros((libRes.data ?? []) as LibroPublico[]);

        // Aplanar el join con libros
        const capsAplanados: CapituloPublico[] = (
          (capRes.data ?? []) as any[]
        ).map((c) => {
          const libro = Array.isArray(c.libros) ? c.libros[0] : c.libros;
          return {
            id: c.id,
            titulo_capitulo: c.titulo_capitulo,
            orden: c.orden,
            libro_id: c.libro_id,
            libro_titulo: libro?.titulo ?? undefined,
            libro_portada: libro?.portada_url ?? undefined,
          };
        });
        setCapitulos(capsAplanados);
      } catch {
        // Si falla la búsqueda pública, simplemente no mostrar resultados
        setCanciones([]);
        setCapitulos([]);
        setLibros([]);
      } finally {
        setIsFetching(false);
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { canciones, capitulos, libros, isFetching };
}

/**
 * Carga inicial de contenido público — libros y canciones visibles sin query.
 * Se ejecuta una vez al montar y sirve para el panel "Descubrir".
 */
function usePublicBrowse() {
  const [libros, setLibros] = useState<LibroPublico[]>([]);
  const [canciones, setCanciones] = useState<CancionPublica[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [libRes, canRes] = await Promise.all([
          supabase
            .from("libros")
            .select("id, titulo, portada_url, visibilidad, sinopsis, estado")
            .eq("visibilidad", "publico")
            .order("titulo", { ascending: true })
            .limit(8),
          supabase
            .from("canciones")
            .select("id, titulo, cantante, portada_url, visible")
            .eq("visible", true)
            .order("titulo", { ascending: true })
            .limit(8),
        ]);
        if (cancelled) return;
        setLibros((libRes.data ?? []) as LibroPublico[]);
        setCanciones((canRes.data ?? []) as CancionPublica[]);
      } catch {
        // fallar silenciosamente
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { libros, canciones, loaded };
}

/**
 * Búsqueda sobre lo que el usuario tiene desbloqueado — personajes, criaturas,
 * items, reinos y ciudades propios. Disponible para TODOS los usuarios
 * logueados, admin o no, ya que es información de su propia cuenta.
 *
 * Usa las mismas tablas puente que syncEngine.loadDescubrimientos /
 * mapaGarlia (descubrimientos_items / _criaturas / _personajes / _reinos,
 * más ciudades_desbloqueadas que usa user_id en vez de perfil_id).
 */
function useUnlockedSearch(query: string, userId: string | null) {
  const [resultados, setResultados] = useState<DescubrimientoPersonal[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!userId || q.length < 2) {
      setResultados([]);
      return;
    }

    let cancelled = false;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // 1) Cache local primero — instantáneo, cero latencia de red.
      const cached = await readDescubrimientosFromDexie(userId, q);
      if (cancelled) return;
      if (cached.length > 0) setResultados(cached);
      else setIsFetching(true);

      // 2) Revalidar contra Supabase solo si hay conexión real.
      const online = await isReallyOnline();
      if (cancelled) return;
      if (!online) {
        setIsFetching(false);
        return;
      }

      try {
        const [itemsRes, criaturasRes, personajesRes, reinosRes, ciudadesRes] =
          await Promise.all([
            supabase
              .from("descubrimientos_items")
              .select("items!inner(id, nombre, imagen_url)")
              .eq("perfil_id", userId)
              .ilike("items.nombre", `%${q}%`)
              .limit(8),
            supabase
              .from("descubrimientos_criaturas")
              .select("criaturas!inner(id, nombre, imagen_url)")
              .eq("perfil_id", userId)
              .ilike("criaturas.nombre", `%${q}%`)
              .limit(8),
            supabase
              .from("descubrimientos_personajes")
              .select("personajes!inner(id, nombre, img_url)")
              .eq("perfil_id", userId)
              .ilike("personajes.nombre", `%${q}%`)
              .limit(8),
            supabase
              .from("descubrimientos_reinos")
              .select("reinos!inner(id, nombre, logo_url)")
              .eq("perfil_id", userId)
              .ilike("reinos.nombre", `%${q}%`)
              .limit(8),
            supabase
              .from("ciudades_desbloqueadas")
              .select("ciudades!inner(id, nombre, imagen_url, reino_id)")
              .eq("user_id", userId)
              .ilike("ciudades.nombre", `%${q}%`)
              .limit(8),
          ]);

        if (cancelled) return;

        const merged: DescubrimientoPersonal[] = [
          ...((itemsRes.data ?? []) as any[])
            .filter((r) => r.items)
            .map((r) => ({
              entidad_id: r.items.id,
              tipo: "item" as const,
              nombre: r.items.nombre,
              imagen_url: r.items.imagen_url,
            })),
          ...((criaturasRes.data ?? []) as any[])
            .filter((r) => r.criaturas)
            .map((r) => ({
              entidad_id: r.criaturas.id,
              tipo: "criatura" as const,
              nombre: r.criaturas.nombre,
              imagen_url: r.criaturas.imagen_url,
            })),
          ...((personajesRes.data ?? []) as any[])
            .filter((r) => r.personajes)
            .map((r) => ({
              entidad_id: r.personajes.id,
              tipo: "personaje" as const,
              nombre: r.personajes.nombre,
              imagen_url: r.personajes.img_url,
            })),
          ...((reinosRes.data ?? []) as any[])
            .filter((r) => r.reinos)
            .map((r) => ({
              entidad_id: r.reinos.id,
              tipo: "reino" as const,
              nombre: r.reinos.nombre,
              imagen_url: r.reinos.logo_url,
            })),
          ...((ciudadesRes.data ?? []) as any[])
            .filter((r) => r.ciudades)
            .map((r) => ({
              entidad_id: r.ciudades.id,
              tipo: "ciudad" as const,
              nombre: r.ciudades.nombre,
              imagen_url: r.ciudades.imagen_url,
              reino_id: r.ciudades.reino_id,
            })),
        ];

        setResultados(merged);
        // No sobrescribimos el cache completo acá: esta query está filtrada
        // por texto y borraría lo que useUnlockedOverview ya guardó. Solo
        // hacemos upsert incremental de lo que encontramos.
        try {
          if (db && merged.length > 0) {
            const rows = merged.map((it) => ({
              id: `${userId}_${it.tipo}_${it.entidad_id}`,
              perfil_id: userId,
              tipo: it.tipo,
              entidad_id: it.entidad_id,
              nombre: it.nombre ?? null,
              imagen_url: it.imagen_url ?? null,
              reino_id: it.reino_id ?? null,
              cached_at: Date.now(),
            }));
            await db.descubrimientos.bulkPut(rows);
          }
        } catch {}
      } catch {
        // Si falla la red, nos quedamos con lo que ya mostramos del cache.
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, userId]);

  return { resultados, isFetching };
}

/**
 * Trae personajes, criaturas y reinos desbloqueados por el usuario SIN
 * requerir texto de búsqueda — se usa para mostrarlos como sección propia
 * en el grid inicial (pantalla por defecto) para usuarios no admin.
 * Se ejecuta una sola vez por apertura de la paleta (mientras haya userId).
 *
 * Se muestran TODOS los desbloqueados, sin límite por tipo — tanto en la
 * query a Supabase como en lo que se pinta en pantalla y lo que se cachea
 * en Dexie.
 */
function useUnlockedOverview(userId: string | null, enabled: boolean) {
  const [resultados, setResultados] = useState<DescubrimientoPersonal[]>([]);

  useEffect(() => {
    if (!enabled || !userId) {
      setResultados([]);
      return;
    }
    let cancelled = false;

    const ordenarTodos = (items: DescubrimientoPersonal[]) => {
      const orden = { personaje: 0, criatura: 1, reino: 2, item: 3, ciudad: 4 };
      return [...items].sort(
        (a, b) => (orden[a.tipo] ?? 9) - (orden[b.tipo] ?? 9),
      );
    };

    void (async () => {
      // 1) Cache local primero — se pinta al instante, sin esperar la red.
      const cached = await readDescubrimientosFromDexie(userId);
      if (cancelled) return;
      if (cached.length > 0) setResultados(ordenarTodos(cached));

      // 2) Revalidar en segundo plano solo si hay conexión real.
      const online = await isReallyOnline();
      if (cancelled || !online) return;

      try {
        const [criaturasRes, personajesRes, reinosRes] = await Promise.all([
          supabase
            .from("descubrimientos_criaturas")
            .select("criaturas!inner(id, nombre, imagen_url)")
            .eq("perfil_id", userId),
          supabase
            .from("descubrimientos_personajes")
            .select("personajes!inner(id, nombre, img_url)")
            .eq("perfil_id", userId),
          supabase
            .from("descubrimientos_reinos")
            .select("reinos!inner(id, nombre, logo_url)")
            .eq("perfil_id", userId),
        ]);

        if (cancelled) return;

        const merged: DescubrimientoPersonal[] = [
          ...((personajesRes.data ?? []) as any[])
            .filter((r) => r.personajes)
            .map((r) => ({
              entidad_id: r.personajes.id,
              tipo: "personaje" as const,
              nombre: r.personajes.nombre,
              imagen_url: r.personajes.img_url,
            })),
          ...((criaturasRes.data ?? []) as any[])
            .filter((r) => r.criaturas)
            .map((r) => ({
              entidad_id: r.criaturas.id,
              tipo: "criatura" as const,
              nombre: r.criaturas.nombre,
              imagen_url: r.criaturas.imagen_url,
            })),
          ...((reinosRes.data ?? []) as any[])
            .filter((r) => r.reinos)
            .map((r) => ({
              entidad_id: r.reinos.id,
              tipo: "reino" as const,
              nombre: r.reinos.nombre,
              imagen_url: r.reinos.logo_url,
            })),
        ];

        if (!cancelled) {
          setResultados(ordenarTodos(merged));
          // Este overview trae solo 3 tipos (no items/ciudades) — hacemos
          // upsert incremental para no pisar lo que useUnlockedSearch cacheó,
          // pero con el listado COMPLETO (sin límite) de cada tipo.
          try {
            if (db && merged.length > 0) {
              const rows = merged.map((it) => ({
                id: `${userId}_${it.tipo}_${it.entidad_id}`,
                perfil_id: userId,
                tipo: it.tipo,
                entidad_id: it.entidad_id,
                nombre: it.nombre ?? null,
                imagen_url: it.imagen_url ?? null,
                reino_id: it.reino_id ?? null,
                cached_at: Date.now(),
              }));
              await db.descubrimientos.bulkPut(rows);
            }
          } catch {}
        }
      } catch {
        // Sin red o error — nos quedamos con lo que ya vino del cache.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  return resultados;
}

export function GlobalCommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const { abrirApp } = useAppPanels();
  const router = useRouter();
  const { user, isAdmin } = useAuth() as { user: any; isAdmin: boolean };
  const { dark, toggleDark } = useTheme();
  const isDark = dark === "dark";

  const [search, setSearch] = useState("");

  // ── Modo prefijo — "per ab" busca "ab" solo en Personajes ─────────────────
  const PREFIX_MAP: Record<string, string> = {
    per: "Personajes",
    cri: "Criaturas",
    ite: "Items",
    rei: "Reinos",
    ciu: "Ciudades",
    can: "Canciones",
    cap: "Capítulos",
    lib: "Libros",
    ens: "Ensayos",
    run: "Runas",
  };
  // Grupos admin que mapean al mismo tipo
  const PREFIX_ADMIN_GROUPS: Record<string, string[]> = {
    can: ["Canciones", "Canciones (editor)"],
    cap: ["Capítulos", "Capítulos (editor)"],
    lib: ["Libros"],
    per: ["Personajes", "Mis personajes"],
    cri: ["Criaturas", "Mis criaturas"],
    ite: ["Items", "Mis items"],
    rei: ["Reinos", "Mis reinos"],
    ciu: ["Ciudades", "Mis ciudades"],
  };

  const searchLower = search.trimStart().toLowerCase();
  const prefixMatch = Object.keys(PREFIX_MAP).find(
    (p) => searchLower.startsWith(p + " ") || searchLower === p,
  );
  const activePrefix = prefixMatch ?? null; // "per"
  const activeGroup = activePrefix ? PREFIX_MAP[activePrefix] : null; // "Personajes"
  // Query real que se manda a Supabase (lo que va después del prefijo)
  // Si solo hay prefijo sin texto aún, mandamos "%%" para que ilike traiga todo
  const prefixQuery = activePrefix
    ? search.trim().slice(activePrefix.length).trimStart()
    : search;
  // Lo que realmente viaja a los hooks — mínimo "%%" cuando hay prefijo solo,
  // y con prefijo activo bajamos el umbral a 1 char (per a ya busca)
  const hookQuery =
    activePrefix && prefixQuery.length === 0
      ? "%%"
      : activePrefix && prefixQuery.length === 1
        ? `%${prefixQuery}%`
        : prefixQuery;

  const { data, isFetching: isFetchingAdmin } = useGlobalSearch(hookQuery);
  const fromCache = data?.fromCache ?? false;

  // Búsqueda pública — activa para TODOS los usuarios (admin y no-admin)
  const {
    canciones: cancionesPublicas,
    capitulos: capitulosPublicos,
    libros: librosPublicos,
    isFetching: isFetchingPublic,
  } = usePublicSearch(hookQuery);

  // Búsqueda sobre lo desbloqueado por el propio usuario (personajes, criaturas, items)
  // — disponible para TODOS los usuarios logueados, admin o no.
  const { resultados: unlockedResultados, isFetching: isFetchingUnlocked } =
    useUnlockedSearch(hookQuery, user?.id ?? null);

  // Personajes/criaturas/reinos desbloqueados — sección propia en el grid
  // inicial, para TODOS los usuarios logueados (admin o no).
  const unlockedOverview = useUnlockedOverview(user?.id ?? null, open);

  // Browse público — carga inicial sin query para el panel "Descubrir"
  const {
    libros: browseLibros,
    canciones: browseCanciones,
    loaded: browseLoaded,
  } = usePublicBrowse();

  const isFetching = isFetchingAdmin || isFetchingPublic || isFetchingUnlocked;

  // Ctrl+Ñ abre/cierra — capture:true para ir antes que cualquier otro listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "ñ") {
        if (e.repeat) return; // ignorar key repeat
        e.preventDefault();
        e.stopPropagation();
        setOpen((prev: boolean) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [setOpen]);

  // Reset search on close
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const pathname = usePathname();

  const go = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router, setOpen],
  );

  // Abre una app del dashboard (ejercicios, ingredientes, recetas, ropa, libros) —
  // navega al escritorio si hace falta y luego actualiza el store compartido
  const goApp = useCallback(
    (id: Parameters<typeof abrirApp>[0]) => {
      setOpen(false);
      if (pathname === "/myself/escritorio") {
        abrirApp(id);
      } else {
        router.push("/myself/escritorio");
        setTimeout(() => abrirApp(id), 400);
      }
    },
    [router, setOpen, pathname, abrirApp],
  );

  // Abre una entidad en el EditorGarlia — si ya estamos ahí despacha directo
  // por evento; si no, navega y deja la solicitud en un "buzón" persistente
  // (sessionStorage) que EditorGarlia consume apenas monta. Esto evita perder
  // la apertura cuando la navegación/hidratación tarda más de lo esperado
  // (el setTimeout fijo era una carrera: si el listener aún no existía,
  // el CustomEvent se perdía para siempre).
  const goEntity = useCallback(
    (tabla: string, id: string) => {
      setOpen(false);
      const dispatch = () =>
        window.dispatchEvent(
          new CustomEvent("garlia-open-entity", { detail: { tabla, id } }),
        );
      if (pathname === "/myself/garlia") {
        dispatch();
      } else {
        try {
          sessionStorage.setItem(
            "garlia-pending-open-entity",
            JSON.stringify({ tabla, id, ts: Date.now() }),
          );
        } catch {}
        router.push("/myself/garlia");
        // Disparo adicional por si ya estaba montado (misma pestaña, SPA nav).
        // Si EditorGarlia ya consumió el buzón, no repetimos el dispatch.
        setTimeout(() => {
          let alreadyHandled = false;
          try {
            alreadyHandled = !sessionStorage.getItem(
              "garlia-pending-open-entity",
            );
          } catch {}
          if (!alreadyHandled) dispatch();
        }, 400);
      }
    },
    [router, setOpen, pathname],
  );

  // Abre una canción en el EditorGarlia
  const goCancion = useCallback(
    (id: string) => {
      setOpen(false);
      const dispatch = () => {
        localStorage.setItem("estudio-letras-last-id", id);
        window.dispatchEvent(
          new CustomEvent("garlia-open-entity", {
            detail: { tabla: "canciones", id },
          }),
        );
        window.dispatchEvent(new Event("estudio-letras-action"));
      };
      if (pathname === "/myself/garlia") {
        dispatch();
      } else {
        try {
          sessionStorage.setItem(
            "garlia-pending-open-entity",
            JSON.stringify({ tabla: "canciones", id, ts: Date.now() }),
          );
        } catch {}
        localStorage.setItem("estudio-letras-last-id", id);
        router.push("/myself/garlia");
        setTimeout(() => {
          let alreadyHandled = false;
          try {
            alreadyHandled = !sessionStorage.getItem(
              "garlia-pending-open-entity",
            );
          } catch {}
          if (!alreadyHandled) dispatch();
        }, 400);
      }
    },
    [router, setOpen, pathname],
  );

  // Abre un capítulo específico en el EditorGarlia
  const goCapitulo = useCallback(
    (capId: string, libroId: string) => {
      setOpen(false);
      const dispatch = () => {
        localStorage.setItem("estudio-caps-last-cap", capId);
        localStorage.setItem("estudio-caps-last-libro", libroId);
        window.dispatchEvent(new Event("estudio-caps-action"));
      };
      if (pathname === "/myself/garlia") {
        dispatch();
      } else {
        router.push("/myself/garlia");
        setTimeout(dispatch, 400);
      }
    },
    [router, setOpen, pathname],
  );

  // Abre un ensayo específico en /myself/ensayos
  const goEnsayo = useCallback(
    (id: string) => {
      setOpen(false);
      localStorage.setItem("ensayos-active-id", id);
      localStorage.removeItem("ensayos-at-home");
      if (pathname === "/myself/escritorio") {
        window.dispatchEvent(
          new CustomEvent("ensayos-open", { detail: { id } }),
        );
      } else {
        router.push("/myself/escritorio");
      }
    },
    [router, setOpen, pathname],
  );

  // Navega al editor y dispara createAndOpen para entidades principales
  const goEditorAndCreate = useCallback(
    (tab: string) => {
      const dispatch = () =>
        window.dispatchEvent(
          new CustomEvent("garlia-create-entity", { detail: { tab } }),
        );
      if (pathname === "/myself/garlia") {
        dispatch();
      } else {
        router.push("/myself/garlia");
        setTimeout(dispatch, 400);
      }
    },
    [router, pathname],
  );

  // Navega al editor y dispara onAddMagic para el resto (runas, notas, etc.)
  const goEditorAndDispatch = useCallback(
    (key: string) => {
      const dispatch = () =>
        window.dispatchEvent(
          new CustomEvent("garlia-add-magic", { detail: { key } }),
        );
      if (pathname === "/myself/garlia") {
        dispatch();
      } else {
        router.push("/myself/garlia");
        setTimeout(dispatch, 400);
      }
    },
    [router, pathname],
  );

  // Abre el modal de detalle de un personaje/criatura/item/reino/ciudad YA
  // DESBLOQUEADO — mismo patrón de "buzón" que goEntity: si la página destino
  // ya está montada despachamos directo, si no dejamos la solicitud en
  // sessionStorage para que la consuma apenas monte.
  // Personajes/criaturas/items abren en /garlia/personal.
  // Reinos/ciudades abren en /garlia/mapa.
  const goUnlockedEntity = useCallback(
    (
      tipo: "personaje" | "criatura" | "item" | "reino" | "ciudad",
      entidadId: string,
      reinoId?: string | null,
    ) => {
      setOpen(false);
      const esMapa = tipo === "reino" || tipo === "ciudad";
      const destino = esMapa ? "/garlia/mapa" : "/garlia/personal";
      const eventName = esMapa ? "mapa-open-entity" : "personal-open-entity";
      const storageKey = esMapa
        ? "mapa-pending-open-entity"
        : "personal-pending-open-entity";
      const detail = esMapa
        ? { tipo, entidad_id: entidadId, reino_id: reinoId ?? null }
        : { tipo, entidad_id: entidadId };

      const dispatch = () =>
        window.dispatchEvent(new CustomEvent(eventName, { detail }));

      if (pathname === destino) {
        dispatch();
      } else {
        try {
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({ ...detail, ts: Date.now() }),
          );
        } catch {}
        router.push(destino);
        // Para el mapa NO hacemos el dispatch de respaldo por timeout — el
        // propio mapaGarlia.tsx consume el buzón apenas "reinos" carga,
        // evitando el parpadeo de aplicar la selección dos veces (una vez
        // por el timeout ciego y otra por el efecto que ve "reinos" listo).
        if (!esMapa) {
          setTimeout(() => {
            let alreadyHandled = false;
            try {
              alreadyHandled = !sessionStorage.getItem(storageKey);
            } catch {}
            if (!alreadyHandled) dispatch();
          }, 400);
        }
      }
    },
    [router, setOpen, pathname],
  );

  // ── Static command definitions ─────────────────────────────────────────────

  const navItems: CommandItem[] = [
    {
      id: "mapa",
      label: "Mapa de Garlia",
      description: "Explora el mundo",
      icon: Compass,
      keywords: ["mapa", "mundo", "garlia", "explorar"],
      action: () => go("/garlia/mapa"),
      group: "Navegar",
    },
    {
      id: "libros",
      label: "Libros",
      description: "Biblioteca de historias",
      icon: BookText,
      keywords: ["libros", "historias", "leer"],
      action: () => go("/garlia/libros"),
      group: "Navegar",
    },
    {
      id: "canciones",
      label: "Canciones",
      description: "Música del universo",
      icon: Music,
      keywords: ["canciones", "música", "melodías"],
      action: () => go("/garlia/canciones"),
      group: "Navegar",
    },
    {
      id: "sobre-mi",
      label: "Sobre Mí",
      icon: Star,
      keywords: ["sobre mi", "personal", "perfil"],
      action: () => go("/personal/sobre-mi"),
      group: "Navegar",
    },
    {
      id: "galeria",
      label: "Galería",
      icon: Palette,
      keywords: ["galería", "arte", "imágenes"],
      action: () => go("/personal/galeria"),
      group: "Navegar",
    },
  ];

  const appItems: CommandItem[] = isAdmin
    ? [
        {
          id: "app-ejercicios",
          label: "Ejercicios",
          icon: Dumbbell,
          keywords: ["ejercicios", "gym", "entrenar", "fitness"],
          action: () => goApp("ejercicios"),
          group: "Apps",
        },
        {
          id: "app-ingredientes",
          label: "Ingredientes",
          icon: Package,
          keywords: ["ingredientes", "despensa", "cocina"],
          action: () => goApp("ingredientes"),
          group: "Apps",
        },
        {
          id: "app-recetas",
          label: "Recetas",
          icon: UtensilsCrossed,
          keywords: ["recetas", "cocina", "comida"],
          action: () => goApp("recetas"),
          group: "Apps",
        },
        {
          id: "app-ropa",
          label: "Ropa",
          icon: Shirt,
          keywords: ["ropa", "armario", "outfit"],
          action: () => goApp("ropa"),
          group: "Apps",
        },
        {
          id: "app-biblioteca",
          label: "Biblioteca",
          description: "Tus libros",
          icon: Library,
          keywords: ["biblioteca", "libros", "leer"],
          action: () => goApp("libros"),
          group: "Apps",
        },
      ]
    : [];

  const handleLogout = useCallback(async () => {
    setOpen(false);
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = "/";
  }, [setOpen]);

  const userItems: CommandItem[] = user
    ? [
        {
          id: "mi-personaje",
          label: "Mi personaje",
          icon: CircleUser,
          keywords: ["mi personaje", "perfil"],
          action: () => go("/garlia/personal"),
          group: "Navegar",
        },
        {
          id: "logout",
          label: "Cerrar sesión",
          icon: LogOut,
          keywords: ["logout", "salir", "cerrar sesion", "cerrar sesión"],
          action: handleLogout,
          group: "Ajustes",
        },
      ]
    : [
        {
          id: "login",
          label: "Iniciar sesión",
          icon: CircleUser,
          keywords: ["login", "entrar"],
          action: () => go("/auth/login"),
          group: "Ajustes",
        },
      ];

  const adminItems: CommandItem[] = isAdmin
    ? [
        {
          id: "escritorio",
          label: "Escritorio",
          description: "Panel de administración",
          icon: PenTool,
          keywords: ["escritorio", "admin", "editor"],
          action: () => go("/myself/escritorio"),
          group: "Admin",
        },
        {
          id: "garlia-editor",
          label: "Editor de Garlia",
          icon: Cat,
          keywords: ["editor", "garlia", "myself"],
          action: () => go("/myself/garlia"),
          group: "Admin",
        },
        {
          id: "abrir-crear",
          label: "Añadir",
          description: "Crear personaje, libro, capítulo…",
          icon: Sparkles,
          keywords: ["add", "crear", "nuevo", "nueva", "añadir"],
          action: () => setSearch("add"),
          group: "Admin",
        },
      ]
    : [];

  const themeItems: CommandItem[] = [
    {
      id: "toggle-dark",
      label: isDark ? "Modo claro" : "Modo oscuro",
      icon: isDark ? Sun : Moon,
      keywords: ["oscuro", "claro", "tema", "dark", "light"],
      action: () => {
        toggleDark();
        setOpen(false);
      },
      group: "Ajustes",
    },
  ];

  // Comandos de creación — solo admin
  const createItems: CommandItem[] = isAdmin
    ? [
        {
          id: "add-personaje",
          label: "Nuevo personaje",
          icon: Users,
          keywords: ["add", "crear", "nuevo", "personaje"],
          action: () => {
            setOpen(false);
            goEditorAndCreate("personajes");
          },
          group: "Crear",
        },
        {
          id: "add-criatura",
          label: "Nueva criatura",
          icon: Swords,
          keywords: ["add", "crear", "nueva", "criatura"],
          action: () => {
            setOpen(false);
            goEditorAndCreate("criaturas");
          },
          group: "Crear",
        },
        {
          id: "add-reino",
          label: "Nuevo reino",
          icon: Crown,
          keywords: ["add", "crear", "nuevo", "reino"],
          action: () => {
            setOpen(false);
            goEditorAndCreate("reinos");
          },
          group: "Crear",
        },
        {
          id: "add-objeto",
          label: "Nuevo objeto",
          icon: Package,
          keywords: ["add", "crear", "nuevo", "objeto", "item"],
          action: () => {
            setOpen(false);
            goEditorAndCreate("items");
          },
          group: "Crear",
        },
        {
          id: "add-ciudad",
          label: "Nueva ciudad",
          icon: MapPin,
          keywords: ["add", "crear", "nueva", "ciudad"],
          action: () => {
            setOpen(false);
            goEditorAndDispatch("ciudad");
          },
          group: "Crear",
        },
        {
          id: "add-runa",
          label: "Nueva runa",
          icon: ScrollText,
          keywords: ["add", "crear", "nueva", "runa"],
          action: () => {
            setOpen(false);
            goEditorAndDispatch("runas");
          },
          group: "Crear",
        },
        {
          id: "add-nota",
          label: "Nueva nota",
          icon: FileText,
          keywords: ["add", "crear", "nueva", "nota"],
          action: () => {
            setOpen(false);
            goEditorAndDispatch("notas");
          },
          group: "Crear",
        },
        {
          id: "add-acontecimiento",
          label: "Nuevo acontecimiento",
          icon: Clock,
          keywords: ["add", "crear", "nuevo", "acontecimiento"],
          action: () => {
            setOpen(false);
            goEditorAndDispatch("acontecimiento");
          },
          group: "Crear",
        },
        {
          id: "add-grupo",
          label: "Nuevo grupo",
          icon: Layers,
          keywords: ["add", "crear", "nuevo", "grupo"],
          action: () => {
            setOpen(false);
            goEditorAndDispatch("grupos");
          },
          group: "Crear",
        },
        {
          id: "add-libro",
          label: "Nuevo libro",
          icon: BookOpen,
          keywords: ["add", "crear", "nuevo", "libro"],
          action: () => {
            setOpen(false);
            goEditorAndDispatch("libro");
          },
          group: "Crear",
        },
        {
          id: "add-capitulo",
          label: "Nuevo capítulo",
          icon: BookText,
          keywords: ["add", "crear", "nuevo", "capitulo"],
          action: () => {
            setOpen(false);
            goEditorAndDispatch("capitulo");
          },
          group: "Crear",
        },
        {
          id: "add-cancion",
          label: "Nueva canción",
          icon: Music,
          keywords: ["add", "crear", "nueva", "cancion"],
          action: () => {
            setOpen(false);
            goEditorAndDispatch("cancion");
          },
          group: "Crear",
        },
        {
          id: "add-ensayo",
          label: "Nuevo ensayo",
          icon: FileText,
          keywords: ["add", "crear", "nuevo", "ensayo", "nota"],
          action: () => {
            setOpen(false);
            const dispatch = () =>
              window.dispatchEvent(new Event("ensayos-new-nota"));
            if (pathname === "/myself/escritorio") {
              dispatch();
            } else {
              router.push("/myself/escritorio");
              setTimeout(dispatch, 400);
            }
          },
          group: "Crear",
        },
        {
          id: "add-ensayo-libro",
          label: "Nuevo libro (ensayo)",
          icon: BookOpen,
          keywords: ["add", "crear", "nuevo", "libro", "ensayo"],
          action: () => {
            setOpen(false);
            const dispatch = () =>
              window.dispatchEvent(new Event("ensayos-new-libro"));
            if (pathname === "/myself/escritorio") {
              dispatch();
            } else {
              router.push("/myself/escritorio");
              setTimeout(dispatch, 400);
            }
          },
          group: "Crear",
        },
      ]
    : [];

  // "Descubierto" — personajes, criaturas y reinos desbloqueados, como items
  // navegables más en el grid inicial (solo usuarios no admin).
  const unlockedOverviewItems: CommandItem[] = unlockedOverview.map((d) => {
    const iconMap = {
      personaje: User,
      criatura: Swords,
      item: Package,
      reino: Crown,
      ciudad: Building2,
    } as const;
    return {
      id: `overview-${d.tipo}-${d.entidad_id}`,
      label: d.nombre ?? "Sin nombre",
      description: "Desbloqueado",
      icon: iconMap[d.tipo] ?? Sparkles,
      avatar: d.imagen_url ?? null,
      action: () => goUnlockedEntity(d.tipo, d.entidad_id, d.reino_id),
      group: "Descubierto",
    };
  });

  // Nota: el orden visual de los grupos en la pantalla inicial lo define
  // `groupOrder` (más abajo), no el orden de este array — este array solo
  // agrupa los items por su campo `group`.
  const staticItems: CommandItem[] = isAdmin
    ? [
        ...adminItems,
        ...appItems,
        ...navItems,
        ...userItems,
        ...themeItems,
        ...unlockedOverviewItems,
      ]
    : [...unlockedOverviewItems, ...navItems, ...userItems, ...themeItems];

  // ── Detectar modo "Crear" — al escribir add/crear/nuevo ───────────────────
  const CREATE_TRIGGERS = ["add", "crear", "nuevo", "nueva"];
  const showCreateGrid =
    isAdmin &&
    CREATE_TRIGGERS.some(
      (t) =>
        search.trim().toLowerCase() === t ||
        search
          .trim()
          .toLowerCase()
          .startsWith(t + " "),
    );

  const GRID_COLS = 3;
  const [gridIndex, setGridIndex] = useState(0);

  // ref estable para los items activos en el grid (create o prefix)
  const createItemsRef = useRef<CommandItem[]>([]);
  createItemsRef.current = createItems;

  const prefixItemsRef = useRef<CommandItem[]>([]);

  const dynamicActive = search.trim().length >= 2 || activePrefix !== null;
  const showDynamic = dynamicActive && !showCreateGrid;

  // ── Pantalla inicial (sin búsqueda) — también se muestra en columnas ──────
  const showDefaultGrid = !showDynamic && !showCreateGrid;
  const defaultGridItemsRef = useRef<CommandItem[]>([]);

  // Tamaños de cada sección (grid independiente de 3 columnas) en el orden en
  // que se renderizan dentro de `defaultFlatItems`/`prefixItemsRef`. Cada
  // sub-<div className="grid"> reinicia su propia numeración de filas, así
  // que la navegación con flechas necesita saber DÓNDE corta cada una —
  // de lo contrario, sumar/restar `GRID_COLS` sobre el índice plano global
  // desalinea la fila apenas una sección no es múltiplo de 3 (esto era lo
  // que hacía "saltar" de sección o aterrizar en el ítem equivocado).
  const defaultSectionSizesRef = useRef<number[]>([]);

  const inGridMode = showCreateGrid || !!activePrefix || showDefaultGrid;

  // Refs con la lista/tamaños de sección activos para el handler de teclado.
  // IMPORTANTE: la ASIGNACIÓN de `.current` se hace más abajo, después de
  // calcular `orderedGroupEntries`/`defaultFlatItems` (que dependen de
  // `browseItems`, definido más adelante en el componente). Antes esta
  // asignación ocurría aquí mismo, leyendo `defaultSectionSizesRef.current`
  // y `defaultGridItemsRef.current` con el valor que habían quedado del
  // render ANTERIOR (un ciclo completo desactualizados) — por eso, apenas
  // cambiaba cuántos grupos tenían contenido (p.ej. "Descubierto" vacío
  // pasaba a tener resultados), la navegación con flechas saltaba secciones
  // enteras usando un mapa de tamaños que ya no correspondía al DOM actual.
  const activeGridItemsRef = useRef<CommandItem[]>([]);
  const dynamicSectionSizesRef = useRef<number[]>([]);
  const activeSectionSizesRef = useRef<number[]>([]);

  // Reset index al entrar en cualquier modo grid
  useEffect(() => {
    if (inGridMode) setGridIndex(0);
  }, [inGridMode]);

  // Dado un índice plano y los tamaños de cada sección (en orden), calcula
  // en qué sección cae y qué fila/columna le corresponde dentro de ella.
  function locateInSections(flatIndex: number, sectionSizes: number[]) {
    let offset = 0;
    for (let s = 0; s < sectionSizes.length; s++) {
      const size = sectionSizes[s];
      if (flatIndex < offset + size) {
        return { section: s, offset, localIndex: flatIndex - offset, size };
      }
      offset += size;
    }
    // No debería pasar si flatIndex es válido, pero por seguridad devolvemos
    // la última sección.
    const lastSection = sectionSizes.length - 1;
    const lastOffset = offset - (sectionSizes[lastSection] ?? 0);
    return {
      section: lastSection,
      offset: lastOffset,
      localIndex: flatIndex - lastOffset,
      size: sectionSizes[lastSection] ?? 0,
    };
  }

  // Navega verticalmente respetando los límites de cada sección: si el
  // movimiento se sale de la sección actual, aterriza en la fila límite
  // (primera fila de la siguiente / última fila de la anterior) de la
  // sección vecina, en vez de arrastrar el desfase de la sección de origen.
  function moveVertical(
    flatIndex: number,
    sectionSizes: number[],
    dir: 1 | -1,
  ): number {
    if (sectionSizes.length === 0) return flatIndex;
    const { section, offset, localIndex, size } = locateInSections(
      flatIndex,
      sectionSizes,
    );
    const col = localIndex % GRID_COLS;
    const targetLocal = localIndex + dir * GRID_COLS;

    if (targetLocal >= 0 && targetLocal < size) {
      // Se mueve dentro de la misma sección — caso normal.
      return offset + targetLocal;
    }

    // Se sale de la sección actual — pasar a la vecina en esa dirección.
    const nextSection = section + dir;
    if (nextSection < 0 || nextSection >= sectionSizes.length) {
      // No hay sección vecina — clamp al borde (primer/último item global).
      return dir === 1 ? offset + size - 1 : offset;
    }

    let nextOffset = 0;
    for (let s = 0; s < nextSection; s++) nextOffset += sectionSizes[s];
    const nextSize = sectionSizes[nextSection];

    if (dir === 1) {
      // Bajando: aterrizar en la misma columna de la PRIMERA fila de la
      // siguiente sección (o el último item si esa sección es más chica).
      return nextOffset + Math.min(col, nextSize - 1);
    }
    // Subiendo: aterrizar en la misma columna de la ÚLTIMA fila de la
    // sección anterior.
    const lastRowStart = Math.floor((nextSize - 1) / GRID_COLS) * GRID_COLS;
    return nextOffset + Math.min(lastRowStart + col, nextSize - 1);
  }

  // Navegación con flechas — activa en todos los modos grid.
  // IMPORTANTE: esto va como onKeyDownCapture en el <Command> (ver JSX), no
  // como listener en `window`. cmdk registra su propio handler de teclado
  // sobre el Command.Input interno; si nosotros escuchamos en `window` no hay
  // garantía de que nuestro listener corra ANTES que el de cmdk, así que en
  // el peor caso cmdk ejecutaba su Enter primero (seleccionando el primer
  // Command.Item montado en el DOM — "Nuevo ensayo" — aunque visualmente el
  // resaltado por `gridIndex` mostrara otro). Con onKeyDownCapture en el
  // contenedor React captura el evento antes de que llegue al input hijo,
  // así que siempre ganamos la carrera quitándole el evento a cmdk.
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!inGridMode) return;
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(
          e.key,
        )
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      const items = activeGridItemsRef.current;
      if (e.key === "Enter") {
        items[gridIndex]?.action();
        return;
      }
      setGridIndex((prev) => {
        const total = items.length;
        if (!total) return prev;
        if (e.key === "ArrowRight") return (prev + 1) % total;
        if (e.key === "ArrowLeft") return (prev - 1 + total) % total;
        const sectionSizes = activeSectionSizesRef.current;
        if (e.key === "ArrowDown") return moveVertical(prev, sectionSizes, 1);
        if (e.key === "ArrowUp") return moveVertical(prev, sectionSizes, -1);
        return prev;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inGridMode, gridIndex],
  );

  // Scroll automático al item seleccionado en el grid
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!inGridMode) return;
    const el = listRef.current?.querySelector(
      `[data-grid-index="${gridIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [gridIndex, inGridMode]);

  // Resultados públicos — visibles para usuarios NO-admin cuando hay búsqueda activa.
  // Libros, canciones y capítulos navegan a sus rutas públicas (/garlia/...).
  const publicDynamicItems: CommandItem[] = dynamicActive
    ? [
        ...librosPublicos.map((l) => ({
          id: `l-pub-${l.id}`,
          label: l.titulo,
          description: l.sinopsis
            ? l.sinopsis.slice(0, 60) + (l.sinopsis.length > 60 ? "…" : "")
            : (l.estado ?? "Libro"),
          icon: BookText,
          avatar: l.portada_url ?? null,
          action: () => go(rutaLibro(toSlug(l.titulo))),
          group: "Libros",
        })),
        ...cancionesPublicas.map((c) => ({
          id: `c-pub-${c.id}`,
          label: c.titulo,
          description: c.cantante ?? "Canción",
          icon: Music,
          avatar: c.portada_url ?? null,
          action: () => go(rutaCancion(toSlug(c.titulo))),
          group: "Canciones",
        })),
        ...capitulosPublicos.map((c) => {
          const libroSlug = toSlug(c.libro_titulo ?? "");
          const destino = libroSlug
            ? rutaLeer(libroSlug, c.orden)
            : `/garlia/libros`;
          return {
            id: `cap-pub-${c.id}`,
            label: c.titulo_capitulo,
            description: c.libro_titulo
              ? `Cap. ${c.orden} · ${c.libro_titulo}`
              : `Capítulo ${c.orden}`,
            icon: BookOpen,
            avatar: c.libro_portada ?? null,
            action: () => go(destino),
            group: "Capítulos",
          };
        }),
        // Personajes, criaturas, items, reinos y ciudades que el propio
        // usuario tiene desbloqueados — visible para cualquier usuario
        // logueado, no solo admins.
        ...unlockedResultados.map((d) => {
          const iconMap = {
            personaje: User,
            criatura: Swords,
            item: Package,
            reino: Crown,
            ciudad: Building2,
          } as const;
          const groupMap = {
            personaje: "Mis personajes",
            criatura: "Mis criaturas",
            item: "Mis items",
            reino: "Mis reinos",
            ciudad: "Mis ciudades",
          } as const;
          return {
            id: `unlocked-${d.tipo}-${d.entidad_id}`,
            label: d.nombre ?? "Sin nombre",
            description: "Desbloqueado",
            icon: iconMap[d.tipo] ?? Sparkles,
            avatar: d.imagen_url ?? null,
            action: () => goUnlockedEntity(d.tipo, d.entidad_id, d.reino_id),
            group: groupMap[d.tipo] ?? "Mis descubrimientos",
          };
        }),
      ]
    : [];

  // Resultados de admin — solo para administradores, abren en EditorGarlia
  const adminDynamicItems: CommandItem[] =
    dynamicActive && isAdmin
      ? [
          ...(data?.personajes ?? []).map((p) => ({
            id: `p-${p.id}`,
            label: p.nombre,
            description: p.especie ?? "Personaje",
            icon: User,
            avatar: p.img_url,
            action: () => goEntity("personajes", p.id),
            group: "Personajes",
            isAdminResult: true,
          })),
          ...(data?.libros ?? []).map((l) => ({
            id: `l-${l.id}`,
            label: l.titulo,
            description: l.estado ?? "Libro",
            icon: BookText,
            avatar: l.portada_url,
            action: () => goEntity("libros", l.id),
            group: "Libros",
            isAdminResult: true,
          })),
          // Para admin, las canciones abren en el editor (no en la ruta pública)
          ...(data?.canciones ?? []).map((c) => ({
            id: `c-${c.id}`,
            label: c.titulo,
            description: c.cantante ?? "Canción",
            icon: Music,
            avatar: c.portada_url,
            action: () => goCancion(c.id),
            group: "Canciones (editor)",
            isAdminResult: true,
          })),
          // Para admin, los capítulos abren en el editor
          ...(data?.capitulos ?? []).map((c) => ({
            id: `cap-${c.id}`,
            label: c.titulo_capitulo ?? `Capítulo ${c.orden}`,
            description: `Cap. ${c.orden}`,
            icon: BookOpen,
            avatar: null,
            action: () => goCapitulo(c.id, c.libro_id ?? ""),
            group: "Capítulos (editor)",
            isAdminResult: true,
          })),
          ...(data?.reinos ?? []).map((r) => ({
            id: `r-${r.id}`,
            label: r.nombre,
            description: "Reino",
            icon: Crown,
            avatar: r.logo_url,
            action: () => goEntity("reinos", r.id),
            group: "Reinos",
            isAdminResult: true,
          })),
          ...(data?.criaturas ?? []).map((c) => ({
            id: `cr-${c.id}`,
            label: c.nombre,
            description: "Criatura",
            icon: Swords,
            avatar: c.imagen_url,
            action: () => goEntity("criaturas", c.id),
            group: "Criaturas",
            isAdminResult: true,
          })),
          ...(data?.ciudades ?? []).map((c) => ({
            id: `ci-${c.id}`,
            label: c.nombre,
            description: "Ciudad",
            icon: Building2,
            avatar: c.imagen_url,
            action: () => goEntity("ciudades", c.id),
            group: "Ciudades",
            isAdminResult: true,
          })),
          ...(data?.ensayos ?? []).map((e) => {
            const tags: string[] = Array.isArray(e.tags) ? e.tags : [];
            const esLibro = tags.includes("libro");
            const esTag = tags.includes("tag");
            const badge = esLibro ? "libro" : esTag ? "tag" : "nota";
            const otherTags = tags
              .filter((t) => t !== "libro" && t !== "tag")
              .slice(0, 2)
              .map((t) => `#${t}`)
              .join(" ");
            return {
              id: `ens-${e.id}`,
              label: e.titulo ?? "Sin título",
              description: [badge, otherTags].filter(Boolean).join(" · "),
              icon: FileText,
              avatar: null,
              action: () => goEnsayo(e.id),
              group: "Ensayos",
              isAdminResult: true,
            };
          }),
        ]
      : [];

  // Unir: admin ve sus items de editor + los públicos del lector (para poder navegar como usuario)
  // No-admin solo ve los públicos del lector.
  const allDynamicItems: CommandItem[] = isAdmin
    ? [...adminDynamicItems, ...publicDynamicItems]
    : [...publicDynamicItems];

  // Si hay prefijo activo, filtrar solo el grupo correspondiente
  const dynamicItems: CommandItem[] = activeGroup
    ? allDynamicItems.filter((item) => {
        const allowed = PREFIX_ADMIN_GROUPS[activePrefix!] ?? [activeGroup];
        return allowed.includes(item.group);
      })
    : allDynamicItems;

  const hasDynamicResults = dynamicItems.length > 0;

  // Elementos de descubrimiento público — se muestran cuando no hay búsqueda activa
  const browseItems: CommandItem[] =
    !showDynamic && browseLoaded
      ? [
          ...browseLibros.map((l) => ({
            id: `browse-l-${l.id}`,
            label: l.titulo,
            description: l.sinopsis
              ? l.sinopsis.slice(0, 60) + (l.sinopsis.length > 60 ? "…" : "")
              : (l.estado ?? "Libro"),
            icon: BookText,
            avatar: l.portada_url ?? null,
            keywords: ["libro", "leer", l.titulo],
            action: () => go(rutaLibro(toSlug(l.titulo))),
            group: "Descubrir · Libros",
          })),
          ...browseCanciones.map((c) => ({
            id: `browse-c-${c.id}`,
            label: c.titulo,
            description: c.cantante ?? "Canción",
            icon: Music,
            avatar: c.portada_url ?? null,
            keywords: ["cancion", "música", c.titulo],
            action: () => go(rutaCancion(toSlug(c.titulo))),
            group: "Descubrir · Canciones",
          })),
        ]
      : [];

  // Group static items
  const staticGroups = staticItems.reduce<Record<string, CommandItem[]>>(
    (acc, item) => {
      (acc[item.group] ??= []).push(item);
      return acc;
    },
    {},
  );

  // Grupos de "Descubrir" (libros/canciones públicas) combinados con los estáticos
  const allGroupsMap: Record<string, CommandItem[]> = { ...staticGroups };
  for (const groupName of ["Descubrir · Libros", "Descubrir · Canciones"]) {
    const items = browseItems.filter((i) => i.group === groupName);
    if (items.length) allGroupsMap[groupName] = items;
  }

  // Orden explícito de los grupos en la pantalla inicial:
  // - Admin:    Admin > Apps > Descubierto > Descubrir · Libros > Descubrir · Canciones > Navegar > Ajustes
  // - No admin: Descubierto > Descubrir · Libros > Descubrir · Canciones > Navegar > Ajustes
  const groupOrder = isAdmin
    ? [
        "Admin",
        "Apps",
        "Descubierto",
        "Descubrir · Libros",
        "Descubrir · Canciones",
        "Navegar",
        "Ajustes",
      ]
    : [
        "Descubierto",
        "Descubrir · Libros",
        "Descubrir · Canciones",
        "Navegar",
        "Ajustes",
      ];

  const orderedGroupEntries = groupOrder
    .filter((g) => allGroupsMap[g]?.length)
    .map((g) => [g, allGroupsMap[g]] as [string, CommandItem[]]);

  // Lista plana + tamaños de sección DERIVADOS del orden visual real
  // (orderedGroupEntries), no del orden crudo de construcción. Antes,
  // defaultFlatItems se armaba como [...staticItems, ...browseItems], que no
  // necesariamente coincide con el orden en que los grupos se pintan en
  // pantalla (groupOrder puede reordenarlos) — eso desalineaba los índices
  // usados por data-grid-index/isSelected respecto a lo que el usuario ve,
  // y sumado al problema de asumir GRID_COLS fijo sobre el índice plano
  // global, la navegación con flechas terminaba saltando de sección o
  // aterrizando en el ítem equivocado.
  const defaultFlatItems = orderedGroupEntries.flatMap(([, items]) => items);
  defaultGridItemsRef.current = defaultFlatItems;
  defaultSectionSizesRef.current = orderedGroupEntries.map(
    ([, items]) => items.length,
  );

  // Group dynamic items
  const dynamicGroups = dynamicItems.reduce<Record<string, CommandItem[]>>(
    (acc, item) => {
      (acc[item.group] ??= []).push(item);
      return acc;
    },
    {},
  );
  const dynamicFlatItems = Object.values(dynamicGroups).flat();
  dynamicSectionSizesRef.current = Object.values(dynamicGroups).map(
    (items) => items.length,
  );

  // Asignación real de los refs que usa el handler de teclado — se hace
  // ACÁ, después de que `orderedGroupEntries`/`dynamicGroups` (y por lo
  // tanto los tamaños de sección) ya están frescos para este render. Ver
  // comentario más arriba, junto a la declaración de estos refs, para el
  // porqué de este orden.
  activeGridItemsRef.current = showCreateGrid
    ? createItemsRef.current
    : activePrefix
      ? prefixItemsRef.current
      : showDynamic
        ? dynamicFlatItems
        : defaultGridItemsRef.current;

  activeSectionSizesRef.current = showCreateGrid
    ? [createItemsRef.current.length]
    : activePrefix
      ? [prefixItemsRef.current.length]
      : showDynamic
        ? dynamicSectionSizesRef.current
        : defaultSectionSizesRef.current;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <MotionDiv
            key="backdrop"
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[9000]"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{
              background: "color-mix(in srgb, var(--bg-main) 60%, transparent)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <MotionDiv
            key="palette"
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed left-1/2 top-[18%] z-[9001] w-full max-w-[500px] -translate-x-1/2"
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            style={{ padding: "0 16px" }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          >
            <Command
              loop
              className="overflow-hidden"
              // Desactivamos el filtro interno de cmdk cuando hay resultados dinámicos
              // para que lo manejemos nosotros via useGlobalSearch
              filter={showDynamic ? () => 1 : undefined}
              style={{
                background: "var(--white-custom)",
                border:
                  "var(--border-width) solid color-mix(in srgb, var(--primary) 15%, transparent)",
                borderRadius: "var(--radius-card)",
                boxShadow: "var(--shadow-card)",
              }}
              onKeyDownCapture={handleGridKeyDown}
            >
              {/* Search input */}
              <div
                className="flex items-center gap-3 px-4"
                style={{
                  borderBottom:
                    "var(--border-width) solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  height: "48px",
                }}
              >
                {isFetching ? (
                  <Loader2
                    className="animate-spin shrink-0"
                    size={14}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 35%, transparent)",
                    }}
                  />
                ) : (
                  <Search
                    size={14}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 35%, transparent)",
                      flexShrink: 0,
                    }}
                  />
                )}
                {/* Badge de prefijo activo */}
                {activeGroup && (
                  <span
                    className="shrink-0 text-micro font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                      border:
                        "var(--border-width) solid color-mix(in srgb, var(--primary) 20%, transparent)",
                    }}
                  >
                    {activeGroup}
                  </span>
                )}
                <Command.Input
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-sm"
                  placeholder="Buscar personajes, libros, canciones…"
                  style={{
                    color: "var(--primary)",
                    caretColor: "var(--primary)",
                  }}
                  value={search}
                  onValueChange={setSearch}
                />
                <kbd
                  className="text-micro font-black uppercase tracking-widest px-1.5 py-0.5 rounded hidden sm:flex items-center"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 8%, transparent)",
                    color:
                      "color-mix(in srgb, var(--primary) 40%, transparent)",
                    border:
                      "var(--border-width) solid color-mix(in srgb, var(--primary) 12%, transparent)",
                  }}
                >
                  esc
                </kbd>
              </div>

              {/* Results */}
              <Command.List
                ref={listRef}
                className="custom-scrollbar"
                style={{
                  maxHeight: "360px",
                  overflowY: "auto",
                  padding: "6px",
                }}
              >
                {/* Grid de creación — al escribir "add / crear / nuevo" */}
                {showCreateGrid && (
                  <Command.Group>
                    <div
                      className="text-micro font-black uppercase tracking-widest px-3 pt-3 pb-2"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 30%, transparent)",
                      }}
                    >
                      Crear nuevo
                    </div>
                    <div
                      className="grid gap-1.5 px-1 pb-2"
                      style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
                    >
                      {createItems.map((item, i) => (
                        <CommandGridItem
                          key={item.id}
                          index={i}
                          isSelected={i === gridIndex}
                          item={item}
                          onHover={() => setGridIndex(i)}
                        />
                      ))}
                    </div>
                  </Command.Group>
                )}

                {/* Resultados dinámicos — siempre en grid */}
                {showDynamic &&
                  hasDynamicResults &&
                  (() => {
                    const flatItems = dynamicFlatItems;
                    prefixItemsRef.current = flatItems;
                    const groupLabel = activeGroup ?? "Resultados";
                    if (activePrefix) {
                      // Un solo grupo activo (p.ej. "per ab") — una sección.
                      return (
                        <Command.Group>
                          <div
                            className="text-micro font-black uppercase tracking-widest px-3 pt-3 pb-2"
                            style={{
                              color:
                                "color-mix(in srgb, var(--primary) 30%, transparent)",
                            }}
                          >
                            {groupLabel}
                          </div>
                          <div
                            className="grid gap-1.5 px-1 pb-2"
                            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
                          >
                            {flatItems.map((item, i) => (
                              <CommandGridItem
                                key={item.id}
                                index={i}
                                isSelected={i === gridIndex}
                                item={item}
                                onHover={() => setGridIndex(i)}
                              />
                            ))}
                          </div>
                        </Command.Group>
                      );
                    }

                    // Sin prefijo — varios grupos de resultados, cada uno su
                    // propia grilla independiente de 3 columnas. Los tamaños
                    // de cada grupo ya se calcularon arriba en
                    // `dynamicSectionSizesRef` (antes del JSX), así que acá
                    // solo iteramos para pintar, reusando ese mismo orden.
                    const groupEntries = Object.entries(dynamicGroups);

                    let runningOffset = 0;
                    return groupEntries.map(([groupName, items]) => {
                      const sectionOffset = runningOffset;
                      runningOffset += items.length;
                      return (
                        <Command.Group key={groupName}>
                          <div
                            className="text-micro font-black uppercase tracking-widest px-3 pt-3 pb-2"
                            style={{
                              color:
                                "color-mix(in srgb, var(--primary) 30%, transparent)",
                            }}
                          >
                            {groupName}
                          </div>
                          <div
                            className="grid gap-1.5 px-1 pb-2"
                            style={{
                              gridTemplateColumns: "repeat(3, 1fr)",
                            }}
                          >
                            {items.map((item, i) => {
                              const globalIndex = sectionOffset + i;
                              return (
                                <CommandGridItem
                                  key={item.id}
                                  index={globalIndex}
                                  isSelected={globalIndex === gridIndex}
                                  item={item}
                                  onHover={() => setGridIndex(globalIndex)}
                                />
                              );
                            })}
                          </div>
                        </Command.Group>
                      );
                    });
                  })()}

                {/* Comandos estáticos + Descubrir — pantalla inicial en columnas, orden unificado */}
                {!showDynamic &&
                  (() => {
                    let runningOffset = 0;
                    return orderedGroupEntries.map(([groupName, items]) => {
                      const sectionOffset = runningOffset;
                      runningOffset += items.length;
                      return (
                        <Command.Group key={groupName}>
                          <div
                            className="text-micro font-black uppercase tracking-widest px-3 pt-3 pb-2"
                            style={{
                              color:
                                "color-mix(in srgb, var(--primary) 30%, transparent)",
                            }}
                          >
                            {groupName}
                          </div>
                          <div
                            className="grid gap-1.5 px-1 pb-2"
                            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
                          >
                            {items.map((item, i) => {
                              const globalIndex = sectionOffset + i;
                              return (
                                <CommandGridItem
                                  key={item.id}
                                  index={globalIndex}
                                  isSelected={globalIndex === gridIndex}
                                  item={item}
                                  onHover={() => setGridIndex(globalIndex)}
                                />
                              );
                            })}
                          </div>
                        </Command.Group>
                      );
                    });
                  })()}

                {/* Sin resultados dinámicos pero con búsqueda activa */}
                {showDynamic && !hasDynamicResults && !isFetching && (
                  <div
                    className="flex flex-col items-center gap-2 py-10"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 35%, transparent)",
                    }}
                  >
                    <Flower2 size={20} />
                    {activePrefix && prefixQuery.length === 0 ? (
                      <span className="text-xs font-medium">
                        Cargando {activeGroup}…
                      </span>
                    ) : (
                      <span className="text-xs font-medium">
                        Sin resultados para &ldquo;{prefixQuery || search}
                        &rdquo;
                      </span>
                    )}
                  </div>
                )}
              </Command.List>

              {/* Footer */}
              <div
                className="flex items-center gap-3 px-4 py-2"
                style={{
                  borderTop:
                    "var(--border-width) solid color-mix(in srgb, var(--primary) 8%, transparent)",
                  color: "color-mix(in srgb, var(--primary) 28%, transparent)",
                }}
              >
                <span className="text-micro font-black uppercase tracking-widest">
                  ↑↓ navegar
                </span>
                <span className="text-micro font-black uppercase tracking-widest">
                  ↵ abrir
                </span>
                {inGridMode && (
                  <span
                    className="text-micro font-black uppercase tracking-widest"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 28%, transparent)",
                    }}
                  >
                    ← → ↑ ↓ mover
                  </span>
                )}
                {showDynamic && (
                  <span
                    className="flex items-center gap-1 text-micro font-black uppercase tracking-widest ml-auto"
                    style={{
                      color: fromCache
                        ? "color-mix(in srgb, var(--primary) 40%, transparent)"
                        : "color-mix(in srgb, var(--primary) 28%, transparent)",
                    }}
                  >
                    <WifiOff
                      className={fromCache ? "opacity-100" : "opacity-0"}
                      size={9}
                    />
                    {fromCache ? "cache local" : "en línea"}
                  </span>
                )}
                {!showDynamic && !showCreateGrid && (
                  <span
                    className="text-micro font-black uppercase tracking-widest ml-auto"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 28%, transparent)",
                    }}
                  >
                    per · cri · lib · can…
                  </span>
                )}
                {!showDynamic && !showCreateGrid && (
                  <span
                    className="text-micro font-black uppercase tracking-widest"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 28%, transparent)",
                    }}
                  >
                    ctrl+ñ
                  </span>
                )}
              </div>
            </Command>
          </MotionDiv>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Grid item (panel Crear) ───────────────────────────────────────────────────

function CommandGridItem({
  item,
  index,
  isSelected,
  onHover,
}: {
  item: CommandItem;
  index: number;
  isSelected: boolean;
  onHover: () => void;
}) {
  const Icon = item.icon;
  const hasAvatar = !!item.avatar;

  return (
    <Command.Item
      className="group relative flex flex-col items-center justify-center gap-2 cursor-pointer outline-none transition-all duration-100 min-w-0 w-full"
      data-grid-index={index}
      style={{
        padding: "12px 8px",
        borderRadius: "var(--radius-btn)",
        border: `var(--border-width) solid ${isSelected ? "color-mix(in srgb, var(--primary) 25%, transparent)" : "color-mix(in srgb, var(--primary) 10%, transparent)"}`,
        background: isSelected
          ? "color-mix(in srgb, var(--primary) 6%, transparent)"
          : "transparent",
      }}
      value={`${item.id} ${item.label} ${item.keywords?.join(" ") ?? ""}`}
      onMouseEnter={onHover}
      onSelect={item.action}
    >
      {/* Badge admin — icono esquina superior derecha */}
      {item.isAdminResult && (
        <span
          className="absolute top-1 right-1 flex items-center justify-center shrink-0"
          style={{
            width: 16,
            height: 16,
            borderRadius: "9999px",
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            color: "color-mix(in srgb, var(--primary) 55%, transparent)",
          }}
          title="Resultado admin"
        >
          <ShieldCheck size={10} strokeWidth={2.25} />
        </span>
      )}

      {/* Imagen o icono */}
      {hasAvatar ? (
        <img
          alt={item.label}
          className="shrink-0 object-cover"
          src={item.avatar!}
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-btn)",
            border: isSelected
              ? "2px solid color-mix(in srgb, var(--primary) 30%, transparent)"
              : "2px solid color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        />
      ) : (
        <span
          className="flex items-center justify-center shrink-0 transition-colors duration-100"
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-btn)",
            background: isSelected
              ? "color-mix(in srgb, var(--primary) 12%, transparent)"
              : "color-mix(in srgb, var(--primary) 7%, transparent)",
            color: "var(--primary)",
          }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
      )}

      <p
        className="text-micro font-semibold text-center leading-tight w-full truncate px-1"
        style={{ color: "var(--primary)" }}
      >
        {item.label.replace(/^(Nuevo|Nueva|New)\s+/i, "")}
      </p>

      {item.description && (
        <p
          className="text-micro text-center leading-tight w-full truncate px-1 -mt-1"
          style={{
            color: "color-mix(in srgb, var(--primary) 40%, transparent)",
          }}
        >
          {item.description}
        </p>
      )}
    </Command.Item>
  );
}

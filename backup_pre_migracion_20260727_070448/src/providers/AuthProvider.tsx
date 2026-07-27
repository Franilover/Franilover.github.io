"use client";
import type { User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

async function getPerfilCached() {
  try {
    if (!db) return null;
    const row = await db.session_cache.get("perfil");
    return row ? row.value : null;
  } catch {
    return null;
  }
}

async function setPerfilCached(perfil: any) {
  try {
    if (!db) return;
    await db.session_cache.put({
      key: "perfil",
      value: { perfil, updated_at: Date.now() },
      updated_at: Date.now(),
    });
  } catch (e) {
    console.warn("[AuthProvider Cache] No se pudo guardar perfil local:", e);
  }
}

async function clearPerfilCached() {
  try {
    if (!db) return;
    await db.session_cache.delete("perfil");
  } catch {}
}

// ─── Tiempo máximo antes de refrescar desde Supabase (5 minutos) ─────────────
const PERFIL_CACHE_TTL_MS = 5 * 60 * 1000;

type PerfilLocal = {
  id: string;
  email?: string | null;
  username?: string | null;
  rol?: string | null;
  status?: string | null;
  cached_at?: number;
  [key: string]: any;
};

type AuthContextType = {
  user: User | null;
  perfil: PerfilLocal | null;
  loading: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  perfil: null,
  loading: true,
  isAdmin: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setPerfil_user] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilLocal | null>(null);
  const [loading, setLoading] = useState(true);

  // isAdmin combina dos fuentes a propósito:
  // 1. perfil?.rol === "admin" — instantáneo, viene de Dexie/caché, así la
  //    UI no parpadea mientras carga. Puede estar desactualizado unos
  //    minutos (mismo TTL que el resto del perfil).
  // 2. adminVerificado — confirmación real contra la función is_admin() en
  //    Supabase (RLS), que corre en segundo plano tras el fetch de perfil.
  //    Cuando llega, sobreescribe el valor de caché si discrepan.
  // Nunca es la barrera de seguridad real (eso lo hace RLS en el server),
  // solo decide qué mostrar/ocultar en la UI.
  const [adminVerificado, setAdminVerificado] = useState<boolean | null>(null);
  const isAdmin = adminVerificado ?? perfil?.rol === "admin";

  // Ref para evitar actualizaciones de estado en componente desmontado
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Guardar perfil en Dexie ───────────────────────────────────────────────
  const guardarPerfilDexie = async (perfilData: any) => {
    try {
      await db.perfiles.put({ ...perfilData, cached_at: Date.now() });
    } catch (err) {
      console.warn("No se pudo guardar perfil en Dexie:", err);
    }
  };

  // ── Leer perfil desde Dexie ───────────────────────────────────────────────
  const leerPerfilDexie = async (userId: string) => {
    try {
      return (await db.perfiles.get(userId)) ?? null;
    } catch {
      return null;
    }
  };

  // ── Confirmar admin contra el servidor (RLS) ──────────────────────────────
  // Llama a la función is_admin() real en Supabase, que es la que de verdad
  // protege las operaciones sensibles (la única fuente de verdad). Si
  // discrepa con el valor de caché (perfil.rol), corrige adminVerificado
  // para que la UI deje de mostrar/ocultar cosas de admin con datos viejos.
  // No bloquea nada mientras tanto: isAdmin sigue usando el valor de caché
  // hasta que esta confirmación llega.
  const verificarAdminReal = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("is_admin");
      if (!mountedRef.current) return;
      if (!error) setAdminVerificado(!!data);
      // Si hay error (sin red, función no encontrada, etc.) no tocamos
      // adminVerificado — se mantiene el valor de caché como fallback.
    } catch {
      // silencioso a propósito: sin conexión es un caso normal, no un bug
    }
  }, []);

  const fetchPerfil = async (userId: string, userEmail: string) => {
    try {
      // 1️⃣ Dexie primero — mostrar inmediatamente aunque no haya red
      const dexiePerfil = await leerPerfilDexie(userId);
      if (dexiePerfil && mountedRef.current) {
        setPerfil(dexiePerfil);
        setLoading(false);

        // La verificación de admin es liviana (un solo rpc) y vale la pena
        // confirmarla siempre al iniciar sesión, incluso si el caché del
        // perfil completo todavía está "fresco" y se evita el fetch grande
        // de abajo — son cosas independientes.
        void verificarAdminReal();

        // Si el caché es reciente, no hacer fetch a Supabase todavía
        const edad = Date.now() - (dexiePerfil.cached_at ?? 0);
        if (edad < PERFIL_CACHE_TTL_MS) return;
      }

      // 2️⃣ Caché legacy (perfilCache) como fallback adicional
      if (!dexiePerfil) {
        const cached = await getPerfilCached();
        if (cached?.perfil && mountedRef.current) {
          setPerfil(cached.perfil);
          setLoading(false);
        }
      }

      // 3️⃣ Fetch real a Supabase — sobreescribe el caché local con datos frescos
      const { data, error } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!mountedRef.current) return;

      if (data) {
        // ✅ Perfil encontrado — guardar en Dexie y actualizar estado
        setPerfil(data);
        void setPerfilCached(data);
        await guardarPerfilDexie(data);
        void verificarAdminReal();
      } else if (error?.code === "PGRST116") {
        // PGRST116 = "no rows found" — el perfil realmente no existe, crearlo
        const nombreAuto = userEmail ? userEmail.split("@")[0] : "Usuario";
        const nuevoPerfil = {
          id: userId,
          email: userEmail,
          username: nombreAuto,
          // ✅ Sin rol — el trigger handle_new_user ya lo asigna como 'user'
          status: "Explorador Novato",
        };
        const { error: insertError } = await supabase
          .from("perfiles")
          .insert(nuevoPerfil); // insert, nunca upsert — no pisa datos existentes

        if (!insertError && mountedRef.current) {
          const perfilConRol = { ...nuevoPerfil, rol: "user" };
          setPerfil(perfilConRol);
          void setPerfilCached(perfilConRol);
          await guardarPerfilDexie(perfilConRol);
        }
      }
      // Cualquier otro error (red, permisos) no hace nada —
      // se mantiene lo que ya estaba en Dexie
    } catch (err) {
      if (mountedRef.current) console.error("Error al cargar perfil:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    // ── Leer sesión inicial ANTES de suscribirse ──────────────────────────
    // Esto evita el AbortError: getSession() es síncrono-compatible y no
    // bloquea el callback de onAuthStateChange.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      if (session?.user) {
        setPerfil_user(session.user);
        void fetchPerfil(session.user.id, session.user.email ?? "");
      } else {
        setLoading(false);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      if (session?.user) {
        setPerfil_user(session.user);
        // Sin await — lanzar y olvidar; fetchPerfil maneja su propio finally
        void fetchPerfil(session.user.id, session.user.email ?? "");
      } else {
        setPerfil_user(null);
        setPerfil(null);
        setAdminVerificado(null);
        void clearPerfilCached();
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, perfil, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

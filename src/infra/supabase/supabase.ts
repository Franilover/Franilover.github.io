import { createClient } from "@supabase/supabase-js";
import type { LockFunc } from "@supabase/supabase-js";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("❌ Error: Faltan las variables de entorno de Supabase.");
}

const isBrowser = typeof window !== "undefined";
const noopLock: LockFunc = <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    storage:            isBrowser ? window.localStorage : undefined,
    lock:               noopLock,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
    timeout: 20000,
  },
});

// Sincroniza el JWT que usa el socket de Supabase Realtime con el de la
// sesión de auth actual. Sin esto, Realtime autentica el WebSocket con el
// anon key en vez del JWT del usuario — que es indistinguible en apariencia
// (los canales públicos funcionan igual), pero rompe cualquier canal
// `private: true` cuyas RLS dependan de auth.uid() (ver
// suscribirseASenalesDeLlamada / enviarSenal en callEngine.ts): el server
// no puede evaluar auth.uid() sin el JWT real, y el subscribe() del canal
// termina en CHANNEL_ERROR o TIMED_OUT — era la causa real de que las
// llamadas de voz nunca conectaran de ningún lado.
//
// Se llama tanto al arrancar (por si ya hay sesión guardada) como en cada
// evento de auth (login, refresh de token, logout) para que el JWT de
// Realtime nunca quede desactualizado respecto al de auth.
//
// IMPORTANTE — carrera de arranque: setAuth() es async y se dispara desde
// acá de forma "fire and forget". Si algún código llama a canal.subscribe()
// en un canal privado ANTES de que este primer setAuth() haya terminado de
// aplicarse, ese canal queda autenticado con el anon key — y en la práctica
// NO se re-autentica solo aunque setAuth() corra después (confirmado
// viendo los logs de Realtime: "Unauthorized" repitiéndose sin parar cada
// pocos segundos, aunque las policies y el setAuth() ya estuvieran bien).
// Por eso exponemos esta promesa: cualquier código que abra un canal
// privado (ver callEngine.ts) debe awaitearla antes de llamar a
// subscribe(), para garantizar que el JWT ya esté aplicado.
let resolverRealtimeAuthListo: () => void;
export const realtimeAuthListo = new Promise<void>((resolve) => {
  resolverRealtimeAuthListo = resolve;
});

if (isBrowser) {
  void supabase.auth.getSession().then(async ({ data: { session } }) => {
    await supabase.realtime.setAuth(session?.access_token ?? null);
    resolverRealtimeAuthListo();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    void supabase.realtime.setAuth(session?.access_token ?? null);
  });
} else {
  // SSR / build: no hay canales Realtime que abrir, resolvemos directo
  // para no dejar colgada a ninguna promesa que la esté esperando.
  resolverRealtimeAuthListo!();
}
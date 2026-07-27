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
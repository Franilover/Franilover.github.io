"use client";

import { useEffect, useRef } from "react";

// La lógica pura (sin React) vive ahora en lib/utils/offlineSync.ts, tal como
// exige la regla de arquitectura "lib/ no importa hooks/". Este archivo
// re-exporta esas utilidades para no romper a los consumidores existentes que
// las importaban desde aquí, y añade el único hook React de este módulo.
export {
  onSyncDone,
  isReallyOnline,
  dexiePut,
  dexieUpdate,
  dexieDelete,
  runSync,
  enqueueOperation,
  getPendingCount,
} from "@/lib/utils/offlineSync";

import { runSync } from "@/lib/utils/offlineSync";

export function useOfflineSync() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleHandleRef = useRef<number | null>(null);
  const triggerSyncRef = useRef<() => void>(() => {});

  useEffect(() => {
    triggerSyncRef.current = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runSync();
      }, 500);
    };

    const handleOnline = () => triggerSyncRef.current();

    // RENDIMIENTO: antes esto llamaba a runSync() de forma síncrona en el
    // mismo tick del montaje inicial (este hook se monta desde
    // <OfflineSyncActivator /> en el layout raíz, o sea en TODA carga de
    // la app). runSync() necesita abrir Dexie/IndexedDB para leer
    // offline_queue, y esa apertura es la que dispara la cascada de
    // migraciones del esquema (ver infra/supabase/db.ts) la primera vez
    // que hace falta — bloqueante para cualquier otra lectura/escritura
    // sobre la misma base mientras tanto, incluyendo el caché de
    // mensajes de chatEngine y el resto de useSupabaseData, que
    // comparten el mismo singleton `db`. Con requestIdleCallback,
    // dejamos que el navegador pinte el primer frame y respire antes de
    // competir por esa conexión — si el navegador no soporta
    // requestIdleCallback (Safari), caemos a un setTimeout corto como
    // aproximación razonable.
    const dispararSyncInicial = () => void runSync();
    if (typeof window.requestIdleCallback === "function") {
      idleHandleRef.current = window.requestIdleCallback(dispararSyncInicial, {
        timeout: 2000,
      });
    } else {
      idleHandleRef.current = window.setTimeout(dispararSyncInicial, 300) as unknown as number;
    }

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (idleHandleRef.current != null) {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleHandleRef.current);
        } else {
          clearTimeout(idleHandleRef.current);
        }
      }
    };
  }, []);

  return { syncAll: runSync };
}

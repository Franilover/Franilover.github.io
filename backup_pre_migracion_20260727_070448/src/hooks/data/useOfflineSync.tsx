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
  const triggerSyncRef = useRef<() => void>(() => {});

  useEffect(() => {
    triggerSyncRef.current = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runSync();
      }, 500);
    };

    const handleOnline = () => triggerSyncRef.current();

    void runSync();
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { syncAll: runSync };
}

"use client";

/**
 * useEnLinea.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook chico para leer quién está en línea ahora mismo. Requiere que
 * `<PresenciaActivator />` esté montado en el layout raíz (es quien llama a
 * `conectarPresencia`); este hook solo lee el estado, no lo crea.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";

import { suscribirseAPresencia } from "@/lib/api/client/presenceEngine";

/** Devuelve el set de ids de perfil actualmente en línea, reactivo. */
export function useUsuariosEnLinea(): Set<string> {
  const [idsEnLinea, setIdsEnLinea] = useState<Set<string>>(new Set());

  useEffect(() => {
    const limpiar = suscribirseAPresencia(setIdsEnLinea);
    return limpiar;
  }, []);

  return idsEnLinea;
}

/** Azúcar sintáctica para el caso más común: ¿está en línea este usuario puntual? */
export function useEstaEnLinea(perfilId: string | null | undefined): boolean {
  const idsEnLinea = useUsuariosEnLinea();
  return !!perfilId && idsEnLinea.has(perfilId);
}

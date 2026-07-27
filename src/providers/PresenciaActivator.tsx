"use client";

/**
 * PresenciaActivator.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Se monta una sola vez en el layout raíz. Mientras haya sesión activa,
 * mantiene al usuario "en línea" en el canal de presencia global. No
 * renderiza nada visible — es análogo a <OfflineSyncActivator />.
 *
 * También escucha `visibilitychange`/`focus` a nivel de toda la app para
 * forzar la reconexión del socket de Realtime si se cayó mientras la
 * pestaña/PWA estuvo en background (típico en mobile). Esto es un
 * complemento global al mismo fix puntual que tiene el chat — cubre
 * cualquier otra pantalla que dependa de Realtime, no solo la conversación
 * que esté abierta en ese momento.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from "react";

import { conectarPresencia } from "@/infra/call/presenceEngine";
import { reconectarRealtimeSiHaceFalta } from "@/infra/call/chatEngine";
import { useAuth } from "@/providers/AuthProvider";

export function PresenciaActivator() {
  const { user } = useAuth() as { user: any };

  useEffect(() => {
    if (!user) return;
    const desconectar = conectarPresencia(user.id);
    return desconectar;
  }, [user?.id]);

  useEffect(() => {
    const handleVisibilidad = () => {
      if (document.visibilityState === "visible") reconectarRealtimeSiHaceFalta();
    };
    document.addEventListener("visibilitychange", handleVisibilidad);
    window.addEventListener("focus", handleVisibilidad);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilidad);
      window.removeEventListener("focus", handleVisibilidad);
    };
  }, []);

  return null;
}

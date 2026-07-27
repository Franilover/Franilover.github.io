"use client";

/**
 * PushActivator.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Se monta una sola vez en el layout raíz. Mientras haya sesión activa,
 * registra (o renueva) la suscripción a Web Push del dispositivo actual, así
 * `notify-message` puede pushear mensajes nuevos aunque la app esté cerrada.
 * No renderiza nada visible — análogo a <PresenciaActivator />.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from "react";

import { registrarPushSubscription } from "@/infra/push/pushEngine";
import { useAuth } from "@/providers/AuthProvider";

export function PushActivator() {
  const { user } = useAuth() as { user: any };

  useEffect(() => {
    if (!user) return;
    void registrarPushSubscription();
  }, [user?.id]);

  return null;
}

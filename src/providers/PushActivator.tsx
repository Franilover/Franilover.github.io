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

import { registrarPushSubscription, guardarTokenFcm } from "@/infra/push/pushEngine";
import { estaEnTauri } from "@/lib/utils/navegacionTauri";
import { useAuth } from "@/providers/AuthProvider";

// El lado nativo (FirebaseMessagingService.kt) llama a esta función global
// vía evaluateJavascript() cuando Firebase entrega o renueva el token del
// dispositivo. Se declara acá (no en pushEngine.ts) porque es el único
// lugar que necesita saber de la sesión activa para guardarlo.
declare global {
  interface Window {
    onFcmToken?: (token: string) => void;
  }
}

export function PushActivator() {
  const { user } = useAuth() as { user: any };

  useEffect(() => {
    if (!user) return;

    if (estaEnTauri()) {
      // APK Android: no hay Web Push real en el WebView de Tauri, así que
      // en vez de suscribirnos al Service Worker esperamos el token FCM
      // que entrega el lado nativo. Si el token ya se recibió antes de que
      // este componente se montara (carrera con el arranque de la app),
      // window.__fcmTokenPendiente lo guarda temporalmente.
      window.onFcmToken = (token: string) => {
        void guardarTokenFcm(token);
      };
      const pendiente = (window as any).__fcmTokenPendiente as string | undefined;
      if (pendiente) void guardarTokenFcm(pendiente);
      return () => {
        window.onFcmToken = undefined;
      };
    }

    void registrarPushSubscription();
  }, [user?.id]);

  return null;
}

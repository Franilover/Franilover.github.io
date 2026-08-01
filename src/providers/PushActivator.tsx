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

import { aceptarLlamada, marcarEstadoLlamada, rechazarLlamada } from "@/infra/call/callEngine";
import { registrarPushSubscription, guardarTokenFcm } from "@/infra/push/pushEngine";
import { useLlamadaStore } from "@/infra/realtime/useLlamadaStore";
import { estaEnTauri } from "@/lib/utils/navegacionTauri";
import { supabase } from "@/infra/supabase/supabase";
import { useAuth } from "@/providers/AuthProvider";

// El lado nativo (FirebaseMessagingService.kt) llama a esta función global
// vía evaluateJavascript() cuando Firebase entrega o renueva el token del
// dispositivo. Se declara acá (no en pushEngine.ts) porque es el único
// lugar que necesita saber de la sesión activa para guardarlo.
declare global {
  interface Window {
    onFcmToken?: (token: string) => void;
    onFcmLlamadaAccion?: (payload: {
      accion: "aceptar" | "rechazar";
      llamadaId: string;
      conversacionId: string;
      roomName: string;
    }) => void;
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

      // El usuario ya decidió Aceptar/Rechazar desde la notificación nativa
      // de llamada entrante (LlamadaEntranteActivity, ver
      // GarliaFirebaseMessagingService.kt) — acá solo hace falta reflejar
      // esa decisión: si la sesión Realtime SÍ llegó a avisar la oferta
      // mientras tanto, el store ya tiene el estado "entrante" con los
      // datos del otro participante y solo actuamos sobre él. Si no llegó
      // (típico: app estaba cerrada, el canal Realtime ni se conectó a
      // tiempo), reconstruimos lo mínimo indispensable desde la fila de
      // `llamadas` para poder aceptar/rechazar igual.
      window.onFcmLlamadaAccion = (payload) => {
        void manejarAccionLlamadaDesdeNotificacion(payload, user.id);
      };

      return () => {
        window.onFcmToken = undefined;
        window.onFcmLlamadaAccion = undefined;
      };
    }

    void registrarPushSubscription();
  }, [user?.id]);

  return null;
}

async function manejarAccionLlamadaDesdeNotificacion(
  payload: {
    accion: "aceptar" | "rechazar";
    llamadaId: string;
    conversacionId: string;
    roomName: string;
  },
  miPerfilId: string,
): Promise<void> {
  const store = useLlamadaStore.getState();

  // Camino feliz: el canal Realtime ya trajo la oferta (LlamadaGlobal ya
  // está montado y suscrito) y el store tiene todos los datos, incluido el
  // otro participante con nombre/avatar para la UI. Solo hace falta actuar.
  if (store.estado === "entrante" && store.llamadaId === payload.llamadaId && store.otro) {
    if (payload.accion === "aceptar") {
      store.marcarConectada();
      void marcarEstadoLlamada(payload.llamadaId, "aceptada").catch(() => {});
      void aceptarLlamada({
        conversacionId: payload.conversacionId,
        llamadaId: payload.llamadaId,
        roomName: payload.roomName,
        paraId: store.otro.id,
        deId: miPerfilId,
      }).catch(() => {});
    } else {
      void rechazarLlamada({
        conversacionId: payload.conversacionId,
        llamadaId: payload.llamadaId,
        roomName: payload.roomName,
        paraId: store.otro.id,
        deId: miPerfilId,
      }).catch(() => {});
      void marcarEstadoLlamada(payload.llamadaId, "rechazada").catch(() => {});
      store.finalizar();
    }
    return;
  }

  // Camino frío: no hay nada en el store todavía (la app arrancó recién
  // ahora, a partir de tocar la notificación). Reconstruimos lo mínimo
  // necesario consultando la fila de `llamadas` directamente — no
  // dependemos de que Realtime haya alcanzado a avisar nada.
  const { data: llamada } = await supabase
    .from("llamadas")
    .select("id, conversacion_id, iniciada_por, room_name, estado")
    .eq("id", payload.llamadaId)
    .maybeSingle();
  if (!llamada) return;

  // Si para cuando el usuario tocó "Aceptar" la llamada ya no está sonando
  // (colgada, o ya fue rechazada de otra sesión del mismo usuario, ej. la
  // tablet), no hay nada que hacer.
  if (llamada.estado && llamada.estado !== "sonando") return;

  const { data: perfilQueLlama } = await supabase
    .from("perfiles")
    .select("id, username, avatar_url")
    .eq("id", llamada.iniciada_por)
    .maybeSingle();

  const otro = {
    id: llamada.iniciada_por,
    nombre: perfilQueLlama?.username ?? null,
    avatar: perfilQueLlama?.avatar_url ?? null,
  };

  if (payload.accion === "aceptar") {
    useLlamadaStore.getState().recibirEntrante({
      conversacionId: llamada.conversacion_id,
      llamadaId: llamada.id,
      roomName: llamada.room_name,
      otro,
    });
    useLlamadaStore.getState().marcarConectada();
    void marcarEstadoLlamada(llamada.id, "aceptada").catch(() => {});
    void aceptarLlamada({
      conversacionId: llamada.conversacion_id,
      llamadaId: llamada.id,
      roomName: llamada.room_name,
      paraId: otro.id,
      deId: miPerfilId,
    }).catch(() => {});
  } else {
    void rechazarLlamada({
      conversacionId: llamada.conversacion_id,
      llamadaId: llamada.id,
      roomName: llamada.room_name,
      paraId: otro.id,
      deId: miPerfilId,
    }).catch(() => {});
    void marcarEstadoLlamada(llamada.id, "rechazada").catch(() => {});
  }
}

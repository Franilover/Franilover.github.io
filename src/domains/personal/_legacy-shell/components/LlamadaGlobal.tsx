"use client";

/**
 * LlamadaGlobal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vive una sola vez, montado en el layout raíz (fuera del <main>), así se
 * mantiene activo sin importar en qué pantalla esté el usuario. Hace dos
 * cosas:
 *   1. Se suscribe al canal de señales de llamada del usuario (siempre que
 *      haya sesión), para mostrar la pantalla de "llamada entrante" apenas
 *      llegue una oferta, sin que el usuario tenga que estar en /mensajes.
 *   2. Renderiza el overlay de la llamada en curso (llamando / entrante /
 *      conectada) usando LiveKit para audio/video real una vez conectada.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Room, RoomEvent, Track } from "livekit-client";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import {
  colgarLlamada,
  pedirTokenLlamada,
  rechazarLlamada,
  suscribirseASenalesDeLlamada,
  type SenalLlamada,
} from "@/lib/api/client/callEngine";
import { supabase } from "@/lib/api/client/supabase";
import { useLlamadaStore } from "@/infra/realtime/useLlamadaStore";
import { useAuth } from "@/providers/AuthProvider";

export default function LlamadaGlobal() {
  const { user } = useAuth() as { user: any };
  const {
    estado,
    conversacionId,
    llamadaId,
    roomName,
    otro,
    recibirEntrante,
    marcarConectada,
    finalizar,
  } = useLlamadaStore();

  const roomRef = useRef<Room | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [errorLlamada, setErrorLlamada] = useState<string | null>(null);

  // ── Escuchar señales de llamada entrante / colgada ──────────────────────
  useEffect(() => {
    if (!user) return;

    const canal = suscribirseASenalesDeLlamada(user.id, (senal: SenalLlamada) => {
      if (senal.tipo === "oferta") {
        // Si ya estamos en otra llamada, ignoramos la nueva oferta (simple:
        // sin "llamada en espera" por ahora).
        if (useLlamadaStore.getState().estado !== "inactiva") return;
        recibirEntrante({
          conversacionId: senal.conversacionId,
          llamadaId: senal.llamadaId,
          roomName: senal.roomName,
          otro: { id: senal.deId, nombre: senal.deNombre, avatar: senal.deAvatar },
        });
      }
      if (senal.tipo === "rechazada" || senal.tipo === "colgada") {
        // El otro lado cortó o rechazó: cerramos todo de nuestro lado también.
        roomRef.current?.disconnect();
        roomRef.current = null;
        finalizar();
      }
    });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [user, recibirEntrante, finalizar]);

  // ── Conectar a LiveKit cuando la llamada pasa a "conectada" ─────────────
  const conectar = async () => {
    if (!llamadaId) return;
    setConectando(true);
    setErrorLlamada(null);
    try {
      const { token, url } = await pedirTokenLlamada(llamadaId);
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        // Nota: hoy la Edge Function solo habilita publicación de audio
        // (canPublishSources: ["microphone"]), así que acá solo esperamos
        // tracks de audio. Cuando se habilite video en el token, agregar
        // el manejo de Track.Kind.Video con un <video> remoto.
        if (track.kind === Track.Kind.Audio) {
          track.attach();
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        finalizar();
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      marcarConectada();
    } catch (err: any) {
      setErrorLlamada(err?.message ?? "No se pudo conectar la llamada.");
    } finally {
      setConectando(false);
    }
  };

  useEffect(() => {
    if (estado === "conectada" && !roomRef.current) {
      void conectar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const handleColgar = async () => {
    if (conversacionId && llamadaId && roomName && otro && user) {
      await colgarLlamada({
        conversacionId,
        llamadaId,
        roomName,
        paraId: otro.id,
        deId: user.id,
      }).catch(() => {});
    }
    roomRef.current?.disconnect();
    roomRef.current = null;
    finalizar();
  };

  const handleRechazar = async () => {
    if (conversacionId && llamadaId && roomName && otro && user) {
      await rechazarLlamada({
        conversacionId,
        llamadaId,
        roomName,
        paraId: otro.id,
        deId: user.id,
      }).catch(() => {});
    }
    finalizar();
  };

  const toggleMic = async () => {
    if (!roomRef.current) return;
    const nuevo = !micOn;
    await roomRef.current.localParticipant.setMicrophoneEnabled(nuevo);
    setMicOn(nuevo);
  };

  if (estado === "inactiva") return null;

  return (
    <div
      className="fixed inset-0 z-[3000] flex flex-col items-center justify-between py-10 px-6"
      style={{ background: "color-mix(in srgb, black 88%, var(--bg-main))" }}
    >
      {/* ── Info del otro participante ── */}
      <div className="flex flex-col items-center gap-3 mt-10">
        <div
          className="rounded-full overflow-hidden flex items-center justify-center"
          style={{ width: 96, height: 96, background: "color-mix(in srgb, white 10%, transparent)" }}
        >
          {otro?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={otro.nombre ?? "Usuario"} className="w-full h-full object-cover" src={otro.avatar} />
          ) : (
            <span className="text-white text-2xl font-black">
              {otro?.nombre?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>
        <p className="text-white font-black text-lg">{otro?.nombre ?? "Usuario"}</p>
        <p className="text-white/50 text-micro font-black uppercase tracking-widest">
          {estado === "llamando" && "Llamando…"}
          {estado === "entrante" && "Te está llamando…"}
          {estado === "conectada" && (conectando ? "Conectando…" : "En llamada")}
        </p>
        {errorLlamada && (
          <p className="text-red-400 text-micro font-bold max-w-xs text-center">{errorLlamada}</p>
        )}
      </div>

      <div className="flex-1" />

      {/* ── Controles ── */}
      <div className="flex items-center gap-4">
        {estado === "entrante" ? (
          <>
            <button
              className="flex items-center justify-center rounded-full"
              style={{ width: 56, height: 56, background: "#ef4444" }}
              onClick={() => void handleRechazar()}
              aria-label="Rechazar"
            >
              <PhoneOff className="text-white" size={22} />
            </button>
            <button
              className="flex items-center justify-center rounded-full"
              style={{ width: 56, height: 56, background: "#22c55e" }}
              onClick={() => marcarConectada()}
              aria-label="Aceptar"
            >
              <Phone className="text-white" size={22} />
            </button>
          </>
        ) : (
          <>
            {estado === "conectada" && (
              <button
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 48,
                  height: 48,
                  background: "color-mix(in srgb, white 12%, transparent)",
                }}
                onClick={() => void toggleMic()}
                aria-label="Micrófono"
              >
                {micOn ? <Mic className="text-white" size={18} /> : <MicOff className="text-white" size={18} />}
              </button>
            )}
            <button
              className="flex items-center justify-center rounded-full"
              style={{ width: 56, height: 56, background: "#ef4444" }}
              onClick={() => void handleColgar()}
              aria-label="Colgar"
            >
              <PhoneOff className="text-white" size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

/**
 * useGrabadorAudio
 * ─────────────────────────────────────────────────────────────────────────
 * Grabador de audio con MediaRecorder, pensado para el botón de "mantené
 * presionado para grabar" del input del chat (estilo WhatsApp/Instagram).
 *
 * Devuelve el estado de grabación + duración en vivo, y expone:
 *   - iniciar(): pide permiso de micrófono (si hace falta) y arranca a grabar
 *   - detenerYObtener(): para la grabación y devuelve el Blob final
 *   - cancelar(): para la grabación y descarta todo (no llama a onListo)
 *
 * El formato de salida es 'audio/webm' (lo que graba MediaRecorder por
 * defecto en Chrome/Firefox/Edge — Safari en iOS 14.3+ también lo soporta),
 * que ya está aceptado del lado del backend (ver TIPOS_AUDIO en
 * chatEngine.ts) sin tener que tocar nada ahí.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type EstadoGrabacion = "inactivo" | "pidiendo_permiso" | "grabando" | "error";

interface UseGrabadorAudioResult {
  estado: EstadoGrabacion;
  /** Segundos transcurridos desde que arrancó la grabación actual. */
  duracionSegundos: number;
  errorMensaje: string | null;
  iniciar: () => Promise<void>;
  /** Para la grabación y resuelve con el Blob final, o null si no había
   *  nada grabado (por ejemplo, se llamó sin haber iniciado antes). */
  detenerYObtener: () => Promise<Blob | null>;
  cancelar: () => void;
}

const MIME_CANDIDATOS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4", // fallback para Safari/iOS
];

function elegirMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const mime of MIME_CANDIDATOS) {
    if (MediaRecorder.isTypeSupported?.(mime)) return mime;
  }
  return undefined; // el navegador usará su default
}

export function useGrabadorAudio(): UseGrabadorAudioResult {
  const [estado, setEstado] = useState<EstadoGrabacion>("inactivo");
  const [duracionSegundos, setDuracionSegundos] = useState(0);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicioRef = useRef<number>(0);

  const limpiarStream = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const iniciar = useCallback(async () => {
    if (estado === "grabando" || estado === "pidiendo_permiso") return;
    setErrorMensaje(null);
    setEstado("pidiendo_permiso");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = elegirMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      inicioRef.current = Date.now();
      setDuracionSegundos(0);
      tickRef.current = setInterval(() => {
        setDuracionSegundos(Math.floor((Date.now() - inicioRef.current) / 1000));
      }, 250);

      setEstado("grabando");
    } catch (err: any) {
      limpiarStream();
      setEstado("error");
      // NotAllowedError es lo que tira el navegador si el usuario niega el
      // permiso de micrófono — es, con mucho, el caso más común de error acá.
      const mensaje =
        err?.name === "NotAllowedError"
          ? "Necesitamos permiso para usar el micrófono."
          : "No se pudo acceder al micrófono.";
      setErrorMensaje(mensaje);
    }
  }, [estado, limpiarStream]);

  const detenerYObtener = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        limpiarStream();
        setEstado("inactivo");
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: mimeType }) : null;
        chunksRef.current = [];
        limpiarStream();
        setEstado("inactivo");
        resolve(blob);
      };
      recorder.stop();
    });
  }, [limpiarStream]);

  const cancelar = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Sin onstop propio: dejamos que el listener de detenerYObtener (si
      // había uno pendiente) no dispare nada raro simplemente vaciando los
      // chunks antes de parar.
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    limpiarStream();
    setEstado("inactivo");
    setDuracionSegundos(0);
  }, [limpiarStream]);

  return { estado, duracionSegundos, errorMensaje, iniciar, detenerYObtener, cancelar };
}

/** Formatea segundos como "m:ss" para mostrar la duración en vivo. */
export function formatearDuracion(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

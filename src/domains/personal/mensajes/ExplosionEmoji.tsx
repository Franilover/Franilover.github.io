"use client";

import { AnimatePresence } from "framer-motion";
import React, { useMemo } from "react";

import { MotionSpan } from "@/ui/Motion";

/**
 * ExplosionEmoji
 * ─────────────────────────────────────────────────────────────────────────
 * El efecto estilo Instagram de mantener presionado un emoji del picker de
 * reacciones rápidas: una lluvia de ~14 copias de ese emoji que suben desde
 * abajo con distinto tamaño, ángulo y velocidad, y se desvanecen arriba.
 * Puramente visual — no es una reacción real (para eso ver
 * handleToggleReaccion/reaccionarAMensaje), solo un efecto de énfasis que
 * además se le manda al otro participante vía broadcast (ver
 * emitirExplosionEmoji en presenceEngine.ts).
 *
 * Cada partícula tiene su trayectoria calculada una sola vez con useMemo
 * (sembrada por `disparoId`) para que no se recalculen en cada re-render
 * mientras la animación corre.
 * ─────────────────────────────────────────────────────────────────────────
 */

interface ExplosionEmojiProps {
  emoji: string;
  /** Id único del disparo — cambiar esto es lo que hace que se dispare una
   *  nueva explosión (incluso si el emoji es el mismo que la anterior). */
  disparoId: string;
  /** Se llama cuando la animación de todas las partículas ya terminó, para
   *  que el llamador pueda desmontar el componente. */
  onTerminar: () => void;
}

const CANTIDAD_PARTICULAS = 14;
const DURACION_MS = 1100;

/** PRNG determinístico simple (mulberry32) sembrado por disparoId, para que
 *  las trayectorias sean estables entre renders de la misma explosión sin
 *  depender de Math.random() en el render. */
function crearRng(semilla: string) {
  let h = 0;
  for (let i = 0; i < semilla.length; i++) {
    h = (Math.imul(31, h) + semilla.charCodeAt(i)) | 0;
  }
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ExplosionEmoji({ emoji, disparoId, onTerminar }: ExplosionEmojiProps) {
  const particulas = useMemo(() => {
    const rng = crearRng(disparoId);
    return Array.from({ length: CANTIDAD_PARTICULAS }, (_, i) => {
      const anguloBase = -90 + (rng() - 0.5) * 140; // hacia arriba, con abanico
      const distancia = 60 + rng() * 90;
      const rad = (anguloBase * Math.PI) / 180;
      return {
        id: i,
        x: Math.cos(rad) * distancia,
        y: Math.sin(rad) * distancia,
        rotacion: (rng() - 0.5) * 60,
        escala: 0.7 + rng() * 0.9,
        retraso: rng() * 0.25,
        duracion: 0.7 + rng() * 0.5,
      };
    });
  }, [disparoId]);

  React.useEffect(() => {
    const t = setTimeout(onTerminar, DURACION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disparoId]);

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible"
      style={{ zIndex: 30 }}
      aria-hidden
    >
      <AnimatePresence>
        {particulas.map((p) => (
          <MotionSpan
            key={`${disparoId}-${p.id}`}
            className="absolute text-xl select-none"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: p.x,
              y: p.y,
              scale: p.escala,
              rotate: p.rotacion,
            }}
            transition={{
              duration: p.duracion,
              delay: p.retraso,
              ease: "easeOut",
              opacity: { duration: p.duracion, delay: p.retraso, times: [0, 0.15, 0.7, 1] },
            }}
          >
            {emoji}
          </MotionSpan>
        ))}
      </AnimatePresence>
    </div>
  );
}

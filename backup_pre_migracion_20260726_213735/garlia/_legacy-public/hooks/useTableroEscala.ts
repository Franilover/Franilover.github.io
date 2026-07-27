import { useCallback, useEffect, useState } from "react";

/**
 * Preferencia local de tamaño de tarjetas del tablero de aventura.
 * Vive en localStorage, por aventura y por navegador — cada persona (DM o
 * jugador) ajusta su propia vista sin afectar a nadie más. No se sincroniza
 * por Supabase a propósito: es una preferencia de visualización, no un dato
 * de la aventura.
 */
export const CARD_SCALE_MIN = 0.6;
export const CARD_SCALE_MAX = 1.8;
const CARD_SCALE_KEY_PREFIX = "aventura-tablero-escala:";

export function useTableroEscala(aventuraId: string) {
  const storageKey = `${CARD_SCALE_KEY_PREFIX}${aventuraId}`;
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const guardada = window.localStorage.getItem(storageKey);
    const valor = guardada ? Number(guardada) : 1;
    setEscala(Number.isFinite(valor) ? Math.min(CARD_SCALE_MAX, Math.max(CARD_SCALE_MIN, valor)) : 1);
  }, [storageKey]);

  const actualizar = useCallback(
    (nuevaEscala: number) => {
      const clamped = Math.min(CARD_SCALE_MAX, Math.max(CARD_SCALE_MIN, nuevaEscala));
      setEscala(clamped);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, String(clamped));
      }
    },
    [storageKey],
  );

  return { escala, actualizar };
}

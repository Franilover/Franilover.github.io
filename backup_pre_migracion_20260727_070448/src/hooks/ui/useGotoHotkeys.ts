"use client";

import { useEffect, useRef } from "react";

/**
 * useGotoHotkeys — atajos estilo Gmail/Linear/Notion: presionar "g" y luego
 * una secuencia de letras ejecuta una acción (típicamente, navegar y/o
 * cambiar de sección sin recargar). Soporta secuencias de cualquier largo,
 * ej. "g" "g" "h" → Garlia → Inicio, "g" "d" "l" → Escritorio → Libros.
 *
 * Por qué "g + letras" y no un modificador (Ctrl+Alt+dígito, etc.):
 * Ctrl+Alt es el atajo de AltGr en varios layouts de teclado (incluido
 * español), así que el sistema operativo o el navegador a menudo se comen el
 * evento antes de que la app lo vea — es un atajo que "a veces no funciona"
 * de forma impredecible según el SO/layout del usuario. "g + letras" no
 * choca con ningún atajo de navegador/SO conocido y es el patrón que usan
 * Gmail, Linear, GitHub y Notion para exactamente este caso de uso.
 *
 * Seguridad ante inputs: como no hay modificador, cualquier letra suelta
 * podría interceptar texto que el usuario esté escribiendo. Por eso el hook
 * IGNORA el evento por completo si el foco actual está en un campo editable
 * (input, textarea, [contenteditable] — esto cubre el editor Lexical de
 * notas). Además, la secuencia debe completarse dentro de una ventana corta
 * tras la primera "g": no hay timeout abierto indefinidamente, así que
 * escribir "genial" en un campo no editable en un instante de descuido no
 * dispara nada raro salvo que la secuencia completa coincida con un atajo
 * real dentro de la ventana de tiempo.
 *
 * Uso:
 * ```tsx
 * useGotoHotkeys({
 *   gh: () => router.push("/myself/garlia"), // secuencia completa: "g" "h"
 *   gl: () => selectGarliaSection("capitulos"), // secuencia completa: "g" "l"
 * });
 * ```
 * Nota: las claves del mapa de `actions` SÍ incluyen la "g" inicial —
 * representan la secuencia completa de teclas tal cual se presionan. Una
 * clave `"ggh"` corresponde a presionar "g" → "g" → "h" en total.
 */

type GotoActions = Record<string, () => void>;

interface UseGotoHotkeysOptions {
  /** Si es false, no registra el listener. Default true (atajo global). */
  enabled?: boolean;
  /** Ventana en ms entre cada tecla de la secuencia. Default 900ms. */
  windowMs?: number;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useGotoHotkeys(
  actions: GotoActions,
  options: UseGotoHotkeysOptions = {},
) {
  const { enabled = true, windowMs = 900 } = options;

  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Longitud máxima de secuencia registrada (las claves ya incluyen la "g"
  // inicial, así que comparamos directo contra el largo del buffer).
  const maxLenRef = useRef(1);
  maxLenRef.current = Object.keys(actions).reduce(
    (max, k) => Math.max(max, k.length),
    1,
  );

  // Buffer de teclas de la secuencia actual (incluye la "g" que la armó).
  const bufferRef = useRef("");
  const armedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const disarm = () => {
      armedRef.current = false;
      bufferRef.current = "";
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const restartTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(disarm, windowMs);
    };

    const handler = (e: KeyboardEvent) => {
      // Nunca interceptar mientras el usuario escribe en un campo real
      // (inputs, textareas, o el contentEditable del editor de notas).
      if (isEditableTarget(e.target)) {
        disarm();
        return;
      }

      // Con cualquier modificador presionado no es este atajo (evita
      // interferir con Ctrl+G, Cmd+G "buscar siguiente", etc.).
      if (e.ctrlKey || e.metaKey || e.altKey) {
        disarm();
        return;
      }

      const key = e.key.toLowerCase();

      if (!armedRef.current) {
        if (key === "g") {
          armedRef.current = true;
          bufferRef.current = "g";
          restartTimer();
        }
        return;
      }

      // Ya armado: cada tecla se suma al buffer.
      const candidate = bufferRef.current + key;

      const exactAction = actionsRef.current[candidate];
      if (exactAction) {
        disarm();
        e.preventDefault();
        e.stopPropagation();
        exactAction();
        return;
      }

      // ¿Hay alguna acción que empiece con este prefijo? Si no, cortamos —
      // no tiene sentido seguir esperando teclas que no llevan a nada.
      const hasPrefixMatch = Object.keys(actionsRef.current).some((k) =>
        k.startsWith(candidate),
      );
      if (!hasPrefixMatch || candidate.length >= maxLenRef.current) {
        disarm();
        return;
      }

      bufferRef.current = candidate;
      restartTimer();
    };

    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      disarm();
    };
  }, [enabled, windowMs]);
}

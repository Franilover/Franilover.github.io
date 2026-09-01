"use client";

/**
 * useMensajesStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Estado global (Zustand + persist en localStorage) del módulo de Mensajes.
 * Mismo patrón que useFavoritosStore / useMundoNavigationStore: sin tabla
 * nueva en Supabase, todo vive en el navegador.
 *
 * Qué guarda y por qué:
 *
 * 1. `conversaciones` — snapshot de la última lista de conversaciones que
 *    trajimos de Supabase (ver listarConversaciones en chatEngine.ts). Al
 *    entrar a /personal/mensajes, ListaConversaciones puede pintar esto de
 *    entrada (sync, sin esperar ni siquiera a Dexie) y disparar el fetch
 *    real en paralelo — mismo principio cache-first que ya usan los
 *    mensajes con mensajes_cache, pero un escalón más rápido porque
 *    localStorage se lee sincrónicamente al montar, sin ida y vuelta a
 *    IndexedDB.
 *
 * 2. `borradores` — texto no enviado por conversación (id → texto). Si el
 *    usuario escribe algo, cambia de chat sin mandarlo y vuelve después
 *    (o cierra la pestaña), el texto sigue ahí — igual que WhatsApp Web.
 *
 * 3. `ultimaPosicion` — por conversación: el id del último mensaje que se
 *    alcanzó a ver y el scrollTop relativo (0-1, proporción del scrollHeight)
 *    al salir. Se usa como pista para reposicionar el scroll si se vuelve a
 *    esa conversación con historial cargado desde caché, evitando el salto
 *    "aparece arriba y hay que esperar a que baje" en chats largos.
 *
 * No hay TTL: es un espejo del último estado conocido, siempre se revalida
 * contra la fuente real (Supabase/Dexie) apenas hay red.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ConversacionResumen } from "@/infra/call/chatEngine";

interface UltimaPosicion {
  ultimoMensajeId: string;
  scrollProporcion: number;
  actualizadoAt: number;
}

interface MensajesState {
  // ── Conversaciones (hidratación instantánea de la sidebar) ──────────────
  conversaciones: ConversacionResumen[];
  conversacionesActualizadoAt: number | null;
  setConversaciones: (conversaciones: ConversacionResumen[]) => void;

  // ── Borradores no enviados, por conversación ─────────────────────────────
  borradores: Record<string, string>;
  setBorrador: (conversacionId: string, texto: string) => void;
  limpiarBorrador: (conversacionId: string) => void;

  // ── Última posición de lectura/scroll, por conversación ─────────────────
  ultimaPosicion: Record<string, UltimaPosicion>;
  guardarPosicion: (conversacionId: string, p: Omit<UltimaPosicion, "actualizadoAt">) => void;
}

export const useMensajesStore = create<MensajesState>()(
  persist(
    (set) => ({
      conversaciones: [],
      conversacionesActualizadoAt: null,
      setConversaciones: (conversaciones) =>
        set({ conversaciones, conversacionesActualizadoAt: Date.now() }),

      borradores: {},
      setBorrador: (conversacionId, texto) =>
        set((state) => {
          // Sin ensuciar el store con entradas vacías: si el borrador quedó
          // en blanco (se borró todo o se envió), directamente la sacamos
          // en vez de guardar "".
          if (!texto) {
            if (!(conversacionId in state.borradores)) return state;
            const { [conversacionId]: _omit, ...resto } = state.borradores;
            return { borradores: resto };
          }
          return { borradores: { ...state.borradores, [conversacionId]: texto } };
        }),
      limpiarBorrador: (conversacionId) =>
        set((state) => {
          if (!(conversacionId in state.borradores)) return state;
          const { [conversacionId]: _omit, ...resto } = state.borradores;
          return { borradores: resto };
        }),

      ultimaPosicion: {},
      guardarPosicion: (conversacionId, p) =>
        set((state) => ({
          ultimaPosicion: {
            ...state.ultimaPosicion,
            [conversacionId]: { ...p, actualizadoAt: Date.now() },
          },
        })),
    }),
    {
      name: "mensajes:store:v1",
      // Cota simple para que borradores/posiciones de conversaciones muy
      // viejas no crezcan indefinidamente en localStorage: al hidratar,
      // se podan entradas de más de 30 días sin actividad.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const LIMITE_MS = 30 * 24 * 60 * 60 * 1000;
        const ahora = Date.now();
        const posicionesVivas = Object.fromEntries(
          Object.entries(state.ultimaPosicion).filter(
            ([, v]) => ahora - v.actualizadoAt < LIMITE_MS,
          ),
        );
        if (Object.keys(posicionesVivas).length !== Object.keys(state.ultimaPosicion).length) {
          state.ultimaPosicion = posicionesVivas;
        }
      },
    },
  ),
);

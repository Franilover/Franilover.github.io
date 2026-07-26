/**
 * useLlamadaStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Estado global (zustand, sin persistencia) de la llamada en curso o entrante.
 * Vive fuera de React para que cualquier pantalla pueda iniciar/recibir una
 * llamada sin prop-drilling; el componente <LlamadaGlobal /> en el layout raíz
 * es el único que lo renderiza.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { create } from "zustand";

export type EstadoLlamada = "inactiva" | "llamando" | "entrante" | "conectada";

interface OtroParticipante {
  id: string;
  nombre: string | null;
  avatar: string | null;
}

interface LlamadaState {
  estado: EstadoLlamada;
  conversacionId: string | null;
  llamadaId: string | null;
  roomName: string | null;
  otro: OtroParticipante | null;

  iniciarLlamando: (p: {
    conversacionId: string;
    llamadaId: string;
    roomName: string;
    otro: OtroParticipante;
  }) => void;
  recibirEntrante: (p: {
    conversacionId: string;
    llamadaId: string;
    roomName: string;
    otro: OtroParticipante;
  }) => void;
  marcarConectada: () => void;
  finalizar: () => void;
}

export const useLlamadaStore = create<LlamadaState>((set) => ({
  estado: "inactiva",
  conversacionId: null,
  llamadaId: null,
  roomName: null,
  otro: null,

  iniciarLlamando: ({ conversacionId, llamadaId, roomName, otro }) =>
    set({ estado: "llamando", conversacionId, llamadaId, roomName, otro }),

  recibirEntrante: ({ conversacionId, llamadaId, roomName, otro }) =>
    set({ estado: "entrante", conversacionId, llamadaId, roomName, otro }),

  marcarConectada: () => set({ estado: "conectada" }),

  finalizar: () =>
    set({ estado: "inactiva", conversacionId: null, llamadaId: null, roomName: null, otro: null }),
}));

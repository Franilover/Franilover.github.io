"use client";
import { create } from "zustand";

interface CommandPaletteStore {
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggle: () => void;
}

export const useCommandPalette = create<CommandPaletteStore>((set) => ({
  open: false,
  setOpen: (open) =>
    set((s) => ({
      open: typeof open === "function" ? open(s.open) : open,
    })),
  toggle: () => set((s) => ({ open: !s.open })),
}));
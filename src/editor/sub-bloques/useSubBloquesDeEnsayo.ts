"use client";
/**
 * useSubBloquesDeEnsayo.ts
 * ─────────────────────────
 * Extrae el estado + handlers de sub-bloques que ya vivían inline dentro
 * de EditorEnsayo.tsx, para poder reusarlos en cualquier lugar que edite
 * un ensayo con RichEditor SIN arrastrar todo el shell de EditorEnsayo
 * (toolbar, TOC, layout boxes, citas, panel de libro, etc.) — pensado
 * para los bloques de ensayo "fijos" fuera de /myself/notas, como
 * BloqueEnsayoEnergias / BloqueEnsayoRunas en RunasPage.tsx, que hasta
 * ahora conectaban RichEditor directo a `ensayo.contenido` y por eso no
 * tenían el selector de sub-bloques que sí existe en el editor de notas.
 *
 * onUpdateField es el mismo `actualizarLocal` que devuelve
 * useEnsayoEditorLogic — ya trae su propio debounce (scheduleSave, 1.5s)
 * así que acá no hace falta uno propio: cada cambio llama directo a
 * onUpdateField(ensayo.id, "sub_bloques", bloques).
 */
import { useCallback, useEffect, useState } from "react";

import { makeSubBloque, parseSubBloques, type SubBloque } from "./types";

export interface UseSubBloquesDeEnsayoResult {
  subBloques: SubBloque[];
  activeBloqueId: string | null;
  setActiveBloqueId: (id: string | null) => void;
  activeSubBloque: SubBloque | null;
  handleCreateSubBloque: (nombre?: string) => void;
  handleRenameSubBloque: (id: string, nombre: string) => void;
  handleDeleteSubBloque: (id: string) => void;
  handleSubBloqueContenidoChange: (id: string, value: string) => void;
}

export function useSubBloquesDeEnsayo(
  ensayoId: string | undefined,
  ensayoSubBloquesRaw: unknown,
  onUpdateField: (id: string, field: string, value: any, extra?: any) => void,
): UseSubBloquesDeEnsayoResult {
  const [subBloques, setSubBloques] = useState<SubBloque[]>(() =>
    parseSubBloques(ensayoSubBloquesRaw),
  );
  const [activeBloqueId, setActiveBloqueId] = useState<string | null>(null);

  // Si cambia el ensayo (id distinto), recargamos sus sub-bloques y
  // volvemos al documento principal — mismo comportamiento que el efecto
  // equivalente en EditorEnsayo.tsx al cambiar de ensayo.
  useEffect(() => {
    setSubBloques(parseSubBloques(ensayoSubBloquesRaw));
    setActiveBloqueId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensayoId]);

  const persist = useCallback(
    (bloques: SubBloque[]) => {
      if (!ensayoId) return;
      onUpdateField(ensayoId, "sub_bloques", bloques);
    },
    [ensayoId, onUpdateField],
  );

  const handleCreateSubBloque = useCallback(
    (nombre?: string) => {
      setSubBloques((prev) => {
        const nuevo = makeSubBloque(prev, nombre);
        const next = [...prev, nuevo];
        persist(next);
        setActiveBloqueId(nuevo.id);
        return next;
      });
    },
    [persist],
  );

  const handleRenameSubBloque = useCallback(
    (id: string, nombre: string) => {
      setSubBloques((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, nombre } : b));
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleDeleteSubBloque = useCallback(
    (id: string) => {
      setSubBloques((prev) => {
        const next = prev.filter((b) => b.id !== id);
        persist(next);
        return next;
      });
      setActiveBloqueId((prev) => (prev === id ? null : prev));
    },
    [persist],
  );

  const handleSubBloqueContenidoChange = useCallback(
    (id: string, value: string) => {
      setSubBloques((prev) => {
        const next = prev.map((b) =>
          b.id === id ? { ...b, contenido: value } : b,
        );
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const activeSubBloque =
    subBloques.find((b) => b.id === activeBloqueId) || null;

  return {
    subBloques,
    activeBloqueId,
    setActiveBloqueId,
    activeSubBloque,
    handleCreateSubBloque,
    handleRenameSubBloque,
    handleDeleteSubBloque,
    handleSubBloqueContenidoChange,
  };
}

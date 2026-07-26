"use client";

/**
 * useEnsayoEditorLogic
 * ───────────────────────────────────────────────────────────────────────────
 * Extraído de EnsayosShell.tsx para poder reusar el editor de un ensayo
 * puntual (<Editor /> de components/notas/EditorEnsayo.tsx) fuera del shell
 * completo de Ensayos — puntualmente, para abrir ensayos con tag "GOS" desde
 * dentro del editor de Garlia (/myself/garlia) sin duplicar la lógica de
 * guardado/wikilinks/auto-creación de páginas por tag.
 *
 * Cubre SOLO lo que <Editor /> necesita para funcionar:
 *   - scheduleSave: guardado con debounce (1.5s) + timeout (10s) + indicador.
 *   - navigateToPage: click en [[wikilink]] o tag → busca ensayo por título,
 *     si no existe lo crea (cuando viene de un tag) o abre el modal de nueva
 *     nota (cuando viene de un wikilink normal).
 *   - actualizarLocal: onUpdateField que le pasamos a <Editor />; delega en
 *     scheduleSave y dispara auto-creación de páginas cuando cambian tags.
 *   - renameEnCascada: al renombrar el título de un ensayo, actualiza los
 *     [[wikilinks]] y tags que lo referenciaban en el resto de ensayos.
 *
 * NO cubre: navegación entre "home"/"libros", tareas/eventos/calendario,
 * command palette, ni el layout del shell — eso sigue siendo exclusivo de
 * EnsayosShell.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useSupabaseData } from "@/hooks/data/useSupabaseData";
import { useAuth } from "@/providers/AuthProvider";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseEnsayoEditorLogicResult {
  ensayos: any[];
  loading: boolean;
  ensayoActivo: any | null;
  setEnsayoActivoId: (id: string | null) => void;
  saveStatus: SaveStatus;
  actualizarLocal: (id: string, field: string, value: any, extra?: any) => void;
  navigateToPage: (name: string, isTag?: boolean) => Promise<void>;
  pendingNoteTitle: string | null;
  showNewNoteModal: boolean;
  setShowNewNoteModal: (v: boolean) => void;
  crearNotaPendiente: (titulo: string, tags?: string[]) => Promise<string | null>;
}

export function useEnsayoEditorLogic(initialId: string | null): UseEnsayoEditorLogicResult {
  const { user } = useAuth() as { user: any };
  const {
    data: ensayosRaw,
    setData: setEnsayos,
    loading,
    addRow,
    updateRow,
  } = useSupabaseData("ensayos", { order: { campo: "updated_at", asc: false } });
  const ensayos = ensayosRaw ?? [];

  const [ensayoActivoId, setEnsayoActivoId] = useState<string | null>(initialId);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [pendingNoteTitle, setPendingNoteTitle] = useState<string | null>(null);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);

  const pendingUpdatesRef = useRef<Record<string, Record<string, any>>>({});
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      Object.values(saveTimerRef.current).forEach(clearTimeout);
      saveTimerRef.current = {};
    };
  }, []);

  const ensayoActivo = ensayoActivoId ? ensayos.find((e: any) => e.id === ensayoActivoId) ?? null : null;

  const scheduleSave = useCallback(
    (id: string, updates: Record<string, any>) => {
      pendingUpdatesRef.current[id] = { ...(pendingUpdatesRef.current[id] || {}), ...updates };
      if (saveTimerRef.current[id]) clearTimeout(saveTimerRef.current[id]);

      saveTimerRef.current[id] = setTimeout(async () => {
        if (!isMountedRef.current) return;

        const batch = { ...(pendingUpdatesRef.current[id] || {}) };
        delete pendingUpdatesRef.current[id];
        delete saveTimerRef.current[id];

        setSaveStatus("saving");
        const now = new Date().toISOString();
        const payload = { ...batch, updated_at: now };

        setEnsayos((prev: any[]) => prev.map((e: any) => (e.id === id ? { ...e, ...payload } : e)));

        try {
          const savePromise = updateRow(id, payload);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("save timeout")), 10_000),
          );
          const { error } = (await Promise.race([savePromise, timeoutPromise])) as any;
          if (error) throw error;
          if (!isMountedRef.current) return;
          setSaveStatus("saved");
          setTimeout(() => {
            if (isMountedRef.current) setSaveStatus("idle");
          }, 2000);
        } catch (err: any) {
          if (!isMountedRef.current) return;
          setSaveStatus("error");
          setTimeout(() => {
            if (isMountedRef.current) setSaveStatus("idle");
          }, 4000);
          console.warn("[useEnsayoEditorLogic] error al guardar:", err?.message ?? err);
        }
      }, 1500);
    },
    [updateRow, setEnsayos],
  );

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const autoCreateTagPage = useCallback(
    async (tag: string): Promise<string | null> => {
      if (!user) return null;
      const now = new Date().toISOString();

      const existing = ensayos.find((e: any) => e.titulo?.toLowerCase() === tag.toLowerCase());
      if (existing) return existing.id;

      const { data, error } = await addRow({
        titulo: capitalize(tag),
        user_id: user.id,
        contenido: `# ${capitalize(tag)}\n`,
        tags: [tag],
        updated_at: now,
      });
      if (!error && data) {
        setEnsayos((prev: any[]) => {
          if (prev.find((e: any) => e.id === data.id)) return prev;
          return [data, ...prev];
        });
        return data.id;
      }
      return null;
    },
    [user, ensayos, addRow, setEnsayos],
  );

  const navigateToPage = useCallback(
    async (name: string, isTag = false) => {
      const normalized = name.trim().toLowerCase();
      const found = ensayos.find((e: any) => e.titulo?.toLowerCase() === normalized);
      if (found) {
        setEnsayoActivoId(found.id);
      } else if (isTag) {
        const newId = await autoCreateTagPage(name.trim());
        if (newId) setEnsayoActivoId(newId);
      } else {
        setPendingNoteTitle(name.trim());
        setShowNewNoteModal(true);
      }
    },
    [ensayos, autoCreateTagPage],
  );

  const autoCreateMissingTagPages = useCallback(
    async (tags: string[]) => {
      for (const tag of tags) {
        const exists = ensayos.some((e: any) => e.titulo?.toLowerCase() === tag.toLowerCase());
        if (!exists) await autoCreateTagPage(tag);
      }
    },
    [ensayos, autoCreateTagPage],
  );

  const renameEnCascada = useCallback(
    (oldTitulo: string, newTitulo: string) => {
      const oldLower = oldTitulo.toLowerCase();
      ensayos.forEach((e: any) => {
        let changed = false;
        const updates: Record<string, any> = {};

        if (e.contenido) {
          const escaped = oldTitulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(`\\[\\[${escaped}\\]\\]`, "gi");
          const newContenido = e.contenido.replace(regex, `[[${newTitulo}]]`);
          if (newContenido !== e.contenido) {
            updates.contenido = newContenido;
            changed = true;
          }
        }

        if (e.tags?.some((t: string) => t.toLowerCase() === oldLower)) {
          updates.tags = e.tags.map((t: string) => (t.toLowerCase() === oldLower ? newTitulo.toLowerCase() : t));
          changed = true;
        }

        if (changed) {
          scheduleSave(e.id, updates);
          setEnsayos((prev: any[]) => prev.map((p: any) => (p.id === e.id ? { ...p, ...updates } : p)));
        }
      });
    },
    [ensayos, scheduleSave, setEnsayos],
  );

  const actualizarLocal = useCallback(
    (id: string, field: string, value: any, extra?: any) => {
      if (field === "titulo:rename") {
        const oldTitulo = (extra as string)?.trim();
        const newTitulo = (value as string).trim();
        if (oldTitulo && oldTitulo !== newTitulo) renameEnCascada(oldTitulo, newTitulo);
        return;
      }

      scheduleSave(id, { [field]: value });

      if (field === "tags" && Array.isArray(value)) {
        void autoCreateMissingTagPages(value);
      }
    },
    [scheduleSave, autoCreateMissingTagPages, renameEnCascada],
  );

  const crearNotaPendiente = useCallback(
    async (titulo: string, tags: string[] = []): Promise<string | null> => {
      if (!user) return null;
      const now = new Date().toISOString();
      const { data, error } = await addRow({
        titulo,
        user_id: user.id,
        contenido: `# ${titulo}\n`,
        tags,
        updated_at: now,
      });
      if (!error && data) {
        setEnsayos((prev: any[]) => [data, ...prev]);
        setShowNewNoteModal(false);
        setPendingNoteTitle(null);
        return data.id;
      }
      return null;
    },
    [user, addRow, setEnsayos],
  );

  return {
    ensayos,
    loading,
    ensayoActivo,
    setEnsayoActivoId,
    saveStatus,
    actualizarLocal,
    navigateToPage,
    pendingNoteTitle,
    showNewNoteModal,
    setShowNewNoteModal,
    crearNotaPendiente,
  };
}

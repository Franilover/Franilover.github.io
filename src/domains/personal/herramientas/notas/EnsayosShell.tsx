"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, PenTool, Search, X, Plus, FileText, Trash2, List, BookOpen, Hash } from "lucide-react";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

import { AdminOnly } from "@/ui/AdminOnly";
import { useConfirm } from "@/ui/ConfirmModal";
import { ToastContainer } from "@/ui/ToastContainer";
import Editor from "@/editor/notas/components/EditorEnsayo";
import { GrafoEnsayos } from "@/editor/notas/components/GrafoEnsayos";
import NewNoteModal from "@/editor/notas/components/newNoteModal";
import ArmarioPage from "@/domains/personal/herramientas/ropa/ropa";
import RecetasPage from "@/domains/personal/herramientas/cocina/recetas";
import { IngredientesPage } from "@/domains/personal/herramientas/cocina/ingredientes";
import { PaginaEjercicios } from "@/domains/personal/herramientas/ejercicios/ejerciciosComponent";
import { HomeDashboard } from "@/domains/personal/herramientas/notas/HomeDashboard";
import { LibrosDashboard } from "@/domains/personal/herramientas/notas/LibrosDashboard";
import { useEscritorioNavigation } from "@/editor/notas/hooks/useEscritorioNavigationStore";
import { useZotero } from "@/editor/notas/hooks/useZotero";

import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { useToast } from "@/hooks/ui/useToast";
import { eventosQueries } from "@/lib/api/queries/personal/eventos";
import { useAuth } from "@/providers/AuthProvider";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function setSaveIndicator(el: HTMLElement | null, status: SaveStatus) {
  if (!el) return;
  if (status === "idle") { el.style.opacity = "0"; return; }
  el.style.opacity = "1";
  el.textContent =
    status === "saving" ? "guardando…" :
    status === "saved"  ? "✓ guardado" : "error";
  el.style.color =
    status === "saving" ? "color-mix(in srgb, var(--foreground) 20%, transparent)" :
    status === "saved"  ? "color-mix(in srgb, var(--accent) 70%, transparent)" :
                          "color-mix(in srgb, var(--primary) 70%, transparent)";
}

const LS_ACTIVE = "ensayos-active-id";
const LS_HOME   = "ensayos-at-home";

function EnsayosInner() {
  const { user } = useAuth() as { user: any };
  const { toasts, dismiss } = useToast();
  const { confirm, ConfirmModal }  = useConfirm();

  const escritorioSection = useEscritorioNavigation((s) => s.section);
  const selectEscritorioSection = useEscritorioNavigation((s) => s.selectSection);

  const irAlHome = () => {
    setEnsayoActivoId(null);
    setTagActivo(null);
    setTocOpen(false);
    setTocEntries([]);
    selectEscritorioSection("inicio");
    localStorage.setItem(LS_HOME, "1");
  };

  const irALibros = () => {
    setEnsayoActivoId(null);
    setTagActivo(null);
    setTocOpen(false);
    setTocEntries([]);
    selectEscritorioSection("libros");
    localStorage.setItem(LS_HOME, "1");
  };
  const [editMode,          setEditMode]          = useState(true);
  const [tocOpen,           setTocOpen]           = useState(false);
  const [tocEntries,        setTocEntries]        = useState<{ level: number; text: string; id: string }[]>([]);
  const [searchPanelOpen,   setSearchPanelOpen]   = useState(false);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const [showNewNoteModal,  setShowNewNoteModal]  = useState(false);

  const { sources } = useZotero();
  const [tagActivo,         setTagActivo]         = useState<string | null>(null);

  // For pre-filling the new note modal title (used when creating tag-pages)
  const [pendingNoteTitle,  setPendingNoteTitle]  = useState<string | null>(null);

  const {
    data: tareas,
    setData: setTareas,
    addRow: addTareaRow,
    updateRow: updateTareaRow,
  } = useSupabaseData("tareas", { order: { campo: "created_at", asc: false } });

  const { data: eventos, setData: setEventos } = useSupabaseData<any>("eventos");
  const { data: capitulosRaw } = useSupabaseData<any>("capitulos", {
    select: "id, titulo_capitulo, fecha_publicacion, libro_id",
  });
  const { data: horarioRaw } = useSupabaseData<any>("horario");
  const [isAddingEvento, setIsAddingEvento] = useState(false);

  const {
    data:     ensayos,
    setData:  setEnsayos,
    loading,
    isOffline: _isOffline,
    addRow,
    updateRow,
    deleteRow,
  } = useSupabaseData("ensayos", { order: { campo: "updated_at", asc: false } });

  const handleTagClick = useCallback((tag: string | null) => setTagActivo(tag), []);

  const [ensayoActivoId, setEnsayoActivoId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (localStorage.getItem(LS_HOME) === "1") return null;
    return localStorage.getItem(LS_ACTIVE);
  });

  const [searchTerm, setSearchTerm] = useState("");

  const pendingUpdatesRef  = useRef<Record<string, Record<string, any>>>({});
  const saveTimerRef       = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveIndicatorRef   = useRef<HTMLSpanElement | null>(null);

  // ── FIX: guard para no tocar el DOM después de desmontar ──────────────────
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Limpiar TODOS los timers de guardado pendientes al desmontar
      Object.values(saveTimerRef.current).forEach(clearTimeout);
      saveTimerRef.current = {};
    };
  }, []);

  // ── Escuchar evento del CommandPalette para abrir ensayo desde cualquier página ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      setEnsayoActivoId(id);
      localStorage.setItem(LS_ACTIVE, id);
      localStorage.removeItem(LS_HOME);
    };
    window.addEventListener("ensayos-open", handler);
    return () => window.removeEventListener("ensayos-open", handler);
  }, []);

  // ── Escuchar evento del CommandPalette para crear un ensayo (nota) en blanco ──
  useEffect(() => {
    const handler = () => {
      setPendingNoteTitle(null);
      setShowNewNoteModal(true);
    };
    window.addEventListener("ensayos-new-nota", handler);
    return () => window.removeEventListener("ensayos-new-nota", handler);
  }, []);

  // ── Escuchar evento del CommandPalette para crear un libro (tag "libro") ──
  useEffect(() => {
    const handler = () => { void crearLibro(); };
    window.addEventListener("ensayos-new-libro", handler);
    return () => window.removeEventListener("ensayos-new-libro", handler);
  }, []);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const setEnsayoActivo = useCallback((id: string | null) => {
    setEnsayoActivoId(id);
    setTocOpen(false);
    setTocEntries([]);
    if (id) {
      localStorage.setItem(LS_ACTIVE, id);
      localStorage.removeItem(LS_HOME);
      // Abrir una nota nos saca de cualquier sección (cocina/ropa/etc.)
      // para volver a mostrar el editor.
      selectEscritorioSection("inicio");
    } else {
      localStorage.removeItem(LS_ACTIVE);
      localStorage.setItem(LS_HOME, "1");
    }
  }, [selectEscritorioSection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchPanelRef.current && !searchPanelRef.current.contains(e.target as Node)) {
        setSearchPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const todosLosTags = useMemo(() => {
    const set = new Set<string>();
    ensayos.forEach((e: any) => e.tags?.forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [ensayos]);

  const _allWikilinkNames = useMemo(() => {
    const seen = new Set<string>();
    const result: { name: string; type: string }[] = [];

    todosLosTags.forEach(tag => {
      if (!seen.has(tag)) {
        seen.add(tag);
        result.push({ name: tag, type: "tag" });
      }
    });

    ensayos.forEach((e: any) => {
      const titulo = e.titulo?.trim();
      if (!titulo || seen.has(titulo)) return;
      seen.add(titulo);
      const tipo = e.tags?.[0] ?? "nota";
      result.push({ name: titulo, type: tipo });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [ensayos, todosLosTags]);

  const ensayosFiltrados = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return ensayos
      .filter((e: any) => {
        const cumpleTag      = tagActivo ? e.tags?.includes(tagActivo) : true;
        const cumpleBusqueda = !q
          || e.titulo?.toLowerCase().includes(q)
          || e.contenido?.toLowerCase().includes(q);
        return cumpleTag && cumpleBusqueda;
      })
      .sort((a: any, b: any) => {
        if (!q) return 0; // sin búsqueda: mantener orden original (updated_at)
        const aTitulo = a.titulo?.toLowerCase().includes(q);
        const bTitulo = b.titulo?.toLowerCase().includes(q);
        if (aTitulo && !bTitulo) return -1; // a sube
        if (!aTitulo && bTitulo) return 1;  // b sube
        return 0; // empate: mantener orden relativo
      });
  }, [ensayos, tagActivo, searchTerm]);

  // ─── Guardado ──────────────────────────────────────────────────────────────

  const scheduleSave = useCallback((id: string, updates: Record<string, any>) => {
    pendingUpdatesRef.current[id] = {
      ...(pendingUpdatesRef.current[id] || {}),
      ...updates,
    };

    if (saveTimerRef.current[id]) clearTimeout(saveTimerRef.current[id]);

    saveTimerRef.current[id] = setTimeout(async () => {
      // ── FIX 1: si el componente se desmontó, no hacer nada ────────────────
      if (!isMountedRef.current) return;

      const batch = { ...(pendingUpdatesRef.current[id] || {}) };
      delete pendingUpdatesRef.current[id];
      delete saveTimerRef.current[id];

      setSaveIndicator(saveIndicatorRef.current, "saving");

      const now     = new Date().toISOString();
      const payload = { ...batch, updated_at: now };

      setEnsayos((prev: any[]) =>
        prev.map((e: any) => e.id === id ? { ...e, ...payload } : e)
      );

      try {
        // ── FIX 2: timeout propio de 10s para que nunca quede colgado ────────
        const savePromise = updateRow(id, payload);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("save timeout")), 10_000)
        );

        const { error } = await Promise.race([savePromise, timeoutPromise]) as any;
        if (error) throw error;

        // ── FIX 3: guard post-await por si el usuario navegó mientras guardaba
        if (!isMountedRef.current) return;

        setSaveIndicator(saveIndicatorRef.current, "saved");
        setTimeout(() => {
          if (isMountedRef.current) setSaveIndicator(saveIndicatorRef.current, "idle");
        }, 2000);

      } catch (err: any) {
        if (!isMountedRef.current) return;

        setSaveIndicator(saveIndicatorRef.current, "error");

        // ── FIX 4: auto-limpiar el error para no quedar atascado en "error" ──
        setTimeout(() => {
          if (isMountedRef.current) setSaveIndicator(saveIndicatorRef.current, "idle");
        }, 4000);

        console.warn("[scheduleSave] error al guardar:", err?.message ?? err);
      }
    }, 1500);
  }, [updateRow, setEnsayos]);


  // ─── Tag-as-page navigation ────────────────────────────────────────────────

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const autoCreateTagPage = useCallback(async (tag: string): Promise<string | null> => {
    if (!user) return null;
    const now = new Date().toISOString();

    const existing = ensayos.find(
      (e: any) => e.titulo?.toLowerCase() === tag.toLowerCase()
    );
    if (existing) return existing.id;

    const { data, error } = await addRow({
      titulo:     capitalize(tag),
      user_id:    user.id,
      contenido:  `# ${capitalize(tag)}\n`,
      tags:       [tag],
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
  }, [user, ensayos, addRow, setEnsayos]);

  const navigateToPage = useCallback(async (name: string, isTag = false) => {
    const normalized = name.trim().toLowerCase();
    const found = ensayos.find(
      (e: any) => e.titulo?.toLowerCase() === normalized
    );
    if (found) {
      setEnsayoActivo(found.id);
    } else if (isTag) {
      const newId = await autoCreateTagPage(name.trim());
      if (newId) {
        setEnsayoActivo(newId);
      }
    } else {
      setPendingNoteTitle(name.trim());
      setShowNewNoteModal(true);
    }
  }, [ensayos, autoCreateTagPage]);

  const autoCreateMissingTagPages = useCallback(async (tags: string[]) => {
    for (const tag of tags) {
      const exists = ensayos.some((e: any) => e.titulo?.toLowerCase() === tag.toLowerCase());
      if (!exists) {
        await autoCreateTagPage(tag);
      }
    }
  }, [ensayos, autoCreateTagPage]);

  const _handleTagNavigate = useCallback((tag: string) => {
    void navigateToPage(tag, true);
  }, [navigateToPage]);

  const renameEnCascada = useCallback((oldTitulo: string, newTitulo: string) => {
    const oldLower = oldTitulo.toLowerCase();
    ensayos.forEach((e: any) => {
      let changed = false;
      const updates: Record<string, any> = {};

      // 1. Reemplazar [[viejo]] → [[nuevo]] en el contenido
      if (e.contenido) {
        const escaped = oldTitulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\[\\[${escaped}\\]\\]`, "gi");
        const newContenido = e.contenido.replace(regex, `[[${newTitulo}]]`);
        if (newContenido !== e.contenido) {
          updates.contenido = newContenido;
          changed = true;
        }
      }

      // 2. Reemplazar el valor en el array tags
      if (e.tags?.some((t: string) => t.toLowerCase() === oldLower)) {
        updates.tags = e.tags.map((t: string) =>
          t.toLowerCase() === oldLower ? newTitulo.toLowerCase() : t
        );
        changed = true;
      }

      if (changed) {
        scheduleSave(e.id, updates);
        setEnsayos((prev: any[]) =>
          prev.map((p: any) => p.id === e.id ? { ...p, ...updates } : p)
        );
      }
    });
  }, [ensayos, scheduleSave, setEnsayos]);

  const actualizarLocal = useCallback((id: string, field: string, value: any, extra?: any) => {
    // "titulo:rename" → solo guardamos el título nuevo; el rename en cascada
    // usa el valor original (extra) capturado en onFocus, no el estado intermedio
    if (field === "titulo:rename") {
      const oldTitulo = (extra as string)?.trim();
      const newTitulo = (value as string).trim();
      if (oldTitulo && oldTitulo !== newTitulo) {
        renameEnCascada(oldTitulo, newTitulo);
      }
      return; // el título ya fue guardado por el onChange normal
    }

    scheduleSave(id, { [field]: value });

    if (field === "tags" && Array.isArray(value)) {
      void autoCreateMissingTagPages(value);
    }
  }, [scheduleSave, autoCreateMissingTagPages, renameEnCascada]);


  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const crearEnsayo = async (titulo: string) => {
    if (!titulo.trim() || !user) return;
    const now = new Date().toISOString();

    const payload = {
      titulo:     capitalize(titulo.trim()),
      user_id:    user.id,
      contenido:  "",
      tags:       tagActivo ? [tagActivo] : [],
      updated_at: now,
    };

    const { data, error } = await addRow(payload);
    if (!error && data) {
      setEnsayos((prev: any[]) => {
        if (prev.find((e: any) => e.id === data.id)) return prev;
        return [data, ...prev];
      });
      setEnsayoActivo(data.id);
      setEditMode(true);
      setShowNewNoteModal(false);
      setPendingNoteTitle(null);
    }
  };

  // Crea un "libro" (ensayo con tag "libro") — usado tanto por el botón de
  // LibrosDashboard/HomeDashboard como por el comando "Nuevo libro (escritorio)"
  // del CommandPalette. No confundir con los libros de Garlia (tabla `libros`).
  const crearLibro = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const payload = {
      titulo:     "Nuevo libro",
      user_id:    user.id,
      contenido:  "",
      tags:       ["libro"],
      updated_at: now,
    };
    const { data, error } = await addRow(payload);
    if (!error && data) {
      setEnsayos((prev: any[]) => {
        if (prev.find((e: any) => e.id === data.id)) return prev;
        return [data, ...prev];
      });
      setEnsayoActivo(data.id);
      setEditMode(true);
    }
  };

  const eliminarEnsayo = async (id: string) => {
    const ok = await confirm({ message: "¿Eliminar esta nota?", danger: true, confirmLabel: "Eliminar" });
    if (!ok) return;

    if (saveTimerRef.current[id]) {
      clearTimeout(saveTimerRef.current[id]);
      delete saveTimerRef.current[id];
    }
    delete pendingUpdatesRef.current[id];

    await deleteRow(id);
    setEnsayos((prev: any[]) => prev.filter((e: any) => e.id !== id));
    if (ensayoActivoId === id) setEnsayoActivo(null);
  };

  // --- AÑADE ESTOS HANDLERS ---
  const handleAddTarea = async (titulo: string) => {
    if (!user) return;
    const { data, error } = await addTareaRow({
      titulo,
      user_id: user.id,
      completada: false,
      created_at: new Date().toISOString()
    });
    if (!error && data) {
      setTareas((prev: any[]) => [data, ...prev]);
    }
  };

  const handleToggleTarea = async (id: string, completada: boolean) => {
    const { error } = await updateTareaRow(id, { completada: !completada });
    if (!error) {
      setTareas((prev: any[]) => 
        prev.map(t => t.id === id ? { ...t, completada: !completada } : t)
      );
    }
  };

  const handleAddEvento = async (fechaISO: string, titulo: string, tipo: string) => {
    if (!titulo.trim() || isAddingEvento) return;
    setIsAddingEvento(true);
    try {
      const creado = await eventosQueries.add({ titulo, tipo, fecha: fechaISO });
      if (creado) setEventos((prev: any[]) => [...prev, creado]);
    } catch (err) { console.error(err); }
    finally { setIsAddingEvento(false); }
  };

  const handleUpdateEvento = async (id: string, datos: { titulo?: string; tipo?: string; fecha?: string }) => {
    try {
      const actualizado = await eventosQueries.update(id, datos);
      setEventos((prev: any[]) =>
        prev.map(e => e.id === id ? { ...e, ...(actualizado ?? datos) } : e)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvento = async (id: string) => {
    try {
      await eventosQueries.delete(id);
      setEventos((prev: any[]) => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnsayoClick = (id: string) => {
    setEnsayoActivo(id);
  };

  const handleEnsayoClickSinCerrar = useCallback((id: string) => {
    setEnsayoActivo(id);
  }, [setEnsayoActivo]);

  const ensayoActivo = ensayos.find((e: any) => e.id === ensayoActivoId) ?? null;



  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .ensayos-root {
          --sidebar-bg:   var(--bg-menu);
          --sidebar-text: color-mix(in srgb, var(--foreground) 60%, transparent);
          --editor-bg:    var(--bg-main);
          --editor-text:  var(--foreground);
        }
      `}</style>

      <div className="ensayos-root h-full flex flex-col" style={{ background: "var(--bg-main)" }}>

        {/* ── Barra superior ── */}
        <div
          className="shrink-0 z-20 px-4 flex items-center gap-3"
          style={{
            borderBottom: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
            background:   "color-mix(in srgb, var(--bg-menu) 60%, transparent)",
            backdropFilter: "blur(8px)",
            minHeight: 36,
          }}
        >
          {/* Grafo — izquierda */}
          {/* Grafo — izquierda */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Botón Home — solo icono */}
          <button
            style={{
              background: ensayoActivoId ? "transparent" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
              border: "1px solid",
              borderColor: ensayoActivoId ? "color-mix(in srgb, var(--foreground) 8%, transparent)" : "color-mix(in srgb, var(--foreground) 15%, transparent)",
              borderRadius: 5,
              padding: "3px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              transition: "all 0.12s",
            }}
            title="Volver al escritorio"
            onClick={irAlHome}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--foreground) 25%, transparent)";
              (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--foreground) 6%, transparent)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = ensayoActivoId ? "color-mix(in srgb, var(--foreground) 8%, transparent)" : "color-mix(in srgb, var(--foreground) 15%, transparent)";
              (e.currentTarget as HTMLElement).style.background = ensayoActivoId ? "transparent" : "color-mix(in srgb, var(--foreground) 6%, transparent)";
            }}
          >
            <PenTool size={9} style={{ color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }} />
          </button>

          {/* Grafo (solo cuando hay nota activa) */}
          {ensayoActivo && (
            <GrafoEnsayos
              ensayo={ensayoActivo}
              ensayos={ensayos}
              onSelectEnsayo={handleEnsayoClickSinCerrar}
            />
          )}

          {/* TOC (solo cuando hay nota activa con headings) */}
          {ensayoActivo && tocEntries.length > 0 && (
            <button
              style={{
                background: tocOpen ? "color-mix(in srgb, var(--color-primary,#7c6af7) 12%, transparent)" : "none",
                border: "1px solid",
                borderColor: tocOpen
                  ? "color-mix(in srgb, var(--color-primary,#7c6af7) 30%, transparent)"
                  : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                borderRadius: 5,
                cursor: "pointer",
                padding: "3px 6px",
                display: "flex",
                alignItems: "center",
                transition: "all 0.12s",
              }}
              title="Tabla de contenidos"
              onClick={() => setTocOpen(p => !p)}
              onMouseEnter={e => {
                if (!tocOpen) {
                  (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--foreground) 25%, transparent)";
                  (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--foreground) 6%, transparent)";
                }
              }}
              onMouseLeave={e => {
                if (!tocOpen) {
                  (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--foreground) 8%, transparent)";
                  (e.currentTarget as HTMLElement).style.background = "none";
                }
              }}
            >
              <List size={9} style={{ color: tocOpen ? "var(--color-primary,#7c6af7)" : "color-mix(in srgb, var(--foreground) 35%, transparent)" }} />
            </button>
          )}
        </div>

          {/* Buscador + panel — centro */}
          <div className="flex-1 flex justify-center">
            <div ref={searchPanelRef} className="relative" style={{ width: "min(400px, 100%)" }}>
              {/* Input */}
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                size={10}
                style={{ color: "color-mix(in srgb, var(--foreground) 22%, transparent)" }}
              />
              <input
                className="w-full outline-none"
                placeholder={`buscar entre ${ensayos.length} notas...`}
                style={{
                  background:   "color-mix(in srgb, var(--foreground) 4%, transparent)",
                  border:       "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                  borderRadius: searchPanelOpen ? "5px 5px 0 0" : 5,
                  padding:      "4px 26px 4px 24px",
                  fontSize:     10,
                  color:        "color-mix(in srgb, var(--foreground) 70%, transparent)",
                  fontFamily:   "var(--font-mono)",
                  transition:   "border-radius 0.1s",
                }}
                type="text"
                value={searchTerm}
                onChange={e => {
                  const val = e.target.value;
                  setSearchTerm(val);
                  setSearchPanelOpen(true);
                }}
                onFocus={() => setSearchPanelOpen(true)}
                onKeyDown={e => {
                  if (e.key === "Escape") { setSearchPanelOpen(false); setSearchTerm(""); (e.target as HTMLInputElement).blur(); }
                  if (e.key === "Enter" && ensayosFiltrados.length > 0) {
                    handleEnsayoClick(ensayosFiltrados[0].id);
                    setSearchPanelOpen(false);
                    setSearchTerm("");
                  }
                }}
              />
              {searchTerm ? (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "color-mix(in srgb, var(--foreground) 22%, transparent)", display: "flex", padding: 0 }}
                  onClick={() => { setSearchTerm(""); setSearchPanelOpen(false); }}
                >
                  <X size={9} />
                </button>
              ) : (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "color-mix(in srgb, var(--foreground) 18%, transparent)", display: "flex", padding: 0 }}
                  onClick={() => setSearchPanelOpen(p => !p)}
                >
                  <Plus size={9} onClick={e => { e.stopPropagation(); setShowNewNoteModal(true); setSearchPanelOpen(false); }} />
                </button>
              )}

              {/* Panel dropdown */}
              <AnimatePresence>
                {searchPanelOpen && (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    initial={{ opacity: 0, y: -4 }}
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "var(--bg-menu)",
                      border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                      borderTop: "none",
                      borderRadius: "0 0 7px 7px",
                      boxShadow: "0 12px 40px color-mix(in srgb, var(--bg-main) 40%, transparent)",
                      zIndex: 50,
                      maxHeight: 360,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                    transition={{ duration: 0.1 }}
                  >
                    {/* Tags */}
                    {todosLosTags.length > 0 && (
                      <div
                        className="px-3 py-2 flex flex-wrap gap-1 shrink-0"
                        style={{ borderBottom: "1px solid color-mix(in srgb, var(--foreground) 5%, transparent)" }}
                      >
                        <button
                          style={{
                            fontSize: 9, padding: "1px 7px", borderRadius: 3,
                            border: "1px solid",
                            borderColor: !tagActivo ? "color-mix(in srgb, var(--foreground) 30%, transparent)" : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                            background: !tagActivo ? "color-mix(in srgb, var(--foreground) 8%, transparent)" : "transparent",
                            color: !tagActivo ? "color-mix(in srgb, var(--foreground) 80%, transparent)" : "color-mix(in srgb, var(--foreground) 25%, transparent)",
                            cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all 0.1s",
                          }}
                          onClick={() => { setTagActivo(null); }}
                        >all</button>
                        {todosLosTags.map(tag => (
                          <button
                            key={tag}
                            style={{
                              fontSize: 9, padding: "1px 7px", borderRadius: 3,
                              border: "1px solid",
                              borderColor: tagActivo === tag ? "color-mix(in srgb, var(--foreground) 30%, transparent)" : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                              background: tagActivo === tag ? "color-mix(in srgb, var(--foreground) 8%, transparent)" : "transparent",
                              color: tagActivo === tag ? "color-mix(in srgb, var(--foreground) 80%, transparent)" : "color-mix(in srgb, var(--foreground) 25%, transparent)",
                              cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all 0.1s",
                            }}
                            onClick={() => setTagActivo(tagActivo === tag ? null : tag)}
                          >#{tag}</button>
                        ))}
                      </div>
                    )}

                    {/* Lista de notas */}
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {ensayosFiltrados.length === 0 ? (
                        <div className="px-4 py-5 text-center">
                          <p style={{ fontSize: 10, color: "color-mix(in srgb, var(--foreground) 20%, transparent)", fontFamily: "var(--font-mono)" }}>
                            sin resultados
                          </p>
                        </div>
                      ) : (
                        ensayosFiltrados.map(ens => {
                          const isActive = ens.id === ensayoActivoId;
                          const esLibro = ens.tags?.includes("libro");
                          const esTag = todosLosTags.some(t => t.toLowerCase() === ens.titulo?.trim().toLowerCase());
                          return (
                            <div
                              key={ens.id}
                              className="group flex items-center gap-2 px-3 py-2 cursor-pointer relative"
                              style={{
                                background: isActive ? "color-mix(in srgb, var(--foreground) 5%, transparent)" : "transparent",
                                borderLeft: `2px solid ${isActive ? "color-mix(in srgb, var(--foreground) 25%, transparent)" : "transparent"}`,
                                transition: "background 0.08s",
                              }}
                              onClick={() => { handleEnsayoClick(ens.id); setSearchPanelOpen(false); setSearchTerm(""); }}
                              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--foreground) 3%, transparent)"; }}
                              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            >
                              {esLibro
                                ? <BookOpen size={9} style={{ color: "color-mix(in srgb, var(--foreground) 35%, transparent)", flexShrink: 0 }} />
                                : esTag
                                  ? <Hash size={9} style={{ color: "color-mix(in srgb, var(--accent) 50%, transparent)", flexShrink: 0 }} />
                                  : <FileText size={9} style={{ color: "color-mix(in srgb, var(--foreground) 18%, transparent)", flexShrink: 0 }} />
                              }
                              <div className="flex-1 min-w-0">
                                <p style={{ fontSize: 11, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "color-mix(in srgb, var(--foreground) 70%, transparent)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {ens.titulo || "Sin título"}
                                </p>
                                <p style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "color-mix(in srgb, var(--foreground) 18%, transparent)" }}>
                                  {new Date(ens.updated_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                                  {ens.tags?.length > 0 && ` · ${ens.tags.filter((t: string) => t !== "libro").slice(0, 2).map((t: string) => `#${t}`).join(" ")}`}
                                </p>
                              </div>
                              {esLibro && (
                                <span
                                  style={{
                                    fontSize: 8,
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    border: "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)",
                                    background: "color-mix(in srgb, var(--foreground) 5%, transparent)",
                                    color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
                                    fontFamily: "var(--font-mono)",
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    flexShrink: 0,
                                    userSelect: "none",
                                  }}
                                >
                                  libro
                                </span>
                              )}
                              {esTag && (
                                <span
                                  style={{
                                    fontSize: 8,
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                                    background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                                    color: "color-mix(in srgb, var(--accent) 70%, transparent)",
                                    fontFamily: "var(--font-mono)",
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    flexShrink: 0,
                                    userSelect: "none",
                                  }}
                                >
                                  tag
                                </span>
                              )}
                              <button
                                className="opacity-0 group-hover:opacity-100"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "color-mix(in srgb, var(--accent) 50%, transparent)", padding: 2, flexShrink: 0, transition: "opacity 0.1s" }}
                                onClick={e => { e.stopPropagation(); void eliminarEnsayo(ens.id); }}
                              >
                                <Trash2 size={9} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div
                      className="shrink-0 px-3 py-1.5 flex items-center justify-between"
                      style={{ borderTop: "1px solid color-mix(in srgb, var(--foreground) 5%, transparent)", background: "color-mix(in srgb, var(--foreground) 2%, transparent)" }}
                    >
                      <span style={{ fontSize: 8, color: "color-mix(in srgb, var(--foreground) 15%, transparent)", fontFamily: "var(--font-mono)" }}>
                        {ensayosFiltrados.length} de {ensayos.length} notas · enter para abrir
                      </span>
                      <button
                        className="flex items-center gap-1"
                        style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)", background: "color-mix(in srgb, var(--foreground) 5%, transparent)", color: "color-mix(in srgb, var(--foreground) 45%, transparent)", cursor: "pointer", fontFamily: "var(--font-mono)" }}
                        onClick={() => { setShowNewNoteModal(true); setSearchPanelOpen(false); }}
                      >
                        <Plus size={8} /> nueva nota
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Indicador guardado — derecha */}
          <div className="shrink-0" style={{ minWidth: 64, textAlign: "right" }}>
            <span
              ref={saveIndicatorRef}
              style={{ fontSize: 9, fontFamily: "var(--font-mono)", opacity: 0, transition: "opacity 0.3s", letterSpacing: "0.1em", textTransform: "uppercase" }}
            />
          </div>
        </div>

        {/* ── Contenido principal ── */}
        <main className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary/20" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {escritorioSection === "cocina" ? (
                <RecetasPage key="cocina" />
              ) : escritorioSection === "ingredientes" ? (
                <IngredientesPage key="ingredientes" />
              ) : escritorioSection === "ejercicio" ? (
                <PaginaEjercicios key="ejercicio" />
              ) : escritorioSection === "ropa" ? (
                <ArmarioPage key="ropa" />
              ) : escritorioSection === "libros" ? (
                <LibrosDashboard
                  key="libros"
                  ensayos={ensayos}
                  onCrearLibro={crearLibro}
                  onNavigate={(titulo) => navigateToPage(titulo, false)}
                  onTagClick={handleTagClick}
                  onToggleEstado={(libroId, estado, add) => {
                    const libro = ensayos.find((e: any) => e.id === libroId);
                    if (!libro) return;
                    const tagsActuales: string[] = libro.tags ?? [];
                    const nuevosTags = add
                      ? [...new Set([...tagsActuales, estado])]
                      : tagsActuales.filter((t: string) => t !== estado);
                    scheduleSave(libroId, { tags: nuevosTags });
                  }}
                />
              ) : ensayoActivo ? (
                <Editor
                  key={ensayoActivo.id}
                  editMode={editMode}
                  ensayo={ensayoActivo}
                  ensayos={ensayos}
                  sources={sources}
                  tocOpen={tocOpen}
                  onNavigateToPage={(name) => navigateToPage(name, false)}
                  onOpenLibrosDashboard={irALibros}
                  onTagClick={(tag) => {
                    void navigateToPage(tag, true);
                  }}
                  onTocEntriesChange={setTocEntries}
                  onTocToggle={() => setTocOpen(p => !p)}
                  onToggleEditMode={() => setEditMode(p => !p)}
                  onUpdateField={actualizarLocal}
                />
              ) : (
                <HomeDashboard 
                  key="home"
                  capitulosRaw={capitulosRaw ?? []} 
                  ensayos={ensayos}
                  eventos={eventos ?? []}
                  horario={horarioRaw ?? []}
                  isAddingEvento={isAddingEvento}
                  tagActivo={tagActivo}
                  tareas={tareas}
                  todosLosTags={todosLosTags}
                  onAddEvento={handleAddEvento}
                  onAddTarea={handleAddTarea}
                  onCrearLibro={crearLibro}
                  onDeleteEvento={handleDeleteEvento}
                  onNavigate={(titulo) => navigateToPage(titulo, false)}
                  onTagClick={(tag) => navigateToPage(tag, true)}
                  onToggleEstado={(libroId, estado, add) => {
                    const libro = ensayos.find((e: any) => e.id === libroId);
                    if (!libro) return;
                    const tagsActuales: string[] = libro.tags ?? [];
                    const nuevosTags = add
                      ? [...new Set([...tagsActuales, estado])]
                      : tagsActuales.filter((t: string) => t !== estado);
                    scheduleSave(libroId, { tags: nuevosTags });
                  }}
                  onToggleTarea={handleToggleTarea}
                  onUpdateEvento={handleUpdateEvento}
                />
              )}
            </AnimatePresence>
          )}
        </main>
      </div>

      <AnimatePresence>
        {showNewNoteModal && (
          <NewNoteModal
            initialTitle={pendingNoteTitle ?? undefined}
            onClose={() => {
              setShowNewNoteModal(false);
              setPendingNoteTitle(null);
            }}
            onConfirm={crearEnsayo}
          />
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <ConfirmModal />
    </>
  );
}

// Este módulo solo lo monta app/myself/escritorio/page.tsx, que requiere
// sesión de admin. El wrapper vive aquí (features/) y no en app/, ya que
// app/ no debe importar components/ directamente.
export default function Ensayos() {
  return (
    <AdminOnly>
      <EnsayosInner />
    </AdminOnly>
  );
}
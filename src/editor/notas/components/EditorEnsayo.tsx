"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Save, BookOpen, X, PanelRight } from "lucide-react";
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

import {
  RichEditor,
  type RichEditorFormatCommand,
} from "@/editor/lexical";
import { AddLayoutBoxButton } from "@/editor/layout-boxes/AddLayoutBoxButton";
import { LayoutCanvas, type LayoutCanvasHandle } from "@/editor/layout-boxes/LayoutCanvas";
import { parseLayoutBoxes, type LayoutBox } from "@/editor/layout-boxes/types";
import { MotionDiv } from "@/ui/Motion";
import type { ZoteroSource } from "@/editor/notas/hooks/useZotero";

import { CitePopup } from "./citePopup";
import { LibroPanel } from "./LibroPanel";
import { NotaPanel } from "./NotaPanel";

// ── TOC extractor ─────────────────────────────────────────────────────────────
function extractTOC(
  content: string,
): { level: number; text: string; id: string }[] {
  const lines = content.split("\n");
  const counter: Record<string, number> = {};
  const entries: { level: number; text: string; id: string }[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].trim();
    const base = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    counter[base] = (counter[base] || 0) + 1;
    const id = counter[base] > 1 ? `${base}-${counter[base]}` : base;
    entries.push({ level, text, id });
  }
  return entries;
}

interface EditorProps {
  ensayo: any;
  ensayos: any[];
  sources?: ZoteroSource[];
  editMode: boolean;
  onToggleEditMode: () => void;
  onUpdateField: (id: string, field: string, value: any, extra?: any) => void;
  onNavigateToPage: (name: string) => void;
  onOpenLibrosDashboard?: () => void;
  onTagClick?: (t: string) => void;
  tocOpen?: boolean;
  onTocToggle?: () => void;
  onTocEntriesChange?: (
    entries: { level: number; text: string; id: string }[],
  ) => void;
}

// ─── Editor principal ─────────────────────────────────────────────────────────

export function Editor({
  ensayo,
  ensayos,
  sources = [],
  editMode,
  onToggleEditMode: _onToggleEditMode,
  onUpdateField,
  onNavigateToPage,
  onOpenLibrosDashboard,
  onTagClick,
  tocOpen: tocOpenProp,
  onTocToggle,
  onTocEntriesChange,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tituloOriginalRef = useRef<string | null>(null);
  // Ref imperativo hacia RichEditor para que NotaPanel (tab "formato")
  // pueda aplicar comandos de bloque/texto sin pasar por el "/" —
  // ver RichEditor.tsx (FormatCommandPlugin) y NotaPanel.tsx.
  const formatCommandRef = useRef<
    ((commandId: RichEditorFormatCommand) => void) | null
  >(null);

  const [localTitulo, setLocalTitulo] = useState<string>(ensayo.titulo || "");
  const [localContenido, setLocalContenido] = useState<string>(
    ensayo.contenido || "",
  );

  // ── Cajas de texto flotantes ("bloques") ─────────────────────────────────
  // Capa siempre visible, superpuesta al documento — no hay modo on/off.
  // Independiente del documento principal: se guarda en su propio campo
  // (`layout_boxes`, JSON) vía el mismo mecanismo de autosave con debounce
  // que ya usa `contenido` (ver onUpdateField → scheduleSave en el shell).
  const [layoutBoxes, setLayoutBoxes] = useState<LayoutBox[]>(() =>
    parseLayoutBoxes(ensayo.layout_boxes),
  );
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutCanvasRef = useRef<LayoutCanvasHandle | null>(null);

  const handleLayoutBoxesChange = useCallback(
    (boxes: LayoutBox[]) => {
      setLayoutBoxes(boxes);
      // Debounce propio en vez de disparar onUpdateField en cada pixel de
      // drag/resize — el mismo patrón que ya usa el shell para `contenido`,
      // pero acá lo hacemos local porque los cambios de posición durante un
      // arrastre son mucho más frecuentes que un onChange de texto normal.
      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
      layoutSaveTimerRef.current = setTimeout(() => {
        onUpdateField(ensayo.id, "layout_boxes", boxes);
      }, 600);
    },
    [ensayo.id, onUpdateField],
  );

  useEffect(() => {
    return () => {
      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    };
  }, []);

  const [newTagInput, setNewTagInput] = useState("");
  const [_addingTag, setAddingTag] = useState(false);
  const _newTagRef = React.useRef<HTMLInputElement>(null);

  // Citation popup (@)
  const [tocOpenLocal, setTocOpenLocal] = useState(false);
  const tocOpen = tocOpenProp !== undefined ? tocOpenProp : tocOpenLocal;
  const setTocOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(tocOpen) : v;
    setTocOpenLocal(next);
    onTocToggle?.();
  };

  const tocEntries = useMemo(
    () => extractTOC(localContenido),
    [localContenido],
  );

  // ── Mobile detection ──────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [libroPanelOpen, setLibroPanelOpen] = useState(false);
  const [notaPanelOpen, setNotaPanelOpen] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    onTocEntriesChange?.(tocEntries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocEntries]);

  const [citePopup, setCitePopup] = useState<{
    query: string;
    atStart: number;
    position: { top: number; left: number };
  } | null>(null);
  const [citeActiveIdx, setCiteActiveIdx] = useState(0);

  // Strip the old auto-generated tag-links section if it still exists in saved content
  const stripTagLinks = (c: string) => {
    const marker = "<!-- tag-links -->";
    const idx = c.indexOf(marker);
    if (idx === -1) return c;
    return c.slice(0, Math.max(0, c.lastIndexOf("\n\n", idx))).trimEnd();
  };

  useEffect(() => {
    setLocalTitulo(ensayo.titulo || "");
    const cleaned = stripTagLinks(ensayo.contenido || "");
    setLocalContenido(cleaned);
    setAddingTag(false);
    setNewTagInput("");
    if (cleaned !== (ensayo.contenido || "")) {
      onUpdateField(ensayo.id, "contenido", cleaned);
    }
    // Cambiar de ensayo: recargar las cajas de texto flotantes del nuevo ensayo.
    if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    setLayoutBoxes(parseLayoutBoxes(ensayo.layout_boxes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensayo.id]);

  const wordCount = localContenido.split(/\s+/).filter(Boolean).length || 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const getPopupPosition = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const top = rect
      ? Math.min(rect.top + rect.height * 0.5, window.innerHeight - 320)
      : 200;
    const left = rect ? rect.left + 32 : 32;
    return { top, left };
  };

  const handleContenidoChange = useCallback(
    (value: string) => {
      setLocalContenido(value);
      onUpdateField(ensayo.id, "contenido", value);

      if (!sources.length) return;
      const citeMatch = value.match(/@([\w\-.]*)$/);
      if (citeMatch) {
        setCitePopup({
          query: citeMatch[1],
          atStart: value.length - citeMatch[0].length,
          position: getPopupPosition(),
        });
        setCiteActiveIdx(0);
      } else {
        setCitePopup(null);
      }
    },
    [ensayo.id, onUpdateField, sources],
  );

  const insertCite = useCallback(
    (src: ZoteroSource) => {
      if (!citePopup) return;
      const cite = src.citekey
        ? `[@${src.citekey}]`
        : `[@${src.author.split(",")[0].trim().toLowerCase()}${src.year}]`;

      const before = localContenido.substring(0, citePopup.atStart);
      const after = localContenido.substring(
        citePopup.atStart + citePopup.query.length + 1,
      );
      const newValue = before + cite + after;

      setLocalContenido(newValue);
      onUpdateField(ensayo.id, "contenido", newValue);
      setCitePopup(null);
    },
    [citePopup, ensayo.id, localContenido, onUpdateField],
  );

  const monoStyle: React.CSSProperties = { fontFamily: "var(--font-mono)" };

  // ── ¿Es un libro? ─────────────────────────────────────────────────────────
  const isLibro = (ensayo.tags ?? []).includes("libro");

  // ── Backlinks: notas que mencionan esta página por [[título]] o por tag ──────
  const _backlinks = useMemo(() => {
    const titulo = ensayo.titulo?.trim().toLowerCase();
    if (!titulo) return [];
    return ensayos.filter((e: any) => {
      if (e.id === ensayo.id) return false;
      // wikilink [[titulo]]
      const contenido = (e.contenido || "").toLowerCase();
      const wikilinkMatch = contenido.includes(`[[${titulo}]]`);
      // tag match
      const tagMatch = e.tags?.some((t: string) => t.toLowerCase() === titulo);
      return wikilinkMatch || tagMatch;
    });
  }, [ensayos, ensayo.id, ensayo.titulo]);

  // All existing tags across all notes (for autocomplete)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    ensayos.forEach((e: any) => e.tags?.forEach((t: string) => set.add(t)));
    (ensayo.tags ?? []).forEach((t: string) => set.delete(t)); // exclude already-added
    return Array.from(set).sort();
  }, [ensayos, ensayo.tags]);

  const _tagSuggestions = useMemo(() => {
    if (!newTagInput.trim()) return [];
    const q = newTagInput.trim().toLowerCase();
    return allTags.filter((t) => t.includes(q)).slice(0, 6);
  }, [allTags, newTagInput]);

  // ── Input de título reutilizable ─────────────────────────────────────────
  const tituloInput = (
    <input
      className="w-full bg-transparent outline-none border-none"
      placeholder="título..."
      style={{
        fontSize: "clamp(18px, 3vw, 26px)",
        fontFamily: "var(--font-serif)",
        fontStyle: "italic",
        color: "color-mix(in srgb, var(--foreground) 85%, transparent)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      }}
      type="text"
      value={localTitulo}
      onBlur={(e) => {
        const finalVal = e.target.value.trim();
        if (
          tituloOriginalRef.current !== null &&
          tituloOriginalRef.current !== finalVal
        ) {
          onUpdateField(
            ensayo.id,
            "titulo:rename",
            finalVal,
            tituloOriginalRef.current,
          );
        }
        tituloOriginalRef.current = null;
      }}
      onChange={(e) => {
        setLocalTitulo(e.target.value);
        onUpdateField(ensayo.id, "titulo", e.target.value);
      }}
      onFocus={() => {
        tituloOriginalRef.current = localTitulo;
      }}
    />
  );

  // ── RichEditor: modo inicial + wikiEntities ────────────────────────────────
  // RichEditor no tiene "defaultMode" (no controlado) como el MarkdownEditor
  // viejo — solo "mode" controlado. Replicamos el mismo comportamiento
  // (arranca en edit/preview según editMode, pero el usuario puede
  // cambiarlo libremente después) con un estado propio inicializado una
  // sola vez.
  const [richMode, setRichMode] = useState<"edit" | "preview" | "split">(
    editMode ? "edit" : "preview",
  );

  // Entidades para autocompletar [[Nota]] — mismo criterio que antes
  // (todos los otros ensayos, excluyendo el actual).
  const wikiEntities = useMemo(
    () =>
      ensayos
        .filter((e: any) => e.id !== ensayo.id && e.titulo)
        .map((e: any) => ({ name: e.titulo as string, type: "nota" })),
    [ensayos, ensayo.id],
  );

  // No pasamos renderPreview: sin esa prop, RichEditor cae a su fallback
  // de renderMarkdown (markdown normal — headers, tablas, negrita, etc.)
  // y YA resuelve el click en [[Nota]] vía onWikilinkNavigate. Es
  // exactamente lo que necesita este editor de notas — nada de
  // ContenidoInteractivo, que es solo para lectura de libro
  // (drop/choice/gate).

  // ── Bloque del editor markdown reutilizable ───────────────────────────────
  const markdownBlock = (
    <div
      className="flex-1 overflow-y-auto relative pb-8"
      style={{
        paddingLeft: isLibro ? 20 : 32,
        paddingRight: isLibro ? 20 : 32,
      }}
    >
      <RichEditor
        extraToolbarAction={
          <AddLayoutBoxButton onClick={() => layoutCanvasRef.current?.addBox()} />
        }
        exportFileName={localTitulo || ensayo.titulo}
        formatCommandRef={formatCommandRef}
        mode={richMode}
        placeholder="empieza a escribir... (usa @ para citar · [[ para enlazar notas)"
        showSplitMode={false}
        value={localContenido}
        wikiEntities={wikiEntities}
        onChange={handleContenidoChange}
        onModeChange={setRichMode}
        onWikilinkNavigate={onNavigateToPage}
      />
      <AnimatePresence>
        {citePopup && sources.length > 0 && (
          <div
            style={{
              position: "fixed",
              top: citePopup.position.top + 25,
              left: citePopup.position.left,
              zIndex: 9999,
            }}
          >
            <CitePopup
              activeIndex={citeActiveIdx}
              position={{ top: 0, left: 0 }}
              query={citePopup.query}
              sources={sources}
              onClose={() => setCitePopup(null)}
              onSelect={insertCite}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Capa de cajas de texto flotantes ──────────────────────────────
          Siempre visible, superpuesta al documento de arriba. El fondo
          sigue siempre editable — la capa no bloquea clicks en el área
          vacía, solo las cajas mismas capturan sus propios eventos. */}
      <LayoutCanvas
        ref={layoutCanvasRef}
        boxes={layoutBoxes}
        onBoxesChange={handleLayoutBoxesChange}
      />
    </div>
  );

  return (
    <div ref={containerRef} className="relative h-full flex flex-col">
      <MotionDiv
        key={ensayo.id}
        animate={{ opacity: 1 }}
        className="flex flex-col flex-1 min-h-0"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* ══════════════════════════════════════════════════════
            MODO LIBRO — dos columnas: ficha izquierda / editor derecha
        ══════════════════════════════════════════════════════ */}
        {isLibro ? (
          <div
            style={{
              display: "flex",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {/* ══ DESKTOP: columna izquierda fija ══ */}
            {!isMobile && (
              <div
                style={{
                  width: 300,
                  flexShrink: 0,
                  borderRight:
                    "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)",
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                  background:
                    "color-mix(in srgb, var(--foreground) 1%, var(--bg-main))",
                }}
              >
                <div
                  style={{
                    padding: "20px 20px 12px",
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
                  }}
                >
                  {tituloInput}
                  <div className="flex items-center gap-1.5 mt-2">
                    <Save
                      size={9}
                      style={{
                        color:
                          "color-mix(in srgb, var(--foreground) 15%, transparent)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        color:
                          "color-mix(in srgb, var(--foreground) 15%, transparent)",
                        ...monoStyle,
                      }}
                    >
                      {new Date(ensayo.updated_at).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <LibroPanel
                    ensayo={ensayo}
                    ensayos={ensayos}
                    onOpenLibrosDashboard={onOpenLibrosDashboard}
                    onTagClick={onTagClick ?? onNavigateToPage}
                    onUpdateField={onUpdateField}
                  />
                </div>
              </div>
            )}

            {/* ── Columna editor (ocupa todo en mobile) ── */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              {/* Mini meta bar */}
              <div
                className="shrink-0 flex items-center gap-3 px-4"
                style={{
                  height: 36,
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
                }}
              >
                {/* Botón ficha — solo en mobile */}
                {isMobile && (
                  <button
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 8px",
                      borderRadius: 5,
                      border:
                        "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                      background:
                        "color-mix(in srgb, var(--foreground) 4%, transparent)",
                      color:
                        "color-mix(in srgb, var(--foreground) 45%, transparent)",
                      cursor: "pointer",
                      flexShrink: 0,
                      ...monoStyle,
                      fontSize: 9,
                    }}
                    title="Ver ficha del libro"
                    onClick={() => setLibroPanelOpen(true)}
                  >
                    <BookOpen size={9} />
                    ficha
                  </button>
                )}
                <span
                  style={{
                    fontSize: 9,
                    color:
                      "color-mix(in srgb, var(--foreground) 18%, transparent)",
                    ...monoStyle,
                  }}
                >
                  {wordCount} palabras · ~{readTime}min
                </span>
                {sources.length > 0 && (
                  <>
                    <span
                      style={{
                        fontSize: 9,
                        color:
                          "color-mix(in srgb, var(--foreground) 10%, transparent)",
                        ...monoStyle,
                      }}
                    >
                      ·
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color:
                          "color-mix(in srgb, var(--accent) 55%, transparent)",
                        ...monoStyle,
                      }}
                    >
                      @ {sources.length} fuentes
                    </span>
                  </>
                )}
              </div>
              {markdownBlock}
            </div>

            {/* ══ MOBILE: drawer lateral desde la izquierda ══ */}
            <AnimatePresence>
              {isMobile && libroPanelOpen && (
                <>
                  {/* Overlay */}
                  <motion.div
                    key="libro-overlay"
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    style={{
                      position: "fixed",
                      inset: 0,
                      background:
                        "color-mix(in srgb, var(--bg-main) 55%, transparent)",
                      backdropFilter: "blur(2px)",
                      zIndex: 40,
                    }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setLibroPanelOpen(false)}
                  />
                  {/* Drawer */}
                  <motion.div
                    key="libro-drawer"
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    initial={{ x: "-100%" }}
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: "min(320px, 88vw)",
                      background: "var(--bg-menu)",
                      borderRight:
                        "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                      zIndex: 50,
                      display: "flex",
                      flexDirection: "column",
                      overflowY: "auto",
                      boxShadow:
                        "6px 0 32px color-mix(in srgb, var(--bg-main) 40%, transparent)",
                    }}
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  >
                    {/* Header del drawer */}
                    <div
                      style={{
                        padding: "16px 16px 12px",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        {tituloInput}
                        <div className="flex items-center gap-1.5 mt-2">
                          <Save
                            size={9}
                            style={{
                              color:
                                "color-mix(in srgb, var(--foreground) 15%, transparent)",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 9,
                              color:
                                "color-mix(in srgb, var(--foreground) 15%, transparent)",
                              ...monoStyle,
                            }}
                          >
                            {new Date(ensayo.updated_at).toLocaleTimeString(
                              "es-ES",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                        </div>
                      </div>
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 4,
                          color:
                            "color-mix(in srgb, var(--foreground) 30%, transparent)",
                          display: "flex",
                          alignItems: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                        onClick={() => setLibroPanelOpen(false)}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Contenido del panel */}
                    <div style={{ flex: 1 }}>
                      <LibroPanel
                        ensayo={ensayo}
                        ensayos={ensayos}
                        onOpenLibrosDashboard={() => {
                          setLibroPanelOpen(false);
                          onOpenLibrosDashboard?.();
                        }}
                        onTagClick={(t) => {
                          setLibroPanelOpen(false);
                          (onTagClick ?? onNavigateToPage)(t);
                        }}
                        onUpdateField={onUpdateField}
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════
              MODO NORMAL — columna principal + barra lateral derecha
          ══════════════════════════════════════════════════════ */
          <div
            style={{
              display: "flex",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {/* ── Columna principal ── */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              {/* ── Title input ── */}
              <div
                className="shrink-0 px-8 pt-5 pb-2"
                style={{ background: "transparent" }}
              >
                {tituloInput}
                {/* ── Meta row ── */}
                <div
                  className="flex items-center mt-1.5"
                  style={{
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
                    paddingBottom: 8,
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      style={{
                        fontSize: 9,
                        color:
                          "color-mix(in srgb, var(--foreground) 20%, transparent)",
                        ...monoStyle,
                      }}
                    >
                      {wordCount} palabras · ~{readTime}min
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span
                      style={{
                        fontSize: 9,
                        color:
                          "color-mix(in srgb, var(--foreground) 20%, transparent)",
                        ...monoStyle,
                      }}
                    >
                      {wordCount} palabras
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color:
                          "color-mix(in srgb, var(--foreground) 10%, transparent)",
                        ...monoStyle,
                      }}
                    >
                      ·
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color:
                          "color-mix(in srgb, var(--foreground) 20%, transparent)",
                        ...monoStyle,
                      }}
                    >
                      ~{readTime}min lectura
                    </span>
                    {sources.length > 0 && (
                      <>
                        <span
                          style={{
                            fontSize: 9,
                            color:
                              "color-mix(in srgb, var(--foreground) 10%, transparent)",
                            ...monoStyle,
                          }}
                        >
                          ·
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            color:
                              "color-mix(in srgb, var(--accent) 60%, transparent)",
                            ...monoStyle,
                          }}
                          title="Escribe @ para citar · [[ para enlazar"
                        >
                          @ {sources.length} fuentes
                        </span>
                      </>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Save
                        size={9}
                        style={{
                          color:
                            "color-mix(in srgb, var(--foreground) 15%, transparent)",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          color:
                            "color-mix(in srgb, var(--foreground) 15%, transparent)",
                          ...monoStyle,
                        }}
                      >
                        {new Date(ensayo.updated_at).toLocaleTimeString(
                          "es-ES",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                    </div>
                    {/* Botón panel lateral — solo en mobile */}
                    {isMobile && (
                      <button
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 8px",
                          borderRadius: 5,
                          border:
                            "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                          background:
                            "color-mix(in srgb, var(--foreground) 4%, transparent)",
                          color:
                            "color-mix(in srgb, var(--foreground) 45%, transparent)",
                          cursor: "pointer",
                          ...monoStyle,
                          fontSize: 9,
                        }}
                        title="Índice, tags y menciones"
                        onClick={() => setNotaPanelOpen(true)}
                      >
                        <PanelRight size={9} />
                        panel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Editor content ── */}
              {markdownBlock}
            </div>

            {/* ══ DESKTOP: barra lateral derecha ══ */}
            {!isMobile && (
              <div
                style={{
                  width: 220,
                  flexShrink: 0,
                  borderLeft:
                    "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)",
                  display: "flex",
                  flexDirection: "column",
                  background:
                    "color-mix(in srgb, var(--foreground) 1%, var(--bg-main))",
                }}
              >
                <NotaPanel
                  ensayo={ensayo}
                  ensayos={ensayos}
                  formatCommandRef={formatCommandRef}
                  tocEntries={tocEntries}
                  onNavigateToPage={onNavigateToPage}
                  onTagClick={onTagClick ?? onNavigateToPage}
                  onUpdateField={onUpdateField}
                />
              </div>
            )}

            {/* ══ MOBILE: drawer lateral desde la derecha ══ */}
            <AnimatePresence>
              {isMobile && notaPanelOpen && (
                <>
                  {/* Overlay */}
                  <motion.div
                    key="nota-overlay"
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    style={{
                      position: "fixed",
                      inset: 0,
                      background:
                        "color-mix(in srgb, var(--bg-main) 55%, transparent)",
                      backdropFilter: "blur(2px)",
                      zIndex: 40,
                    }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setNotaPanelOpen(false)}
                  />
                  {/* Drawer */}
                  <motion.div
                    key="nota-drawer"
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    initial={{ x: "100%" }}
                    style={{
                      position: "fixed",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: "min(280px, 88vw)",
                      background: "var(--bg-menu)",
                      borderLeft:
                        "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                      zIndex: 50,
                      display: "flex",
                      flexDirection: "column",
                      overflowY: "auto",
                      boxShadow:
                        "-6px 0 32px color-mix(in srgb, var(--bg-main) 40%, transparent)",
                    }}
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  >
                    {/* Header del drawer */}
                    <div
                      style={{
                        padding: "14px 14px 10px",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color:
                            "color-mix(in srgb, var(--foreground) 30%, transparent)",
                        }}
                      >
                        panel
                      </span>
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 4,
                          color:
                            "color-mix(in srgb, var(--foreground) 30%, transparent)",
                          display: "flex",
                          alignItems: "center",
                        }}
                        onClick={() => setNotaPanelOpen(false)}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Contenido del panel */}
                    <div style={{ flex: 1 }}>
                      <NotaPanel
                        ensayo={ensayo}
                        ensayos={ensayos}
                        formatCommandRef={formatCommandRef}
                        tocEntries={tocEntries}
                        onNavigateToPage={(name) => {
                          setNotaPanelOpen(false);
                          onNavigateToPage(name);
                        }}
                        onTagClick={(t) => {
                          setNotaPanelOpen(false);
                          (onTagClick ?? onNavigateToPage)(t);
                        }}
                        onUpdateField={onUpdateField}
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </MotionDiv>

      {/* ── TOC panel lateral — solo en modo libro (en modo normal vive en NotaPanel) ── */}
      <AnimatePresence>
        {isLibro && tocOpen && tocEntries.length > 0 && (
          <motion.div
            key="toc-panel"
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            initial={{ opacity: 0, x: 16 }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 200,
              background: "color-mix(in srgb, var(--bg-menu) 97%, transparent)",
              borderLeft:
                "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
              backdropFilter: "blur(12px)",
              zIndex: 30,
              overflowY: "auto",
              padding: "14px 12px",
              scrollbarWidth: "none",
            }}
            transition={{ duration: 0.18 }}
          >
            <div
              style={{
                fontSize: 8,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "color-mix(in srgb, var(--foreground) 22%, transparent)",
                marginBottom: 10,
              }}
            >
              índice
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {tocEntries.map((entry, i) => (
                <a
                  key={i}
                  href={`#${entry.id}`}
                  style={{
                    display: "block",
                    paddingLeft: `${(entry.level - 1) * 10}px`,
                    paddingTop: 4,
                    paddingBottom: 4,
                    paddingRight: 4,
                    fontSize:
                      entry.level === 1 ? 11 : entry.level === 2 ? 10 : 9,
                    fontFamily:
                      entry.level === 1
                        ? "var(--font-serif)"
                        : "var(--font-mono)",
                    fontStyle: entry.level === 1 ? "italic" : "normal",
                    fontWeight: entry.level <= 2 ? 600 : 400,
                    color:
                      entry.level === 1
                        ? "color-mix(in srgb, var(--color-primary,#7c6af7) 80%, white)"
                        : entry.level === 2
                          ? "color-mix(in srgb, var(--foreground) 55%, transparent)"
                          : "color-mix(in srgb, var(--foreground) 35%, transparent)",
                    textDecoration: "none",
                    borderRadius: 3,
                    transition: "all 0.1s",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  onClick={() => setTocOpen(false)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "color-mix(in srgb, var(--color-primary,#7c6af7) 8%, transparent)";
                    (e.currentTarget as HTMLElement).style.color =
                      "color-mix(in srgb, var(--color-primary,#7c6af7) 90%, white)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      entry.level === 1
                        ? "color-mix(in srgb, var(--color-primary,#7c6af7) 80%, white)"
                        : entry.level === 2
                          ? "color-mix(in srgb, var(--foreground) 55%, transparent)"
                          : "color-mix(in srgb, var(--foreground) 35%, transparent)";
                  }}
                >
                  {entry.text}
                </a>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Editor;
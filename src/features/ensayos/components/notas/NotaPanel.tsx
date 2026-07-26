"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Tag,
  Hash,
  AtSign,
  FileText,
  ChevronRight,
  Plus,
  Pencil,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Pilcrow,
  List as ListIcon,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  LayoutList,
} from "lucide-react";
import React, { useState, useMemo } from "react";

import type { RichEditorFormatCommand } from "@/components/forms/lexical-editor";

// ── Tipos ──────────────────────────────────────────────────────────────────────
type NotaPanelTab = "indice" | "contexto" | "formato";

export interface TocEntry {
  level: number;
  text: string;
  id: string;
}

export interface NotaPanelProps {
  ensayo: any;
  ensayos: any[];
  tocEntries: TocEntry[];
  onUpdateField: (id: string, field: string, value: any) => void;
  onNavigateToPage: (name: string) => void;
  onTagClick?: (t: string) => void;
  /** Ref imperativo hacia RichEditor para aplicar comandos de formato
   * desde la tab "formato" — ver EditorEnsayo.tsx y RichEditor.tsx. */
  formatCommandRef?: React.MutableRefObject<
    ((commandId: RichEditorFormatCommand) => void) | null
  >;
}

// ── Tab button ─────────────────────────────────────────────────────────────────

function TabBtn({
  label,
  icon: Icon,
  active,
  count,
  onClick,
  mono,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  count?: number;
  onClick: () => void;
  mono: React.CSSProperties;
}) {
  return (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        borderRadius: 5,
        border: "none",
        background: active
          ? "color-mix(in srgb, var(--foreground) 6%, transparent)"
          : "transparent",
        color: active
          ? "color-mix(in srgb, var(--foreground) 65%, transparent)"
          : "color-mix(in srgb, var(--foreground) 28%, transparent)",
        cursor: "pointer",
        transition: "all 0.12s",
        ...mono,
        fontSize: 8,
        textTransform: "lowercase",
        letterSpacing: "0.04em",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
      onClick={onClick}
    >
      <Icon
        size={8}
        strokeWidth={active ? 2.2 : 1.8}
        style={{ flexShrink: 0 }}
      />
      {label}
      {count !== undefined && count > 0 && (
        <span
          style={{
            ...mono,
            fontSize: 7,
            padding: "0px 5px",
            borderRadius: 99,
            background: active
              ? "color-mix(in srgb, var(--accent) 14%, transparent)"
              : "color-mix(in srgb, var(--foreground) 8%, transparent)",
            color: active
              ? "color-mix(in srgb, var(--accent) 80%, transparent)"
              : "color-mix(in srgb, var(--foreground) 35%, transparent)",
            transition: "all 0.12s",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── Sección Índice ─────────────────────────────────────────────────────────────

function SeccionIndice({
  entries,
  mono,
}: {
  entries: TocEntry[];
  mono: React.CSSProperties;
}) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <FileText
          size={18}
          strokeWidth={1.2}
          style={{
            color: "color-mix(in srgb, var(--foreground) 12%, transparent)",
          }}
        />
        <span
          style={{
            ...mono,
            fontSize: 9,
            color: "color-mix(in srgb, var(--foreground) 22%, transparent)",
            fontStyle: "italic",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          sin encabezados todavía
        </span>
      </div>
    );
  }

  return (
    <nav style={{ display: "flex", flexDirection: "column", padding: "4px 0" }}>
      {entries.map((entry, i) => (
        <a
          key={i}
          href={`#${entry.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingLeft: `${8 + (entry.level - 1) * 10}px`,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            fontSize: entry.level === 1 ? 11 : entry.level === 2 ? 10 : 9,
            fontFamily:
              entry.level === 1 ? "var(--font-serif)" : "var(--font-mono)",
            fontStyle: entry.level === 1 ? "italic" : "normal",
            fontWeight: entry.level <= 2 ? 500 : 400,
            color:
              entry.level === 1
                ? "color-mix(in srgb, var(--foreground) 72%, transparent)"
                : entry.level === 2
                  ? "color-mix(in srgb, var(--foreground) 50%, transparent)"
                  : "color-mix(in srgb, var(--foreground) 32%, transparent)",
            textDecoration: "none",
            borderRadius: 3,
            transition: "all 0.1s",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginLeft: 4,
            marginRight: 4,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "color-mix(in srgb, var(--foreground) 5%, transparent)";
            (e.currentTarget as HTMLElement).style.color =
              "color-mix(in srgb, var(--foreground) 80%, transparent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color =
              entry.level === 1
                ? "color-mix(in srgb, var(--foreground) 72%, transparent)"
                : entry.level === 2
                  ? "color-mix(in srgb, var(--foreground) 50%, transparent)"
                  : "color-mix(in srgb, var(--foreground) 32%, transparent)";
          }}
        >
          {entry.level > 1 && (
            <ChevronRight
              size={7}
              strokeWidth={1.6}
              style={{
                flexShrink: 0,
                opacity: 0.4,
                marginLeft: `${(entry.level - 2) * 4}px`,
              }}
            />
          )}
          {entry.text}
        </a>
      ))}
    </nav>
  );
}

// ── Sección Tags + Menciones combinadas ────────────────────────────────────────

function SeccionContexto({
  ensayo,
  ensayos,
  onUpdateField,
  onTagClick,
  onNavigateToPage,
  mono,
}: {
  ensayo: any;
  ensayos: any[];
  onUpdateField: (id: string, field: string, value: any) => void;
  onTagClick?: (t: string) => void;
  onNavigateToPage: (name: string) => void;
  mono: React.CSSProperties;
}) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const tags: string[] = ensayo.tags ?? [];

  const tagsVisibles = useMemo(() => {
    const titulo = ensayo.titulo?.trim().toLowerCase();
    return tags.filter((t) => t.toLowerCase() !== titulo);
  }, [tags, ensayo.titulo]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    ensayos.forEach((e: any) => e.tags?.forEach((t: string) => set.add(t)));
    tags.forEach((t) => set.delete(t));
    return Array.from(set).sort();
  }, [ensayos, tags]);

  const suggestions = useMemo(() => {
    if (!input.trim()) return [];
    const q = input.trim().toLowerCase();
    return allTags.filter((t) => t.toLowerCase().includes(q)).slice(0, 6);
  }, [input, allTags]);

  const backlinks = useMemo(() => {
    const titulo = ensayo.titulo?.trim().toLowerCase();
    if (!titulo) return [];
    return ensayos.filter((e: any) => {
      if (e.id === ensayo.id) return false;
      const contenido = (e.contenido || "").toLowerCase();
      return (
        contenido.includes(`[[${titulo}]]`) ||
        e.tags?.some((t: string) => t.toLowerCase() === titulo)
      );
    });
  }, [ensayos, ensayo.id, ensayo.titulo]);

  const addTag = (t: string) => {
    const val = t.trim().toLowerCase();
    if (val && !tags.includes(val))
      onUpdateField(ensayo.id, "tags", [...tags, val]);
    setInput("");
  };

  const removeTag = (t: string) => {
    onUpdateField(
      ensayo.id,
      "tags",
      tags.filter((x) => x !== t),
    );
  };

  const labelStyle: React.CSSProperties = {
    ...mono,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
    padding: "8px 12px 4px",
    display: "flex",
    alignItems: "center",
    gap: 5,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* ── TAGS ── */}
      <div style={labelStyle}>
        <Tag size={7} strokeWidth={1.8} />
        etiquetas
        {tagsVisibles.length > 0 && (
          <span
            style={{
              ...mono,
              fontSize: 7,
              marginLeft: "auto",
              color: "color-mix(in srgb, var(--foreground) 22%, transparent)",
            }}
          >
            {tagsVisibles.length}
          </span>
        )}
      </div>

      <div
        style={{
          padding: "0 12px",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {tagsVisibles.map((t) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "3px 6px",
              borderRadius: 4,
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "color-mix(in srgb, var(--foreground) 4%, transparent)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background =
                "transparent")
            }
          >
            <button
              style={{
                background: "none",
                border: "none",
                cursor: onTagClick ? "pointer" : "default",
                padding: 0,
                ...mono,
                fontSize: 10,
                color: "color-mix(in srgb, var(--accent) 75%, transparent)",
                textAlign: "left",
              }}
              onClick={() => onTagClick?.(t)}
            >
              #{t}
            </button>
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 2px",
                color: "color-mix(in srgb, var(--foreground) 18%, transparent)",
                fontSize: 12,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                transition: "color 0.1s",
                flexShrink: 0,
              }}
              onClick={() => removeTag(t)}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color =
                  "color-mix(in srgb, var(--accent) 60%, transparent)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color =
                  "color-mix(in srgb, var(--foreground) 18%, transparent)")
              }
            >
              ×
            </button>
          </div>
        ))}

        {/* Input nuevo tag */}
        <div style={{ position: "relative", marginTop: 2 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 6px",
              borderRadius: 4,
              border: `1px ${focused ? "solid" : "dashed"} ${focused ? "color-mix(in srgb, var(--foreground) 14%, transparent)" : "color-mix(in srgb, var(--foreground) 9%, transparent)"}`,
              background: focused
                ? "color-mix(in srgb, var(--foreground) 3%, transparent)"
                : "transparent",
              transition: "all 0.1s",
            }}
          >
            <Plus
              size={7}
              style={{
                color: "color-mix(in srgb, var(--foreground) 20%, transparent)",
                flexShrink: 0,
              }}
            />
            <input
              placeholder="añadir..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                ...mono,
                fontSize: 9,
                color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
              }}
              type="text"
              value={input}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  if (input.trim()) addTag(input);
                }
                if (e.key === "Escape") {
                  setInput("");
                  setFocused(false);
                }
              }}
            />
          </div>

          <AnimatePresence>
            {focused && suggestions.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                initial={{ opacity: 0, y: -3 }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 3px)",
                  left: 0,
                  right: 0,
                  background: "var(--bg-menu)",
                  border:
                    "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                  borderRadius: 5,
                  padding: 3,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  zIndex: 50,
                  boxShadow:
                    "0 4px 16px color-mix(in srgb, var(--bg-main) 50%, transparent)",
                }}
                transition={{ duration: 0.1 }}
              >
                {suggestions.map((t) => (
                  <button
                    key={t}
                    style={{
                      ...mono,
                      fontSize: 9,
                      color:
                        "color-mix(in srgb, var(--foreground) 60%, transparent)",
                      background: "transparent",
                      border: "none",
                      borderRadius: 3,
                      padding: "3px 8px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseDown={() => addTag(t)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "color-mix(in srgb, var(--accent) 10%, transparent)";
                      (e.currentTarget as HTMLElement).style.color =
                        "color-mix(in srgb, var(--accent) 85%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                      (e.currentTarget as HTMLElement).style.color =
                        "color-mix(in srgb, var(--foreground) 60%, transparent)";
                    }}
                  >
                    #{t}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Divisor ── */}
      <div
        style={{
          margin: "10px 12px 0",
          borderTop:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
        }}
      />

      {/* ── MENCIONES ── */}
      <div style={labelStyle}>
        <AtSign size={7} strokeWidth={1.8} />
        menciones
        {backlinks.length > 0 && (
          <span
            style={{
              ...mono,
              fontSize: 7,
              marginLeft: "auto",
              color: "color-mix(in srgb, var(--accent) 65%, transparent)",
            }}
          >
            {backlinks.length}
          </span>
        )}
      </div>

      <div
        style={{
          padding: "0 12px",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {backlinks.length === 0 ? (
          <span
            style={{
              ...mono,
              fontSize: 9,
              color: "color-mix(in srgb, var(--foreground) 20%, transparent)",
              fontStyle: "italic",
              padding: "3px 6px",
            }}
          >
            ninguna nota menciona esta página
          </span>
        ) : (
          backlinks.map((b: any) => {
            const titulo = ensayo.titulo?.trim().toLowerCase() ?? "";
            const contenido = (b.contenido || "").toLowerCase();
            const viaWikilink = contenido.includes(`[[${titulo}]]`);
            const viaTag = b.tags?.some(
              (t: string) => t.toLowerCase() === titulo,
            );
            return (
              <button
                key={b.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  padding: "3px 6px",
                  transition: "background 0.1s",
                  textAlign: "left",
                  width: "100%",
                }}
                onClick={() => onNavigateToPage(b.titulo)}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "color-mix(in srgb, var(--foreground) 4%, transparent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "transparent")
                }
              >
                <span
                  style={{
                    ...mono,
                    fontSize: 8,
                    color: "color-mix(in srgb, var(--accent) 55%, transparent)",
                    flexShrink: 0,
                  }}
                >
                  {viaWikilink && viaTag ? "[[]]#" : viaWikilink ? "[[]]" : "#"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-serif)",
                    fontStyle: "italic",
                    color:
                      "color-mix(in srgb, var(--foreground) 70%, transparent)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.titulo || "sin título"}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}

// ── Sección Formato ──────────────────────────────────────────────────────────
// Aplica comandos de formato sobre el RichEditor activo vía formatCommandRef
// (ver EditorEnsayo.tsx). Cada botón llama a un solo comando — no hay estado
// de "formato activo" acá (ej. si la selección ya está en negrita) porque
// leer eso en tiempo real requeriría escuchar la selección de Lexical desde
// afuera del árbol, algo que ninguna otra parte de NotaPanel hace hoy; se
// puede agregar más adelante si hace falta, pero por ahora los botones
// funcionan como "aplicar/insertar", igual que el menú "/" existente.
function FormatBtn({
  label,
  icon: Icon,
  onClick,
  mono,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  mono: React.CSSProperties;
}) {
  return (
    <button
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "10px 4px",
        borderRadius: 6,
        border: "1px solid transparent",
        background: "color-mix(in srgb, var(--foreground) 3%, transparent)",
        cursor: "pointer",
        transition: "all 0.12s",
      }}
      title={label}
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          "color-mix(in srgb, var(--accent) 12%, transparent)";
        (e.currentTarget as HTMLElement).style.borderColor =
          "color-mix(in srgb, var(--accent) 25%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          "color-mix(in srgb, var(--foreground) 3%, transparent)";
        (e.currentTarget as HTMLElement).style.borderColor = "transparent";
      }}
      // Sin esto, el mousedown le saca el foco al contentEditable del
      // editor ANTES del click — al perder el foco, la selección de
      // Lexical colapsa y el comando (que depende de $getSelection()
      // dentro de FormatCommandPlugin) no tiene dónde aplicarse. Mismo
      // fix que ya usa MarkdownCommandPalette para su propio menú "/".
      onMouseDown={(e) => e.preventDefault()}
    >
      <Icon
        color="color-mix(in srgb, var(--foreground) 60%, transparent)"
        size={15}
        strokeWidth={1.7}
      />
      <span
        style={{
          ...mono,
          fontSize: 7,
          color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function SeccionFormato({
  formatCommandRef,
  mono,
}: {
  formatCommandRef?: React.MutableRefObject<
    ((commandId: RichEditorFormatCommand) => void) | null
  >;
  mono: React.CSSProperties;
}) {
  const apply = (commandId: RichEditorFormatCommand) => {
    formatCommandRef?.current?.(commandId);
  };

  const labelStyle: React.CSSProperties = {
    ...mono,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
    padding: "8px 12px 4px",
    display: "flex",
    alignItems: "center",
    gap: 5,
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 4,
    padding: "0 12px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* ── TEXTO ── */}
      <div style={labelStyle}>
        <Pencil size={7} strokeWidth={1.8} />
        texto
      </div>
      <div style={gridStyle}>
        <FormatBtn
          icon={Bold}
          label="negrita"
          mono={mono}
          onClick={() => apply("bold")}
        />
        <FormatBtn
          icon={Italic}
          label="cursiva"
          mono={mono}
          onClick={() => apply("italic")}
        />
        <FormatBtn
          icon={Underline}
          label="subrayado"
          mono={mono}
          onClick={() => apply("underline")}
        />
        <FormatBtn
          icon={Strikethrough}
          label="tachado"
          mono={mono}
          onClick={() => apply("strikethrough")}
        />
      </div>

      {/* ── DIVISOR ── */}
      <div
        style={{
          margin: "10px 12px 0",
          borderTop:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
        }}
      />

      {/* ── ENCABEZADOS ── */}
      <div style={labelStyle}>
        <Hash size={7} strokeWidth={1.8} />
        encabezados
      </div>
      <div style={gridStyle}>
        <FormatBtn
          icon={Heading1}
          label="título 1"
          mono={mono}
          onClick={() => apply("h1")}
        />
        <FormatBtn
          icon={Heading2}
          label="título 2"
          mono={mono}
          onClick={() => apply("h2")}
        />
        <FormatBtn
          icon={Heading3}
          label="título 3"
          mono={mono}
          onClick={() => apply("h3")}
        />
        <FormatBtn
          icon={Heading4}
          label="título 4"
          mono={mono}
          onClick={() => apply("h4")}
        />
      </div>
      <div style={{ ...gridStyle, marginTop: 4 }}>
        <FormatBtn
          icon={Pilcrow}
          label="normal"
          mono={mono}
          onClick={() => apply("paragraph")}
        />
      </div>

      {/* ── DIVISOR ── */}
      <div
        style={{
          margin: "10px 12px 0",
          borderTop:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
        }}
      />

      {/* ── ALINEACIÓN ── */}
      <div style={labelStyle}>
        <AlignLeft size={7} strokeWidth={1.8} />
        alineación
      </div>
      <div style={gridStyle}>
        <FormatBtn
          icon={AlignLeft}
          label="izquierda"
          mono={mono}
          onClick={() => apply("align-left")}
        />
        <FormatBtn
          icon={AlignCenter}
          label="centro"
          mono={mono}
          onClick={() => apply("align-center")}
        />
        <FormatBtn
          icon={AlignRight}
          label="derecha"
          mono={mono}
          onClick={() => apply("align-right")}
        />
        <FormatBtn
          icon={AlignJustify}
          label="justificar"
          mono={mono}
          onClick={() => apply("align-justify")}
        />
      </div>

      {/* ── DIVISOR ── */}
      <div
        style={{
          margin: "10px 12px 0",
          borderTop:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
        }}
      />

      {/* ── BLOQUES ── */}
      <div style={labelStyle}>
        <Quote size={7} strokeWidth={1.8} />
        bloques
      </div>
      <div style={gridStyle}>
        <FormatBtn
          icon={ListIcon}
          label="viñetas"
          mono={mono}
          onClick={() => apply("bullet")}
        />
        <FormatBtn
          icon={ListOrdered}
          label="numerada"
          mono={mono}
          onClick={() => apply("numbered")}
        />
        <FormatBtn
          icon={Quote}
          label="cita"
          mono={mono}
          onClick={() => apply("quote")}
        />
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function NotaPanel({
  ensayo,
  ensayos,
  tocEntries,
  onUpdateField,
  onNavigateToPage,
  onTagClick,
  formatCommandRef,
}: NotaPanelProps) {
  const [tab, setTab] = useState<NotaPanelTab>("indice");

  const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };

  const tags: string[] = ensayo.tags ?? [];
  const tagsVisiblesCount = useMemo(() => {
    const titulo = ensayo.titulo?.trim().toLowerCase();
    return tags.filter((t) => t.toLowerCase() !== titulo).length;
  }, [tags, ensayo.titulo]);

  const backlinksCount = useMemo(() => {
    const titulo = ensayo.titulo?.trim().toLowerCase();
    if (!titulo) return 0;
    return ensayos.filter((e: any) => {
      if (e.id === ensayo.id) return false;
      const contenido = (e.contenido || "").toLowerCase();
      return (
        contenido.includes(`[[${titulo}]]`) ||
        e.tags?.some((t: string) => t.toLowerCase() === titulo)
      );
    }).length;
  }, [ensayos, ensayo.id, ensayo.titulo]);

  const contextoCount = tagsVisiblesCount + backlinksCount;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Tabs ── */}
      <div
        style={{
          padding: "10px 8px 0",
          borderBottom:
            "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
          display: "flex",
          gap: 2,
          flexShrink: 0,
        }}
      >
        <TabBtn
          active={tab === "indice"}
          count={tocEntries.length}
          icon={Hash}
          label="índice"
          mono={mono}
          onClick={() => setTab("indice")}
        />
        <TabBtn
          active={tab === "contexto"}
          count={contextoCount}
          icon={Tag}
          label="contexto"
          mono={mono}
          onClick={() => setTab("contexto")}
        />
        <TabBtn
          active={tab === "formato"}
          icon={LayoutList}
          label="estructura"
          mono={mono}
          onClick={() => setTab("formato")}
        />
      </div>

      {/* ── Contenido ── */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        <AnimatePresence mode="wait">
          {tab === "indice" && (
            <motion.div
              key="indice"
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              initial={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
            >
              <SeccionIndice entries={tocEntries} mono={mono} />
            </motion.div>
          )}
          {tab === "contexto" && (
            <motion.div
              key="contexto"
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              initial={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
            >
              <SeccionContexto
                ensayo={ensayo}
                ensayos={ensayos}
                mono={mono}
                onNavigateToPage={onNavigateToPage}
                onTagClick={onTagClick}
                onUpdateField={onUpdateField}
              />
            </motion.div>
          )}
          {tab === "formato" && (
            <motion.div
              key="formato"
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              initial={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
            >
              <SeccionFormato formatCommandRef={formatCommandRef} mono={mono} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default NotaPanel;

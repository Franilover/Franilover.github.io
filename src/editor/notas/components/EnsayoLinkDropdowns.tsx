"use client";
/**
 * EnsayoLinkDropdowns.tsx
 * ────────────────────────
 * Dos dropdowns que viven al lado de SubBloqueSelector en la toolbar del
 * RichEditor de Ensayos: "tags" y "menciones". SOLO se usan desde
 * EditorEnsayo.tsx — ningún otro RichEditor (capítulos, criaturas, runas,
 * etc.) los recibe, porque el concepto de tags/menciones de página es
 * específico del sistema de wikilinks [[ ]] entre ensayos.
 *
 * - TagsDropdown: lista los tags del ensayo actual. Lápiz a la izquierda
 *   del trigger abre el modo edición (quitar tags existentes + barra de
 *   búsqueda arriba para buscar y agregar tags — reutiliza el mismo set
 *   de tags de todos los ensayos que ya calculaba NotaPanel/SeccionContexto).
 * - MencionesDropdown: lista los ensayos que mencionan a este (por
 *   wikilink [[título]] o por tag == título). Click en un item navega a
 *   ese ensayo (onNavigateToPage), igual que los backlinks de NotaPanel.
 *
 * Misma lógica de datos que SeccionContexto en NotaPanel.tsx — no se
 * duplica el modelo, solo la presentación (acá como dropdown de toolbar
 * en vez de panel lateral).
 */
import { ChevronDown, Tag, AtSign, Pencil, Search, Plus, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

const microStyle: React.CSSProperties = {
  fontSize: 9,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

function useCloseOnOutsideClick(
  open: boolean,
  onClose: () => void,
): React.MutableRefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);
  return ref;
}

function DropdownTrigger({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  extraLeft,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  /** Botón extra a la izquierda del ícono principal (lápiz, para tags) */
  extraLeft?: React.ReactNode;
}) {
  return (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 5,
        border: active
          ? "1px solid color-mix(in srgb, var(--color-primary,#7c6af7) 35%, transparent)"
          : "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
        background: active
          ? "color-mix(in srgb, var(--color-primary,#7c6af7) 10%, transparent)"
          : "color-mix(in srgb, var(--foreground) 4%, transparent)",
        color: active
          ? "color-mix(in srgb, var(--color-primary,#7c6af7) 85%, white)"
          : "color-mix(in srgb, var(--foreground) 55%, transparent)",
        cursor: "pointer",
      }}
      title={label}
      type="button"
      onClick={onClick}
    >
      {extraLeft}
      <Icon size={10} style={{ flexShrink: 0 }} />
      <span style={{ ...microStyle, fontWeight: 700 }}>{label}</span>
      {count > 0 && (
        <span
          style={{
            ...microStyle,
            fontWeight: 700,
            opacity: 0.6,
          }}
        >
          {count}
        </span>
      )}
      <ChevronDown size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
    </button>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  zIndex: 60,
  minWidth: 240,
  maxWidth: 320,
  maxHeight: 340,
  overflowY: "auto",
  background: "var(--bg-menu)",
  border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
  borderRadius: 8,
  boxShadow: "0 8px 28px color-mix(in srgb, var(--bg-main) 55%, transparent)",
};

// ─────────────────────────────────────────────────────────────────────────────
// TagsDropdown
// ─────────────────────────────────────────────────────────────────────────────

interface TagsDropdownProps {
  ensayo: any;
  ensayos: any[];
  onUpdateField: (id: string, field: string, value: any) => void;
  onTagClick?: (t: string) => void;
}

export function TagsDropdown({
  ensayo,
  ensayos,
  onUpdateField,
  onTagClick,
}: TagsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useCloseOnOutsideClick(open, () => {
    setOpen(false);
    setEditing(false);
    setSearch("");
  });

  const tags: string[] = ensayo.tags ?? [];

  const tagsVisibles = useMemo(() => {
    const titulo = ensayo.titulo?.trim().toLowerCase();
    return tags.filter((t) => t.toLowerCase() !== titulo);
  }, [tags, ensayo.titulo]);

  // Todos los tags existentes en el resto de ensayos, para buscar/tagear.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    ensayos.forEach((e: any) => e.tags?.forEach((t: string) => set.add(t)));
    tags.forEach((t) => set.delete(t));
    return Array.from(set).sort();
  }, [ensayos, tags]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTags.slice(0, 8);
    return allTags.filter((t) => t.toLowerCase().includes(q)).slice(0, 8);
  }, [allTags, search]);

  // Si el texto buscado no existe como tag todavía, se ofrece crear uno nuevo.
  const canCreateNew =
    search.trim().length > 0 &&
    !allTags.some((t) => t.toLowerCase() === search.trim().toLowerCase()) &&
    !tags.some((t) => t.toLowerCase() === search.trim().toLowerCase());

  useEffect(() => {
    if (editing) setTimeout(() => searchRef.current?.focus(), 20);
  }, [editing]);

  const addTag = (t: string) => {
    const val = t.trim().toLowerCase();
    if (val && !tags.includes(val)) {
      onUpdateField(ensayo.id, "tags", [...tags, val]);
    }
    setSearch("");
  };

  const removeTag = (t: string) => {
    onUpdateField(
      ensayo.id,
      "tags",
      tags.filter((x) => x !== t),
    );
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <DropdownTrigger
        active={tagsVisibles.length > 0}
        count={tagsVisibles.length}
        extraLeft={
          <span
            role="button"
            style={{
              display: "flex",
              alignItems: "center",
              color: editing
                ? "color-mix(in srgb, var(--color-primary,#7c6af7) 85%, white)"
                : "color-mix(in srgb, var(--foreground) 35%, transparent)",
              marginRight: 1,
            }}
            title="Editar tags"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setEditing((v) => !v);
            }}
          >
            <Pencil size={10} />
          </span>
        }
        icon={Tag}
        label="tags"
        onClick={() => setOpen((o) => !o)}
      />

      {open && (
        <div style={panelStyle}>
          {editing && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 8px",
                borderBottom:
                  "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)",
              }}
            >
              <Search
                size={10}
                style={{
                  color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
                  flexShrink: 0,
                }}
              />
              <input
                ref={searchRef}
                placeholder="buscar o crear tag..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  ...microStyle,
                  textTransform: "none",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    e.preventDefault();
                    addTag(search);
                  }
                  if (e.key === "Escape") {
                    setSearch("");
                  }
                }}
              />
            </div>
          )}

          {/* Tags actuales del ensayo */}
          {tagsVisibles.length === 0 ? (
            <div
              style={{
                ...microStyle,
                fontWeight: 600,
                textTransform: "none",
                color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
                fontStyle: "italic",
                padding: "10px 10px",
              }}
            >
              sin tags todavía
            </div>
          ) : (
            <div style={{ padding: "4px 6px" }}>
              {tagsVisibles.map((t) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 6px",
                    borderRadius: 5,
                  }}
                >
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: onTagClick ? "pointer" : "default",
                      padding: 0,
                      ...microStyle,
                      textTransform: "none",
                      fontWeight: 600,
                      color: "color-mix(in srgb, var(--accent,#7c6af7) 80%, transparent)",
                      textAlign: "left",
                    }}
                    type="button"
                    onClick={() => {
                      if (editing) return;
                      onTagClick?.(t);
                      setOpen(false);
                    }}
                  >
                    #{t}
                  </button>
                  {editing && (
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 3,
                        color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
                        display: "flex",
                      }}
                      title="Quitar tag"
                      type="button"
                      onClick={() => removeTag(t)}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Resultados de búsqueda / sugerencias para tagear */}
          {editing && (searchResults.length > 0 || canCreateNew) && (
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)",
                padding: "4px 6px",
              }}
            >
              {canCreateNew && (
                <button
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                    padding: "5px 6px",
                    textAlign: "left",
                    color: "color-mix(in srgb, var(--color-primary,#7c6af7) 75%, white)",
                  }}
                  type="button"
                  onClick={() => addTag(search)}
                >
                  <Plus size={10} />
                  <span style={{ ...microStyle, fontWeight: 700, textTransform: "none" }}>
                    crear &quot;{search.trim()}&quot;
                  </span>
                </button>
              )}
              {searchResults.map((t) => (
                <button
                  key={t}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    background: "transparent",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                    padding: "5px 6px",
                    textAlign: "left",
                    color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
                  }}
                  type="button"
                  onClick={() => addTag(t)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "color-mix(in srgb, var(--accent,#7c6af7) 10%, transparent)";
                    (e.currentTarget as HTMLElement).style.color =
                      "color-mix(in srgb, var(--accent,#7c6af7) 85%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      "color-mix(in srgb, var(--foreground) 60%, transparent)";
                  }}
                >
                  <span style={{ ...microStyle, fontWeight: 600, textTransform: "none" }}>
                    #{t}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MencionesDropdown
// ─────────────────────────────────────────────────────────────────────────────

interface MencionesDropdownProps {
  ensayo: any;
  ensayos: any[];
  onNavigateToPage: (name: string) => void;
}

export function MencionesDropdown({
  ensayo,
  ensayos,
  onNavigateToPage,
}: MencionesDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useCloseOnOutsideClick(open, () => setOpen(false));

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

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <DropdownTrigger
        active={backlinks.length > 0}
        count={backlinks.length}
        icon={AtSign}
        label="menciones"
        onClick={() => setOpen((o) => !o)}
      />

      {open && (
        <div style={panelStyle}>
          {backlinks.length === 0 ? (
            <div
              style={{
                ...microStyle,
                fontWeight: 600,
                textTransform: "none",
                color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
                fontStyle: "italic",
                padding: "10px 10px",
              }}
            >
              ninguna nota menciona esta página
            </div>
          ) : (
            <div style={{ padding: "4px 6px" }}>
              {backlinks.map((b: any) => {
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
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "transparent",
                      border: "none",
                      borderRadius: 5,
                      cursor: "pointer",
                      padding: "5px 6px",
                      textAlign: "left",
                    }}
                    type="button"
                    onClick={() => {
                      onNavigateToPage(b.titulo);
                      setOpen(false);
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "color-mix(in srgb, var(--foreground) 5%, transparent)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "transparent")
                    }
                  >
                    <span
                      style={{
                        ...microStyle,
                        fontWeight: 700,
                        color:
                          "color-mix(in srgb, var(--accent,#7c6af7) 60%, transparent)",
                        flexShrink: 0,
                      }}
                    >
                      {viaWikilink && viaTag
                        ? "[[]]#"
                        : viaWikilink
                          ? "[[]]"
                          : "#"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-serif)",
                        fontStyle: "italic",
                        color: "color-mix(in srgb, var(--foreground) 70%, transparent)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.titulo || "sin título"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

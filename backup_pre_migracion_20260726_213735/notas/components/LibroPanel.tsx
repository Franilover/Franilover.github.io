"use client";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, BookCheck, BookDashed, User, Tag, Hash, FileDigit, Bookmark, BookMarked, Plus, X, Quote, Barcode, Star } from "lucide-react";
import React, { useState, useMemo } from "react";

// ── Tipos ──────────────────────────────────────────────────────────────────────
type EstadoLectura = "leyendo" | "leido" | "pendiente" | null;

interface LibroPanelProps {
  ensayo: any;
  ensayos: any[];
  onUpdateField: (id: string, field: string, value: any) => void;
  onOpenLibrosDashboard?: () => void;
  onTagClick?: (t: string) => void;
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const ESTADO_TAGS = ["leyendo", "leido", "pendiente"] as const;
const ESTADO_CONFIG = {
  leyendo:   { label: "leyendo",   icon: BookOpen,    accent: "var(--accent)" },
  leido:     { label: "leído",     icon: BookCheck,   accent: "color-mix(in srgb, var(--foreground) 55%, transparent)" },
  pendiente: { label: "pendiente", icon: BookDashed,  accent: "color-mix(in srgb, var(--foreground) 28%, transparent)" },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function getEstado(tags: string[]): EstadoLectura {
  for (const e of ESTADO_TAGS) {
    if (tags.includes(e)) return e;
  }
  return null;
}

// Extrae el campo "autor" del contenido o de los tags del ensayo.
// Convención: tag con prefijo "autor:" o campo dedicado en el objeto.
function _getAutor(ensayo: any): string {
  return ensayo.autor ?? ensayo.author ?? "";
}

// Devuelve todos los co-tags (excluye "libro" y los de estado)
function getCoTags(tags: string[]): string[] {
  const excluir = new Set(["libro", ...ESTADO_TAGS]);
  return tags.filter(t => !excluir.has(t));
}

// ── Selector de estado ─────────────────────────────────────────────────────────
function EstadoSelector({
  estado,
  onChange,
  mono,
}: {
  estado: EstadoLectura;
  onChange: (nuevo: EstadoLectura) => void;
  mono: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {ESTADO_TAGS.map(e => {
        const cfg = ESTADO_CONFIG[e];
        const Icon = cfg.icon;
        const isActive = estado === e;
        return (
          <button
            key={e}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 5,
              border: "1px solid",
              borderColor: isActive
                ? `color-mix(in srgb, ${cfg.accent} 40%, transparent)`
                : "color-mix(in srgb, var(--foreground) 8%, transparent)",
              background: isActive
                ? `color-mix(in srgb, ${cfg.accent} 10%, transparent)`
                : "transparent",
              color: isActive ? cfg.accent : "color-mix(in srgb, var(--foreground) 28%, transparent)",
              cursor: "pointer",
              transition: "all 0.12s",
              ...mono,
              fontSize: 9,
              textTransform: "lowercase",
              letterSpacing: "0.04em",
            }}
            title={cfg.label}
            onClick={() => onChange(isActive ? null : e)}
          >
            <Icon size={9} strokeWidth={isActive ? 2.2 : 1.8} />
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Selector numérico ──────────────────────────────────────────────────────────
function PaginasInput({
  label,
  value,
  onChange,
  max,
  icon,
  mono,
  accent,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number | null;
  icon: React.ReactNode;
  mono: React.CSSProperties;
  accent?: string;
}) {
  const [focused, setFocused] = useState(false);

  const porcentaje = max && max > 0 && value != null ? Math.min(100, Math.round((value / max) * 100)) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}>
          {icon}
        </span>
        <span style={{
          ...mono, fontSize: 8,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
        }}>
          {label}
        </span>
        {porcentaje !== null && (
          <span style={{
            ...mono, fontSize: 7,
            marginLeft: "auto",
            color: accent ?? "color-mix(in srgb, var(--accent) 60%, transparent)",
          }}>
            {porcentaje}%
          </span>
        )}
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 8px",
        borderRadius: 5,
        border: `1px solid ${focused
          ? "color-mix(in srgb, var(--foreground) 18%, transparent)"
          : "color-mix(in srgb, var(--foreground) 8%, transparent)"}`,
        background: focused
          ? "color-mix(in srgb, var(--foreground) 3%, transparent)"
          : "transparent",
        transition: "all 0.1s",
      }}>
        <input
          max={max ?? undefined}
          min={0}
          placeholder="—"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            ...mono,
            fontSize: 13,
            color: "color-mix(in srgb, var(--foreground) 75%, transparent)",
            letterSpacing: "-0.02em",
          }}
          type="number"
          value={value ?? ""}
          onBlur={() => setFocused(false)}
          onChange={e => {
            const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
            onChange(isNaN(v as any) ? null : v);
          }}
          onFocus={() => setFocused(true)}
        />
        <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 15%, transparent)", flexShrink: 0 }}>
          p.
        </span>
      </div>

      {/* Progress bar — solo aparece en "página actual" cuando hay total */}
      {porcentaje !== null && (
        <div style={{
          height: 2,
          borderRadius: 99,
          background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
          overflow: "hidden",
        }}>
          <motion.div
            animate={{ width: `${porcentaje}%` }}
            initial={{ width: 0 }}
            style={{
              height: "100%",
              borderRadius: 99,
              background: accent ?? "var(--accent)",
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
}

// ── Input de texto inline ──────────────────────────────────────────────────────
function InlineTextInput({
  value,
  onChange,
  placeholder,
  icon,
  label,
  mono,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  label: string;
  mono: React.CSSProperties;
  suggestions?: string[];
}) {
  const [focused, setFocused] = useState(false);
  const [showSug, setShowSug] = useState(false);

  const filtered = useMemo(() => {
    if (!value.trim() || !suggestions?.length) return [];
    const q = value.trim().toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(q) && s !== value).slice(0, 5);
  }, [value, suggestions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}>
          {icon}
        </span>
        <span style={{
          ...mono, fontSize: 8,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
        }}>
          {label}
        </span>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "5px 8px",
        borderRadius: 5,
        border: `1px solid ${focused
          ? "color-mix(in srgb, var(--foreground) 18%, transparent)"
          : "color-mix(in srgb, var(--foreground) 8%, transparent)"}`,
        background: focused
          ? "color-mix(in srgb, var(--foreground) 3%, transparent)"
          : "transparent",
        transition: "all 0.1s",
      }}>
        <input
          placeholder={placeholder}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            ...mono,
            fontSize: 11,
            color: "color-mix(in srgb, var(--foreground) 75%, transparent)",
          }}
          type="text"
          value={value}
          onBlur={() => { setFocused(false); setTimeout(() => setShowSug(false), 150); }}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { setFocused(true); setShowSug(true); }}
        />
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {showSug && filtered.length > 0 && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 50,
              background: "var(--bg-menu)",
              border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
              borderRadius: 5,
              overflow: "hidden",
              boxShadow: "0 6px 20px color-mix(in srgb, var(--bg-main) 50%, transparent)",
            }}
            transition={{ duration: 0.1 }}
          >
            {filtered.map(s => (
              <button
                key={s}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  ...mono,
                  fontSize: 10,
                  color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
                  transition: "background 0.08s",
                }}
                onMouseDown={() => { onChange(s); setShowSug(false); }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--foreground) 5%, transparent)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tag selector inline ────────────────────────────────────────────────────────
function TagSelector({
  tags,
  allTags,
  onAddTag,
  onRemoveTag,
  mono,
  onOpenLibrosDashboard,
  onTagClick,
  tituloPropio,
}: {
  tags: string[];
  allTags: string[];
  onAddTag: (t: string) => void;
  onRemoveTag: (t: string) => void;
  mono: React.CSSProperties;
  onOpenLibrosDashboard?: () => void;
  onTagClick?: (t: string) => void;
  tituloPropio?: string;
}) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const tituloNorm = tituloPropio?.trim().toLowerCase();
  const coTags = getCoTags(tags).filter(t => t.toLowerCase() !== tituloNorm);

  const suggestions = useMemo(() => {
    if (!input.trim()) return [];
    const q = input.trim().toLowerCase();
    return allTags
      .filter(t => !tags.includes(t) && t.toLowerCase().includes(q))
      .slice(0, 6);
  }, [input, allTags, tags]);

  const addTag = (t: string) => {
    const val = t.trim().toLowerCase();
    if (val && !tags.includes(val)) onAddTag(val);
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Tag size={9} style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }} />
        <span style={{
          ...mono, fontSize: 8,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
        }}>
          etiquetas
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
        {/* libro chip — fijo, clickeable → abre LibrosDashboard */}
        <button
          style={{
            ...mono, fontSize: 9,
            padding: "2px 7px",
            borderRadius: 3,
            background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
            color: "color-mix(in srgb, var(--foreground) 45%, transparent)",
            cursor: onOpenLibrosDashboard ? "pointer" : "default",
            transition: "all 0.1s",
          }}
          onClick={onOpenLibrosDashboard}
          onMouseEnter={e => {
            if (!onOpenLibrosDashboard) return;
            (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 10%, transparent)";
            (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--accent) 28%, transparent)";
            (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--accent) 80%, transparent)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--foreground) 6%, transparent)";
            (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--foreground) 10%, transparent)";
            (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--foreground) 45%, transparent)";
          }}
        >
          #libro ↗
        </button>

        {coTags.map(t => (
          <span
            key={t}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0,
              ...mono, fontSize: 9,
              borderRadius: 3,
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
              overflow: "hidden",
            }}
          >
            <button
              style={{
                background: "none", border: "none", cursor: onTagClick ? "pointer" : "default",
                padding: "2px 4px 2px 7px",
                color: "color-mix(in srgb, var(--accent) 80%, transparent)",
                ...mono, fontSize: 9,
                transition: "color 0.1s, background 0.1s",
              }}
              onClick={() => onTagClick?.(t)}
              onMouseEnter={e => {
                if (!onTagClick) return;
                (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 18%, transparent)";
                (e.currentTarget as HTMLElement).style.color = "var(--accent)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "none";
                (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--accent) 80%, transparent)";
              }}
            >
              #{t}
            </button>
            <button
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "2px 5px 2px 2px",
                color: "color-mix(in srgb, var(--accent) 40%, transparent)",
                fontSize: 10, lineHeight: 1,
                display: "flex", alignItems: "center",
              }}
              onClick={() => onRemoveTag(t)}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--accent) 80%, transparent)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--accent) 40%, transparent)"}
            >
              ×
            </button>
          </span>
        ))}

        {/* Input nuevo tag */}
        <div style={{ position: "relative" }}>
          <input
            placeholder="+ tag"
            style={{
              ...mono, fontSize: 9,
              padding: "2px 7px",
              borderRadius: 3,
              border: "1px dashed color-mix(in srgb, var(--foreground) 12%, transparent)",
              background: focused ? "color-mix(in srgb, var(--foreground) 3%, transparent)" : "transparent",
              color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
              outline: "none",
              width: input ? 110 : 50,
              transition: "width 0.12s, background 0.1s",
            }}
            type="text"
            value={input}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
              if (e.key === "Escape") { setInput(""); }
            }}
          />
          <AnimatePresence>
            {focused && suggestions.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: -4 }}
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: 0,
                  background: "var(--bg-menu)",
                  border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                  borderRadius: 4,
                  padding: "3px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  zIndex: 50,
                  minWidth: 120,
                  boxShadow: "0 -4px 12px color-mix(in srgb, var(--foreground) 8%, transparent)",
                }}
                transition={{ duration: 0.1 }}
              >
                {suggestions.map(t => (
                  <button
                    key={t}
                    style={{
                      ...mono, fontSize: 9,
                      color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
                      background: "transparent",
                      border: "none", borderRadius: 3,
                      padding: "3px 8px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseDown={() => addTag(t)}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 12%, transparent)";
                      (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--accent) 90%, transparent)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--foreground) 60%, transparent)";
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
    </div>
  );
}

// ── Sección: calificación personal ────────────────────────────────────────────
function CalificacionSelector({
  value,
  onChange,
  mono,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  mono: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const displayed = hovered ?? value ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Star size={9} style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }} />
        <span style={{
          ...mono, fontSize: 8,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
        }}>calificación</span>
        {value !== null && (
          <button
            style={{
              marginLeft: "auto",
              background: "none", border: "none", cursor: "pointer", padding: 0,
              ...mono, fontSize: 8,
              color: "color-mix(in srgb, var(--foreground) 20%, transparent)",
              transition: "color 0.1s",
            }}
            title="quitar calificación"
            onClick={() => onChange(null)}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--foreground) 45%, transparent)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--foreground) 20%, transparent)"}
          >
            limpiar
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "2px 1px",
              display: "flex", alignItems: "center",
              transition: "transform 0.1s",
              transform: hovered !== null && n <= hovered ? "scale(1.15)" : "scale(1)",
            }}
            title={`${n} estrella${n > 1 ? "s" : ""}`}
            onClick={() => onChange(value === n ? null : n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
          >
            <Star
              fill={n <= displayed ? "var(--accent)" : "transparent"}
              size={18}
              stroke={n <= displayed
                ? "var(--accent)"
                : "color-mix(in srgb, var(--foreground) 18%, transparent)"}
              strokeWidth={1.5}
            />
          </button>
        ))}
        {value !== null && (
          <span style={{
            ...mono, fontSize: 9, marginLeft: 6,
            color: "color-mix(in srgb, var(--foreground) 35%, transparent)",
          }}>
            {value}/5
          </span>
        )}
      </div>
    </div>
  );
}

// ── Sección: citas del libro ──────────────────────────────────────────────────
interface CitaEntry {
  texto: string;
  pagina?: number;
}

function CitasLibro({
  citas,
  onUpdate,
  mono,
}: {
  citas: CitaEntry[];
  onUpdate: (list: CitaEntry[]) => void;
  mono: React.CSSProperties;
}) {
  const [inputTexto, setInputTexto] = useState("");
  const [inputPagina, setInputPagina] = useState("");
  const [focused, setFocused] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const add = () => {
    const t = inputTexto.trim();
    if (!t) return;
    const p = inputPagina.trim() ? parseInt(inputPagina.trim(), 10) : undefined;
    onUpdate([...citas, { texto: t, pagina: isNaN(p as number) ? undefined : p }]);
    setInputTexto("");
    setInputPagina("");
  };

  const remove = (idx: number) => {
    onUpdate(citas.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const updateCita = (idx: number, field: "texto" | "pagina", val: string) => {
    const next = citas.map((c, i) => {
      if (i !== idx) return c;
      if (field === "texto") return { ...c, texto: val };
      const p = val ? parseInt(val, 10) : undefined;
      return { ...c, pagina: isNaN(p as number) ? undefined : p };
    });
    onUpdate(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Quote size={9} style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }} />
        <span style={{
          ...mono, fontSize: 8,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
        }}>
          citas
        </span>
        {citas.length > 0 && (
          <span style={{
            ...mono, fontSize: 7,
            marginLeft: "auto",
            padding: "1px 6px",
            borderRadius: 99,
            background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
            color: "color-mix(in srgb, var(--foreground) 35%, transparent)",
          }}>
            {citas.length}
          </span>
        )}
      </div>

      {/* Lista */}
      <AnimatePresence initial={false}>
        {citas.map((cita, idx) => (
          <motion.div
            key={idx}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
            transition={{ duration: 0.15 }}
          >
            <div style={{
              borderRadius: 5,
              border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
              background: "color-mix(in srgb, var(--accent) 2%, var(--bg-main))",
              overflow: "hidden",
              marginBottom: 4,
            }}>
              {/* Fila principal */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 8px" }}>
                <span style={{
                  ...mono, fontSize: 14,
                  color: "color-mix(in srgb, var(--accent) 25%, transparent)",
                  lineHeight: 1,
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  &quot;
                </span>
                <button
                  style={{
                    flex: 1,
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "var(--font-serif)",
                    fontStyle: "italic",
                    fontSize: 11,
                    color: "color-mix(in srgb, var(--foreground) 72%, transparent)",
                    lineHeight: 1.4,
                    letterSpacing: "0.01em",
                    display: "-webkit-box",
                    WebkitLineClamp: expandedIdx === idx ? "unset" as any : 2,
                    WebkitBoxOrient: "vertical" as any,
                    overflow: expandedIdx === idx ? "visible" : "hidden",
                    textOverflow: "ellipsis",
                  }}
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                >
                  {cita.texto}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {cita.pagina && (
                    <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}>
                      p.{cita.pagina}
                    </span>
                  )}
                  <button
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "0 2px",
                      color: "color-mix(in srgb, var(--foreground) 18%, transparent)",
                      display: "flex", alignItems: "center", transition: "color 0.1s",
                    }}
                    onClick={() => remove(idx)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--foreground) 55%, transparent)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--foreground) 18%, transparent)"}
                  >
                    <X size={9} />
                  </button>
                </div>
              </div>

              {/* Edición expandida */}
              <AnimatePresence>
                {expandedIdx === idx && (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    style={{ overflow: "hidden" }}
                    transition={{ duration: 0.15 }}
                  >
                    <div style={{
                      borderTop: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
                      padding: "6px 8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}>
                      <textarea
                        rows={3}
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          fontFamily: "var(--font-serif)",
                          fontStyle: "italic",
                          fontSize: 11,
                          color: "color-mix(in srgb, var(--foreground) 65%, transparent)",
                          resize: "none",
                          lineHeight: 1.5,
                        }}
                        value={cita.texto}
                        onChange={e => updateCita(idx, "texto", e.target.value)}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}>
                          página
                        </span>
                        <input
                          min={1}
                          placeholder="—"
                          style={{
                            width: 48, background: "transparent", border: "none", outline: "none",
                            ...mono, fontSize: 11,
                            color: "color-mix(in srgb, var(--foreground) 60%, transparent)",
                          }}
                          type="number"
                          value={cita.pagina ?? ""}
                          onChange={e => updateCita(idx, "pagina", e.target.value)}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Input nueva cita */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 4, padding: "6px 8px", borderRadius: 5,
        border: `1px dashed ${focused
          ? "color-mix(in srgb, var(--accent) 25%, transparent)"
          : "color-mix(in srgb, var(--foreground) 9%, transparent)"}`,
        background: focused ? "color-mix(in srgb, var(--accent) 2%, transparent)" : "transparent",
        transition: "all 0.1s",
      }}>
        <textarea
          placeholder="añadir cita..."
          rows={2}
          style={{
            background: "transparent", border: "none", outline: "none", resize: "none",
            fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 11,
            color: "color-mix(in srgb, var(--foreground) 65%, transparent)",
            lineHeight: 1.5, width: "100%",
          }}
          value={inputTexto}
          onBlur={() => setFocused(false)}
          onChange={e => setInputTexto(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={e => {
            if (e.key === "Escape") { setInputTexto(""); setInputPagina(""); }
          }}
        />
        {inputTexto.trim() && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}>p.</span>
            <input
              min={1}
              placeholder="—"
              style={{
                width: 48, background: "transparent", border: "none", outline: "none",
                ...mono, fontSize: 11,
                color: "color-mix(in srgb, var(--foreground) 55%, transparent)",
              }}
              type="number"
              value={inputPagina}
              onChange={e => setInputPagina(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            />
            <button
              style={{
                marginLeft: "auto",
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                borderRadius: 4, cursor: "pointer", padding: "2px 6px",
                display: "flex", alignItems: "center", gap: 4,
                color: "color-mix(in srgb, var(--accent) 80%, transparent)",
                transition: "all 0.1s", flexShrink: 0,
                ...mono, fontSize: 9,
              }}
              onClick={add}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 22%, transparent)";
                (e.currentTarget as HTMLElement).style.color = "var(--accent)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 12%, transparent)";
                (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--accent) 80%, transparent)";
              }}
            >
              <Plus size={9} /> guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sección: palabras nuevas ───────────────────────────────────────────────────
interface PalabraEntry {
  palabra: string;
  definicion?: string;
}

function PalabrasNuevas({
  palabras,
  onUpdate,
  mono,
}: {
  palabras: PalabraEntry[];
  onUpdate: (list: PalabraEntry[]) => void;
  mono: React.CSSProperties;
}) {
  const [inputPalabra, setInputPalabra] = useState("");
  const [inputDef, setInputDef] = useState("");
  const [focused, setFocused] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const add = () => {
    const p = inputPalabra.trim();
    if (!p) return;
    onUpdate([...palabras, { palabra: p, definicion: inputDef.trim() || undefined }]);
    setInputPalabra("");
    setInputDef("");
  };

  const remove = (idx: number) => {
    onUpdate(palabras.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const updateDef = (idx: number, def: string) => {
    const next = palabras.map((e, i) => i === idx ? { ...e, definicion: def || undefined } : e);
    onUpdate(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <BookMarked size={9} style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }} />
        <span style={{
          ...mono, fontSize: 8,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
        }}>
          palabras nuevas
        </span>
        {palabras.length > 0 && (
          <span style={{
            ...mono, fontSize: 7,
            marginLeft: "auto",
            padding: "1px 6px",
            borderRadius: 99,
            background: "color-mix(in srgb, var(--foreground) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
            color: "color-mix(in srgb, var(--foreground) 35%, transparent)",
          }}>
            {palabras.length}
          </span>
        )}
      </div>

      {/* Lista */}
      <AnimatePresence initial={false}>
        {palabras.map((entry, idx) => (
          <motion.div
            key={idx}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
            transition={{ duration: 0.15 }}
          >
            <div style={{
              borderRadius: 5,
              border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
              background: "color-mix(in srgb, var(--foreground) 2%, transparent)",
              overflow: "hidden",
              marginBottom: 4,
            }}>
              {/* Fila principal */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px" }}>
                <button
                  style={{
                    flex: 1,
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    ...mono, fontSize: 11,
                    color: "color-mix(in srgb, var(--foreground) 75%, transparent)",
                    letterSpacing: "-0.01em",
                  }}
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                >
                  {entry.palabra}
                </button>
                {entry.definicion && expandedIdx !== idx && (
                  <span style={{
                    ...mono, fontSize: 8,
                    color: "color-mix(in srgb, var(--foreground) 28%, transparent)",
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {entry.definicion}
                  </span>
                )}
                <button
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: "0 2px",
                    color: "color-mix(in srgb, var(--foreground) 20%, transparent)",
                    display: "flex", alignItems: "center",
                    transition: "color 0.1s", flexShrink: 0,
                  }}
                  title="eliminar"
                  onClick={() => remove(idx)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--foreground) 55%, transparent)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--foreground) 20%, transparent)"}
                >
                  <X size={9} />
                </button>
              </div>

              {/* Definición expandida */}
              <AnimatePresence>
                {expandedIdx === idx && (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    style={{ overflow: "hidden" }}
                    transition={{ duration: 0.15 }}
                  >
                    <div style={{
                      borderTop: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)",
                      padding: "5px 8px",
                    }}>
                      <input
                        placeholder="definición o nota..."
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          ...mono, fontSize: 10,
                          color: "color-mix(in srgb, var(--foreground) 55%, transparent)",
                          letterSpacing: "0.01em",
                        }}
                        type="text"
                        value={entry.definicion ?? ""}
                        onChange={e => updateDef(idx, e.target.value)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Input nueva palabra */}
      <div style={{
        display: "flex", gap: 5, padding: "5px 8px", borderRadius: 5,
        border: `1px dashed ${focused
          ? "color-mix(in srgb, var(--foreground) 16%, transparent)"
          : "color-mix(in srgb, var(--foreground) 9%, transparent)"}`,
        background: focused ? "color-mix(in srgb, var(--foreground) 2%, transparent)" : "transparent",
        transition: "all 0.1s",
        alignItems: "center",
      }}>
        <input
          placeholder="nueva palabra..."
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            ...mono, fontSize: 11,
            color: "color-mix(in srgb, var(--foreground) 70%, transparent)",
            letterSpacing: "-0.01em",
          }}
          type="text"
          value={inputPalabra}
          onBlur={() => setFocused(false)}
          onChange={e => setInputPalabra(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
            if (e.key === "Escape") { setInputPalabra(""); setInputDef(""); }
          }}
        />
        {inputPalabra.trim() && (
          <>
            <span style={{ color: "color-mix(in srgb, var(--foreground) 10%, transparent)", fontSize: 10, userSelect: "none" }}>|</span>
            <input
              placeholder="definición..."
              style={{
                flex: 1.5, background: "transparent", border: "none", outline: "none",
                ...mono, fontSize: 10,
                color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
                letterSpacing: "0.01em",
              }}
              type="text"
              value={inputDef}
              onChange={e => setInputDef(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            />
            <button
              style={{
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                borderRadius: 4, cursor: "pointer", padding: "2px 4px",
                display: "flex", alignItems: "center",
                color: "color-mix(in srgb, var(--accent) 80%, transparent)",
                transition: "all 0.1s", flexShrink: 0,
              }}
              onClick={add}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 22%, transparent)";
                (e.currentTarget as HTMLElement).style.color = "var(--accent)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 12%, transparent)";
                (e.currentTarget as HTMLElement).style.color = "color-mix(in srgb, var(--accent) 80%, transparent)";
              }}
            >
              <Plus size={9} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function LibroPanel({ ensayo, ensayos, onUpdateField, onOpenLibrosDashboard, onTagClick }: LibroPanelProps) {
  const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };

  const tags: string[] = ensayo.tags ?? [];
  const estado = getEstado(tags);

  // ── Estado local (igual que localTitulo/localContenido en Editor) ──────────
  // Estos campos se actualizan instantáneamente en la UI; onUpdateField los
  // persiste en background con debounce. Sin estado local el input queda
  // congelado hasta que Supabase confirma (~1.5s).
  const [localAutor,        setLocalAutor]        = useState<string>(ensayo.autor ?? "");
  const [localPaginasTotal, setLocalPaginasTotal] = useState<number | null>(ensayo.paginas_total ?? null);
  const [localPaginaActual, setLocalPaginaActual] = useState<number | null>(ensayo.pagina_actual ?? null);
  const [localPalabras,     setLocalPalabras]     = useState<PalabraEntry[]>(ensayo.palabras_nuevas ?? []);
  const [localCitas,        setLocalCitas]        = useState<CitaEntry[]>(ensayo.citas ?? []);
  const [localCalificacion, setLocalCalificacion] = useState<number | null>(ensayo.calificacion ?? null);
  const [localIsbn,         setLocalIsbn]         = useState<string>(ensayo.isbn ?? "");

  // Sincronizar cuando cambia de nota (ensayo.id)
  const prevIdRef = React.useRef<string>(ensayo.id);
  if (prevIdRef.current !== ensayo.id) {
    prevIdRef.current      = ensayo.id;
    setLocalAutor(ensayo.autor ?? "");
    setLocalPaginasTotal(ensayo.paginas_total ?? null);
    setLocalPaginaActual(ensayo.pagina_actual ?? null);
    setLocalPalabras(ensayo.palabras_nuevas ?? []);
    setLocalCitas(ensayo.citas ?? []);
    setLocalIsbn(ensayo.isbn ?? "");
    setLocalCalificacion(ensayo.calificacion ?? null);
  }

  // Todos los autores conocidos (para autocomplete)
  const allAutores = useMemo(() => {
    const set = new Set<string>();
    ensayos.forEach((e: any) => {
      if (e.autor) set.add(e.autor);
    });
    return Array.from(set).sort();
  }, [ensayos]);

  // Todos los tags conocidos (para autocomplete en el selector de tags)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    ensayos.forEach((e: any) => e.tags?.forEach((t: string) => set.add(t)));
    tags.forEach(t => set.delete(t));
    return Array.from(set).sort();
  }, [ensayos, tags]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleEstado = (nuevo: EstadoLectura) => {
    const sinEstado = tags.filter(t => !ESTADO_TAGS.includes(t as any));
    const next = nuevo ? [...sinEstado, nuevo] : sinEstado;
    onUpdateField(ensayo.id, "tags", next);
  };

  const handleAutor = (v: string) => {
    setLocalAutor(v);
    onUpdateField(ensayo.id, "autor", v);
  };

  const handlePaginasTotal = (v: number | null) => {
    setLocalPaginasTotal(v);
    onUpdateField(ensayo.id, "paginas_total", v);
  };

  const handlePaginaActual = (v: number | null) => {
    setLocalPaginaActual(v);
    onUpdateField(ensayo.id, "pagina_actual", v);
  };

  const handleAddTag = (t: string) => {
    onUpdateField(ensayo.id, "tags", [...tags, t]);
  };

  const handleRemoveTag = (t: string) => {
    onUpdateField(ensayo.id, "tags", tags.filter(x => x !== t));
  };

  const handlePalabras = (list: PalabraEntry[]) => {
    setLocalPalabras(list);
    onUpdateField(ensayo.id, "palabras_nuevas", list);
  };

  const handleCitas = (list: CitaEntry[]) => {
    setLocalCitas(list);
    onUpdateField(ensayo.id, "citas", list);
  };

  const handleCalificacion = (v: number | null) => {
    setLocalCalificacion(v);
    onUpdateField(ensayo.id, "calificacion", v);
  };

  const handleIsbnBlur = () => {
    onUpdateField(ensayo.id, "isbn", localIsbn.trim() || null);
  };

  // ── Progress % — usa estado local para respuesta inmediata ──
  const progreso = localPaginasTotal && localPaginasTotal > 0 && localPaginaActual != null
    ? Math.min(100, Math.round((localPaginaActual / localPaginasTotal) * 100))
    : null;

  const estadoActual = estado ? ESTADO_CONFIG[estado] : null;

  return (
    <div style={{
      padding: "16px 20px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* ── Header fila ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Icono libro */}
        <div style={{
          width: 22, height: 22, borderRadius: 4,
          background: estadoActual
            ? `color-mix(in srgb, ${estadoActual.accent} 12%, transparent)`
            : "color-mix(in srgb, var(--foreground) 5%, transparent)",
          border: `1px solid ${estadoActual
            ? `color-mix(in srgb, ${estadoActual.accent} 25%, transparent)`
            : "color-mix(in srgb, var(--foreground) 10%, transparent)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.2s",
        }}>
          <BookOpen size={10} style={{
            color: estadoActual
              ? estadoActual.accent
              : "color-mix(in srgb, var(--foreground) 30%, transparent)",
            transition: "color 0.2s",
          }} />
        </div>

        <span style={{
          ...mono, fontSize: 8,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
        }}>
          libro
        </span>

        {/* Estado badge */}
        {estadoActual && (
          <span style={{
            ...mono, fontSize: 8,
            padding: "1px 7px",
            borderRadius: 99,
            background: `color-mix(in srgb, ${estadoActual.accent} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${estadoActual.accent} 22%, transparent)`,
            color: estadoActual.accent,
          }}>
            {estadoActual.label}
          </span>
        )}

        {/* Progreso en línea */}
        {progreso !== null && (
          <span style={{
            ...mono, fontSize: 8,
            color: "color-mix(in srgb, var(--accent) 55%, transparent)",
            marginLeft: "auto",
          }}>
            {progreso}% leído
          </span>
        )}
      </div>

      {/* ── Fila: Estado + Autor ── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Estado de lectura */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Bookmark size={9} style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }} />
            <span style={{
              ...mono, fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
            }}>
              estado
            </span>
          </div>
          <EstadoSelector estado={estado} mono={mono} onChange={handleEstado} />
        </div>

        {/* Autor */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <InlineTextInput
            icon={<User size={9} />}
            label="autor"
            mono={mono}
            placeholder="autor..."
            suggestions={allAutores}
            value={localAutor}
            onChange={handleAutor}
          />
        </div>
      </div>

      {/* ── Fila: Páginas ── */}
      <div style={{ display: "flex", gap: 12 }}>
        <PaginasInput
          icon={<FileDigit size={9} />}
          label="páginas totales"
          mono={mono}
          value={localPaginasTotal}
          onChange={handlePaginasTotal}
        />
        <PaginasInput
          accent="var(--accent)"
          icon={<Hash size={9} />}
          label="página actual"
          max={localPaginasTotal}
          mono={mono}
          value={localPaginaActual}
          onChange={handlePaginaActual}
        />
      </div>

      {/* ── Fila: ISBN ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Barcode size={9} style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }} />
          <span style={{
            ...mono, fontSize: 8,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
          }}>isbn</span>
        </div>
        <input
          maxLength={17}
          placeholder="978-..."
          style={{
            background: "transparent",
            border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
            borderRadius: 5,
            padding: "5px 8px",
            outline: "none",
            ...mono, fontSize: 11,
            color: "color-mix(in srgb, var(--foreground) 65%, transparent)",
            letterSpacing: "0.04em",
            width: "100%",
            transition: "border-color 0.15s",
          }}
          type="text"
          value={localIsbn}
          onBlur={handleIsbnBlur}
          onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--foreground) 8%, transparent)"}
          onChange={e => setLocalIsbn(e.target.value)}
          onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--foreground) 18%, transparent)"}
        />
      </div>

      {/* ── Calificación ── */}
      <CalificacionSelector
        mono={mono}
        value={localCalificacion}
        onChange={handleCalificacion}
      />

      {/* ── Fila: Tags ── */}
      <TagSelector
        allTags={allTags}
        mono={mono}
        tags={tags}
        tituloPropio={ensayo.titulo}
        onAddTag={handleAddTag}
        onOpenLibrosDashboard={onOpenLibrosDashboard}
        onRemoveTag={handleRemoveTag}
        onTagClick={onTagClick}
      />

      {/* ── Sección: Palabras nuevas ── */}
      <div style={{ borderTop: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)", paddingTop: 14 }}>
        <PalabrasNuevas
          mono={mono}
          palabras={localPalabras}
          onUpdate={handlePalabras}
        />
      </div>

      {/* ── Sección: Citas ── */}
      <div style={{ borderTop: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)", paddingTop: 14 }}>
        <CitasLibro
          citas={localCitas}
          mono={mono}
          onUpdate={handleCitas}
        />
      </div>
    </div>
  );
}

export default LibroPanel;
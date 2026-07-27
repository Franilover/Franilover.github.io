"use client";
import { ChevronDown, Check, X, Search, Pencil } from "lucide-react";
import Image from "next/image";
/* ─────────────────────────────────────────────────────────────────────────────
   ComboSelector — selector reutilizable con búsqueda, flechas y Tab
   ─────────────────────────────────────────────────────────────────────────────
   Props:
   - items: lista de opciones { id, label, sublabel?, imgUrl? }
   - value: id seleccionado (modo single) | id[] (modo multi)
   - onChange: callback
   - mode: "single" | "multi"
   - label: etiqueta encima del campo
   - icon: ReactNode opcional (icono junto al label)
   - placeholder: texto cuando no hay selección
   - emptyText: texto cuando no hay resultados
   - loading: mostrar spinner
   - hint: texto pequeño junto al label (ej: "se desbloquean al terminar")
   - allowNone: en modo single, muestra opción "Ninguno" (default true)
   - noneLabel: texto para la opción vacía (default "Ninguno")
   - renderBadge: render custom para el badge en modo multi
   ───────────────────────────────────────────────────────────────────────────── */

export interface ComboItem {
  id: string;
  label: string;
  sublabel?: string;
  imgUrl?: string | null;
  group?: string; // optional group key for sectioned display
}

export interface ComboGroup {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

type SingleProps = {
  mode: "single";
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
};

type MultiProps = {
  mode: "multi";
  value: string[];
  onChange: (ids: string[]) => void;
};

type ComboSelectorProps = {
  items: ComboItem[];
  groups?: ComboGroup[]; // if provided, items with group= will be rendered under section headers
  label?: string;
  icon?: React.ReactNode;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  hint?: string;
  className?: string;
  onNavigate?: (id: string, label: string) => void;
} & (SingleProps | MultiProps);

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

export function ComboSelector(props: ComboSelectorProps) {
  const {
    items,
    groups,
    label,
    icon,
    placeholder,
    emptyText = "Sin resultados",
    loading,
    hint,
    className = "",
    onNavigate,
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Items filtrados por búsqueda ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items
      .filter(
        (it) =>
          it.label.toLowerCase().startsWith(q) ||
          it.label.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        // Priorizar los que empiezan con la query
        const aStarts = a.label.toLowerCase().startsWith(q);
        const bStarts = b.label.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      });
  }, [items, query]);

  // ── Helpers de valor ─────────────────────────────────────────────────────
  const isSelected = useCallback(
    (id: string) => {
      if (props.mode === "single") return props.value === id;
      return props.value.includes(id);
    },
    [props],
  );

  const toggle = useCallback(
    (id: string) => {
      if (props.mode === "single") {
        props.onChange(props.value === id ? null : id);
        setOpen(false);
        setQuery("");
        setCursor(-1);
      } else {
        props.onChange(
          props.value.includes(id)
            ? props.value.filter((x) => x !== id)
            : [...props.value, id],
        );
        // En multi: mantener abierto
        setQuery("");
        setCursor(-1);
        inputRef.current?.focus();
      }
    },
    [props],
  );

  const selectNone = useCallback(() => {
    if (props.mode === "single") {
      props.onChange(null);
      setOpen(false);
      setQuery("");
      setCursor(-1);
    }
  }, [props]);

  const removeItem = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (props.mode === "multi") {
        props.onChange(props.value.filter((x) => x !== id));
      } else {
        props.onChange(null);
      }
    },
    [props],
  );

  // ── Labels de selección ───────────────────────────────────────────────────
  const selectedItems =
    props.mode === "single"
      ? props.value
        ? items.filter((it) => it.id === props.value)
        : []
      : items.filter((it) => (props.value as string[]).includes(it.id));

  const triggerLabel = loading
    ? "Cargando…"
    : selectedItems.length === 0
      ? (placeholder ?? (props.mode === "multi" ? "Añadir…" : "Seleccionar…"))
      : props.mode === "single"
        ? selectedItems[0]?.label
        : `${selectedItems.length} seleccionado${selectedItems.length > 1 ? "s" : ""}`;

  // ── Cerrar al click fuera ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
        setCursor(-1);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // ── Focus al input al abrir ───────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQuery("");
      setCursor(-1);
    }
  }, [open]);

  // ── Scroll del cursor visible ─────────────────────────────────────────────
  useEffect(() => {
    if (cursor < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-idx="${cursor}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // ── Lista con opción "Ninguno" en single ──────────────────────────────────
  const showNone = props.mode === "single" && props.allowNone !== false;
  // cursor 0 = Ninguno (si aplica), resto = filtered[cursor - (showNone?1:0)]
  const cursorMax = filtered.length + (showNone ? 1 : 0) - 1;

  // ── Teclado ───────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, cursorMax));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, showNone ? 0 : 0));
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      if (cursor < 0 && filtered.length > 0) {
        // Tab sin cursor: selecciona el primero del filtro
        if (showNone && filtered.length === 0) {
          selectNone();
          return;
        }
        const first = filtered[0];
        if (first) toggle(first.id);
      } else if (showNone && cursor === 0) {
        selectNone();
      } else {
        const idx = showNone ? cursor - 1 : cursor;
        const item = filtered[idx];
        if (item) toggle(item.id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setCursor(-1);
    }
  };

  const border =
    "1px solid color-mix(in srgb, var(--primary) 15%, transparent)";
  const borderFocus =
    "1px solid color-mix(in srgb, var(--primary) 35%, transparent)";

  return (
    <div ref={containerRef} className={`space-y-1.5 ${className}`}>
      {/* Label */}
      {(label || hint) && (
        <div className="flex items-center gap-2">
          {label && (
            <label className="text-micro font-black uppercase tracking-widest text-primary/40 flex items-center gap-1.5">
              {icon && <span className="opacity-70">{icon}</span>}
              {label}
            </label>
          )}
          {hint && (
            <span className="text-micro font-medium text-primary/25 normal-case">
              {hint}
            </span>
          )}
        </div>
      )}

      {/* Chips de selección en modo multi */}
      {props.mode === "multi" && selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map((it) => (
            <span
              key={it.id}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-black uppercase tracking-wide border"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 20%, transparent)",
                color: "var(--primary)",
              }}
            >
              {it.imgUrl && (
                <Image
                  alt=""
                  className="w-3.5 h-3.5 rounded-full object-cover"
                  src={it.imgUrl}
                />
              )}
              {it.label}
              <button
                className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
                type="button"
                onClick={(e) => removeItem(it.id, e)}
              >
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      {onNavigate && props.mode === "single" && selectedItems.length > 0 ? (
        /* Modo navegación: click principal navega, lápiz abre el dropdown */
        <div
          className="w-full flex items-center rounded-[var(--radius-btn)] overflow-hidden transition-all"
          style={{
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
            border: open ? borderFocus : border,
          }}
        >
          <button
            className="flex-1 flex items-center gap-2 px-4 py-2.5 text-micro font-bold transition-all min-w-0 hover:bg-primary/5"
            style={{ color: "var(--primary)" }}
            type="button"
            onClick={() =>
              onNavigate(selectedItems[0].id, selectedItems[0].label)
            }
          >
            {selectedItems[0].imgUrl && (
              <img
                alt=""
                className="w-5 h-5 rounded-full object-cover border border-primary/20 shrink-0"
                src={selectedItems[0].imgUrl}
              />
            )}
            <span className="truncate font-black uppercase">
              {triggerLabel}
            </span>
          </button>
          <button
            className="shrink-0 flex items-center justify-center px-2.5 py-2.5 transition-all hover:bg-primary/10"
            style={{
              borderLeft:
                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
              color: "color-mix(in srgb, var(--primary) 35%, transparent)",
            }}
            title="Cambiar"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
          >
            <Pencil size={11} />
          </button>
        </div>
      ) : (
        <button
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-[var(--radius-btn)] text-micro font-bold transition-all"
          style={{
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
            border: open ? borderFocus : border,
            color:
              selectedItems.length > 0
                ? "var(--primary)"
                : "color-mix(in srgb, var(--primary) 40%, transparent)",
          }}
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="flex items-center gap-2 min-w-0">
            {/* Imagen en single */}
            {props.mode === "single" && selectedItems[0]?.imgUrl && (
              <img
                alt=""
                className="w-5 h-5 rounded-full object-cover border border-primary/20 shrink-0"
                src={selectedItems[0].imgUrl}
              />
            )}
            <span className="truncate font-black uppercase">
              {triggerLabel}
            </span>
          </span>
          <ChevronDown
            className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            size={12}
            style={{ opacity: 0.5 }}
          />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div
          className="rounded-[var(--radius-btn)] overflow-hidden"
          style={{
            border,
            background: "var(--bg-main)",
            boxShadow:
              "0 8px 24px color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        >
          {/* Input de búsqueda */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderBottom:
                "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          >
            <Search
              size={11}
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
                flexShrink: 0,
              }}
            />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent outline-none text-micro font-bold uppercase tracking-wide placeholder:normal-case placeholder:font-medium placeholder:tracking-normal"
              placeholder="Buscar…"
              style={{
                color: "var(--primary)",
                caretColor: "var(--primary)",
              }}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(-1);
              }}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <button
                className="opacity-30 hover:opacity-70 transition-opacity"
                type="button"
                onClick={() => {
                  setQuery("");
                  setCursor(-1);
                  inputRef.current?.focus();
                }}
              >
                <X size={10} style={{ color: "var(--primary)" }} />
              </button>
            )}
          </div>

          {/* Items — con o sin grupos */}
          <div ref={listRef} className="max-h-48 overflow-y-auto">
            {/* Opción ninguno (solo single) */}
            {showNone && (
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 text-micro font-bold uppercase transition-all"
                data-idx={0}
                style={{
                  color: !props.value
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--primary) 45%, transparent)",
                  background:
                    cursor === 0
                      ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                      : "transparent",
                }}
                type="button"
                onClick={selectNone}
                onMouseEnter={() => setCursor(0)}
                onMouseLeave={() => setCursor(-1)}
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <X className="opacity-50" size={9} />
                  </span>
                  {(props as SingleProps).noneLabel ?? "Ninguno"}
                </span>
                {!props.value && (
                  <Check size={11} style={{ color: "var(--primary)" }} />
                )}
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="text-micro text-primary/30 px-4 py-3 font-bold uppercase">
                {query ? `Sin resultados para "${query}"` : emptyText}
              </p>
            ) : groups && groups.length > 0 ? (
              // ── Modo agrupado ──────────────────────────────────────────────
              (() => {
                // Build a flat ordered list: items without group first (ungrouped),
                // then each group with its items
                const ungrouped = filtered.filter((it) => !it.group);
                const grouped = groups
                  .map((g) => ({
                    group: g,
                    items: filtered.filter((it) => it.group === g.key),
                  }))
                  .filter((g) => g.items.length > 0);

                // Build a flat index map for cursor tracking
                const flatItems: ComboItem[] = [
                  ...ungrouped,
                  ...grouped.flatMap((g) => g.items),
                ];

                const renderItem = (it: ComboItem) => {
                  const globalIdx = flatItems.indexOf(it);
                  const cursorIdx = showNone ? globalIdx + 1 : globalIdx;
                  const sel = isSelected(it.id);
                  const isCursor = cursor === cursorIdx;
                  return (
                    <button
                      key={it.id}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-micro font-bold uppercase transition-all"
                      data-idx={cursorIdx}
                      style={{
                        color: sel
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 50%, transparent)",
                        background: isCursor
                          ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                          : "transparent",
                      }}
                      type="button"
                      onClick={() => toggle(it.id)}
                      onMouseEnter={() => setCursor(cursorIdx)}
                      onMouseLeave={() => setCursor(-1)}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {it.imgUrl ? (
                          <Image
                            alt=""
                            className="w-5 h-5 rounded-full object-cover border border-primary/15 shrink-0"
                            src={it.imgUrl}
                          />
                        ) : null}
                        <span className="truncate">{it.label}</span>
                        {it.sublabel && (
                          <span className="text-micro normal-case font-medium opacity-50 truncate">
                            {it.sublabel}
                          </span>
                        )}
                      </span>
                      {sel && (
                        <Check
                          className="shrink-0"
                          size={11}
                          style={{ color: "var(--primary)" }}
                        />
                      )}
                    </button>
                  );
                };

                return (
                  <>
                    {ungrouped.map(renderItem)}
                    {grouped.map(({ group, items: gItems }) => (
                      <React.Fragment key={group.key}>
                        {/* Group header */}
                        <div
                          className="flex items-center gap-1.5 px-4 py-1.5 sticky top-0"
                          style={{
                            borderTop:
                              "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
                            background:
                              "color-mix(in srgb, var(--primary) 3%, var(--bg-main))",
                          }}
                        >
                          {group.icon && (
                            <span
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 35%, transparent)",
                              }}
                            >
                              {group.icon}
                            </span>
                          )}
                          <span
                            className="text-micro font-black uppercase tracking-[0.25em]"
                            style={{
                              color:
                                "color-mix(in srgb, var(--primary) 30%, transparent)",
                            }}
                          >
                            {group.label}
                          </span>
                        </div>
                        {gItems.map(renderItem)}
                      </React.Fragment>
                    ))}
                  </>
                );
              })()
            ) : (
              // ── Modo plano (sin grupos) ────────────────────────────────────
              filtered.map((it, i) => {
                const sel = isSelected(it.id);
                const cursorIdx = showNone ? i + 1 : i;
                const isCursor = cursor === cursorIdx;
                return (
                  <button
                    key={it.id}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-micro font-bold uppercase transition-all"
                    data-idx={cursorIdx}
                    style={{
                      color: sel
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 50%, transparent)",
                      background: isCursor
                        ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                        : "transparent",
                    }}
                    type="button"
                    onClick={() => toggle(it.id)}
                    onMouseEnter={() => setCursor(cursorIdx)}
                    onMouseLeave={() => setCursor(-1)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {it.imgUrl ? (
                        <img
                          alt=""
                          className="w-5 h-5 rounded-full object-cover border border-primary/15 shrink-0"
                          src={it.imgUrl}
                        />
                      ) : null}
                      <span className="truncate">{it.label}</span>
                      {it.sublabel && (
                        <span className="text-micro normal-case font-medium opacity-50 truncate">
                          {it.sublabel}
                        </span>
                      )}
                    </span>
                    {sel && (
                      <Check
                        className="shrink-0"
                        size={11}
                        style={{ color: "var(--primary)" }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Hint de teclado */}
          <div
            className="flex items-center gap-3 px-4 py-2"
            style={{
              borderTop:
                "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
              background: "color-mix(in srgb, var(--primary) 2%, transparent)",
            }}
          >
            {[
              { key: "↑↓", label: "navegar" },
              { key: "Tab", label: "seleccionar" },
              { key: "Esc", label: "cerrar" },
            ].map(({ key, label: kl }) => (
              <span key={key} className="flex items-center gap-1">
                <kbd
                  className="text-micro font-black uppercase px-1 py-0.5 rounded"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 10%, transparent)",
                    color:
                      "color-mix(in srgb, var(--primary) 45%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                  }}
                >
                  {key}
                </kbd>
                <span
                  className="text-micro font-bold uppercase tracking-wider"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 25%, transparent)",
                  }}
                >
                  {kl}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

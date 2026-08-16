"use client";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────────────────────────────────────
   SeccionEntidad — sección de barra lateral con mini combo multi-selector
   ─────────────────────────────────────────────────────────────────────────────
   Reemplaza el botón "+" por un combo inline con búsqueda, flechas y Tab,
   diseñado para caber en barras de ~180px de ancho.

   Props:
   - label          etiqueta de la sección (ej: "Reinos")
   - icon           ReactNode del icono junto al label
   - fallbackIcon   icono cuando una entidad no tiene imagen
   - emptyLabel     texto cuando no hay entidades disponibles
   - allEntities    lista completa de entidades { id, nombre, imagen_url? }
   - selectedIds    ids actualmente seleccionados
   - loading        mostrar spinner de carga
   - saving         mostrar spinner de guardado junto al label
   - onToggle       callback(id, add: boolean)
   - onEntityClick  callback al hacer click en una entidad seleccionada
   ───────────────────────────────────────────────────────────────────────────── */

type EntidadBase = {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  group?: string;
};

type EntidadGroup = {
  key: string;
  label: string;
  icon?: React.ReactNode;
};

type SeccionEntidadProps = {
  label: string;
  icon: React.ReactNode;
  fallbackIcon: React.ReactNode;
  emptyLabel: string;
  /** No se usa en la UI pero se mantiene por compatibilidad */
  capId?: string;
  allEntities: EntidadBase[];
  groups?: EntidadGroup[];
  selectedIds: string[];
  loading: boolean;
  saving: boolean;
  onToggle: (id: string, add: boolean) => void;
  /** Notifica al padre cuántas entidades hay seleccionadas — útil para que
   *  contenedores externos ajusten su ancho/alto proporcional al contenido. */
  onSelectedCountChange?: (count: number) => void;
  onEntityClick?: (id: string) => void;
  /**
   * Contenido opcional a mostrar en un tooltip flotante al pasar el mouse
   * sobre una entidad ya seleccionada — ej. edad/era vigente de un
   * personaje en la fecha del capítulo. Devolver `null` omite el tooltip
   * para esa entidad puntual (ej. sin datos todavía). No afecta a
   * consumidores que no pasan esta prop (reinos, ciudades, criaturas,
   * items siguen exactamente igual).
   */
  renderHoverExtra?: (id: string) => React.ReactNode;
  /** Mostrar entidades seleccionadas en grid de N columnas en vez de lista (1 fila c/u) */
  columns?: number;
  /**
   * Si true (default), la sección ocupa todo el espacio disponible del
   * contenedor flex padre y la lista de seleccionados scrollea internamente
   * en vez de desbordarse. Usar `false` cuando varias secciones se apilan
   * una tras otra en un contenedor con su propio scroll (ej. drawer mobile).
   */
  fill?: boolean;
};

/**
 * HoverTooltip — envuelve un trigger (una fila de entidad seleccionada) y
 * muestra `content` en un popover flotante (portal a document.body, mismo
 * patrón anti-clip que el dropdown del combo) mientras el mouse está
 * encima. Si `content` es null/undefined no envuelve nada — el trigger se
 * renderiza tal cual, sin overhead.
 */
function HoverTooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  } | null>(null);

  useEffect(() => {
    if (!hovered || !anchorRef.current) {
      setPos(null);
      return;
    }
    const MARGIN = 8;
    const r = anchorRef.current.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - r.bottom - MARGIN;
    const espacioArriba = r.top - MARGIN;
    const openUp = espacioAbajo < 160 && espacioArriba > espacioAbajo;
    setPos({
      top: openUp ? r.top - MARGIN : r.bottom + MARGIN,
      left: Math.min(r.left, window.innerWidth - 260 - MARGIN),
      openUp,
    });
  }, [hovered]);

  if (content == null) return <>{children}</>;

  return (
    <div
      ref={anchorRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100] w-64 rounded-lg p-2.5 shadow-lg pointer-events-none"
            style={{
              top: pos.top,
              left: pos.left,
              transform: pos.openUp ? "translateY(-100%)" : undefined,
              background: "var(--surface-1, var(--background))",
              border:
                "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}

export const SeccionEntidad = ({
  label,
  icon,
  fallbackIcon,
  emptyLabel,
  allEntities,
  groups,
  selectedIds,
  loading,
  saving,
  onToggle,
  onEntityClick,
  renderHoverExtra,
  columns,
  fill = true,
  onSelectedCountChange,
}: SeccionEntidadProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Posición del dropdown (portal anti-clip) ────────────────────────────────
  // El combo vive dentro de barras laterales que a su vez viven dentro de
  // popovers flotantes con overflow-hidden/scroll propio — position: absolute
  // relativo al contenedor de la sección se cortaba contra esos bordes. Se
  // porta a document.body con position: fixed, calculado desde el trigger,
  // igual patrón anti-clip que PopoverFlotante.
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setDropdownPos(null);
      return;
    }
    const MARGIN = 8;
    const DROPDOWN_HEIGHT_ESTIMATE = 220; // buscador + lista (~max-h-36) + paddings
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.max(180, Math.min(260, window.innerWidth - MARGIN * 2));
      const left = Math.min(Math.max(r.right - width, MARGIN), window.innerWidth - width - MARGIN);

      const espacioAbajo = window.innerHeight - r.bottom - MARGIN;
      const espacioArriba = r.top - MARGIN;
      const openUp =
        espacioAbajo < Math.min(DROPDOWN_HEIGHT_ESTIMATE, 180) && espacioArriba > espacioAbajo;
      const espacioDisponible = Math.max(120, openUp ? espacioArriba : espacioAbajo);
      const maxHeight = Math.min(DROPDOWN_HEIGHT_ESTIMATE, espacioDisponible);
      const top = openUp ? r.top - MARGIN : r.bottom + MARGIN;

      setDropdownPos({ top, left, width, openUp, maxHeight });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // ── Entidades ──────────────────────────────────────────────────────────────
  const selected = allEntities.filter((e) => selectedIds.includes(e.id));
  const _available = allEntities.filter((e) => !selectedIds.includes(e.id));

  // Notifica al padre cuántas entidades hay seleccionadas (para layouts
  // proporcionales: columnas con más contenido ocupan más espacio).
  useEffect(() => {
    onSelectedCountChange?.(selected.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.length]);

  // ── Filtrado por búsqueda (sobre todas las entidades, marcando las ya seleccionadas) ─
  const filtered = useMemo(() => {
    const pool = allEntities; // buscamos sobre todas para poder des-seleccionar también
    if (!query.trim()) return pool;
    const q = query.toLowerCase();
    return pool
      .filter(
        (e) =>
          e.nombre.toLowerCase().startsWith(q) ||
          e.nombre.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const aS = a.nombre.toLowerCase().startsWith(q);
        const bS = b.nombre.toLowerCase().startsWith(q);
        if (aS && !bS) return -1;
        if (!aS && bS) return 1;
        return 0;
      });
  }, [allEntities, query]);

  // ── Cerrar al click fuera ──────────────────────────────────────────────────
  // Contempla tanto el contenedor de la sección como el portal del dropdown
  // (que ahora vive en document.body, fuera del árbol de containerRef).
  const dropdownPortalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownPortalRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
      setCursor(-1);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // ── Focus al abrir ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setCursor(-1);
    }
  }, [open]);

  // ── Scroll del cursor ─────────────────────────────────────────────────────
  useEffect(() => {
    if (cursor < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-idx="${cursor}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggle = useCallback(
    (id: string) => {
      const add = !selectedIds.includes(id);
      onToggle(id, add);
      setQuery("");
      setCursor(-1);
      inputRef.current?.focus();
    },
    [selectedIds, onToggle],
  );

  // ── Teclado ───────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    const max = filtered.length - 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, max));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const idx = cursor < 0 ? 0 : cursor;
      const item = filtered[idx];
      if (item) toggle(item.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // ── Estilos reutilizables ─────────────────────────────────────────────────
  const border =
    "1px solid color-mix(in srgb, var(--primary) 12%, transparent)";
  const borderFocus =
    "1px solid color-mix(in srgb, var(--primary) 28%, transparent)";

  return (
    <div
      ref={containerRef}
      className={
        (fill ? "flex-1 min-h-0 flex flex-col" : "shrink-0 flex flex-col") +
        " relative"
      }
      style={open ? { zIndex: 30 } : undefined}
    >
      {/* ── Cabecera ── */}
      <div
        className="shrink-0 flex items-center justify-between px-2 py-1"
      >
        <span
          className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.2em] leading-none"
          style={{
            color: "color-mix(in srgb, var(--primary) 38%, transparent)",
          }}
        >
          {icon}
          {label}
          {saving && <Loader2 className="animate-spin opacity-50" size={8} />}
        </span>

        {/* Trigger del mini-combo */}
        <button
          ref={triggerRef}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-all"
          style={{
            border: open ? borderFocus : border,
            background: open
              ? "color-mix(in srgb, var(--primary) 6%, transparent)"
              : "transparent",
            color: "color-mix(in srgb, var(--primary) 40%, transparent)",
          }}
          title={`Añadir ${label.toLowerCase()}`}
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          {/* Contador de seleccionados */}
          {selectedIds.length > 0 && (
            <span
              className="text-micro font-black tabular-nums"
              style={{ color: "var(--primary)" }}
            >
              {selectedIds.length}
            </span>
          )}
          <ChevronDown
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            size={9}
          />
        </button>
      </div>

      {/* ── Dropdown mini-combo ──
          Portal a document.body con position: fixed (mismo patrón anti-clip
          que PopoverFlotante) — así no se corta contra el overflow-hidden o
          el scroll interno del popover flotante que contiene esta barra
          lateral, sin importar en qué sección de la lista esté. */}
      {open &&
        dropdownPos &&
        createPortal(
          <div
            ref={dropdownPortalRef}
            className="fixed rounded-lg overflow-hidden flex flex-col"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxHeight,
              transform: dropdownPos.openUp ? "translateY(-100%)" : undefined,
              border: borderFocus,
              background: "var(--bg-main)",
              boxShadow:
                "0 6px 20px color-mix(in srgb, var(--primary) 10%, transparent)",
              zIndex: 9999,
            }}
          >
          {/* Búsqueda */}
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 shrink-0"
            style={{
              borderBottom:
                "1px solid color-mix(in srgb, var(--primary) 7%, transparent)",
            }}
          >
            <Search
              size={9}
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
                flexShrink: 0,
              }}
            />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent outline-none text-micro font-bold uppercase tracking-wide placeholder:normal-case placeholder:font-medium placeholder:tracking-normal placeholder:opacity-50"
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
                <X size={8} style={{ color: "var(--primary)" }} />
              </button>
            )}
          </div>

          {/* Lista */}
          <div ref={listRef} className="overflow-y-auto flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-3 text-primary/20">
                <Loader2 className="animate-spin" size={11} />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-micro font-black uppercase text-primary/20 px-2.5 py-2 text-center tracking-[0.2em] italic">
                {query ? `Sin resultados` : emptyLabel}
              </p>
            ) : groups && groups.length > 0 ? (
              // ── Modo agrupado ──────────────────────────────────────────────
              (() => {
                const ungrouped = filtered.filter((e) => !e.group);
                const grouped = groups
                  .map((g) => ({
                    group: g,
                    items: filtered.filter((e) => e.group === g.key),
                  }))
                  .filter((g) => g.items.length > 0);
                const flatItems = [
                  ...ungrouped,
                  ...grouped.flatMap((g) => g.items),
                ];

                const renderItem = (e: EntidadBase) => {
                  const i = flatItems.indexOf(e);
                  const sel = selectedIds.includes(e.id);
                  const isCursor = cursor === i;
                  return (
                    <button
                      key={e.id}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-all"
                      data-idx={i}
                      style={{
                        background: isCursor
                          ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                          : "transparent",
                        color: sel
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 50%, transparent)",
                      }}
                      type="button"
                      onClick={() => toggle(e.id)}
                      onMouseEnter={() => setCursor(i)}
                      onMouseLeave={() => setCursor(-1)}
                    >
                      {e.imagen_url ? (
                        <Image
                          alt={e.nombre}
                          className="w-4 h-4 rounded-full shrink-0 object-cover border"
                          src={e.imagen_url}
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--primary) 12%, transparent)",
                            background:
                              "color-mix(in srgb, var(--primary) 6%, transparent)",
                          }}
                        />
                      ) : (
                        <div
                          className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-micro font-black uppercase"
                          style={{
                            background: sel
                              ? "color-mix(in srgb, var(--primary) 15%, transparent)"
                              : "color-mix(in srgb, var(--primary) 8%, transparent)",
                            color:
                              "color-mix(in srgb, var(--primary) 55%, transparent)",
                          }}
                        >
                          {e.nombre.charAt(0)}
                        </div>
                      )}
                      <span className="flex-1 min-w-0 text-micro font-black uppercase tracking-wide truncate leading-tight">
                        {e.nombre}
                      </span>
                      {sel && (
                        <Check
                          className="shrink-0"
                          size={9}
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
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 sticky top-0"
                          style={{
                            borderTop:
                              ungrouped.length > 0
                                ? "1px solid color-mix(in srgb, var(--primary) 6%, transparent)"
                                : undefined,
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
                            className="text-micro font-black uppercase tracking-[0.2em]"
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
              filtered.map((e, i) => {
                const sel = selectedIds.includes(e.id);
                const isCursor = cursor === i;
                return (
                  <button
                    key={e.id}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-all"
                    data-idx={i}
                    style={{
                      background: isCursor
                        ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                        : "transparent",
                      color: sel
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 50%, transparent)",
                    }}
                    type="button"
                    onClick={() => toggle(e.id)}
                    onMouseEnter={() => setCursor(i)}
                    onMouseLeave={() => setCursor(-1)}
                  >
                    {/* Avatar / imagen */}
                    {e.imagen_url ? (
                      <img
                        alt={e.nombre}
                        className="w-4 h-4 rounded-full shrink-0 object-cover border"
                        src={e.imagen_url}
                        style={{
                          borderColor:
                            "color-mix(in srgb, var(--primary) 12%, transparent)",
                          background:
                            "color-mix(in srgb, var(--primary) 6%, transparent)",
                        }}
                      />
                    ) : (
                      <div
                        className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-micro font-black uppercase"
                        style={{
                          background: sel
                            ? "color-mix(in srgb, var(--primary) 15%, transparent)"
                            : "color-mix(in srgb, var(--primary) 8%, transparent)",
                          color:
                            "color-mix(in srgb, var(--primary) 55%, transparent)",
                        }}
                      >
                        {e.nombre.charAt(0)}
                      </div>
                    )}

                    <span className="flex-1 min-w-0 text-micro font-black uppercase tracking-wide truncate leading-tight">
                      {e.nombre}
                    </span>

                    {sel && (
                      <Check
                        className="shrink-0"
                        size={9}
                        style={{ color: "var(--primary)" }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Pie de teclado */}
          <div
            className="flex items-center gap-2 px-2.5 py-1"
            style={{
              borderTop:
                "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
              background: "color-mix(in srgb, var(--primary) 2%, transparent)",
            }}
          >
            {[
              { key: "↑↓", label: "nav" },
              { key: "Tab", label: "sel" },
              { key: "Esc", label: "cerrar" },
            ].map(({ key, label: kl }) => (
              <span key={key} className="flex items-center gap-0.5">
                <kbd
                  className="text-micro font-black uppercase px-1 py-0.5 rounded"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 10%, transparent)",
                    color:
                      "color-mix(in srgb, var(--primary) 40%, transparent)",
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
                      "color-mix(in srgb, var(--primary) 22%, transparent)",
                  }}
                >
                  {kl}
                </span>
              </span>
            ))}
          </div>
          </div>,
          document.body,
        )}

      {/* ── Entidades seleccionadas ── */}
      <div className={fill ? "flex-1 min-h-0 overflow-y-auto flex flex-col" : ""}>
        {selected.length === 0 ? (
          <div
            className="flex-1 flex items-center gap-2 px-2.5 py-1.5"
            style={{ opacity: 0.35 }}
          >
            <span
              style={{
                color: "color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
            >
              {fallbackIcon}
            </span>
            <p
              className="text-micro font-black uppercase tracking-[0.2em] leading-none"
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              {emptyLabel}
            </p>
          </div>
        ) : columns ? (
          /* ── Grid N columnas ── */
          <div
            className="grid gap-1 p-2"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {selected.map((e) => (
              <HoverTooltip key={e.id} content={renderHoverExtra?.(e.id)}>
              <div
                className="group relative flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all hover:bg-primary/5"
                style={{ cursor: onEntityClick ? "pointer" : "default" }}
                onClick={() => onEntityClick?.(e.id)}
              >
                {e.imagen_url ? (
                  <img
                    alt={e.nombre}
                    className="w-8 h-8 rounded-lg shrink-0 object-cover"
                    src={e.imagen_url}
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 10%, transparent)",
                    }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-micro font-black uppercase"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color:
                        "color-mix(in srgb, var(--primary) 60%, transparent)",
                    }}
                  >
                    {e.nombre.charAt(0)}
                  </div>
                )}
                <span
                  className="w-full text-center text-micro font-black uppercase tracking-wide leading-tight break-words line-clamp-2"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 65%, transparent)",
                  }}
                >
                  {e.nombre}
                </span>
                <button
                  className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 hover:bg-red-500/20"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                  title="Quitar"
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onToggle(e.id, false);
                  }}
                >
                  <X size={8} />
                </button>
              </div>
              </HoverTooltip>
            ))}
          </div>
        ) : groups && groups.length > 0 ? (
          /* ── Lista agrupada ── */
          (() => {
            const ungroupedSel = selected.filter((e) => !e.group);
            const groupedSel = groups
              .map((g) => ({
                group: g,
                items: selected.filter((e) => e.group === g.key),
              }))
              .filter((g) => g.items.length > 0);

            const renderSelItem = (e: EntidadBase) => (
              <HoverTooltip key={e.id} content={renderHoverExtra?.(e.id)}>
              <div
                className="group flex items-center gap-2 px-2.5 py-1.5 transition-all hover:bg-primary/[0.04]"
                style={{ cursor: onEntityClick ? "pointer" : "default" }}
                onClick={() => onEntityClick?.(e.id)}
              >
                {e.imagen_url ? (
                  <Image
                    alt={e.nombre}
                    className="w-5 h-5 rounded-full shrink-0 object-cover"
                    src={e.imagen_url}
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 10%, transparent)",
                    }}
                  />
                ) : (
                  <div
                    className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-micro font-black uppercase"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color:
                        "color-mix(in srgb, var(--primary) 60%, transparent)",
                    }}
                  >
                    {e.nombre.charAt(0)}
                  </div>
                )}
                <span
                  className="flex-1 min-w-0 text-micro font-black uppercase tracking-wide leading-tight break-words"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 65%, transparent)",
                  }}
                >
                  {e.nombre}
                </span>
                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-red-500/10"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                  title="Quitar"
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onToggle(e.id, false);
                  }}
                >
                  <X size={9} />
                </button>
              </div>
              </HoverTooltip>
            );

            return (
              <>
                {ungroupedSel.map(renderSelItem)}
                {groupedSel.map(({ group, items: gItems }) => (
                  <React.Fragment key={group.key}>
                    <div
                      className="flex items-center gap-1 px-3 py-0.5"
                    >
                      {group.icon && (
                        <span
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 28%, transparent)",
                          }}
                        >
                          {group.icon}
                        </span>
                      )}
                      <span
                        className="text-micro font-black uppercase tracking-[0.2em]"
                        style={{
                          color:
                            "color-mix(in srgb, var(--primary) 25%, transparent)",
                        }}
                      >
                        {group.label}
                      </span>
                    </div>
                    {gItems.map(renderSelItem)}
                  </React.Fragment>
                ))}
              </>
            );
          })()
        ) : (
          /* ── Lista simple (default) ── */
          selected.map((e) => (
            <HoverTooltip key={e.id} content={renderHoverExtra?.(e.id)}>
            <div
              className="group flex items-center gap-2 px-2.5 py-1.5 transition-all hover:bg-primary/[0.04]"
              style={{ cursor: onEntityClick ? "pointer" : "default" }}
              onClick={() => onEntityClick?.(e.id)}
            >
              {e.imagen_url ? (
                <img
                  alt={e.nombre}
                  className="w-4 h-4 rounded-full shrink-0 object-cover"
                  src={e.imagen_url}
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 10%, transparent)",
                  }}
                />
              ) : (
                <div
                  className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-micro font-black uppercase"
                  style={{
                    background:
                      "color-mix(in srgb, var(--primary) 12%, transparent)",
                    color:
                      "color-mix(in srgb, var(--primary) 60%, transparent)",
                  }}
                >
                  {e.nombre.charAt(0)}
                </div>
              )}
              <span
                className="flex-1 min-w-0 text-micro font-black uppercase tracking-wide leading-tight break-words"
                style={{
                  color: "color-mix(in srgb, var(--primary) 65%, transparent)",
                }}
              >
                {e.nombre}
              </span>
              <button
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-red-500/10"
                style={{
                  color: "color-mix(in srgb, var(--primary) 30%, transparent)",
                }}
                title="Quitar"
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onToggle(e.id, false);
                }}
              >
                <X size={9} />
              </button>
            </div>
            </HoverTooltip>
          ))
        )}
      </div>
    </div>
  );
};

export default SeccionEntidad;

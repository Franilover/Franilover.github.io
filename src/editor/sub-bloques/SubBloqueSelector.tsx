"use client";
/**
 * SubBloqueSelector.tsx
 * ──────────────────────
 * Dropdown superior que lista "Documento principal" + los sub-bloques del
 * ensayo actual (ver ./types.ts). Al elegir uno, EditorEnsayo cambia qué
 * contenido edita el RichEditor (mismo componente, distinto storage) — ver
 * el switch en EditorEnsayo.tsx alrededor de `markdownBlock`.
 *
 * Incluye alta ("＋ nuevo bloque"), renombrado inline (doble click / lápiz)
 * y borrado (con confirmación simple) — todo desde el mismo dropdown, sin
 * modal aparte, para que el flujo de "voy anotando recetas mientras escribo
 * el ensayo" sea rápido.
 */
import { ChevronDown, Plus, Pencil, Trash2, FileText, Check, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { SubBloque } from "./types";

interface SubBloqueSelectorProps {
  bloques: SubBloque[];
  /** null = documento principal del ensayo */
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (nombre?: string) => void;
  onRename: (id: string, nombre: string) => void;
  onDelete: (id: string) => void;
}

export function SubBloqueSelector({
  bloques,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SubBloqueSelectorProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setEditingId(null);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (editingId) setTimeout(() => editInputRef.current?.focus(), 20);
  }, [editingId]);

  const activeBloque = bloques.find((b) => b.id === activeId) || null;
  const triggerLabel = activeBloque ? activeBloque.nombre : "Documento principal";

  const startEdit = (b: SubBloque, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(b.id);
    setEditValue(b.nombre);
    setConfirmDeleteId(null);
  };

  const commitEdit = () => {
    if (editingId) {
      const trimmed = editValue.trim();
      if (trimmed) onRename(editingId, trimmed);
    }
    setEditingId(null);
  };

  const microStyle: React.CSSProperties = {
    fontSize: 9,
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px",
          borderRadius: 5,
          border: activeBloque
            ? "1px solid color-mix(in srgb, var(--color-primary,#7c6af7) 35%, transparent)"
            : "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
          background: activeBloque
            ? "color-mix(in srgb, var(--color-primary,#7c6af7) 10%, transparent)"
            : "color-mix(in srgb, var(--foreground) 4%, transparent)",
          color: activeBloque
            ? "color-mix(in srgb, var(--color-primary,#7c6af7) 85%, white)"
            : "color-mix(in srgb, var(--foreground) 55%, transparent)",
          cursor: "pointer",
          maxWidth: 220,
        }}
        title="Elegir bloque de contenido"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <FileText size={10} style={{ flexShrink: 0 }} />
        <span
          style={{
            ...microStyle,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {triggerLabel}
        </span>
        <ChevronDown size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 60,
            minWidth: 240,
            maxWidth: 320,
            maxHeight: 340,
            overflowY: "auto",
            background: "var(--bg-menu)",
            border:
              "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
            borderRadius: 8,
            boxShadow:
              "0 8px 28px color-mix(in srgb, var(--bg-main) 55%, transparent)",
          }}
        >
          {/* Documento principal */}
          <button
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              background:
                activeId === null
                  ? "color-mix(in srgb, var(--color-primary,#7c6af7) 8%, transparent)"
                  : "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
            type="button"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
          >
            <span
              style={{
                ...microStyle,
                fontWeight: 700,
                color:
                  activeId === null
                    ? "color-mix(in srgb, var(--color-primary,#7c6af7) 85%, white)"
                    : "color-mix(in srgb, var(--foreground) 55%, transparent)",
              }}
            >
              Documento principal
            </span>
            {activeId === null && (
              <Check
                size={11}
                style={{ color: "color-mix(in srgb, var(--color-primary,#7c6af7) 80%, white)" }}
              />
            )}
          </button>

          {bloques.length > 0 && (
            <div
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)",
              }}
            >
              {bloques.map((b) => {
                const isActive = b.id === activeId;
                const isEditing = editingId === b.id;
                const isConfirming = confirmDeleteId === b.id;
                return (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 10px 6px 14px",
                      background: isActive
                        ? "color-mix(in srgb, var(--color-primary,#7c6af7) 8%, transparent)"
                        : "transparent",
                    }}
                  >
                    {isEditing ? (
                      <>
                        <input
                          ref={editInputRef}
                          style={{
                            flex: 1,
                            ...microStyle,
                            fontWeight: 600,
                            textTransform: "none",
                            background:
                              "color-mix(in srgb, var(--foreground) 5%, transparent)",
                            border:
                              "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)",
                            borderRadius: 4,
                            padding: "3px 6px",
                            color: "var(--foreground)",
                            outline: "none",
                          }}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 3,
                            color: "color-mix(in srgb, var(--foreground) 45%, transparent)",
                          }}
                          title="Guardar nombre"
                          type="button"
                          onClick={commitEdit}
                        >
                          <Check size={11} />
                        </button>
                      </>
                    ) : isConfirming ? (
                      <>
                        <span
                          style={{
                            flex: 1,
                            ...microStyle,
                            fontWeight: 600,
                            color: "color-mix(in srgb, var(--foreground) 45%, transparent)",
                          }}
                        >
                          ¿Borrar &quot;{b.nombre}&quot;?
                        </span>
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 3,
                            color: "#e35d5d",
                          }}
                          title="Confirmar borrado"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(b.id);
                            setConfirmDeleteId(null);
                          }}
                        >
                          <Check size={11} />
                        </button>
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 3,
                            color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
                          }}
                          title="Cancelar"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                        >
                          <X size={11} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            textAlign: "left",
                          }}
                          type="button"
                          onClick={() => {
                            onSelect(b.id);
                            setOpen(false);
                          }}
                        >
                          <span
                            style={{
                              ...microStyle,
                              fontWeight: 600,
                              textTransform: "none",
                              color: isActive
                                ? "color-mix(in srgb, var(--color-primary,#7c6af7) 85%, white)"
                                : "color-mix(in srgb, var(--foreground) 65%, transparent)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {b.nombre}
                          </span>
                          {isActive && (
                            <Check
                              size={11}
                              style={{
                                flexShrink: 0,
                                color:
                                  "color-mix(in srgb, var(--color-primary,#7c6af7) 80%, white)",
                              }}
                            />
                          )}
                        </button>
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 3,
                            flexShrink: 0,
                            color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
                          }}
                          title="Renombrar"
                          type="button"
                          onClick={(e) => startEdit(b, e)}
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 3,
                            flexShrink: 0,
                            color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
                          }}
                          title="Borrar bloque"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(b.id);
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Nuevo bloque */}
          <button
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px",
              borderTop:
                "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)",
              background: "transparent",
              border: "none",
              borderTopWidth: 1,
              borderTopStyle: "solid",
              borderTopColor:
                "color-mix(in srgb, var(--foreground) 7%, transparent)",
              cursor: "pointer",
              textAlign: "left",
              color: "color-mix(in srgb, var(--color-primary,#7c6af7) 75%, white)",
            }}
            type="button"
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
          >
            <Plus size={11} />
            <span style={{ ...microStyle, fontWeight: 700 }}>nuevo bloque</span>
          </button>
        </div>
      )}
    </div>
  );
}

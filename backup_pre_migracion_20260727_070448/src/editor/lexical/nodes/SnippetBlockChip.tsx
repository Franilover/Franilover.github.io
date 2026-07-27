"use client";
/**
 * SnippetBlockChip.tsx
 * ─────────────────────
 * Fila colapsable reutilizable para nodos "de lógica" (choice, condicion,
 * use) — reemplaza al chip inline plano cuando el nodo tiene datos
 * suficientes como para merecer un resumen + detalle expandible.
 *
 * Diseño: un solo color neutro (border-strong / text-primary / text-
 * secondary) en todos los estados — la diferenciación es por ícono y
 * texto, nunca por color. Colapsado muestra un resumen de una línea con
 * indicadores de estado (puntos) por cada rama/destino. Click expande un
 * panel de detalle con el desglose completo y, si corresponde, acciones
 * como "crear sección faltante".
 *
 * Reutiliza los botones de editar/eliminar del SnippetChip original vía
 * onEdit/onDelete pasados al header.
 */
import React, { useState, useRef, useEffect } from "react";

export interface BlockChipBranch {
  /** Texto corto de la rama, ej: "Girar a la izquierda" o "si tiene item". */
  label: string;
  /** id de sección destino, si existe. */
  target?: string;
  /** true si el destino existe en el documento; undefined = no verificado. */
  targetValid?: boolean;
  /** Texto libre adicional a mostrar en el detalle (ej. texto de la rama). */
  detail?: string;
}

export function SnippetBlockChip({
  icon,
  title,
  summaryRight,
  branches,
  detailExtra,
  onClick,
  onDelete,
  onCreateMissingSection,
}: {
  icon: React.ReactNode;
  /** Título corto de la fila, ej: "2 decisiones" o "gate — llave de bronce". */
  title: string;
  /** Texto corto opcional a la derecha del título cuando está colapsado. */
  summaryRight?: string;
  /** Ramas/destinos a listar en el resumen y en el detalle. */
  branches: BlockChipBranch[];
  /** Contenido adicional de solo lectura para el panel de detalle. */
  detailExtra?: React.ReactNode;
  /** Abre el editor completo del nodo (mismo comportamiento que antes). */
  onClick: () => void;
  onDelete: () => void;
  /** Si se pasa, aparece un botón para crear la sección faltante de esa rama. */
  onCreateMissingSection?: (branch: BlockChipBranch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = detailRef.current;
    if (!el) return;
    el.style.maxHeight = open ? `${el.scrollHeight}px` : "0px";
  }, [open, branches, detailExtra]);

  const brokenCount = branches.filter((b) => b.target && b.targetValid === false).length;

  return (
    <div
      contentEditable={false}
      style={{
        display: "block",
        border: "1px solid var(--border-strong, #B4B2A9)",
        borderRadius: 8,
        margin: "2px 0",
        overflow: "hidden",
        background: "var(--surface-1, transparent)",
        fontFamily: "var(--font-sans, system-ui)",
        userSelect: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          color: "var(--text-primary)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>

        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 400,
            fontSize: 12,
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          {!open && summaryRight && <span>{summaryRight}</span>}
          {!open &&
            branches.map((b, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {b.target && (
                  <>
                    <span>{b.label}</span>
                    <span
                      title={
                        b.targetValid === false
                          ? `destino roto: "${b.target}" no existe`
                          : "destino válido"
                      }
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background:
                          b.targetValid === false
                            ? "var(--text-danger, #A32D2D)"
                            : "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    />
                  </>
                )}
              </span>
            ))}

          {hovered && (
            <button
              type="button"
              title="Eliminar"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                background: "none",
                border: "none",
                padding: "1px 3px",
                cursor: "pointer",
                color: "inherit",
                opacity: 0.65,
                fontSize: 13,
                lineHeight: 1,
                borderRadius: 3,
              }}
            >
              ×
            </button>
          )}

          <i
            aria-hidden="true"
            style={{
              display: "inline-flex",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              fontSize: 12,
            }}
          >
            ▾
          </i>
        </span>
      </div>

      <div
        ref={detailRef}
        style={{
          maxHeight: 0,
          overflow: "hidden",
          transition: "max-height 0.2s ease",
        }}
      >
        <div
          style={{
            padding: "8px 10px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderTop: "1px solid var(--border, #D3D1C7)",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          {branches.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span aria-hidden="true" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                ↳
              </span>
              <span style={{ color: "var(--text-primary)" }}>{b.label}</span>
              {b.target && (
                <>
                  <span aria-hidden="true" style={{ opacity: 0.6 }}>
                    →
                  </span>
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{b.target}</span>
                  <span style={{ marginLeft: "auto" }}>
                    {b.targetValid === false ? "sección no existe" : "destino válido"}
                  </span>
                </>
              )}
              {!b.target && <span style={{ marginLeft: "auto" }}>sin destino — no genera salto</span>}
              {b.detail && (
                <div style={{ flexBasis: "100%", color: "var(--text-secondary)" }}>{b.detail}</div>
              )}
              {b.targetValid === false && onCreateMissingSection && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateMissingSection(b);
                  }}
                  style={{
                    flexBasis: "100%",
                    alignSelf: "flex-start",
                    fontSize: 12,
                    padding: "4px 8px",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    background: "transparent",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  Crear sección faltante
                </button>
              )}
            </div>
          ))}

          {brokenCount > 0 && (
            <div style={{ color: "var(--text-danger, #A32D2D)" }}>
              {brokenCount} {brokenCount === 1 ? "destino roto" : "destinos rotos"}
            </div>
          )}

          {detailExtra}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            style={{
              alignSelf: "flex-start",
              fontSize: 12,
              padding: "4px 8px",
              border: "1px solid var(--border-strong)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text-primary)",
              cursor: "pointer",
              marginTop: 2,
            }}
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

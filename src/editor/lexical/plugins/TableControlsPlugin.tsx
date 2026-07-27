"use client";
/**
 * TableControlsPlugin.tsx
 * ─────────────────────────
 * @lexical/table trae el nodo/navegación de tablas de fábrica, pero NADA
 * de UI para editarlas — ni botones para agregar/quitar filas o columnas,
 * ni redimensionado de columnas por drag. Eso es intencional: en el
 * playground oficial de Meta esos controles (TableCellResizer,
 * TableActionMenu) son componentes de EJEMPLO que cada proyecto copia y
 * adapta, no vienen en el paquete npm. Este plugin es esa pieza, escrita
 * a medida del theme de este editor.
 *
 * Dos mecanismos independientes, montados juntos por conveniencia:
 *
 * 1) HOVER CONTROLS (agregar/quitar fila o columna)
 *    Al pasar el mouse sobre una tabla mostramos:
 *      - Un botón "+" flotante debajo de la última fila → inserta fila.
 *      - Un botón "+" flotante a la derecha de la última columna →
 *        inserta columna.
 *      - Un botón "×" en el borde de cada fila/columna bajo el cursor
 *        para borrarla (solo visible al hacer hover sobre esa fila/col
 *        puntual, vía las franjas invisibles de detección).
 *    Usa medidas del DOM real (getBoundingClientRect) porque Lexical no
 *    expone la grilla como flexbox/grid uniforme — cada TableCellNode
 *    es un <td> normal, así que la posición de "última fila/columna" se
 *    calcula leyendo el DOM, no el árbol de nodos directamente (aunque
 *    las MUTACIONES sí se hacen sobre el árbol, vía las utilidades de
 *    @lexical/table).
 *
 * 2) RESIZE DE COLUMNAS (drag en el borde derecho de cada celda de la
 *    fila superior)
 *    TableCellNode ya soporta ancho por celda vía setWidth(px) (aplica
 *    style.width en su createDOM/updateDOM de forma nativa — ver
 *    LexicalTableCellNode). Solo nos falta la interacción de arrastre:
 *    un handle invisible de ~6px sobre el borde derecho de cada <td> de
 *    la primera fila, que al arrastrarse llama setWidth() en TODAS las
 *    celdas de esa columna (deben compartir ancho — si solo se resiza
 *    la celda superior, las de abajo quedan descuadradas visualmente
 *    aunque el <td> real siga en su ancho viejo).
 */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  type LexicalEditor,
} from "lexical";
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellNode,
  TableNode,
} from "@lexical/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const CONTROL_COLOR = "color-mix(in srgb, var(--foreground) 45%, transparent)";
const CONTROL_BG = "var(--background)";
const CONTROL_BORDER = "color-mix(in srgb, var(--foreground) 20%, transparent)";
const HOVER_ACCENT = "color-mix(in srgb, var(--accent, #3b82f6) 80%, transparent)";

// ── Botón circular reusado por los 4 controles (+ fila, + col, × fila, × col) ──
function ControlButton({
  title,
  danger,
  style,
  onClick,
}: {
  title: string;
  danger?: boolean;
  style: React.CSSProperties;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={title}
      // mousedown en vez de click: evita que el editor pierda la
      // selección de tabla antes de que el handler lea el nodo activo.
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: danger ? 4 : "50%",
        border: `1px solid ${hovered ? (danger ? "#dc2626" : HOVER_ACCENT) : CONTROL_BORDER}`,
        background: hovered ? (danger ? "#dc2626" : HOVER_ACCENT) : CONTROL_BG,
        color: hovered ? "#fff" : CONTROL_COLOR,
        fontSize: 11,
        lineHeight: 1,
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
        padding: 0,
        zIndex: 30,
        boxShadow: "0 1px 2px color-mix(in srgb, black 15%, transparent)",
        ...style,
      }}
    >
      {danger ? "×" : "+"}
    </button>
  );
}

interface TableGeometry {
  tableKey: string;
  tableRect: DOMRect;
  rowRects: DOMRect[]; // una por fila, relativa al mismo offsetParent que tableRect
  colRects: DOMRect[]; // una por columna (medida desde la primera fila)
}

function measureTable(tableEl: HTMLElement, containerEl: HTMLElement): TableGeometry | null {
  const rows = Array.from(tableEl.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
  if (rows.length === 0) return null;
  const containerRect = containerEl.getBoundingClientRect();

  const toRelative = (r: DOMRect): DOMRect =>
    ({
      ...r,
      top: r.top - containerRect.top,
      bottom: r.bottom - containerRect.top,
      left: r.left - containerRect.left,
      right: r.right - containerRect.left,
    }) as DOMRect;

  const tableRect = toRelative(tableEl.getBoundingClientRect());
  const rowRects = rows.map((r) => toRelative(r.getBoundingClientRect()));
  const firstRowCells = Array.from(
    rows[0].querySelectorAll<HTMLTableCellElement>(":scope > td, :scope > th"),
  );
  const colRects = firstRowCells.map((c) => toRelative(c.getBoundingClientRect()));

  return { tableKey: "", tableRect, rowRects, colRects };
}

export function TableControlsPlugin() {
  const [editor] = useLexicalComposerContext();
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [activeTable, setActiveTable] = useState<{
    key: string;
    el: HTMLElement;
  } | null>(null);
  const [geometry, setGeometry] = useState<TableGeometry | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  // Resize en curso: { colIndex, startX, startWidth } o null.
  const resizeStateRef = useRef<{
    tableKey: string;
    colIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const recompute = useCallback(() => {
    if (!activeTable || !scrollContainerRef.current) {
      setGeometry(null);
      return;
    }
    const g = measureTable(activeTable.el, scrollContainerRef.current);
    if (g) setGeometry({ ...g, tableKey: activeTable.key });
  }, [activeTable]);

  // Ubica el contenedor con overflow (para medir posiciones relativas a
  // algo que no se mueve con el scroll interno del editor) Y adjunta el
  // listener de mousemove que detecta sobre qué tabla está el mouse.
  //
  // OJO — bug real que había acá: ambas cosas dependían de leer
  // editor.getRootElement() UNA SOLA VEZ al montar (`useEffect(..., [editor])`
  // o `[editor, isResizing]`). En el primer render el `contentEditable`
  // de Lexical típicamente todavía no existe en el DOM, así que
  // getRootElement() devuelve null ahí mismo:
  //   - scrollContainerRef.current quedaba null para siempre →
  //     recompute() nunca medía nada → geometry nunca se seteaba.
  //   - el listener de mousemove nunca se adjuntaba (return temprano) y
  //     como el efecto no reaccionaba a que el root apareciera después,
  //     activeTable tampoco se detectaba jamás.
  // Con el guard final `if (!activeTable || !geometry || ...) return null`
  // el resultado era que el componente jamás renderizaba nada.
  //
  // registerRootListener es la forma reactiva de Lexical: se dispara
  // apenas el root real queda montado (y de nuevo si cambia).
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) return; // no cambiar de tabla activa mientras se arrastra
      if (!editor.isEditable()) return; // sin controles en modo lectura/preview
      const target = e.target as HTMLElement;
      const tableEl = target.closest("table") as HTMLElement | null;
      const wrapperControls = target.closest("[data-table-controls]");

      if (!tableEl && !wrapperControls) {
        setActiveTable(null);
        setHoveredRow(null);
        setHoveredCol(null);
        return;
      }
      if (!tableEl) return; // mouse está sobre los controles mismos, no cambiar nada

      editor.read(() => {
        const node = $getNearestTableNode(editor, tableEl);
        if (!node) return;
        setActiveTable((prev) =>
          prev?.key === node.getKey() ? prev : { key: node.getKey(), el: tableEl },
        );
      });
    };

    // registerRootListener entrega (nextRoot, prevRoot) y se dispara de
    // nuevo cada vez que el root real cambia (incluida la primera vez
    // que deja de ser null tras el montaje inicial de ContentEditable).
    return editor.registerRootListener((nextRoot, prevRoot) => {
      prevRoot?.removeEventListener("mousemove", handleMouseMove);

      scrollContainerRef.current =
        (nextRoot?.closest('[style*="overflow"]') as HTMLElement) ||
        (nextRoot?.parentElement as HTMLElement) ||
        nextRoot;
      recompute();

      nextRoot?.addEventListener("mousemove", handleMouseMove);
    });
  }, [editor, isResizing, recompute]);

  useEffect(() => {
    recompute();
  }, [recompute, activeTable]);

  // Recalcular geometría en resize de ventana / scroll (los controles
  // deben seguir alineados si el layout cambia).
  useEffect(() => {
    const handle = () => recompute();
    window.addEventListener("resize", handle);
    const container = scrollContainerRef.current;
    container?.addEventListener("scroll", handle);
    return () => {
      window.removeEventListener("resize", handle);
      container?.removeEventListener("scroll", handle);
    };
  }, [recompute]);

  // ── Mutaciones: agregar/quitar fila o columna ──────────────────────
  const withCellSelection = useCallback(
    (rowIndex: number | null, colIndex: number | null, fn: () => void) => {
      if (!activeTable) return;
      editor.update(() => {
        const tableNode = $getNodeByKey(activeTable.key);
        if (!tableNode || !$isTableNode(tableNode)) return;
        const targetCell = findCellAt(tableNode, rowIndex, colIndex);
        if (!targetCell) return;
        targetCell.selectStart();
        fn();
      });
    },
    [editor, activeTable],
  );

  const addRow = () => withCellSelection(-1, 0, () => $insertTableRowAtSelection(true));
  const addColumn = () => withCellSelection(0, -1, () => $insertTableColumnAtSelection(true));
  const deleteRow = (rowIndex: number) =>
    withCellSelection(rowIndex, 0, () => $deleteTableRowAtSelection());
  const deleteColumn = (colIndex: number) =>
    withCellSelection(0, colIndex, () => $deleteTableColumnAtSelection());

  // ── Resize de columna ───────────────────────────────────────────────
  const startResize = (colIndex: number, startX: number, currentWidthPx: number) => {
    resizeStateRef.current = {
      tableKey: activeTable?.key ?? "",
      colIndex,
      startX,
      startWidth: currentWidthPx,
    };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: MouseEvent) => {
      const st = resizeStateRef.current;
      if (!st) return;
      const delta = e.clientX - st.startX;
      const newWidth = Math.max(40, Math.round(st.startWidth + delta));

      editor.update(() => {
        const tableNode = $getNodeByKey(st.tableKey);
        if (!tableNode || !$isTableNode(tableNode)) return;
        for (const row of tableNode.getChildren()) {
          if (!$isTableRowNode(row)) continue;
          const cell = row.getChildren()[st.colIndex];
          if (cell && $isTableCellNode(cell)) {
            (cell as TableCellNode).setWidth(newWidth);
          }
        }
      });
    };

    const handleUp = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing, editor]);

  if (!activeTable || !geometry || !scrollContainerRef.current) return null;

  const container = scrollContainerRef.current;
  const { tableRect, rowRects, colRects } = geometry;

  return createPortal(
    <div
      data-table-controls
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {/* Botón "+" agregar fila — debajo de la tabla, centrado */}
      <div style={{ pointerEvents: "auto" }}>
        <ControlButton
          title="Agregar fila"
          onClick={addRow}
          style={{
            top: tableRect.bottom + 4,
            left: tableRect.left + tableRect.width / 2 - 8,
          }}
        />
      </div>

      {/* Botón "+" agregar columna — a la derecha de la tabla, centrado verticalmente */}
      <div style={{ pointerEvents: "auto" }}>
        <ControlButton
          title="Agregar columna"
          onClick={addColumn}
          style={{
            top: tableRect.top + tableRect.height / 2 - 8,
            left: tableRect.right + 4,
          }}
        />
      </div>

      {/* Franjas de hover + botón "×" por fila, a la izquierda de la tabla */}
      {rowRects.map((r, i) => (
        <div key={`row-${i}`} style={{ pointerEvents: "auto" }}>
          <div
            onMouseEnter={() => setHoveredRow(i)}
            onMouseLeave={() => setHoveredRow((h) => (h === i ? null : h))}
            style={{
              position: "absolute",
              top: r.top,
              left: tableRect.left - 18,
              width: 18,
              height: r.height,
            }}
          />
          {hoveredRow === i && rowRects.length > 1 && (
            <ControlButton
              title="Borrar fila"
              danger
              onClick={() => deleteRow(i)}
              style={{ top: r.top + r.height / 2 - 8, left: tableRect.left - 20 }}
            />
          )}
        </div>
      ))}

      {/* Franjas de hover + botón "×" por columna, arriba de la tabla, y handle de resize */}
      {colRects.map((c, i) => (
        <div key={`col-${i}`} style={{ pointerEvents: "auto" }}>
          <div
            onMouseEnter={() => setHoveredCol(i)}
            onMouseLeave={() => setHoveredCol((h) => (h === i ? null : h))}
            style={{
              position: "absolute",
              top: tableRect.top - 18,
              left: c.left,
              width: c.width,
              height: 18,
            }}
          />
          {hoveredCol === i && colRects.length > 1 && (
            <ControlButton
              title="Borrar columna"
              danger
              onClick={() => deleteColumn(i)}
              style={{ top: tableRect.top - 20, left: c.left + c.width / 2 - 8 }}
            />
          )}
          {/* Handle de resize: franja delgada sobre el borde derecho de la columna */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              startResize(i, e.clientX, c.width);
            }}
            title="Arrastrar para redimensionar"
            style={{
              position: "absolute",
              top: tableRect.top,
              left: c.right - 3,
              width: 6,
              height: tableRect.height,
              cursor: "col-resize",
              background:
                isResizing && resizeStateRef.current?.colIndex === i
                  ? HOVER_ACCENT
                  : "transparent",
              zIndex: 20,
            }}
          />
        </div>
      ))}
    </div>,
    container,
  );
}

// ── Helpers internos ──────────────────────────────────────────────────

function $getNearestTableNode(editor: LexicalEditor, tableEl: HTMLElement): TableNode | null {
  void editor; // ya no se usa directamente, se mantiene por claridad de la firma
  // Recorremos por dataset: Lexical no marca <table> con un atributo
  // propio directamente, así que resolvemos vía el LexicalNode asociado
  // al DOM buscando desde cualquier <td>/<th> hijo (esos sí están en el
  // mapping interno), usando la API pública $getNearestNodeFromDOMNode
  // en vez de tocar propiedades privadas del editor.
  const cellEl = tableEl.querySelector("td, th") as HTMLElement | null;
  if (!cellEl) return null;
  const cellNode = $getNearestNodeFromDOMNode(cellEl);
  if (!cellNode || !$isTableCellNode(cellNode)) return null;
  try {
    return $getTableNodeFromLexicalNodeOrThrow(cellNode);
  } catch {
    return null;
  }
}

function findCellAt(
  tableNode: TableNode,
  rowIndex: number | null,
  colIndex: number | null,
): TableCellNode | null {
  const rows = tableNode.getChildren();
  if (rows.length === 0) return null;
  const r = rowIndex === null ? 0 : rowIndex < 0 ? rows.length - 1 : rowIndex;
  const row = rows[Math.min(r, rows.length - 1)];
  if (!$isTableRowNode(row)) return null;
  const cells = row.getChildren();
  if (cells.length === 0) return null;
  const c = colIndex === null ? 0 : colIndex < 0 ? cells.length - 1 : colIndex;
  const cell = cells[Math.min(c, cells.length - 1)];
  return $isTableCellNode(cell) ? cell : null;
}

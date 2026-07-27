"use client";
/**
 * TablePlugin.tsx
 * ────────────────
 * Soporte de tablas para RichEditor vía el paquete oficial @lexical/table.
 * No reinventamos nada: TableNode/TableRowNode/TableCellNode manejan
 * layout, navegación con Tab/flechas, y selección de celdas de fábrica.
 *
 * Serialización: TableNode exporta a Markdown vía $convertToMarkdownString
 * de @lexical/markdown si TableCellNode/TableRowNode están en TRANSFORMERS,
 * pero como este editor serializa a SU PROPIO formato raw (no markdown
 * estándar), walkNode() en richTextSerializer.ts necesita un caso explícito
 * para tablas (ver ese archivo) que reconstruye "| a | b |\n|---|---|\n..."
 * manualmente, igual que hacía TableEditorPanel en el MarkdownEditor viejo.
 *
 * Inserción: se expone insertTable(editor, rows, cols) para conectar desde
 * el slash-command "/tabla" en SlashCommandPlugin/commandItems.
 */
import { TablePlugin as LexicalTablePlugin } from "@lexical/react/LexicalTablePlugin";
import { TableNode, TableRowNode, TableCellNode, TableCellHeaderStates, $createTableNodeWithDimensions } from "@lexical/table";
import type { LexicalEditor } from "lexical";
import { $insertNodes } from "lexical";

// Nodos a registrar en RICH_EDITOR_NODES (ver RichEditor.tsx)
export const TABLE_NODES = [TableNode, TableRowNode, TableCellNode];

/**
 * Inserta una tabla de rows×cols en la posición del cursor. La primera
 * fila se crea como header (mismo comportamiento visual que el editor
 * de tabla del MarkdownEditor original, donde la fila 0 tenía estilo
 * distinto y no era eliminable).
 */
export function insertTable(
  editor: LexicalEditor,
  rows: number = 3,
  cols: number = 3,
): void {
  editor.update(() => {
    const tableNode = $createTableNodeWithDimensions(rows, cols, true);
    $insertNodes([tableNode]);
  });
}

/**
 * Wrapper delgado sobre el plugin oficial de Lexical — registra los
 * comandos de navegación/selección de tabla (Tab, flechas, selección
 * de rango de celdas). Sin esto los TableNode se renderizan pero no
 * son interactivos.
 */
export function TablePlugin() {
  return <LexicalTablePlugin />;
}

/**
 * CÓMO CONECTAR "/tabla" DESDE SnippetCommandPalette
 * ────────────────────────────────────────────────────
 * insertTable() NO pasa por insertSnippetNode() (que espera un string
 * "[[kind|...]]") porque una tabla no es un snippet de una línea — es un
 * nodo con dimensiones. RichEditor expone insertTableRef específicamente
 * para esto:
 *
 *   // En EditorCapitulos.tsx (o donde viva SnippetCommandPalette):
 *   const insertTableRef = useRef<((rows?, cols?) => void) | null>(null);
 *
 *   <RichEditor insertTableRef={insertTableRef} ... />
 *
 *   // Al elegir el comando "tabla" en la palette (agregar un CommandItem
 *   // con id: "table" a commandItems.ts, sin snippet ni action propios):
 *   if (item.id === "table") {
 *     insertTableRef.current?.(3, 3); // filas, columnas por defecto
 *     return;
 *   }
 *   // Para los demás items (drop, choice, etc.), el flujo sigue igual:
 *   // openPalette(...) → onInsert(raw) → insertRef.current(raw)
 */

export { TableCellHeaderStates };

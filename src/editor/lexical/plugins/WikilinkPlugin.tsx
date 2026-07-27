"use client";
/**
 * WikilinkPlugin.tsx
 * ───────────────────
 * Detecta "[[" mientras el usuario escribe (estilo Obsidian) y delega la
 * apertura del menú de autocompletado al padre, que renderiza su propia
 * lista flotante (WikilinkMenu) fuera del árbol de Lexical — mismo patrón
 * que SlashCommandPlugin/SnippetCommandPalette.
 *
 * Este plugin NO dibuja ningún menú — solo:
 *   1. Detecta el patrón "[[query" en el texto justo antes del cursor.
 *   2. Calcula el rect de pantalla donde debería anclarse el menú.
 *   3. Llama a onMatch(anchorRect, query) para que el padre abra su UI.
 *   4. Al elegir una entidad, borra el "[[query" y los "]]" de cierre si
 *      existen, e inserta el WikilinkNode.
 *
 * Por qué un trigger fn manual y no un plugin con menú propio: mismo
 * razonamiento que SlashCommandPlugin — queremos una sola implementación
 * de menú flotante reutilizable, no una por cada trigger de texto.
 */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from "lexical";
import type { EditorState } from "lexical";
import { useCallback, useEffect, useRef } from "react";

import { $createWikilinkNode } from "../nodes/WikilinkNode";

export interface WikilinkMatch {
  /** Texto buscado después de "[[" (sin los corchetes) */
  query: string;
  /** Posición de pantalla donde anclar el menú */
  anchorRect: { top: number; left: number };
}

interface WikilinkPluginProps {
  /** Se llama cuando se detecta "[[" + query válido. null para cerrar. */
  onMatch: (match: WikilinkMatch | null) => void;
  /**
   * Ref que el padre invoca para insertar el wikilink elegido. Reemplaza
   * el "[[query" (y "]]" de cierre si existe) por el nodo real.
   */
  insertRef?: React.MutableRefObject<((target: string) => void) | null>;
  /**
   * Ref que el padre invoca cuando el menú se cierra por cualquier motivo
   * (click afuera, Escape, selección hecha). Reactiva la detección —
   * mismo problema que notifyClosedRef en SlashCommandPlugin.
   */
  notifyClosedRef?: React.MutableRefObject<(() => void) | null>;
  /** true mientras el menú de wikilinks está abierto — controla si este
   *  plugin intercepta flechas/Enter/Tab para navegar la lista en vez de
   *  dejar que Lexical los procese como edición normal. */
  isMenuOpen?: boolean;
  onArrowDown?: () => void;
  onArrowUp?: () => void;
  onConfirmSelection?: () => void;
}

// "[[" seguido de texto sin "[" ni "]" — opcionalmente vacío (recién
// escritos los corchetes). No cruza líneas.
const WIKILINK_RE = /\[\[([^\[\]]*)$/;

export function WikilinkPlugin({
  onMatch,
  insertRef,
  notifyClosedRef,
  isMenuOpen = false,
  onArrowDown,
  onArrowUp,
  onConfirmSelection,
}: WikilinkPluginProps) {
  const [editor] = useLexicalComposerContext();
  const activeRef = useRef(false);

  // Borra el "[[query" (y "]]" de cierre inmediato si existe) del nodo de
  // texto actual, sin importar dónde esté el foco DOM ahora mismo.
  const clearWikilinkQuery = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
      const node = selection.anchor.getNode();
      if (!$isTextNode(node)) return;

      const offset = selection.anchor.offset;
      const textContent = node.getTextContent();
      const textBeforeCursor = textContent.slice(0, offset);
      const match = WIKILINK_RE.exec(textBeforeCursor);
      if (!match) return;

      const matchStart = offset - match[0].length;
      // Si justo después del cursor hay "]]" de auto-cierre, lo incluimos
      // en el borrado para no dejar corchetes huérfanos.
      const textAfterCursor = textContent.slice(offset);
      const hasClosing = textAfterCursor.startsWith("]]");
      const deleteEnd = offset + (hasClosing ? 2 : 0);

      node.spliceText(matchStart, deleteEnd - matchStart, "", true);
    });
  }, [editor]);

  const insertWikilink = useCallback(
    (target: string) => {
      clearWikilinkQuery();
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const node = $createWikilinkNode({ target });
        selection.insertNodes([node]);
      });
      activeRef.current = false;
    },
    [editor, clearWikilinkQuery],
  );

  useEffect(() => {
    if (!insertRef) return;
    insertRef.current = insertWikilink;
    return () => {
      insertRef.current = null;
    };
  }, [insertRef, insertWikilink]);

  useEffect(() => {
    if (!notifyClosedRef) return;
    notifyClosedRef.current = () => {
      activeRef.current = false;
      clearWikilinkQuery();
    };
    return () => {
      notifyClosedRef.current = null;
    };
  }, [notifyClosedRef, clearWikilinkQuery]);

  const checkForWikilinkMatch = useCallback(
    (editorState: EditorState) => {
      if (activeRef.current) return;

      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

        const node = selection.anchor.getNode();
        if (!$isTextNode(node)) return;

        const offset = selection.anchor.offset;
        const textBeforeCursor = node.getTextContent().slice(0, offset);
        const match = WIKILINK_RE.exec(textBeforeCursor);
        if (!match) return;

        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) return;
        const collapsedRange = domSelection.getRangeAt(0);
        const anchorNode = domSelection.anchorNode;
        const anchorOffset = domSelection.anchorOffset;

        // Mismo truco que SlashCommandPlugin: medir un rango no-colapsado
        // desde el "[[" hasta el cursor da un rect fiable; el rango
        // colapsado puede devolver (0,0,0,0) en algunos navegadores.
        const matchLength = match[0].length;
        const matchStartOffset = Math.max(0, anchorOffset - matchLength);

        let rect: DOMRect = collapsedRange.cloneRange().getBoundingClientRect();
        if (anchorNode) {
          try {
            const measureRange = document.createRange();
            measureRange.setStart(anchorNode, matchStartOffset);
            measureRange.setEnd(anchorNode, anchorOffset);
            const measured = measureRange.getBoundingClientRect();
            if (measured.width > 0 || measured.height > 0) {
              rect = measured;
            }
          } catch {
            // offsets fuera de rango — nos quedamos con el fallback.
          }
        }

        activeRef.current = true;
        onMatch({
          query: match[1] ?? "",
          anchorRect: {
            top: rect.bottom + 6,
            left: rect.left,
          },
        });
      });
    },
    [onMatch],
  );

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      checkForWikilinkMatch(editorState);
    });
  }, [editor, checkForWikilinkMatch]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (!activeRef.current) return false;
        activeRef.current = false;
        clearWikilinkQuery();
        onMatch(null);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onMatch, clearWikilinkQuery]);

  // Navegación del menú con teclado — prioridad ALTA para interceptar
  // antes de que Lexical mueva el cursor o inserte un salto de línea.
  // Solo activo mientras isMenuOpen (el padre lo controla vía el estado
  // de WikilinkMenuPanel).
  useEffect(() => {
    if (!isMenuOpen) return;
    const unregister = [
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          event?.preventDefault();
          onArrowDown?.();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          event?.preventDefault();
          onArrowUp?.();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          event?.preventDefault();
          onConfirmSelection?.();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          event?.preventDefault();
          onConfirmSelection?.();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    ];
    return () => unregister.forEach((u) => u());
  }, [editor, isMenuOpen, onArrowDown, onArrowUp, onConfirmSelection]);

  return null;
}

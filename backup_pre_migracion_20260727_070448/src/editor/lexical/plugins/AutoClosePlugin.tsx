"use client";
/**
 * AutoClosePlugin.tsx
 * ─────────────────────
 * Auto-cierre de pares al escribir "(", "{" o "[" — mismo comportamiento
 * que el handleKeyDown de MarkdownEditor.tsx (autoClosePairs), pero vía
 * Lexical KEY_DOWN_COMMAND en vez de manipular un textarea directamente.
 *
 * IMPORTANTE: excluye explícitamente "[" cuando forma parte de "[[" —
 * ese patrón es territorio de WikilinkPlugin (que maneja su propio
 * auto-cierre de "]]" al detectar el segundo "["). Si este plugin
 * interceptara el primer "[" también, competiría con WikilinkPlugin por
 * el mismo evento y rompería la detección de wikilinks.
 *
 * Comportamiento:
 *   - Con selección activa: envuelve la selección entre el par (igual que
 *     wrapSelection en MarkdownEditor).
 *   - Sin selección: inserta el par vacío y coloca el cursor en el medio.
 *   - Si el cursor está justo antes de un cierre igual al que se acaba de
 *     escribir (ej: escribes ")" y ya hay ")" después del cursor), salta
 *     por encima en vez de duplicar — comportamiento estándar de editores.
 */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
} from "lexical";
import { useEffect } from "react";

const PAIRS: Record<string, string> = {
  "(": ")",
  "{": "}",
};

const CLOSERS = new Set(Object.values(PAIRS));

export function AutoClosePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const key = event.key;

        // "[" se maneja acá SOLO cuando no es el inicio de "[[" — si el
        // carácter justo antes del cursor ya es "[", cedemos el evento a
        // WikilinkPlugin (no hacemos preventDefault, dejamos que el "["
        // se escriba normal y WikilinkPlugin lo detecte en su
        // registerUpdateListener).
        if (key === "[") {
          let precededByBracket = false;
          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
            const node = selection.anchor.getNode();
            if (!$isTextNode(node)) return;
            const offset = selection.anchor.offset;
            precededByBracket = node.getTextContent()[offset - 1] === "[";
          });
          if (precededByBracket) return false; // deja pasar, es "[["

          // Primer "[" suelto: lo tratamos como par normal (podría ser
          // el inicio de un wikilink o simplemente un corchete literal).
          event.preventDefault();
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            if (!selection.isCollapsed()) {
              const text = selection.getTextContent();
              selection.insertText(`[${text}]`);
              return;
            }
            selection.insertText("[]");
            selection.anchor.offset -= 1;
            selection.focus.offset -= 1;
          });
          return true;
        }

        if (key in PAIRS) {
          event.preventDefault();
          const closer = PAIRS[key];
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            if (!selection.isCollapsed()) {
              const text = selection.getTextContent();
              selection.insertText(`${key}${text}${closer}`);
              return;
            }
            selection.insertText(`${key}${closer}`);
            selection.anchor.offset -= 1;
            selection.focus.offset -= 1;
          });
          return true;
        }

        // Saltar por encima de un cierre existente en vez de duplicarlo.
        if (CLOSERS.has(key)) {
          let shouldSkip = false;
          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
            const node = selection.anchor.getNode();
            if (!$isTextNode(node)) return;
            const offset = selection.anchor.offset;
            shouldSkip = node.getTextContent()[offset] === key;
          });
          if (shouldSkip) {
            event.preventDefault();
            editor.update(() => {
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) return;
              selection.anchor.offset += 1;
              selection.focus.offset += 1;
            });
            return true;
          }
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}

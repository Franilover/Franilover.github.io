"use client";
/**
 * HeadingBackspacePlugin.tsx
 * ────────────────────────────
 * Al escribir "# " el MarkdownShortcutPlugin convierte el párrafo en un
 * HeadingNode real (h1..h6). Pero Lexical, por defecto, NO ofrece manera
 * de "deshacer" eso con Backspace — si el cursor está al principio de un
 * heading y borrás, Lexical intenta fusionar con el bloque anterior (o no
 * hace nada si es el primer bloque), pero el heading sigue siendo heading.
 * El usuario queda "atrapado" en el tamaño de fuente grande sin ninguna
 * forma de volver a texto normal salvo reescribiendo todo el bloque.
 *
 * Este plugin intercepta KEY_BACKSPACE_COMMAND con prioridad alta: si la
 * selección está colapsada en el offset 0 de un HeadingNode, convierte
 * ese nodo a un ParagraphNode normal (conservando su contenido e hijos)
 * en vez de dejar que Lexical procese el borrado por default. Es el mismo
 * comportamiento que Notion/Obsidian: Backspace al inicio de un heading
 * "quita" el header y vuelve a párrafo, sin borrar el texto.
 *
 * Si el heading YA estaba vacío, el resultado es un párrafo vacío — texto
 * normal, cursor en el mismo lugar, tamaño de fuente normal.
 */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $isHeadingNode } from "@lexical/rich-text";
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  COMMAND_PRIORITY_HIGH,
  KEY_BACKSPACE_COMMAND,
} from "lexical";
import { useEffect } from "react";

export function HeadingBackspacePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event: KeyboardEvent) => {
        let handled = false;

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

          const anchor = selection.anchor;
          if (anchor.offset !== 0) return;

          // El nodo ancla puede ser el propio HeadingNode (selección de
          // bloque) o un TextNode/hijo directo dentro de él — subimos al
          // primer ancestro de tipo heading, o al nodo mismo si ya lo es.
          const node = anchor.getNode();
          const headingNode = $isHeadingNode(node)
            ? node
            : node.getParents().find($isHeadingNode);

          if (!headingNode) return;

          // Confirmamos que el cursor está realmente al principio del
          // heading completo (no solo al principio de un hijo intermedio).
          const firstDescendant = (headingNode as any).getFirstDescendant?.();
          if (firstDescendant && node !== headingNode) {
            const isAtVeryStart =
              node === firstDescendant ||
              (firstDescendant?.getKey?.() === node.getKey?.());
            if (!isAtVeryStart) return;
          }

          event?.preventDefault();

          const paragraph = $createParagraphNode();
          const children = (headingNode as any).getChildren?.() ?? [];
          children.forEach((child: any) => paragraph.append(child));
          headingNode.replace(paragraph);
          paragraph.select(0, 0);

          handled = true;
        });

        return handled;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}

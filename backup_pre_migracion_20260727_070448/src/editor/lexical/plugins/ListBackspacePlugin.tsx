"use client";
/**
 * ListBackspacePlugin.tsx
 * ─────────────────────────
 * Al insertar una lista (con viñetas o numerada) desde "/" o escribiendo
 * "- "/"1. ", Lexical convierte el bloque en un ListItemNode dentro de un
 * ListNode. Pero el comportamiento por defecto de Backspace al inicio de
 * un item NO es "salir de la lista" — es "fusionar este item con el
 * anterior" (mismo mecanismo genérico de RangeSelection.deleteCharacter
 * hacia atrás que usa cualquier ElementNode). Eso da la sensación de que
 * "sube" en vez de "sacarte" de la lista: el cursor termina pegado al
 * final del item anterior, la lista sigue siendo lista.
 *
 * Nota: listas NUMERADAS a veces "parecen" comportarse distinto porque al
 * fusionar el primer item vacío con "nada" (no hay item anterior), Lexical
 * cae a un camino distinto que sí puede desarmar el ListNode completo si
 * quedó vacío — pero es un efecto secundario accidental del caso borde
 * "primer item, lista de un solo elemento", no un comportamiento
 * consistente para cualquier item en cualquier posición.
 *
 * Este plugin intercepta KEY_BACKSPACE_COMMAND con prioridad alta: si el
 * cursor está colapsado en offset 0 de un ListItemNode, en vez de dejar
 * que Lexical fusione hacia atrás, convertimos ESE item en un
 * ParagraphNode normal insertado en el lugar de la lista (mismo
 * comportamiento que Notion/Obsidian: Backspace al inicio de un bullet
 * "quita" la viñeta y vuelve a texto normal, sin borrar contenido ni
 * tocar los demás items).
 *
 * Casos cubiertos:
 *   - Item en medio/final de la lista: se extrae como párrafo entre los
 *     items anteriores y posteriores (la lista se parte en dos si hace
 *     falta, para no perder el resto de items).
 *   - Único item de la lista (lista con un solo elemento): la lista
 *     completa se reemplaza por el párrafo.
 *   - Primer item con más items después: el párrafo queda ANTES del
 *     ListNode (que conserva los items restantes).
 */
import { $isListItemNode, $isListNode, $createListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type {
  LexicalNode} from "lexical";
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  COMMAND_PRIORITY_HIGH,
  KEY_BACKSPACE_COMMAND
} from "lexical";
import { useEffect } from "react";

export function ListBackspacePlugin() {
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

          const node = anchor.getNode();
          const listItem = $isListItemNode(node)
            ? node
            : node.getParents().find($isListItemNode);
          if (!listItem) return;

          // Confirmamos que el cursor está al principio REAL del item
          // (no solo al principio de un hijo intermedio, ej. dentro de
          // un nested formatting span).
          const firstDescendant = (listItem as any).getFirstDescendant?.();
          if (firstDescendant && node !== listItem) {
            const isAtVeryStart = firstDescendant.getKey?.() === node.getKey?.();
            if (!isAtVeryStart) return;
          }

          const listNode = listItem.getParent();
          if (!$isListNode(listNode)) return;

          event?.preventDefault();

          // Extraemos el contenido del item (puede incluir texto Y una
          // sub-lista anidada — la dejamos tal cual dentro del párrafo
          // resultante no tendría sentido, así que solo movemos los
          // hijos de texto/inline; una sub-lista anidada, si la hay, la
          // promovemos como hermano del párrafo para no perderla).
          const paragraph = $createParagraphNode();
          const children: LexicalNode[] = (listItem as any).getChildren?.() ?? [];
          const nestedList = children.find($isListNode);
          children
            .filter((c) => c !== nestedList)
            .forEach((child) => paragraph.append(child));

          const siblingItems = listNode.getChildren();
          const itemIndex = siblingItems.indexOf(listItem as any);
          const before = siblingItems.slice(0, itemIndex);
          const after = siblingItems.slice(itemIndex + 1);

          if (before.length === 0 && after.length === 0) {
            // Único item de la lista: la lista entera se convierte en
            // el párrafo, sin dejar un ListNode vacío huérfano.
            listNode.replace(paragraph);
          } else if (before.length === 0) {
            // Primer item, hay más después: párrafo antes de la lista
            // (que conserva el resto de items).
            listNode.insertBefore(paragraph);
            listItem.remove();
          } else if (after.length === 0) {
            // Último item: párrafo después de la lista.
            listNode.insertAfter(paragraph);
            listItem.remove();
          } else {
            // Item en medio: partimos la lista en dos (misma etiqueta y
            // tipo que la original) para no perder los items siguientes,
            // con el párrafo entre ambas mitades.
            const secondListNode = $createListNode(
              (listNode as any).getListType?.() ?? "bullet",
            );
            after.forEach((n) => secondListNode.append(n as any));
            listNode.insertAfter(secondListNode);
            secondListNode.insertBefore(paragraph);
            listItem.remove();
          }

          // Si había una sub-lista anidada dentro del item, la
          // preservamos justo después del párrafo en vez de perderla.
          if (nestedList) {
            paragraph.insertAfter(nestedList);
          }

          paragraph.selectStart();
          handled = true;
        });

        return handled;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}

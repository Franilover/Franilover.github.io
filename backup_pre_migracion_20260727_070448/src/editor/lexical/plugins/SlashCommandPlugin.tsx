"use client";
/**
 * SlashCommandPlugin.tsx
 * ───────────────────────
 * Detecta "/" mientras el usuario escribe (estilo Notion) y delega la
 * apertura del menú de snippets al padre (EditorCapitulos), que ya
 * renderiza <SnippetCommandPalette/> fuera del árbol de Lexical.
 *
 * Este plugin NO dibuja ningún menú — solo:
 *   1. Detecta el patrón "/query" en el texto justo antes del cursor.
 *   2. Calcula el rect de pantalla donde debería anclarse el menú.
 *   3. Llama a onOpenPalette(anchorRect, query) para que el padre abra
 *      su propia UI (SnippetCommandPalette).
 *   4. Si el usuario seseleciona un comando (selectOption), borra el
 *      "/query" del documento antes de insertar el nodo correspondiente.
 *
 * Por qué un trigger fn manual y no <LexicalTypeaheadMenuPlugin> con su
 * menú propio: SnippetCommandPalette ya existe, tiene su propio look y
 * lógica de edición de snippets existentes (ver handleSnippetEdit en
 * EditorCapitulos) — no queremos dos implementaciones de menú distintas.
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

export interface SlashMatch {
  /** Texto buscado después de "/" (sin la barra) */
  query: string;
  /** Posición de pantalla donde anclar el menú */
  anchorRect: { top: number; left: number };
}

interface SlashCommandPluginProps {
  /** Se llama cuando se detecta "/" + query válido. null para cerrar. */
  onMatch: (match: SlashMatch | null) => void;
  /**
   * Ref que el padre puede usar para pedirle al plugin que borre el
   * "/query" actual del documento (justo antes de insertar el snippet
   * elegido). Se setea automáticamente — el padre solo lo invoca.
   */
  removeMatchRef?: React.MutableRefObject<(() => void) | null>;
  /**
   * Ref que el padre invoca cuando la palette se cierra por CUALQUIER
   * motivo (click afuera, Escape en el popover, comando insertado).
   * Reactiva la detección de "/" en el plugin — sin esto, una vez
   * abierta la palette el plugin dejaba de escuchar para siempre
   * porque activeRef.current nunca se limpiaba desde fuera.
   */
  notifyClosedRef?: React.MutableRefObject<(() => void) | null>;
  /**
   * true mientras el panel de comandos (markdown en modo normal, o
   * SnippetCommandPalette en modo libro) está abierto — controla si este
   * plugin intercepta flechas/Enter/Tab para navegar la lista en vez de
   * dejar que Lexical los procese como edición normal. Mismo patrón que
   * WikilinkPlugin. En modo libro (SnippetCommandPalette) el padre puede
   * simplemente no pasar estas props: sin isMenuOpen, este bloque nunca
   * registra los comandos y el comportamiento queda igual que antes.
   */
  isMenuOpen?: boolean;
  onArrowDown?: () => void;
  onArrowUp?: () => void;
  onConfirmSelection?: () => void;
}

// Sólo dispara dentro de la palabra actual: "/" seguido de texto sin
// espacios, opcionalmente vacío (recién escrito el "/").
const SLASH_RE = /(?:^|\s)\/([a-zA-Z0-9áéíóúñ\-]*)$/;

export function SlashCommandPlugin({
  onMatch,
  removeMatchRef,
  notifyClosedRef,
  isMenuOpen = false,
  onArrowDown,
  onArrowUp,
  onConfirmSelection,
}: SlashCommandPluginProps) {
  const [editor] = useLexicalComposerContext();
  const activeRef = useRef(false);

  // Borra el "/query" actual del documento, si lo hay, sin importar
  // dónde esté enfocado el DOM ahora mismo — usamos la selección lógica
  // que Lexical sigue conservando en su EditorState aunque el foco DOM
  // se haya movido al <input> del popover.
  const clearSlashQuery = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
      const node = selection.anchor.getNode();
      if (!$isTextNode(node)) return;

      const offset = selection.anchor.offset;
      const textBeforeCursor = node.getTextContent().slice(0, offset);
      const match = SLASH_RE.exec(textBeforeCursor);
      if (!match) return;

      const matchStart =
        offset - match[0].length + (match[0].startsWith(" ") ? 1 : 0);
      node.spliceText(matchStart, offset - matchStart, "", true);
    });
  }, [editor]);

  // El padre llama esto cuando SnippetCommandPalette se cierra por
  // CUALQUIER motivo: click-outside, Escape en el popover, o tras
  // insertar un snippet. SIEMPRE borra el "/query" residual del
  // documento (si quedó alguno) y reactiva la detección para el
  // próximo "/". Antes esto solo reseteaba activeRef y dejaba el "/"
  // escrito si el usuario cerraba sin elegir nada.
  useEffect(() => {
    if (!notifyClosedRef) return;
    notifyClosedRef.current = () => {
      activeRef.current = false;
      clearSlashQuery();
    };
    return () => {
      notifyClosedRef.current = null;
    };
  }, [notifyClosedRef, clearSlashQuery]);

  const checkForSlashMatch = useCallback(
    (editorState: EditorState) => {
      // Si la palette ya está abierta, no seguimos re-evaluando el
      // documento en cada update. Una vez que el usuario "entra" al
      // popover (foco se mueve a su <input>), Lexical deja de ser la
      // fuente de verdad de lo que se está escribiendo — seguir leyendo
      // window.getSelection() acá competía con el popover por el foco
      // y dejaba al usuario sin poder escribir en ninguno de los dos.
      if (activeRef.current) return;

      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return;
        }

        const node = selection.anchor.getNode();
        if (!$isTextNode(node)) {
          return;
        }

        const offset = selection.anchor.offset;
        const textBeforeCursor = node.getTextContent().slice(0, offset);
        const match = SLASH_RE.exec(textBeforeCursor);

        if (!match) {
          return;
        }

        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) return;
        const collapsedRange = domSelection.getRangeAt(0);
        const anchorNode = domSelection.anchorNode;
        const anchorOffset = domSelection.anchorOffset;

        // No usamos el rect del rango colapsado (el del cursor) directamente:
        // 1) en varios navegadores, un Range colapsado puede devolver un
        //    DOMRect vacío (0,0,0,0) hasta el próximo repintado — eso hacía
        //    que el menú "saltara" a la esquina superior de la pantalla.
        // 2) el cursor avanza a la derecha a medida que el usuario escribe
        //    la query, así que anclar ahí movía el menú lejos del "/".
        // En cambio medimos un rango NO colapsado que va desde el "/" hasta
        // el cursor actual, dentro del mismo nodo de texto del DOM — un
        // rango con contenido real siempre devuelve un rect fiable, y su
        // borde izquierdo cae justo donde está el "/".
        const matchLength =
          match[0].length - (match[0].startsWith(" ") ? 1 : 0);
        const matchStartOffset = Math.max(0, anchorOffset - matchLength);

        let rect: DOMRect = collapsedRange.cloneRange().getBoundingClientRect();
        if (anchorNode) {
          try {
            const measureRange = document.createRange();
            measureRange.setStart(anchorNode, matchStartOffset);
            measureRange.setEnd(anchorNode, anchorOffset);
            const measured = measureRange.getBoundingClientRect();
            // Solo la usamos si trajo algo medible; si no, nos quedamos
            // con el rect colapsado de arriba como fallback.
            if (measured.width > 0 || measured.height > 0) {
              rect = measured;
            }
          } catch {
            // anchorOffset/matchStartOffset fuera de rango (edge case de
            // nodos de texto partidos) — nos quedamos con el fallback.
          }
        }

        // getBoundingClientRect() ya es relativo al viewport (fixed).
        // El popover usa position:fixed, así que NO hay que sumar
        // window.scrollY/scrollX — eso solo tiene sentido para elementos
        // con position:absolute dentro del flujo del documento. Sumarlo
        // acá disparaba el menú miles de píxeles fuera de la pantalla en
        // cuanto el editor (que tiene su propio overflow-y:auto) tenía
        // cualquier scroll.
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

  // Expone al padre cómo borrar el "/query" actual del documento.
  // Esto se invoca SIEMPRE justo antes de insertar el snippet elegido
  // (ver InsertSnippetPlugin), así que también reactivamos activeRef acá:
  // insertar un snippet siempre implica que la palette se está cerrando.
  useEffect(() => {
    if (!removeMatchRef) return;
    removeMatchRef.current = () => {
      activeRef.current = false;
      clearSlashQuery();
    };
    return () => {
      removeMatchRef.current = null;
    };
  }, [removeMatchRef, clearSlashQuery]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      checkForSlashMatch(editorState);
    });
  }, [editor, checkForSlashMatch]);

  // Escape cierra el menú si está abierto (fallback: solo dispara si el
  // foco DOM sigue en el editor, lo cual ya no es lo habitual ahora que
  // el popover toma foco al abrirse — el cierre real pasa por
  // notifyClosedRef desde EditorCapitulos).
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (!activeRef.current) return false;
        activeRef.current = false;
        clearSlashQuery();
        onMatch(null);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onMatch, clearSlashQuery]);

  // Navegación del menú con teclado — prioridad ALTA para interceptar
  // antes de que Lexical mueva el cursor o inserte un salto de línea.
  // Solo activo mientras isMenuOpen (el padre lo controla vía el estado
  // del panel visual — MarkdownCommandPalette en modo normal). Mismo
  // patrón que WikilinkPlugin, que ya tenía esto para "[[".
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

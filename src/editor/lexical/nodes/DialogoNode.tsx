"use client";
/**
 * DialogoNode.tsx
 * ───────────────
 * Nodo Lexical de BLOQUE para [[dialogo|personaje_id|texto]] — un diálogo
 * con nombre + retrato de un Personaje real. Mismo patrón que ImgNode
 * (DecoratorNode + payload + raw↔payload converters), con dos diferencias:
 *
 *   1) isInline() = false — el diálogo ocupa su propia línea/párrafo,
 *      igual que una cita o un epígrafe, no fluye dentro del texto.
 *   2) El chip resuelve el NOMBRE REAL del personaje contra Dexie
 *      (db.personajes, cache local offline-first) para mostrarlo en vez
 *      del id crudo mientras se edita — el payload solo guarda
 *      personajeId + texto, nunca nombre/retrato congelados. Esto es a
 *      propósito: si el usuario renombra al personaje después, el chip
 *      (y el render final en lectura, ver DialogoBlock en
 *      SegmentRenderers.tsx) se actualizan solos, sin re-guardar nada.
 */
import type {
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $getNodeByKey, DecoratorNode } from "lexical";
import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { db } from "@/infra/supabase/db";

import { snippetEditHandler } from "./sharedTypes";
import { SnippetChip } from "./SnippetChip";

export interface DialogoPayload {
  personajeId: string;
  texto: string;
}

export type SerializedDialogoNode = Spread<
  { type: "dialogo-snippet"; version: 1 } & DialogoPayload,
  SerializedLexicalNode
>;

// Cache en memoria compartida por todos los chips del documento — evita
// re-consultar Dexie por cada DialogoNode del mismo personaje (un diálogo
// largo puede tener el mismo personaje hablando decenas de veces).
const nombreCache = new Map<string, string>();

function DialogoChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: DialogoPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  const [nombre, setNombre] = useState<string>(
    nombreCache.get(payload.personajeId) ?? "…",
  );

  useEffect(() => {
    let cancelado = false;
    if (!payload.personajeId) return;

    const cached = nombreCache.get(payload.personajeId);
    if (cached) {
      setNombre(cached);
      return;
    }

    void db.personajes
      .get(payload.personajeId)
      .then((p) => {
        if (cancelado) return;
        const n = p?.nombre?.trim() || "Personaje";
        nombreCache.set(payload.personajeId, n);
        setNombre(n);
      })
      .catch(() => {
        if (!cancelado) setNombre("Personaje");
      });

    return () => {
      cancelado = true;
    };
  }, [payload.personajeId]);

  const preview =
    payload.texto.length > 24 ? payload.texto.slice(0, 24) + "…" : payload.texto;

  return (
    <SnippetChip
      icon={<MessageCircle size={10} />}
      text={`${nombre}: "${preview}"`}
      title={`Diálogo de ${nombre}`}
      maxTextWidth={220}
      onClick={() =>
        snippetEditHandler.current?.({
          kind: "dialogo" as any,
          nodeKey,
          payload,
          replace: (next: DialogoPayload) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isDialogoNode(node)) node.setPayload(next);
            }),
          remove: () =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isDialogoNode(node)) node.remove();
            }),
        })
      }
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isDialogoNode(node)) node.remove();
        })
      }
    />
  );
}

export class DialogoNode extends DecoratorNode<React.ReactNode> {
  __payload: DialogoPayload;

  static getType(): string {
    return "dialogo-snippet";
  }

  static clone(node: DialogoNode): DialogoNode {
    return new DialogoNode(node.__payload, node.__key);
  }

  constructor(payload: DialogoPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): DialogoNode {
    const { personajeId, texto } = serialized as unknown as SerializedDialogoNode;
    return $createDialogoNode({ personajeId, texto });
  }

  exportJSON(): SerializedDialogoNode {
    return { ...this.__payload, type: "dialogo-snippet", version: 1 };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement("div");
    // Bloque propio (igual criterio que CitaVisual/EpigrafeVisual en
    // lectura) — un diálogo ocupa su propia línea, no fluye inline.
    div.style.display = "block";
    div.style.margin = "8px 0";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: DialogoPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): DialogoPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return dialogoPayloadToRaw(this.__payload);
  }

  isInline(): false {
    return false;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <DialogoChipView
        editor={editor}
        nodeKey={this.getKey()}
        payload={this.__payload}
      />
    );
  }
}

export function $createDialogoNode(payload: DialogoPayload): DialogoNode {
  return new DialogoNode(payload);
}

export function $isDialogoNode(
  node: LexicalNode | null | undefined,
): node is DialogoNode {
  return node instanceof DialogoNode;
}

// raw = "[[dialogo|personaje_id|texto]]" — el texto puede contener "|"
// real (diálogo con guiones, citas dentro de la línea, etc.), así que solo
// el primer "|" después del personaje_id es estructural; el resto se une
// de vuelta con join("|"). Mismo criterio que parseContenido en types.ts.
export function dialogoRawToPayload(raw: string): DialogoPayload | null {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const parts = inner.split("|");
  if (parts[0]?.trim() !== "dialogo") return null;
  const personajeId = parts[1]?.trim() ?? "";
  const texto = parts.slice(2).join("|").trim();
  if (!personajeId) return null;
  return { personajeId, texto };
}

export function dialogoPayloadToRaw(p: DialogoPayload): string {
  return `[[dialogo|${p.personajeId}|${p.texto}]]`;
}

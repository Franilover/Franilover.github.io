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
 *   2) Resuelve el NOMBRE/RETRATO REAL del personaje contra Dexie
 *      (db.personajes, cache local offline-first) para mostrarlo en vez
 *      del id crudo mientras se edita — el payload solo guarda
 *      personajeId + texto, nunca nombre/retrato congelados. Esto es a
 *      propósito: si el usuario renombra al personaje después, el bloque
 *      (y el render final en lectura, ver DialogoBlock en
 *      SegmentRenderers.tsx) se actualizan solos, sin re-guardar nada.
 *
 * Render: en vez de un chip/pill que abre un panel flotante para editar,
 * el nodo renderiza DE UNA el mismo bloque visual que la página pública
 * (avatar + nombre + texto) pero con el texto editable in-place vía
 * textarea autoexpandible. El avatar/nombre siguen abriendo el panel
 * flotante (SnippetCommandPalette) — eso es exclusivamente para cambiar
 * de personaje, no para editar el texto.
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
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";

import { db } from "@/infra/supabase/db";

import { snippetEditHandler } from "./sharedTypes";

export interface DialogoPayload {
  personajeId: string;
  texto: string;
}

export type SerializedDialogoNode = Spread<
  { type: "dialogo-snippet"; version: 1 } & DialogoPayload,
  SerializedLexicalNode
>;

// Cache en memoria compartida por todos los bloques del documento — evita
// re-consultar Dexie por cada DialogoNode del mismo personaje (un diálogo
// largo puede tener el mismo personaje hablando decenas de veces).
interface DialogoPersonaje {
  nombre: string;
  img_url?: string;
}
const personajeCache = new Map<string, DialogoPersonaje>();

function DialogoInlineView({
  payload,
  nodeKey,
  editor,
}: {
  payload: DialogoPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  const [personaje, setPersonaje] = useState<DialogoPersonaje | null>(
    personajeCache.get(payload.personajeId) ?? null,
  );
  const [texto, setTexto] = useState(payload.texto);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // El payload puede cambiar desde afuera (p.ej. se cambió el personaje
  // vía el panel flotante) — resincroniza el estado local del texto.
  useEffect(() => {
    setTexto(payload.texto);
  }, [payload.texto]);

  useEffect(() => {
    let cancelado = false;
    if (!payload.personajeId) return;

    const cached = personajeCache.get(payload.personajeId);
    if (cached) {
      setPersonaje(cached);
      return;
    }

    void db.personajes
      .get(payload.personajeId)
      .then((p) => {
        if (cancelado || !p) return;
        const val = { nombre: p.nombre, img_url: p.img_url };
        personajeCache.set(payload.personajeId, val);
        setPersonaje(val);
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [payload.personajeId]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autoResize();
  }, [texto]);

  const commitTexto = (next: string) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isDialogoNode(node)) {
        node.setPayload({ ...node.getPayload(), texto: next });
      }
    });
  };

  const nombre = personaje?.nombre?.trim() || "…";

  const openPersonajePicker = () =>
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
    });

  return (
    <div
      className="dialogo-node group/dialogo flex items-start gap-3 my-4 relative"
      contentEditable={false}
    >
      <button
        className="shrink-0 w-11 h-11 rounded-full overflow-hidden bg-surface-1 border border-primary/15 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors"
        title="Cambiar personaje"
        type="button"
        onClick={openPersonajePicker}
      >
        {personaje?.img_url ? (
          <Image
            alt={nombre}
            className="w-full h-full object-cover"
            height={44}
            src={personaje.img_url}
            width={44}
          />
        ) : (
          <User className="text-primary/40" size={18} />
        )}
      </button>
      <div className="min-w-0 flex-1 pt-0.5">
        <button
          className="text-xs font-semibold text-primary/70 mb-0.5 hover:text-primary transition-colors cursor-pointer"
          title="Cambiar personaje"
          type="button"
          onClick={openPersonajePicker}
        >
          {nombre}
        </button>
        <textarea
          ref={textareaRef}
          className="block w-full resize-none bg-transparent outline-none text-[0.95em] leading-relaxed placeholder:text-foreground/30 border-b border-transparent focus:border-primary/25"
          placeholder="Qué dice…"
          rows={1}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            autoResize();
          }}
          onBlur={() => commitTexto(texto)}
        />
      </div>
      <button
        className="opacity-0 group-hover/dialogo:opacity-100 transition-opacity shrink-0 text-foreground/35 hover:text-red-400 text-xs px-1"
        title="Eliminar diálogo"
        type="button"
        onClick={() =>
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isDialogoNode(node)) node.remove();
          })
        }
      >
        ×
      </button>
    </div>
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
      <DialogoInlineView
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

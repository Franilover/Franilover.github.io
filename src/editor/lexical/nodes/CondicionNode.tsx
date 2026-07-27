"use client";
/**
 * CondicionNode.tsx
 * ──────────────────
 * Nodo Lexical inline unificado para condiciones automáticas del sistema:
 *
 *   - tipo "item": [[condicion|item|itemId||siTexto\n-> target\n===\nnoTexto\n-> target\n]]
 *     (reemplaza al viejo [[gate|itemId|...]]) — ¿el lector tiene este ítem?
 *   - tipo "flag": [[condicion|flag|flagId|valorEsperado|siTexto\n-> target\n===\nnoTexto\n-> target\n]]
 *     (reemplaza al viejo [[flag|if|flagId|valorEsperado|...]]) — ¿el flag vale X?
 *
 * Fusiona GateNode + la mitad "if" de FlagNode en un solo concepto:
 * "Condición" — el sistema decide automáticamente según una regla y
 * ramifica en dos (sí/no), igual forma en ambos casos, solo cambia qué se
 * evalúa. flag|set queda separado como "Acción" (ver FlagNode.tsx).
 *
 * Retrocompatibilidad: rawToPayload también reconoce el formato viejo
 * [[gate|itemId|...]] y [[flag|if|flagId|valorEsperado|...]] y los migra
 * automáticamente a CondicionPayload al leerlos.
 */
import type {
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $getNodeByKey, DecoratorNode } from "lexical";
import React from "react";
import { GitBranch } from "lucide-react";

import {
  snippetEditHandler,
  createMissingSectionHandler,
  isSectionTargetValid,
  useKnownSectionIdsVersion,
} from "./sharedTypes";
import { SnippetBlockChip } from "./SnippetBlockChip";

export type CondicionTipo = "item" | "flag";

export interface CondicionPayload {
  /** Qué tipo de regla evalúa el sistema. */
  tipo: CondicionTipo;
  /** itemId (tipo "item") o flagId (tipo "flag"). */
  clave: string;
  /** Solo para tipo "flag": el valor contra el que se compara. */
  valorEsperado?: string;
  /** Texto de la rama "sí" (tiene el ítem / flag coincide). */
  siTexto: string;
  /** Texto de la rama "no" (no tiene el ítem / flag no coincide). */
  noTexto: string;
  /** Sección destino si la rama "sí" — opcional. */
  siTarget?: string;
  /** Sección destino si la rama "no" — opcional. */
  noTarget?: string;
}

export type SerializedCondicionNode = Spread<
  { type: "condicion-snippet"; version: 1 } & CondicionPayload,
  SerializedLexicalNode
>;

function CondicionChipView({
  payload,
  nodeKey,
  editor,
}: {
  payload: CondicionPayload;
  nodeKey: NodeKey;
  editor: LexicalEditor;
}) {
  useKnownSectionIdsVersion();

  const titulo =
    payload.tipo === "item"
      ? `condición — ítem: ${payload.clave.slice(0, 24)}`
      : `condición — ${payload.clave} = ${payload.valorEsperado || "?"}`;

  const branches = [
    {
      label: "si",
      target: payload.siTarget || undefined,
      targetValid: payload.siTarget ? isSectionTargetValid(payload.siTarget) : undefined,
      detail: payload.siTexto || undefined,
    },
    {
      label: "si no",
      target: payload.noTarget || undefined,
      targetValid: payload.noTarget ? isSectionTargetValid(payload.noTarget) : undefined,
      detail: payload.noTexto || undefined,
    },
  ];

  return (
    <SnippetBlockChip
      icon={<GitBranch size={14} />}
      title={titulo}
      branches={branches}
      onClick={() =>
        snippetEditHandler.current?.({
          kind: "condicion",
          nodeKey,
          payload,
          replace: (next) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isCondicionNode(node)) node.setPayload(next);
            }),
          remove: () =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isCondicionNode(node)) node.remove();
            }),
        })
      }
      onDelete={() =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isCondicionNode(node)) node.remove();
        })
      }
      onCreateMissingSection={(b) => {
        if (b.target) createMissingSectionHandler.current?.(b.target);
      }}
    />
  );
}

export class CondicionNode extends DecoratorNode<React.ReactNode> {
  __payload: CondicionPayload;

  static getType(): string {
    return "condicion-snippet";
  }

  static clone(node: CondicionNode): CondicionNode {
    return new CondicionNode(node.__payload, node.__key);
  }

  constructor(payload: CondicionPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(
    serialized: SerializedLexicalNode & Record<string, unknown>,
  ): CondicionNode {
    const s = serialized as unknown as SerializedCondicionNode;
    return $createCondicionNode({
      tipo: s.tipo,
      clave: s.clave,
      valorEsperado: s.valorEsperado,
      siTexto: s.siTexto,
      noTexto: s.noTexto,
      siTarget: s.siTarget,
      noTarget: s.noTarget,
    });
  }

  exportJSON(): SerializedCondicionNode {
    return { ...this.__payload, type: "condicion-snippet", version: 1 };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  setPayload(next: CondicionPayload): void {
    this.getWritable().__payload = next;
  }

  getPayload(): CondicionPayload {
    return this.__payload;
  }

  getTextContent(): string {
    return `[condicion: ${this.__payload.siTexto.slice(0, 20)}]`;
  }

  isInline(): true {
    return true;
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return (
      <CondicionChipView
        editor={editor}
        nodeKey={this.getKey()}
        payload={this.__payload}
      />
    );
  }
}

export function $createCondicionNode(payload: CondicionPayload): CondicionNode {
  return new CondicionNode(payload);
}

export function $isCondicionNode(
  node: LexicalNode | null | undefined,
): node is CondicionNode {
  return node instanceof CondicionNode;
}

// Misma regex que TARGET_LINE en storyGraph.ts — debe mantenerse idéntica,
// porque el grafo narrativo parsea el mismo formato de sufijo directamente
// desde el markdown crudo, sin pasar por este módulo.
const TARGET_LINE = /(?:^|\n)\s*->\s*([a-z0-9-]+)\s*$/i;

function splitTargetSuffix(branchText: string): {
  text: string;
  target: string | null;
} {
  const m = TARGET_LINE.exec(branchText);
  if (!m) return { text: branchText.trim(), target: null };
  return { text: branchText.slice(0, m.index).trim(), target: m[1].trim() };
}

function parseBranches(contenido: string): {
  si: { text: string; target: string | null };
  no: { text: string; target: string | null };
} {
  const sepIdx = contenido.indexOf("===");
  const siRaw = sepIdx >= 0 ? contenido.slice(0, sepIdx) : contenido;
  const noRaw = sepIdx >= 0 ? contenido.slice(sepIdx + 3) : "";
  return { si: splitTargetSuffix(siRaw), no: splitTargetSuffix(noRaw) };
}

/**
 * Reconoce el formato nuevo [[condicion|tipo|clave|valorEsperado|...===...]]
 * Y, para retrocompatibilidad, los formatos viejos:
 *   - [[gate|itemId|...===...]]
 *   - [[flag|if|flagId|valorEsperado|...===...]]
 * migrándolos automáticamente al payload unificado.
 */
export function condicionRawToPayload(raw: string): CondicionPayload | null {
  // Formato nuevo.
  const nuevo = /^\[\[condicion\|(item|flag)\|([^\|]+)\|([^\|]*)\|([\s\S]*)\]\]$/.exec(
    raw,
  );
  if (nuevo) {
    const tipo = nuevo[1] as CondicionTipo;
    const clave = nuevo[2].trim();
    const valorEsperado = nuevo[3].trim();
    const { si, no } = parseBranches(nuevo[4]);
    return {
      tipo,
      clave,
      valorEsperado: tipo === "flag" ? valorEsperado : undefined,
      siTexto: si.text,
      noTexto: no.text,
      siTarget: si.target ?? undefined,
      noTarget: no.target ?? undefined,
    };
  }

  // Legacy: [[gate|itemId|...===...]]
  const gateLegacy = /^\[\[gate\|([^\|]+)\|([\s\S]*)\]\]$/.exec(raw);
  if (gateLegacy) {
    const clave = gateLegacy[1].trim();
    const { si, no } = parseBranches(gateLegacy[2]);
    return {
      tipo: "item",
      clave,
      siTexto: si.text,
      noTexto: no.text,
      siTarget: si.target ?? undefined,
      noTarget: no.target ?? undefined,
    };
  }

  // Legacy: [[flag|if|flagId|valorEsperado|...===...]]
  const flagIfLegacy = /^\[\[flag\|if\|([^\|]+)\|([^\|]*)\|([\s\S]*)\]\]$/.exec(
    raw,
  );
  if (flagIfLegacy) {
    const clave = flagIfLegacy[1].trim();
    const valorEsperado = flagIfLegacy[2].trim();
    const { si, no } = parseBranches(flagIfLegacy[3]);
    return {
      tipo: "flag",
      clave,
      valorEsperado,
      siTexto: si.text,
      noTexto: no.text,
      siTarget: si.target ?? undefined,
      noTarget: no.target ?? undefined,
    };
  }

  return null;
}

export function condicionPayloadToRaw(p: CondicionPayload): string {
  const siBloque = p.siTarget ? `${p.siTexto}\n-> ${p.siTarget}` : p.siTexto;
  const noBloque = p.noTarget ? `${p.noTexto}\n-> ${p.noTarget}` : p.noTexto;
  const valorEsperado = p.tipo === "flag" ? (p.valorEsperado ?? "") : "";
  return `[[condicion|${p.tipo}|${p.clave}|${valorEsperado}|\n${siBloque}\n===\n${noBloque}\n]]`;
}

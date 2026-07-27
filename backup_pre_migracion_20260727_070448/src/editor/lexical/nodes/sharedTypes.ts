/**
 * sharedTypes.ts
 * ──────────────
 * Tipos y helpers compartidos entre todos los SnippetNode (drop, img, float,
 * sound, choice, use, gate, section). Cada nodo vive en su propio archivo
 * pero todos siguen el mismo contrato:
 *
 *   - $createXNode(payload)        → crea el nodo
 *   - $isXNode(node)                → type guard
 *   - xRawToPayload(raw)            → string "[[x|...]]" → payload
 *   - xPayloadToRaw(payload)        → payload → string "[[x|...]]"
 *
 * Esto permite que el editor principal (RichEditor.tsx) y el serializador
 * (richTextSerializer.ts) traten a todos los tipos de forma genérica.
 */
import React from "react";

export type SnippetKind =
  | "drop"
  | "img"
  | "float"
  | "sound"
  | "choice"
  | "use"
  | "condicion"
  | "flag"
  | "section";

/** Editor handler global: cada nodo decorador llama a esto al hacer click
 *  para abrir el panel de edición correspondiente (SnippetCommandPalette). */
export interface SnippetEditRequest<TPayload> {
  kind: SnippetKind;
  nodeKey: string;
  payload: TPayload;
  replace: (next: TPayload) => void;
  remove: () => void;
}

export type SnippetEditHandler = (req: SnippetEditRequest<any>) => void;

/** Registro global simple — se setea una vez desde RichEditor.tsx.
 *  Lexical DecoratorNode no soporta pasar props por el árbol de nodos,
 *  así que este es el punto de inyección del callback de edición. */
export const snippetEditHandler: { current: SnippetEditHandler | null } = {
  current: null,
};

/**
 * Registro global del set de ids de sección presentes en el documento.
 * Se actualiza desde RichEditor.tsx en cada registerUpdateListener, y lo
 * leen los chips de choice/condicion/use para pintar el punto de estado
 * (destino válido / destino roto) sin tener que recorrer el árbol ellos
 * mismos en cada render.
 */
export const knownSectionIds: { current: Set<string>; listeners: Set<() => void> } = {
  current: new Set(),
  listeners: new Set(),
};

export function setKnownSectionIds(ids: Set<string>): void {
  knownSectionIds.current = ids;
  knownSectionIds.listeners.forEach((fn) => fn());
}

/** true/false si hay info suficiente, undefined si aún no se conoce el grafo. */
export function isSectionTargetValid(id: string | undefined): boolean | undefined {
  if (!id) return undefined;
  if (knownSectionIds.current.size === 0) return undefined;
  return knownSectionIds.current.has(id);
}

/** Registro global: crea una sección faltante con el id dado, al final del documento. */
export const createMissingSectionHandler: { current: ((id: string) => void) | null } = {
  current: null,
};

/** Hook: suscribe un componente a cambios en knownSectionIds (fuerza re-render). */
export function useKnownSectionIdsVersion(): number {
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    const fn = () => setVersion((v) => v + 1);
    knownSectionIds.listeners.add(fn);
    return () => {
      knownSectionIds.listeners.delete(fn);
    };
  }, []);
  return version;
}

/** Parsea las partes de un raw "[[kind|a|b|c]]", sin el kind. */
export function splitSnippetParts(raw: string): string[] {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  const parts = inner.split("|").map((p) => p.trim());
  return parts.slice(1); // descarta parts[0] que es el kind
}

export function getSnippetKind(raw: string): string {
  const inner = raw.startsWith("[[") && raw.endsWith("]]") ? raw.slice(2, -2) : raw;
  return inner.split("|")[0]?.trim() ?? "";
}

/** Regex que detecta cualquier snippet [[kind|...]] (no multilinea, los
 *  condicion multilinea se manejan aparte con extractCondicionBlocks). */
export const SNIPPET_REGEX = /\[\[(\w+)\|[^\]]*\]\]/g;

/** Regex específico para condicion multilinea (y legacy gate/flag|if). */
export const CONDICION_REGEX = /\[\[condicion\|(item|flag)\|([^\|]+)\|([^\|]*)\|([\s\S]+?)\]\]/g;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Estilo base compartido por todos los chips inline (drop, sound, etc). */
export const chipBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "0 6px 0 5px",
  height: 19,
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "var(--font-sans,system-ui)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  userSelect: "none",
  verticalAlign: "middle",
  transition: "background .12s",
};

export function chipColorStyle(hovered: boolean): React.CSSProperties {
  return {
    background: hovered
      ? "color-mix(in srgb, var(--color-primary, var(--primary)) 18%, transparent)"
      : "color-mix(in srgb, var(--color-primary, var(--primary)) 9%, transparent)",
    border:
      "1px solid color-mix(in srgb, var(--color-primary, var(--primary)) 28%, transparent)",
    color: "var(--color-primary, var(--primary))",
  };
}

export const chipDotStyle: React.CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: "50%",
  background: "var(--color-primary, var(--primary))",
  opacity: 0.7,
  flexShrink: 0,
};

export const chipDeleteBtnStyle: React.CSSProperties = {
  marginLeft: 2,
  background: "none",
  border: "none",
  padding: "1px 2px",
  cursor: "pointer",
  color: "inherit",
  opacity: 0.65,
  fontSize: 12,
  lineHeight: 1,
  borderRadius: 3,
};

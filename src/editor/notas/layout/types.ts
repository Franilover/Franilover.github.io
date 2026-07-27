// ─── Modelo de datos: modo maquetación ──────────────────────────────────────
// Una LayoutBox es una caja de texto flotante, libre, que vive en una capa
// superpuesta al documento de texto normal. Se guarda como un array JSON
// aparte del contenido principal del ensayo (campo `layout_boxes` en la
// tabla `ensayos`) — dos cosas independientes que conviven visualmente pero
// no se pisan en el modelo. El texto de fondo (`contenido`) nunca se toca
// desde acá.

export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  /** Markdown crudo — mismo formato que usa RichEditor en el documento principal. */
  content: string;
}

export const LAYOUT_BOX_MIN_WIDTH = 120;
export const LAYOUT_BOX_MIN_HEIGHT = 60;

/** Tamaño/posición por defecto para una caja nueva, con pequeño offset en cascada. */
export function makeDefaultBox(existing: LayoutBox[]): LayoutBox {
  const topZ = existing.reduce((max, b) => Math.max(max, b.zIndex), 0);
  const cascadeOffset = (existing.length % 8) * 18;
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `box-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x: 40 + cascadeOffset,
    y: 40 + cascadeOffset,
    width: 280,
    height: 160,
    zIndex: topZ + 1,
    content: "",
  };
}

/**
 * Parsea el campo crudo `layout_boxes` que viene de la fila del ensayo.
 * Puede llegar como array ya parseado (jsonb de Supabase normalmente lo
 * entrega así), como string JSON, null, o undefined (ensayos viejos sin el
 * campo todavía). Nunca tira — ante cualquier duda devuelve [].
 */
export function parseLayoutBoxes(raw: unknown): LayoutBox[] {
  if (!raw) return [];
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(
    (b): b is LayoutBox =>
      b &&
      typeof b === "object" &&
      typeof b.id === "string" &&
      typeof b.x === "number" &&
      typeof b.y === "number" &&
      typeof b.width === "number" &&
      typeof b.height === "number" &&
      typeof b.zIndex === "number" &&
      typeof b.content === "string",
  );
}

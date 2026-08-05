// ─── Modelo de datos: sub-bloques del editor ────────────────────────────────
// Un SubBloque es un documento de texto independiente dentro del mismo
// ensayo — cada uno con su propio markdown crudo, editado por el MISMO
// RichEditor (no un editor aparte). El dropdown superior (SubBloqueSelector)
// elige cuál está activo; cuando hay uno activo, RichEditor muestra/edita
// SU contenido en vez del `contenido` principal del ensayo.
//
// Pensado para casos como "ensayo sobre comidas" con recetas favoritas:
// cada receta es un SubBloque con su propio texto, creado libremente por
// el usuario (sin plantilla ni tipo fijo — ver decisión de diseño).
//
// Se guarda como un array JSON aparte del contenido principal (campo
// `sub_bloques` en la tabla `ensayos`, igual que `layout_boxes`) — misma
// idea de "cosas independientes que conviven pero no se pisan en el modelo".

export interface SubBloque {
  id: string;
  nombre: string;
  /** Markdown crudo — mismo formato que usa RichEditor en el documento principal. */
  contenido: string;
  createdAt: number;
}

/** Sub-bloque nuevo, vacío, con nombre por defecto en base a los existentes. */
export function makeSubBloque(existing: SubBloque[], nombre?: string): SubBloque {
  const base = nombre?.trim() || `Bloque ${existing.length + 1}`;
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `bloque-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nombre: base,
    contenido: "",
    createdAt: Date.now(),
  };
}

/**
 * Parsea el campo crudo `sub_bloques` que viene de la fila del ensayo.
 * Puede llegar como array ya parseado (jsonb de Supabase normalmente lo
 * entrega así), como string JSON, null, o undefined (ensayos viejos sin el
 * campo todavía). Nunca tira — ante cualquier duda devuelve [].
 */
export function parseSubBloques(raw: unknown): SubBloque[] {
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
    (b): b is SubBloque =>
      b &&
      typeof b === "object" &&
      typeof b.id === "string" &&
      typeof b.nombre === "string" &&
      typeof b.contenido === "string" &&
      typeof b.createdAt === "number",
  );
}

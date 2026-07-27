/**
 * Convierte un título de libro en un slug amigable para URLs y SEO.
 * Ej: "El Señor de los Anillos" → "el-senor-de-los-anillos"
 *
 * Coloca este archivo en: src/lib/utils/slugify.ts
 */
export function toSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")                        // descompone acentos: á → a + ́
    .replace(/[\u0300-\u036f]/g, "")         // elimina las marcas diacríticas
    .replace(/[^a-z0-9\s-]/g, "")           // borra todo lo que no sea letra/número/espacio/guion
    .trim()
    .replace(/\s+/g, "-")                    // espacios → guiones
    .replace(/-+/g, "-");                    // guiones múltiples → uno solo
}

/**
 * Devuelve true si el string tiene pinta de UUID v4 (el id de Supabase).
 * Útil para distinguir slugs de ids en la URL y dar compatibilidad hacia atrás.
 */
export function esUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

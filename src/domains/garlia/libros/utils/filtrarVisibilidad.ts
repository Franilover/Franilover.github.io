// ─────────────────────────────────────────────────────────────────────────────
// filtrarVisibilidad.ts
// ─────────────────────────────────────────────────────────────────────────────
// Filtro de seguridad ÚNICO para decidir si un capítulo debe mostrarse al
// lector público, sin importar de dónde venga el dato (Supabase fresco,
// caché Dexie, o el editor). Antes esta misma lógica estaba copiada en tres
// lugares distintos de leerLibro.tsx (aplicarCaps, el catch de fallback, y
// el render instantáneo desde Dexie) — cualquier cambio a las reglas de
// visibilidad requería tocar los tres y era fácil olvidar uno (fue,
// literalmente, la causa del bug donde capítulos ocultos se veían un
// instante al recargar la página).
//
// Reglas:
//   - "oculto"                         → nunca se muestra
//   - "publico"                        → siempre se muestra
//   - "programado" con fecha ≤ ahora   → se muestra (ya "salió")
//   - "programado" con fecha > ahora   → no se muestra todavía
//   - cualquier otro valor / ausente   → se trata como "publico" (fallback
//     para filas viejas cacheadas en Dexie antes de que existiera el campo)

export interface CapConVisibilidad {
  visibilidad?: string | null;
  fecha_publicacion?: string | null;
  deleted?: boolean;
}

export function esCapituloVisible(
  cap: CapConVisibilidad,
  ahora: Date = new Date(),
): boolean {
  if (cap.deleted) return false;
  const vis = cap.visibilidad ?? "publico";
  if (vis === "oculto") return false;
  if (vis === "publico") return true;
  if (vis === "programado") {
    if (!cap.fecha_publicacion) return false;
    return new Date(cap.fecha_publicacion) <= ahora;
  }
  return false; // valor desconocido → ocultar por seguridad
}

export function filtrarCapitulosVisibles<T extends CapConVisibilidad>(
  caps: T[],
): T[] {
  const ahora = new Date();
  return caps.filter((c) => esCapituloVisible(c, ahora));
}

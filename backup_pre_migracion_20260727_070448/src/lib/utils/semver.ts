/**
 * semver.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Comparación mínima de versiones "x.y.z" (sin soporte de -alpha/-beta ni
 * rangos — no lo necesitamos para esto). Suficiente para decidir si la
 * versión publicada en `app_version` es más nueva que la que trae el APK.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Devuelve true si `remota` es estrictamente mayor que `actual`.
 * Tolerante a formatos raros (ej "1.2" o "v1.2.3"): rellena con 0 y
 * ignora un prefijo "v" inicial.
 */
export function esVersionMasNueva(actual: string, remota: string): boolean {
  const a = parseVersion(actual);
  const b = parseVersion(remota);

  for (let i = 0; i < 3; i++) {
    if (b[i] > a[i]) return true;
    if (b[i] < a[i]) return false;
  }
  return false; // iguales
}

function parseVersion(v: string): [number, number, number] {
  const limpio = v.trim().replace(/^v/i, "");
  const partes = limpio.split(".").map((p) => parseInt(p, 10) || 0);
  return [partes[0] ?? 0, partes[1] ?? 0, partes[2] ?? 0];
}

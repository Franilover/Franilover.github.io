/**
 * updaterEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ya NO sube el .apk a Supabase Storage (el plan Free tiene un límite global
 * de 50MB por archivo, y el APK universal de Tauri/Android pesa ~75MB — ver
 * https://supabase.com/docs/guides/storage/uploads/file-limits).
 *
 * En cambio, el .apk se sube a mano a un GitHub Release:
 *
 *   1. Generar el build: src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
 *   2. gh release create vX.Y.Z ./app-universal-release.apk --title "vX.Y.Z"
 *      (o subir el asset a un release existente desde la web de GitHub)
 *   3. Copiar la URL pública del asset (termina en .apk) y pegarla acá.
 *
 * Esta función solo valida esa URL y actualiza la fila `app_version` — la
 * escritura sigue restringida por RLS a rol admin (ver migración
 * 20260722_app_version.sql).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "@/infra/supabase/supabase";

export interface VersionActual {
  version: string;
  url: string;
  notas: string | null;
  updated_at: string;
}

export async function obtenerVersionActual(): Promise<VersionActual | null> {
  const { data, error } = await supabase
    .from("app_version")
    .select("version, url, notas, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data as VersionActual | null;
}

export async function publicarNuevaVersion(params: {
  url: string;
  version: string;
  notas: string;
}): Promise<VersionActual> {
  const { url, version, notas } = params;

  const urlLimpia = url.trim();

  if (!/^https:\/\/github\.com\/.+\/releases\/download\/.+\.apk$/.test(urlLimpia)) {
    throw new Error(
      "La URL debe ser un asset de GitHub Releases y terminar en .apk (ej. https://github.com/usuario/repo/releases/download/v0.2.0/app-universal-release.apk)"
    );
  }
  if (!/^\d+\.\d+\.\d+$/.test(version.trim())) {
    throw new Error("La versión debe tener formato semver, ej. 0.2.0");
  }

  const { data, error: errUpdate } = await supabase
    .from("app_version")
    .update({
      version: version.trim(),
      url: urlLimpia,
      notas: notas.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select("version, url, notas, updated_at")
    .single();

  if (errUpdate) throw errUpdate;

  return data as VersionActual;
}

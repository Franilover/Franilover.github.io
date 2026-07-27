"use client";

/**
 * ActualizacionDisponible.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Se monta una sola vez en el layout raíz, análogo a <PushActivator />. Solo
 * hace algo si la app corre dentro de Tauri (window.__TAURI__) — en el
 * navegador normal no renderiza nada, así nadie ve este banner en la web.
 *
 * Flujo:
 *  1. Al montar, chequea la fila `app_version` en Supabase.
 *  2. Si `version` ahí es mayor que la del APK actual (tauri.conf.json,
 *     inyectada por Tauri como parte del contexto de la app), muestra un
 *     banner flotante.
 *  3. Al tocar "Actualizar": descarga el .apk con tauri-plugin-http,
 *     lo guarda en el directorio de datos de la app con tauri-plugin-fs,
 *     y llama al plugin nativo `android-installer` para abrir la pantalla
 *     de instalación de Android. El usuario igual tiene que tocar
 *     "Instalar" ahí — Android no permite auto-reemplazo silencioso.
 *
 * IMPORTANTE: la versión "actual" para comparar viene de
 * `getVersion()` de @tauri-apps/api/app, que lee justamente
 * src-tauri/tauri.conf.json → version. Si generás un APK nuevo, subilo a
 * Storage y actualizá la fila `app_version` con esa misma versión.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { esVersionMasNueva } from "@/lib/utils/semver";

type EstadoDescarga = "idle" | "descargando" | "instalando" | "error";

interface FilaVersion {
  version: string;
  url: string;
  notas: string | null;
}

function estaEnTauri(): boolean {
  // `window.__TAURI__` solo existe si `app.withGlobalTauri: true` está
  // seteado en tauri.conf.json — no es nuestro caso. `__TAURI_INTERNALS__`
  // sí está siempre presente en Tauri v2 (lo usa @tauri-apps/api para IPC).
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export function ActualizacionDisponible() {
  const [remota, setRemota] = useState<FilaVersion | null>(null);
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState<EstadoDescarga>("idle");
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!estaEnTauri()) return;

    let cancelado = false;

    (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const versionActual = await getVersion();

        const { data, error: errSupabase } = await supabase
          .from("app_version")
          .select("version, url, notas")
          .eq("id", 1)
          .maybeSingle();

        if (cancelado || errSupabase || !data || !data.url) return;

        if (esVersionMasNueva(versionActual, data.version)) {
          setRemota(data as FilaVersion);
          setVisible(true);
        }
      } catch (e) {
        // Chequeo de actualización falló (sin red, tabla vacía, etc.) —
        // no es crítico, la app sigue funcionando normal.
        console.warn("No se pudo chequear actualizaciones:", e);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  async function manejarActualizar() {
    if (!remota) return;
    setError(null);

    try {
      setEstado("descargando");
      setProgreso(0);

      const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
      const { BaseDirectory, mkdir, writeFile } = await import(
        "@tauri-apps/plugin-fs"
      );

      const respuesta = await tauriFetch(remota.url, { method: "GET" });
      if (!respuesta.ok) {
        throw new Error(`Descarga falló (HTTP ${respuesta.status})`);
      }

      const buffer = new Uint8Array(await respuesta.arrayBuffer());

      const nombreArchivo = `garlia-${remota.version}.apk`;
      const rutaRelativa = `updates/${nombreArchivo}`;

      await mkdir("updates", {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });
      await writeFile(rutaRelativa, buffer, { baseDir: BaseDirectory.AppData });

      // Necesitamos la ruta absoluta en disco para pasársela al plugin nativo
      // (FileProvider trabaja con java.io.File, no con el sistema de baseDir de Tauri).
      const { appDataDir, join } = await import("@tauri-apps/api/path");
      const dirDatos = await appDataDir();
      const rutaAbsoluta = await join(dirDatos, rutaRelativa);

      setEstado("instalando");

      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("plugin:android-installer|install_apk", {
        path: rutaAbsoluta,
      });

      // Si llegamos acá, se abrió la pantalla nativa de instalación.
      // No hay forma de saber si el usuario terminó de instalar desde JS,
      // así que simplemente cerramos el banner.
      setVisible(false);
      setEstado("idle");
    } catch (e) {
      console.error("Error actualizando la app:", e);
      setEstado("error");
      setError(
        e instanceof Error ? e.message : "Error desconocido actualizando."
      );
    }
  }

  if (!visible || !remota) return null;

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="w-[min(92vw,420px)] rounded-xl border border-primary/30 bg-bg-main p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg-main">
              Hay una actualización disponible
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">
              Versión {remota.version}
              {remota.notas ? ` — ${remota.notas}` : ""}
            </p>
            {estado === "error" && error && (
              <p className="mt-1 text-xs text-red-500">{error}</p>
            )}
          </div>

          {estado === "idle" || estado === "error" ? (
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="shrink-0 text-fg-muted hover:text-fg-main"
              aria-label="Cerrar"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={manejarActualizar}
            disabled={estado === "descargando" || estado === "instalando"}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {estado === "descargando" && "Descargando…"}
            {estado === "instalando" && "Abriendo instalador…"}
            {(estado === "idle" || estado === "error") &&
              (estado === "error" ? "Reintentar" : "Actualizar")}
          </button>

          {(estado === "idle" || estado === "error") && (
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="rounded-lg border border-fg-muted/30 px-3 py-2 text-sm text-fg-muted"
            >
              Después
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

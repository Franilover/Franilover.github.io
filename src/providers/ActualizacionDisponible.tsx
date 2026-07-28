"use client";

/**
 * ActualizacionDisponible.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Se monta una sola vez en el layout raíz, análogo a <PushActivator />. Solo
 * hace algo si la app corre dentro de Tauri (window.__TAURI__) — en el
 * navegador normal no renderiza nada, así nadie ve este banner en la web.
 *
 * Flujo:
 *  1. Al montar, consulta el último release publicado en GitHub:
 *     GET https://api.github.com/repos/Franilover/Garlia/releases/latest
 *     El release ES la fuente de verdad — no hay que tocar Supabase ni
 *     ninguna tabla a mano en cada versión. Alcanza con que el tag
 *     (ej. "v0.4.27") sea mayor a la versión actual del binario.
 *  2. Si hay una versión más nueva, busca en release.assets el archivo que
 *     corresponde a la plataforma actual (.apk en Android, .AppImage en
 *     Linux) y muestra el banner.
 *  3. Al tocar "Actualizar":
 *     - Android: descarga el .apk con tauri-plugin-http, lo guarda con
 *       tauri-plugin-fs, y llama al plugin nativo `android-installer` para
 *       abrir la pantalla de instalación. El usuario igual tiene que tocar
 *       "Instalar" ahí — Android no permite auto-reemplazo silencioso.
 *     - Linux: simplemente abre la URL de descarga del asset con el plugin
 *       `opener` (navegador/gestor de descargas del sistema). No hay un
 *       instalador único en Linux, así que no tiene sentido automatizar más
 *       que eso — el usuario reemplaza el AppImage viejo a mano.
 *
 * La versión "actual" para comparar viene de `getVersion()` de
 * @tauri-apps/api/app, que lee justamente src-tauri/tauri.conf.json →
 * version. Cada release nuevo (git tag vX.Y.Z) ya sube los assets solo —
 * no hace falta ningún paso manual extra para que este chequeo funcione.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";

import { esVersionMasNueva } from "@/lib/utils/semver";

const GITHUB_REPO = "Franilover/Garlia";
const GITHUB_RELEASES_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

type EstadoDescarga = "idle" | "descargando" | "instalando" | "error";
type Plataforma = "android" | "linux" | "otra";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  assets: GitHubAsset[];
}

interface VersionDisponible {
  version: string;
  notas: string | null;
  url: string;
  nombreArchivo: string;
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

/** Busca en los assets del release el archivo que corresponde a esta plataforma. */
function elegirAsset(
  assets: GitHubAsset[],
  plataforma: Plataforma
): GitHubAsset | null {
  if (plataforma === "android") {
    return assets.find((a) => a.name.toLowerCase().endsWith(".apk")) ?? null;
  }
  if (plataforma === "linux") {
    // Preferimos el AppImage (no requiere instalación) sobre el .deb.
    return (
      assets.find((a) => a.name.toLowerCase().endsWith(".appimage")) ??
      assets.find((a) => a.name.toLowerCase().endsWith(".deb")) ??
      null
    );
  }
  return null;
}

export function ActualizacionDisponible() {
  const [remota, setRemota] = useState<VersionDisponible | null>(null);
  const [plataforma, setPlataforma] = useState<Plataforma>("otra");
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState<EstadoDescarga>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!estaEnTauri()) return;

    let cancelado = false;

    (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const { platform } = await import("@tauri-apps/plugin-os");

        const versionActual = await getVersion();
        const plataformaActual = platform(); // "android" | "linux" | "windows" | "macos" | "ios"
        const plataformaNormalizada: Plataforma =
          plataformaActual === "android" || plataformaActual === "linux"
            ? plataformaActual
            : "otra";

        if (cancelado) return;
        setPlataforma(plataformaNormalizada);

        // En plataformas que todavía no tienen build propio (windows/macos/ios)
        // no tiene sentido chequear — no habría asset para ofrecer.
        if (plataformaNormalizada === "otra") return;

        const respuesta = await fetch(GITHUB_RELEASES_LATEST_URL, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!respuesta.ok) return;

        const release: GitHubRelease = await respuesta.json();
        if (cancelado || !release?.tag_name) return;

        if (!esVersionMasNueva(versionActual, release.tag_name)) return;

        const asset = elegirAsset(release.assets ?? [], plataformaNormalizada);
        if (!asset) return; // el release no trajo build para esta plataforma

        setRemota({
          version: release.tag_name,
          notas: release.name ?? release.body ?? null,
          url: asset.browser_download_url,
          nombreArchivo: asset.name,
        });
        setVisible(true);
      } catch (e) {
        // Chequeo de actualización falló (sin red, API caída, etc.) — no
        // es crítico, la app sigue funcionando normal.
        console.warn("No se pudo chequear actualizaciones:", e);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  async function manejarActualizarAndroid() {
    if (!remota) return;

    setEstado("descargando");

    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    const { BaseDirectory, mkdir, writeFile } = await import(
      "@tauri-apps/plugin-fs"
    );

    const respuesta = await tauriFetch(remota.url, { method: "GET" });
    if (!respuesta.ok) {
      throw new Error(`Descarga falló (HTTP ${respuesta.status})`);
    }

    const buffer = new Uint8Array(await respuesta.arrayBuffer());
    const rutaRelativa = `updates/${remota.nombreArchivo}`;

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
  }

  async function manejarActualizarLinux() {
    if (!remota) return;

    setEstado("descargando");

    // En Linux no existe un instalador único de paquetes de terceros —
    // simplemente abrimos la URL de descarga con el manejador por defecto
    // del sistema (navegador o gestor de descargas). El usuario reemplaza
    // el AppImage viejo a mano.
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(remota.url);

    setVisible(false);
    setEstado("idle");
  }

  async function manejarActualizar() {
    if (!remota) return;
    setError(null);

    try {
      if (plataforma === "android") {
        await manejarActualizarAndroid();
      } else if (plataforma === "linux") {
        await manejarActualizarLinux();
      }
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

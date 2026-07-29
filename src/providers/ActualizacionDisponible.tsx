"use client";

/**
 * ActualizacionDisponible.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Se monta una sola vez en el layout raíz, antes de <Navbar />. Solo hace
 * algo si la app corre dentro de Tauri — en el navegador normal no
 * renderiza nada.
 *
 * Flujo:
 *  1. Al montar, consulta el último release publicado en GitHub:
 *     GET https://api.github.com/repos/Franilover/Garlia/releases/latest
 *     El release ES la fuente de verdad — no hay que tocar Supabase ni
 *     ninguna tabla a mano. El workflow de CI ya sincroniza `version` en
 *     tauri.conf.json con el tag en cada build, así que getVersion() en
 *     runtime siempre refleja la versión real instalada.
 *  2. Si hay una versión más nueva, busca en release.assets el archivo que
 *     corresponde a la plataforma actual (.apk en Android, .AppImage en
 *     Linux) y muestra un pill chiquito flotante ofreciendo actualizar.
 *  3. Al tocar "Actualizar":
 *     - Android: descarga el .apk LEYENDO EL STREAM de a chunks (para poder
 *       calcular % real contra el header Content-Length), guarda el archivo
 *       con tauri-plugin-fs, y llama al plugin nativo `android-installer`
 *       para abrir la pantalla de instalación. Durante todo esto, el
 *       usuario puede seguir usando la app con normalidad: la descarga NO
 *       bloquea nada — se ve como una barra fina de progreso pegada arriba
 *       de la navbar (z-index por encima de todo lo demás), no un modal.
 *     - Linux: abre la URL de descarga con el plugin `opener` (navegador o
 *       gestor de descargas del sistema) — no hay un instalador único en
 *       Linux, así que no tiene sentido tratar de automatizar más.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";

import { esVersionMasNueva } from "@/lib/utils/semver";

const GITHUB_REPO = "Franilover/Garlia";
const GITHUB_RELEASES_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

type Estado =
  | "idle" // hay una versión nueva, todavía no se tocó "Actualizar"
  | "descargando" // bajando el archivo, con progreso 0-100
  | "instalando" // (solo Android) esperando a que se abra el instalador nativo
  | "lista" // (Linux) ya se abrió el link de descarga
  | "error";

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
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

function elegirAsset(
  assets: GitHubAsset[],
  plataforma: Plataforma
): GitHubAsset | null {
  if (plataforma === "android") {
    return assets.find((a) => a.name.toLowerCase().endsWith(".apk")) ?? null;
  }
  if (plataforma === "linux") {
    return (
      assets.find((a) => a.name.toLowerCase().endsWith(".appimage")) ??
      assets.find((a) => a.name.toLowerCase().endsWith(".deb")) ??
      null
    );
  }
  return null;
}

/**
 * Descarga `url` leyendo el body como stream, reportando progreso 0-100 vía
 * `onProgress` a medida que van llegando chunks. Devuelve el archivo
 * completo como Uint8Array al terminar.
 *
 * Usamos `tauriFetch` (de @tauri-apps/plugin-http) en vez del fetch nativo
 * del WebView porque necesitamos evitar CORS/CSP en Android, pero su
 * Response implementa el mismo ReadableStream estándar así que el patrón
 * de lectura por chunks funciona igual.
 */
async function descargarConProgreso(
  url: string,
  onProgress: (porcentaje: number) => void
): Promise<Uint8Array> {
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");

  const respuesta = await tauriFetch(url, { method: "GET" });
  if (!respuesta.ok) {
    throw new Error(`Descarga falló (HTTP ${respuesta.status})`);
  }

  const totalHeader = respuesta.headers.get("content-length");
  const total = totalHeader ? parseInt(totalHeader, 10) : 0;

  if (!respuesta.body) {
    // Algún entorno sin soporte de streaming — fallback sin progreso real,
    // igual funciona, solo no anima el %.
    const buffer = new Uint8Array(await respuesta.arrayBuffer());
    onProgress(100);
    return buffer;
  }

  const lector = respuesta.body.getReader();
  const chunks: Uint8Array[] = [];
  let recibido = 0;

  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      recibido += value.length;
      if (total > 0) {
        onProgress(Math.min(99, Math.round((recibido / total) * 100)));
      }
    }
  }

  onProgress(100);

  const resultado = new Uint8Array(recibido);
  let offset = 0;
  for (const chunk of chunks) {
    resultado.set(chunk, offset);
    offset += chunk.length;
  }
  return resultado;
}

export function ActualizacionDisponible() {
  const [remota, setRemota] = useState<VersionDisponible | null>(null);
  const [plataforma, setPlataforma] = useState<Plataforma>("otra");
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!estaEnTauri()) return;

    let cancelado = false;

    (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const { platform } = await import("@tauri-apps/plugin-os");

        const versionActual = await getVersion();
        const plataformaActual = platform();
        const plataformaNormalizada: Plataforma =
          plataformaActual === "android" || plataformaActual === "linux"
            ? plataformaActual
            : "otra";

        if (cancelado) return;
        setPlataforma(plataformaNormalizada);

        if (plataformaNormalizada === "otra") return;

        const respuesta = await fetch(GITHUB_RELEASES_LATEST_URL, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!respuesta.ok) return;

        const release: GitHubRelease = await respuesta.json();
        if (cancelado || !release?.tag_name) return;

        if (!esVersionMasNueva(versionActual, release.tag_name)) return;

        const asset = elegirAsset(release.assets ?? [], plataformaNormalizada);
        if (!asset) return;

        setRemota({
          version: release.tag_name,
          notas: release.name ?? release.body ?? null,
          url: asset.browser_download_url,
          nombreArchivo: asset.name,
        });
        setVisible(true);
      } catch (e) {
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
    setProgreso(0);

    const buffer = await descargarConProgreso(remota.url, setProgreso);

    const { BaseDirectory, mkdir, writeFile } = await import(
      "@tauri-apps/plugin-fs"
    );
    const rutaRelativa = `updates/${remota.nombreArchivo}`;

    await mkdir("updates", {
      baseDir: BaseDirectory.AppData,
      recursive: true,
    });
    await writeFile(rutaRelativa, buffer, { baseDir: BaseDirectory.AppData });

    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const dirDatos = await appDataDir();
    const rutaAbsoluta = await join(dirDatos, rutaRelativa);

    setEstado("instalando");

    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("plugin:android-installer|install_apk", {
      path: rutaAbsoluta,
    });

    // Se abrió la pantalla nativa de instalación — no hay forma de saber
    // desde JS si el usuario efectivamente instaló, así que cerramos el
    // pill. La próxima vez que abra la app, si sigue en la versión vieja,
    // se le va a volver a ofrecer.
    setVisible(false);
    setEstado("idle");
  }

  async function manejarActualizarLinux() {
    if (!remota) return;

    setEstado("descargando");

    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(remota.url);

    setEstado("lista");
    // En Linux no hay "instalación" que esperar — el navegador/gestor de
    // descargas se hace cargo. Dejamos el pill un momento en estado "lista"
    // y lo cerramos solo.
    setTimeout(() => setVisible(false), 2500);
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

  const enProgreso = estado === "descargando" || estado === "instalando";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 top-0 z-[3000] flex justify-center px-2 pt-2 md:left-[68px] md:px-3"
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border border-primary/30 bg-bg-main/95 shadow-lg backdrop-blur">
        {/* Barra de progreso fina, siempre visible mientras descarga/instala */}
        {enProgreso && (
          <div className="h-1 w-full bg-primary/15">
            <div
              className="h-full bg-primary transition-[width] duration-200 ease-out"
              style={{
                width:
                  estado === "instalando" ? "100%" : `${progreso}%`,
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            {estado === "idle" && (
              <p className="truncate text-xs font-medium text-fg-main">
                Nueva versión disponible: {remota.version}
              </p>
            )}
            {estado === "descargando" && (
              <p className="truncate text-xs text-fg-muted">
                Descargando actualización… {progreso}%
              </p>
            )}
            {estado === "instalando" && (
              <p className="truncate text-xs text-fg-muted">
                Abriendo instalador…
              </p>
            )}
            {estado === "lista" && (
              <p className="truncate text-xs text-fg-muted">
                Descarga abierta en el navegador
              </p>
            )}
            {estado === "error" && (
              <p className="truncate text-xs text-red-500">
                {error ?? "Error actualizando"}
              </p>
            )}
          </div>

          {(estado === "idle" || estado === "error") && (
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={manejarActualizar}
                className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white"
              >
                {estado === "error" ? "Reintentar" : "Actualizar"}
              </button>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:text-fg-main"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
 *     - Android: encola la descarga en el DownloadManager NATIVO del
 *       sistema (plugin `android-installer|start_download`) y pollea su
 *       progreso cada 800ms (`query_download`). A diferencia de leer el
 *       stream a mano desde JS, DownloadManager corre en un servicio del
 *       propio Android — sigue bajando el archivo aunque el usuario
 *       minimice la app, apague la pantalla, o el WebView se suspenda.
 *       El downloadId se guarda en localStorage para poder retomar el
 *       polling si el usuario vuelve a abrir la app (incluso después de
 *       que el proceso haya sido matado del todo). Al terminar, llama al
 *       plugin nativo para abrir la pantalla de instalación.
 *     - Linux: abre la URL de descarga con el plugin `opener` (navegador o
 *       gestor de descargas del sistema) — no hay un instalador único en
 *       Linux, así que no tiene sentido tratar de automatizar más.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from "react";

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

const LS_KEY_DESCARGA = "garlia:actualizacion-descarga-en-curso";

interface DescargaPersistida {
  downloadId: number;
  version: string;
}

interface EstadoDescargaNativo {
  status: "pending" | "running" | "paused" | "successful" | "failed" | "unknown";
  bytesDownloaded: number;
  bytesTotal: number;
  localUri: string | null;
  reason: number;
}

function guardarDescargaPendiente(d: DescargaPersistida | null) {
  try {
    if (d) localStorage.setItem(LS_KEY_DESCARGA, JSON.stringify(d));
    else localStorage.removeItem(LS_KEY_DESCARGA);
  } catch {
    // localStorage puede no estar disponible en algún contexto raro — no
    // es crítico, en el peor caso no se retoma el polling tras un reinicio.
  }
}

function leerDescargaPendiente(): DescargaPersistida | null {
  try {
    const raw = localStorage.getItem(LS_KEY_DESCARGA);
    return raw ? (JSON.parse(raw) as DescargaPersistida) : null;
  } catch {
    return null;
  }
}

/**
 * Pollea `query_download` cada `intervaloMs` hasta que la descarga termine
 * (bien o mal) o se llame a `cancelar()`. Devuelve una función para cancelar
 * el polling desde afuera (ej. si el componente se desmonta).
 */
function pollearDescarga(
  downloadId: number,
  onProgreso: (porcentaje: number) => void,
  onTerminada: (resultado: EstadoDescargaNativo) => void,
  onError: (mensaje: string) => void,
  intervaloMs = 800
): () => void {
  let detenido = false;

  (async () => {
    const { invoke } = await import("@tauri-apps/api/core");

    while (!detenido) {
      try {
        const estado = await invoke<EstadoDescargaNativo>(
          "plugin:android-installer|query_download",
          { downloadId }
        );

        if (estado.bytesTotal > 0) {
          onProgreso(
            Math.min(
              99,
              Math.round((estado.bytesDownloaded / estado.bytesTotal) * 100)
            )
          );
        }

        if (estado.status === "successful" || estado.status === "failed") {
          onTerminada(estado);
          return;
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error consultando la descarga.");
        return;
      }

      await new Promise((r) => setTimeout(r, intervaloMs));
    }
  })();

  return () => {
    detenido = true;
  };
}

export function ActualizacionDisponible() {
  const [remota, setRemota] = useState<VersionDisponible | null>(null);
  const [plataforma, setPlataforma] = useState<Plataforma>("otra");
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const detenerPollingRef = useRef<(() => void) | null>(null);

  async function finalizarInstalacion(localUri: string) {
    const { invoke } = await import("@tauri-apps/api/core");
    // DownloadManager devuelve el localUri como "file:///..." — el plugin
    // de instalación espera un path de filesystem plano.
    const path = localUri.startsWith("file://")
      ? decodeURIComponent(localUri.slice("file://".length))
      : localUri;

    setEstado("instalando");
    // Limpiamos la key ANTES de invocar install_apk, no después. El Intent
    // nativo de instalación se lleva puesta la Activity de Android; si el
    // WebView se pausa o se mata en ese momento (algo común, porque Android
    // abre esa pantalla como una Activity nueva encima), el `await` de acá
    // puede no resolver nunca. Si dejábamos el guardarDescargaPendiente(null)
    // después del invoke, la key quedaba viva para siempre y la app volvía
    // a ofrecer instalar el mismo APK cada vez que se abría, en loop.
    guardarDescargaPendiente(null);
    await invoke("plugin:android-installer|install_apk", { path });

    setVisible(false);
    setEstado("idle");
  }

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

  // Si había una descarga en curso cuando se cerró la app (o se mató el
  // proceso), la retomamos: DownloadManager la siguió bajando nativamente
  // mientras tanto, así que solo hace falta volver a pollear su estado.
  useEffect(() => {
    if (!estaEnTauri()) return;

    const pendiente = leerDescargaPendiente();
    if (!pendiente) return;

    let cancelado = false;

    (async () => {
      // Red de seguridad clave: si la versión ya instalada coincide con (o
      // superó a) la que quedó pendiente en localStorage, esa entrada es
      // basura de una instalación anterior que no se limpió (por ejemplo
      // porque el Intent de install_apk mató el WebView antes de que
      // guardarDescargaPendiente(null) llegara a correr). No tiene sentido
      // reofrecer instalar una versión que ya tenemos — la limpiamos y no
      // mostramos nada. Sin este chequeo, el panel nativo de instalación
      // vuelve a aparecer en cada apertura de la app, para siempre.
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const versionActual = await getVersion();
        if (cancelado) return;

        if (!esVersionMasNueva(versionActual, pendiente.version)) {
          guardarDescargaPendiente(null);
          return;
        }
      } catch {
        // Si no pudimos leer la versión actual, seguimos con el flujo
        // normal de retomar la descarga en vez de bloquear todo.
      }

      if (cancelado) return;

      setPlataforma("android");
      setEstado("descargando");
      setProgreso(0);
      setVisible(true);
      setRemota((actual) =>
        actual ?? {
          version: pendiente.version,
          notas: null,
          url: "",
          nombreArchivo: "",
        }
      );

      detenerPollingRef.current = pollearDescarga(
        pendiente.downloadId,
        setProgreso,
        async (resultado) => {
          if (resultado.status === "failed" || !resultado.localUri) {
            guardarDescargaPendiente(null);
            setEstado("error");
            setError(
              resultado.status === "failed"
                ? `La descarga falló (código ${resultado.reason}).`
                : "La descarga terminó pero no se encontró el archivo."
            );
            return;
          }
          try {
            await finalizarInstalacion(resultado.localUri);
          } catch (e) {
            setEstado("error");
            setError(
              e instanceof Error ? e.message : "Error abriendo el instalador."
            );
          }
        },
        (mensaje) => {
          setEstado("error");
          setError(mensaje);
        }
      );
    })();

    return () => {
      cancelado = true;
      detenerPollingRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function manejarActualizarAndroid() {
    if (!remota) return;

    setEstado("descargando");
    setProgreso(0);

    const { invoke } = await import("@tauri-apps/api/core");
    const downloadId = await invoke<number>(
      "plugin:android-installer|start_download",
      { url: remota.url, fileName: remota.nombreArchivo }
    );

    // Se guarda ANTES de esperar el resultado — si el usuario cierra la
    // app en el medio, al reabrirla el efecto de más abajo retoma el
    // polling con este mismo id. La descarga en sí sigue corriendo en el
    // DownloadManager del sistema, no depende de que JS esté vivo.
    guardarDescargaPendiente({ downloadId, version: remota.version });

    detenerPollingRef.current = pollearDescarga(
      downloadId,
      setProgreso,
      async (resultado) => {
        if (resultado.status === "failed") {
          guardarDescargaPendiente(null);
          setEstado("error");
          setError(`La descarga falló (código ${resultado.reason}).`);
          return;
        }
        if (!resultado.localUri) {
          guardarDescargaPendiente(null);
          setEstado("error");
          setError("La descarga terminó pero no se encontró el archivo.");
          return;
        }
        try {
          await finalizarInstalacion(resultado.localUri);
        } catch (e) {
          setEstado("error");
          setError(
            e instanceof Error ? e.message : "Error abriendo el instalador."
          );
        }
      },
      (mensaje) => {
        setEstado("error");
        setError(mensaje);
      }
    );
  }

  useEffect(() => {
    return () => {
      detenerPollingRef.current?.();
    };
  }, []);

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

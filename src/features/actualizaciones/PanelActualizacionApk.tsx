"use client";

/**
 * PanelActualizacionApk
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de admin en /myself/actualizaciones. Ya no sube el .apk a Storage
 * (plan Free de Supabase limita a 50MB por archivo y el APK universal pesa
 * ~75MB). En cambio: subís el .apk a mano a un GitHub Release, y acá elegís
 * cuál publicar desde un selector (mismo patrón que SelectorImagen /
 * SimpleImagePicker) — con eso, la próxima vez que alguien abra un APK viejo
 * va a ver el banner de "hay una actualización" (ver ActualizacionDisponible.tsx).
 *
 * Flujo para publicar:
 *   1. Generar el build en:
 *      src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
 *   2. Subirlo a un GitHub Release (gh release create/upload, o la web de GitHub).
 *   3. Acá abajo, click en "Elegir release" y seleccionarlo de la lista.
 *
 * Uso: envolver con <AdminOnly> (ya lo hace app/myself/actualizaciones/page.tsx).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Loader2, Package, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  obtenerVersionActual,
  publicarNuevaVersion,
  type VersionActual,
} from "@/infra/updater/updaterEngine";

import SelectorApk from "./SelectorApk";

interface ApkReleaseOption {
  tag: string;
  titulo: string;
  publicadoEn: string;
  url: string;
  nombreArchivo: string;
  tamanioMB: number;
}

export function PanelActualizacionApk() {
  const [actual, setActual] = useState<VersionActual | null>(null);
  const [cargandoActual, setCargandoActual] = useState(true);

  const [elegida, setElegida] = useState<ApkReleaseOption | null>(null);
  const [version, setVersion] = useState("");
  const [notas, setNotas] = useState("");
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const inputClase =
    "h-10 px-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-sm text-primary/80 placeholder:text-primary/30 focus:border-primary/30 transition-colors w-full";

  useEffect(() => {
    obtenerVersionActual()
      .then(setActual)
      .catch((e) => console.warn("No se pudo leer la versión actual:", e))
      .finally(() => setCargandoActual(false));
  }, []);

  function manejarSeleccion(op: ApkReleaseOption) {
    setElegida(op);
    setSelectorAbierto(false);
    setError(null);
    setExito(false);

    // Sugerimos la versión a partir del tag (ej. v0.2.0 → 0.2.0), sin pisar
    // si el admin ya escribió algo.
    const match = op.tag.match(/(\d+\.\d+\.\d+)/);
    if (match && !version) setVersion(match[1]);
  }

  async function manejarPublicar() {
    if (!elegida) {
      setError("Elegí un release primero.");
      return;
    }
    setError(null);
    setExito(false);
    setPublicando(true);

    try {
      const nueva = await publicarNuevaVersion({ url: elegida.url, version, notas });
      setActual(nueva);
      setExito(true);
      setElegida(null);
      setNotas("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error publicando la versión.");
      console.error(e);
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-serif italic text-lg text-primary mb-1">
          Actualización de la app
        </h3>
        <p className="text-xs text-primary/40">
          Subí el .apk a un GitHub Release y elegilo acá abajo. Los que tengan
          una versión anterior instalada van a ver un banner ofreciendo
          actualizar.
        </p>
      </div>

      {/* Versión publicada actualmente */}
      <div className="rounded-lg border border-primary/10 bg-primary/[0.03] p-3 text-sm">
        {cargandoActual ? (
          <span className="text-primary/40 flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} /> Cargando versión actual…
          </span>
        ) : actual && actual.url ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-primary/80">
              Versión publicada: <strong>{actual.version}</strong>
            </span>
            {actual.notas && <span className="text-primary/40 text-xs">{actual.notas}</span>}
            <span className="text-primary/30 text-xs break-all">{actual.url}</span>
            <span className="text-primary/30 text-xs">
              Actualizado: {new Date(actual.updated_at).toLocaleString("es-AR")}
            </span>
          </div>
        ) : (
          <span className="text-primary/40">Todavía no se publicó ningún APK.</span>
        )}
      </div>

      {/* Formulario de publicación */}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-primary/50">Release de GitHub</span>

          {elegida ? (
            <div className="flex items-center gap-3 px-3 h-12 rounded-lg border border-primary/15 bg-primary/[0.04]">
              <Package className="text-primary/40 shrink-0" size={16} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-primary/80 truncate">{elegida.titulo}</p>
                <p className="text-xs text-primary/40 truncate">
                  {elegida.nombreArchivo} — {elegida.tamanioMB} MB
                </p>
              </div>
              <button
                type="button"
                className="text-primary/30 hover:text-red-500 transition-colors shrink-0"
                onClick={() => setElegida(null)}
                disabled={publicando}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelectorAbierto(true)}
              disabled={publicando}
              className="flex items-center justify-center gap-2 h-12 rounded-lg border border-dashed border-primary/20 text-primary/50 text-sm hover:border-primary/40 hover:text-primary/70 transition-colors"
            >
              <Package size={16} /> Elegir release
            </button>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-primary/50">Versión (semver, ej. 0.2.0)</span>
          <input
            className={inputClase}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="0.2.0"
            disabled={publicando}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-primary/50">Notas (opcional)</span>
          <textarea
            className={`${inputClase} h-20 resize-none py-2`}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Qué cambió en esta versión…"
            disabled={publicando}
          />
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {exito && (
          <p className="text-xs text-green-600">
            Listo — la nueva versión ya está publicada.
          </p>
        )}

        <button
          type="button"
          onClick={manejarPublicar}
          disabled={publicando || !elegida}
          className="flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
        >
          {publicando ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Publicando…
            </>
          ) : (
            <>
              <UploadCloud size={16} /> Publicar actualización
            </>
          )}
        </button>
      </div>

      {selectorAbierto && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelectorAbierto(false)}
        >
          <div
            className="bg-white-custom rounded-t-2xl sm:rounded-2xl shadow-2xl border border-primary/15 w-full sm:max-w-lg p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-micro font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
                <Package size={11} /> Elegir release
              </h3>
              <button
                className="text-primary/30 hover:text-primary transition-colors"
                onClick={() => setSelectorAbierto(false)}
              >
                <X size={16} />
              </button>
            </div>
            <SelectorApk
              onClose={() => setSelectorAbierto(false)}
              onSelect={manejarSeleccion}
            />
          </div>
        </div>
      )}
    </div>
  );
}

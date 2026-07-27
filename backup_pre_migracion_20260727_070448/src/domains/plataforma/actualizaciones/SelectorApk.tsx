"use client";

/**
 * SelectorApk
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal que lista los releases de GitHub con un asset .apk (vía la Edge
 * Function `listar-apk-releases`) y permite elegir uno — mismo patrón visual
 * que SimpleImagePicker, pero con una lista en vez de una grilla de
 * imágenes, porque acá no hay miniatura que mostrar.
 *
 * Usa una Edge Function y no una ruta de Next porque el proyecto exporta
 * estático (`output: "export"`, necesario para el build de Tauri) — ver
 * supabase/functions/listar-apk-releases/index.ts para el detalle.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Check, Loader2, Package, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { cn } from "@/lib/utils/index";

interface ApkReleaseOption {
  tag: string;
  titulo: string;
  publicadoEn: string;
  url: string;
  nombreArchivo: string;
  tamanioMB: number;
}

interface SelectorApkProps {
  onSelect: (opcion: ApkReleaseOption) => void;
  onClose: () => void;
}

export default function SelectorApk({ onSelect, onClose }: SelectorApkProps) {
  const [opciones, setOpciones] = useState<ApkReleaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const { data, error: errInvoke } = await supabase.functions.invoke(
          "listar-apk-releases",
          { method: "GET" },
        );

        if (errInvoke) throw errInvoke;
        if (!data?.ok) throw new Error(data?.error || "Error al listar releases.");

        if (!cancelado) setOpciones(data.opciones);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : "Error cargando releases.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  const elegida = opciones.find((o) => o.url === seleccionada) ?? null;

  return (
    <div className="flex flex-col" style={{ maxHeight: "60vh" }}>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary/30" size={20} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-xs text-red-500">{error}</p>
          </div>
        ) : opciones.length === 0 ? (
          <p className="text-center text-micro text-muted-on-surface py-10 uppercase tracking-widest">
            No hay releases con un .apk todavía
          </p>
        ) : (
          opciones.map((op) => (
            <button
              key={op.url}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left border transition-all",
                seleccionada === op.url
                  ? "border-primary bg-primary/10"
                  : "border-primary/10 bg-primary/5 hover:border-primary/25 hover:bg-primary/[0.08]"
              )}
              style={{ borderRadius: "var(--radius-btn)" }}
              type="button"
              onClick={() => setSeleccionada(op.url)}
            >
              <Package className="text-primary/40 shrink-0" size={16} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-primary/80 truncate">{op.titulo}</p>
                <p className="text-xs text-primary/40 truncate">
                  {op.nombreArchivo} — {op.tamanioMB} MB —{" "}
                  {new Date(op.publicadoEn).toLocaleDateString("es-AR")}
                </p>
              </div>
              {seleccionada === op.url && (
                <div className="bg-primary rounded-full p-1 shrink-0">
                  <Check className="text-btn-text" size={12} />
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <div className="pt-4 flex gap-3">
        <button
          className="flex-1 py-4 text-micro font-black uppercase tracking-widest text-muted-on-surface hover:text-on-surface transition-colors"
          type="button"
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          className="btn-brand flex-[2] py-4 text-xs uppercase tracking-widest disabled:opacity-30"
          disabled={!elegida}
          type="button"
          onClick={() => elegida && onSelect(elegida)}
        >
          Seleccionar
        </button>
      </div>
    </div>
  );
}

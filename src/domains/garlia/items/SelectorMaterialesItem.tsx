"use client";

/**
 * SelectorMaterialesItem.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Edita la composición material real de un Objeto (item_materiales) — la
 * CAUSA de la física del objeto, nunca la consecuencia.
 *
 * Regla del editor de objetos (ver "Editor y visualizador son
 * responsabilidades distintas"): este componente solo escribe material_id/
 * cantidad/proporcion/rol. No calcula ni muestra masa/densidad/rigidez/etc
 * — eso vive exclusivamente en PanelFisicaObjeto, de solo lectura, leyendo
 * items.propiedades_fisicas ya derivado por Supabase.
 *
 * Después de agregar/editar/quitar un material, este componente NO asume
 * cómo cambian las propiedades calculadas: se limita a persistir la causa.
 * Es responsabilidad del padre (EditorItem) refrescar `item` si necesita
 * ver la física recalculada (columna derivada en `items`, no acá).
 */

import { Loader2, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";

import { ComboSelector } from "@/ui/ComboSelector";
import { useMateriales } from "@/domains/garlia/materiales/useMateriales";

import { useItemMateriales } from "./useItemMateriales";

export function SelectorMaterialesItem({
  itemId,
  onComposicionCambiada,
}: {
  itemId: string;
  /** Se llama después de agregar/editar/quitar un material. La composición
   *  ya quedó persistida en item_materiales — esto solo avisa al padre para
   *  que, si quiere, vuelva a pedir el `item` (propiedades_fisicas) a
   *  Supabase. Este componente nunca calcula ni asume el nuevo valor: solo
   *  notifica que la causa cambió. Ver regla "los resultados deben poder
   *  actualizarse" — sin este aviso, PanelFisicaObjeto mostraría física
   *  obsoleta hasta que se recargue el editor entero. */
  onComposicionCambiada?: () => void;
}) {
  const { items: materialesCatalogo, loading: loadingCatalogo } = useMateriales();
  const { items: composicion, loading: loadingComposicion, agregar, actualizar, eliminar } =
    useItemMateriales(itemId);

  const [agregandoMaterialId, setAgregandoMaterialId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const materialesDisponibles = materialesCatalogo.filter(
    (m) => !composicion.some((c) => c.material_id === m.id),
  );

  async function handleAgregar() {
    if (!agregandoMaterialId) return;
    setGuardando(true);
    try {
      // Cantidad inicial neutra (1) — es un dato base editable, no un
      // valor físico inventado. El usuario la ajusta después; el motor
      // deriva masa/densidad/etc a partir de ella, nunca al revés.
      await agregar({ material_id: agregandoMaterialId, cantidad: 1 });
      setAgregandoMaterialId(null);
      onComposicionCambiada?.();
    } finally {
      setGuardando(false);
    }
  }

  async function handleActualizar(id: string, cambios: Parameters<typeof actualizar>[1]) {
    await actualizar(id, cambios);
    onComposicionCambiada?.();
  }

  async function handleEliminar(id: string) {
    await eliminar(id);
    onComposicionCambiada?.();
  }

  return (
    <div>
      {loadingComposicion ? (
        <div className="flex items-center gap-2 py-4 text-sm text-primary/45">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando composición…
        </div>
      ) : (
        <div className="space-y-2">
          {composicion.map((fila) => {
            const material = materialesCatalogo.find((m) => m.id === fila.material_id);
            return (
              <div
                key={fila.id}
                className="flex items-center gap-2 rounded-lg border border-primary/10 px-3 py-2"
              >
                <span className="flex-1 min-w-0 truncate text-sm text-primary">
                  {material?.nombre ?? fila.material_id.slice(0, 8)}
                </span>

                <label className="flex items-center gap-1.5 text-xs text-primary/50">
                  Cant.
                  <input
                    className="w-16 rounded border border-primary/15 bg-transparent px-1.5 py-0.5 text-xs text-primary"
                    min={0}
                    step="any"
                    type="number"
                    value={fila.cantidad}
                    onChange={(e) => {
                      const v = e.target.value === "" ? 0 : Number(e.target.value);
                      void handleActualizar(fila.id, { cantidad: v });
                    }}
                  />
                </label>

                <label className="flex items-center gap-1.5 text-xs text-primary/50">
                  Prop.
                  <input
                    className="w-16 rounded border border-primary/15 bg-transparent px-1.5 py-0.5 text-xs text-primary"
                    min={0}
                    placeholder="—"
                    step="any"
                    type="number"
                    value={fila.proporcion ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      void handleActualizar(fila.id, { proporcion: v });
                    }}
                  />
                </label>

                <button
                  className="shrink-0 rounded-lg p-1.5 text-primary/30 hover:text-red-500 hover:bg-red-500/8 transition-all"
                  title="Quitar material"
                  type="button"
                  onClick={() => void handleEliminar(fila.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}

          {composicion.length === 0 && (
            <p className="py-2 text-sm text-primary/40">
              Sin materiales todavía. Agrega uno del catálogo para que el motor pueda derivar la física.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <ComboSelector
            icon={<Plus size={11} />}
            items={materialesDisponibles.map((m) => ({ id: m.id, label: m.nombre }))}
            label=""
            loading={loadingCatalogo}
            mode="single"
            placeholder="Elegir material del catálogo…"
            value={agregandoMaterialId}
            onChange={setAgregandoMaterialId}
          />
        </div>
        <button
          className="shrink-0 rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-primary/60 hover:text-primary hover:border-primary/35 disabled:opacity-30 transition-all"
          disabled={!agregandoMaterialId || guardando}
          type="button"
          onClick={handleAgregar}
        >
          {guardando ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </div>
  );
}

export default SelectorMaterialesItem;

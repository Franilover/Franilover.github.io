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
import type { ItemMaterial } from "./types";

/**
 * Fila editable de un material ya vinculado. Estado local propio para los
 * inputs de cantidad/proporción: mientras el usuario escribe (por ejemplo
 * borra el campo para tipear un número nuevo) NO se persiste cada
 * keystroke — eso disparaba `cantidad = 0` momentáneo y Supabase lo
 * rechazaba (item_materiales_cantidad_check exige cantidad > 0; proporcion
 * exige 0..1, verificado contra el proyecto real). Se persiste recién en
 * onBlur, y solo si el valor final es válido según esos mismos constraints
 * — si no lo es, se revierte al valor guardado sin llamar a Supabase.
 */
function FilaMaterial({
  fila,
  nombreMaterial,
  onActualizar,
  onEliminar,
}: {
  fila: ItemMaterial;
  nombreMaterial: string;
  onActualizar: (cambios: Partial<Pick<ItemMaterial, "cantidad" | "proporcion" | "rol">>) => void;
  onEliminar: () => void;
}) {
  const [cantidadTexto, setCantidadTexto] = useState(String(fila.cantidad));
  const [proporcionTexto, setProporcionTexto] = useState(
    fila.proporcion === null ? "" : String(fila.proporcion),
  );

  // Si la fila cambia por fuera (otro refetch), sincronizamos el texto
  // local — pero solo cuando el valor guardado realmente difiere del que
  // el usuario ve, para no pisarle lo que está tipeando.
  const cantidadGuardada = String(fila.cantidad);
  const proporcionGuardada = fila.proporcion === null ? "" : String(fila.proporcion);

  function commitCantidad() {
    const n = Number(cantidadTexto);
    // item_materiales_cantidad_check / _positive: cantidad > 0.
    if (cantidadTexto.trim() === "" || Number.isNaN(n) || n <= 0) {
      setCantidadTexto(cantidadGuardada);
      return;
    }
    if (n !== fila.cantidad) onActualizar({ cantidad: n });
  }

  function commitProporcion() {
    if (proporcionTexto.trim() === "") {
      if (fila.proporcion !== null) onActualizar({ proporcion: null });
      return;
    }
    const n = Number(proporcionTexto);
    // item_materiales_proporcion_check / _range: 0 <= proporcion <= 1.
    if (Number.isNaN(n) || n < 0 || n > 1) {
      setProporcionTexto(proporcionGuardada);
      return;
    }
    if (n !== fila.proporcion) onActualizar({ proporcion: n });
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/10 px-3 py-2">
      <span className="flex-1 min-w-0 truncate text-sm text-primary">{nombreMaterial}</span>

      <label className="flex items-center gap-1.5 text-xs text-primary/50">
        Cant.
        <input
          className="w-16 rounded border border-primary/15 bg-transparent px-1.5 py-0.5 text-xs text-primary"
          min={0}
          step="any"
          type="number"
          value={cantidadTexto}
          onChange={(e) => setCantidadTexto(e.target.value)}
          onBlur={commitCantidad}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </label>

      <label className="flex items-center gap-1.5 text-xs text-primary/50">
        Prop.
        <input
          className="w-16 rounded border border-primary/15 bg-transparent px-1.5 py-0.5 text-xs text-primary"
          max={1}
          min={0}
          placeholder="—"
          step="any"
          type="number"
          value={proporcionTexto}
          onChange={(e) => setProporcionTexto(e.target.value)}
          onBlur={commitProporcion}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </label>

      <button
        className="shrink-0 rounded-lg p-1.5 text-primary/30 hover:text-red-500 hover:bg-red-500/8 transition-all"
        title="Quitar material"
        type="button"
        onClick={onEliminar}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

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
              <FilaMaterial
                key={fila.id}
                fila={fila}
                nombreMaterial={material?.nombre ?? fila.material_id.slice(0, 8)}
                onActualizar={(cambios) => handleActualizar(fila.id, cambios)}
                onEliminar={() => handleEliminar(fila.id)}
              />
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

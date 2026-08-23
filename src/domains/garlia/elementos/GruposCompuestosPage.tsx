"use client";

/**
 * GruposCompuestosPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Ya NO existe la sub-sección de página "Grupos de compuestos" (la tabla
 * "grupos_compuestos" fue eliminada de Supabase hace tiempo). Este archivo
 * solo sobrevive por GrupoCompuestoPanelFlotante: el modal genérico de
 * edición de un Órgano o Formación ya vinculado — nombre, función, fórmula
 * (vía SelectorFormulaTejidos + useOrganoTejidos/useFormacionVetas) y
 * notas — que reutilizan MineralEditor, EditorItem, EditorCriatura,
 * FloraEditor, BiologiaPage y GridCatalogoGrupo. Recibe el registro por
 * props (grupo, onActualizar, onEliminar) y resuelve su propia
 * composición internamente según `tipo`.
 */

import { Boxes, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { SelectorFormulaTejidos } from "@/domains/garlia/_shared/SelectorFormulaTejidos";
import { useOrganoTejidos } from "@/domains/garlia/elementos/useOrganoTejidos";
import { useFormacionVetas } from "@/domains/garlia/elementos/useFormacionVetas";
import { useCatalogoTejidos } from "@/domains/garlia/elementos/useCatalogoTejidos";
import { useCelulas } from "@/domains/garlia/elementos/useCelulas";
import { useTejidos } from "@/domains/garlia/elementos/useTejidos";
import { useGranos } from "@/domains/garlia/elementos/useGranos";
import { useVetas } from "@/domains/garlia/elementos/useVetas";
import { PanelEditorTejido, PanelEditorCelula } from "@/domains/garlia/biologia/CatalogoTejidosBiologia";
import { PanelEditorVeta, PanelEditorGrano, SelectorGrano } from "@/domains/garlia/fisica/CatalogoVetasFisica";
import type { EntradaCatalogoGrupo } from "@/domains/garlia/_shared/useEntidadVinculosGrupo";

import type { Compuesto } from "./types";

/**
 * Panel flotante centrado del detalle de un Órgano/Formación — mismo
 * comportamiento visual que ElementoPanelFlotante/CompuestoPanelFlotante en
 * ElementosPage.tsx: modal centrado con backdrop blur, cierra con click en
 * el backdrop, Escape, o el botón X.
 */
export function GrupoCompuestoPanelFlotante({
  grupo,
  tipo = "organo",
  compuestos,
  onCerrar,
  onActualizar,
  onEliminar,
  onAbrirCompuesto,
}: {
  grupo: EntradaCatalogoGrupo;
  /** "organo" resuelve la fórmula vía Tejidos/Células; "formacion" vía Vetas/Granos. */
  tipo?: "organo" | "formacion";
  compuestos: Compuesto[];
  onCerrar: () => void;
  onActualizar: (id: string, cambios: Partial<EntradaCatalogoGrupo>) => void;
  onEliminar?: (id: string) => void;
  onAbrirCompuesto?: (compuestoId: string) => void;
}) {
  const tejidos = useOrganoTejidos(tipo === "organo" ? grupo.id : null);
  const vetas = useFormacionVetas(tipo === "formacion" ? grupo.id : null);
  const formula = tipo === "organo" ? tejidos : vetas;
  const catalogo = useCatalogoTejidos(tipo);

  // ── Editor completo del Tejido/Veta propio de una fila de la fórmula —
  // mismo panel que Biología > Catálogo de Tejidos / Física > Catálogo de
  // Vetas (ver CatalogoTejidosBiologia.tsx / CatalogoVetasFisica.tsx),
  // reutilizado acá para no duplicar el editor. Solo se instancian los
  // catálogos globales (useCelulas/useTejidos o useGranos/useVetas) cuando
  // el panel está realmente abierto. ────────────────────────────────────
  const [tejidoOVetaAbiertoId, setTejidoOVetaAbiertoId] = useState<string | null>(null);
  // Editor de la Célula/Grano que compone una fila — abierto directo desde
  // "hecho de: [Célula]" en SelectorFormulaTejidos (cadena real
  // Tejido→Célula→Compuesto), o desde adentro de PanelEditorTejido al
  // navegar Tejido→Célula. Mismo shape de estado que tejidoOVetaAbiertoId,
  // pero apunta a Célula/Grano — panel independiente, no reemplaza al de
  // arriba (pueden estar los dos abiertos: Tejido debajo, Célula encima). ─
  const [celulaOGranoAbiertoId, setCelulaOGranoAbiertoId] = useState<string | null>(null);
  const celulasCatalogo = useCelulas();
  const tejidosCatalogo = useTejidos();
  const granosCatalogo = useGranos();
  const vetasCatalogo = useVetas();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCerrar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: "color-mix(in srgb, var(--primary) 35%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "var(--bg-main)",
          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
          animation: "popIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Header: ícono + nombre editable + eliminar + cerrar */}
        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            }}
          >
            <Boxes className="text-primary/50" size={12} />
          </div>
          <input
            className="flex-1 min-w-0 bg-transparent text-sm font-black text-primary outline-none placeholder:text-primary/25"
            placeholder="Nombre (ej: Hoja, Veta de cuarzo)…"
            value={grupo.nombre ?? ""}
            onChange={(e) => onActualizar(grupo.id, { nombre: e.target.value })}
          />
          {onEliminar && (
            <button
              type="button"
              onClick={() => onEliminar(grupo.id)}
              title="Eliminar"
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-black uppercase tracking-widest border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
            >
              <Trash2 size={10} />
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/8 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido: función + fórmula + notas */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
          <div>
            <p className="text-micro font-black uppercase tracking-widest text-primary/40 mb-1.5">
              Función
            </p>
            <input
              className="w-full bg-transparent px-0 py-1 text-xs text-primary/80 outline-none placeholder:text-primary/25"
              placeholder="Para qué sirve…"
              value={grupo.funcion ?? ""}
              onChange={(e) => onActualizar(grupo.id, { funcion: e.target.value })}
            />
          </div>

          <div>
            <p className="text-micro font-black uppercase tracking-widest text-primary/40 mb-1.5">
              Fórmula
            </p>
            {formula.loading ? (
              <p className="text-micro text-primary/25 italic">Cargando…</p>
            ) : (
              <SelectorFormulaTejidos
                items={formula.items}
                onVincularExistente={(id) => void formula.vincularExistente(id)}
                onCrearYVincular={(nombre) => void formula.crearYVincular(nombre)}
                catalogoDisponible={catalogo.items}
                loadingCatalogo={catalogo.loading}
                labelCatalogo={tipo === "organo" ? "Tejido" : "Veta"}
                onActualizarProporcion={(vinculoId, proporcion) =>
                  void formula.actualizarProporcion(vinculoId, proporcion)
                }
                onQuitar={(vinculoId) => void formula.quitarCompuesto(vinculoId)}
                onAbrirCelula={(celulaOGranoId) => setCelulaOGranoAbiertoId(celulaOGranoId)}
                onAbrirTejido={(tejidoOVetaId) => setTejidoOVetaAbiertoId(tejidoOVetaId)}
              />
            )}
          </div>

          <div>
            <p className="text-micro font-black uppercase tracking-widest text-primary/40 mb-1.5">
              Notas
            </p>
            <textarea
              className="w-full min-h-[6rem] bg-transparent px-0 py-1 text-xs text-primary/70 resize-none outline-none transition-colors placeholder:text-primary/25"
              placeholder="Notas…"
              value={grupo.notas ?? ""}
              onChange={(e) => onActualizar(grupo.id, { notas: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Editor completo del Tejido/Veta de una fila — encima de este panel
         (mismo z-index base, PanelFlotanteBase se encarga de superponerse). */}
      {tejidoOVetaAbiertoId && tipo === "organo" && (
        (() => {
          const tejidoActivo = tejidosCatalogo.items.find((t) => t.id === tejidoOVetaAbiertoId);
          if (!tejidoActivo) return null;
          return (
            <PanelEditorTejido
              item={tejidoActivo}
              celulas={celulasCatalogo.items}
              loadingCelulas={celulasCatalogo.loading}
              compuestos={compuestos}
              onCerrar={() => setTejidoOVetaAbiertoId(null)}
              onActualizar={tejidosCatalogo.actualizar}
              onEliminar={tejidosCatalogo.eliminar}
              onAbrirCelula={(celulaId) => setCelulaOGranoAbiertoId(celulaId)}
              onAbrirCompuesto={onAbrirCompuesto}
            />
          );
        })()
      )}
      {tejidoOVetaAbiertoId && tipo === "formacion" && (
        (() => {
          const vetaActiva = vetasCatalogo.items.find((v) => v.id === tejidoOVetaAbiertoId);
          if (!vetaActiva) return null;
          return (
            <PanelEditorVeta
              item={vetaActiva}
              granos={granosCatalogo.items}
              loadingGranos={granosCatalogo.loading}
              onCerrar={() => setTejidoOVetaAbiertoId(null)}
              onActualizar={vetasCatalogo.actualizar}
              onEliminar={vetasCatalogo.eliminar}
              onAbrirGrano={(granoId) => setCelulaOGranoAbiertoId(granoId)}
            />
          );
        })()
      )}

      {/* Editor completo de la Célula/Grano que compone una fila — abierto
         desde "hecho de: [Célula]" en la fórmula, o desde adentro del panel
         de Tejido/Veta de arriba. El Compuesto se elige/edita adentro de
         ESTE panel (SelectorCompuesto), no en la fórmula ni en el Tejido. */}
      {celulaOGranoAbiertoId && tipo === "organo" && (
        (() => {
          const celulaActiva = celulasCatalogo.items.find((c) => c.id === celulaOGranoAbiertoId);
          if (!celulaActiva) return null;
          return (
            <PanelEditorCelula
              item={celulaActiva}
              compuestos={compuestos}
              onCerrar={() => setCelulaOGranoAbiertoId(null)}
              onActualizar={celulasCatalogo.actualizar}
              onEliminar={celulasCatalogo.eliminar}
              onAbrirCompuesto={onAbrirCompuesto}
            />
          );
        })()
      )}
      {celulaOGranoAbiertoId && tipo === "formacion" && (
        (() => {
          const granoActivo = granosCatalogo.items.find((g) => g.id === celulaOGranoAbiertoId);
          if (!granoActivo) return null;
          return (
            <PanelEditorGrano
              item={granoActivo}
              compuestos={compuestos}
              onCerrar={() => setCelulaOGranoAbiertoId(null)}
              onActualizar={granosCatalogo.actualizar}
              onEliminar={granosCatalogo.eliminar}
              onAbrirCompuesto={onAbrirCompuesto}
            />
          );
        })()
      )}
    </div>,
    document.body,
  );
}

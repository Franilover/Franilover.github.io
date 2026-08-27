"use client";

/**
 * BiologiaPage.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Sección Biología, hermana de Física en el toggle superior de RunasPage.
 * Ahora muestra directamente el cladograma (Cladística) sin sub-tabs:
 *   - Ecosistemas se manejan desde Entidades → Criaturas (ver
 *     CriaturasJerarquica / EcosistemaEditor), ya no vive acá.
 *   - Perfiles atómicos de criatura (afinidad.ts de Elementos + Oris de
 *     Física) tampoco se muestran acá — si hace falta recuperar el acceso,
 *     ver PerfilesAtomicosPage en PerfilAtomicoCriaturaPanel.tsx.
 *
 * 100% self-contained (trae sus propios datos de Supabase, como Física) y
 * NO toca EditorCriatura.tsx — solo referencia criaturas por id.
 */

import { Download, Loader2, Upload, X } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";
import { GridCatalogoGrupo } from "@/domains/garlia/_shared/GridCatalogoGrupo";
import { useCompuestosConElementos } from "@/domains/garlia/elementos/useCompuestosConElementos";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import { useOrganos } from "@/domains/garlia/elementos/useOrganos";
import { CompuestoPanelFlotante } from "@/domains/garlia/elementos/CompuestosPage";
import type { Organo } from "@/domains/garlia/elementos/types";

import { CladisticaPage } from "./CladisticaPage";
import { CatalogoTejidosBiologia } from "./CatalogoTejidosBiologia";
import { CatalogoSistemasBiologia } from "./CatalogoSistemasBiologia";
import { useClados } from "./useBiologia";
import type { Clado } from "./types";

interface Props {
  /** El padre decide qué hacer al clickear una criatura (ej. abrir su editor). */
  onSelectCriatura?: (id: string) => void;
}

// ─── Descarga: el cladograma de Biología en un solo JSON ──────────────────
// Mismo patrón que descargarDatosElementos/descargarDatosFisica — un solo
// archivo autocontenido con taxones + config de rangos.
function descargarDatosBiologia(datos: {
  clados: ReturnType<typeof useClados>["clados"];
}) {
  const payload = {
    exportado_en: new Date().toISOString(),
    clados: datos.clados,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `biologia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Subida: leer un JSON con el mismo formato exportado (clados) y ───────
// devolver los clados nuevos listos para insertar. Mismo espíritu que
// parsearArchivoElementosJSON/parsearArchivoFisicaJSON.
//
// padre_id no se remapea: como los clados nuevos todavía no tienen id
// asignado por Supabase, cualquier padre_id del archivo que no exista ya
// en la base se resetea a null (queda como raíz) para no dejar referencias
// colgantes — mismo criterio conservador que usa eliminar() en useBiologia.
interface ImportacionBiologia {
  cladosNuevos: Omit<Clado, "id" | "created_at" | "updated_at">[];
  /** Clados del archivo que coinciden por nombre con uno existente: se actualizan en vez de saltarse. */
  cladosActualizar: (Partial<Clado> & { id: string })[];
  padresOmitidos: { nombre: string }[];
}

function parsearArchivoBiologiaJSON(raw: string, cladosExistentes: Clado[]): ImportacionBiologia {
  const data = JSON.parse(raw);
  const lista: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.clados) ? data.clados : null;
  if (!lista) {
    throw new Error('El JSON debe ser un arreglo de clados, o un objeto con la clave "clados".');
  }

  const idsExistentes = new Set(cladosExistentes.map((c) => c.id));
  const porNombre = new Map(cladosExistentes.map((c) => [c.nombre, c]));
  const cladosNuevos: Omit<Clado, "id" | "created_at" | "updated_at">[] = [];
  const cladosActualizar: (Partial<Clado> & { id: string })[] = [];
  const padresOmitidos: { nombre: string }[] = [];

  for (const item of lista) {
    const c = item as Partial<Clado>;
    if (!c.nombre) {
      throw new Error(`Clado inválido (falta nombre): ${JSON.stringify(c).slice(0, 120)}`);
    }

    const existente = porNombre.get(c.nombre);

    // padre_id: solo se acepta si apunta a un clado que ya existe en la
    // base (los ids del propio archivo, si trae, no sirven porque los
    // clados nuevos todavía no tienen id asignado por Supabase).
    let padreId = c.padre_id ?? null;
    if (padreId && !idsExistentes.has(padreId)) {
      padresOmitidos.push({ nombre: c.nombre });
      padreId = null;
    }

    const datos = {
      nombre: c.nombre,
      sinapomorfia: c.sinapomorfia ?? "",
      padre_id: padreId,
      descripcion: c.descripcion ?? "",
      criatura_ids: c.criatura_ids ?? [],
      orden: c.orden ?? 0,
    };

    if (existente) {
      cladosActualizar.push({ id: existente.id, ...datos });
    } else {
      cladosNuevos.push(datos);
    }
  }

  return { cladosNuevos, cladosActualizar, padresOmitidos };
}

export function BiologiaPage({ onSelectCriatura }: Props) {
  // Traído acá solo para armar el JSON de descarga — Cladística sigue
  // manejando sus propios datos internamente (self-contained), esto no le
  // saca esa responsabilidad.
  const { clados, setClados } = useClados();

  // ── Órganos: catálogo propio, mismo motor que Física ─────
  // Órganos = tabla real "organos" (mismo catálogo que usa Flora para
  // vincular por planta_organos, y Criaturas por criatura_organos). Ya no
  // tiene columna `componentes` — la fórmula vive vía Tejidos/Células.
  // (El catálogo "reacciones" ya no se renderiza acá como "Procesos" — es
  // la misma tabla que Química → Tabla → Reacciones y Física → Habilidades,
  // así que se dejó un único render global en Tabla→Reacciones para evitar
  // 3 fetches/estados desincronizados del mismo dato.) Self-contained,
  // igual que el resto de Biología: trae sus propios datos acá sin tocar
  // CladisticaPage ni depender de una planta puntual.
  const { items: catalogoOrganos, setItems: setCatalogoOrganos } = useOrganos();
  const { items: compuestosCatalogo, setItems: setCompuestosCatalogo, loading: loadingCompuestos } = useCompuestosConElementos();
  const { items: elementosCatalogo } = useElementos();

  // Click en un Compuesto de matriz (Tejido) o en un Compuesto de la
  // composición de una Célula abre acá su editor completo — mismo patrón
  // que FloraEditor.tsx (setItemAbierto({ tipo: "compuesto", id })).
  const [compuestoAbiertoId, setCompuestoAbiertoId] = useState<string | null>(null);
  // Navegación controlada desde el breadcrumb "Tejido → Órgano" de
  // CatalogoTejidosBiologia — al elegir un Órgano, este id le llega a
  // GridCatalogoGrupo (abrirIdExterno) para abrir su editor flotante.
  const [organoAAbrirId, setOrganoAAbrirId] = useState<string | null>(null);

  async function actualizarOrgano(id: string, cambios: Partial<Organo>) {
    setCatalogoOrganos((prev) => prev.map((g) => (g.id === id ? { ...g, ...cambios } : g)));
    const { error } = await supabase.from("organos").update(cambios).eq("id", id);
    if (error) console.error("[BiologiaPage] error guardando órgano:", error);
  }

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [mensajeImportacion, setMensajeImportacion] = useState<string | null>(null);

  async function handleArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    setImportando(true);
    setMensajeImportacion(null);
    try {
      const texto = await archivo.text();
      const { cladosNuevos, cladosActualizar, padresOmitidos } = parsearArchivoBiologiaJSON(texto, clados);
      if (cladosNuevos.length === 0 && cladosActualizar.length === 0) {
        setMensajeImportacion("Nada para importar.");
        return;
      }

      const partes: string[] = [];

      if (cladosNuevos.length > 0) {
        const { data, error } = await supabase.from("clados").insert(cladosNuevos).select();
        if (error) throw error;
        const insertados = (data ?? []) as Clado[];
        setClados((prev) => [...prev, ...insertados]);
        partes.push(`${insertados.length} clado${insertados.length === 1 ? "" : "s"} nuevo${insertados.length === 1 ? "" : "s"} importado${insertados.length === 1 ? "" : "s"}`);
      }

      if (cladosActualizar.length > 0) {
        let actualizados = 0;
        for (const { id, ...datos } of cladosActualizar) {
          const { error } = await supabase.from("clados").update(datos).eq("id", id);
          if (error) {
            console.error("[BiologiaPage] error actualizando clado", id, error);
            continue;
          }
          actualizados++;
        }
        setClados((prev) =>
          prev.map((c) => {
            const cambio = cladosActualizar.find((x) => x.id === c.id);
            return cambio ? { ...c, ...cambio } : c;
          }),
        );
        partes.push(`${actualizados} clado${actualizados === 1 ? "" : "s"} existente${actualizados === 1 ? "" : "s"} actualizado${actualizados === 1 ? "" : "s"}`);
      }

      if (padresOmitidos.length > 0) {
        partes.push(`${padresOmitidos.length} sin padre_id válido (quedaron como raíz)`);
      }
      setMensajeImportacion(partes.join(" · "));
    } catch (err) {
      console.error("[BiologiaPage] error importando JSON:", err);
      setMensajeImportacion(err instanceof Error ? `Error: ${err.message}` : "Error al leer el archivo.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 min-h-0">
      {/* Columna izquierda: Cladística — comportamiento sin cambios, solo
          ahora vive fija al lado de Órganos/Procesos en vez de ocupar todo
          el ancho detrás de un tab. */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-end gap-1 px-2 mb-1">
          <input
            ref={inputArchivoRef}
            type="file"
            accept="application/json,.json"
            onChange={handleArchivoSeleccionado}
            className="hidden"
          />
          <button
            type="button"
            disabled={importando}
            onClick={() => inputArchivoRef.current?.click()}
            title='Subir un JSON con clados: crea los nuevos y actualiza los existentes (mismo nombre), mismo formato que "Descargar datos"'
            className="flex items-center justify-center p-1.5 rounded-md border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {importando ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
          </button>
          <button
            type="button"
            onClick={() => descargarDatosBiologia({ clados })}
            title="Descargar el cladograma de Biología (clados) como JSON"
            className="flex items-center justify-center p-1.5 rounded-md border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Download size={14} />
          </button>
        </div>

        {mensajeImportacion && (
          <div className="flex items-center justify-between gap-2 px-2 mb-1 text-micro text-primary/60">
            <span className="min-w-0">{mensajeImportacion}</span>
            <button
              type="button"
              onClick={() => setMensajeImportacion(null)}
              className="shrink-0 text-primary/30 hover:text-primary/60 cursor-pointer"
              title="Cerrar"
            >
              <X size={10} />
            </button>
          </div>
        )}

        <CladisticaPage onSelectCriatura={onSelectCriatura} />
      </div>

      {/* Columna derecha: Órganos — apilados, cada uno con su propio
          separador de sección, sin tabs. */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 border-l border-primary/10 pl-3">
        <div className="p-2.5">
          <CatalogoTejidosBiologia
            compuestos={compuestosCatalogo}
            loadingCompuestos={loadingCompuestos}
            onAbrirCompuesto={(id) => setCompuestoAbiertoId(id)}
            onAbrirOrgano={(id) => setOrganoAAbrirId(id)}
          />
        </div>

        <div className="p-2.5 border-t border-primary/10 pt-4">
          <CatalogoSistemasBiologia
            organos={catalogoOrganos}
            onAbrirOrgano={(id) => setOrganoAAbrirId(id)}
          />
        </div>

        <div className="p-2.5 border-t border-primary/10 pt-4">
          <GridCatalogoGrupo
            modo="grupo"
            titulo="Órganos"
            icono="organo"
            items={catalogoOrganos}
            compuestos={compuestosCatalogo}
            onActualizar={actualizarOrgano}
            onAbrirCompuesto={(id) => setCompuestoAbiertoId(id)}
            abrirIdExterno={organoAAbrirId}
            onAbrirIdExternoConsumido={() => setOrganoAAbrirId(null)}
          />
        </div>
      </div>

      {compuestoAbiertoId &&
        (() => {
          const compuesto = compuestosCatalogo.find((c) => c.id === compuestoAbiertoId);
          if (!compuesto) return null;
          return (
            <CompuestoPanelFlotante
              compuesto={compuesto}
              elementos={elementosCatalogo}
              todosLosCompuestos={compuestosCatalogo}
              onCerrar={() => setCompuestoAbiertoId(null)}
              onActualizar={(id, cambios) =>
                setCompuestosCatalogo((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
                )
              }
            />
          );
        })()}
    </div>
  );
}

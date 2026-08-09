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
import React, { useRef, useState } from "react";

import { supabase } from "@/infra/supabase/supabase";

import { CladisticaPage } from "./CladisticaPage";
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
  duplicados: { nombre: string }[];
  padresOmitidos: { nombre: string }[];
}

function parsearArchivoBiologiaJSON(raw: string, cladosExistentes: Clado[]): ImportacionBiologia {
  const data = JSON.parse(raw);
  const lista: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.clados) ? data.clados : null;
  if (!lista) {
    throw new Error('El JSON debe ser un arreglo de clados, o un objeto con la clave "clados".');
  }

  const idsExistentes = new Set(cladosExistentes.map((c) => c.id));
  const nombresExistentes = new Set(cladosExistentes.map((c) => c.nombre));
  const cladosNuevos: Omit<Clado, "id" | "created_at" | "updated_at">[] = [];
  const duplicados: { nombre: string }[] = [];
  const padresOmitidos: { nombre: string }[] = [];

  for (const item of lista) {
    const c = item as Partial<Clado>;
    if (!c.nombre) {
      throw new Error(`Clado inválido (falta nombre): ${JSON.stringify(c).slice(0, 120)}`);
    }
    if (nombresExistentes.has(c.nombre)) {
      duplicados.push({ nombre: c.nombre });
      continue;
    }
    nombresExistentes.add(c.nombre);

    let padreId = c.padre_id ?? null;
    if (padreId && !idsExistentes.has(padreId)) {
      padresOmitidos.push({ nombre: c.nombre });
      padreId = null;
    }

    cladosNuevos.push({
      nombre: c.nombre,
      sinapomorfia: c.sinapomorfia ?? "",
      padre_id: padreId,
      descripcion: c.descripcion ?? "",
      criatura_ids: c.criatura_ids ?? [],
      orden: c.orden ?? 0,
    });
  }

  return { cladosNuevos, duplicados, padresOmitidos };
}

export function BiologiaPage({ onSelectCriatura }: Props) {
  // Traído acá solo para armar el JSON de descarga — Cladística sigue
  // manejando sus propios datos internamente (self-contained), esto no le
  // saca esa responsabilidad.
  const { clados, setClados } = useClados();

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
      const { cladosNuevos, duplicados, padresOmitidos } = parsearArchivoBiologiaJSON(texto, clados);
      if (cladosNuevos.length === 0) {
        setMensajeImportacion("Nada nuevo para importar.");
        return;
      }
      const { data, error } = await supabase.from("clados").insert(cladosNuevos).select();
      if (error) throw error;
      const insertados = (data ?? []) as Clado[];
      setClados((prev) => [...prev, ...insertados]);

      const partes = [`${insertados.length} clado${insertados.length === 1 ? "" : "s"} importado${insertados.length === 1 ? "" : "s"}`];
      if (duplicados.length > 0) {
        partes.push(`${duplicados.length} omitido${duplicados.length === 1 ? "" : "s"} por nombre duplicado`);
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
    <div>
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
          title='Subir un JSON con clados nuevos (mismo formato que "Descargar datos")'
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
  );
}

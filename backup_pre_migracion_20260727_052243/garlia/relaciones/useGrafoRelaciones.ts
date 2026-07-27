"use client";

/**
 * useGrafoRelaciones.ts
 * ──────────────────────
 * Estado del modal del grafo de relaciones: apertura, carga de datos
 * (delegada a lib/utils/grafoRelaciones) y medición del contenedor
 * para que el SVG ocupe todo el espacio disponible.
 *
 * Ruta: src/features/editorGarlia/hooks/useGrafoRelaciones.ts
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  cargarDatosGrafo,
} from "@/lib/utils/grafoRelaciones";
import type { DatosGrafo } from "@/lib/utils/grafoRelaciones";

export function useGrafoRelaciones(personajeId: string) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<DatosGrafo | null>(null);
  const [loading, setLoading] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 420 });

  const abrir = useCallback(async () => {
    setAbierto(true);
    if (datos) return;
    setLoading(true);
    const d = await cargarDatosGrafo(personajeId);
    setDatos(d);
    setLoading(false);
  }, [personajeId, datos]);

  const cerrar = useCallback(() => setAbierto(false), []);

  // Medir el contenedor para que el SVG ocupe todo el espacio
  useEffect(() => {
    if (!abierto || !contenedorRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    obs.observe(contenedorRef.current);
    return () => obs.disconnect();
  }, [abierto]);

  return { abierto, abrir, cerrar, datos, loading, contenedorRef, size };
}

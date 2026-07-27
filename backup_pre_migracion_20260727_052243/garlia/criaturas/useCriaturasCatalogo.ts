"use client";

/**
 * useCriaturasCatalogo.ts
 * ─────────────────────────
 * Catálogo global de criaturas (id, nombre, imagen) para alimentar el
 * selector "Criatura" en Items, Runas, Hechizos y Dones.
 * Usa fetchAllCriaturas (singleton compartido) para no repetir el fetch
 * si hay varios selectores montados en simultáneo.
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/misc/useCriaturasCatalogo.ts
 */

import { useEffect, useState } from "react";

import { fetchAllCriaturas, type CriaturaMin } from "@/lib/utils/criaturasCache";

export function useCriaturasCatalogo() {
  const [criaturas, setCriaturas] = useState<CriaturaMin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchAllCriaturas().then((data) => {
      if (alive) {
        setCriaturas(data);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  return { criaturas, loading };
}

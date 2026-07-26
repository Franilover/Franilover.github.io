"use client";

/**
 * useCriaturaAsideCatalogs.ts
 * ────────────────────────────
 * Carga los catálogos globales que necesita la barra lateral del editor:
 * personajes, reinos y ciudades. Antes vivían en useEffects sueltos
 * dentro del componente EditorCriatura.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/useCriaturaAsideCatalogs.ts
 */

import { useEffect, useState } from "react";

import {
  getAllPersonajes,
  getAllReinos,
  getAllCiudades,
  type ReinoMin,
  type CiudadMin,
} from "@/lib/utils/criaturaHabitatCache";

type PersonajeMin = { id: string; nombre: string; img_url?: string | null };

export function useCriaturaAsideCatalogs() {
  const [allPersonajes, setAllPersonajes] = useState<PersonajeMin[]>([]);
  const [allReinos, setAllReinos] = useState<ReinoMin[]>([]);
  const [allCiudades, setAllCiudades] = useState<CiudadMin[]>([]);

  useEffect(() => {
    void getAllPersonajes().then(setAllPersonajes);
    void getAllReinos().then(setAllReinos);
    void getAllCiudades().then(setAllCiudades);
  }, []);

  return { allPersonajes, allReinos, allCiudades };
}

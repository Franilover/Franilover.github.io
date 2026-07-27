"use client";

// ─── EntidadesLoreContext ──────────────────────────────────────────────────
// Antes, usePersonajes()/useReinos()/useCriaturas()/useItems()/useCiudades()
// se llamaban sueltos en 4-7 lugares distintos dentro del árbol del editor
// de capítulos (SelectorNarrador, NarradorPill, PanelPersonajesCapitulo,
// BarraLibro, etc). Cada llamada era un hook 100% independiente: su propio
// useState, su propio Dexie.toArray(), su propio fetch a Supabase.
//
// Como además `PanelEditor` se monta con `key={selectedCapId}` (se
// destruye y recrea completo al cambiar de capítulo), todo ese trabajo se
// repetía en cada cambio de capítulo — aunque el listado de personajes de
// un libro no cambia por eso.
//
// Este contexto centraliza la carga: se monta UNA vez en
// `EditorCapitulosPanel` (fuera del árbol que se remonta por capítulo) y
// expone los 5 listados + su loading combinado a través de `useEntidadesLore()`.

import { useContext, createContext, useMemo } from "react";

import { usePersonajes } from "@/hooks/useEditorShared";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import { useState, useEffect } from "react";

import { useReinos } from "@/domains/garlia/libros/capitulos/useCapitulosEditor";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CriaturaLore = { id: string; nombre: string; imagen_url?: string };
export type ItemLore = {
  id: string;
  nombre: string;
  imagen_url?: string;
  categoria?: string;
};
export type CiudadLore = {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  reino_id?: string | null;
};

type EntidadesLoreValue = {
  personajes: { id: string; nombre: string }[];
  criaturas: CriaturaLore[];
  items: ItemLore[];
  reinos: { id: string; nombre: string }[];
  ciudades: CiudadLore[];
  loading: boolean;
};

const EntidadesLoreContext = createContext<EntidadesLoreValue | null>(null);

// ─── Hooks internos de carga (Dexie-first, igual patrón que ya tenía cada uno) ──

function useCriaturasLore() {
  const [criaturas, setCriaturas] = useState<CriaturaLore[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      try {
        const table = (db as any)["criaturas"];
        if (table) {
          const local = await table.orderBy("nombre").toArray();
          if (local.length > 0) {
            setCriaturas(local);
            setLoading(false);
          }
        }
      } catch {}
      if (!navigator.onLine) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("criaturas")
          .select("id, nombre, imagen_url")
          .order("nombre");
        if (data) {
          setCriaturas(data as CriaturaLore[]);
          try {
            const table = (db as any)["criaturas"];
            if (table) await table.bulkPut(data);
          } catch {}
        }
      } catch {}
      setLoading(false);
    })();
  }, []);
  return { criaturas, loading };
}

function useItemsLore() {
  const [items, setItems] = useState<ItemLore[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      try {
        const table = (db as any)["items"];
        if (table) {
          const local = await table.orderBy("nombre").toArray();
          if (local.length > 0) {
            setItems(local);
            setLoading(false);
          }
        }
      } catch {}
      if (!navigator.onLine) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("items")
          .select("id, nombre, imagen_url, categoria")
          .order("nombre");
        if (data) {
          setItems(data as ItemLore[]);
          try {
            const table = (db as any)["items"];
            if (table) await table.bulkPut(data);
          } catch {}
        }
      } catch {}
      setLoading(false);
    })();
  }, []);
  return { items, loading };
}

function useCiudadesLore() {
  const [ciudades, setCiudades] = useState<CiudadLore[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      try {
        const table = (db as any)["ciudades"];
        if (table) {
          const local = await table.orderBy("nombre").toArray();
          if (local.length > 0) {
            setCiudades(local);
            setLoading(false);
          }
        }
      } catch {}
      if (!navigator.onLine) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("ciudades")
          .select("id, nombre, imagen_url, reino_id")
          .order("nombre");
        if (data) {
          setCiudades(data as CiudadLore[]);
          try {
            const table = (db as any)["ciudades"];
            if (table) await table.bulkPut(data);
          } catch {}
        }
      } catch {}
      setLoading(false);
    })();
  }, []);
  return { ciudades, loading };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function EntidadesLoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { personajes, loading: loadingP } = usePersonajes();
  const { criaturas, loading: loadingC } = useCriaturasLore();
  const { items, loading: loadingI } = useItemsLore();
  const { reinos, loading: loadingR } = useReinos();
  const { ciudades, loading: loadingCi } = useCiudadesLore();

  const value = useMemo<EntidadesLoreValue>(
    () => ({
      personajes,
      criaturas,
      items,
      reinos,
      ciudades,
      // "loading" combinado solo importa para el primer paint global;
      // cada consumidor puede seguir mostrando su propio spinner si
      // necesita distinguir cuál lista específica está cargando.
      loading: loadingP || loadingC || loadingI || loadingR || loadingCi,
    }),
    [
      personajes,
      criaturas,
      items,
      reinos,
      ciudades,
      loadingP,
      loadingC,
      loadingI,
      loadingR,
      loadingCi,
    ],
  );

  return (
    <EntidadesLoreContext.Provider value={value}>
      {children}
    </EntidadesLoreContext.Provider>
  );
}

// ─── Hook de consumo ──────────────────────────────────────────────────────
// Lanza un error explícito si se usa fuera del provider, en vez de devolver
// listas vacías silenciosamente — más fácil de detectar en desarrollo.
export function useEntidadesLore(): EntidadesLoreValue {
  const ctx = useContext(EntidadesLoreContext);
  if (!ctx) {
    throw new Error(
      "useEntidadesLore() usado fuera de <EntidadesLoreProvider>. Envolvé el árbol del editor de capítulos con el provider.",
    );
  }
  return ctx;
}

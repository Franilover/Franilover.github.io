/**
 * useGrupos.ts
 * ──────────────
 * Catálogo y fetching de grupos del mundo, extraído de EditorGrupo.tsx
 * (donde vivía mezclado con la UI). Incluye:
 *
 *   GrupoTipo, Grupo, EntidadMin  → tipos del dominio
 *   GRUPO_TIPO_CONFIG             → config estática por tipo (íconos, colores,
 *                                    tabla, sugerencias) — la usan tanto
 *                                    components/grupos/* como views/EditorGrupo
 *   useEntidades                  → catálogo de entidades de una tabla dada
 *                                    (usado por SelectorMiembros)
 *   useGrupos                     → CRUD de grupos_mundo con Supabase + Dexie
 *
 * Ruta destino:
 *   src/features/editorGarlia/hooks/useGrupos.ts
 */

import {
  Users,
  Bug,
  Package,
  Sparkles,
  Star,
  ScrollText,
  Map,
  UserCircle2,
  Swords,
  Wand2,
  Gem,
  Feather,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";
import {
  dexiePut,
  dexieDelete as dexieDel,
  dexieReadAll,
  dexieWriteAll,
} from "@/lib/utils/dexieHelpers";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type GrupoTipo =
  | "personajes"
  | "criaturas"
  | "items"
  | "reinos"
  | "hechizos"
  | "dones"
  | "runas"
  | "libros";

export type Grupo = {
  id: string;
  nombre: string;
  tipo: GrupoTipo;
  subtipo?: string | null;
  descripcion?: string | null;
  /** FK a dotes_dnd — solo aplica cuando subtipo="Trasfondo" (personajes de
   *  D&D, regla 2024): todo trasfondo otorga una dote de origen fija al
   *  elegirlo, no es una decisión del jugador. Antes era texto libre
   *  (dote_origen); ahora es una relación real contra el catálogo de dotes. */
  dote_origen_id?: string | null;
  /** Objeto de la dote ya resuelto por join, cuando la query lo trae
   *  (select ...  dote:dotes_dnd(id, nombre, descripcion)). Opcional porque
   *  no todos los fetchers de Grupo hacen ese join. */
  dote_origen?: { id: string; nombre: string; descripcion: string | null } | null;
  /** Reglas fijas de competencias — solo aplican cuando subtipo="Clase"
   *  (PHB 2024). salvaciones_clase: exactamente 2 salvaciones fijas que la
   *  clase otorga (ej. ['fuerza','constitucion']). habilidades_disponibles:
   *  lista corta de habilidades entre las que el jugador puede elegir.
   *  habilidades_a_elegir: cuántas de esa lista elige (2, 3 o 4). */
  salvaciones_clase?: string[] | null;
  habilidades_disponibles?: string[] | null;
  habilidades_a_elegir?: number | null;
  miembro_ids: string[];
  created_at?: string;
};

export type EntidadMin = {
  id: string;
  nombre: string;
  imagen_url?: string | null;
  img_url?: string | null;
  especie?: string;
  reino?: string;
  habitat?: string;
  categoria?: string;
};

// ─── Config de tipos de grupo ─────────────────────────────────────────────────
export const GRUPO_TIPO_CONFIG: Record<
  GrupoTipo,
  {
    label: string;
    labelPlural: string;
    Icon: React.ElementType;
    IconAlt: React.ElementType;
    color: string;
    tabla: string;
    ejemplo: string;
    sugerenciasDefault: string[];
  }
> = {
  personajes: {
    label: "Personaje",
    labelPlural: "Personajes",
    Icon: Users,
    IconAlt: UserCircle2,
    color: "var(--primary)",
    tabla: "personajes",
    ejemplo: "Familia, partido político, gremio…",
    sugerenciasDefault: [
      "Familia",
      "Partido político",
      "Agrupación",
      "Secta",
      "Gremio",
      "Clan",
      "Facción",
      "Orden",
      "Hermandad",
      "Tribu",
    ],
  },
  criaturas: {
    label: "Criatura",
    labelPlural: "Criaturas",
    Icon: Bug,
    IconAlt: Feather,
    color: "color-mix(in srgb, var(--primary) 70%, #4ade80)",
    tabla: "criaturas",
    ejemplo: "Manada, especie, bandada…",
    sugerenciasDefault: [
      "Manada",
      "Especie",
      "Bandada",
      "Colonia",
      "Horda",
      "Enjambre",
      "Orden",
      "Estirpe",
      "Clan",
      "Nidada",
    ],
  },
  items: {
    label: "Objeto",
    labelPlural: "Objetos",
    Icon: Package,
    IconAlt: Swords,
    color: "color-mix(in srgb, var(--primary) 60%, #f59e0b)",
    tabla: "items",
    ejemplo: "Arsenal, colección, reliquias…",
    sugerenciasDefault: [
      "Arsenal",
      "Colección",
      "Reliquias",
      "Juego de piezas",
      "Equipamiento",
      "Tesoro",
      "Set legendario",
      "Artefactos",
    ],
  },
  reinos: {
    label: "Reino",
    labelPlural: "Reinos",
    Icon: Map,
    IconAlt: Map,
    color: "color-mix(in srgb, var(--primary) 60%, #60a5fa)",
    tabla: "reinos",
    ejemplo: "Alianza, confederación, imperio…",
    sugerenciasDefault: [
      "Alianza",
      "Confederación",
      "Imperio",
      "Liga",
      "Pacto",
      "Unión",
      "Federación",
      "Coalición",
    ],
  },
  hechizos: {
    label: "Hechizo",
    labelPlural: "Hechizos",
    Icon: Sparkles,
    IconAlt: Wand2,
    color: "var(--accent)",
    tabla: "hechizos",
    ejemplo: "Escuela, elemento, estilo…",
    sugerenciasDefault: [
      "Escuela",
      "Elemento",
      "Estilo",
      "Tradición",
      "Arte arcano",
      "Linaje mágico",
      "Especialidad",
      "Corriente",
    ],
  },
  dones: {
    label: "Don",
    labelPlural: "Dones",
    Icon: Star,
    IconAlt: Gem,
    color: "color-mix(in srgb, var(--accent) 70%, var(--primary))",
    tabla: "dones",
    ejemplo: "Linaje, maldición, don ancestral…",
    sugerenciasDefault: [
      "Linaje",
      "Maldición",
      "Don ancestral",
      "Bendición",
      "Legado",
      "Herencia divina",
      "Pacto",
      "Señal",
    ],
  },
  runas: {
    label: "Runa",
    labelPlural: "Runas",
    Icon: ScrollText,
    IconAlt: ScrollText,
    color: "var(--primary)",
    tabla: "runas",
    ejemplo: "Conjunto rúnico, tradición…",
    sugerenciasDefault: [
      "Conjunto rúnico",
      "Tradición",
      "Sistema",
      "Alfabeto",
      "Escuela rúnica",
      "Legado",
      "Ciclo",
    ],
  },
  libros: {
    label: "Libro",
    labelPlural: "Libros",
    Icon: ScrollText,
    IconAlt: Feather,
    color: "color-mix(in srgb, var(--primary) 60%, #a78bfa)",
    tabla: "libros",
    ejemplo: "Novela, poemario, antología…",
    sugerenciasDefault: [
      "Novela",
      "Poemario",
      "Antología",
      "Cuento",
      "Relato",
      "Saga",
      "Serie",
      "Extra",
      "Spin-off",
      "Precuela",
    ],
  },
};

// ─── Hook: cargar entidades de una tabla ──────────────────────────────────────
export function useEntidades(tabla: string) {
  const [entidades, setEntidades] = useState<EntidadMin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tabla) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      let local = await dexieReadAll<EntidadMin>(tabla);
      // libros usa "titulo" en DB — normalizar si el caché tiene el campo crudo
      if (tabla === "libros") {
        local = local.map((r: any) =>
          r.nombre ? r : { ...r, nombre: r.titulo ?? "" },
        );
      }
      if (local.length && !cancelled) {
        setEntidades(local);
        setLoading(false);
      }
      if (!navigator.onLine) {
        if (!local.length) setLoading(false);
        return;
      }

      let result: EntidadMin[] = [];
      if (tabla === "personajes") {
        const { data } = await supabase
          .from("personajes")
          .select("id, nombre, img_url, especie, reino")
          .order("nombre");
        result = (data ?? []).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          img_url: r.img_url ?? undefined,
          especie: r.especie ?? undefined,
          reino: r.reino ?? undefined,
        }));
      } else if (tabla === "criaturas") {
        const { data } = await supabase
          .from("criaturas")
          .select("id, nombre, imagen_url, habitat")
          .order("nombre");
        result = (data ?? []).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          imagen_url: r.imagen_url ?? undefined,
          habitat: r.habitat ?? undefined,
        }));
      } else if (tabla === "items") {
        const { data } = await supabase
          .from("items")
          .select("id, nombre, imagen_url, categoria")
          .order("nombre");
        result = (data ?? []).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          imagen_url: r.imagen_url ?? undefined,
          categoria: r.categoria ?? undefined,
        }));
      } else if (tabla === "reinos") {
        const { data } = await supabase
          .from("reinos")
          .select("id, nombre")
          .order("nombre");
        result = (data ?? []).map((r: any) => ({ id: r.id, nombre: r.nombre }));
      } else if (tabla === "libros") {
        const { data } = await supabase
          .from("libros")
          .select("id, titulo, portada_url, categoria")
          .order("titulo");
        result = (data ?? []).map((r: any) => ({
          id: r.id,
          nombre: r.titulo,
          imagen_url: r.portada_url ?? undefined,
          categoria: r.categoria ?? undefined,
        }));
      } else {
        const { data } = await (supabase.from(tabla as any) as any)
          .select("id, nombre, imagen_url")
          .order("nombre");
        result = (data ?? []).map((r: any) => ({
          id: r.id,
          nombre: r.nombre,
          imagen_url: r.imagen_url ?? undefined,
        }));
      }

      if (cancelled) return;
      setEntidades(result);
      setLoading(false);
      await dexieWriteAll(tabla, result);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tabla]);

  return { entidades, loading };
}

// ─── Hook: grupos con Supabase + Dexie ───────────────────────────────────────
export function useGrupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const local = await dexieReadAll<Grupo>("grupos_mundo");
    if (local.length) {
      setGrupos(local);
      setLoaded(true);
    }

    if (!navigator.onLine) {
      if (!local.length) setLoaded(true);
      return;
    }

    const { data, error } = await supabase
      .from("grupos_mundo")
      .select("*, dote_origen:dotes_dnd(id, nombre, descripcion)")
      .order("created_at", { ascending: false });
    if (error) {
      if (!local.length) setLoaded(true);
      return;
    }

    const result = (data ?? []).map((r: any) => ({
      ...r,
      miembro_ids: r.miembro_ids ?? [],
    })) as Grupo[];

    setGrupos(result);
    setLoaded(true);
    await dexieWriteAll("grupos_mundo", result);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crearGrupo = useCallback(
    async (tipo: GrupoTipo): Promise<Grupo | null> => {
      const cfg = GRUPO_TIPO_CONFIG[tipo];
      const optimista: Grupo = {
        id: crypto.randomUUID(),
        nombre: `Nuevo ${cfg.label.toLowerCase()}`,
        tipo,
        subtipo: null,
        descripcion: null,
        dote_origen_id: null,
        dote_origen: null,
        salvaciones_clase: null,
        habilidades_disponibles: null,
        habilidades_a_elegir: null,
        miembro_ids: [],
        created_at: new Date().toISOString(),
      };

      setGrupos((prev) => [optimista, ...prev]);
      void dexiePut("grupos_mundo", optimista);

      const { data, error } = await supabase
        .from("grupos_mundo")
        .insert([
          {
            id: optimista.id,
            nombre: optimista.nombre,
            tipo,
            subtipo: null,
            descripcion: null,
            dote_origen_id: null,
            salvaciones_clase: null,
            habilidades_disponibles: null,
            habilidades_a_elegir: null,
            miembro_ids: [],
          },
        ])
        .select(
          "*, dote_origen:dotes_dnd(id, nombre, descripcion), salvaciones_clase, habilidades_disponibles, habilidades_a_elegir",
        )
        .single();

      if (error || !data) return optimista;
      const real = { ...data, miembro_ids: data.miembro_ids ?? [] } as Grupo;
      setGrupos((prev) => prev.map((g) => (g.id === optimista.id ? real : g)));
      void dexiePut("grupos_mundo", real);
      return real;
    },
    [],
  );

  const actualizarGrupo = useCallback(async (updated: Grupo): Promise<void> => {
    setGrupos((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    void dexiePut("grupos_mundo", updated);

    await supabase
      .from("grupos_mundo")
      .update({
        nombre: updated.nombre,
        tipo: updated.tipo,
        subtipo: updated.subtipo ?? null,
        descripcion: updated.descripcion ?? null,
        dote_origen_id: updated.dote_origen_id ?? null,
        salvaciones_clase: updated.salvaciones_clase ?? null,
        habilidades_disponibles: updated.habilidades_disponibles ?? null,
        habilidades_a_elegir: updated.habilidades_a_elegir ?? null,
        miembro_ids: updated.miembro_ids,
      })
      .eq("id", updated.id);
  }, []);

  const eliminarGrupo = useCallback(async (id: string): Promise<void> => {
    setGrupos((prev) => prev.filter((g) => g.id !== id));
    void dexieDel("grupos_mundo", id);
    await supabase.from("grupos_mundo").delete().eq("id", id);
  }, []);

  return { grupos, loaded, crearGrupo, actualizarGrupo, eliminarGrupo };
}

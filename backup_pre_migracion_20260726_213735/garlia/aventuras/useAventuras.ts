"use client";

/**
 * useAventuras
 * ───────────────────────────────────────────────────────────────────────────
 * CRUD ligero para el sistema de "Aventuras" (aventuras + aventura_entidades).
 * No usa el motor offline-first (useSupabaseData/Dexie) a propósito: son
 * datos de sesión en vivo, pequeños, y no necesitan cola offline. Usa el
 * cliente de Supabase directo + un canal realtime propio por tabla.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";
import type { CriaturaStatsDnd } from "@/domains/garlia/criaturas/model";

export interface Aventura {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  created_at: string;
  updated_at: string;
  /** Si está activo, el jugador ve niebla de guerra con line-of-sight real
   *  contra aventura_obstaculos (lo nunca visto en negro, lo explorado
   *  antes pero no visible ahora en gris). El DM siempre ve todo el
   *  tablero completo, sin niebla, sin importar este valor. */
  niebla_activa: boolean;
}

export type TablaEntidad =
  | "personajes"
  | "criaturas"
  | "items"
  | "reinos"
  | "ciudades"
  | "hechizos"
  | "dones"
  | "runas"
  | "fichas_dnd";

export const TABLA_LABEL: Record<TablaEntidad, { singular: string; plural: string }> = {
  personajes: { singular: "Personaje", plural: "Personajes" },
  criaturas: { singular: "Criatura", plural: "Criaturas" },
  items: { singular: "Objeto", plural: "Objetos" },
  reinos: { singular: "Reino", plural: "Reinos" },
  ciudades: { singular: "Ciudad", plural: "Ciudades" },
  hechizos: { singular: "Hechizo", plural: "Hechizos" },
  dones: { singular: "Don", plural: "Dones" },
  runas: { singular: "Runa", plural: "Runas" },
  fichas_dnd: { singular: "Ficha de Jugador", plural: "Fichas de Jugadores" },
};

export const TABLAS_ENTIDAD: TablaEntidad[] = [
  "personajes",
  "criaturas",
  "items",
  "reinos",
  "ciudades",
  "hechizos",
  "dones",
  "runas",
  "fichas_dnd",
];

export interface AventuraEntidadRow {
  id: string;
  aventura_id: string;
  tabla: TablaEntidad;
  entidad_id: string;
  publicado: boolean;
  publicado_at: string | null;
  created_at: string;
  pos_x: number | null;
  pos_y: number | null;
  /** Agrupa varias criaturas de esta aventura en una "horda"/grupo (ej.
   *  "Horda de goblins"): todas las filas con el mismo nombre (case-
   *  insensitive, comparado ya trimeado) se consideran del mismo grupo.
   *  Solo tiene sentido para tabla === "criaturas" — no se usa en el resto.
   *  Null/vacío = criatura suelta, sin grupo. Es texto libre (no un id a
   *  otra tabla) a propósito: no hace falta gestionar una tabla aparte
   *  para algo tan simple como una etiqueta compartida. */
  grupo_nombre: string | null;
  /** Tamaño custom en px lógicos del tablero (no escalados por zoom).
   *  Null = usa el tamaño estándar de tarjeta (TABLERO_CARD_SIZE). Pensado
   *  sobre todo para reinos ("agrandar/achicar" el bloque), pero cualquier
   *  entidad puede tener tamaño propio. */
  ancho: number | null;
  alto: number | null;
  /** Si está seteado, esta fila se considera "dentro" del reino/entidad
   *  con ese id (otra fila de aventura_entidades) — se arma soltando una
   *  tarjeta encima de otra en el pizarrón. Null = suelta, sin contenedor. */
  contenedor_id: string | null;
}

/** Fila resuelta: la relación + los datos legibles de la entidad original. */
export interface AventuraEntidad extends AventuraEntidadRow {
  nombre: string;
  imagen_url: string | null;
  descripcion: string | null;
  /** Solo presente cuando tabla === "criaturas": su ficha de combate D&D
   *  2024 (CA/HP/stats/acciones…) tal cual la cargó el DM en el editor.
   *  Null si la criatura todavía no tiene stat block. */
  stats_dnd?: CriaturaStatsDnd | null;
}

// ── Lista de aventuras (para el índice admin y el selector público) ────────

export function useAventurasList() {
  const [aventuras, setAventuras] = useState<Aventura[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from("aventuras")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && data) setAventuras(data as Aventura[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("aventuras-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "aventuras" }, () => {
        fetchAll();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const crear = useCallback(async (nombre: string, descripcion?: string) => {
    const { data, error } = await supabase
      .from("aventuras")
      .insert({ nombre, descripcion: descripcion || null })
      .select()
      .single();
    if (error) throw error;
    return data as Aventura;
  }, []);

  const renombrar = useCallback(async (id: string, nombre: string) => {
    const { error } = await supabase.from("aventuras").update({ nombre }).eq("id", id);
    if (error) throw error;
  }, []);

  const eliminar = useCallback(async (id: string) => {
    const { error } = await supabase.from("aventuras").delete().eq("id", id);
    if (error) throw error;
  }, []);

  /** Prende/apaga la niebla de guerra para una aventura. Solo afecta la
   *  vista del jugador — el DM sigue viendo todo siempre. Optimista +
   *  persistido, mismo patrón que el resto de los toggles del módulo. */
  const toggleNiebla = useCallback(
    async (id: string, activa: boolean) => {
      const anterior = aventuras;
      setAventuras((prev) =>
        prev.map((a) => (a.id === id ? { ...a, niebla_activa: activa } : a)),
      );
      const { error } = await supabase
        .from("aventuras")
        .update({ niebla_activa: activa })
        .eq("id", id);
      if (error) {
        setAventuras(anterior);
        throw error;
      }
    },
    [aventuras],
  );

  return { aventuras, loading, crear, renombrar, eliminar, toggleNiebla, refetch: fetchAll };
}

// ── Entidades de UNA aventura, resueltas contra sus tablas de origen ──────

const NOMBRE_COL = "nombre";

// Algunas tablas no usan "imagen_url" como nombre de columna; se mapea aquí
// para no romper el select ni perder la imagen (personajes usa img_url,
// reinos usa logo_url).
const COLUMNA_IMAGEN: Partial<Record<TablaEntidad, string>> = {
  personajes: "img_url",
  reinos: "logo_url",
};

async function resolverEntidades(
  rows: AventuraEntidadRow[],
): Promise<AventuraEntidad[]> {
  if (rows.length === 0) return [];

  const porTabla = new Map<TablaEntidad, string[]>();
  for (const r of rows) {
    const list = porTabla.get(r.tabla) ?? [];
    list.push(r.entidad_id);
    porTabla.set(r.tabla, list);
  }

  const datosPorTablaId = new Map<
    string,
    { nombre: string; imagen_url: string | null; descripcion: string | null; stats_dnd: CriaturaStatsDnd | null }
  >();

  // Para fichas_dnd necesitamos resolver especie_id -> nombre de la criatura
  const fichasRows = await Promise.all(
    Array.from(porTabla.entries()).map(async ([tabla, ids]) => {
      const { data } = await supabase.from(tabla).select("*").in("id", ids);
      return { tabla, data: data ?? [] };
    }),
  );

  const especieIds = Array.from(
    new Set(
      fichasRows
        .filter((r) => r.tabla === "fichas_dnd")
        .flatMap((r) => r.data.map((row: any) => row.especie_id))
        .filter(Boolean),
    ),
  ) as string[];

  const especiesPorId = new Map<string, string>();
  if (especieIds.length > 0) {
    const { data: especiesData } = await supabase
      .from("criaturas")
      .select("id, nombre")
      .in("id", especieIds);
    (especiesData ?? []).forEach((e: any) => especiesPorId.set(e.id, e.nombre));
  }

  fichasRows.forEach(({ tabla, data }) => {
    data.forEach((row: any) => {
      const descripcionBase =
        tabla === "fichas_dnd"
          ? [
              row.especie_id ? especiesPorId.get(row.especie_id) : null,
              row.clase,
              row.nivel ? `Nivel ${row.nivel}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : row.descripcion ?? row.explicacion ?? null;
      datosPorTablaId.set(`${tabla}:${row.id}`, {
        nombre: row[NOMBRE_COL] ?? "Sin nombre",
        imagen_url: row[COLUMNA_IMAGEN[tabla as TablaEntidad] ?? "imagen_url"] ?? null,
        descripcion: descripcionBase,
        stats_dnd: tabla === "criaturas" ? row.stats_dnd ?? null : null,
      });
    });
  });

  return rows.map((r) => {
    const info = datosPorTablaId.get(`${r.tabla}:${r.entidad_id}`);
    return {
      ...r,
      nombre: info?.nombre ?? "(entidad eliminada)",
      imagen_url: info?.imagen_url ?? null,
      descripcion: info?.descripcion ?? null,
      stats_dnd: info?.stats_dnd ?? null,
    };
  });
}

export function useAventuraEntidades(aventuraId: string | null) {
  const [entidades, setEntidades] = useState<AventuraEntidad[]>([]);
  const [loading, setLoading] = useState(true);
  const aventuraIdRef = useRef(aventuraId);
  aventuraIdRef.current = aventuraId;

  // ── Guard anti-"rebote" de posición ────────────────────────────────────
  // moverPosicion es optimista: actualiza `entidades` al instante y recién
  // después persiste. El problema es que CUALQUIER cambio en la tabla
  // (incluido nuestro propio UPDATE) dispara el listener de realtime, que
  // llama a fetchAll y REEMPLAZA todo el array con lo que devuelve la DB.
  // Si ese fetch fue disparado por un evento viejo, o llega desordenado
  // respecto a un segundo move que ya se hizo mientras tanto, el fetch
  // puede pisar momentáneamente la posición optimista con una posición
  // vieja — y un instante después el fetch "bueno" la vuelve a corregir.
  // Eso es exactamente el efecto de "se mueve, retrocede, y vuelve a
  // moverse" que se veía al arrastrar.
  //
  // La solución: cada vez que se hace un move optimista se anota acá
  // (id -> {x, y, t}), con timestamp. Cuando llega un fetchAll, por cada
  // fila se compara: si hay un pendiente reciente (dentro de la ventana
  // de gracia) para ese id, se conserva la posición optimista en vez de
  // pisarla con la de la DB — así ningún fetch desordenado puede hacer
  // "rebotar" visualmente una tarjeta que el usuario acaba de soltar. El
  // pendiente se limpia solo (por vencimiento) para no quedar bloqueando
  // updates ajenos (de otro jugador/DM) para siempre.
  const posicionesPendientes = useRef(new Map<string, { x: number; y: number; t: number }>());
  const GRACIA_MS = 4000;

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!aventuraIdRef.current) {
      setEntidades([]);
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    const { data, error } = await supabase
      .from("aventura_entidades")
      .select("*")
      .eq("aventura_id", aventuraIdRef.current)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const resueltas = await resolverEntidades(data as AventuraEntidadRow[]);
      const ahora = Date.now();
      const pendientes = posicionesPendientes.current;
      const conGuard = resueltas.map((e) => {
        const pendiente = pendientes.get(e.id);
        if (!pendiente) return e;
        if (ahora - pendiente.t > GRACIA_MS) {
          // Venció la ventana de gracia (ya se persistió hace rato, o el
          // request falló silenciosamente): se descarta el guard y se usa
          // el valor real de la DB.
          pendientes.delete(e.id);
          return e;
        }
        // Todavía dentro de la ventana: preferimos nuestra posición
        // optimista sobre la que trajo este fetch en particular.
        return { ...e, pos_x: pendiente.x, pos_y: pendiente.y };
      });
      setEntidades(conGuard);
    }
    if (!opts?.silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    if (!aventuraId) return;

    // Ráfagas de eventos (varios movimientos seguidos, o una horda que se
    // agrega de una) se juntan en un solo fetchAll en vez de uno por
    // evento — si no, WASD mantenido dispara un refetch completo del
    // tablero por cada celda, y ESE refetch (no el movimiento en sí) es lo
    // que se sentía como tirones/saltos.
    let fetchTimer: ReturnType<typeof setTimeout> | null = null;
    const fetchDebounced = () => {
      if (fetchTimer) clearTimeout(fetchTimer);
      fetchTimer = setTimeout(() => fetchAll({ silent: true }), 120);
    };

    const channel = supabase
      .channel(`aventura-entidades-${aventuraId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aventura_entidades", filter: `aventura_id=eq.${aventuraId}` },
        (payload) => {
          // Si el cambio es exactamente nuestro propio movimiento
          // optimista (mismo id, misma posición que ya pusimos en pantalla
          // hace un instante), no hace falta re-pedir todo el tablero: ya
          // estamos mostrando ese valor. Esto es lo que evita el refetch
          // pesado (trae todas las entidades + re-resuelve nombre/imagen
          // de cada una) en cada paso de WASD.
          const fila = payload.new as { id?: string; pos_x?: number | null; pos_y?: number | null } | null;
          const pendiente = fila?.id ? posicionesPendientes.current.get(fila.id) : undefined;
          if (
            pendiente &&
            fila &&
            fila.pos_x === pendiente.x &&
            fila.pos_y === pendiente.y
          ) {
            return;
          }
          fetchDebounced();
        },
      )
      .subscribe((status, err) => {
        // Diagnóstico: si el canal no llega a "SUBSCRIBED", el realtime no
        // va a funcionar aunque el resto del código esté bien. Las causas
        // más comunes son: la tabla no está en la publicación
        // `supabase_realtime`, o RLS bloquea el SELECT para el rol
        // autenticado/anon en esta tabla.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // eslint-disable-next-line no-console
          console.error(
            `[aventura_entidades] Realtime no se pudo suscribir (status: ${status}). ` +
              `Revisa que la tabla esté agregada a la publicación "supabase_realtime" ` +
              `y que las políticas RLS permitan SELECT.`,
            err,
          );
        }
      });
    return () => {
      if (fetchTimer) clearTimeout(fetchTimer);
      supabase.removeChannel(channel);
    };
  }, [aventuraId, fetchAll]);

  // ── Realtime de los DATOS de cada entidad (no de la relación): si el DM
  // edita una criatura/personaje/ítem ya presente en este tablero — por
  // ejemplo, carga su ficha de combate D&D 2024 — el jugador lo ve
  // reflejado sin recargar la página. Se suscribe una vez por cada tabla
  // que realmente esté en uso en este tablero (no a las 9 tablas siempre),
  // y usa un ref con los ids vigentes para no tener que resuscribirse cada
  // vez que cambia el contenido de `entidades`. ──
  const entidadesRef = useRef(entidades);
  entidadesRef.current = entidades;
  const tablasEnUso = Array.from(new Set(entidades.map((e) => e.tabla))).sort().join(",");

  useEffect(() => {
    if (!aventuraId || !tablasEnUso) return;
    const tablas = tablasEnUso.split(",") as TablaEntidad[];
    const channels = tablas.map((tabla) =>
      supabase
        .channel(`aventura-datos-${aventuraId}-${tabla}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: tabla },
          (payload) => {
            const idCambiado = (payload.new as any)?.id ?? (payload.old as any)?.id;
            if (!idCambiado) return;
            const nosImporta = entidadesRef.current.some(
              (e) => e.tabla === tabla && e.entidad_id === idCambiado,
            );
            if (nosImporta) fetchAll({ silent: true });
          },
        )
        .subscribe(),
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [aventuraId, tablasEnUso, fetchAll]);

  const agregar = useCallback(
    async (tabla: TablaEntidad, entidadId: string, nombreEntidad?: string) => {
      if (!aventuraId) return;
      // Solo "criaturas" se puede agregar más de una vez a propósito: así
      // el DM arma una horda de varios goblins idénticos con un solo click
      // repetido, sin tener que crear una fila distinta en la tabla
      // `criaturas` por cada miembro. El resto de tablas (personajes,
      // reinos, fichas...) no tiene sentido duplicarlas en el mismo
      // pizarrón, así que ahí se mantiene el guard de siempre.
      const yaExiste = entidades.some((e) => e.tabla === tabla && e.entidad_id === entidadId);
      if (tabla !== "criaturas" && yaExiste) return;

      // Si ya había una copia de esta criatura sin agrupar, la nueva
      // heredá su grupo_nombre (o, si tampoco tenía, se arma un grupo
      // nuevo con el nombre de la criatura) — así las dos copias quedan
      // juntas como horda automáticamente en vez de aparecer sueltas y
      // requerir que el DM las agrupe a mano.
      let grupoInicial: string | null = null;
      if (tabla === "criaturas" && yaExiste) {
        const copiaPrevia = entidades.find((e) => e.tabla === tabla && e.entidad_id === entidadId);
        grupoInicial = copiaPrevia?.grupo_nombre ?? nombreEntidad ?? copiaPrevia?.nombre ?? null;
        // La copia previa todavía no tenía grupo asignado: se le asigna
        // ahora mismo (mismo nombre que a la nueva) para que las dos
        // queden del mismo lado del agrupamiento.
        if (copiaPrevia && !copiaPrevia.grupo_nombre && grupoInicial) {
          setEntidades((prev) =>
            prev.map((e) => (e.id === copiaPrevia.id ? { ...e, grupo_nombre: grupoInicial } : e)),
          );
          void supabase
            .from("aventura_entidades")
            .update({ grupo_nombre: grupoInicial })
            .eq("id", copiaPrevia.id);
        }
      }

      const { data, error } = await supabase
        .from("aventura_entidades")
        .insert({
          aventura_id: aventuraId,
          tabla,
          entidad_id: entidadId,
          ...(grupoInicial ? { grupo_nombre: grupoInicial } : {}),
        })
        .select()
        .single();

      if (error) {
        // Conflicto de unicidad (carrera): la fila ya existe, no es un
        // error real — salvo para criaturas, donde SÍ pueden (y deben)
        // convivir varias filas iguales, así que ahí un 23505 indica que
        // la constraint vieja de la base todavía no se actualizó (ver
        // migration_hordas_criaturas.sql) y conviene que se note.
        if (error.code === "23505" && tabla !== "criaturas") return;
        throw error;
      }

      // Optimista: inserta la fila resuelta al instante, sin esperar el
      // realtime ni un refetch completo.
      if (data) {
        const [resuelta] = await resolverEntidades([data as AventuraEntidadRow]);
        if (resuelta) {
          setEntidades((prev) => [resuelta, ...prev]);
        }
      }
    },
    [aventuraId, entidades],
  );

  const quitar = useCallback(async (relacionId: string) => {
    // Optimista: la quita de la lista al instante; si falla, se restaura.
    const anterior = entidades;
    setEntidades((prev) => prev.filter((e) => e.id !== relacionId));
    const { error } = await supabase.from("aventura_entidades").delete().eq("id", relacionId);
    if (error) {
      setEntidades(anterior);
      throw error;
    }
  }, [entidades]);

  /** Mueve un item en el tablero libre (pizarrón). Optimista + persistido.
   *  Registra la posición en `posicionesPendientes` (ver comentario arriba
   *  de fetchAll) para que un realtime desordenado no la haga rebotar. */
  const moverPosicion = useCallback(async (relacionId: string, posX: number, posY: number) => {
    posicionesPendientes.current.set(relacionId, { x: posX, y: posY, t: Date.now() });
    const anterior = entidadesRef.current;
    setEntidades((prev) =>
      prev.map((e) => (e.id === relacionId ? { ...e, pos_x: posX, pos_y: posY } : e)),
    );
    const { error } = await supabase
      .from("aventura_entidades")
      .update({ pos_x: posX, pos_y: posY })
      .eq("id", relacionId);
    if (error) {
      posicionesPendientes.current.delete(relacionId);
      setEntidades(anterior);
      throw error;
    }
    // Persistido con éxito: ya no hace falta seguir protegiendo esta
    // posición contra fetches — cualquier fetch nuevo va a traer este
    // mismo valor de la DB de todos modos.
    posicionesPendientes.current.delete(relacionId);
  }, []);

  /** Asigna (o quita, si nombre es null/vacío) el grupo/horda de una
   *  criatura. Optimista + persistido, mismo patrón que moverPosicion. */
  const asignarGrupo = useCallback(
    async (relacionId: string, nombreGrupo: string | null) => {
      const anterior = entidades;
      const limpio = nombreGrupo?.trim() || null;
      setEntidades((prev) =>
        prev.map((e) => (e.id === relacionId ? { ...e, grupo_nombre: limpio } : e)),
      );
      const { error } = await supabase
        .from("aventura_entidades")
        .update({ grupo_nombre: limpio })
        .eq("id", relacionId);
      if (error) {
        setEntidades(anterior);
        throw error;
      }
    },
    [entidades],
  );

  /** Cambia el tamaño custom (ancho/alto en px lógicos) de una tarjeta del
   *  pizarrón. Pasar null en ambos vuelve al tamaño estándar. Optimista +
   *  persistido, mismo patrón que moverPosicion. */
  const redimensionar = useCallback(
    async (relacionId: string, ancho: number | null, alto: number | null) => {
      const anterior = entidades;
      setEntidades((prev) =>
        prev.map((e) => (e.id === relacionId ? { ...e, ancho, alto } : e)),
      );
      const { error } = await supabase
        .from("aventura_entidades")
        .update({ ancho, alto })
        .eq("id", relacionId);
      if (error) {
        setEntidades(anterior);
        throw error;
      }
    },
    [entidades],
  );

  /** Marca (o quita, con null) una entidad como "contenida dentro" de otra
   *  fila del pizarrón — típicamente un personaje/criatura soltado dentro
   *  de un reino. Optimista + persistido. No permite que una fila se
   *  contenga a sí misma. */
  const asignarContenedor = useCallback(
    async (relacionId: string, contenedorId: string | null) => {
      if (contenedorId === relacionId) return;
      const anterior = entidades;
      setEntidades((prev) =>
        prev.map((e) => (e.id === relacionId ? { ...e, contenedor_id: contenedorId } : e)),
      );
      const { error } = await supabase
        .from("aventura_entidades")
        .update({ contenedor_id: contenedorId })
        .eq("id", relacionId);
      if (error) {
        setEntidades(anterior);
        throw error;
      }
    },
    [entidades],
  );

  const togglePublicado = useCallback(async (relacion: AventuraEntidad) => {
    const nuevoValor = !relacion.publicado;
    const nuevoPublicadoAt = nuevoValor ? new Date().toISOString() : null;

    // Optimista: refleja el toggle al instante en la UI del DM.
    setEntidades((prev) =>
      prev.map((e) =>
        e.id === relacion.id ? { ...e, publicado: nuevoValor, publicado_at: nuevoPublicadoAt } : e,
      ),
    );

    const { error } = await supabase
      .from("aventura_entidades")
      .update({ publicado: nuevoValor, publicado_at: nuevoPublicadoAt })
      .eq("id", relacion.id);

    if (error) {
      // Revierte si falló en el servidor
      setEntidades((prev) =>
        prev.map((e) =>
          e.id === relacion.id
            ? { ...e, publicado: relacion.publicado, publicado_at: relacion.publicado_at }
            : e,
        ),
      );
      throw error;
    }
  }, []);

  return {
    entidades,
    loading,
    agregar,
    quitar,
    togglePublicado,
    moverPosicion,
    asignarGrupo,
    redimensionar,
    asignarContenedor,
    refetch: fetchAll,
  };
}

// ── Búsqueda de entidades (todas las tablas) para agregar a una aventura ──

export interface ResultadoBusqueda {
  tabla: TablaEntidad;
  id: string;
  nombre: string;
  imagen_url: string | null;
}

export async function buscarEntidades(query: string): Promise<ResultadoBusqueda[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const resultados = await Promise.all(
    TABLAS_ENTIDAD.map(async (tabla) => {
      const { data, error } = await supabase
        .from(tabla)
        .select("*")
        .ilike("nombre", `%${q}%`)
        .limit(8);
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`buscarEntidades: error en tabla "${tabla}"`, error);
        return [];
      }
      const colImagen = COLUMNA_IMAGEN[tabla] ?? "imagen_url";
      return (data ?? []).map((row: any) => ({
        tabla,
        id: row.id,
        nombre: row.nombre,
        imagen_url: row[colImagen] ?? null,
      }));
    }),
  );

  return resultados.flat();
}

// ── Obstáculos (paredes/ríos/bosques) de una aventura ─────────────────────

export type ObstaculoTipo = "pared" | "rio" | "bosque";
export type ObstaculoForma = "rect" | "circulo";

export const OBSTACULO_LABEL: Record<ObstaculoTipo, string> = {
  pared: "Pared",
  rio: "Río",
  bosque: "Bosque",
};

export interface AventuraObstaculo {
  id: string;
  aventura_id: string;
  tipo: ObstaculoTipo;
  forma: ObstaculoForma;
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
  /** Si es false, es puramente decorativo: no bloquea line-of-sight. */
  bloquea_vision: boolean;
  created_at: string;
}

const OBSTACULO_DEFAULT = { ancho: 160, alto: 120 };

/** CRUD + realtime de los obstáculos de una aventura. Mismo patrón que
 *  useAventuraEntidades: fetch inicial + canal realtime + updates
 *  optimistas persistidos en Supabase. */
export function useAventuraObstaculos(aventuraId: string | null) {
  const [obstaculos, setObstaculos] = useState<AventuraObstaculo[]>([]);
  const [loading, setLoading] = useState(true);
  const aventuraIdRef = useRef(aventuraId);
  aventuraIdRef.current = aventuraId;

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!aventuraIdRef.current) {
      setObstaculos([]);
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    const { data, error } = await supabase
      .from("aventura_obstaculos")
      .select("*")
      .eq("aventura_id", aventuraIdRef.current)
      .order("created_at", { ascending: true });
    if (!error && data) setObstaculos(data as AventuraObstaculo[]);
    if (!opts?.silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    if (!aventuraId) return;
    const channel = supabase
      .channel(`aventura-obstaculos-${aventuraId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aventura_obstaculos", filter: `aventura_id=eq.${aventuraId}` },
        () => fetchAll({ silent: true }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [aventuraId, fetchAll]);

  const agregar = useCallback(
    async (tipo: ObstaculoTipo, forma: ObstaculoForma, x: number, y: number, bloqueaVision = true) => {
      if (!aventuraId) return;
      const { data, error } = await supabase
        .from("aventura_obstaculos")
        .insert({
          aventura_id: aventuraId,
          tipo,
          forma,
          pos_x: Math.round(x),
          pos_y: Math.round(y),
          ancho: OBSTACULO_DEFAULT.ancho,
          alto: OBSTACULO_DEFAULT.alto,
          bloquea_vision: bloqueaVision,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) setObstaculos((prev) => [...prev, data as AventuraObstaculo]);
    },
    [aventuraId],
  );

  const mover = useCallback(async (id: string, x: number, y: number) => {
    const anterior = obstaculos;
    setObstaculos((prev) => prev.map((o) => (o.id === id ? { ...o, pos_x: x, pos_y: y } : o)));
    const { error } = await supabase
      .from("aventura_obstaculos")
      .update({ pos_x: x, pos_y: y })
      .eq("id", id);
    if (error) {
      setObstaculos(anterior);
      throw error;
    }
  }, [obstaculos]);

  const redimensionar = useCallback(async (id: string, ancho: number, alto: number) => {
    const anterior = obstaculos;
    setObstaculos((prev) => prev.map((o) => (o.id === id ? { ...o, ancho, alto } : o)));
    const { error } = await supabase
      .from("aventura_obstaculos")
      .update({ ancho, alto })
      .eq("id", id);
    if (error) {
      setObstaculos(anterior);
      throw error;
    }
  }, [obstaculos]);

  const eliminar = useCallback(async (id: string) => {
    const anterior = obstaculos;
    setObstaculos((prev) => prev.filter((o) => o.id !== id));
    const { error } = await supabase.from("aventura_obstaculos").delete().eq("id", id);
    if (error) {
      setObstaculos(anterior);
      throw error;
    }
  }, [obstaculos]);

  const toggleBloqueaVision = useCallback(async (id: string, bloquea: boolean) => {
    const anterior = obstaculos;
    setObstaculos((prev) => prev.map((o) => (o.id === id ? { ...o, bloquea_vision: bloquea } : o)));
    const { error } = await supabase
      .from("aventura_obstaculos")
      .update({ bloquea_vision: bloquea })
      .eq("id", id);
    if (error) {
      setObstaculos(anterior);
      throw error;
    }
  }, [obstaculos]);

  return { obstaculos, loading, agregar, mover, redimensionar, eliminar, toggleBloqueaVision, refetch: fetchAll };
}

// ── Memoria de exploración (niebla de guerra) de UN jugador en una aventura ─

/** Persiste y trae las celdas de grilla ya vistas alguna vez por la ficha
 *  (fichaId, la ficha_dnd del jugador — no el id de la relación en
 *  aventura_entidades) de un jugador. Guardado como una fila por celda
 *  (aventura_id, ficha_id, celda_x, celda_y), así calza con la tabla
 *  aventura_exploracion tal como ya existe en la base. */
export function useAventuraExploracion(aventuraId: string | null, fichaId: string | null) {
  const [celdasVistas, setCeldasVistas] = useState<Set<string>>(new Set());
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    setCargado(false);
    if (!aventuraId || !fichaId) {
      setCeldasVistas(new Set());
      setCargado(true);
      return;
    }
    let cancelado = false;
    supabase
      .from("aventura_exploracion")
      .select("celda_x, celda_y")
      .eq("aventura_id", aventuraId)
      .eq("ficha_id", fichaId)
      .then(({ data }) => {
        if (cancelado) return;
        const celdas = (data ?? []).map((r: any) => `${r.celda_x},${r.celda_y}`);
        setCeldasVistas(new Set(celdas));
        setCargado(true);
      });
    return () => {
      cancelado = true;
    };
  }, [aventuraId, fichaId]);

  /** Agrega celdas nuevas a la memoria (unión, no reemplazo) e inserta
   *  solo las filas realmente nuevas — el conflicto de unicidad
   *  (aventura_id, ficha_id, celda_x, celda_y) se ignora si por alguna
   *  carrera ya existiera. Debe llamarse con el conjunto ENTERO de celdas
   *  visibles ahora mismo (no solo el delta); el hook calcula qué es
   *  nuevo antes de pegarle a la base. */
  const registrarVisibles = useCallback(
    (celdas: string[]) => {
      if (!aventuraId || !fichaId || celdas.length === 0) return;
      setCeldasVistas((prev) => {
        const nuevas = celdas.filter((c) => !prev.has(c));
        if (nuevas.length === 0) return prev;
        const next = new Set(prev);
        nuevas.forEach((c) => next.add(c));
        const filas = nuevas.map((c) => {
          const [celda_x, celda_y] = c.split(",").map(Number);
          return { aventura_id: aventuraId, ficha_id: fichaId, celda_x, celda_y };
        });
        supabase
          .from("aventura_exploracion")
          .upsert(filas, {
            onConflict: "aventura_id,ficha_id,celda_x,celda_y",
            ignoreDuplicates: true,
          })
          .then(() => {});
        return next;
      });
    },
    [aventuraId, fichaId],
  );

  return { celdasVistas, cargado, registrarVisibles };
}

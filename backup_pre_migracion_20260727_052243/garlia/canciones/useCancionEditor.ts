"use client";

import { useState, useEffect, useCallback } from "react";

import { db } from "@/lib/api/client/db";
import { cancionesQueries } from "@/domains/garlia/canciones/queries";

import { fetchConReintento } from "./fetchConTimeout";
import { dexieSecRead, dexieSecWrite } from "./seccionesDb";
import type { Cancion, Seccion } from "./types";

export function useCancionEditor(id: string | null) {
  const [cancion,   setCancion]   = useState<Cancion | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async (cancionId: string) => {
    try {
      const cTable = (db as any)["canciones"];
      const base   = cTable ? await cTable.get(cancionId) : null;
      const secs   = await dexieSecRead(cancionId);
      if (base) {
        setCancion({ ...base, secciones: secs });
        setLoading(false);
      } else {
        setLoading(true);
      }
    } catch {}

    if (!navigator.onLine) {
      setIsOffline(true);
      setLoading(false);
      return;
    }
    setIsOffline(false);

    try {
      // Antes esto se rendía a los 5s y marcaba "offline" — eso disparaba el
      // falso error de conexión cuando esta era la primera consulta de la
      // sesión (ej: abrir una canción navegando desde otra página, con la
      // conexión a Supabase todavía "fría"). Ahora reintentamos con timeouts
      // más generosos antes de asumir que estamos realmente sin conexión.
      const data = await fetchConReintento(() => cancionesQueries.getById(cancionId)) as unknown as Cancion;

      setCancion(data);
      setIsOffline(false);
      try {
        const cTable = (db as any)["canciones"];
        if (cTable) await cTable.put({ ...data, status: "synced" });
      } catch {}
      if (data?.secciones?.length) {
        await dexieSecWrite(data.secciones.map((s: Seccion) => ({ ...s, status: "synced" })));
      }
    } catch {
      try {
        const cTable = (db as any)["canciones"];
        const base   = cTable ? await cTable.get(cancionId) : null;
        const secs   = await dexieSecRead(cancionId);
        if (base) setCancion({ ...base, secciones: secs });
      } catch {}
      setIsOffline(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (id) void load(id);
    else setCancion(null);
  }, [id, load]);

  useEffect(() => {
    const handleOnline = () => { if (id) { setIsOffline(false); void load(id); } };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [id, load]);

  return { cancion, setCancion, loading, isOffline, reload: () => id && load(id) };
}
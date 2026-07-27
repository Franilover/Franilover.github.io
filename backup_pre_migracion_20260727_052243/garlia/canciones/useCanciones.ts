"use client";

import { useState, useEffect, useCallback } from "react";

import { db } from "@/lib/api/client/db";
import { cancionesQueries } from "@/domains/garlia/canciones/queries";

import { fetchConReintento } from "./fetchConTimeout";
import type { Cancion } from "./types";

export function useCanciones() {
  const [canciones,  setCanciones] = useState<Cancion[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [isOffline,  setIsOffline] = useState(false);

  const readLocal = async (): Promise<Cancion[]> => {
    try {
      const table = (db as any)["canciones"];
      if (!table) return [];
      return (await table.toArray()).filter((r: any) => !r.deleted) as Cancion[];
    } catch { return []; }
  };

  const load = useCallback(async () => {
    const local = await readLocal();
    if (local.length > 0) {
      setCanciones(local);
      setLoading(false);
    }

    if (!navigator.onLine) {
      setIsOffline(true);
      setLoading(false);
      return;
    }
    setIsOffline(false);

    try {
      // Mismo fix que en useCancionEditor: reintentar con timeouts generosos
      // en vez de marcar "offline" apenas la primera consulta de la sesión
      // tarda más de 5s (algo normal en una conexión "fría" recién abierta).
      const data = await fetchConReintento(() => cancionesQueries.getAll()) as unknown as Cancion[];
      setCanciones(data);
      setIsOffline(false);
      try {
        const table = (db as any)["canciones"];
        if (table) await table.bulkPut(data.map(r => ({ ...r, status: "synced" })));
      } catch {}
    } catch {
      if (local.length === 0) setCanciones(await readLocal());
      setIsOffline(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const handleOnline = () => { setIsOffline(false); void load(); };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [load]);

  return { canciones, setCanciones, loading, isOffline, refetch: load };
}
// ─────────────────────────────────────────────────────────────────────────────
// useCargadorContenido.ts
// ─────────────────────────────────────────────────────────────────────────────
// Extraído de leerLibro.tsx (antes vivía inline en un archivo de 1550
// líneas junto con 4 componentes más). Sin cambios de comportamiento.
//
// Reemplaza al viejo modelo de "traer el contenido de todos los capítulos
// de una". Cada capítulo pide su `contenido` recién cuando:
//   a) el lector lo abre (capId activo sin entrada en contenidoPorCapId), o
//   b) se prefetchea en silencio apenas se resuelve `capSiguiente` — así
//      "Siguiente capítulo" se siente instantáneo.
// En ambos casos: si ya está en el mapa (memoria) o `cargandoContenidoIds`
// ya lo tiene en vuelo, no repite el fetch. Al resolver, persiste en Dexie
// (cache por capítulo individual, no el libro entero).

import { useCallback } from "react";

import { useLectorStore } from "@/domains/garlia/libros/useLectorStore";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

export function useCargadorContenido() {
  const contenidoPorCapId = useLectorStore((s) => s.contenidoPorCapId);
  const cargandoContenidoIds = useLectorStore((s) => s.cargandoContenidoIds);
  const setContenidoCap = useLectorStore((s) => s.setContenidoCap);
  const setCargandoContenido = useLectorStore((s) => s.setCargandoContenido);

  const cargar = useCallback(
    async (capId: string) => {
      if (!capId) return;
      const estado = useLectorStore.getState();
      if (estado.contenidoPorCapId[capId] !== undefined) return; // ya en memoria
      if (estado.cargandoContenidoIds[capId]) return; // ya en vuelo

      setCargandoContenido(capId, true);
      try {
        // Dexie primero: si el capítulo ya se leyó antes, esto resuelve
        // instantáneo sin tocar red.
        try {
          if (db && (db as any).capitulos) {
            const local = await (db as any).capitulos.get(capId);
            if (local?.contenido) {
              setContenidoCap(capId, local.contenido);
              return;
            }
          }
        } catch {}

        const { data, error } = await supabase
          .from("capitulos")
          .select("contenido")
          .eq("id", capId)
          .single();

        if (error || !data) {
          setCargandoContenido(capId, false);
          return;
        }

        const contenido = (data as any).contenido ?? "";
        setContenidoCap(capId, contenido);

        // Cache individual en Dexie — solo este capítulo, no el libro entero.
        try {
          if (db && (db as any).capitulos) {
            await (db as any).capitulos.update(capId, {
              contenido,
              status: "synced",
            });
          }
        } catch {}
      } catch {
        setCargandoContenido(capId, false);
      }
    },
    [setContenidoCap, setCargandoContenido],
  );

  return { contenidoPorCapId, cargandoContenidoIds, cargar };
}

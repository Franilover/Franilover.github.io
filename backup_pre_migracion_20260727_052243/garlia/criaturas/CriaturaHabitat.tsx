"use client";

/**
 * CriaturaHabitat.tsx
 * ─────────────────────
 * Hooks `useCriaturaReinos` / `useCriaturaCiudades` / `useHabitatCatalogs`
 * + componente `BloqueHabitat`.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/criaturas/CriaturaHabitat.tsx
 */

import { ExternalLink, Globe, MapPin, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/api/client/supabase";
import {
  getAllReinos,
  getAllCiudades,
  criaturaReinosCache,
  criaturaCiudadesCache,
  CRIATURA_REL_TTL,
  type ReinoMin,
  type CiudadMin,
  type CriaturaReinoRow,
  type CriaturaCiudadRow,
} from "@/lib/utils/criaturaHabitatCache";

// ─── Hook: catálogos compartidos de reinos y ciudades ────────────────────────
// Extrae la lógica de fetching de catálogos que antes vivía dentro del componente.

export function useHabitatCatalogs() {
  const [allReinos, setAllReinos] = useState<ReinoMin[]>([]);
  const [allCiudades, setAllCiudades] = useState<CiudadMin[]>([]);

  useEffect(() => {
    void getAllReinos().then(setAllReinos);
    void getAllCiudades().then(setAllCiudades);
  }, []);

  return { allReinos, allCiudades };
}

// ─── Hook: reinos de la criatura (criatura_reinos) ────────────────────────────

export function useCriaturaReinos(criaturaId: string) {
  const [rows, setRows] = useState<CriaturaReinoRow[]>(() => {
    const cached = criaturaReinosCache.get(criaturaId);
    return cached && Date.now() - cached.ts < CRIATURA_REL_TTL
      ? cached.data
      : [];
  });
  const [loading, setLoading] = useState(
    !(criaturaReinosCache.get(criaturaId)?.ts ?? 0) ||
      Date.now() - (criaturaReinosCache.get(criaturaId)?.ts ?? 0) >
        CRIATURA_REL_TTL,
  );

  const load = useCallback(async () => {
    const cached = criaturaReinosCache.get(criaturaId);
    if (cached && Date.now() - cached.ts < CRIATURA_REL_TTL) {
      setRows(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("criatura_reinos")
      .select("id, reino_id, reinos!reino_id(nombre)")
      .eq("criatura_id", criaturaId);
    const parsed = (data ?? []).map((r: any) => ({
      rowId: r.id,
      reinoId: r.reino_id,
      reinoNombre:
        (Array.isArray(r.reinos) ? r.reinos[0]?.nombre : r.reinos?.nombre) ??
        "—",
    }));
    criaturaReinosCache.set(criaturaId, { data: parsed, ts: Date.now() });
    setRows(parsed);
    setLoading(false);
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (reino: ReinoMin) => {
    if (rows.some((r) => r.reinoId === reino.id)) return;
    const { data, error } = await supabase
      .from("criatura_reinos")
      .insert([{ criatura_id: criaturaId, reino_id: reino.id }])
      .select()
      .single();
    if (!error && data) {
      const next = [
        ...rows,
        { rowId: data.id, reinoId: reino.id, reinoNombre: reino.nombre },
      ];
      criaturaReinosCache.set(criaturaId, { data: next, ts: Date.now() });
      setRows(next);
    }
  };

  const remove = async (rowId: string) => {
    await supabase.from("criatura_reinos").delete().eq("id", rowId);
    const next = rows.filter((r) => r.rowId !== rowId);
    criaturaReinosCache.set(criaturaId, { data: next, ts: Date.now() });
    setRows(next);
  };

  return { rows, loading, add, remove };
}

// ─── Hook: ciudades de la criatura (criatura_ciudades) ─────────────────────────

export function useCriaturaCiudades(criaturaId: string) {
  const [rows, setRows] = useState<CriaturaCiudadRow[]>(() => {
    const cached = criaturaCiudadesCache.get(criaturaId);
    return cached && Date.now() - cached.ts < CRIATURA_REL_TTL
      ? cached.data
      : [];
  });
  const [loading, setLoading] = useState(
    !(criaturaCiudadesCache.get(criaturaId)?.ts ?? 0) ||
      Date.now() - (criaturaCiudadesCache.get(criaturaId)?.ts ?? 0) >
        CRIATURA_REL_TTL,
  );

  const load = useCallback(async () => {
    const cached = criaturaCiudadesCache.get(criaturaId);
    if (cached && Date.now() - cached.ts < CRIATURA_REL_TTL) {
      setRows(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("criatura_ciudades")
      .select("id, ciudad_id, ciudades!ciudad_id(nombre, reino_id)")
      .eq("criatura_id", criaturaId);
    const parsed = (data ?? []).map((r: any) => {
      const l = Array.isArray(r.ciudades) ? r.ciudades[0] : r.ciudades;
      return {
        rowId: r.id,
        ciudadId: r.ciudad_id,
        ciudadNombre: l?.nombre ?? "—",
        reinoId: l?.reino_id ?? null,
      };
    });
    criaturaCiudadesCache.set(criaturaId, { data: parsed, ts: Date.now() });
    setRows(parsed);
    setLoading(false);
  }, [criaturaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (ciudad: CiudadMin) => {
    if (rows.some((r) => r.ciudadId === ciudad.id)) return;
    const { data, error } = await supabase
      .from("criatura_ciudades")
      .insert([{ criatura_id: criaturaId, ciudad_id: ciudad.id }])
      .select()
      .single();
    if (!error && data) {
      const next = [
        ...rows,
        {
          rowId: data.id,
          ciudadId: ciudad.id,
          ciudadNombre: ciudad.nombre,
          reinoId: ciudad.reino_id,
        },
      ];
      criaturaCiudadesCache.set(criaturaId, { data: next, ts: Date.now() });
      setRows(next);
    }
  };

  const remove = async (rowId: string) => {
    await supabase.from("criatura_ciudades").delete().eq("id", rowId);
    const next = rows.filter((r) => r.rowId !== rowId);
    criaturaCiudadesCache.set(criaturaId, { data: next, ts: Date.now() });
    setRows(next);
  };

  return { rows, loading, add, remove };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function BloqueHabitat({
  criaturaId,
  onNavigateCiudad,
  onNavigateReino,
}: {
  criaturaId: string;
  onNavigateCiudad?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
}) {
  const {
    rows: reinoRows,
    loading: loadingR,
    add: addReino,
    remove: removeReino,
  } = useCriaturaReinos(criaturaId);
  const {
    rows: ciudadRows,
    loading: loadingC,
    add: addCiudad,
    remove: removeCiudad,
  } = useCriaturaCiudades(criaturaId);

  // Catálogos: antes vivían en un useEffect dentro del componente.
  // Ahora los provee un hook dedicado.
  const { allReinos, allCiudades } = useHabitatCatalogs();

  const [reinoFiltro, setReinoFiltro] = useState<string | null>(null);
  const [openR, setOpenR] = useState(false);
  const [openL, setOpenL] = useState(false);
  const [searchR, setSearchR] = useState("");
  const [searchL, setSearchL] = useState("");

  const ciudadesFiltradas = allCiudades.filter((l) =>
    reinoFiltro ? l.reino_id === reinoFiltro : true,
  );

  const ciudadesAsignadas = ciudadRows.filter((r) =>
    reinoFiltro ? r.reinoId === reinoFiltro : true,
  );

  const reinosDisponibles = allReinos.filter(
    (r) =>
      r.nombre.toLowerCase().includes(searchR.toLowerCase()) &&
      !reinoRows.some((rr) => rr.reinoId === r.id),
  );

  const ciudadesDisponibles = ciudadesFiltradas.filter(
    (l) =>
      l.nombre.toLowerCase().includes(searchL.toLowerCase()) &&
      !ciudadRows.some((lr) => lr.ciudadId === l.id),
  );

  return (
    <div className="space-y-3">
      {/* ── Reinos ── */}
      <div className="space-y-1.5">
        <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/25 flex items-center gap-1">
          <Globe size={9} /> Reinos
        </label>

        {loadingR ? (
          <p className="text-micro text-primary/20 italic">Cargando…</p>
        ) : (
          <>
            {reinoRows.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {reinoRows.map((r) => (
                  <div
                    key={r.rowId}
                    className="flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-lg border text-micro font-bold transition-all"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 6%, transparent)",
                      borderColor:
                        "color-mix(in srgb, var(--primary) 15%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    <button
                      className="leading-none flex items-center gap-1 hover:underline transition-opacity"
                      style={{
                        cursor: "pointer",
                        opacity: reinoFiltro === r.reinoId ? 1 : 0.75,
                      }}
                      title={
                        reinoFiltro === r.reinoId
                          ? "Quitar filtro de ciudades"
                          : "Filtrar ciudades por este reino"
                      }
                      type="button"
                      onClick={() =>
                        setReinoFiltro((f) =>
                          f === r.reinoId ? null : r.reinoId,
                        )
                      }
                    >
                      {r.reinoNombre}
                      {reinoFiltro === r.reinoId && (
                        <X className="opacity-60" size={7} />
                      )}
                    </button>
                    {onNavigateReino && (
                      <button
                        className="w-3.5 h-3.5 rounded flex items-center justify-center text-primary/30 hover:text-primary/70 transition-colors"
                        title="Abrir reino"
                        type="button"
                        onClick={() => onNavigateReino(r.reinoId)}
                      >
                        <ExternalLink size={7} />
                      </button>
                    )}
                    <button
                      className="w-3.5 h-3.5 rounded flex items-center justify-center text-primary/30 hover:text-red-400 transition-colors"
                      type="button"
                      onClick={() => removeReino(r.rowId)}
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all cursor-pointer"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 18%, transparent)",
                  color: "color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
                type="button"
                onClick={() => setOpenR((o) => !o)}
              >
                <Plus size={8} /> Añadir reino
              </button>
              {openR && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setOpenR(false);
                      setSearchR("");
                    }}
                  />
                  <div
                    className="absolute z-50 top-full left-0 mt-1 w-48 rounded-xl border shadow-xl overflow-hidden"
                    style={{
                      background: "var(--bg-main)",
                      borderColor:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                    }}
                  >
                    <div
                      className="p-1.5 border-b"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--primary) 8%, transparent)",
                      }}
                    >
                      <input
                        autoFocus
                        className="w-full bg-transparent text-micro text-primary outline-none placeholder:text-primary/30 px-1.5 py-0.5"
                        placeholder="Buscar reino…"
                        value={searchR}
                        onChange={(e) => setSearchR(e.target.value)}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto p-1">
                      {reinosDisponibles.length === 0 ? (
                        <p className="text-micro text-primary/25 italic text-center py-3">
                          Sin resultados
                        </p>
                      ) : (
                        reinosDisponibles.map((r) => (
                          <button
                            key={r.id}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-micro font-medium text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate cursor-pointer"
                            type="button"
                            onMouseDown={() => {
                              void addReino(r);
                              setOpenR(false);
                              setSearchR("");
                            }}
                          >
                            {r.nombre}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Ciudades ── */}
      <div className="space-y-1.5">
        <label className="text-micro font-black uppercase tracking-[0.2em] text-primary/25 flex items-center gap-1.5">
          <MapPin size={9} />
          Ciudades
          {reinoFiltro && (
            <span
              className="text-micro font-bold px-1.5 py-0.5 rounded-md"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 10%, transparent)",
                color: "color-mix(in srgb, var(--primary) 60%, transparent)",
              }}
            >
              {reinoRows.find((r) => r.reinoId === reinoFiltro)?.reinoNombre}
            </span>
          )}
        </label>

        {loadingC ? (
          <p className="text-micro text-primary/20 italic">Cargando…</p>
        ) : (
          <>
            {ciudadesAsignadas.length === 0 && (
              <p className="text-micro text-primary/20 italic py-1">
                {reinoFiltro
                  ? "Sin ciudades en este reino"
                  : "Sin ciudades asignadas"}
              </p>
            )}
            {ciudadesAsignadas.length > 0 && (
              <div className="space-y-1">
                {ciudadesAsignadas.map((r) => (
                  <div
                    key={r.rowId}
                    className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-colors"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 4%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  >
                    <button
                      className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer hover:text-primary transition-colors group/ciudad"
                      onClick={() => onNavigateCiudad?.(r.ciudadId)}
                    >
                      <MapPin
                        className="shrink-0 text-primary/30 group-hover/ciudad:text-primary/60 transition-colors"
                        size={9}
                      />
                      <span className="text-micro font-bold text-primary/65 truncate group-hover/ciudad:text-primary transition-colors underline-offset-2 group-hover/ciudad:underline">
                        {r.ciudadNombre}
                      </span>
                    </button>
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded text-red-400/50 hover:text-red-400 cursor-pointer"
                      onClick={() => removeCiudad(r.rowId)}
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all cursor-pointer"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 18%, transparent)",
                  color: "color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
                type="button"
                onClick={() => setOpenL((o) => !o)}
              >
                <Plus size={8} /> Añadir ciudad
              </button>
              {openL && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setOpenL(false);
                      setSearchL("");
                    }}
                  />
                  <div
                    className="absolute z-50 top-full left-0 mt-1 w-52 rounded-xl border shadow-xl overflow-hidden"
                    style={{
                      background: "var(--bg-main)",
                      borderColor:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                    }}
                  >
                    <div
                      className="p-1.5 border-b"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--primary) 8%, transparent)",
                      }}
                    >
                      <input
                        autoFocus
                        className="w-full bg-transparent text-micro text-primary outline-none placeholder:text-primary/30 px-1.5 py-0.5"
                        placeholder="Buscar ciudad…"
                        value={searchL}
                        onChange={(e) => setSearchL(e.target.value)}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto p-1">
                      {ciudadesDisponibles.length === 0 ? (
                        <p className="text-micro text-primary/25 italic text-center py-3">
                          Sin resultados
                        </p>
                      ) : (
                        ciudadesDisponibles.map((l) => (
                          <button
                            key={l.id}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-micro font-medium text-primary/75 hover:bg-primary/6 hover:text-primary transition-colors truncate cursor-pointer"
                            type="button"
                            onMouseDown={() => {
                              void addCiudad(l);
                              setOpenL(false);
                              setSearchL("");
                            }}
                          >
                            {l.nombre}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * EditorIdentidades (admin)
 * ───────────────────────────────────────────────────────────────────────────
 * Lista todas las identidades (fichas_dnd) de todos los jugadores y permite
 * editar su vida y estadísticas D&D. Reutiliza literalmente el mismo
 * componente visual que usan los jugadores en /garlia/aventura
 * (FichaStatsPanel), solo que acá con `editable` para que los valores sean
 * inputs en vez de texto estático.
 */

import { Loader2, Search, Swords, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { CampoFichaValor, FichaDnd } from "@/domains/garlia/aventuras/public/useFichasDnd";
import { FichaStatsPanel } from "@/domains/garlia/aventuras/public/misiones";
import { supabase } from "@/infra/supabase/supabase";

interface DuenioResumen {
  username: string;
  avatar_url: string | null;
}

interface FichaConDuenio extends FichaDnd {
  duenio?: DuenioResumen | null;
}

export default function EditorIdentidades() {
  const [fichas, setFichas] = useState<FichaConDuenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // No usamos el embed "perfiles:perfil_id(...)" para evitar depender de que
  // la FK esté declarada tal cual en Supabase — dos queries + merge en
  // cliente, mismo patrón que el resto del admin.
  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fichas_dnd")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    const perfilIds = Array.from(
      new Set(data.map((f: any) => f.perfil_id).filter(Boolean)),
    ) as string[];

    let duenosPorId = new Map<string, DuenioResumen>();
    if (perfilIds.length > 0) {
      const { data: perfilesData } = await supabase
        .from("perfiles")
        .select("id, username, avatar_url")
        .in("id", perfilIds);
      duenosPorId = new Map(
        (perfilesData ?? []).map((p: any) => [
          p.id,
          { username: p.username, avatar_url: p.avatar_url },
        ]),
      );
    }

    setFichas(
      (data as FichaDnd[]).map((f) => ({
        ...f,
        duenio: duenosPorId.get(f.perfil_id) ?? null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const seleccionada = fichas.find((f) => f.id === seleccionId) ?? null;

  // ── Edición de un campo: optimista + persistido en Supabase ──────────────
  const handleEditarCampo = async (
    campo: keyof FichaDnd,
    valor: CampoFichaValor,
  ) => {
    if (!seleccionada) return;
    const id = seleccionada.id;
    setFichas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
    setGuardando(true);
    const { error } = await supabase
      .from("fichas_dnd")
      .update({ [campo]: valor })
      .eq("id", id);
    setGuardando(false);
    if (error) {
      console.error("[EditorIdentidades] Error guardando:", error);
      await cargar(); // revierte al estado real si falló
    }
  };

  const filtradas = fichas.filter((f) => {
    if (query.trim() === "") return true;
    const q = query.toLowerCase();
    return (
      f.nombre.toLowerCase().includes(q) ||
      (f.duenio?.username ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* ── Lista de identidades ── */}
      <div className="w-64 shrink-0 border-r border-primary/10 flex flex-col overflow-hidden">
        <div className="shrink-0 px-3 py-2.5 border-b border-primary/10">
          <div
            className="flex items-center gap-2 px-2.5 rounded-lg border border-primary/10 bg-primary/[0.03]"
            style={{ height: 32 }}
          >
            <Search size={12} className="text-primary/35 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar identidad o jugador…"
              className="flex-1 bg-transparent outline-none text-xs text-primary/80 placeholder:text-primary/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && fichas.length === 0 ? (
            <div className="py-12 flex items-center justify-center text-primary/30">
              <Loader2 className="animate-spin" size={16} />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-12 text-center text-xs text-primary/30 px-3">
              Ningún jugador tiene identidades todavía.
            </div>
          ) : (
            filtradas.map((f) => {
              const activa = f.id === seleccionId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSeleccionId(f.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    activa ? "bg-primary/10" : "hover:bg-primary/5"
                  }`}
                >
                  <div className="w-7 h-7 shrink-0 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                    {f.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.imagen_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Swords size={12} className="text-primary/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-primary/80 truncate">
                      {f.nombre}
                    </div>
                    <div className="text-micro text-primary/35 truncate">
                      {f.duenio?.username ?? "Sin dueño"} · Nivel {f.nivel ?? 1}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Detalle editable — mismo diseño que en /garlia/aventura ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {!seleccionada ? (
          <div className="h-full flex flex-col items-center justify-center text-primary/30 gap-2">
            <User size={22} />
            <p className="text-xs">Elegí una identidad de la lista para editarla.</p>
          </div>
        ) : (
          <div className="max-w-sm mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-micro font-black uppercase tracking-wider text-primary/40">
                {seleccionada.duenio?.username
                  ? `Identidad de ${seleccionada.duenio.username}`
                  : "Identidad"}
              </span>
              {guardando && <Loader2 size={12} className="animate-spin text-primary/40" />}
            </div>
            <FichaStatsPanel
              key={seleccionada.id}
              ficha={seleccionada}
              editable
              editableStats
              editableCondiciones
              onEditarCampo={handleEditarCampo}
            />
          </div>
        )}
      </div>
    </div>
  );
}

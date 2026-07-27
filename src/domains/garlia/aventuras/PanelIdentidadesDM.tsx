"use client";

/**
 * PanelIdentidadesDM
 * ───────────────────────────────────────────────────────────────────────────
 * Columna lateral para el admin de Aventura: lista de identidades (fichas_dnd)
 * de todos los jugadores como acordeón/dropdown. Al hacer click en una, se
 * despliega hacia abajo su FichaStatsPanel en modo editable — para que el DM
 * pueda ajustar vida, stats, nivel, etc. en vivo mientras juegan, sin salir
 * de la pantalla del pizarrón.
 *
 * Reutiliza fichas_dnd + FichaStatsPanel (mismo componente visual que ven los
 * jugadores en /garlia/aventura), solo que acá con `editable`.
 */

import { AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, Search, Swords } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { MotionDiv } from "@/components/ui/Motion";
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

export function PanelIdentidadesDM() {
  const [fichas, setFichas] = useState<FichaConDuenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

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
    // Realtime: si el jugador edita su propia ficha desde /garlia/aventura,
    // el DM ve el cambio reflejado acá sin recargar.
    const channel = supabase
      .channel("fichas-dnd-dm-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "fichas_dnd" }, () => {
        void cargar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargar]);

  const handleEditarCampo = async (
    fichaId: string,
    campo: keyof FichaDnd,
    valor: CampoFichaValor,
  ) => {
    setFichas((prev) => prev.map((f) => (f.id === fichaId ? { ...f, [campo]: valor } : f)));
    setGuardandoId(fichaId);
    const { error } = await supabase
      .from("fichas_dnd")
      .update({ [campo]: valor })
      .eq("id", fichaId);
    setGuardandoId(null);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[PanelIdentidadesDM] Error guardando:", error);
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
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-3 py-2.5 border-b border-primary/10">
        <h3 className="text-micro font-black uppercase tracking-widest text-primary/40 mb-2">
          Identidades
        </h3>
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

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {loading && fichas.length === 0 ? (
          <div className="py-12 flex items-center justify-center text-primary/30">
            <Loader2 className="animate-spin" size={16} />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-12 text-center text-xs text-primary/30 px-3">
            Ningún jugador tiene identidades todavía.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtradas.map((f) => {
              const abierta = abiertaId === f.id;
              return (
                <div
                  key={f.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    borderColor: abierta
                      ? "color-mix(in srgb, var(--primary) 30%, transparent)"
                      : "color-mix(in srgb, var(--primary) 10%, transparent)",
                  }}
                >
                  {/* ── Cabecera del dropdown ── */}
                  <button
                    type="button"
                    onClick={() => setAbiertaId(abierta ? null : f.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      abierta ? "bg-primary/[0.06]" : "hover:bg-primary/5"
                    }`}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                      {f.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.imagen_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Swords size={13} className="text-primary/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-primary/80 truncate">
                        {f.nombre}
                      </div>
                      <div className="text-micro text-primary/35 truncate">
                        {f.duenio?.username ?? "Sin dueño"} · Nivel {f.nivel ?? 1} ·{" "}
                        {f.hp_actual}/{f.hp_max} HP
                      </div>
                    </div>
                    {guardandoId === f.id ? (
                      <Loader2 size={13} className="animate-spin text-primary/40 shrink-0" />
                    ) : (
                      <ChevronDown
                        size={14}
                        className="text-primary/35 shrink-0 transition-transform"
                        style={{ transform: abierta ? "rotate(180deg)" : "none" }}
                      />
                    )}
                  </button>

                  {/* ── Contenido: FichaStatsPanel editable ── */}
                  <AnimatePresence initial={false}>
                    {abierta && (
                      <MotionDiv
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        initial={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="p-2 pt-0">
                          <FichaStatsPanel
                            key={f.id}
                            ficha={f}
                            editable
                            editableStats
                            editableCondiciones
                            mostrarSecundarias
                            onEditarCampo={(campo, valor) =>
                              handleEditarCampo(f.id, campo, valor)
                            }
                          />
                        </div>
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

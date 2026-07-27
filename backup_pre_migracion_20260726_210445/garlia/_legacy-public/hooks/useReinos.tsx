"use client";
import { X, MapPin } from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect, useRef, useCallback } from "react";

import { MotionDiv } from "@/components/ui/Motion";
import { supabase } from "@/lib/api/client/supabase";

export function useDesbloquearReinos(capId: string, reinosIds: string[] | undefined) {
  const [desbloqueados,      setDesbloqueados]      = useState<string[]>([]);
  const [mostrarCelebration, setMostrarCelebration] = useState(false);

  const disparandoRef = useRef(false);
  const idsKey = (reinosIds ?? []).join(",");

  const disparar = useCallback(async () => {
    if (!reinosIds?.length) return [];
    if (disparandoRef.current) return [];
    disparandoRef.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      const perfilId = session.user.id;

      // upsert con ignoreDuplicates: la DB maneja el conflicto atómicamente.
      // .select() retorna solo las filas realmente insertadas (nuevas).
      const rows = reinosIds.map(reinoId => ({ perfil_id: perfilId, reino_id: reinoId }));
      const { data, error } = await supabase
        .from("descubrimientos_reinos")
        .upsert(rows, { onConflict: "perfil_id,reino_id", ignoreDuplicates: true })
        .select("reino_id");

      if (error) throw error;

      const nuevos = (data ?? []).map((r: any) => r.reino_id);
      if (nuevos.length > 0) {
        setDesbloqueados(nuevos);
        setMostrarCelebration(true);
      }
      return nuevos;
    } catch (err) {
      console.error("[useDesbloquearReinos]", err);
      return [];
    } finally {
      disparandoRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capId, idsKey]);

  const cerrar = useCallback(() => setMostrarCelebration(false), []);

  return { disparar, mostrarCelebration, desbloqueados, cerrar };
}

export function ReinosDesbloqueadosToast({
  reinosIds,
  onClose,
}: {
  reinosIds: string[];
  onClose: () => void;
}) {
  const [reinos, setReinos] = useState<{ id: string; nombre: string; mapa_url?: string | null }[]>([]);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!reinosIds.length) return;
    supabase
      .from("reinos")
      .select("id, nombre, mapa_url")
      .in("id", reinosIds)
      .then(({ data }) => { if (data) setReinos(data); });
  }, [reinosIds.join(",")]); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => onCloseRef.current(), 6000);
    return () => clearTimeout(t);
  }, []);

  if (!reinos.length) return null;

  return (
    <MotionDiv
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] w-[calc(100vw-2rem)] max-w-sm"
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <div
        className="rounded-[var(--radius-card)] border border-primary/15 shadow-2xl overflow-hidden"
        style={{ background: "var(--white-custom)" }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between border-b border-primary/8"
          style={{ background: "color-mix(in srgb, var(--primary) 6%, transparent)" }}
        >
          <span className="text-micro font-black uppercase tracking-[0.25em] text-primary italic flex items-center gap-2">
            <MapPin size={11} />
            {reinos.length === 1 ? "Reino descubierto" : `${reinos.length} reinos descubiertos`}
          </span>
          <button className="text-primary/30 hover:text-primary transition-colors" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {reinos.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[var(--radius-btn)] overflow-hidden border border-primary/10 shrink-0 bg-primary/5">
                {r.mapa_url
                  ? <Image alt={r.nombre} className="w-full h-full object-cover" src={r.mapa_url} />
                  : <div className="w-full h-full flex items-center justify-center text-primary/20 text-xs font-black">{r.nombre[0]}</div>
                }
              </div>
              <div>
                <p className="text-sm font-black uppercase italic text-primary tracking-tight">{r.nombre}</p>
                <p className="text-micro font-bold uppercase tracking-widest text-primary/40">Añadido a tu mapa</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MotionDiv>
  );
}
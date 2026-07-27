"use client";
import { X, Sword } from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect, useRef, useCallback } from "react";

import { MotionDiv } from "@/components/ui/Motion";
import { supabase } from "@/lib/api/client/supabase";

export function useDesbloquearPersonajes(
  capId: string,
  personajesIds: string[] | undefined,
) {
  const [desbloqueados, setDesbloqueados] = useState<string[]>([]);
  const [mostrarCelebration, setMostrarCelebration] = useState(false);

  // Única barrera necesaria: evita doble disparo en vuelo (StrictMode, scroll rápido).
  const disparandoRef = useRef(false);
  const idsKey = (personajesIds ?? []).join(",");

  const disparar = useCallback(async () => {
    if (!personajesIds?.length) return [];
    if (disparandoRef.current) return [];
    disparandoRef.current = true;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return [];

      const perfilId = session.user.id;

      // upsert con ignoreDuplicates: la DB maneja el conflicto atómicamente.
      // .select() retorna solo las filas realmente insertadas (nuevas).
      const rows = personajesIds.map((personajeId) => ({
        perfil_id: perfilId,
        personaje_id: personajeId,
      }));
      const { data, error } = await supabase
        .from("descubrimientos_personajes")
        .upsert(rows, {
          onConflict: "perfil_id,personaje_id",
          ignoreDuplicates: true,
        })
        .select("personaje_id");

      if (error) throw error;

      const nuevos = (data ?? []).map((r: any) => r.personaje_id);
      if (nuevos.length > 0) {
        setDesbloqueados(nuevos);
        setMostrarCelebration(true);
      }
      return nuevos;
    } catch (err) {
      console.error("[useDesbloquearPersonajes]", err);
      return [];
    } finally {
      disparandoRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capId, idsKey]);

  const cerrar = useCallback(() => setMostrarCelebration(false), []);

  return { disparar, mostrarCelebration, desbloqueados, cerrar };
}

export function PersonajesDesbloqueadosToast({
  personajesIds,
  onClose,
}: {
  personajesIds: string[];
  onClose: () => void;
}) {
  const [personajes, setPersonajes] = useState<
    { id: string; nombre: string; img_url?: string }[]
  >([]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!personajesIds.length) return;
    supabase
      .from("personajes")
      .select("id, nombre, img_url")
      .in("id", personajesIds)
      .then(({ data }) => {
        if (data) setPersonajes(data);
      });
  }, [personajesIds.join(",")]); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => onCloseRef.current(), 6000);
    return () => clearTimeout(t);
  }, []);

  if (!personajes.length) return null;

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
          style={{
            background: "color-mix(in srgb, var(--primary) 6%, transparent)",
          }}
        >
          <span className="text-micro font-black uppercase tracking-[0.25em] text-primary italic flex items-center gap-2">
            <Sword size={11} />
            {personajes.length === 1
              ? "Personaje desbloqueado"
              : `${personajes.length} personajes desbloqueados`}
          </span>
          <button
            className="text-primary/30 hover:text-primary transition-colors"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {personajes.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[var(--radius-btn)] overflow-hidden border border-primary/10 shrink-0 bg-primary/5">
                {p.img_url ? (
                  <Image
                    alt={p.nombre}
                    className="w-full h-full object-cover"
                    src={p.img_url}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary/20 text-xs font-black">
                    {p.nombre[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-black uppercase italic text-primary tracking-tight">
                  {p.nombre}
                </p>
                <p className="text-micro font-bold uppercase tracking-widest text-primary/40">
                  Añadido a tu agenda
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MotionDiv>
  );
}

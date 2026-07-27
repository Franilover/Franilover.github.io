"use client";
import { AnimatePresence } from "framer-motion";
import { AlignLeft, Clock } from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";

import type { CapituloScrollItem } from "@/domains/garlia/libros/capitulos/types";
import { useDesbloquearCiudades, CiudadesDesbloqueadasToast } from "@/domains/garlia/_legacy-public/hooks//useCiudades";
import { useDesbloquearPersonajes, PersonajesDesbloqueadosToast } from "@/domains/garlia/_legacy-public/hooks//usePersonajes";
import { useDesbloquearReinos, ReinosDesbloqueadosToast } from "@/domains/garlia/_legacy-public/hooks/useReinos";
import { supabase } from "@/lib/api/client/supabase";

import { ContenidoInteractivo } from "./ContenidoInteractivo";
import { FinCapituloSeparador } from "./LectorUI";


/**
 * Estilos de fuente fluida para el lector.
 */
const FLUID_FONT_STYLES = `
  .lector-article-wrap {
    container-type: inline-size;
    container-name: lector;
  }

  @container lector (min-width: 0px) {
    .lector-article-inner {
      font-size: clamp(1rem, 2.2cqi, 1.22rem);
      line-height: 1.85;
    }
  }

  @container lector (min-width: 600px) {
    .lector-article-inner {
      font-size: clamp(1.06rem, 1.9cqi, 1.28rem);
      line-height: 1.9;
    }
  }

  @container lector (min-width: 0px) {
    .lector-titulo {
      font-size: clamp(1.6rem, 6cqi, 2.5rem);
    }
  }

  @container lector (min-width: 0px) {
    .lector-seccion {
      font-size: clamp(2rem, 7cqi, 3rem);
    }
  }
`;

/* ─────────────────────────────────────────────
   Cola global de toasts
   ───────────────────────────────────────────── */
type ToastEntry =
  | { tipo: "personajes"; ids: string[] }
  | { tipo: "reinos";     ids: string[] }
  | { tipo: "ciudades";   ids: string[] };

const toastQueue: ToastEntry[] = [];
const toastListeners = new Set<() => void>();

function notifyListeners() {
  toastListeners.forEach(fn => fn());
}

export function encolarToast(entry: ToastEntry) {
  toastQueue.push(entry);
  notifyListeners();
}

function useToastQueue() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const update = () => forceUpdate(n => n + 1);
    toastListeners.add(update);
    return () => { toastListeners.delete(update); };
  }, []);

  const current = toastQueue[0] ?? null;

  const avanzar = useCallback(() => {
    toastQueue.shift();
    notifyListeners();
  }, []);

  return { current, avanzar };
}

export function ToastPortal() {
  const { current, avanzar } = useToastQueue();

  return (
    <AnimatePresence mode="wait">
      {current?.tipo === "personajes" && (
        <PersonajesDesbloqueadosToast
          key={`personajes-${current.ids.join(",")}`}
          personajesIds={current.ids}
          onClose={avanzar}
        />
      )}
      {current?.tipo === "reinos" && (
        <ReinosDesbloqueadosToast
          key={`reinos-${current.ids.join(",")}`}
          reinosIds={current.ids}
          onClose={avanzar}
        />
      )}
      {current?.tipo === "ciudades" && (
        <CiudadesDesbloqueadasToast
          key={`ciudades-${current.ids.join(",")}`}
          ciudadesIds={current.ids}
          onClose={avanzar}
        />
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────
   Componente de capítulo
   ───────────────────────────────────────────── */
export function CapituloScrollBlock({ cap, onNavigate, esExtra = false, haySegSiguiente: _haySegSiguiente = false }: {
  cap: CapituloScrollItem;
  onNavigate: (capId: string) => void;
  esExtra?: boolean;
  haySegSiguiente?: boolean;
}) {
  const words = (cap.contenido ?? "").trim()
    ? (cap.contenido ?? "").trim().split(/\s+/).length
    : 0;

  const personajesIdsEfectivos = cap.personajes_ids;
  const reinosIdsEfectivos     = cap.reinos_ids as string[] | undefined;
  const ciudadesIdsEfectivos   = (cap as any).ciudades_ids;

  const { disparar: dispararPersonajes } = useDesbloquearPersonajes(cap.id, personajesIdsEfectivos);
  const { disparar: dispararReinos }     = useDesbloquearReinos(cap.id, reinosIdsEfectivos);
  const { disparar: dispararCiudades }   = useDesbloquearCiudades(cap.id, ciudadesIdsEfectivos);

  const firedFinRef = useRef(false);
  useEffect(() => { firedFinRef.current = false; }, [cap.id]);

  const handleFinCapitulo = useCallback(async () => {
    // 1. Obtener sesión
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const perfilId = session.user.id;
    const libroId  = (cap as any).libro_id as string | undefined;

    // 2. INSERT atómico a capitulos_leidos.
    //    ON CONFLICT (perfil_id, capitulo_id) DO NOTHING → retorna 0 filas si ya existía.
    //    Retorna 1 fila si es genuinamente nuevo → solo entonces disparamos desbloqueos.
    let esNuevo = false;

    if (libroId) {
      const { data: inserted } = await supabase
        .from("capitulos_leidos")
        .upsert(
          { perfil_id: perfilId, capitulo_id: cap.id, libro_id: libroId },
          { onConflict: "perfil_id,capitulo_id", ignoreDuplicates: true }
        )
        .select("capitulo_id");

      esNuevo = (inserted?.length ?? 0) > 0;
    } else {
      // Si por alguna razón no hay libro_id en el cap (no debería pasar),
      // disparamos igual para no perder desbloqueos.
      esNuevo = true;
    }

    if (!esNuevo) return;

    // 3. Disparar desbloqueos de entidades solo si el capítulo es realmente nuevo.
    const results = await Promise.allSettled([
      dispararPersonajes(),
      dispararReinos(),
      dispararCiudades(),
    ]);
    const [rPersonajes, rReinos, rCiudades] = results;
    const nuevosPersonajes = rPersonajes.status === "fulfilled" ? rPersonajes.value : [];
    const nuevosReinos     = rReinos.status     === "fulfilled" ? rReinos.value     : [];
    const nuevasCiudades   = rCiudades.status   === "fulfilled" ? rCiudades.value   : [];
    if (nuevosPersonajes?.length) encolarToast({ tipo: "personajes", ids: nuevosPersonajes });
    if (nuevosReinos?.length)     encolarToast({ tipo: "reinos",     ids: nuevosReinos });
    if (nuevasCiudades?.length)   encolarToast({ tipo: "ciudades",   ids: nuevasCiudades });
  }, [cap, dispararPersonajes, dispararReinos, dispararCiudades]);

  // Escuchar scroll del contenedor y disparar al llegar al 90% del capítulo
  useEffect(() => {
    const container = document.getElementById("lector-scroll-container");
    if (!container) return;

    const check = () => {
      if (firedFinRef.current) return;
      const el = document.getElementById(`cap-${cap.id}`);
      if (!el) return;
      const elBottom = el.offsetTop + el.offsetHeight;
      const viewBottom = container.scrollTop + container.clientHeight;
      if (viewBottom >= elBottom * 0.9) {
        firedFinRef.current = true;
        void handleFinCapitulo();
      }
    };

    check();
    container.addEventListener("scroll", check, { passive: true });
    return () => container.removeEventListener("scroll", check);
   
  }, [cap.id, handleFinCapitulo]);

  return (
    <div className="lector-article-wrap scroll-mt-20" id={`cap-${cap.id}`}>
      <style>{FLUID_FONT_STYLES}</style>
      {esExtra && <style>{`
        .lector-article-wrap p::first-letter,
        .lector-article-wrap p:first-of-type::first-letter,
        .prose-mundo p::first-letter,
        .lector-texto p::first-letter {
          all: unset !important;
          font-size: inherit !important;
          float: none !important;
          line-height: inherit !important;
          font-weight: inherit !important;
        }
      `}</style>}

      <article
        className="lector-article-inner mx-auto px-6 py-16 md:py-24"
        style={{ maxWidth: "min(680px, 92%)" }}
      >
        <header className="mb-12 text-center">
          {!esExtra && (
            <span className="lector-seccion text-primary/20 font-serif italic block mb-2">
              {cap.orden}
            </span>
          )}
          <h1 className="lector-titulo font-black text-primary tracking-tighter uppercase italic leading-none">
            {cap.titulo_capitulo}
          </h1>
          {!esExtra && (
            <div className="flex items-center justify-center gap-4 mt-4 text-micro font-black uppercase tracking-widest text-primary/25">
              <span className="flex items-center gap-1"><AlignLeft size={9} /> {words.toLocaleString()} palabras</span>
              <span className="flex items-center gap-1"><Clock size={9} /> ~{Math.max(1, Math.round(words / 200))} min</span>
            </div>
          )}
        </header>

        <div className="min-h-[20vh]">
          <ContenidoInteractivo
            esExtra={esExtra}
            texto={cap.contenido ?? ""}
            onNavigate={onNavigate}
          />
        </div>

        <FinCapituloSeparador cap={cap} ocultar={true} onVisible={() => {}} />
      </article>
    </div>
  );
}
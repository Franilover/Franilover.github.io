"use client";

/**
 * Ensayos (vista pública)
 * ───────────────────────────────────────────────────────────────────────────
 * Lista y muestra los ensayos que el autor marcó como públicos desde el
 * editor (PublicarToggle en EditorEnsayo.tsx agrega/quita el tag reservado
 * "publico" — mismo mecanismo que "leyendo"/"leido"/"pendiente" en
 * LibrosDashboard, sin columna nueva en Supabase).
 *
 * Sin autenticación: fetch directo a la tabla `ensayos` filtrando por
 * tags.includes("publico") — igual patrón que domains/personal/publico/
 * galeria.tsx (fetch simple con supabase.from(), sin Dexie porque acá no
 * hace falta edición offline). El RLS de Supabase debe permitir SELECT
 * público sobre `ensayos` para que este fetch funcione sin sesión — mismo
 * requisito que ya tiene la tabla `galeria`.
 *
 * Renderizado del contenido: PlainMarkdownPreview (editor/lexical/), el
 * mismo renderer de solo-lectura que ya usan otros consumidores del raw
 * markdown que produce RichEditor — sin la capa de interactividad narrativa
 * de ContenidoInteractivo (choices/drops/condiciones), que es específica de
 * los capítulos de Garlia y no aplica acá.
 */

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { PlainMarkdownPreview } from "@/editor/lexical/PlainMarkdownPreview";
import { supabase } from "@/infra/supabase/supabase";

interface EnsayoPublico {
  id: string;
  titulo?: string;
  contenido: string;
  tags?: string[];
  updated_at: string;
}

function useEnsayosPublicos() {
  const [items, setItems] = useState<EnsayoPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(false);
      // `tags` es un array de texto en Supabase — cs (contains) filtra
      // server-side por el tag reservado "publico", sin traer notas
      // privadas al cliente en ningún momento.
      const { data, error: err } = await supabase
        .from("ensayos")
        .select("id, titulo, contenido, tags, updated_at")
        .contains("tags", ["publico"])
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (err || !data) {
        setError(true);
        setLoading(false);
        return;
      }
      setItems(data as EnsayoPublico[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// Tags "de estado" que el editor usa internamente (ver LibrosDashboard /
// PublicarToggle) — no son temas del ensayo, así que se ocultan de la
// lista de tags visibles al lector público.
const TAGS_INTERNOS = new Set(["publico", "libro", "leyendo", "leido", "pendiente"]);

function ListaEnsayos({
  items,
  onSelect,
}: {
  items: EnsayoPublico[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-32 text-primary/20">
        <FileText size={48} strokeWidth={1} />
        <p className="text-sm font-black uppercase tracking-widest">
          Todavía no hay ensayos públicos
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-1">
      {items.map((e) => {
        const tagsVisibles = (e.tags ?? []).filter((t) => !TAGS_INTERNOS.has(t));
        return (
          <button
            key={e.id}
            className="w-full text-left px-4 py-4 rounded-xl transition-colors hover:bg-primary/[0.04]"
            type="button"
            onClick={() => onSelect(e.id)}
          >
            <p className="text-base font-bold text-primary">
              {e.titulo || "Sin título"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-micro font-mono uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--foreground) 30%, transparent)" }}
              >
                {formatFecha(e.updated_at)}
              </span>
              {tagsVisibles.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-micro font-mono"
                  style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
                >
                  #{t}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DetalleEnsayo({
  ensayo,
  onBack,
}: {
  ensayo: EnsayoPublico;
  onBack: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button
        className="flex items-center gap-1.5 mb-6 text-micro font-black uppercase tracking-widest transition-colors"
        style={{ color: "color-mix(in srgb, var(--foreground) 35%, transparent)" }}
        type="button"
        onClick={onBack}
      >
        <ArrowLeft size={12} /> Ensayos
      </button>

      <h1 className="text-2xl font-black text-primary mb-1">
        {ensayo.titulo || "Sin título"}
      </h1>
      <p
        className="text-micro font-mono uppercase tracking-wider mb-6"
        style={{ color: "color-mix(in srgb, var(--foreground) 30%, transparent)" }}
      >
        {formatFecha(ensayo.updated_at)}
      </p>

      <PlainMarkdownPreview
        style={{ padding: 0, fontSize: "1rem" }}
        value={ensayo.contenido || ""}
      />
    </div>
  );
}

export default function EnsayosPublicos() {
  const { items, loading, error } = useEnsayosPublicos();
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeEnsayo = useMemo(
    () => items.find((e) => e.id === activeId) ?? null,
    [items, activeId],
  );

  return (
    <div className="w-full bg-bg-main min-h-screen">
      {loading ? (
        <div className="flex items-center justify-center py-32 text-primary/30">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-32 text-primary/20">
          <FileText size={48} strokeWidth={1} />
          <p className="text-sm font-black uppercase tracking-widest">
            No se pudieron cargar los ensayos
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeEnsayo ? (
            <motion.div
              key={activeEnsayo.id}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DetalleEnsayo ensayo={activeEnsayo} onBack={() => setActiveId(null)} />
            </motion.div>
          ) : (
            <motion.div
              key="lista"
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ListaEnsayos items={items} onSelect={setActiveId} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

"use client";

/**
 * SelectorMiembros.tsx
 * ──────────────────────
 * Selector de miembros de un grupo: lista los miembros actuales con opción
 * de quitar, y un buscador desplegable para añadir más. Extraído de
 * EditorGrupo.tsx — es una pieza de UI usada dentro del formulario de grupo.
 *
 * Ruta destino:
 *   src/features/editorGarlia/components/grupos/SelectorMiembros.tsx
 */

import { Loader2, Plus, Search, X } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  useEntidades,
  GRUPO_TIPO_CONFIG,
  type EntidadMin,
  type GrupoTipo,
} from "@/domains/garlia/_legacy/hooks/grupos/useGrupos";

export function SelectorMiembros({
  tipo,
  miembro_ids,
  onChange,
  onClickMiembro,
}: {
  tipo: GrupoTipo;
  miembro_ids: string[];
  onChange: (ids: string[]) => void;
  onClickMiembro?: (id: string, tabla: string) => void;
}) {
  const cfg = GRUPO_TIPO_CONFIG[tipo];
  const { entidades, loading } = useEntidades(cfg.tabla);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const miembros = useMemo(
    () => entidades.filter((e) => miembro_ids.includes(e.id)),
    [entidades, miembro_ids],
  );

  const disponibles = useMemo(
    () =>
      entidades.filter((e) => {
        const noEsta = !miembro_ids.includes(e.id);
        const matchSearch = (e.nombre ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());
        return noEsta && matchSearch;
      }),
    [entidades, miembro_ids, search],
  );

  const toggle = (id: string) => {
    if (miembro_ids.includes(id)) {
      onChange(miembro_ids.filter((x) => x !== id));
    } else {
      onChange([...miembro_ids, id]);
    }
  };

  const getImg = (e: EntidadMin) =>
    tipo === "personajes" ? e.img_url : e.imagen_url;
  const getSubtitle = (e: EntidadMin) => {
    if (tipo === "personajes")
      return [e.especie, e.reino].filter(Boolean).join(" · ");
    if (tipo === "criaturas") return e.habitat;
    if (tipo === "items") return e.categoria;
    return undefined;
  };

  return (
    <div className="space-y-2">
      {miembros.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-1 py-0.5 mb-0.5">
            <span className="text-micro font-black uppercase tracking-[0.3em] text-primary/30">
              Miembros · {miembros.length}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
            {miembros.map((e) => {
              const img = getImg(e);
              const sub = getSubtitle(e);
              return (
                <div
                  key={e.id}
                  className="relative flex flex-col items-center gap-1 p-1.5 rounded-lg border border-primary/[0.07] bg-primary/[0.02] hover:bg-primary/[0.05] transition-colors group"
                >
                  {/* Remove button */}
                  <button
                    className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded flex items-center justify-center text-primary/0 group-hover:text-primary/30 hover:!text-red-400 transition-colors z-10"
                    type="button"
                    onClick={() => toggle(e.id)}
                  >
                    <X size={8} />
                  </button>

                  {/* Whole card is clickable */}
                  <button
                    className="w-full flex flex-col items-center gap-1"
                    type="button"
                    onClick={() => onClickMiembro?.(e.id, cfg.tabla)}
                  >
                    <div className="w-full aspect-square rounded-md overflow-hidden border border-primary/10 bg-primary/5 flex items-center justify-center">
                      {img ? (
                        <Image
                          alt={e.nombre}
                          className="w-full h-full object-cover"
                          src={img}
                        />
                      ) : (
                        <cfg.Icon className="text-primary/25" size={14} />
                      )}
                    </div>
                    <p className="text-micro font-black text-primary/60 truncate w-full text-center leading-tight uppercase tracking-wide">
                      {e.nombre}
                    </p>
                    {sub && (
                      <p className="text-micro text-primary/25 truncate w-full text-center leading-tight">
                        {sub}
                      </p>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div ref={ref} className="relative">
        <button
          className="w-full flex items-center justify-center gap-1 py-1 rounded-lg border border-dashed text-micro font-black uppercase tracking-widest transition-all"
          style={{
            borderColor: `color-mix(in srgb, ${cfg.color} 20%, transparent)`,
            color: `color-mix(in srgb, ${cfg.color} 50%, transparent)`,
          }}
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus size={8} /> Agregar {cfg.label.toLowerCase()}
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div
              className="absolute z-50 bottom-full left-0 right-0 mb-1.5 rounded-xl border shadow-xl overflow-hidden"
              style={{
                background: "var(--bg-main)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 12%, transparent)",
              }}
            >
              <div
                className="p-2 border-b"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <div className="relative">
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary/25"
                    size={9}
                  />
                  <input
                    autoFocus
                    className="w-full bg-primary/5 border border-primary/10 rounded-lg pl-7 pr-2 py-1.5 text-micro outline-none focus:border-primary/25 text-primary placeholder:text-primary/25"
                    placeholder={`Buscar ${cfg.labelPlural.toLowerCase()}…`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto p-1">
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2
                      className="animate-spin text-primary/20"
                      size={14}
                    />
                  </div>
                ) : disponibles.length === 0 ? (
                  <p className="text-micro text-primary/25 text-center py-4 italic">
                    {search
                      ? "Sin resultados"
                      : `Todos los ${cfg.labelPlural.toLowerCase()} ya están en el grupo`}
                  </p>
                ) : (
                  disponibles.map((e) => {
                    const img = getImg(e);
                    const sub = getSubtitle(e);
                    return (
                      <button
                        key={e.id}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-primary/6 transition-colors"
                        type="button"
                        onMouseDown={() => {
                          toggle(e.id);
                          setSearch("");
                        }}
                      >
                        <div className="shrink-0 w-6 h-6 rounded-lg overflow-hidden border border-primary/10 bg-primary/5 flex items-center justify-center">
                          {img ? (
                            <Image
                              alt={e.nombre}
                              className="w-full h-full object-cover"
                              src={img}
                            />
                          ) : (
                            <cfg.Icon className="text-primary/25" size={10} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-micro font-medium text-primary/80 truncate block">
                            {e.nombre}
                          </span>
                          {sub && (
                            <span className="text-micro text-primary/30 truncate block">
                              {sub}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

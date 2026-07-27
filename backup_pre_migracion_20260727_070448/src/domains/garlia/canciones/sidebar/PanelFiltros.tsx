"use client";

import { ChevronDown, Eye, EyeOff } from "lucide-react";
import React from "react";

import { Chip } from "@/ui/Chip";
import {
  ESTADOS,
  FILTROS_VACIOS,
} from "@/domains/garlia/canciones/constants";
import type { Filtros } from "@/domains/garlia/canciones/types";

const DropdownFiltro = ({
  label,
  campo,
  opciones,
  filtros,
  onChange,
}: {
  label: string;
  campo: keyof Filtros;
  opciones: string[];
  filtros: Filtros;
  onChange: (f: Filtros) => void;
}) => (
  <div>
    <p className="text-micro font-black uppercase text-primary/30 tracking-widest mb-2">
      {label}
    </p>
    <div className="relative">
      <select
        className="w-full appearance-none bg-bg-main border border-primary/15 rounded-xl px-3 py-2 text-micro font-black uppercase text-primary outline-none focus:border-primary/40 transition-colors cursor-pointer pr-7"
        value={filtros[campo] as string}
        onChange={(e) => onChange({ ...filtros, [campo]: e.target.value })}
      >
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/30 pointer-events-none"
        size={11}
      />
    </div>
  </div>
);

export const PanelFiltros = ({
  filtros,
  onChange,
  opciones,
}: {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  opciones: {
    idiomas: string[];
    cantantes: string[];
    compositores: string[];
    personajes: string[];
  };
}) => {
  const toggle = (k: keyof Filtros, v: string) =>
    onChange({ ...filtros, [k]: (filtros[k] === v ? "" : v) as any });

  return (
    <div className="space-y-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-micro font-black uppercase text-primary/30 tracking-widest mb-2">
            Estado
          </p>
          <div className="flex gap-1 flex-wrap">
            {ESTADOS.map((e) => (
              <Chip
                key={e}
                active={filtros.estado === e}
                onClick={() => toggle("estado", e)}
              >
                {e === "EN PROCESO" ? "WIP" : e === "TERMINADA" ? "✓" : "…"}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="text-micro font-black uppercase text-primary/30 tracking-widest mb-2">
            Visibilidad
          </p>
          <div className="flex gap-1 flex-wrap">
            <Chip
              active={filtros.visible === "true"}
              onClick={() => toggle("visible", "true")}
            >
              <Eye className="inline mr-0.5" size={10} />
              Visible
            </Chip>
            <Chip
              active={filtros.visible === "false"}
              onClick={() => toggle("visible", "false")}
            >
              <EyeOff className="inline mr-0.5" size={10} />
              Oculta
            </Chip>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {opciones.idiomas.length > 0 && (
          <DropdownFiltro
            campo="idioma"
            filtros={filtros}
            label="Idioma"
            opciones={opciones.idiomas}
            onChange={onChange}
          />
        )}
        {opciones.personajes.length > 0 && (
          <DropdownFiltro
            campo="personaje"
            filtros={filtros}
            label="Personaje"
            opciones={opciones.personajes}
            onChange={onChange}
          />
        )}
      </div>

      {(opciones.cantantes.length > 0 || opciones.compositores.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {opciones.cantantes.length > 0 && (
            <DropdownFiltro
              campo="cantante"
              filtros={filtros}
              label="Cantante"
              opciones={opciones.cantantes}
              onChange={onChange}
            />
          )}
          {opciones.compositores.length > 0 && (
            <DropdownFiltro
              campo="compositor"
              filtros={filtros}
              label="Compositor"
              opciones={opciones.compositores}
              onChange={onChange}
            />
          )}
        </div>
      )}

      {Object.values(filtros).some(Boolean) && (
        <button
          className="text-micro font-black uppercase tracking-widest"
          style={{ color: "var(--callout-danger-border)" }}
          onClick={() => onChange(FILTROS_VACIOS)}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          ✕ Limpiar filtros
        </button>
      )}
    </div>
  );
};

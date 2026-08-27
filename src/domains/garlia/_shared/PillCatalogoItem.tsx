"use client";

/**
 * PillCatalogoItem.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Pill de catálogo: mismo diseño y comportamiento que CompuestoCasilla en
 * elementos/CompuestosPage.tsx (chip redondo compacto, solo nombre, borde
 * sutil que se resalta al seleccionar) — extraído acá para reusarlo tal
 * cual en los catálogos de Minerales (Granos/Vetas/Formaciones) y Biología
 * (Tejidos/Células/Sistemas/Órganos), que antes usaban una tarjeta
 * rectangular en grid de 3 columnas (GridSimple/GridCatalogoGrupo).
 *
 * A diferencia de CompuestoCasilla (que muestra un puntito de "estable"
 * calculado a partir del perfil atómico), acá el indicador opcional a la
 * izquierda es un ícono genérico (mismo que ya usaba cada catálogo para
 * distinguir Grano/Veta/Órgano/Formación) — mismo lugar visual, distinto
 * contenido porque estos catálogos no tienen noción de "estable".
 */

import React from "react";

export function PillCatalogoItem({
  nombre,
  icono,
  seleccionado,
  onClick,
}: {
  nombre: string;
  icono?: React.ReactNode;
  seleccionado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={nombre}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-bold tracking-wide transition-colors truncate max-w-full ${
        seleccionado
          ? "text-primary border border-primary/40 ring-2 ring-primary/30"
          : "hover:bg-primary/10 text-primary/70 border border-primary/15"
      }`}
    >
      {icono}
      <span className="truncate">{nombre || "(sin nombre)"}</span>
    </button>
  );
}

/**
 * Contenedor de grupo: mismo espíritu que el bloque de CompuestosPage
 * (título micro + flex-wrap de pills), para no repetir el mismo wrapper
 * en cada catálogo que adopte PillCatalogoItem.
 */
export function GridPills<T extends { id: string; nombre: string }>({
  items,
  loading,
  icono,
  seleccionadoId,
  onSeleccionar,
  labelVacio,
}: {
  items: T[];
  loading?: boolean;
  icono?: React.ReactNode;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  labelVacio: string;
}) {
  if (loading && items.length === 0) {
    return <p className="text-micro text-primary/25 italic py-2">Cargando…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-4 text-micro text-primary/25 text-center border border-dashed border-primary/10 rounded-md">
        Sin {labelVacio} todavía
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <PillCatalogoItem
          key={item.id}
          nombre={item.nombre}
          icono={icono}
          seleccionado={seleccionadoId === item.id}
          onClick={() => onSeleccionar(item.id)}
        />
      ))}
    </div>
  );
}

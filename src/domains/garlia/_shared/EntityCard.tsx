"use client";

/**
 * EntityCard
 * ───────────────────────────────────────────────────────────────────────────
 * Tarjeta usada en las páginas combinadas en grid (Entidades, Magia,
 * Organización, Geografía). Muestra imagen (o ícono de fallback) + nombre.
 * Sin buscador ni lista — el grid entero es la interfaz de selección.
 *
 * onToggleFavorite es opcional: si se pasa, aparece una estrella en la
 * esquina superior derecha (visible siempre si isFavorite=true, o al hacer
 * hover si no) para marcar/desmarcar sin entrar al editor de la entidad.
 */

import { Star } from "lucide-react";
import React from "react";

interface Props {
  nombre: string;
  imageUrl?: string | null;
  Icon: React.ElementType;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /**
   * Click con el botón del medio del mouse (rueda) sobre la miniatura.
   * Opcional — si no se pasa, la card ignora el click del medio y el
   * navegador hace su comportamiento default (auto-scroll). Se usa para
   * abrir el panel flotante en pantalla completa (ver FullscreenEntityPanel)
   * sin perder el lugar actual, a diferencia del click normal.
   */
  onMiddleClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  subtitle?: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Contenido custom para la miniatura, reemplaza imagen/ícono por defecto
   *  (ej. preview de trazos de una runa). Si no se pasa, usa imageUrl/Icon. */
  visual?: React.ReactNode;
}

export function EntityCard({
  nombre,
  imageUrl,
  Icon,
  onClick,
  onMiddleClick,
  subtitle,
  isFavorite,
  onToggleFavorite,
  visual,
}: Props) {
  return (
    <div className="group/card relative flex flex-col items-center gap-1 p-1 rounded-lg transition-colors hover:bg-primary/5 text-center">
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          title={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
          className={`absolute top-0.5 right-0.5 z-10 p-1 rounded-md transition-opacity ${
            isFavorite
              ? "opacity-100"
              : "opacity-0 group-hover/card:opacity-100"
          }`}
        >
          <Star
            size={13}
            className={isFavorite ? "text-accent fill-accent" : "text-primary/40"}
          />
        </button>
      )}
      <button
        type="button"
        onClick={onClick}
        onMouseDown={(e) => {
          // Click del medio (rueda, button === 1): evita el auto-scroll
          // default del navegador y abre el panel flotante en pantalla
          // completa en vez del comportamiento de click normal.
          if (e.button === 1 && onMiddleClick) {
            e.preventDefault();
            onMiddleClick(e);
          }
        }}
        onAuxClick={(e) => {
          // Algunos navegadores disparan auxclick (no mousedown) para el
          // botón del medio — prevenimos el default acá también.
          if (e.button === 1 && onMiddleClick) {
            e.preventDefault();
          }
        }}
        className="flex flex-col items-center gap-1 w-full"
      >
        <div className="w-full aspect-square rounded-xl overflow-hidden bg-primary/5 border border-primary/10 flex items-center justify-center group-hover/card:border-primary/25 transition-colors">
          {visual ? (
            visual
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={nombre} className="w-full h-full object-cover" />
          ) : (
            <Icon size={22} className="text-primary/20" strokeWidth={1.5} />
          )}
        </div>
        <span className="text-xs font-semibold text-primary/80 truncate w-full leading-tight">
          {nombre}
        </span>
        {subtitle && (
          <span className="text-micro text-primary/35 truncate w-full leading-tight">
            {subtitle}
          </span>
        )}
      </button>
    </div>
  );
}

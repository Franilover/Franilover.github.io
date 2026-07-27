"use client";

import { AnimatePresence } from "framer-motion";
import {
  User,
  Sword,
  Package,
  ShieldCheck,
  X,
  Star,
  Music2,
  ChevronRight,
  MapPin,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { MotionDiv } from "@/components/ui/Motion";
import { estaEnTauri, navegarRutaDinamica } from "@/lib/utils/navegacionTauri";

export interface Descubrimiento {
  tipo: "item" | "criatura" | "personaje";
  entidad_id: string;
  fecha_descubrimiento: string;
  nombre?: string;
  descripcion?: string;
  imagen_url?: string;
  img_url?: string;
  categoria?: string;
  rareza?: string;
  habitat?: string;
  alma?: string;
  reino?: string;
  especie?: string;
}

export interface ItemInventario {
  equipado: boolean;
  items: {
    id: string;
    nombre: string;
    categoria: string;
    imagen_url?: string;
    descripcion?: string;
  };
}

export type EntidadModal =
  | { tipo: "item_inv"; data: ItemInventario }
  | {
      tipo: "item" | "criatura" | "personaje" | "reino" | "ciudad";
      data: Descubrimiento;
    };

export function ModalDetalle({
  entidad,
  onClose,
  canciones,
  cargandoCanciones,
}: {
  entidad: EntidadModal;
  onClose: () => void;
  canciones?: {
    id: string;
    titulo: string;
    portada_url?: string;
    info_cancion?: string;
  }[];
  cargandoCanciones?: boolean;
}) {
  const isItemInv = entidad.tipo === "item_inv";
  const isItem = isItemInv || entidad.tipo === "item";
  const isCriatura = entidad.tipo === "criatura";
  const isReino = entidad.tipo === "reino";
  const esCiudad = entidad.tipo === "ciudad";

  const nombre = isItemInv
    ? (entidad.data as ItemInventario).items.nombre
    : ((entidad.data as Descubrimiento).nombre ??
      (isCriatura
        ? "Criatura Desconocida"
        : isReino
          ? "Reino"
          : esCiudad
            ? "Ciudad"
            : entidad.tipo === "item"
              ? "Objeto"
              : "Personaje"));

  const descripcion = isItemInv
    ? (entidad.data as ItemInventario).items.descripcion
    : (entidad.data as Descubrimiento).descripcion;

  const imagen = isItemInv
    ? (entidad.data as ItemInventario).items.imagen_url
    : ((entidad.data as Descubrimiento).imagen_url ??
      (entidad.data as Descubrimiento).img_url);

  const tags: string[] = [];
  if (isItemInv) {
    const d = (entidad.data as ItemInventario).items;
    if (d.categoria) tags.push(d.categoria);
    if ((entidad.data as ItemInventario).equipado) tags.push("Equipado");
  } else {
    const d = entidad.data as Descubrimiento;
    if (d.categoria) tags.push(d.categoria);
    if (d.rareza) tags.push(d.rareza!);
    if (d.habitat) tags.push(d.habitat!);
    if (d.alma) tags.push(`Alma ${d.alma}`);
    if (d.reino) tags.push(d.reino!);
    if (d.especie) tags.push(d.especie!);
  }

  const IconComp =
    isReino || esCiudad ? MapPin : isItem ? Package : isCriatura ? Sword : User;

  return (
    <AnimatePresence>
      <MotionDiv
        key="backdrop"
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-40 bg-primary/10 backdrop-blur-sm"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
      />
      <MotionDiv
        key="modal"
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <div
          className="pointer-events-auto w-full max-w-sm overflow-hidden"
          style={{
            background: "var(--white-custom)",
            borderRadius: "var(--radius-card)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 16%, transparent)",
            boxShadow:
              "0 8px 24px color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hero image */}
          <div
            className="relative h-44 flex items-center justify-center overflow-hidden"
            style={{
              background:
                "color-mix(in srgb, var(--primary) 4%, var(--bg-main))",
            }}
          >
            {imagen ? (
              <Image
                alt={nombre}
                className="w-full h-full object-cover"
                src={imagen}
              />
            ) : (
              <IconComp
                size={48}
                style={{
                  color: "color-mix(in srgb, var(--primary) 12%, transparent)",
                }}
              />
            )}

            {/* Fade so bottom content is readable */}
            <div
              className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, var(--white-custom), transparent)",
              }}
            />

            {/* Close btn */}
            <button
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center transition-opacity hover:opacity-70"
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-btn)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
              }}
              onClick={onClose}
            >
              <X size={14} style={{ color: "var(--primary)" }} />
            </button>

            {/* Type badge */}
            <div
              className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1"
              style={{ background: "var(--primary)", borderRadius: "2px" }}
            >
              <IconComp size={9} style={{ color: "var(--btn-text, white)" }} />
              <span
                className="text-micro font-black uppercase tracking-widest"
                style={{ color: "var(--btn-text, white)" }}
              >
                {isReino
                  ? "reino"
                  : esCiudad
                    ? "ciudad"
                    : isItem
                      ? "objeto"
                      : isCriatura
                        ? "criatura"
                        : "personaje"}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Name */}
            <div className="flex items-start gap-2">
              <div
                className="w-0.5 h-5 shrink-0 mt-0.5 rounded-full"
                style={{ background: "var(--primary)" }}
              />
              <h2
                className="text-xl font-black uppercase tracking-tight leading-tight"
                style={{ color: "var(--primary)" }}
              >
                {nombre}
              </h2>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 px-2 py-0.5 text-micro font-black uppercase tracking-wider"
                    style={{
                      background:
                        i === 0
                          ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                          : "color-mix(in srgb, var(--primary) 4%, transparent)",
                      color:
                        "color-mix(in srgb, var(--primary) 68%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                      borderRadius: "2px",
                    }}
                  >
                    <Star size={7} />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div
              className="pt-3"
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
              }}
            >
              {descripcion ? (
                <p
                  className="text-micro leading-relaxed"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 58%, transparent)",
                  }}
                >
                  {descripcion}
                </p>
              ) : (
                <p
                  className="text-micro italic font-black uppercase tracking-wider flex items-center gap-2"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 18%, transparent)",
                  }}
                >
                  — Sin descripción disponible
                </p>
              )}
            </div>

            {/* Canciones del personaje — solo para personajes */}
            {!isItem && !isCriatura && !isReino && !esCiudad && (
              <div
                className="pt-3"
                style={{
                  borderTop:
                    "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <Music2
                      size={10}
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 28%, transparent)",
                      }}
                    />
                    <span
                      className="text-micro font-black uppercase tracking-widest italic"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 28%, transparent)",
                      }}
                    >
                      Canciones
                    </span>
                  </div>
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                </div>
                {cargandoCanciones ? (
                  <p
                    className="text-micro italic text-center py-3"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  >
                    Cargando canciones…
                  </p>
                ) : !canciones || canciones.length === 0 ? (
                  <p
                    className="text-micro italic text-center py-3"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 20%, transparent)",
                    }}
                  >
                    &quot;Este personaje no tiene canciones aún…&quot;
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {canciones.map((cancion, i) => (
                      <Link
                        key={cancion.id ?? i}
                        className="group flex items-center gap-3 px-3 py-2.5 transition-all"
                        href={`/garlia/canciones/${cancion.id}`}
                        onClick={(e) => {
                          if (estaEnTauri()) {
                            e.preventDefault();
                            navegarRutaDinamica(`/garlia/canciones/${cancion.id}`);
                          }
                        }}
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 3%, var(--white-custom))",
                          border:
                            "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                          borderRadius: "var(--radius-btn)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "color-mix(in srgb, var(--primary) 22%, transparent)";
                          (e.currentTarget as HTMLElement).style.background =
                            "color-mix(in srgb, var(--primary) 6%, var(--white-custom))";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "color-mix(in srgb, var(--primary) 8%, transparent)";
                          (e.currentTarget as HTMLElement).style.background =
                            "color-mix(in srgb, var(--primary) 3%, var(--white-custom))";
                        }}
                      >
                        {cancion.portada_url &&
                        !cancion.portada_url.includes("placeholder") ? (
                          <div
                            className="w-10 h-10 shrink-0 overflow-hidden"
                            style={{
                              borderRadius: "var(--radius-btn)",
                              background:
                                "color-mix(in srgb, var(--primary) 8%, transparent)",
                            }}
                          >
                            <img
                              alt={cancion.titulo}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              src={cancion.portada_url}
                            />
                          </div>
                        ) : (
                          <div
                            className="w-10 h-10 shrink-0 flex items-center justify-center"
                            style={{
                              borderRadius: "var(--radius-btn)",
                              background:
                                "color-mix(in srgb, var(--primary) 6%, transparent)",
                            }}
                          >
                            <Music2
                              size={13}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 30%, transparent)",
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span
                            className="font-serif italic text-sm truncate block group-hover:underline"
                            style={{ color: "var(--primary)" }}
                          >
                            {cancion.titulo ?? `Canción ${i + 1}`}
                          </span>
                          {cancion.info_cancion && (
                            <span
                              className="text-micro font-black uppercase tracking-wider truncate block mt-0.5"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 35%, transparent)",
                              }}
                            >
                              {cancion.info_cancion}
                            </span>
                          )}
                        </div>
                        <ChevronRight
                          className="group-hover:translate-x-0.5 transition-transform"
                          size={13}
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 25%, transparent)",
                            flexShrink: 0,
                          }}
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Equipped badge */}
            {isItemInv && (entidad.data as ItemInventario).equipado && (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 5%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderRadius: "2px",
                }}
              >
                <ShieldCheck
                  size={13}
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 50%, transparent)",
                  }}
                />
                <span
                  className="text-micro font-black uppercase tracking-widest"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 50%, transparent)",
                  }}
                >
                  Actualmente equipado
                </span>
              </div>
            )}
          </div>
        </div>
      </MotionDiv>
    </AnimatePresence>
  );
}

export function EntidadCard({
  imagen,
  nombre,
  sub,
  icono,
  onClick,
}: {
  imagen?: string;
  nombre: string;
  sub?: string;
  icono: React.ReactNode;
  onClick: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      className="text-left cursor-pointer w-full overflow-hidden"
      style={{
        background: "var(--white-custom)",
        border: `1px solid ${
          hovered
            ? "color-mix(in srgb, var(--primary) 28%, transparent)"
            : "color-mix(in srgb, var(--primary) 9%, transparent)"
        }`,
        borderRadius: "var(--radius-card)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.16s ease",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Desktop image area */}
      <div
        className="hidden md:flex w-full items-center justify-center overflow-hidden"
        style={{
          height: "115px",
          background: hovered
            ? "color-mix(in srgb, var(--primary) 6%, var(--bg-main))"
            : "color-mix(in srgb, var(--primary) 3%, var(--bg-main))",
          transition: "background 0.16s ease",
        }}
      >
        {imagen ? (
          <img
            alt={nombre}
            className="w-full h-full object-contain p-3"
            src={imagen}
            style={{
              transform: hovered ? "scale(1.04)" : "scale(1)",
              transition: "transform 0.16s ease",
            }}
          />
        ) : (
          <div
            style={{
              color: hovered
                ? "color-mix(in srgb, var(--primary) 30%, transparent)"
                : "color-mix(in srgb, var(--primary) 13%, transparent)",
              transition: "color 0.16s ease",
            }}
          >
            {icono}
          </div>
        )}
      </div>

      {/* Bottom info strip */}
      <div
        className="flex md:flex-col items-center md:items-start gap-3 md:gap-0 p-3 md:px-3 md:pt-2.5 md:pb-3"
        style={{
          borderTop:
            "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
        }}
      >
        {/* Mobile thumbnail */}
        <div
          className="md:hidden w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--primary) 4%, transparent)",
            borderRadius: "var(--radius-btn)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
            color: "color-mix(in srgb, var(--primary) 28%, transparent)",
          }}
        >
          {imagen ? (
            <Image
              alt={nombre}
              className="w-full h-full object-contain p-1"
              src={imagen}
            />
          ) : (
            icono
          )}
        </div>

        <div className="flex-1 min-w-0 md:w-full">
          <p
            className="text-micro font-black uppercase tracking-tight truncate leading-tight"
            style={{ color: "var(--primary)" }}
          >
            {nombre}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Star
              size={7}
              style={{
                color: "color-mix(in srgb, var(--primary) 22%, transparent)",
                flexShrink: 0,
              }}
            />
            <p
              className="text-micro font-black uppercase tracking-widest truncate"
              style={{
                color: "color-mix(in srgb, var(--primary) 30%, transparent)",
              }}
            >
              {sub ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

export function EmptyTab({ label }: { label: string }) {
  return (
    <div className="col-span-full py-20 text-center flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-px"
          style={{
            background: "color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        />
        <Star
          size={10}
          style={{
            color: "color-mix(in srgb, var(--primary) 16%, transparent)",
          }}
        />
        <div
          className="w-10 h-px"
          style={{
            background: "color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        />
      </div>
      <p
        className="text-micro font-black uppercase tracking-[0.3em] italic"
        style={{ color: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
      >
        {label}
      </p>
    </div>
  );
}

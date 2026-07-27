"use client";
import { AnimatePresence } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { MotionDiv } from "@/ui/Motion";

const SESSION_TS = Date.now();

interface SmartImageProps {
  src: string;
  alt?: string;
  className?: string;
  contain?: boolean;
  priority?: boolean;
  cacheBust?: boolean;
  // Ícono a mostrar si la imagen no carga (URL rota, borrada, portada
  // faltante, etc.). Antes esto no existía: cuando el <img> fallaba, el
  // navegador caía a su propio manejo nativo de imagen rota, que muestra
  // el texto `alt` — y como este componente siempre lo mete en una caja
  // chica con `overflow-hidden`, lo único que quedaba visible era la
  // primera letra del `alt`, gigante. Con esto mostramos un ícono en vez
  // de dejar que el navegador improvise.
  fallbackIcon?: React.ReactNode;
}

export const SmartImage = ({
  src,
  alt,
  className,
  contain = false,
  priority = false,
  cacheBust = false,
  fallbackIcon,
}: SmartImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const srcFinal =
    src && cacheBust
      ? `${src}${src.includes('?') ? '&' : '?'}v=${SESSION_TS}`
      : src;

  // Si cambia el src (ej. otra canción/libro), dale otra chance: puede que
  // la nueva URL sí cargue bien aunque la anterior haya fallado.
  useEffect(() => {
    setErrored(false);
    setLoaded(false);
  }, [srcFinal]);

  if (!src || errored) {
    return (
      <div
        className={`relative overflow-hidden bg-primary/5 flex items-center justify-center ${className}`}
      >
        <span className="text-primary/20">
          {fallbackIcon ?? <ImageOff size={18} />}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-primary/5 ${className}`}>
      <AnimatePresence>
        {!loaded && (
          <MotionDiv
            key="skeleton"
            className="absolute inset-0 z-10 animate-pulse bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5"
            exit={{ opacity: 0 }}
            initial={{ opacity: 1 }}
          />
        )}
      </AnimatePresence>

      <MotionDiv
        animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.05 }}
        className="w-full h-full"
        initial={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <img
          alt={alt || "Imagen de Franilover Art"}
          className={`w-full h-full transition-all duration-700 ${
            contain ? 'object-contain' : 'object-cover'
          } ${loaded ? 'blur-0' : 'blur-xl'}`}
          loading={priority ? "eager" : "lazy"}
          src={srcFinal}
          onError={() => setErrored(true)}
          onLoad={() => setLoaded(true)}
        />
      </MotionDiv>
    </div>
  );
};
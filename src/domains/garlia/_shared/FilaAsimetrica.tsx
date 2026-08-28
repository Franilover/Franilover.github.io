"use client";

/**
 * FilaAsimetrica.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Fila de 2 o 3 bloques (Compuestos/Estructuras/Materiales,
 * Reacciones/Procesos/Fenómenos, Física·minerales/Biología) que decide su
 * propio layout según cuántos ítems tiene cada uno:
 *
 * - Si los bloques tienen una cantidad de ítems comparable, se reparten en
 *   columnas iguales (mitad y mitad con 2 bloques, tercios con 3).
 * - Si uno de los bloques tiene MUCHOS más ítems que el resto, ese bloque
 *   pasa a ocupar 2/3 del ancho:
 *   - Con 3 bloques, los otros dos se apilan verticalmente en el 1/3
 *     restante (evita el hueco vacío enorme que quedaba al lado de un
 *     bloque con pocos ítems, ej. Compuestos con ~90 vs Estructuras con
 *     ~35 y Materiales con ~24).
 *   - Con 2 bloques, el otro simplemente ocupa el 1/3 restante (no hay
 *     nada más para apilar).
 *
 * "Muchos más" = al menos 1.5x la suma de los demás (umbral simple y
 * legible, no una fórmula de proporciones). Cuando hay empate entre dos
 * candidatos a "grande", se prioriza el primero (izquierda) para mantener
 * el orden visual estable en vez de saltar entre layouts al cambiar un
 * ítem cerca del umbral.
 */

import React from "react";

interface Bloque {
  key: string;
  titulo: string;
  total: number;
  contenido: React.ReactNode;
}

const UMBRAL_DOMINANCIA = 1.5;

function elegirBloqueGrande(bloques: Bloque[]): number | null {
  if (bloques.length !== 2 && bloques.length !== 3) return null;
  for (let i = 0; i < bloques.length; i++) {
    const resto = bloques.reduce((suma, b, j) => (j === i ? suma : suma + b.total), 0);
    if (bloques[i].total >= UMBRAL_DOMINANCIA * Math.max(resto, 1)) {
      return i;
    }
  }
  return null;
}

function Cabecera({ titulo }: { titulo: string }) {
  return (
    <div className="px-3 pt-3 text-primary/40 text-center">
      <p className="text-micro font-black uppercase tracking-widest">{titulo}</p>
    </div>
  );
}

export function FilaAsimetrica({ bloques }: { bloques: Bloque[] }) {
  const idxGrande = elegirBloqueGrande(bloques);
  const columnas = bloques.length;

  if (idxGrande === null) {
    // Reparto simétrico — columnas iguales (mitad y mitad con 2 bloques,
    // tercios con 3), apiladas en mobile. Clase explícita (no interpolada)
    // porque Tailwind purga clases armadas por template string en runtime.
    const colsClase = columnas === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
    return (
      <div className={`grid grid-cols-1 ${colsClase} border-t border-primary/10`}>
        {bloques.map((bloque, i) => (
          <div
            key={bloque.key}
            className={`min-w-0 border-b md:border-b-0 border-primary/10 ${
              i < bloques.length - 1 ? "md:border-r" : ""
            }`}
          >
            <Cabecera titulo={bloque.titulo} />
            {bloque.contenido}
          </div>
        ))}
      </div>
    );
  }

  const grande = bloques[idxGrande];
  const chicos = bloques.filter((_, i) => i !== idxGrande);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 border-t border-primary/10">
      <div className="min-w-0 md:col-span-2 border-b md:border-b-0 md:border-r border-primary/10">
        <Cabecera titulo={grande.titulo} />
        {grande.contenido}
      </div>
      <div className="min-w-0 flex flex-col">
        {chicos.map((bloque, i) => (
          <div
            key={bloque.key}
            className={i < chicos.length - 1 ? "border-b border-primary/10" : ""}
          >
            <Cabecera titulo={bloque.titulo} />
            {bloque.contenido}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

/**
 * PanelRunasLogradas.tsx
 * ────────────────────────────────────────────────────────────────────
 * Debajo de "Mis notas" en /garlia/runas: cada vez que alguna celda del
 * dibujo actual matchea una runa guardada con score ≥ 98%, se registra
 * automáticamente acá — nombre de la runa + el trazo tal cual lo dibujó
 * el jugador (no la plantilla admin), para que vea su propio logro.
 *
 * Detección en vivo: `interpretacion.resultadosPorCelda` se recalcula en
 * cada cambio de trazos (ver useResultadoDibujoLibre), sin depender de
 * "finalizar" el dibujo — no hace falta que el jugador termine todo el
 * tablero para que una runa individual bien dibujada quede registrada.
 *
 * Persistencia en localStorage (mismo criterio que PanelNotasJugador):
 * sin backend, por navegador/dispositivo. Se deduplica por runaId — solo
 * se guarda el primer logro de cada runa (no un historial de reintentos).
 */

import { Award } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { InterpretacionDibujoLibre } from "../interpretarDibujoLibre";
import { RunaThumbnail } from "../RunaThumbnail";
import type { Punto } from "../dollarOneRecognizer";

const CLAVE_LOGROS = "garlia_runas_logradas_jugador";
const UMBRAL_LOGRO = 0.98;

type RunaLograda = {
  runaId: string;
  nombre: string;
  /** El trazo real dibujado por el jugador cuando alcanzó el umbral. */
  trazo: Punto[];
  score: number;
  logradoEn: string; // ISO date
};

function cargarLogros(): RunaLograda[] {
  try {
    const guardado = window.localStorage.getItem(CLAVE_LOGROS);
    if (!guardado) return [];
    const parsed = JSON.parse(guardado);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarLogros(logros: RunaLograda[]) {
  try {
    window.localStorage.setItem(CLAVE_LOGROS, JSON.stringify(logros));
  } catch {
    // Sin persistencia no es crítico — el registro sigue en memoria.
  }
}

export function PanelRunasLogradas({
  interpretacion,
}: {
  interpretacion: InterpretacionDibujoLibre | null;
}) {
  const [logros, setLogros] = useState<RunaLograda[]>([]);
  const cargadoRef = useRef(false);

  // Carga inicial desde localStorage, solo en cliente.
  useEffect(() => {
    setLogros(cargarLogros());
    cargadoRef.current = true;
  }, []);

  // Cada vez que cambia la interpretación en vivo, revisa si alguna
  // celda alcanzó el umbral y todavía no está registrada.
  useEffect(() => {
    if (!cargadoRef.current || !interpretacion) return;

    const nuevos: RunaLograda[] = [];
    for (const resultado of Object.values(interpretacion.resultadosPorCelda)) {
      const top = resultado.ranking[0];
      if (!top || top.score < UMBRAL_LOGRO || !resultado.trazo) continue;
      const yaRegistrada = logros.some((l) => l.runaId === top.runaId);
      const yaEnEsteLote = nuevos.some((l) => l.runaId === top.runaId);
      if (yaRegistrada || yaEnEsteLote) continue;
      nuevos.push({
        runaId: top.runaId,
        nombre: top.nombre,
        trazo: resultado.trazo,
        score: top.score,
        logradoEn: new Date().toISOString(),
      });
    }

    if (nuevos.length > 0) {
      setLogros((prev) => {
        const actualizado = [...nuevos, ...prev];
        guardarLogros(actualizado);
        return actualizado;
      });
    }
    // Solo dependemos de `interpretacion` — `logros` se lee del closure
    // más reciente vía el updater funcional de setLogros arriba, así
    // evitamos que este efecto se re-dispare por sus propios cambios.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interpretacion]);

  return (
    <div className="w-full rounded-2xl border border-primary/15 bg-white-custom/60 p-3 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-micro font-black uppercase tracking-widest text-primary/40">
        <Award size={12} /> Runas logradas
      </div>

      {logros.length === 0 ? (
        <p className="text-micro text-primary/30 py-2 text-center">
          Dibujá una runa con al menos 98% de precisión para que quede registrada acá
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {logros.map((l) => (
            <div
              key={l.runaId}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-primary/5 border border-primary/10"
            >
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white-custom flex items-center justify-center">
                <RunaThumbnail patronTrazos={[l.trazo]} />
              </div>
              <span className="text-xs font-bold text-primary text-center truncate w-full">
                {l.nombre}
              </span>
              <span className="text-micro text-primary/30 tabular-nums">
                {Math.round(l.score * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

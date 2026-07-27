"use client";

/**
 * PanelReglasDnd
 * ────────────────
 * Bloque del editor de ítems (D&D 2024) para marcar un objeto como arma o
 * armadura y cargar los datos mecánicos que después leen las fichas al
 * equiparlo: dado de daño, sutileza/distancia y maestría fija para armas;
 * CA base y tope de Destreza para armaduras; +2 fijo para escudos.
 *
 * Un ítem es "Ninguno" (objeto normal), "Arma" o "Armadura" — mutuamente
 * excluyentes en la UI para no dejar combinaciones sin sentido (un ítem no
 * puede ser arma y armadura a la vez), aunque a nivel de datos igual se
 * guardan como 2 booleans independientes por si algún día hace falta.
 */

import { MAESTRIAS_ARMA_DND } from "@/domains/garlia/_legacy-public/hooks/useFichasDnd";

import { INPUT_CLS } from "@/domains/garlia/_shared/types";
import type { Item } from "@garlia/items";

type TipoReglaDnd = "ninguno" | "arma" | "armadura" | "escudo";

function tipoActual(item: Pick<Item, "es_arma" | "es_armadura" | "es_escudo">): TipoReglaDnd {
  if (item.es_arma) return "arma";
  if (item.es_escudo) return "escudo";
  if (item.es_armadura) return "armadura";
  return "ninguno";
}

export function PanelReglasDnd({
  form,
  onChange,
}: {
  form: Item;
  onChange: (cambios: Partial<Item>) => void;
}) {
  const tipo = tipoActual(form);

  const elegirTipo = (siguiente: TipoReglaDnd) => {
    onChange({
      es_arma: siguiente === "arma",
      es_armadura: siguiente === "armadura",
      es_escudo: siguiente === "escudo",
      // Limpia campos que no aplican al tipo nuevo, para no dejar datos
      // "fantasma" de una configuración anterior (ej. pasar de Arma a
      // Armadura no debería conservar dado_dano).
      ...(siguiente !== "arma" && { dado_dano: null, sutileza: false, distancia: false, maestria: null }),
      ...(siguiente !== "armadura" && { ca_base_armadura: null, max_bono_dex_armadura: null }),
    });
  };

  return (
    <div className="space-y-3 rounded-xl bg-primary/[0.015] p-3.5">
      <label className="text-micro font-black uppercase tracking-[0.3em] text-primary/35">
        Reglas D&D 2024
      </label>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["ninguno", "Objeto normal"],
            ["arma", "Arma"],
            ["armadura", "Armadura"],
            ["escudo", "Escudo"],
          ] as const
        ).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            onClick={() => elegirTipo(valor)}
            className={`px-2.5 py-1 rounded-lg text-micro font-bold uppercase tracking-wide transition-colors ${
              tipo === valor
                ? "bg-primary text-btn-text"
                : "bg-primary/5 text-primary/50 hover:bg-primary/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tipo === "arma" && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Dado de daño
            </label>
            <input
              className={INPUT_CLS}
              placeholder="ej. 1d8"
              value={form.dado_dano ?? ""}
              onChange={(e) => onChange({ dado_dano: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Maestría (PHB 2024)
            </label>
            <select
              className={INPUT_CLS}
              value={form.maestria ?? ""}
              onChange={(e) => onChange({ maestria: e.target.value || null })}
            >
              <option value="">Sin maestría</option>
              {MAESTRIAS_ARMA_DND.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-primary/60">
            <input
              type="checkbox"
              checked={Boolean(form.sutileza)}
              onChange={(e) => onChange({ sutileza: e.target.checked })}
              className="accent-[var(--primary)]"
            />
            Sutileza (usa el mayor entre Fuerza/Destreza)
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-primary/60">
            <input
              type="checkbox"
              checked={Boolean(form.distancia)}
              onChange={(e) => onChange({ distancia: e.target.checked })}
              className="accent-[var(--primary)]"
            />
            A distancia (siempre usa Destreza)
          </label>
        </div>
      )}

      {tipo === "armadura" && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              CA base
            </label>
            <input
              className={INPUT_CLS}
              inputMode="numeric"
              placeholder="ej. 14"
              value={form.ca_base_armadura ?? ""}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                onChange({ ca_base_armadura: v === "" ? null : Number(v) });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-micro font-black uppercase tracking-[0.25em] text-primary/30">
              Tope de Destreza
            </label>
            <select
              className={INPUT_CLS}
              value={form.max_bono_dex_armadura === null || form.max_bono_dex_armadura === undefined ? "sin_tope" : String(form.max_bono_dex_armadura)}
              onChange={(e) =>
                onChange({
                  max_bono_dex_armadura: e.target.value === "sin_tope" ? null : Number(e.target.value),
                })
              }
            >
              <option value="sin_tope">Sin tope (ligera)</option>
              <option value="2">Hasta +2 (media)</option>
              <option value="0">Ninguno (pesada)</option>
            </select>
          </div>
        </div>
      )}

      {tipo === "escudo" && (
        <p className="text-micro text-primary/35 pt-1">
          Los escudos suman +2 fijo a la CA al equiparse — no hay más datos que cargar acá.
        </p>
      )}
    </div>
  );
}

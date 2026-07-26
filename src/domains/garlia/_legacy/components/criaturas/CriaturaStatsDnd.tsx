"use client";

/**
 * CriaturaStatsDnd
 * ───────────────────────────────────────────────────────────────────────────
 * Ficha de combate completa estilo Monster Manual (D&D 2024): CA, HP,
 * velocidades, las 6 características, salvaciones, habilidades, sentidos,
 * idiomas, RC/PX, resistencias/inmunidades, y las listas de rasgos /
 * acciones / acciones adicionales / reacciones / acciones legendarias.
 *
 * Componente controlado: recibe `valor` (CriaturaStatsDnd) y notifica cada
 * cambio con `onCambiar`. No persiste nada por sí mismo — eso lo maneja
 * EditorCriatura.tsx en su `save()`, igual que el resto de los campos.
 */

import { Minus, Plus, Trash2 } from "lucide-react";
import React from "react";

import {
  CRIATURA_STATS_DND_VACIO,
  type CriaturaRasgoItem,
  type CriaturaStatsDnd,
  type CriaturaVelocidad,
  type StatKeyDnd,
} from "../../hooks/types";

export const STATS_CRIATURA: { key: StatKeyDnd; label: string }[] = [
  { key: "fuerza", label: "FUE" },
  { key: "destreza", label: "DES" },
  { key: "constitucion", label: "CON" },
  { key: "inteligencia", label: "INT" },
  { key: "sabiduria", label: "SAB" },
  { key: "carisma", label: "CAR" },
];

export function statModCriatura(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** RC válidos del Monster Manual 2024 (fracciones + enteros hasta 30). */
export const OPCIONES_RC = [
  "0",
  "1/8",
  "1/4",
  "1/2",
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
];

const inputClase =
  "h-8 px-2 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-xs text-primary/80 placeholder:text-primary/30 focus:border-primary/30 transition-colors w-full";

const labelClase =
  "text-micro font-black uppercase tracking-[0.2em] text-primary/30";

function CampoTexto({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className={labelClase}>{label}</span>
      <input
        className={inputClase}
        placeholder={placeholder}
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}

function CampoNumero({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className={labelClase}>{label}</span>
      <input
        className={inputClase}
        inputMode="numeric"
        placeholder={placeholder}
        type="text"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9-]/g, "");
          onChange(v === "" ? null : Number(v));
        }}
      />
    </div>
  );
}

/** Lista libre reutilizable para rasgos/acciones/acciones adicionales/
 *  reacciones/acciones legendarias: cada entrada es "Nombre en negrita" +
 *  un párrafo, igual que en el Monster Manual. */
function ListaRasgos({
  titulo,
  hint,
  items,
  onChange,
}: {
  titulo: string;
  hint?: string;
  items: CriaturaRasgoItem[];
  onChange: (items: CriaturaRasgoItem[]) => void;
}) {
  const agregar = () =>
    onChange([
      ...items,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nombre: "", descripcion: "" },
    ]);

  const actualizar = (id: string, cambios: Partial<CriaturaRasgoItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...cambios } : it)));

  const quitar = (id: string) => onChange(items.filter((it) => it.id !== id));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className={labelClase}>{titulo}</span>
          {hint && <span className="text-[10px] text-primary/30">{hint}</span>}
        </div>
        <button
          type="button"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-bold text-primary/50 hover:text-primary hover:bg-primary/8 transition-colors"
          onClick={agregar}
        >
          <Plus size={11} /> Agregar
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-[10px] text-primary/25 italic">Sin entradas todavía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-primary/8 bg-primary/[0.015]"
            >
              <div className="flex items-center gap-1.5">
                <input
                  className={`${inputClase} flex-1 font-bold`}
                  placeholder="Nombre (ej. Mordisco, Aliento de fuego…)"
                  type="text"
                  value={it.nombre}
                  onChange={(e) => actualizar(it.id, { nombre: e.target.value })}
                />
                <button
                  type="button"
                  className="shrink-0 p-1.5 rounded-lg text-primary/25 hover:text-red-400 hover:bg-red-500/8 transition-colors"
                  onClick={() => quitar(it.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <textarea
                className="w-full bg-transparent border border-primary/10 rounded-lg px-2 py-1.5 text-micro text-primary/70 outline-none focus:border-primary/25 resize-none placeholder:text-primary/25 leading-relaxed"
                placeholder="Descripción / efecto (tiradas de ataque, salvación, daño…)"
                rows={2}
                value={it.descripcion}
                onChange={(e) => actualizar(it.id, { descripcion: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CriaturaStatsDndEditor({
  valor,
  onCambiar,
}: {
  valor: CriaturaStatsDnd | null | undefined;
  onCambiar: (v: CriaturaStatsDnd) => void;
}) {
  const v: CriaturaStatsDnd = valor ?? CRIATURA_STATS_DND_VACIO;

  const set = <K extends keyof CriaturaStatsDnd>(key: K, val: CriaturaStatsDnd[K]) =>
    onCambiar({ ...v, [key]: val });

  const setVelocidad = <K extends keyof CriaturaVelocidad>(key: K, val: CriaturaVelocidad[K]) =>
    onCambiar({ ...v, velocidad: { ...v.velocidad, [key]: val } });

  const setStat = (key: StatKeyDnd, val: number) =>
    onCambiar({ ...v, stats: { ...v.stats, [key]: val } });

  const toggleSalvacion = (key: StatKeyDnd, activa: boolean) => {
    const next = { ...v.salvaciones };
    if (activa) {
      next[key] = statModCriatura(v.stats[key]) + (v.bono_competencia ?? 2);
    } else {
      delete next[key];
    }
    onCambiar({ ...v, salvaciones: next });
  };

  const setSalvacionBono = (key: StatKeyDnd, bono: number) =>
    onCambiar({ ...v, salvaciones: { ...v.salvaciones, [key]: bono } });

  const agregarHabilidad = () =>
    onCambiar({ ...v, habilidades: [...v.habilidades, { nombre: "", bono: 0 }] });
  const actualizarHabilidad = (i: number, cambios: Partial<{ nombre: string; bono: number }>) =>
    onCambiar({
      ...v,
      habilidades: v.habilidades.map((h, idx) => (idx === i ? { ...h, ...cambios } : h)),
    });
  const quitarHabilidad = (i: number) =>
    onCambiar({ ...v, habilidades: v.habilidades.filter((_, idx) => idx !== i) });

  return (
    <div className="flex flex-col gap-4">
      {/* ── Básicos: tamaño / tipo / alineamiento ─────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <span className={labelClase}>Tamaño</span>
          <select
            className={inputClase}
            value={v.tamano ?? ""}
            onChange={(e) => set("tamano", e.target.value || null)}
          >
            <option value="">Elegir…</option>
            {["Diminuto", "Pequeño", "Mediano", "Grande", "Enorme", "Gargantuesco"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <CampoTexto
          label="Tipo"
          placeholder="Bestia, Dragón, No-muerto…"
          value={v.tipo}
          onChange={(val) => set("tipo", val)}
        />
        <CampoTexto
          label="Alineamiento"
          placeholder="Caótico malvado…"
          value={v.alineamiento}
          onChange={(val) => set("alineamiento", val)}
        />
      </div>

      {/* ── CA / HP ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <CampoNumero label="CA" placeholder="15" value={v.ca} onChange={(val) => set("ca", val)} />
        <CampoTexto
          label="Fuente de CA"
          placeholder="Armadura natural…"
          value={v.ca_nota}
          onChange={(val) => set("ca_nota", val)}
        />
        <CampoNumero
          label="HP máximo"
          placeholder="45"
          value={v.hp_max}
          onChange={(val) => set("hp_max", val)}
        />
        <CampoTexto
          label="Dados de golpe"
          placeholder="7d8+14"
          value={v.hp_dados}
          onChange={(val) => set("hp_dados", val)}
        />
      </div>

      {/* ── Velocidades ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <span className={labelClase}>Velocidad (ft)</span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
          <CampoNumero
            label="Caminar"
            value={v.velocidad.caminar}
            onChange={(val) => setVelocidad("caminar", val)}
          />
          <div className="flex flex-col gap-1">
            <CampoNumero
              label="Volar"
              value={v.velocidad.volar}
              onChange={(val) => setVelocidad("volar", val)}
            />
            <label className="flex items-center gap-1.5 text-[10px] text-primary/40 px-0.5">
              <input
                checked={v.velocidad.vuelo_estacionario}
                type="checkbox"
                onChange={(e) => setVelocidad("vuelo_estacionario", e.target.checked)}
              />
              Estacionario
            </label>
          </div>
          <CampoNumero
            label="Nadar"
            value={v.velocidad.nadar}
            onChange={(val) => setVelocidad("nadar", val)}
          />
          <CampoNumero
            label="Escalar"
            value={v.velocidad.escalar}
            onChange={(val) => setVelocidad("escalar", val)}
          />
          <CampoNumero
            label="Excavar"
            value={v.velocidad.excavar}
            onChange={(val) => setVelocidad("excavar", val)}
          />
        </div>
      </div>

      {/* ── Características + salvaciones ─────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <span className={labelClase}>Características</span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STATS_CRIATURA.map(({ key, label }) => {
            const score = v.stats[key];
            const mod = statModCriatura(score);
            const conSalvacion = key in v.salvaciones;
            return (
              <div
                key={key}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-primary/10 bg-primary/[0.02]"
              >
                <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                  {label}
                </span>
                <input
                  className="w-12 text-center bg-transparent outline-none text-base font-black text-primary"
                  inputMode="numeric"
                  type="text"
                  value={score}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setStat(key, val === "" ? 0 : Number(val));
                  }}
                />
                <span className="text-micro text-primary/40">{fmtMod(mod)}</span>
                <label className="flex items-center gap-1 text-[9px] text-primary/35 mt-0.5">
                  <input
                    checked={conSalvacion}
                    type="checkbox"
                    onChange={(e) => toggleSalvacion(key, e.target.checked)}
                  />
                  Salv.
                </label>
                {conSalvacion && (
                  <input
                    className="w-10 text-center bg-primary/5 rounded outline-none text-micro font-bold text-primary/70"
                    inputMode="numeric"
                    type="text"
                    value={v.salvaciones[key] ?? 0}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9-]/g, "");
                      setSalvacionBono(key, val === "" || val === "-" ? 0 : Number(val));
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Habilidades con competencia ───────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={labelClase}>Habilidades</span>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-micro font-bold text-primary/50 hover:text-primary hover:bg-primary/8 transition-colors"
            onClick={agregarHabilidad}
          >
            <Plus size={11} /> Agregar
          </button>
        </div>
        {v.habilidades.length === 0 ? (
          <p className="text-[10px] text-primary/25 italic">Sin habilidades con competencia.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {v.habilidades.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  className={`${inputClase} flex-1`}
                  placeholder="Sigilo, Percepción…"
                  type="text"
                  value={h.nombre}
                  onChange={(e) => actualizarHabilidad(i, { nombre: e.target.value })}
                />
                <input
                  className={`${inputClase} w-16 text-center`}
                  inputMode="numeric"
                  placeholder="+6"
                  type="text"
                  value={h.bono}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9-]/g, "");
                    actualizarHabilidad(i, { bono: val === "" || val === "-" ? 0 : Number(val) });
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 p-1.5 rounded-lg text-primary/25 hover:text-red-400 hover:bg-red-500/8 transition-colors"
                  onClick={() => quitarHabilidad(i)}
                >
                  <Minus size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Resistencias / inmunidades / vulnerabilidades ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CampoTexto
          label="Vulnerabilidades a daño"
          placeholder="Fuego…"
          value={v.vulnerabilidades}
          onChange={(val) => set("vulnerabilidades", val)}
        />
        <CampoTexto
          label="Resistencias a daño"
          placeholder="Contundente, perforante y cortante de armas no mágicas…"
          value={v.resistencias}
          onChange={(val) => set("resistencias", val)}
        />
        <CampoTexto
          label="Inmunidades a daño"
          placeholder="Veneno…"
          value={v.inmunidades_dano}
          onChange={(val) => set("inmunidades_dano", val)}
        />
        <CampoTexto
          label="Inmunidades a condición"
          placeholder="Envenenado, asustado…"
          value={v.inmunidades_condicion}
          onChange={(val) => set("inmunidades_condicion", val)}
        />
      </div>

      {/* ── Sentidos / idiomas / RC ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CampoTexto
          label="Sentidos"
          placeholder="Visión en la oscuridad 60 ft…"
          value={v.sentidos}
          onChange={(val) => set("sentidos", val)}
        />
        <CampoNumero
          label="Percepción pasiva"
          placeholder="12"
          value={v.percepcion_pasiva}
          onChange={(val) => set("percepcion_pasiva", val)}
        />
        <div className="sm:col-span-2">
          <CampoTexto
            label="Idiomas"
            placeholder="Común, Infernal — o «—» si no habla ninguno"
            value={v.idiomas}
            onChange={(val) => set("idiomas", val)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <span className={labelClase}>RC</span>
          <select
            className={inputClase}
            value={v.rc ?? ""}
            onChange={(e) => set("rc", e.target.value || null)}
          >
            <option value="">—</option>
            {OPCIONES_RC.map((rc) => (
              <option key={rc} value={rc}>
                {rc}
              </option>
            ))}
          </select>
        </div>
        <CampoNumero
          label="Puntos de experiencia"
          placeholder="1800"
          value={v.puntos_experiencia}
          onChange={(val) => set("puntos_experiencia", val)}
        />
        <CampoNumero
          label="Bono de competencia"
          placeholder="+3"
          value={v.bono_competencia}
          onChange={(val) => set("bono_competencia", val)}
        />
      </div>

      {/* ── Rasgos / acciones / reacciones / legendarias ──────────────── */}
      <ListaRasgos
        items={v.rasgos}
        titulo="Rasgos"
        hint="Habilidades pasivas — Visión en la oscuridad no va acá, sino en Sentidos."
        onChange={(items) => set("rasgos", items)}
      />
      <ListaRasgos
        items={v.acciones}
        titulo="Acciones"
        onChange={(items) => set("acciones", items)}
      />
      <ListaRasgos
        items={v.acciones_adicionales}
        titulo="Acciones adicionales"
        onChange={(items) => set("acciones_adicionales", items)}
      />
      <ListaRasgos
        items={v.reacciones}
        titulo="Reacciones"
        onChange={(items) => set("reacciones", items)}
      />

      <div className="flex flex-col gap-2">
        <span className={labelClase}>Acciones legendarias</span>
        <textarea
          className="w-full bg-primary/[0.03] border border-primary/10 rounded-lg px-2.5 py-1.5 text-micro text-primary outline-none focus:border-primary/25 resize-none placeholder:text-primary/25 leading-relaxed"
          placeholder="Puede hacer 3 acciones legendarias, elegidas entre las siguientes…"
          rows={2}
          value={v.acciones_legendarias_intro ?? ""}
          onChange={(e) => set("acciones_legendarias_intro", e.target.value || null)}
        />
        <ListaRasgos
          items={v.acciones_legendarias}
          titulo="Lista de acciones legendarias"
          onChange={(items) => set("acciones_legendarias", items)}
        />
      </div>
    </div>
  );
}

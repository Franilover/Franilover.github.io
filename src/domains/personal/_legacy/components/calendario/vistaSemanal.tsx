"use client";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, BookOpen, Bookmark, Plus } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";

import { BtnIcon } from "@/components/ui";
import { MotionDiv } from "@/components/ui/Motion";
import { cn } from "@/lib/utils/index";

import type {
  VistaOpcion, Evento} from "@/domains/personal/_legacy/components/calendario/types";
import { EventoBadge,
  DIAS_SEMANA_CORTO, DIAS_SEMANA_LETRA, MESES, VISTAS, TIPOS_EVENTO,
  addDays, isSameDay, toUTCDate,
} from "@/domains/personal/_legacy/components/calendario/types";

const ColumniaDia = ({
  fecha, eventos, esHoy, seleccionado, onClick, compact,
}: {
  fecha: Date; eventos: Evento[]; esHoy: boolean;
  seleccionado: boolean; onClick: () => void; compact: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col min-h-0 flex-1 rounded-[var(--radius-btn)] border transition-all cursor-pointer group",
      seleccionado
        ? "bg-primary/8 dark:bg-primary/12 border-primary/30 shadow-md shadow-primary/10"
        : "bg-white-custom border-primary/10 hover:border-primary/25 hover:shadow-sm",
      esHoy && !seleccionado && "border-primary/25 bg-primary/5 dark:bg-primary/10"
    )}
    onClick={onClick}
  >
    {/* Header día */}
    <div className={cn(
      "flex flex-col items-center py-1 sm:py-2 border-b gap-0.5 transition-colors shrink-0",
      seleccionado ? "border-primary/15" : "border-primary/8"
    )}>
      <span className={cn(
        "text-micro sm:text-micro font-black uppercase tracking-widest transition-colors",
        esHoy ? "text-primary" : "text-primary/40 dark:text-primary/50"
      )}>
        {compact ? DIAS_SEMANA_LETRA[fecha.getDay()] : DIAS_SEMANA_CORTO[fecha.getDay()]}
      </span>
      <div className={cn(
        "w-5 h-5 sm:w-7 sm:h-7 rounded-[var(--radius-btn)] flex items-center justify-center transition-all",
        esHoy
          ? "bg-primary text-[var(--btn-text)] shadow-md shadow-primary/30"
          : seleccionado
          ? "bg-primary/15 text-primary"
          : "text-[var(--text-on-card)]/60 dark:text-[var(--text-on-card)]/70 group-hover:bg-primary/8"
      )}>
        <span className="text-micro sm:text-xs font-black">{fecha.getDate()}</span>
      </div>
    </div>

    {/* Eventos */}
    <div className="flex flex-col gap-1 p-1.5 flex-1 overflow-y-auto min-h-0">
      {eventos.length === 0 && (
        <p className="text-micro text-primary/20 dark:text-primary/30 font-bold italic text-center mt-3">—</p>
      )}
      {eventos.map((ev) => <EventoBadge key={ev.id} compact={compact} item={ev} />)}
    </div>
  </div>
);

interface Props {
  eventos: any[];
  capitulosRaw: any[];
  isAddingEvento: boolean;
  onAddEvento: (fecha: string, titulo: string, tipo: string) => Promise<void>;
}

export const VistaSemanal = ({ eventos, capitulosRaw, isAddingEvento, onAddEvento }: Props) => {
  const [vista, setVista] = useState<VistaOpcion>(7);
  const [fechaBase, setFechaBase] = useState<Date>(() => {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;
    hoy.setDate(hoy.getDate() + diff);
    hoy.setHours(0, 0, 0, 0);
    return hoy;
  });
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(new Date());
  const [nuevoEvento, setNuevoEvento] = useState("");
  const [tipoEvento, setTipoEvento] = useState("Plan");

  const hoy = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const diasVista = useMemo(() =>
    Array.from({ length: vista }, (_, i) => addDays(fechaBase, i)),
    [fechaBase, vista]
  );

  const rangoTexto = useMemo(() => {
    if (diasVista.length === 1) {
      const d = diasVista[0];
      return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    }
    const ini = diasVista[0];
    const fin = diasVista[diasVista.length - 1];
    if (ini.getMonth() === fin.getMonth())
      return `${ini.getDate()}–${fin.getDate()} ${MESES[ini.getMonth()].slice(0, 3)} ${ini.getFullYear()}`;
    return `${ini.getDate()} ${MESES[ini.getMonth()].slice(0, 3)} – ${fin.getDate()} ${MESES[fin.getMonth()].slice(0, 3)} ${fin.getFullYear()}`;
  }, [diasVista]);

  const navegar = (dir: 1 | -1) => setFechaBase(prev => addDays(prev, dir * vista));

  const irAHoy = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (vista === 7 || vista === 5) {
      const dia = d.getDay();
      d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia));
    }
    setFechaBase(d);
    setDiaSeleccionado(new Date());
  };

  const eventosDelDia = useCallback((fecha: Date): Evento[] => {
    const evs = eventos
      .filter(e => e.fecha && isSameDay(toUTCDate(e.fecha), fecha))
      .map(e => ({ ...e, esCapitulo: false }));
    const caps = capitulosRaw
      .filter(c => isSameDay(toUTCDate(c.fecha_publicacion), fecha))
      .map(c => ({ id: c.id, titulo: c.titulo_capitulo, tipo: "Lanzamiento Libro", esCapitulo: true }));
    return [...evs, ...caps];
  }, [eventos, capitulosRaw]);

  const eventosDiaSeleccionado = useMemo(
    () => eventosDelDia(diaSeleccionado),
    [eventosDelDia, diaSeleccionado]
  );

  const handleAdd = async () => {
    if (!nuevoEvento.trim()) return;
    await onAddEvento(diaSeleccionado.toISOString(), nuevoEvento, tipoEvento);
    setNuevoEvento("");
  };

  const compact = vista >= 5;

  return (
    /* Removido bg-white-custom → usa bg-background para soporte dark mode */
    <div className="flex flex-col gap-3 h-full overflow-hidden">

      {/* Controles */}
      <div className="flex flex-col gap-1.5 sm:gap-2 shrink-0">
        {/* Navegación */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="text-micro font-black uppercase tracking-widest border border-primary/20 text-primary px-3 py-1.5 rounded-[var(--radius-btn)] hover:bg-primary hover:text-[var(--btn-text)] transition-all shrink-0"
            onClick={irAHoy}
          >
            Hoy
          </button>
          <button
            className="p-1.5 hover:bg-primary/8 rounded-[var(--radius-btn)] text-primary/40 hover:text-primary transition-all"
            onClick={() => navegar(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="p-1.5 hover:bg-primary/8 rounded-[var(--radius-btn)] text-primary/40 hover:text-primary transition-all"
            onClick={() => navegar(1)}
          >
            <ChevronRight size={16} />
          </button>
          <span className="text-micro font-black uppercase tracking-wider text-[var(--text-on-card)]/70 flex-1 truncate">
            {rangoTexto}
          </span>
        </div>

        {/* Selector de vista */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-primary/5 dark:bg-primary/10 rounded-[var(--radius-btn)] p-0.5 sm:p-1 self-start overflow-x-auto max-w-full">
          {VISTAS.map((v) => (
            <button
              key={v.valor}
              className={cn(
                "text-micro font-black uppercase tracking-wide px-2 py-1.5 rounded-[var(--radius-btn)] transition-all",
                vista === v.valor
                  ? "bg-primary text-[var(--btn-text)] shadow-md shadow-primary/20"
                  : "text-primary/50 hover:text-primary hover:bg-white-custom dark:hover:bg-white-custom/20"
              )}
              onClick={() => setVista(v.valor)}
            >
              <span className="hidden sm:inline">{v.label}</span>
              <span className="sm:hidden">{v.short}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid de días */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <AnimatePresence mode="wait">
          <MotionDiv
            key={`${vista}-${fechaBase.toISOString()}`}
            animate={{ opacity: 1, y: 0 }}
            className="h-full"
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(vista, 7)}, minmax(${compact ? "3.5rem" : "5.5rem"}, 1fr))`,
              gap: "0.25rem",
              minWidth: compact ? `${vista * 3.5}rem` : `${vista * 5.5}rem`,
              minHeight: "140px",
            }}
            transition={{ duration: 0.15 }}
          >
            {diasVista.map((fecha) => (
              <ColumniaDia
                key={fecha.toISOString()}
                compact={compact}
                esHoy={isSameDay(fecha, hoy)}
                eventos={eventosDelDia(fecha)}
                fecha={fecha}
                seleccionado={isSameDay(fecha, diaSeleccionado)}
                onClick={() => setDiaSeleccionado(fecha)}
              />
            ))}
          </MotionDiv>
        </AnimatePresence>
      </div>

      {/* Panel día seleccionado */}
      <div className="bg-primary/5 dark:bg-primary/10 rounded-[var(--radius-btn)] p-2 sm:p-3 border border-primary/10 shrink-0">
        {/* Cabecera */}
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="text-primary/50" size={12} />
          <span className="text-micro font-black uppercase tracking-widest text-primary/50">
            {diaSeleccionado.getDate()} de {MESES[diaSeleccionado.getMonth()]} · {DIAS_SEMANA_CORTO[diaSeleccionado.getDay()]}
          </span>
        </div>

        {/* Formulario */}
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <select
            className="bg-white-custom border border-primary/12 rounded-[var(--radius-btn)] px-3 py-2 text-micro font-black text-[var(--input-text)] outline-none focus:border-primary/30 cursor-pointer"
            value={tipoEvento}
            onChange={e => setTipoEvento(e.target.value)}
          >
            {TIPOS_EVENTO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex gap-2 flex-1">
            <input
              className="flex-1 bg-white-custom border border-primary/12 rounded-[var(--radius-btn)] px-4 py-2 text-micro font-bold text-[var(--input-text)] placeholder:text-[var(--input-text)]/40 outline-none focus:border-primary/30 min-w-0"
              placeholder="Nuevo evento..."
              type="text"
              value={nuevoEvento}
              onChange={e => setNuevoEvento(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
            />
            <BtnIcon
              className="rounded-[var(--radius-btn)] w-10 h-10 shrink-0"
              disabled={!nuevoEvento.trim()}
              loading={isAddingEvento}
              onClick={handleAdd}
            >
              <Plus size={14} />
            </BtnIcon>
          </div>
        </div>

        {/* Lista eventos día seleccionado */}
        <div className="space-y-1 sm:space-y-1.5 max-h-24 sm:max-h-36 overflow-y-auto">
          {eventosDiaSeleccionado.length === 0 ? (
            <p className="text-micro font-bold text-[var(--text-on-card)]/25 italic px-1">Sin eventos para este día.</p>
          ) : eventosDiaSeleccionado.map(ev => (
            <MotionDiv
              key={ev.id}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-[var(--radius-btn)] border",
                ev.esCapitulo
                  ? "bg-amber-500/10 border-amber-500/25 dark:bg-amber-500/15 dark:border-amber-500/30"
                  : "bg-white-custom border-primary/10 shadow-sm"
              )}
              initial={{ opacity: 0, x: -6 }}
            >
              <div className="w-7 h-7 bg-primary/8 dark:bg-primary/15 rounded-[var(--radius-btn)] flex items-center justify-center shrink-0">
                {ev.esCapitulo
                  ? <BookOpen className="text-amber-500 dark:text-amber-400" size={12} />
                  : <Bookmark className="text-primary/50" size={12} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-micro font-black text-[var(--text-on-card)]/90 uppercase italic truncate">&quot;{ev.titulo}&quot;</p>
                <p className="text-micro font-bold text-[var(--text-on-card)]/40 uppercase tracking-tight">{ev.tipo}</p>
              </div>
              {ev.esCapitulo && (
                <span className="text-micro font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full uppercase shrink-0">Cap.</span>
              )}
            </MotionDiv>
          ))}
        </div>
      </div>
    </div>
  );
};
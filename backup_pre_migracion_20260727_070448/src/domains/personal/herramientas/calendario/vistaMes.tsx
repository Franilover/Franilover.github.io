"use client";
import { ChevronLeft, ChevronRight, BookOpen, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import React, { useState, useMemo } from "react";

import { BtnIcon } from "@/ui";
import { MotionDiv, MotionButton } from "@/ui/Motion";
import { cn } from "@/lib/utils/index";



import { MESES, TIPOS_EVENTO } from "@/domains/personal/herramientas/calendario/types";

interface Props {
  eventos: any[];
  capitulosRaw: any[];
  isAddingEvento: boolean;
  onAddEvento: (fechaISO: string, titulo: string, tipo: string) => Promise<void>;
  onUpdateEvento?: (id: string, datos: { titulo?: string; tipo?: string; fecha?: string }) => Promise<void>;
  onDeleteEvento?: (id: string) => Promise<void>;
}

export const VistaMes = ({ eventos, capitulosRaw, isAddingEvento, onAddEvento, onUpdateEvento, onDeleteEvento }: Props) => {
  const [fechaViz, setFechaViz] = useState(new Date());
  // Estado local del día seleccionado (dentro del mes visualizado)
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDate());
  const [nuevoEvento, setNuevoEvento] = useState("");
  const [tipoEvento, setTipoEvento] = useState("Plan");

  // Estado de edición de un evento existente
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editTipo, setEditTipo] = useState("Plan");
  const [editFecha, setEditFecha] = useState(""); // YYYY-MM-DD
  const [guardando, setGuardando] = useState(false);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const { diasEnMes, primerDia, mesActual, añoActual } = useMemo(() => {
    const año = fechaViz.getFullYear();
    const mes = fechaViz.getMonth();
    const dias = new Date(año, mes + 1, 0).getDate();
    let pd = new Date(año, mes, 1).getDay();
    pd = pd === 0 ? 6 : pd - 1;
    return { diasEnMes: dias, primerDia: pd, mesActual: mes, añoActual: año };
  }, [fechaViz]);

  const cambiarMes = (offset: number) => {
    setFechaViz(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setDiaSeleccionado(1);
  };

  // Crea el evento con el mes y año que el usuario está viendo, no el mes actual del sistema
  const handleAdd = async () => {
    if (!nuevoEvento.trim()) return;
    const fechaISO = new Date(añoActual, mesActual, diaSeleccionado, 12, 0, 0).toISOString();
    await onAddEvento(fechaISO, nuevoEvento, tipoEvento);
    setNuevoEvento("");
  };

  const tieneAlgo = (dia: number) =>
    eventos.some((e: any) => {
      const d = new Date(e.fecha);
      return d.getUTCDate() === dia && d.getUTCMonth() === mesActual && d.getUTCFullYear() === añoActual;
    }) ||
    capitulosRaw.some((c: any) => {
      const d = new Date(c.fecha_publicacion);
      return d.getUTCDate() === dia && d.getUTCMonth() === mesActual && d.getUTCFullYear() === añoActual;
    });

  const itemsDia = useMemo(() => {
    const evs = eventos
      .filter((e: any) => {
        const d = new Date(e.fecha);
        return d.getUTCDate() === diaSeleccionado && d.getUTCMonth() === mesActual && d.getUTCFullYear() === añoActual;
      })
      .map(e => ({ ...e, esCapitulo: false }));
    const caps = capitulosRaw
      .filter((c: any) => {
        const d = new Date(c.fecha_publicacion);
        return d.getUTCDate() === diaSeleccionado && d.getUTCMonth() === mesActual && d.getUTCFullYear() === añoActual;
      })
      .map(c => ({ id: c.id, titulo: c.titulo_capitulo, tipo: "Lanzamiento Libro", esCapitulo: true }));
    return [...evs, ...caps];
  }, [eventos, capitulosRaw, diaSeleccionado, mesActual, añoActual]);

  // Convierte un Date/ISO a string YYYY-MM-DD usando UTC (consistente con tieneAlgo/itemsDia)
  const toInputDate = (fechaISO: string) => {
    const d = new Date(fechaISO);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const iniciarEdicion = (item: any) => {
    setEditandoId(item.id);
    setEditTitulo(item.titulo);
    setEditTipo(item.tipo);
    setEditFecha(toInputDate(item.fecha));
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditTitulo("");
    setEditTipo("Plan");
    setEditFecha("");
  };

  const guardarEdicion = async () => {
    if (!editandoId || !onUpdateEvento || !editTitulo.trim()) return;
    setGuardando(true);
    try {
      const [yyyy, mm, dd] = editFecha.split("-").map(Number);
      const fechaISO = new Date(yyyy, mm - 1, dd, 12, 0, 0).toISOString();
      await onUpdateEvento(editandoId, { titulo: editTitulo, tipo: editTipo, fecha: fechaISO });
      cancelarEdicion();
    } finally {
      setGuardando(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteEvento) return;
    setBorrandoId(id);
    try {
      await onDeleteEvento(id);
    } finally {
      setBorrandoId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Nav mes */}
      <div className="flex items-center justify-center gap-4 px-5 py-2 border-b border-primary/8 shrink-0">
        <button
          className="p-1 text-primary/40 hover:text-primary transition-colors"
          onClick={() => cambiarMes(-1)}
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-micro font-black uppercase tracking-[0.18em] text-primary min-w-[9rem] text-center">
          {MESES[mesActual]} {añoActual}
        </span>
        <button
          className="p-1 text-primary/40 hover:text-primary transition-colors"
          onClick={() => cambiarMes(1)}
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Cuerpo con scroll */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 py-2 sm:py-3 gap-1.5 sm:gap-2">

        {/* Cabecera días semana */}
        <div className="grid grid-cols-7 shrink-0">
          {["L","M","X","J","V","S","D"].map(d => (
            <div key={d} className="text-center text-micro font-black uppercase text-primary/30 dark:text-primary/50 pb-1">{d}</div>
          ))}
        </div>

        {/* Grilla días */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 shrink-0">
          {Array.from({ length: primerDia }).map((_, i) => (
            <div key={`e-${i}`} className="h-8 sm:h-14" />
          ))}
          {Array.from({ length: diasEnMes }).map((_, i) => {
            const dia = i + 1;
            const sel = dia === diaSeleccionado;
            const hoy =
              dia === new Date().getDate() &&
              mesActual === new Date().getMonth() &&
              añoActual === new Date().getFullYear();

            return (
              <MotionButton
                key={dia}
                className={cn(
                  "h-8 sm:h-14 w-full rounded-[var(--radius-btn)] flex flex-col items-center justify-center relative",
                  "text-micro sm:text-sm font-black transition-all",
                  sel
                    ? "bg-primary text-[var(--btn-text)] shadow-sm shadow-primary/20"
                    : hoy
                      ? "bg-primary/10 text-primary dark:bg-primary/20"
                      : "text-[var(--text-on-card)]/65 hover:bg-primary/7"
                )}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setDiaSeleccionado(dia)}
              >
                {dia}
                {tieneAlgo(dia) && (
                  <span className={cn(
                    "absolute bottom-[2px] w-[3px] h-[3px] rounded-full",
                    sel ? "bg-btn-text/50" : "bg-primary/50"
                  )} />
                )}
              </MotionButton>
            );
          })}
        </div>

        {/* Panel día seleccionado */}
        <div className="flex flex-col gap-2 border-t border-primary/8 pt-2.5 mt-0.5">

          <span className="text-micro font-black uppercase tracking-widest text-primary/40 shrink-0">
            {diaSeleccionado} {MESES[mesActual].slice(0, 3)} {añoActual}
          </span>

          {/* Formulario */}
          <div className="flex gap-1.5 shrink-0">
            <select
              className="bg-primary/8 dark:bg-primary/15 border border-transparent rounded-[var(--radius-btn)] px-2 py-1.5 text-micro font-black text-[var(--input-text)] outline-none focus:border-primary/20 cursor-pointer"
              value={tipoEvento}
              onChange={e => setTipoEvento(e.target.value)}
            >
              {TIPOS_EVENTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              className="flex-1 bg-primary/5 dark:bg-primary/10 rounded-[var(--radius-btn)] px-3 py-1.5 text-micro text-[var(--input-text)] font-semibold outline-none border border-transparent focus:border-primary/20 focus:bg-white-custom transition-all min-w-0 placeholder:text-[var(--input-text)]/40"
              placeholder="Añadir evento..."
              type="text"
              value={nuevoEvento}
              onChange={e => setNuevoEvento(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
            />
            <BtnIcon
              className="rounded-[var(--radius-btn)] w-8 h-8 shrink-0"
              disabled={!nuevoEvento.trim()}
              loading={isAddingEvento}
              onClick={handleAdd}
            >
              <Plus size={12} />
            </BtnIcon>
          </div>

          {/* Lista de eventos */}
          <div className="flex flex-col gap-1.5">
            {itemsDia.length === 0 ? (
              <p className="text-micro font-medium text-[var(--text-on-card)]/20 italic pt-0.5">Sin eventos.</p>
            ) : itemsDia.map((item: any) => {
              const enEdicion = editandoId === item.id;

              if (enEdicion) {
                return (
                  <MotionDiv
                    key={item.id}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-1.5 px-3 py-2 rounded-[var(--radius-btn)] border bg-primary/5 dark:bg-primary/10 border-primary/20"
                    initial={{ opacity: 0, x: -4 }}
                  >
                    <div className="flex gap-1.5">
                      <select
                        className="bg-primary/8 dark:bg-primary/15 border border-transparent rounded-[var(--radius-btn)] px-2 py-1.5 text-micro font-black text-[var(--input-text)] outline-none focus:border-primary/20 cursor-pointer"
                        value={editTipo}
                        onChange={e => setEditTipo(e.target.value)}
                      >
                        {TIPOS_EVENTO.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        className="flex-1 bg-white-custom rounded-[var(--radius-btn)] px-3 py-1.5 text-micro text-[var(--input-text)] font-semibold outline-none border border-primary/20 min-w-0"
                        type="text"
                        value={editTitulo}
                        onChange={e => setEditTitulo(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && guardarEdicion()}
                      />
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <input
                        className="bg-white-custom rounded-[var(--radius-btn)] px-2 py-1.5 text-micro text-[var(--input-text)] font-semibold outline-none border border-primary/20 flex-1 min-w-0"
                        type="date"
                        value={editFecha}
                        onChange={e => setEditFecha(e.target.value)}
                      />
                      <BtnIcon
                        className="rounded-[var(--radius-btn)] w-8 h-8 shrink-0 bg-green-500/15 text-green-600 hover:bg-green-500/25"
                        disabled={!editTitulo.trim()}
                        loading={guardando}
                        onClick={guardarEdicion}
                      >
                        <Check size={12} />
                      </BtnIcon>
                      <BtnIcon
                        className="rounded-[var(--radius-btn)] w-8 h-8 shrink-0 bg-primary/8 text-primary/60 hover:bg-primary/15"
                        onClick={cancelarEdicion}
                      >
                        <X size={12} />
                      </BtnIcon>
                    </div>
                  </MotionDiv>
                );
              }

              return (
                <MotionDiv
                  key={item.id}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-[var(--radius-btn)] border shrink-0",
                    item.esCapitulo
                      ? "bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/15 dark:border-amber-500/30"
                      : "bg-primary/5 dark:bg-primary/10 border-primary/10"
                  )}
                  initial={{ opacity: 0, x: -4 }}
                >
                  <div className="w-5 h-5 bg-white-custom rounded flex items-center justify-center shadow-sm shrink-0 border border-primary/8">
                    {item.esCapitulo
                      ? <BookOpen className="text-amber-500" size={10} />
                      : <span className="text-micro font-black text-primary">{diaSeleccionado}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-micro font-bold text-[var(--text-on-card)]/90 truncate">{item.titulo}</p>
                    <p className="text-micro font-semibold text-primary/40 uppercase tracking-wide">{item.tipo}</p>
                  </div>
                  {item.esCapitulo ? (
                    <span className="text-micro font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full uppercase shrink-0">
                      Cap.
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      {onUpdateEvento && (
                        <button
                          aria-label="Editar evento"
                          className="p-1 text-primary/40 hover:text-primary transition-colors"
                          onClick={() => iniciarEdicion(item)}
                        >
                          <Pencil size={10} />
                        </button>
                      )}
                      {onDeleteEvento && (
                        <button
                          aria-label="Borrar evento"
                          className="p-1 text-primary/40 hover:text-red-500 transition-colors disabled:opacity-40"
                          disabled={borrandoId === item.id}
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  )}
                </MotionDiv>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
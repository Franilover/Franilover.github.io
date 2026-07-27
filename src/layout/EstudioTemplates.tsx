"use client";

import { AlertCircle, CheckCircle2, Loader2, WifiOff } from "lucide-react";
import React, { useEffect } from "react";

import { TEXT_VARIANTS } from "@/ui/Tipografia";
import { cn } from "@/lib/utils/index"

export function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function unique(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean).map(s => s.trim()))).sort();
}

interface CampoInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  type?: string;
}

export function CampoInput({ label, value, onChange, placeholder, autoFocus, type = "text" }: CampoInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-micro font-black uppercase text-primary/30 tracking-widest">
        {label}
      </label>
      <input
        autoFocus={autoFocus}
        className="w-full bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 text-sm font-medium text-primary outline-none focus:border-primary/40 transition-colors placeholder:text-primary/20"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

interface BannerOfflineProps {
  mensaje?: string;
  
  color?: "blue" | "amber";
}

export function BannerOffline({
  mensaje = "Sin conexión — los cambios se guardan localmente",
  color = "blue",
}: BannerOfflineProps) {
  const cls = color === "amber"
    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
    : "bg-blue-500/10 border-blue-500/20 text-blue-400";

  return (
    <div className={`shrink-0 flex items-center gap-2 px-8 py-2.5 border-b text-micro font-black uppercase tracking-widest ${cls}`}>
      <WifiOff size={12} />
      {mensaje}
    </div>
  );
}

interface EmptyEstudioProps {
  icono: React.ReactNode;
  titulo: string;
  subtitulo?: string;
}

export function EmptyEstudio({ icono, titulo, subtitulo }: EmptyEstudioProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-primary/20 select-none">
      <div className="p-8 rounded-3xl border-2 border-dashed border-primary/10">
        {icono}
      </div>
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em]">{titulo}</p>
        {subtitulo && (
          <p className="text-xs mt-1 tracking-widest opacity-60">{subtitulo}</p>
        )}
      </div>
    </div>
  );
}

interface ModalBaseProps {
  onClose: () => void;
  children: React.ReactNode;
  
  maxWidth?: string;
}

export function ModalBase({ onClose, children, maxWidth = "max-w-sm" }: ModalBaseProps) {
  
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pb-[calc(1.5rem+56px)] md:pb-6">
      <div
        className="absolute inset-0 bg-primary/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative bg-bg-main border border-primary/15 rounded-2xl p-8 w-full ${maxWidth} shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export type SaveStatus = "idle" | "saving" | "saved" | "pending" | "error";

interface SaveIndicatorProps {
  status: SaveStatus;
}

export function SaveIndicator({ status }: SaveIndicatorProps) {
  const map: Record<SaveStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    idle:    { label: "",                         icon: null,                                          cls: "" },
    saving:  { label: "Guardando…",               icon: <Loader2 className="animate-spin" size={10}/>, cls: "text-primary/40" },
    saved:   { label: "Guardado",                 icon: <CheckCircle2 size={10}/>,                     cls: "text-emerald-400" },
    pending: { label: "Sin conexión — pendiente", icon: <WifiOff size={10}/>,                          cls: "text-blue-400" },
    error:   { label: "Error al guardar",         icon: <AlertCircle size={10}/>,                      cls: "text-red-400" },
  };
  const { label, icon, cls } = map[status];
  if (!label) return null;
  return (
    <span className={cn(TEXT_VARIANTS.xs, "flex items-center gap-1.5", cls)}>
      {icon}{label}
    </span>
  );
}

interface BotonSubmitProps {
  loading: boolean;
  disabled?: boolean;
  labelNormal: React.ReactNode;
  labelLoading: React.ReactNode;
}

export function BotonSubmit({ loading, disabled, labelNormal, labelLoading }: BotonSubmitProps) {
  return (
    <button
      className="w-full bg-primary text-bg-main py-3 rounded-xl text-micro font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      disabled={loading || disabled}
      type="submit"
    >
      {loading ? labelLoading : labelNormal}
    </button>
  );
}
"use client";
import { Loader2 } from "lucide-react";
import React from "react";

interface LoadingProps {
  text?:       string;
  fullScreen?: boolean;
}

export function Loading({ text = "Cargando...", fullScreen = true }: LoadingProps) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? "min-h-[60vh]" : "py-16"}`}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin" size={20} style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)" }} />
        <span className="text-micro font-black uppercase tracking-[0.3em]"
          style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)" }}>
          {text}
        </span>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  label: string;
  icon?: React.ReactNode;
}

export function EmptyState({ label, icon }: EmptyStateProps) {
  return (
    <div className="col-span-full py-20 flex flex-col items-center gap-3">
      {icon && <div className="opacity-20">{icon}</div>}
      <p className="text-micro font-black uppercase tracking-[0.3em] italic"
        style={{ color: "color-mix(in srgb, var(--primary) 25%, transparent)" }}>
        &quot;{label}&quot;
      </p>
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  active?:  boolean;
  onClick?: () => void;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export function Badge({ children, active, onClick, variant = "default" }: BadgeProps) {
  const variants = {
    default: active
      ? "bg-primary text-btn-text shadow-sm shadow-primary/20"
      : "bg-primary/8 text-primary/60 hover:bg-primary/12",
    success: "bg-green-50 text-green-600 border border-green-100",
    warning: "bg-amber-50 text-amber-600 border border-amber-100",
    danger:  "bg-red-50 text-red-500 border border-red-100",
    info:    "bg-blue-50 text-blue-500 border border-blue-100",
  };

  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className={[
        "inline-flex items-center px-3 py-1 rounded-[var(--radius-btn)]",
        "text-micro font-black uppercase tracking-widest transition-all",
        variants[variant],
        onClick ? "cursor-pointer active:scale-95" : "",
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 h-px" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }} />
      {label && (
        <span className="text-micro font-black uppercase tracking-[0.4em]"
          style={{ color: "color-mix(in srgb, var(--primary) 20%, transparent)" }}>
          {label}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }} />
    </div>
  );
}

interface StatRowProps {
  icon:  React.ReactNode;
  label: string;
  value: number | string;
}

export function StatRow({ icon, label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5" style={{ color: "color-mix(in srgb, var(--primary) 38%, transparent)" }}>
        {icon}
        <span className="font-serif italic text-micro" style={{ color: "color-mix(in srgb, var(--primary) 42%, transparent)" }}>
          {label}
        </span>
      </div>
      <span className="flex-1 mx-2 font-serif text-micro overflow-hidden text-center"
        style={{ color: "color-mix(in srgb, var(--primary) 12%, transparent)", letterSpacing: "0.2em" }}>
        . . . . . .
      </span>
      <span className="font-serif italic text-sm tabular-nums" style={{ color: "var(--primary)" }}>
        {value}
      </span>
    </div>
  );
}

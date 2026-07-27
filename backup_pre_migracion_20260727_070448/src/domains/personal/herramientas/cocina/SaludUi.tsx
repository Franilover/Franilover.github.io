"use client";
import React from "react";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-micro font-black uppercase tracking-[0.2em] text-primary/40">
      {children}
    </p>
  );
}

export function FieldInput({
  label, type = "text", value, onChange, placeholder, required, min, step,
}: {
  label: string;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-micro font-black uppercase tracking-widest text-primary/40 pl-1">
        {label}{required && <span className="text-accent ml-0.5">*</span>}
      </label>
      <input
        className="input-brand text-micro font-bold"
        min={min}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function MacroBadge({
  label, value, unit, scaled,
}: {
  label: string;
  value: number;
  unit: string;
  scaled?: number;
}) {
  const showing = scaled !== undefined ? scaled : value;
  const changed = scaled !== undefined && Math.abs(scaled - value) > 0.01;

  return (
    <div className="flex flex-col items-center gap-0.5 py-2">
      <span className="text-micro font-black uppercase tracking-widest text-primary/40">
        {label}
      </span>
      <span className={`text-sm font-black leading-none transition-colors ${changed ? "text-accent" : "text-primary"}`}>
        {typeof showing === "number" ? showing.toFixed(1) : showing}
        <span className="text-micro font-semibold text-primary/30 ml-0.5">{unit}</span>
      </span>
    </div>
  );
}
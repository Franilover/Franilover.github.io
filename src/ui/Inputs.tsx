"use client";
import React from "react";

import { FieldWrapper } from "@/ui/Tipografia";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <FieldWrapper label={label}>
      <input {...props} className={["input-brand", className].join(" ")} />
    </FieldWrapper>
  );
}

export function InputLine({ label, className = "", ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-micro font-black text-primary/40 uppercase tracking-widest block italic">
          {label}
        </label>
      )}
      <input
        {...props}
        className={[
          "w-full bg-transparent border-b-2 border-primary/10 py-3",
          "text-sm font-black text-primary outline-none focus:border-primary",
          "transition-colors uppercase placeholder:normal-case placeholder:font-normal placeholder:text-primary/25",
          className,
        ].join(" ")}
      />
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-micro font-black text-primary/40 uppercase tracking-widest block">
          {label}
        </label>
      )}
      <textarea
        {...props}
        className={[
          "w-full bg-bg-main border border-primary/10 rounded-[var(--radius-btn)]",
          "p-4 text-sm font-medium text-primary outline-none focus:border-primary",
          "transition-colors italic resize-none",
          className,
        ].join(" ")}
      />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:   string;
  options:  { value: string; label: string }[];
}

export function Select({ label, options, className = "", ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-micro font-black text-primary/40 uppercase tracking-widest block">
          {label}
        </label>
      )}
      <select
        {...props}
        className={[
          "w-full bg-bg-main border-b-2 border-primary/10 py-3",
          "text-sm font-black text-primary outline-none focus:border-primary",
          "appearance-none cursor-pointer uppercase transition-colors",
          className,
        ].join(" ")}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

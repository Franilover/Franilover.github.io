"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils/index"; 

const btnVariants = cva(
  "inline-flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-btn-text hover:opacity-80",
        ghost:   "bg-primary/5 text-primary hover:bg-primary/10 border border-primary/10",
        danger:  "bg-red-50 text-red-400 border border-red-100 hover:bg-red-100",
        outline: "bg-transparent text-primary border border-primary/20 hover:border-primary/50",
      },
      size: {
        sm: "px-3 py-1.5 text-micro",
        md: "px-5 py-3 text-micro",
        lg: "px-8 py-4 text-micro",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface BtnProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof btnVariants> {
  loading?: boolean;
  icon?:    React.ReactNode;
}

export function Btn({
  children, loading, icon, size, variant, fullWidth, className, disabled, ...props
}: BtnProps) {
  return (
    <button
      {...props}
      className={cn(btnVariants({ variant, size, fullWidth }), "rounded-[var(--radius-btn)]", className)}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={12} />
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}

const btnIconVariants = cva(
  "flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-btn-text hover:opacity-80 shadow-lg",
        ghost:   "bg-primary/5 text-primary hover:bg-primary/10 border border-primary/10",
        danger:  "bg-red-50 text-red-400 border border-red-100 hover:bg-red-100",
        outline: "bg-transparent text-primary border border-primary/20 hover:border-primary/50",
      },
      size: {
        sm: "w-8 h-8",
        md: "w-10 h-10",
        lg: "w-12 h-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export function BtnIcon({
  children, size, variant, loading, className, ...props
}: Omit<BtnProps, "icon" | "fullWidth">) {
  return (
    <button
      {...props}
      className={cn(btnIconVariants({ variant, size }), className)}
      disabled={props.disabled || loading}
    >
      {loading ? (
        <span className="w-4 h-4 border-[length:var(--border-width)] border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
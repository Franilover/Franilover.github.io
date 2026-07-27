"use client";

import React from "react";

export const TEXT_VARIANTS = {
  
  xs: "text-micro font-black uppercase tracking-[0.2em]",
  sm: "text-micro font-bold tracking-tight",
  md: "text-sm font-medium",
  lg: "text-lg font-serif italic",
  xl: "text-3xl font-black italic tracking-tighter",
  
  
  lbl: "text-micro font-black text-primary/40 uppercase tracking-widest block",
  cap: "text-micro font-black uppercase tracking-[0.3em] italic text-primary/30",
  btn: "text-micro font-black uppercase tracking-widest",
  err: "text-micro text-red-500 font-bold uppercase tracking-tight",
};

interface TextProps {
  
  variant?: keyof typeof TEXT_VARIANTS;
  className?: string;
  children: React.ReactNode;
  
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "label" | "div";
}

export function Text({ 
  variant = "md", 
  className = "", 
  children, 
  as: Tag = "p" 
}: TextProps) {
  return (
    <Tag className={`${TEXT_VARIANTS[variant]} ${className}`}>
      {children}
    </Tag>
  );
}

interface FieldWrapperProps {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ label, error, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5 w-full text-left">
      {label && (
        <Text as="label" variant="lbl">
          {label}
        </Text>
      )}
      
      {children}
      
      {error && (
        <Text className="mt-1" variant="err">
          {error}
        </Text>
      )}
    </div>
  );
}
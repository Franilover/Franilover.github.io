"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import React from "react";

import { MotionDiv } from "@/ui/Motion";
import { Text } from "@/ui/Tipografia";

interface ModalProps {
  open:      boolean;
  onClose:   () => void;
  title?:    string;
  subtitle?: string;
  children:  React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth = "max-w-sm" }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <MotionDiv
            animate={{ opacity: 1 }} className="absolute inset-0 bg-primary/20 backdrop-blur-sm" exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
          />
          <MotionDiv
            animate={{ scale: 1, opacity: 1 }}
            className={`relative bg-white-custom rounded-[var(--radius-card)] p-8 w-full ${maxWidth} shadow-2xl border border-primary/10 z-10`}
            exit={{ scale: 0.9, opacity: 0 }}
            initial={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {(title || subtitle) && (
              <div className="mb-6">
                {title && (
                  <h3 className="text-center text-primary font-black uppercase text-micro tracking-[0.3em] italic">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-center text-primary/40 text-micro font-bold uppercase tracking-widest mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            <button className="absolute top-5 right-5 text-primary/20 hover:text-primary transition-colors" onClick={onClose}>
              <X size={18} />
            </button>
            {children}
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );
}

interface CardProps {
  children:   React.ReactNode;
  className?: string;
  onClick?:   () => void;
  hover?:     boolean;
  padding?:   "none" | "sm" | "md" | "lg";
}

export function Card({ children, className = "", onClick, hover, padding = "md" }: CardProps) {
  const pads = { none: "", sm: "p-4", md: "p-6", lg: "p-8" };
  const Tag  = onClick ? motion.button : motion.div;

  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className={[
        "card-main text-left transition-all duration-200",
        pads[padding],
        onClick ? "cursor-pointer w-full" : "",
        hover || onClick
          ? "hover:border-primary/20 hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--primary)_10%,transparent)]"
          : "",
        className,
      ].join(" ")}
      whileHover={hover || onClick ? { y: -2 } : undefined}
    >
      {children}
    </Tag>
  );
}

interface PageHeaderProps {
  title:     string;
  subtitle?: string;
  icon?:     React.ReactNode;
  action?:   React.ReactNode;
}

export function PageHeader({ title, subtitle, icon, action }: PageHeaderProps) {
  return (
    <MotionDiv
      animate={{ x: 0, opacity: 1 }} className="flex items-end justify-between mb-10"
      initial={{ x: -20, opacity: 0 }}
    >
      <div>
        <Text as="h1" className="text-primary flex items-center gap-3 leading-none" variant="xl">
          {icon} {title}
        </Text>
        {subtitle && (
          <Text className="mt-2" variant="cap">
            {subtitle}
          </Text>
        )}
      </div>
      {action && <div>{action}</div>}
    </MotionDiv>
  );
}

interface BackBtnProps {
  onClick: () => void;
  label?:  string;
}

export function BackBtn({ onClick, label = "Volver" }: BackBtnProps) {
  return (
    <button
      className="flex items-center gap-2 font-black text-micro uppercase italic text-primary/40 hover:text-primary transition-colors group p-4"
      onClick={onClick}
    >
      <span className="group-hover:-translate-x-1 transition-transform">←</span>
      {label}
    </button>
  );
}

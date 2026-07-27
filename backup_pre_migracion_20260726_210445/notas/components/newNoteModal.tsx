"use client";
import { X } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

import { MotionDiv } from "@/components/ui/Motion";

interface NewNoteModalProps {
  /** Pre-fill the title input (used when creating a tag-page or following a [[link]]). */
  initialTitle?: string;
  onConfirm: (titulo: string) => void;
  onClose: () => void;
}

export default function NewNoteModal({ initialTitle, onConfirm, onClose }: NewNoteModalProps) {
  const [titulo, setTitulo] = useState(initialTitle ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Select all if pre-filled so the user can immediately retype
    if (initialTitle) inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    if (titulo.trim()) onConfirm(titulo.trim());
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onClose();
  };

  const monoStyle: React.CSSProperties = { fontFamily: "var(--font-mono)" };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Overlay */}
      <MotionDiv
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999]"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        style={{ background: "color-mix(in srgb, var(--bg-main) 70%, transparent)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <MotionDiv
        animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
        className="fixed z-[9999]"
        exit={{ opacity: 0, scale: 0.97, y: -8, x: "-50%" }}
        initial={{ opacity: 0, scale: 0.97, y: -8, x: "-50%" }}
        style={{
          top: "30%",
          left: "50%",
          width: "min(520px, calc(100vw - 32px))",
          background: "var(--bg-menu)",
          border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 24px 80px color-mix(in srgb, var(--bg-main) 60%, transparent)",
        }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)" }}
        >
          <span style={{
            fontSize: 9,
            color: "color-mix(in srgb, var(--foreground) 25%, transparent)",
            ...monoStyle,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}>
            {initialTitle ? `nueva página · "${initialTitle}"` : "nueva nota"}
          </span>
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "color-mix(in srgb, var(--foreground) 20%, transparent)",
              display: "flex",
              alignItems: "center",
            }}
            onClick={onClose}
          >
            <X size={13} />
          </button>
        </div>

        {/* Input */}
        <div className="px-4 py-4">
          <input
            ref={inputRef}
            className="w-full bg-transparent outline-none border-none"
            placeholder="título del pensamiento..."
            style={{
              fontSize: 20,
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              color: "color-mix(in srgb, var(--foreground) 80%, transparent)",
              letterSpacing: "-0.02em",
            }}
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={handleKey}
          />
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderTop: "1px solid color-mix(in srgb, var(--foreground) 7%, transparent)" }}
        >
          <span style={{ fontSize: 9, color: "color-mix(in srgb, var(--foreground) 15%, transparent)", ...monoStyle }}>
            <kbd style={{ padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, var(--foreground) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)" }}>enter</kbd>
            {" "}confirmar · {" "}
            <kbd style={{ padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, var(--foreground) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)" }}>esc</kbd>
            {" "}cancelar
          </span>

          <div className="flex items-center gap-2">
            <button
              style={{
                fontSize: 10,
                padding: "5px 12px",
                borderRadius: 5,
                border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                background: "transparent",
                color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
                cursor: "pointer",
                ...monoStyle,
              }}
              onClick={onClose}
            >
              cancelar
            </button>
            <button
              disabled={!titulo.trim()}
              style={{
                fontSize: 10,
                padding: "5px 14px",
                borderRadius: 5,
                border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)",
                background: titulo.trim() ? "color-mix(in srgb, var(--foreground) 10%, transparent)" : "transparent",
                color: titulo.trim() ? "color-mix(in srgb, var(--foreground) 70%, transparent)" : "color-mix(in srgb, var(--foreground) 15%, transparent)",
                cursor: titulo.trim() ? "pointer" : "not-allowed",
                ...monoStyle,
                transition: "all 0.1s",
              }}
              onClick={handleSubmit}
            >
              crear →
            </button>
          </div>
        </div>
      </MotionDiv>
    </>,
    document.body
  );
}
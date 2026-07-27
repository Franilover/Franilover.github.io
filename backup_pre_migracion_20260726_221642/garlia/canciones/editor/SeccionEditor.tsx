"use client";

import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";

import { useConfirm } from "@/components/ui/ConfirmModal";
import type {
  Seccion,
  IdiomaKey,
} from "@/domains/garlia/canciones/types";

import { SeccionTextarea } from "./SeccionTextarea";

export const SeccionEditor = ({
  sec,
  idiomaA,
  idiomaB,
  splitMode,
  countMode,
  onSaveField,
  onSaveNombre,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  sec: Seccion;
  idiomaA: IdiomaKey;
  idiomaB: IdiomaKey;
  splitMode: boolean;
  countMode: "silabas" | "vocales";
  onSaveField: (id: string, updates: Partial<Seccion>) => Promise<void>;
  onSaveNombre: (id: string, nombre: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (sec: Seccion) => Promise<void>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const [nombre, setNombre] = useState(sec.nombre_seccion);
  const { confirm, ConfirmModal } = useConfirm();

  return (
    <div>
      <div className="flex items-center gap-2 px-2 pt-1.5 pb-0.5">
        <GripVertical className="text-primary/15 shrink-0" size={13} />
        <input
          className="flex-1 bg-transparent text-micro font-black uppercase text-primary outline-none tracking-widest placeholder:text-primary/20 min-w-0 hover:bg-primary/5 focus:bg-primary/8 rounded-lg px-2 py-0.5 -mx-2 transition-colors"
          placeholder="NOMBRE DE SECCIÓN…"
          value={nombre}
          onBlur={() =>
            nombre !== sec.nombre_seccion && onSaveNombre(sec.id, nombre)
          }
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="p-1 rounded-lg hover:bg-primary/10 text-primary/20 hover:text-primary disabled:opacity-20 transition-all"
            disabled={isFirst}
            onClick={onMoveUp}
          >
            <ChevronUp size={12} />
          </button>
          <button
            className="p-1 rounded-lg hover:bg-primary/10 text-primary/20 hover:text-primary disabled:opacity-20 transition-all"
            disabled={isLast}
            onClick={onMoveDown}
          >
            <ChevronDown size={12} />
          </button>
          <button
            className="p-1 rounded-lg hover:bg-primary/10 text-primary/20 hover:text-primary transition-all"
            title="Duplicar sección"
            onClick={() => onDuplicate(sec)}
          >
            <Copy size={12} />
          </button>
          <button
            className="p-1 rounded-lg hover:bg-[color-mix(in_srgb,var(--callout-danger-border)_10%,transparent)] text-primary/20 hover:text-[var(--callout-danger-border)] transition-all"
            onClick={async () => {
              const ok = await confirm({
                message: `¿Eliminar sección "${nombre}"?`,
                danger: true,
              });
              if (ok) void onDelete(sec.id);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className={`px-2 pb-2 ${splitMode ? "flex gap-3" : ""}`}>
        {/*
          En split mode:
          - columna izquierda (idiomaA) toma como referencia idiomaB
          - columna derecha  (idiomaB) toma como referencia idiomaA
          En modo simple no hay referencia automática.
        */}
        <SeccionTextarea
          countMode={countMode}
          idioma={idiomaA}
          nombreSeccion={nombre}
          refIdioma={splitMode ? idiomaB : undefined}
          sec={sec}
          onSave={onSaveField}
        />
        {splitMode && (
          <>
            <div className="w-px bg-primary/10 shrink-0 self-stretch" />
            <SeccionTextarea
              countMode={countMode}
              idioma={idiomaB}
              nombreSeccion={nombre}
              refIdioma={idiomaA}
              sec={sec}
              onSave={onSaveField}
            />
          </>
        )}
      </div>
      <ConfirmModal />
    </div>
  );
};

"use client";

import { FolderOpen, ChevronRight, Check, Loader2, Home } from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";

import { cn } from "@/lib/utils/index";

interface SimpleImagePickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

type FileEntry = { name: string; url: string; type: "image" };
type FolderEntry = { name: string; type: "folder"; children: TreeNode[] };
type TreeNode = FileEntry | FolderEntry;

function flattenImages(nodes: TreeNode[]): FileEntry[] {
  return nodes.flatMap((n) =>
    n.type === "image" ? [n] : flattenImages(n.children),
  );
}

export default function SimpleImagePicker({
  onSelect,
  onClose,
}: SimpleImagePickerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [stack, setStack] = useState<{ name: string; nodes: TreeNode[] }[]>([]);

  useEffect(() => {
    void fetch("/dibujos-index.json")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTree(d.tree);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentNodes = stack.length > 0 ? stack[stack.length - 1].nodes : tree;

  const folders = useMemo(
    () => currentNodes.filter((n): n is FolderEntry => n.type === "folder"),
    [currentNodes],
  );
  const images = useMemo(
    () => currentNodes.filter((n): n is FileEntry => n.type === "image"),
    [currentNodes],
  );

  const openFolder = (folder: FolderEntry) => {
    setStack((prev) => [
      ...prev,
      { name: folder.name, nodes: folder.children },
    ]);
  };

  const goBack = (index: number) => {
    setStack((prev) => prev.slice(0, index));
  };

  return (
    <div className="flex flex-col" style={{ maxHeight: "60vh" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-1 pb-3 flex-wrap">
        <button
          className="flex items-center gap-1 text-micro font-black uppercase tracking-widest text-muted-on-surface hover:text-on-surface transition-colors"
          type="button"
          onClick={() => setStack([])}
        >
          <Home size={12} /> Inicio
        </button>
        {stack.map((s, i) => (
          <React.Fragment key={i}>
            <ChevronRight
              className="text-muted-on-surface opacity-40"
              size={10}
            />
            <button
              className="text-micro font-black uppercase tracking-widest text-muted-on-surface hover:text-on-surface transition-colors"
              type="button"
              onClick={() => goBack(i + 1)}
            >
              {s.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary/30" size={20} />
          </div>
        ) : (
          <>
            {/* Carpetas */}
            {folders.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {folders.map((folder, i) => (
                  <button
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-all text-left group border border-primary/10 hover:border-primary/20"
                    style={{ borderRadius: "var(--radius-btn)" }}
                    type="button"
                    onClick={() => openFolder(folder)}
                  >
                    <FolderOpen
                      className="text-primary/40 group-hover:text-primary/70 transition-colors shrink-0"
                      size={16}
                    />
                    <div className="min-w-0">
                      <p className="text-micro font-black uppercase tracking-widest text-on-surface truncate">
                        {folder.name}
                      </p>
                      <p className="text-micro text-muted-on-surface">
                        {flattenImages(folder.children).length} imágenes
                      </p>
                    </div>
                    <ChevronRight
                      className="text-muted-on-surface opacity-40 ml-auto shrink-0"
                      size={12}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Imágenes */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    className={cn(
                      "relative aspect-square overflow-hidden border-2 transition-all",
                      selected === img.url
                        ? "border-primary shadow-lg scale-[0.97]"
                        : "border-transparent hover:border-primary/30",
                    )}
                    style={{ borderRadius: "var(--radius-btn)" }}
                    type="button"
                    onClick={() => setSelected(img.url)}
                  >
                    <img
                      alt={img.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      src={img.url}
                    />
                    {selected === img.url && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <div className="bg-primary rounded-full p-1 shadow">
                          <Check
                            className="text-btn-text drop-shadow"
                            size={16}
                          />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {folders.length === 0 && images.length === 0 && (
              <p className="text-center text-micro text-muted-on-surface py-10 uppercase tracking-widest">
                Carpeta vacía
              </p>
            )}
          </>
        )}
      </div>

      {/* Acciones */}
      <div className="pt-4 flex gap-3">
        <button
          className="flex-1 py-4 text-micro font-black uppercase tracking-widest text-muted-on-surface hover:text-on-surface transition-colors"
          type="button"
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          className="btn-brand flex-[2] py-4 text-xs uppercase tracking-widest disabled:opacity-30"
          disabled={!selected}
          type="button"
          onClick={() => selected && onSelect(selected)}
        >
          Seleccionar
        </button>
      </div>
    </div>
  );
}

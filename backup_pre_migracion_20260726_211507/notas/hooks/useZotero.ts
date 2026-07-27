"use client";
import { useCallback, useEffect, useState } from "react";

import { db } from "@/lib/api/client/db";
import { useToast } from "@/hooks/ui/useToast";

export interface ZoteroSource {
  title: string;
  author: string;
  year: string;
  citekey?: string;
  journal?: string;
  url?: string;
}

const DEXIE_ZOTERO_KEY = "zotero_file_handle";
const LS_ZOTERO_CACHE  = "fran-zotero-cache";

async function saveZoteroHandle(handle: FileSystemFileHandle) {
  try {
    if (!db) return;
    await (db as any).reproductor_handles.put({ key: DEXIE_ZOTERO_KEY, handle });
  } catch {}
}

async function loadZoteroHandle(): Promise<FileSystemFileHandle | null> {
  try {
    if (!db) return null;
    const row = await (db as any).reproductor_handles.get(DEXIE_ZOTERO_KEY);
    return row?.handle ?? null;
  } catch { return null; }
}

function parseZoteroJson(json: any[]): ZoteroSource[] {
  return json.map((item: any) => ({
    title:   item.title || "",
    author:  item.author
      ? (Array.isArray(item.author)
          ? item.author.map((a: any) => a.family || a.literal || "").filter(Boolean).join(", ")
          : item.author)
      : (item.creators?.[0]?.lastName || ""),
    year:    item.issued?.["date-parts"]?.[0]?.[0]?.toString()
          || item.date?.substring(0, 4) || "",
    citekey: item.id || item["citation-key"] || "",
    journal: item["container-title"] || item.publisher || "",
    url:     item.URL || item.url || "",
  }));
}

async function readZoteroFile(handle: FileSystemFileHandle): Promise<ZoteroSource[]> {
  const file = await handle.getFile();
  const text = await file.text();
  const json  = JSON.parse(text);
  const items = Array.isArray(json) ? json : (json.items || json.references || []);
  return parseZoteroJson(items);
}

/**
 * Maneja la conexión con la librería de Zotero (archivo JSON exportado):
 * carga el handle guardado, cachea las fuentes en localStorage, y permite
 * al usuario conectar/reconectar el archivo manualmente.
 */
export function useZotero() {
  const { toast } = useToast();
  const [sources, setSources] = useState<ZoteroSource[]>([]);
  const [zoteroConnected, setZoteroConnected] = useState(false);

  useEffect(() => {
    void (async () => {
      const handle = await loadZoteroHandle();

      if (!handle) {
        const cached = localStorage.getItem(LS_ZOTERO_CACHE);
        if (cached) {
          try { setSources(JSON.parse(cached)); } catch {}
        }
        return;
      }

      try {
        const h    = handle as any;
        const perm = await h.queryPermission({ mode: "read" });
        const granted = perm === "granted"
          ? "granted"
          : await h.requestPermission({ mode: "read" });

        if (granted !== "granted") return;

        const parsed = await readZoteroFile(handle);
        setSources(parsed);
        setZoteroConnected(true);
        localStorage.setItem(LS_ZOTERO_CACHE, JSON.stringify(parsed));
      } catch {
        const cached = localStorage.getItem(LS_ZOTERO_CACHE);
        if (cached) {
          try { setSources(JSON.parse(cached)); } catch {}
        }
      }
    })();
  }, []);

  const connectZotero = useCallback(async () => {
    if (!("showOpenFilePicker" in window)) {
      const input = document.createElement("input");
      input.type   = "file";
      input.accept = ".json";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          const text  = await file.text();
          const json  = JSON.parse(text);
          const items = Array.isArray(json) ? json : (json.items || json.references || []);
          const parsed = parseZoteroJson(items);
          setSources(parsed);
          setZoteroConnected(true);
          localStorage.setItem(LS_ZOTERO_CACHE, JSON.stringify(parsed));
        } catch { toast.error("Error al leer el archivo Zotero"); }
      };
      input.click();
      return;
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types:    [{ description: "Zotero JSON", accept: { "application/json": [".json"] } }],
        multiple: false,
      });
      await saveZoteroHandle(handle);
      const parsed = await readZoteroFile(handle);
      setSources(parsed);
      setZoteroConnected(true);
      localStorage.setItem(LS_ZOTERO_CACHE, JSON.stringify(parsed));
    } catch (e: any) {
      if (e.name !== "AbortError") console.error(e);
    }
  }, [toast]);

  const refreshZotero = useCallback(async () => {
    const handle = await loadZoteroHandle();
    if (!handle) { void connectZotero(); return; }
    try {
      const h       = handle as any;
      const perm    = await h.queryPermission({ mode: "read" });
      const granted = perm === "granted"
        ? "granted"
        : await h.requestPermission({ mode: "read" });
      if (granted !== "granted") return;
      const parsed = await readZoteroFile(handle);
      setSources(parsed);
      localStorage.setItem(LS_ZOTERO_CACHE, JSON.stringify(parsed));
    } catch { void connectZotero(); }
  }, [connectZotero]);

  return { sources, zoteroConnected, connectZotero, refreshZotero };
}

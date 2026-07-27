"use client";





import { RotateCcw, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";





import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";





export interface Personaje { id: string; nombre: string; }





export function usePersonajes() {
  const [personajes, setPersonajes] = useState<Personaje[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    void (async () => {
      // 1️⃣ Dexie first — show cached data immediately
      try {
        const table = (db as any)["personajes"];
        if (table) {
          const local: Personaje[] = await table.orderBy("nombre").toArray();
          if (local.length > 0) { setPersonajes(local); setLoading(false); }
        }
      } catch {}

      // 2️⃣ Bail out if offline
      if (!navigator.onLine) { setLoading(false); return; }

      // 3️⃣ Refresh from Supabase and update cache
      try {
        const { data } = await supabase
          .from("personajes")
          .select("id, nombre")
          .order("nombre", { ascending: true });
        if (data) {
          setPersonajes(data as Personaje[]);
          try {
            const table = (db as any)["personajes"];
            if (table) await table.bulkPut(data);
          } catch {}
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  return { personajes, loading };
}





export function useLastOpenedId(storageKey: string): [string | null, (id: string | null) => void] {
  const [id, setIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(storageKey) || null;
  });

  const setId = useCallback((newId: string | null) => {
    setIdState(newId);
    if (typeof window === "undefined") return;
    if (newId) localStorage.setItem(storageKey, newId);
    else       localStorage.removeItem(storageKey);
  }, [storageKey]);

  return [id, setId];
}

interface DraftRestoreOptions {
  
  key: string;
  
  serverValue: string;
  
  enabled?: boolean;
}





export interface DraftHandle {
  hasDraft:   boolean;
  draftValue: string;
  save:       (value: string) => void;
  clear:      () => void;
  dismiss:    () => void;
}





export function useDraftRestore({ key, serverValue, enabled = true }: DraftRestoreOptions): DraftHandle {
  const [draftValue,  setDraftValue]  = useState("");
  const [hasDraft,    setHasDraft]    = useState(false);
  const [dismissed,   setDismissed]   = useState(false);

  
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    setDismissed(false);
    const raw = localStorage.getItem(key);
    if (!raw) { setHasDraft(false); setDraftValue(""); return; }
    try {
      const { value, ts: _ts } = JSON.parse(raw) as { value: string; ts: number };
      
      if (value && value !== serverValue) {
        setDraftValue(value);
        setHasDraft(true);
      } else {
        setHasDraft(false);
        setDraftValue("");
      }
    } catch {
      setHasDraft(false);
    }
  }, [key, serverValue, enabled]);

  const save = useCallback((value: string) => {
    if (!enabled || typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() }));
  }, [key, enabled]);

  const clear = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
    setHasDraft(false);
    setDraftValue("");
  }, [key]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setHasDraft(false);
  }, []);

  return {
    hasDraft:   hasDraft && !dismissed,
    draftValue,
    save,
    clear,
    dismiss,
  };
}





export function DraftRestoreBanner({
  draft,
  onRestore,
  label = "Hay un borrador local guardado",
}: {
  draft: DraftHandle;
  onRestore: (value: string) => void;
  label?: string;
}) {
  if (!draft.hasDraft) return null;

  return (
    <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-micro font-black uppercase tracking-widest">
      <span className="flex items-center gap-2 text-amber-500">
        <Save size={11} />
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-400 transition-all text-micro font-black uppercase"
          onClick={() => { onRestore(draft.draftValue); draft.dismiss(); }}
        >
          <RotateCcw size={10} /> Restaurar
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-500/60 hover:text-amber-500 transition-all"
          title="Descartar borrador"
          onClick={draft.dismiss}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}





const selectCls = "w-full bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5 text-sm font-medium text-primary outline-none focus:border-primary/40 transition-colors appearance-none cursor-pointer";





export function SelectPersonaje({
  value,
  onChange,
  placeholder = "Sin personaje",
  label = "Personaje",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const { personajes, loading } = usePersonajes();

  return (
    <div className="space-y-1.5">
      <label className="text-micro font-black uppercase text-primary/30 tracking-widest">{label}</label>
      <div className="relative">
        <select
          className={selectCls}
          disabled={loading}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">{loading ? "Cargando…" : placeholder}</option>
          {personajes.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        {}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 text-xs">▾</span>
      </div>
    </div>
  );
}





const IDIOMAS_OPCIONES = [
  { value: "Español",  label: "Español (ES)" },
  { value: "Japonés",  label: "Japonés (JP)" },
  { value: "Inglés",   label: "Inglés (EN)"  },
];





export function SelectIdioma({
  value,
  onChange,
  label = "Idioma",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-micro font-black uppercase text-primary/30 tracking-widest">{label}</label>
      <div className="relative">
        <select
          className={selectCls}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">Sin idioma</option>
          {IDIOMAS_OPCIONES.map(({ value: v, label: l }) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 text-xs">▾</span>
      </div>
    </div>
  );
}
// ─── useDebouncedValue ────────────────────────────────────────────────────
// Devuelve `value` retrasado `delayMs` — solo se actualiza cuando el valor
// deja de cambiar durante ese lapso. Pensado para separar el estado "vivo"
// (lo que ve el usuario mientras tipea, sin lag) de cálculos pesados que se
// derivan de ese estado (grafos narrativos, matching de texto, etc.) y no
// necesitan correr en cada tecla.
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

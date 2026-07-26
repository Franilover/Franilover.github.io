"use client";

import { useState, useEffect } from "react";

import { supabase } from "@/lib/api/client/supabase";

export function useValoresUnicos(tabla: string, columna: string) {
  const [valores, setValores] = useState<string[]>([]);
  useEffect(() => {
    supabase.from(tabla).select(columna).not(columna, "is", null)
      .then(({ data }) => {
        if (!data) return;
        const uniq = [...new Set(
          data.map((r: any) => r[columna]).filter(Boolean).map((v: string) => v.trim())
        )].sort() as string[];
        setValores(uniq);
      });
  }, [tabla, columna]);
  return valores;
}

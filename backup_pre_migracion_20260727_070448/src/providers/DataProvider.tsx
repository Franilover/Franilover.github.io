"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const CACHE_KEY = "app_data_cache";

interface DataContextValue {
  cache: Record<string, any>;
  updateCache: (tabla: string, data: any) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [cache, setCache] = useState<Record<string, any>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadCache = async () => {
      try {
        const saved = localStorage.getItem("fran_nexus_cache");
        if (saved) setCache(JSON.parse(saved));
      } catch {
        console.warn("[DataProvider] No se pudo cargar la caché");
      }
    };

    void loadCache();
  }, []);

  const updateCache = useCallback((tabla: string, data: any) => {
    setCache((prev) => {
      const newCache = { ...prev, [tabla]: data };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("fran_nexus_cache", JSON.stringify(newCache));
        } catch {}
      }

      return newCache;
    });
  }, []);

  return (
    <DataContext.Provider value={{ cache, updateCache }}>
      {children}
    </DataContext.Provider>
  );
};

export const useDataCache = (): DataContextValue => {
  const context = useContext(DataContext);
  if (!context) {
    return {
      cache: {},
      updateCache: () => {},
    };
  }
  return context;
};

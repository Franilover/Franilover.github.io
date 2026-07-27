"use client";




import React, { createContext, useContext, useEffect, useState } from "react";





export type ThemeName   = "default" | "pixel" | "slate" | "sepia";




export type DarkMode    = "light" | "dark";




export type AccentColor  = "purple" | "yellow" | "blue" | "red" | "green";

interface ThemeCtx {
  theme:      ThemeName;
  dark:       DarkMode;
  accent:     AccentColor;
  setTheme:   (t: ThemeName)    => void;
  toggleDark: ()                => void;
  setAccent:  (a: AccentColor)  => void;
}





const ThemeContext = createContext<ThemeCtx | null>(null);





const ACCENT_PALETTES: Record<AccentColor, {
  light: Record<string, string>;
  dark:  Record<string, string>;
}> = {
  purple: {
    light: {
      "--primary":    "#67556d",
      "--accent":     "#be97d1",
      "--bg-main":    "#e4d7e6",
      "--bg-menu":    "#67556d",
      "--foreground": "#3a2e3d",
      "--white-custom":"#ffffff",
      "--input-bg":   "#ffffff",
      "--input-text": "#3a2e3d",
      "--btn-text":   "#ffffff",
    },
    dark: {
      "--primary":    "#b89ec8",
      "--accent":     "#9d70b5",
      "--bg-main":    "#1c1720",
      "--bg-menu":    "#251e2c",
      "--foreground": "#e8daf2",
      "--white-custom":"#28202f",
      "--input-bg":   "#32273c",
      "--input-text": "#e8daf2",
      "--btn-text":   "#1c1720",
    },
  },
  yellow: {
    light: {
      "--primary":    "#7a6530",
      "--accent":     "#e8c84a",
      "--bg-main":    "#f5edcd",
      "--bg-menu":    "#7a6530",
      "--foreground": "#3d300f",
      "--white-custom":"#fffef5",
      "--input-bg":   "#fffef5",
      "--input-text": "#3d300f",
      "--btn-text":   "#fffef5",
    },
    dark: {
      "--primary":    "#d4aa45",
      "--accent":     "#f0c93a",
      "--bg-main":    "#1a1608",
      "--bg-menu":    "#231e0a",
      "--foreground": "#f5e9c0",
      "--white-custom":"#26200e",
      "--input-bg":   "#302810",
      "--input-text": "#f5e9c0",
      "--btn-text":   "#1a1608",
    },
  },
  blue: {
    light: {
      "--primary":    "#2d5580",
      "--accent":     "#5ba3e0",
      "--bg-main":    "#d6e8f5",
      "--bg-menu":    "#2d5580",
      "--foreground": "#0d2540",
      "--white-custom":"#f0f7fd",
      "--input-bg":   "#f0f7fd",
      "--input-text": "#0d2540",
      "--btn-text":   "#f0f7fd",
    },
    dark: {
      "--primary":    "#6aaad4",
      "--accent":     "#4488cc",
      "--bg-main":    "#080f1a",
      "--bg-menu":    "#0d1826",
      "--foreground": "#d0e8f8",
      "--white-custom":"#101c2e",
      "--input-bg":   "#162438",
      "--input-text": "#d0e8f8",
      "--btn-text":   "#080f1a",
    },
  },
  red: {
    light: {
      "--primary":    "#8b3030",
      "--accent":     "#d96060",
      "--bg-main":    "#f5d8d8",
      "--bg-menu":    "#8b3030",
      "--foreground": "#3d0f0f",
      "--white-custom":"#fff5f5",
      "--input-bg":   "#fff5f5",
      "--input-text": "#3d0f0f",
      "--btn-text":   "#fff5f5",
    },
    dark: {
      "--primary":    "#c87070",
      "--accent":     "#b04444",
      "--bg-main":    "#1a0808",
      "--bg-menu":    "#260e0e",
      "--foreground": "#f5d8d8",
      "--white-custom":"#2e1010",
      "--input-bg":   "#3c1414",
      "--input-text": "#f5d8d8",
      "--btn-text":   "#1a0808",
    },
  },
  green: {
    light: {
      "--primary":    "#2d6b45",
      "--accent":     "#5ab87a",
      "--bg-main":    "#d4eddc",
      "--bg-menu":    "#2d6b45",
      "--foreground": "#0d2d1a",
      "--white-custom":"#f0faf3",
      "--input-bg":   "#f0faf3",
      "--input-text": "#0d2d1a",
      "--btn-text":   "#f0faf3",
    },
    dark: {
      "--primary":    "#68b887",
      "--accent":     "#3d9960",
      "--bg-main":    "#08140d",
      "--bg-menu":    "#0d1f13",
      "--foreground": "#c8ecd6",
      "--white-custom":"#102016",
      "--input-bg":   "#142a1c",
      "--input-text": "#c8ecd6",
      "--btn-text":   "#08140d",
    },
  },
};

// Paletas extra para temas slate y sepia (no dependen del acento, usan sus propios CSS vars)
// Estas se usan para sobreescribir solo cuando el tema lo requiere




const THEME_OVERRIDES: Partial<Record<ThemeName, {
  light: Record<string, string>;
  dark:  Record<string, string>;
}>> = {
  slate: {
    light: {
      "--primary":     "#1a1a1a",
      "--accent":      "#555555",
      "--bg-main":     "#efefef",
      "--bg-menu":     "#1a1a1a",
      "--foreground":  "#0a0a0a",
      "--white-custom":"#ffffff",
      "--input-bg":    "#ffffff",
      "--input-text":  "#0a0a0a",
      "--btn-text":    "#ffffff",
    },
    dark: {
      "--primary":     "#d0d0d0",
      "--accent":      "#999999",
      "--bg-main":     "#111111",
      "--bg-menu":     "#050505",
      "--foreground":  "#f0f0f0",
      "--white-custom":"#1e1e1e",
      "--input-bg":    "#1e1e1e",
      "--input-text":  "#f0f0f0",
      "--btn-text":    "#111111",
    },
  },
  sepia: {
    light: {
      "--primary":     "#6b4423",
      "--accent":      "#c08040",
      "--bg-main":     "#f0e6d0",
      "--bg-menu":     "#3d2010",
      "--foreground":  "#2a1304",
      "--white-custom":"#fdf6ee",
      "--input-bg":    "#fdf6ee",
      "--input-text":  "#2a1304",
      "--btn-text":    "#fdf6ee",
    },
    dark: {
      "--primary":     "#d4a060",
      "--accent":      "#e8c080",
      "--bg-main":     "#1a1008",
      "--bg-menu":     "#100a04",
      "--foreground":  "#f0d8a8",
      "--white-custom":"#261808",
      "--input-bg":    "#201408",
      "--input-text":  "#f0d8a8",
      "--btn-text":    "#1a1008",
    },
  },
};





export const ACCENT_OPTIONS: { id: AccentColor; label: string; hex: string }[] = [
  { id: "purple", label: "Lila",   hex: "#9d70b5" },
  { id: "yellow", label: "Dorado", hex: "#e8c84a" },
  { id: "blue",   label: "Azul",   hex: "#5ba3e0" },
  { id: "red",    label: "Rojo",   hex: "#d96060" },
  { id: "green",  label: "Verde",  hex: "#5ab87a" },
];





const THEMES: { id: ThemeName; label: string; emoji: string }[] = [
  { id: "default",  label: "Minimalista", emoji: "" },
  { id: "pixel",    label: "Retro",       emoji: "" },
  { id: "slate",    label: "Monocromatico",   emoji: "" },
  { id: "sepia",    label: "Antiguo",     emoji: "" },
];

// Temas que tienen paleta fija y no usan el selector de color de acento




const THEMES_WITH_OVERRIDE = new Set<ThemeName>(["slate", "sepia"]);





function applyAccentPalette(accent: AccentColor, dark: DarkMode, theme?: ThemeName) {
  const root = document.documentElement;
  // Si el tema tiene override propio, aplica eso en vez del acento
  if (theme && THEME_OVERRIDES[theme]) {
    const palette = THEME_OVERRIDES[theme]![dark];
    Object.entries(palette).forEach(([key, val]) => root.style.setProperty(key, val));
    return;
  }
  const palette = ACCENT_PALETTES[accent][dark];
  Object.entries(palette).forEach(([key, val]) => root.style.setProperty(key, val));
}





export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,  setThemeState]  = useState<ThemeName>("sepia");
  const [dark,   setDarkState]   = useState<DarkMode>("dark");
  const [accent, setAccentState] = useState<AccentColor>("purple");

  
  useEffect(() => {
    try {
      const savedTheme  = localStorage.getItem("app-theme")  as ThemeName   | null;
      const savedDark   = localStorage.getItem("theme")       as DarkMode    | null;
      const savedAccent = localStorage.getItem("app-accent")  as AccentColor | null;
      if (savedTheme)  setThemeState(savedTheme);
      if (savedDark)   setDarkState(savedDark);
      if (savedAccent) setAccentState(savedAccent);
    } catch {}
  }, []);

  
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  
  useEffect(() => {
    if (dark === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    applyAccentPalette(accent, dark, theme);
  }, [dark, accent, theme]);

  
  useEffect(() => {
    applyAccentPalette(accent, dark, theme);
    localStorage.setItem("app-accent", accent);
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent, dark, theme]);

  const setTheme   = (t: ThemeName)   => setThemeState(t);
  const setAccent  = (a: AccentColor) => setAccentState(a);
  const toggleDark = () => setDarkState(d => d === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, dark, accent, setTheme, toggleDark, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}





export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}





export function ThemeSelector() {
  const { theme, setTheme, accent, setAccent } = useTheme();

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* Diseño */}
      <div className="flex flex-col gap-2">
        <p
          className="text-micro font-black uppercase tracking-[0.2em]"
          style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
        >
          Diseño
        </p>
        {THEMES.map(t => (
          <button
            key={t.id}
            className="flex items-center gap-3 px-3 py-2.5 transition-all text-left"
            style={{
              borderRadius: "var(--radius-btn)",
              border: `var(--border-width) solid ${theme === t.id ? "var(--primary)" : "color-mix(in srgb, var(--primary) 15%, transparent)"}`,
              background: theme === t.id
                ? "var(--primary)"
                : "color-mix(in srgb, var(--bg-main) 80%, transparent)",
              color: theme === t.id
                ? "var(--btn-text)"
                : "color-mix(in srgb, var(--primary) 60%, transparent)",
            }}
            onClick={() => setTheme(t.id)}
          >
            <span className="text-lg leading-none">{t.emoji}</span>
            <p className="text-micro font-black uppercase tracking-wide leading-none">{t.label}</p>
          </button>
        ))}
      </div>

      {/* Color — oculto para temas con paleta fija */}
      {!THEMES_WITH_OVERRIDE.has(theme) && (
        <div className="flex flex-col gap-2">
          <p
            className="text-micro font-black uppercase tracking-[0.2em]"
            style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
          >
            Color
          </p>
          <div className="flex gap-2 flex-wrap">
            {ACCENT_OPTIONS.map(a => (
              <button
                key={a.id}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  accent === a.id
                    ? "scale-110 border-white shadow-lg"
                    : "border-transparent hover:scale-105 opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: a.hex }}
                title={a.label}
                onClick={() => setAccent(a.id)}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
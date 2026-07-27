"use client";
import { AnimatePresence } from "framer-motion";
import {
  Utensils,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  ChefHat,
  Flame,
  Plus,
  X,
  Minus,
  Save,
  Dumbbell,
  Wheat,
  Droplets,
} from "lucide-react";
import React, { useState, useMemo } from "react";

import { Btn, BtnIcon, Loading } from "@/ui";
import { MotionDiv } from "@/ui/Motion";
import { ToastContainer } from "@/ui/ToastContainer";
import {
  SectionTitle,
  FieldInput,
} from "@/domains/personal/herramientas/cocina/SaludUi";
import { useSupabaseData } from "@/hooks/data/useSupabaseData";
import { useToast } from "@/hooks/ui/useToast";
import { recetasQueries } from "@/lib/api/queries/personal/cocina/recetas";
import type { Receta, Ingrediente, Inserts } from "@/lib/types/queries";
type NuevaReceta = Inserts<"recetas">;
type IngredienteReceta = {
  nombre: string;
  cantidad: string;
  kcal?: number;
  proteinas?: number;
  carbohidratos?: number;
  grasas?: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { label: "General", emoji: "🍽️" },
  { label: "Desayunos", emoji: "🥞" },
  { label: "Almuerzos", emoji: "🥗" },
  { label: "Cenas", emoji: "🌙" },
  { label: "Postres", emoji: "🍮" },
  { label: "Snacks", emoji: "🍿" },
];

const DIFICULTADES = ["Fácil", "Media", "Difícil"];

const INITIAL_FORM = {
  nombre: "",
  categoria: "General" as "General" | "Postres" | "Almuerzos" | "Desayunos",
  tiempo: "20 min",
  dificultad: "Fácil",
  ingredientes: [] as IngredienteReceta[],
  instrucciones: [] as string[],
  descripcion: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIngredientes(raw: any): IngredienteReceta[] {
  try {
    if (Array.isArray(raw)) return raw as IngredienteReceta[];
    if (typeof raw === "string") return JSON.parse(raw);
    if (raw && typeof raw === "object") return [raw] as IngredienteReceta[];
  } catch {}
  return [];
}

function parseInstrucciones(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try {
    if (typeof raw === "string") return JSON.parse(raw);
  } catch {}
  return [];
}

function calcTotales(list: IngredienteReceta[]) {
  return list.reduce(
    (acc, ing) => ({
      kcal: acc.kcal + (parseFloat(String(ing.kcal || 0)) || 0),
      proteinas: acc.proteinas + (parseFloat(String(ing.proteinas || 0)) || 0),
      carbos: acc.carbos + (parseFloat(String(ing.carbohidratos || 0)) || 0),
      grasas: acc.grasas + (parseFloat(String(ing.grasas || 0)) || 0),
    }),
    { kcal: 0, proteinas: 0, carbos: 0, grasas: 0 },
  );
}

// ─── MacroBadge — compact macro chip (mirrors ingredientes.tsx) ──────────────

function MacroBadge({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-1">
      <span className="text-micro font-black uppercase tracking-widest text-primary/30">
        {label}
      </span>
      <span className="text-micro font-black text-primary/70">
        {value.toFixed(0)}
        <span className="text-micro text-primary/30">{unit}</span>
      </span>
    </div>
  );
}

// ─── RecipeCard — compact card matching ingredientes.tsx density ────────────

function RecipeCard({
  receta,
  index,
  isOpen,
  onToggle,
}: {
  receta: Receta;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const catEmoji =
    CATEGORIAS.find((c) => c.label === receta.categoria)?.emoji ?? "🍽️";
  const ingredientesList = parseIngredientes(receta.ingredientes);
  const totales = calcTotales(ingredientesList);
  const ingCount = ingredientesList.length;

  return (
    <MotionDiv
      layout
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.02 } }}
      className={`card-main flex flex-col gap-1.5 p-2.5 transition-all relative cursor-pointer ${
        isOpen
          ? "ring-1 ring-accent/40 shadow-lg"
          : "hover:shadow-lg hover:-translate-y-0.5"
      }`}
      initial={{ opacity: 0, y: 12 }}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-micro font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-bg-menu text-menu-text flex items-center gap-1 shrink-0">
          <span>{catEmoji}</span>
          {receta.categoria}
        </span>
        <span className="text-primary/25">
          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </div>

      <div>
        <h3 className="text-micro font-black uppercase italic tracking-tight leading-tight mb-0.5 text-primary">
          {receta.nombre}
        </h3>
        <div className="flex items-center gap-2.5 text-micro font-bold uppercase tracking-widest text-primary/30">
          <span className="flex items-center gap-0.5">
            <Clock size={9} />
            {receta.tiempo}
          </span>
          <span className="flex items-center gap-0.5">
            <ChefHat size={9} />
            {receta.dificultad}
          </span>
          <span>{ingCount} ing.</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-(--radius-btn) bg-bg-main border border-primary/8 px-1">
        <MacroBadge label="Prot" unit="g" value={totales.proteinas} />
        <MacroBadge label="Carb" unit="g" value={totales.carbos} />
        <MacroBadge label="Gras" unit="g" value={totales.grasas} />
      </div>

      <div className="flex items-center gap-1.5 rounded-(--radius-btn) bg-accent/20 border border-accent/25 px-3 py-1.5">
        <Flame className="text-accent shrink-0 fill-accent/60" size={10} />
        <span className="text-micro font-black tracking-widest uppercase text-primary/70">
          {totales.kcal.toFixed(0)} kcal
        </span>
      </div>
    </MotionDiv>
  );
}

// ─── RecetaInline — full detail rendered in page flow, not floating ─────────

function RecetaInline({ receta }: { receta: Receta }) {
  const ingredientesList = parseIngredientes(receta.ingredientes);
  const instruccionesList = parseInstrucciones(receta.instrucciones);
  const totales = calcTotales(ingredientesList);
  const catEmoji =
    CATEGORIAS.find((c) => c.label === receta.categoria)?.emoji ?? "🍽️";

  return (
    <MotionDiv
      layout
      animate={{ opacity: 1, height: "auto" }}
      className="overflow-hidden"
      exit={{ opacity: 0, height: 0 }}
      initial={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="card-main p-3 mt-2 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-2 border-b border-primary/8">
          <div className="min-w-0">
            <span className="text-micro font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-bg-menu text-menu-text inline-flex items-center gap-1 mb-1.5">
              <span>{catEmoji}</span>
              {receta.categoria}
            </span>
            <h2 className="text-base font-black uppercase italic tracking-tighter text-primary leading-tight">
              {receta.nombre}
            </h2>
            {receta.descripcion && (
              <p className="text-micro text-primary/45 mt-1 leading-relaxed">
                {receta.descripcion}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-1">
            <div className="flex items-center gap-1 text-micro font-bold text-primary/45">
              <Clock className="text-primary/25" size={11} /> {receta.tiempo}
            </div>
            <div className="flex items-center gap-1 text-micro font-bold text-primary/45">
              <ChefHat className="text-primary/25" size={11} />{" "}
              {receta.dificultad}
            </div>
          </div>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="bg-bg-main border border-primary/8 rounded-(--radius-btn) py-1.5 text-center">
            <div className="flex justify-center mb-0.5">
              <Flame className="text-accent" size={10} />
            </div>
            <p className="text-micro font-black uppercase tracking-widest text-primary/25">
              Kcal
            </p>
            <p className="text-micro font-black text-primary">
              {totales.kcal.toFixed(0)}
            </p>
          </div>
          <div className="bg-bg-main border border-primary/8 rounded-(--radius-btn) py-1.5 text-center">
            <div className="flex justify-center mb-0.5">
              <Dumbbell className="text-blue-400" size={10} />
            </div>
            <p className="text-micro font-black uppercase tracking-widest text-primary/25">
              Prot
            </p>
            <p className="text-micro font-black text-primary">
              {totales.proteinas.toFixed(0)}
              <span className="text-micro text-primary/25">g</span>
            </p>
          </div>
          <div className="bg-bg-main border border-primary/8 rounded-(--radius-btn) py-1.5 text-center">
            <div className="flex justify-center mb-0.5">
              <Wheat className="text-amber-400" size={10} />
            </div>
            <p className="text-micro font-black uppercase tracking-widest text-primary/25">
              Carb
            </p>
            <p className="text-micro font-black text-primary">
              {totales.carbos.toFixed(0)}
              <span className="text-micro text-primary/25">g</span>
            </p>
          </div>
          <div className="bg-bg-main border border-primary/8 rounded-(--radius-btn) py-1.5 text-center">
            <div className="flex justify-center mb-0.5">
              <Droplets className="text-emerald-400" size={10} />
            </div>
            <p className="text-micro font-black uppercase tracking-widest text-primary/25">
              Gras
            </p>
            <p className="text-micro font-black text-primary">
              {totales.grasas.toFixed(0)}
              <span className="text-micro text-primary/25">g</span>
            </p>
          </div>
        </div>

        {/* Two-column: ingredientes + preparación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-micro font-black uppercase tracking-widest text-primary/30 px-0.5">
              Ingredientes
            </p>
            <ul className="divide-y divide-primary/6 bg-bg-main rounded-(--radius-btn) border border-primary/8 px-2">
              {ingredientesList.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between py-1.5 gap-2"
                >
                  <span className="text-micro font-bold text-primary uppercase leading-tight flex-1 min-w-0 truncate">
                    {ing.nombre}
                  </span>
                  <span className="text-micro font-black text-primary/30 shrink-0">
                    {ing.cantidad}
                  </span>
                </li>
              ))}
              {ingredientesList.length === 0 && (
                <li className="py-2 text-micro font-bold uppercase text-primary/25 text-center">
                  Sin ingredientes
                </li>
              )}
            </ul>
          </div>

          {instruccionesList.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-micro font-black uppercase tracking-widest text-primary/30 px-0.5">
                Preparación
              </p>
              <ol className="space-y-1.5 bg-bg-main rounded-(--radius-btn) border border-primary/8 p-2">
                {instruccionesList.map((paso, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-4 h-4 rounded-full bg-bg-menu text-menu-text text-micro font-black flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-micro font-bold leading-snug text-primary/65 uppercase">
                      {paso}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </MotionDiv>
  );
}

// ─── PendingIng ───────────────────────────────────────────────────────────────

interface PendingIng {
  base: Ingrediente;
  qty: number;
}

// ─── ModalAddReceta ───────────────────────────────────────────────────────────

function ModalAddReceta({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [searchIng, setSearchIng] = useState("");
  const [nuevoPaso, setNuevoPaso] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [pendingIng, setPendingIng] = useState<PendingIng | null>(null);
  const { toasts, toast, dismiss } = useToast();

  const { data: dbIngredientes } = useSupabaseData<Ingrediente>("ingredientes");

  const filteredDbIngredientes = useMemo(() => {
    if (!searchIng.trim()) return [];
    return dbIngredientes
      .filter(
        (i) =>
          i.nombre.toLowerCase().includes(searchIng.toLowerCase()) &&
          !formData.ingredientes.find((s) => s.nombre === i.nombre),
      )
      .slice(0, 6);
  }, [searchIng, dbIngredientes, formData.ingredientes]);

  const selectIngrediente = (ing: Ingrediente) => {
    setPendingIng({ base: ing, qty: 1 });
    setSearchIng("");
  };

  const confirmIngrediente = () => {
    if (!pendingIng) return;
    const { base, qty } = pendingIng;
    const mult = (v: number) =>
      Math.round(parseFloat(String(v || 0)) * qty * 10) / 10;
    setFormData((p) => ({
      ...p,
      ingredientes: [
        ...p.ingredientes,
        {
          nombre: base.nombre,
          cantidad: `${qty} × ${base.porcion_texto}`,
          kcal: mult(base.kcal),
          proteinas: mult(base.proteinas),
          carbohidratos: mult(base.carbohidratos),
          grasas: mult(base.grasas),
        },
      ],
    }));
    setPendingIng(null);
  };

  const removeIngrediente = (idx: number) =>
    setFormData((p) => ({
      ...p,
      ingredientes: p.ingredientes.filter((_, i) => i !== idx),
    }));

  const addPaso = () => {
    if (!nuevoPaso.trim()) return;
    setFormData((p) => ({
      ...p,
      instrucciones: [...p.instrucciones, nuevoPaso.trim()],
    }));
    setNuevoPaso("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.ingredientes.length === 0) {
      toast.warning("Añade al menos un ingrediente de la despensa");
      return;
    }
    setIsSaving(true);
    try {
      await recetasQueries.create({
        nombre: formData.nombre,
        categoria: formData.categoria,
        tiempo: formData.tiempo,
        dificultad: formData.dificultad,
        ingredientes: formData.ingredientes as any,
        instrucciones: formData.instrucciones,
        descripcion: formData.descripcion || "",
      } as NuevaReceta);
      onSuccess();
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const totalesPreview = calcTotales(formData.ingredientes);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 pb-16 sm:pb-6">
        <MotionDiv
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={onClose}
        />
        <MotionDiv
          animate={{ y: 0, opacity: 1 }}
          className="relative w-full sm:max-w-lg rounded-t-[40px] sm:rounded-(--radius-card) overflow-hidden bg-white-custom shadow-2xl max-h-[92vh] flex flex-col"
          exit={{ y: 60, opacity: 0 }}
          initial={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-7 pt-7 pb-4 shrink-0">
            <div>
              <div className="sm:hidden w-10 h-1 bg-primary/15 rounded-full mb-4" />
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">
                Nueva <span className="text-primary/20">Receta</span>
              </h2>
            </div>
            <BtnIcon
              className="hidden sm:flex border-none bg-primary/8 text-primary/40"
              variant="ghost"
              onClick={onClose}
            >
              <X size={16} />
            </BtnIcon>
          </div>

          <div className="overflow-y-auto flex-1 px-7 pb-7">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Información básica */}
              <section className="space-y-3">
                <SectionTitle>Información básica</SectionTitle>
                <FieldInput
                  required
                  label="Nombre del plato"
                  placeholder="Tortilla, Ensalada…"
                  value={formData.nombre}
                  onChange={(v) => setFormData((p) => ({ ...p, nombre: v }))}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-micro font-black uppercase tracking-widest text-primary/40 pl-1">
                      Categoría
                    </label>
                    <select
                      className="input-brand text-micro font-bold appearance-none"
                      value={formData.categoria}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          categoria: e.target.value as any,
                        }))
                      }
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.emoji} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FieldInput
                    label="Tiempo"
                    placeholder="20 min"
                    value={formData.tiempo}
                    onChange={(v) => setFormData((p) => ({ ...p, tiempo: v }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-micro font-black uppercase tracking-widest text-primary/40 pl-1">
                    Dificultad
                  </label>
                  <div className="flex gap-2">
                    {DIFICULTADES.map((d) => (
                      <button
                        key={d}
                        className={`flex-1 py-2 rounded-(--radius-btn) text-micro font-black uppercase tracking-wide border transition-all ${
                          formData.dificultad === d
                            ? "bg-bg-menu text-menu-text border-bg-menu"
                            : "bg-bg-main border-primary/15 text-primary/40 hover:border-primary/30"
                        }`}
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({ ...p, dificultad: d }))
                        }
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Ingredientes */}
              <section className="space-y-3">
                <SectionTitle>Ingredientes de la despensa</SectionTitle>

                <div className="relative">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/30"
                    size={14}
                  />
                  <input
                    className="input-brand pl-10 text-micro"
                    placeholder="Buscar en mi despensa..."
                    type="text"
                    value={searchIng}
                    onChange={(e) => setSearchIng(e.target.value)}
                  />
                  <AnimatePresence>
                    {filteredDbIngredientes.length > 0 && (
                      <MotionDiv
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full left-0 w-full bg-white-custom border border-primary/10 rounded-(--radius-btn) mt-1.5 shadow-xl z-50 overflow-hidden"
                        exit={{ opacity: 0, y: -6 }}
                        initial={{ opacity: 0, y: -6 }}
                      >
                        {filteredDbIngredientes.map((ing) => (
                          <button
                            key={ing.id}
                            className="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-bg-main transition-colors border-b border-primary/5 last:border-0"
                            type="button"
                            onClick={() => selectIngrediente(ing)}
                          >
                            <span className="text-micro font-bold uppercase text-primary">
                              {ing.nombre}
                            </span>
                            <span className="text-micro font-black text-primary/30 flex items-center gap-1">
                              {ing.proteinas}g P{" "}
                              <Plus className="text-primary/40" size={10} />
                            </span>
                          </button>
                        ))}
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pending ingredient confirmation */}
                <AnimatePresence>
                  {pendingIng && (
                    <MotionDiv
                      animate={{ opacity: 1, height: "auto" }}
                      className="overflow-hidden"
                      exit={{ opacity: 0, height: 0 }}
                      initial={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="bg-accent/10 border border-accent/25 rounded-(--radius-btn) p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-micro font-black uppercase text-primary">
                            {pendingIng.base.nombre}
                          </span>
                          <span className="text-micro font-bold text-primary/40">
                            {pendingIng.base.porcion_texto} / unidad
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-micro font-black uppercase tracking-widest text-primary/40 shrink-0">
                            Cant.
                          </span>
                          <button
                            className="w-6 h-6 flex items-center justify-center bg-white-custom rounded-(--radius-btn) border border-primary/10 text-primary/30 hover:text-primary transition-all shrink-0"
                            type="button"
                            onClick={() =>
                              setPendingIng((p) =>
                                p && p.qty > 0.5
                                  ? {
                                      ...p,
                                      qty: Math.round((p.qty - 0.5) * 10) / 10,
                                    }
                                  : p,
                              )
                            }
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            className="w-14 text-center bg-white-custom border border-primary/10 rounded-(--radius-btn) py-1 text-micro font-black text-primary outline-none"
                            min="0.5"
                            step="0.5"
                            type="number"
                            value={pendingIng.qty}
                            onChange={(e) =>
                              setPendingIng((p) =>
                                p
                                  ? {
                                      ...p,
                                      qty: Math.max(
                                        0.1,
                                        Number(e.target.value),
                                      ),
                                    }
                                  : p,
                              )
                            }
                          />
                          <button
                            className="w-6 h-6 flex items-center justify-center bg-white-custom rounded-(--radius-btn) border border-primary/10 text-primary/30 hover:text-primary transition-all shrink-0"
                            type="button"
                            onClick={() =>
                              setPendingIng((p) =>
                                p
                                  ? {
                                      ...p,
                                      qty: Math.round((p.qty + 0.5) * 10) / 10,
                                    }
                                  : p,
                              )
                            }
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1 rounded-(--radius-btn) bg-white-custom border border-primary/8 px-1">
                          <MacroBadge
                            label="Prot"
                            unit="g"
                            value={pendingIng.base.proteinas * pendingIng.qty}
                          />
                          <MacroBadge
                            label="Carb"
                            unit="g"
                            value={
                              pendingIng.base.carbohidratos * pendingIng.qty
                            }
                          />
                          <MacroBadge
                            label="Gras"
                            unit="g"
                            value={pendingIng.base.grasas * pendingIng.qty}
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Btn
                            className="flex-1"
                            size="sm"
                            type="button"
                            variant="ghost"
                            onClick={() => setPendingIng(null)}
                          >
                            Cancelar
                          </Btn>
                          <Btn
                            className="flex-1"
                            size="sm"
                            type="button"
                            onClick={confirmIngrediente}
                          >
                            Añadir
                          </Btn>
                        </div>
                      </div>
                    </MotionDiv>
                  )}
                </AnimatePresence>

                {/* Ingredient list */}
                {formData.ingredientes.length > 0 && (
                  <div className="space-y-1.5">
                    {formData.ingredientes.map((ing, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-bg-main border border-primary/8 rounded-(--radius-btn) px-3 py-1.5"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-micro font-black uppercase text-primary">
                            {ing.nombre}
                          </span>
                          <span className="text-micro text-primary/30 ml-2">
                            {ing.cantidad}
                          </span>
                        </div>
                        <span className="text-micro font-black text-primary/35 shrink-0">
                          {parseFloat(String(ing.kcal || 0)).toFixed(0)} kcal
                        </span>
                        <button
                          className="p-0.5 text-primary/20 hover:text-red-400 transition-colors ml-1 shrink-0"
                          type="button"
                          onClick={() => removeIngrediente(idx)}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Totals row */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <div className="bg-bg-main border border-primary/8 rounded-(--radius-btn) py-1.5 text-center">
                        <p className="text-micro font-black uppercase tracking-widest text-primary/25">
                          Kcal
                        </p>
                        <p className="text-micro font-black text-primary">
                          {totalesPreview.kcal.toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-bg-main border border-primary/8 rounded-(--radius-btn) py-1.5 text-center">
                        <p className="text-micro font-black uppercase tracking-widest text-primary/25">
                          Prot
                        </p>
                        <p className="text-micro font-black text-primary">
                          {totalesPreview.proteinas.toFixed(0)}g
                        </p>
                      </div>
                      <div className="bg-bg-main border border-primary/8 rounded-(--radius-btn) py-1.5 text-center">
                        <p className="text-micro font-black uppercase tracking-widest text-primary/25">
                          Carb
                        </p>
                        <p className="text-micro font-black text-primary">
                          {totalesPreview.carbos.toFixed(0)}g
                        </p>
                      </div>
                      <div className="bg-bg-main border border-primary/8 rounded-(--radius-btn) py-1.5 text-center">
                        <p className="text-micro font-black uppercase tracking-widest text-primary/25">
                          Gras
                        </p>
                        <p className="text-micro font-black text-primary">
                          {totalesPreview.grasas.toFixed(0)}g
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Pasos */}
              <section className="space-y-3">
                <SectionTitle>Pasos de preparación</SectionTitle>
                <div className="flex gap-2">
                  <input
                    className="input-brand flex-1 text-micro"
                    placeholder="Describe un paso…"
                    value={nuevoPaso}
                    onChange={(e) => setNuevoPaso(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPaso();
                      }
                    }}
                  />
                  <BtnIcon
                    className="shrink-0 w-9 h-9"
                    type="button"
                    onClick={addPaso}
                  >
                    <Plus size={15} />
                  </BtnIcon>
                </div>
                {formData.instrucciones.length > 0 && (
                  <div className="space-y-1.5">
                    {formData.instrucciones.map((paso, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 bg-bg-main border border-primary/8 rounded-(--radius-btn) px-3 py-2"
                      >
                        <span className="w-4 h-4 rounded-full bg-bg-menu text-menu-text text-micro font-black flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-micro font-bold text-primary/65 uppercase flex-1 leading-snug">
                          {paso}
                        </span>
                        <button
                          className="text-primary/20 hover:text-red-400 transition-colors shrink-0"
                          type="button"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              instrucciones: p.instrucciones.filter(
                                (_, i) => i !== idx,
                              ),
                            }))
                          }
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Btn
                fullWidth
                disabled={!formData.nombre.trim()}
                icon={<Save size={16} />}
                loading={isSaving}
                size="lg"
                type="submit"
              >
                Guardar receta
              </Btn>
            </form>
          </div>
        </MotionDiv>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

// ─── RecetasPage ──────────────────────────────────────────────────────────────

const RecetasPage = () => {
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openId, setOpenId] = useState<string | number | null>(null);

  const { data: recipes, loading } = useSupabaseData<Receta>("recetas");

  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      !filter ||
      r.nombre.toLowerCase().includes(filter.toLowerCase()) ||
      r.categoria.toLowerCase().includes(filter.toLowerCase());
    const matchesCat = !catFilter || r.categoria === catFilter;
    return matchesSearch && matchesCat;
  });

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recipes.forEach((r) => {
      counts[r.categoria] = (counts[r.categoria] || 0) + 1;
    });
    return counts;
  }, [recipes]);

  const openReceta = recipes.find((r) => r.id === openId) ?? null;
  const activeFilters = [filter, catFilter].filter(Boolean).length;

  return (
    <div className="bg-bg-main text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-bg-main/90 backdrop-blur-xl border-b border-primary/10">
        <div className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black uppercase tracking-tighter italic leading-none text-primary">
              Mis <span className="text-primary/20">Recetas</span>
            </h1>
          </div>

          <div className="relative w-full sm:w-48">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary/30"
              size={11}
            />
            <input
              className="input-brand pl-7 pr-7 text-micro py-1.5"
              placeholder="Buscar..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filter && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary transition-colors"
                onClick={() => setFilter("")}
              >
                <X size={10} />
              </button>
            )}
          </div>

          <Btn
            icon={<Plus size={11} />}
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            Añadir
          </Btn>
        </div>
      </header>

      <main className="px-3 pt-3 pb-6 space-y-3">
        {/* Category filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            className={`flex items-center gap-1 px-2 py-1 rounded-(--radius-btn) text-micro font-black uppercase tracking-wide transition-all border ${
              catFilter === null
                ? "bg-primary text-btn-text border-primary shadow-sm"
                : "bg-white-custom border-primary/15 text-primary/50 hover:border-primary/30 hover:text-primary"
            }`}
            onClick={() => setCatFilter(null)}
          >
            Todas
            <span
              className={`text-micro px-1 py-0.5 rounded-full font-black ${catFilter === null ? "bg-btn-text/20" : "bg-primary/5 text-primary/40"}`}
            >
              {recipes.length}
            </span>
          </button>

          {CATEGORIAS.map(({ label, emoji }) => {
            const count = catCounts[label] || 0;
            if (count === 0) return null;
            const active = catFilter === label;
            return (
              <button
                key={label}
                className={`flex items-center gap-1 px-2 py-1 rounded-(--radius-btn) text-micro font-black uppercase tracking-wide transition-all border ${
                  active
                    ? "bg-bg-menu text-menu-text border-bg-menu shadow-sm"
                    : "bg-white-custom border-primary/15 text-primary/50 hover:border-primary/30 hover:text-primary"
                }`}
                onClick={() => setCatFilter(active ? null : label)}
              >
                <span>{emoji}</span>
                {label}
                <span
                  className={`text-micro px-1 py-0.5 rounded-full font-black ${active ? "bg-btn-text/20" : "bg-primary/5 text-primary/40"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {activeFilters > 0 && (
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded-(--radius-btn) text-micro font-black uppercase tracking-wide text-primary/40 hover:text-primary border border-dashed border-primary/20 hover:border-primary/40 transition-all"
              onClick={() => {
                setFilter("");
                setCatFilter(null);
              }}
            >
              <X size={9} />
              Limpiar ({activeFilters})
            </button>
          )}

          {activeFilters > 0 && (
            <span className="text-micro font-bold text-primary/30 uppercase tracking-widest ml-1">
              {filteredRecipes.length} resultado
              {filteredRecipes.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <Loading fullScreen={false} />
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Utensils className="mx-auto text-primary/15" size={32} />
            <p className="text-micro font-black uppercase tracking-widest text-primary/25">
              {filter || catFilter ? "Sin resultados" : "Sin recetas aún"}
            </p>
            {(filter || catFilter) && (
              <button
                className="text-micro font-black text-accent hover:text-primary transition-colors uppercase tracking-wide"
                onClick={() => {
                  setFilter("");
                  setCatFilter(null);
                }}
              >
                Quitar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <AnimatePresence mode="popLayout">
              {filteredRecipes.map((receta, i) => (
                <RecipeCard
                  key={receta.id ?? i}
                  index={i}
                  isOpen={openId === receta.id}
                  receta={receta}
                  onToggle={() =>
                    setOpenId((prev) => (prev === receta.id ? null : receta.id))
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Inline detail — rendered in page flow, never floating */}
        <AnimatePresence mode="wait">
          {openReceta && (
            <RecetaInline key={openReceta.id} receta={openReceta} />
          )}
        </AnimatePresence>
      </main>

      {/* Modal: add new recipe (the only overlay, by design — creation flow) */}
      <AnimatePresence>
        {isModalOpen && (
          <ModalAddReceta
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => setIsModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecetasPage;

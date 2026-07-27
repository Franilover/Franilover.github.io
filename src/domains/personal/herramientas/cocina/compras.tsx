"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  ShoppingCart,
  Flame,
  Dumbbell,
  Wheat,
  Droplets,
  Package,
  Plus,
  Minus,
  Pencil,
  Check,
} from "lucide-react";
import React, { useState, useMemo, useRef, useEffect } from "react";

import { Loading } from "@/components/ui";
import { useSupabaseData } from "@/hooks/data/useSupabaseData";
import type { Ingrediente } from "@/lib/types/queries";

// ─── tipos ────────────────────────────────────────────────────────────────────
type MacroEdits = Partial<{
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  precio: number;
}>;

type CartEntry = {
  qty: number;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
// Devuelve el valor efectivo: el editado por el usuario o el original del ingrediente
function getEffective(
  item: Ingrediente,
  edits: MacroEdits,
  key: keyof MacroEdits,
): number {
  return edits[key] ?? (item as any)[key] ?? 0;
}

// ─── Macro Popover (mobile) ───────────────────────────────────────────────────
function MacroPopover({
  item,
  edits,
  onClose,
}: {
  item: Ingrediente;
  edits: MacroEdits;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const macros = [
    {
      label: "Calorías",
      value: getEffective(item, edits, "kcal"),
      unit: "kcal",
      Icon: Flame,
      color: "text-orange-400",
    },
    {
      label: "Proteínas",
      value: getEffective(item, edits, "proteinas"),
      unit: "g",
      Icon: Dumbbell,
      color: "text-blue-400",
    },
    {
      label: "Carbohidratos",
      value: getEffective(item, edits, "carbohidratos"),
      unit: "g",
      Icon: Wheat,
      color: "text-amber-400",
    },
    {
      label: "Grasas",
      value: getEffective(item, edits, "grasas"),
      unit: "g",
      Icon: Droplets,
      color: "text-yellow-400",
    },
  ];

  return (
    <motion.div
      ref={ref}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-white-custom border border-primary/12 rounded-[var(--radius-card)] shadow-xl p-3 space-y-1.5"
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      initial={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-micro font-black uppercase tracking-widest text-primary/30 pb-1 border-b border-primary/8">
        {item.nombre} · {item.porcion_texto}
      </p>
      {macros.map(({ label, value, unit, Icon, color }) => (
        <div key={label} className="flex items-center gap-2">
          <Icon className={`${color} shrink-0`} size={11} />
          <span className="text-micro font-bold text-primary/50 flex-1">
            {label}
          </span>
          <span className="text-micro font-black text-primary">
            {value.toFixed(unit === "kcal" ? 0 : 1)}
          </span>
          <span className="text-micro text-primary/25">{unit}</span>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Ingrediente Editor ───────────────────────────────────────────────────────
// Edita los macros/precio BASE del ingrediente — completamente independiente del carrito
function IngredienteEditor({
  item,
  edits,
  onUpdate,
  onClose,
}: {
  item: Ingrediente;
  edits: MacroEdits;
  onUpdate: (edits: MacroEdits) => void;
  onClose: () => void;
}) {
  const fields: {
    key: keyof MacroEdits;
    label: string;
    unit: string;
    step: string;
  }[] = [
    { key: "kcal", label: "Calorías", unit: "kcal", step: "1" },
    { key: "proteinas", label: "Proteínas", unit: "g", step: "0.1" },
    { key: "carbohidratos", label: "Carbohidratos", unit: "g", step: "0.1" },
    { key: "grasas", label: "Grasas", unit: "g", step: "0.1" },
    { key: "precio", label: "Precio", unit: "$", step: "0.01" },
  ];

  const [local, setLocal] = useState<MacroEdits>(() => {
    const o: MacroEdits = {};
    fields.forEach((f) => {
      o[f.key] = getEffective(item, edits, f.key);
    });
    return o;
  });

  return (
    <motion.div
      animate={{ opacity: 1, height: "auto" }}
      className="overflow-hidden"
      exit={{ opacity: 0, height: 0 }}
      initial={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="mx-4 mb-3 rounded-[var(--radius-btn)] border border-primary/10 bg-bg-main overflow-hidden">
        <div className="px-3 py-2 border-b border-primary/8 flex items-center justify-between">
          <span className="text-micro font-black uppercase tracking-widest text-primary/40">
            Editar valores · por porción
          </span>
          <button
            className="text-primary/25 hover:text-primary transition-colors"
            onClick={onClose}
          >
            <X size={12} />
          </button>
        </div>
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fields.map(({ key, label, unit, step }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-micro font-black uppercase tracking-widest text-primary/30 pl-0.5">
                {label} ({unit})
              </label>
              <input
                className="input-brand text-micro font-black py-1.5 px-2"
                min="0"
                step={step}
                type="number"
                value={local[key] ?? 0}
                onChange={(e) =>
                  setLocal((p) => ({ ...p, [key]: Number(e.target.value) }))
                }
              />
            </div>
          ))}
        </div>
        <div className="px-3 pb-3 flex justify-end">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-btn)] bg-accent text-white text-micro font-black uppercase tracking-widest"
            onClick={() => {
              onUpdate(local);
              onClose();
            }}
          >
            <Check size={11} /> Aplicar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Cart Item Row ────────────────────────────────────────────────────────────
function CartItemRow({
  item,
  entry,
  edits,
  onRemove,
  onQty,
}: {
  item: Ingrediente;
  entry: CartEntry;
  edits: MacroEdits;
  onRemove: () => void;
  onQty: (delta: number) => void;
}) {
  const precio = getEffective(item, edits, "precio");
  const kcal = getEffective(item, edits, "kcal");

  return (
    <div className="border-b border-accent/10 last:border-0">
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Nombre */}
        <div className="flex-1 min-w-0">
          <p className="text-micro font-black uppercase italic tracking-tight text-primary truncate">
            {item.nombre}
          </p>
          <p className="text-micro text-primary/30 uppercase font-bold">
            {item.porcion_texto}
          </p>
        </div>

        {/* Macros resumen */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className="text-micro font-black text-primary/40">
            {(kcal * entry.qty).toFixed(0)} kcal
          </span>
          {precio > 0 && (
            <span className="text-micro font-black text-accent">
              ${(precio * entry.qty).toFixed(0)}
            </span>
          )}
        </div>
        <div className="flex sm:hidden items-center gap-1.5 shrink-0">
          <span className="text-micro font-black text-primary/40">
            {(kcal * entry.qty).toFixed(0)} kcal
          </span>
        </div>

        {/* Qty controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-btn)] border border-primary/15 text-primary/30 hover:text-red-400 hover:border-red-100 transition-all"
            onClick={() => onQty(-1)}
          >
            <Minus size={10} />
          </button>
          <span className="w-5 text-center text-micro font-black text-primary">
            {entry.qty}
          </span>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-btn)] border border-primary/15 text-primary/30 hover:text-accent hover:border-accent/40 transition-all"
            onClick={() => onQty(1)}
          >
            <Plus size={10} />
          </button>
        </div>

        {/* Remove */}
        <button
          className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-btn)] text-primary/20 hover:text-red-400 hover:bg-red-50 transition-all"
          onClick={onRemove}
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────
function IngredienteRow({
  item,
  i,
  inCart,
  onToggle,
  edits,
  onUpdateEdits,
}: {
  item: Ingrediente;
  i: number;
  inCart: boolean;
  onToggle: () => void;
  edits: MacroEdits;
  onUpdateEdits: (edits: MacroEdits) => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const hasEdits = Object.keys(edits).length > 0;

  return (
    <>
      <tr
        className={`border-b border-primary/5 last:border-0 transition-colors ${
          inCart ? "bg-accent/8" : i % 2 === 0 ? "" : "bg-primary/[0.015]"
        }`}
      >
        <td className="pl-4 pr-2 py-3 w-8">
          <button
            className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all shrink-0 ${
              inCart
                ? "bg-accent border-accent text-white"
                : "border-primary/20 hover:border-accent/60"
            }`}
            onClick={onToggle}
          >
            {inCart && (
              <svg fill="none" height="8" viewBox="0 0 10 8" width="10">
                <path
                  d="M1 4l3 3 5-6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            )}
          </button>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <div>
              <p className="text-sm font-black uppercase italic tracking-tight text-primary leading-none">
                {item.nombre}
              </p>
              <p className="text-micro font-bold text-primary/30 uppercase mt-0.5">
                {item.porcion_texto}
              </p>
            </div>
            <button
              className={`w-5 h-5 flex items-center justify-center rounded-[var(--radius-btn)] transition-all shrink-0 ${
                editing
                  ? "bg-accent/20 text-accent"
                  : hasEdits
                    ? "text-accent/60 hover:text-accent hover:bg-accent/10"
                    : "text-primary/20 hover:text-accent hover:bg-accent/10"
              }`}
              title="Editar macros"
              onClick={() => setEditing((p) => !p)}
            >
              <Pencil size={10} />
            </button>
          </div>
        </td>
        <td className="px-3 py-3 text-right">
          <div className="relative inline-block">
            <button
              className="flex items-center gap-0.5 justify-end"
              onClick={() => setPopoverOpen((p) => !p)}
            >
              <span
                className={`text-micro font-black ${edits.kcal !== undefined ? "text-accent" : "text-primary"}`}
              >
                {getEffective(item, edits, "kcal").toFixed(0)}
              </span>
              <span className="text-micro text-primary/25 ml-0.5">kcal</span>
            </button>
            <AnimatePresence>
              {popoverOpen && (
                <MacroPopover
                  edits={edits}
                  item={item}
                  onClose={() => setPopoverOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </td>
        <td className="px-3 py-3 text-right hidden sm:table-cell">
          <span
            className={`text-micro font-black ${edits.proteinas !== undefined ? "text-accent" : "text-primary"}`}
          >
            {getEffective(item, edits, "proteinas").toFixed(1)}
          </span>
          <span className="text-micro text-primary/25 ml-0.5">g</span>
        </td>
        <td className="px-3 py-3 text-right hidden sm:table-cell">
          <span
            className={`text-micro font-black ${edits.carbohidratos !== undefined ? "text-accent" : "text-primary"}`}
          >
            {getEffective(item, edits, "carbohidratos").toFixed(1)}
          </span>
          <span className="text-micro text-primary/25 ml-0.5">g</span>
        </td>
        <td className="px-3 py-3 text-right hidden sm:table-cell">
          <span
            className={`text-micro font-black ${edits.grasas !== undefined ? "text-accent" : "text-primary"}`}
          >
            {getEffective(item, edits, "grasas").toFixed(1)}
          </span>
          <span className="text-micro text-primary/25 ml-0.5">g</span>
        </td>
        <td className="px-4 py-3 text-right">
          {getEffective(item, edits, "precio") > 0 ? (
            <span
              className={`text-micro font-black ${edits.precio !== undefined ? "text-accent" : "text-primary"}`}
            >
              ${getEffective(item, edits, "precio").toFixed(0)}
            </span>
          ) : (
            <span className="text-micro text-primary/15">—</span>
          )}
        </td>
      </tr>

      {/* Editor inline bajo la fila */}
      <AnimatePresence>
        {editing && (
          <tr>
            <td className="p-0 border-b border-primary/5" colSpan={7}>
              <IngredienteEditor
                edits={edits}
                item={item}
                onClose={() => setEditing(false)}
                onUpdate={onUpdateEdits}
              />
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ComprasPage() {
  const { data: ingredientes, loading } =
    useSupabaseData<Ingrediente>("ingredientes");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  // Ediciones de macros/precio por ingrediente — independientes del carrito
  const [ingredienteEdits, setIngredienteEdits] = useState<
    Record<string, MacroEdits>
  >({});

  const items = useMemo(
    () =>
      ingredientes.filter(
        (i) => !search || i.nombre.toLowerCase().includes(search.toLowerCase()),
      ),
    [ingredientes, search],
  );

  const cartIds = Object.keys(cart);
  const cartItems = useMemo(
    () => ingredientes.filter((i) => cartIds.includes(i.id)),
    [ingredientes, cart],
  );

  const inCart = (id: string) => !!cart[id];

  const toggle = (id: string) =>
    setCart((prev) => {
      if (prev[id]) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { qty: 1 } };
    });

  const removeFromCart = (id: string) =>
    setCart((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });

  const updateQty = (id: string, delta: number) =>
    setCart((prev) => {
      const entry = prev[id];
      if (!entry) return prev;
      const qty = Math.max(1, entry.qty + delta);
      return { ...prev, [id]: { ...entry, qty } };
    });

  const updateEdits = (id: string, edits: MacroEdits) =>
    setIngredienteEdits((prev) => ({ ...prev, [id]: edits }));

  const getEdits = (id: string): MacroEdits => ingredienteEdits[id] ?? {};

  const cartTotals = useMemo(
    () =>
      cartItems.reduce(
        (acc, item) => {
          const qty = cart[item.id]?.qty ?? 1;
          const edits = getEdits(item.id);
          return {
            kcal: acc.kcal + getEffective(item, edits, "kcal") * qty,
            proteinas:
              acc.proteinas + getEffective(item, edits, "proteinas") * qty,
            carbohidratos:
              acc.carbohidratos +
              getEffective(item, edits, "carbohidratos") * qty,
            grasas: acc.grasas + getEffective(item, edits, "grasas") * qty,
            precio: acc.precio + getEffective(item, edits, "precio") * qty,
          };
        },
        { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, precio: 0 },
      ),
    [cartItems, cart, ingredienteEdits],
  );

  const tableTotals = useMemo(
    () =>
      items.reduce(
        (acc, i) => {
          const edits = getEdits(i.id);
          return {
            kcal: acc.kcal + getEffective(i, edits, "kcal"),
            proteinas: acc.proteinas + getEffective(i, edits, "proteinas"),
            carbohidratos:
              acc.carbohidratos + getEffective(i, edits, "carbohidratos"),
            grasas: acc.grasas + getEffective(i, edits, "grasas"),
          };
        },
        { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
      ),
    [items, ingredienteEdits],
  );

  const allVisibleInCart = items.length > 0 && items.every((i) => inCart(i.id));
  const toggleAll = () => {
    if (allVisibleInCart) {
      setCart((prev) => {
        const next = { ...prev };
        items.forEach((i) => {
          delete next[i.id];
        });
        return next;
      });
    } else {
      setCart((prev) => {
        const next = { ...prev };
        items.forEach((i) => {
          if (!next[i.id]) next[i.id] = { qty: 1 };
        });
        return next;
      });
    }
  };

  const totalCartItems = cartItems.reduce(
    (acc, i) => acc + (cart[i.id]?.qty ?? 1),
    0,
  );

  return (
    <div className="min-h-screen bg-bg-main pb-28 text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-bg-main/90 backdrop-blur-xl border-b border-primary/10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic leading-none text-primary">
              Mi <span className="text-primary/20">Lista</span>
            </h1>
          </div>
          <div className="relative w-full sm:w-56">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30"
              size={13}
            />
            <input
              className="input-brand pl-9 pr-8 text-micro py-2"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary transition-colors"
                onClick={() => setSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 pt-5 space-y-4">
        {/* ── Bloque carrito ── */}
        <AnimatePresence>
          {cartItems.length > 0 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="card-main overflow-hidden border-accent/25 bg-accent/5"
              exit={{ opacity: 0, y: -12 }}
              initial={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
            >
              {/* Header carrito */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-accent/15">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="text-accent" size={14} />
                  <span className="text-micro font-black uppercase tracking-widest text-primary/60">
                    Carrito
                  </span>
                  <span className="text-micro px-2 py-0.5 rounded-full bg-accent/20 text-accent font-black">
                    {totalCartItems}
                  </span>
                </div>
                <button
                  className="text-micro font-black uppercase tracking-widest text-primary/25 hover:text-red-400 transition-colors"
                  onClick={() => setCart({})}
                >
                  Vaciar
                </button>
              </div>

              {/* Items */}
              <div>
                {cartItems.map((item) => (
                  <CartItemRow
                    key={item.id}
                    edits={getEdits(item.id)}
                    entry={cart[item.id] ?? { qty: 1 }}
                    item={item}
                    onQty={(delta) => updateQty(item.id, delta)}
                    onRemove={() => removeFromCart(item.id)}
                  />
                ))}
              </div>

              {/* Totales carrito */}
              <div className="flex items-center gap-4 px-4 py-3 border-t border-accent/15 bg-accent/8 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Flame className="text-orange-400" size={11} />
                  <span className="text-micro font-black text-primary">
                    {cartTotals.kcal.toFixed(0)}
                  </span>
                  <span className="text-micro text-primary/30">kcal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Dumbbell className="text-blue-400" size={11} />
                  <span className="text-micro font-black text-primary">
                    {cartTotals.proteinas.toFixed(1)}
                  </span>
                  <span className="text-micro text-primary/30">g prot</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wheat className="text-amber-400" size={11} />
                  <span className="text-micro font-black text-primary">
                    {cartTotals.carbohidratos.toFixed(1)}
                  </span>
                  <span className="text-micro text-primary/30">g carb</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Droplets className="text-yellow-400" size={11} />
                  <span className="text-micro font-black text-primary">
                    {cartTotals.grasas.toFixed(1)}
                  </span>
                  <span className="text-micro text-primary/30">g gras</span>
                </div>
                {cartTotals.precio > 0 && (
                  <div className="ml-auto flex items-baseline gap-1">
                    <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                      Total
                    </span>
                    <span className="text-lg font-black italic tracking-tighter text-accent">
                      ${cartTotals.precio.toFixed(0)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tabla ── */}
        {loading ? (
          <Loading text="Cargando lista..." />
        ) : (
          <div className="card-main overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary/8">
                  <th className="pl-4 pr-2 py-3 w-8">
                    <button
                      className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all ${
                        allVisibleInCart
                          ? "bg-accent border-accent text-white"
                          : "border-primary/20 hover:border-accent/60"
                      }`}
                      title={
                        allVisibleInCart
                          ? "Deseleccionar todo"
                          : "Seleccionar todo"
                      }
                      onClick={toggleAll}
                    >
                      {allVisibleInCart && (
                        <svg
                          fill="none"
                          height="8"
                          viewBox="0 0 10 8"
                          width="10"
                        >
                          <path
                            d="M1 4l3 3 5-6"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                          />
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="text-left px-3 py-3 text-micro font-black uppercase tracking-widest text-primary/30 w-full">
                    Ingrediente
                  </th>
                  <th className="text-right px-3 py-3 text-micro font-black uppercase tracking-widest text-primary/30 whitespace-nowrap">
                    <span className="sm:hidden text-accent/70">Kcal ↗</span>
                    <span className="hidden sm:inline">Kcal</span>
                  </th>
                  <th className="text-right px-3 py-3 text-micro font-black uppercase tracking-widest text-primary/30 whitespace-nowrap hidden sm:table-cell">
                    Prot
                  </th>
                  <th className="text-right px-3 py-3 text-micro font-black uppercase tracking-widest text-primary/30 whitespace-nowrap hidden sm:table-cell">
                    Carb
                  </th>
                  <th className="text-right px-3 py-3 text-micro font-black uppercase tracking-widest text-primary/30 whitespace-nowrap hidden sm:table-cell">
                    Gras
                  </th>
                  <th className="text-right px-4 py-3 text-micro font-black uppercase tracking-widest text-primary/30 whitespace-nowrap">
                    Precio
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="text-center py-20" colSpan={7}>
                      <Package
                        className="mx-auto text-primary/15 mb-2"
                        size={36}
                      />
                      <p className="text-micro font-black uppercase tracking-widest text-primary/25">
                        Sin resultados
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, i) => (
                    <IngredienteRow
                      key={item.id}
                      edits={getEdits(item.id)}
                      i={i}
                      inCart={inCart(item.id)}
                      item={item}
                      onToggle={() => toggle(item.id)}
                      onUpdateEdits={(edits) => updateEdits(item.id, edits)}
                    />
                  ))
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-primary/10 bg-primary/[0.02]">
                    <td className="pl-4 pr-2 py-3" />
                    <td className="px-3 py-3">
                      <span className="text-micro font-black uppercase tracking-widest text-primary/40">
                        {items.length} ingredientes
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-micro font-black text-primary">
                        {tableTotals.kcal.toFixed(0)}
                      </span>
                      <span className="text-micro text-primary/25 ml-0.5">
                        kcal
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right hidden sm:table-cell">
                      <span className="text-micro font-black text-primary">
                        {tableTotals.proteinas.toFixed(1)}
                      </span>
                      <span className="text-micro text-primary/25 ml-0.5">
                        g
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right hidden sm:table-cell">
                      <span className="text-micro font-black text-primary">
                        {tableTotals.carbohidratos.toFixed(1)}
                      </span>
                      <span className="text-micro text-primary/25 ml-0.5">
                        g
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right hidden sm:table-cell">
                      <span className="text-micro font-black text-primary">
                        {tableTotals.grasas.toFixed(1)}
                      </span>
                      <span className="text-micro text-primary/25 ml-0.5">
                        g
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-micro text-primary/15">—</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </main>

      {/* ── Footer sticky ── */}
      <AnimatePresence>
        {cartItems.length > 0 && (
          <motion.div
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-0 inset-x-0 z-20 bg-bg-main/95 backdrop-blur-xl border-t border-primary/10"
            exit={{ y: 80, opacity: 0 }}
            initial={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
          >
            <div className="max-w-5xl mx-auto px-5 py-4 flex items-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <ShoppingCart className="text-accent" size={15} />
                <span className="text-micro font-black uppercase tracking-widest text-primary/50">
                  {totalCartItems} ítem{totalCartItems !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex-1 flex items-center gap-3 overflow-x-auto">
                <span className="text-micro font-bold text-primary/30 shrink-0">
                  {cartTotals.kcal.toFixed(0)} kcal
                </span>
                <span className="text-micro font-bold text-primary/30 shrink-0 hidden sm:inline">
                  {cartTotals.proteinas.toFixed(1)}g prot
                </span>
                <span className="text-micro font-bold text-primary/30 shrink-0 hidden sm:inline">
                  {cartTotals.carbohidratos.toFixed(1)}g carb
                </span>
              </div>
              <div className="shrink-0 flex items-baseline gap-1.5">
                <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                  Total
                </span>
                {cartTotals.precio > 0 ? (
                  <span className="text-xl font-black italic tracking-tighter text-primary">
                    ${cartTotals.precio.toFixed(0)}
                  </span>
                ) : (
                  <span className="text-micro font-black text-primary/20">
                    —
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

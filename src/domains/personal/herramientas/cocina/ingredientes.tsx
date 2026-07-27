"use client";
import { AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  X,
  Save,
  Package,
  PackageX,
  Minus,
  FlaskConical,
  Flame,
  Trash2,
  Calculator,
  ShoppingCart,
  Pencil,
  Drumstick,
  Wheat,
  Droplets,
  Leaf,
  Apple,
  Milk,
  Sparkles,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import React, { useState, useMemo, useEffect } from "react";

import { Btn, BtnIcon, Loading } from "@/components/ui";
import { MotionDiv } from "@/components/ui/Motion";
import { ToastContainer } from "@/components/ui/ToastContainer";
import {
  SectionTitle,
  FieldInput,
  MacroBadge,
} from "@/domains/personal/herramientas/cocina/SaludUi";
import { useSupabaseData } from "@/hooks/data/useSupabaseData";
import { useToast } from "@/hooks/ui/useToast";
import type { Ingrediente } from "@/lib/types/queries";

const CATEGORIAS: { label: string; Icon: LucideIcon }[] = [
  { label: "Proteínas", Icon: Drumstick },
  { label: "Carbohidratos", Icon: Wheat },
  { label: "Grasas", Icon: Droplets },
  { label: "Verduras", Icon: Leaf },
  { label: "Frutas", Icon: Apple },
  { label: "Lácteos", Icon: Milk },
  { label: "Superfoods", Icon: Sparkles },
  { label: "Cereales", Icon: Layers },
];

const INITIAL_FORM = {
  nombre: "",
  categoria: "Verduras",
  kcal: 0,
  proteinas: 0,
  carbohidratos: 0,
  grasas: 0,
  porcion_texto: "100g",
  stock_actual: 0,
  fibra: 0,
  sodio: 0,
  agua_ml: 0,
};

export const IngredientesPage = () => {
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<
    "all" | "in-stock" | "out-of-stock"
  >("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const { toasts, toast, dismiss } = useToast();

  const {
    data: ingredientes,
    loading: hookLoading,
    refetch,
    addRow,
    updateRow,
    deleteRow,
  } = useSupabaseData<Ingrediente>("ingredientes");

  const [localItems, setLocalItems] = useState<Ingrediente[] | null>(() =>
    ingredientes?.length ? ingredientes : null,
  );
  const [editItem, setEditItem] = useState<Ingrediente | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editForm, setEditForm] = useState(INITIAL_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [qtyOpen, setQtyOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (localItems === null && ingredientes?.length) {
      setLocalItems(ingredientes);
    }
  }, [ingredientes]);

  const isLoading = localItems === null && hookLoading;
  const items = localItems ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !filter ||
        item.nombre?.toLowerCase().includes(filter.toLowerCase()) ||
        item.categoria?.toLowerCase().includes(filter.toLowerCase());
      const matchesCat = !catFilter || item.categoria === catFilter;
      const hasStock = (item.stock_actual || 0) > 0;
      const matchesStock =
        stockFilter === "all"
          ? true
          : stockFilter === "in-stock"
            ? hasStock
            : !hasStock;
      return matchesSearch && matchesCat && matchesStock;
    });
  }, [items, filter, catFilter, stockFilter]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => {
      counts[i.categoria] = (counts[i.categoria] || 0) + 1;
    });
    return counts;
  }, [items]);

  const stats = useMemo(
    () => ({
      total: items.length,
      inStock: items.filter((i) => (i.stock_actual || 0) > 0).length,
      outStock: items.filter((i) => (i.stock_actual || 0) === 0).length,
    }),
    [items],
  );

  const patch = (key: keyof typeof INITIAL_FORM) => (v: string) =>
    setFormData((p) => ({
      ...p,
      [key]: typeof INITIAL_FORM[key] === "number" ? Number(v) : v,
    }));

  const patchEdit = (key: keyof typeof INITIAL_FORM) => (v: string) =>
    setEditForm((p) => ({
      ...p,
      [key]: typeof INITIAL_FORM[key] === "number" ? Number(v) : v,
    }));

  const openEdit = (item: Ingrediente) => {
    setEditForm({
      nombre: item.nombre ?? "",
      categoria: item.categoria ?? "Verduras",
      kcal: item.kcal ?? 0,
      proteinas: item.proteinas ?? 0,
      carbohidratos: item.carbohidratos ?? 0,
      grasas: item.grasas ?? 0,
      porcion_texto: item.porcion_texto ?? "100g",
      stock_actual: item.stock_actual ?? 0,
      fibra: item.fibra ?? 0,
      sodio: item.sodio ?? 0,
      agua_ml: item.agua_ml ?? 0,
    });
    setEditItem(item);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setIsEditSaving(true);
    try {
      const result = await updateRow(editItem.id, editForm);
      if (result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : ((result.error as any)?.message ?? JSON.stringify(result.error));
        toast.error(`Error al guardar: ${msg}`);
      } else {
        setLocalItems((prev) =>
          (prev ?? []).map((i) =>
            i.id === editItem.id ? { ...i, ...editForm } : i,
          ),
        );
        setEditItem(null);
      }
    } catch (err) {
      toast.error(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleUpdateStock = async (
    id: string,
    current: number,
    delta: number,
  ) => {
    const newStock = Math.max(0, current + delta);
    setLocalItems((prev) =>
      (prev ?? []).map((item) =>
        item.id === id ? { ...item, stock_actual: newStock } : item,
      ),
    );
    if (updateRow) {
      const result = await updateRow(id, { stock_actual: newStock });
      if (result.error) {
        setLocalItems((prev) =>
          (prev ?? []).map((item) =>
            item.id === id ? { ...item, stock_actual: current } : item,
          ),
        );
      }
    }
  };

  const handleDelete = async (id: string) => {
    setLocalItems((prev) => (prev ?? []).filter((item) => item.id !== id));
    setConfirmDelete(null);
    if (deleteRow) {
      const result = await deleteRow(id);
      if (result?.error) {
        setLocalItems(null);
        void refetch();
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const result = await addRow(formData);
      if (result.error) {
        console.error("Error al guardar ingrediente:", result.error);
        const msg =
          typeof result.error === "string"
            ? result.error
            : ((result.error as any)?.message ?? JSON.stringify(result.error));
        toast.error(`Error al guardar: ${msg}`);
      } else {
        setIsModalOpen(false);
        setFormData(INITIAL_FORM);
        if (result.data) {
          setLocalItems((prev) => [
            ...(prev ?? []),
            result.data as Ingrediente,
          ]);
        } else {
          setLocalItems(null);
          void refetch();
        }
      }
    } catch (err) {
      toast.error(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const activeFilters = [filter, catFilter, stockFilter !== "all"].filter(
    Boolean,
  ).length;

  return (
    <div className="bg-bg-main text-foreground">
      <header className="sticky top-0 z-10 bg-bg-main/90 backdrop-blur-xl border-b border-primary/10">
        <div className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black uppercase tracking-tighter italic leading-none text-primary">
              Mi <span className="text-primary/20">Despensa</span>
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

          <div className="flex items-center gap-1.5">
            <Link
              className="flex items-center gap-1.5 text-micro py-1.5 px-3 tracking-widest font-black uppercase rounded-[var(--radius-btn)] border border-primary/20 text-primary/50 hover:border-primary/40 hover:text-primary transition-all bg-white-custom"
              href="/personal/salud/compras"
            >
              <ShoppingCart size={11} />
              <span className="hidden sm:inline">Compras</span>
            </Link>

            <Btn
              icon={<Plus size={11} />}
              size="sm"
              onClick={() => setIsModalOpen(true)}
            >
              Añadir
            </Btn>
          </div>
        </div>
      </header>

      <main className="px-3 pt-3 pb-6 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            className={`flex items-center gap-1 px-2 py-1 rounded-[var(--radius-btn)] text-micro font-black uppercase tracking-wide transition-all border ${
              catFilter === null
                ? "bg-primary text-btn-text border-primary shadow-sm"
                : "bg-white-custom border-primary/15 text-primary/50 hover:border-primary/30 hover:text-primary"
            }`}
            onClick={() => setCatFilter(null)}
          >
            Todos
            <span
              className={`text-micro px-1 py-0.5 rounded-full font-black ${catFilter === null ? "bg-btn-text/20" : "bg-primary/5 text-primary/40"}`}
            >
              {stats.total}
            </span>
          </button>

          {CATEGORIAS.map(({ label, Icon }) => {
            const count = catCounts[label] || 0;
            if (count === 0) return null;
            const active = catFilter === label;
            return (
              <button
                key={label}
                className={`flex items-center gap-1 px-2 py-1 rounded-[var(--radius-btn)] text-micro font-black uppercase tracking-wide transition-all border ${
                  active
                    ? "bg-bg-menu text-menu-text border-bg-menu shadow-sm"
                    : "bg-white-custom border-primary/15 text-primary/50 hover:border-primary/30 hover:text-primary"
                }`}
                onClick={() => setCatFilter(active ? null : label)}
              >
                <Icon size={10} />
                {label}
                <span
                  className={`text-micro px-1 py-0.5 rounded-full font-black ${active ? "bg-btn-text/20" : "bg-primary/5 text-primary/40"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            {
              label: "En stock",
              key: "in-stock" as const,
              value: stats.inStock,
              dot: "bg-accent",
            },
            {
              label: "Agotado",
              key: "out-of-stock" as const,
              value: stats.outStock,
              dot: "bg-primary/40",
            },
          ].map((f) => (
            <button
              key={f.key}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-btn)] text-micro font-black uppercase tracking-wide transition-all border ${
                stockFilter === f.key
                  ? "bg-accent/30 border-accent/50 text-primary"
                  : "bg-transparent border-primary/10 text-primary/35 hover:border-primary/25 hover:text-primary/60"
              }`}
              onClick={() =>
                setStockFilter(stockFilter === f.key ? "all" : f.key)
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />
              {f.label}
              <span className="font-black opacity-60">{f.value}</span>
            </button>
          ))}

          {activeFilters > 0 && (
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-btn)] text-micro font-black uppercase tracking-wide text-primary/40 hover:text-primary border border-dashed border-primary/20 hover:border-primary/40 transition-all"
              onClick={() => {
                setFilter("");
                setCatFilter(null);
                setStockFilter("all");
              }}
            >
              <X size={9} />
              Limpiar ({activeFilters})
            </button>
          )}

          {(filter || catFilter || stockFilter !== "all") && (
            <span className="text-micro font-bold text-primary/30 uppercase tracking-widest ml-1">
              {filteredItems.length} resultado
              {filteredItems.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {isLoading ? (
          <Loading fullScreen={false} />
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FlaskConical className="mx-auto text-primary/15" size={32} />
            <p className="text-micro font-black uppercase tracking-widest text-primary/25">
              {filter || catFilter ? "Sin resultados" : "Despensa vacía"}
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
              {filteredItems.map((item, i) => {
                const hasStock = (item.stock_actual || 0) > 0;
                const CatIcon =
                  CATEGORIAS.find((c) => c.label === item.categoria)?.Icon ??
                  FlaskConical;
                const isConfirm = confirmDelete === item.id;

                return (
                  <MotionDiv
                    key={item.id}
                    layout
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: { delay: i * 0.025 },
                    }}
                    className="card-main flex flex-col gap-1.5 p-2.5 hover:shadow-lg hover:-translate-y-0.5 transition-all relative"
                    exit={{
                      opacity: 0,
                      scale: 0.9,
                      transition: { duration: 0.15 },
                    }}
                    initial={{ opacity: 0, y: 16 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-micro font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-bg-menu text-menu-text flex items-center gap-1 shrink-0">
                        <CatIcon size={9} />
                        {item.categoria}
                      </span>

                      <AnimatePresence mode="wait">
                        {isConfirm ? (
                          <MotionDiv
                            key="confirm"
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-1"
                            exit={{ opacity: 0, x: 8 }}
                            initial={{ opacity: 0, x: 8 }}
                          >
                            <span className="text-micro font-black uppercase text-red-400 tracking-wide">
                              ¿Eliminar?
                            </span>
                            <button
                              className="px-1.5 py-0.5 rounded-[var(--radius-btn)] bg-red-100 text-red-500 text-micro font-black uppercase hover:bg-red-200 transition-all"
                              onClick={() => handleDelete(item.id)}
                            >
                              Sí
                            </button>
                            <button
                              className="px-1.5 py-0.5 rounded-[var(--radius-btn)] bg-primary/8 text-primary/40 text-micro font-black uppercase hover:bg-primary/15 transition-all"
                              onClick={() => setConfirmDelete(null)}
                            >
                              No
                            </button>
                          </MotionDiv>
                        ) : (
                          <MotionDiv
                            key="trash"
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-0.5"
                            exit={{ opacity: 0 }}
                            initial={{ opacity: 0 }}
                          >
                            <BtnIcon
                              className="border-none text-primary/20 hover:text-accent hover:bg-accent/10 w-5 h-5"
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil size={10} />
                            </BtnIcon>
                            <BtnIcon
                              className="border-none text-primary/20 hover:text-red-400 hover:bg-red-50 w-5 h-5"
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDelete(item.id)}
                            >
                              <Trash2 size={11} />
                            </BtnIcon>
                          </MotionDiv>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-micro font-black uppercase italic tracking-tight leading-tight mb-0.5 text-primary">
                          {item.nombre}
                        </h3>
                        <p className="text-micro font-bold uppercase tracking-widest text-primary/30">
                          por {item.porcion_texto}
                        </p>
                      </div>
                      <button
                        className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-[var(--radius-btn)] text-micro font-black uppercase tracking-wide border transition-all ${
                          qtyOpen[item.id]
                            ? "bg-accent/25 border-accent/40 text-primary"
                            : "bg-bg-main border-primary/10 text-primary/35 hover:text-primary hover:border-primary/25"
                        }`}
                        onClick={() =>
                          setQtyOpen((p) => ({ ...p, [item.id]: !p[item.id] }))
                        }
                      >
                        <Calculator size={10} />×{qtyMap[item.id] ?? 1}
                      </button>
                    </div>

                    <AnimatePresence>
                      {qtyOpen[item.id] && (
                        <MotionDiv
                          animate={{ opacity: 1, height: "auto" }}
                          className="overflow-hidden"
                          exit={{ opacity: 0, height: 0 }}
                          initial={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <div className="flex items-center gap-1.5 bg-accent/10 border border-accent/20 rounded-[var(--radius-btn)] px-2 py-1.5">
                            <span className="text-micro font-black uppercase tracking-widest text-primary/40 shrink-0">
                              Cant.
                            </span>
                            <button
                              className="w-5 h-5 flex items-center justify-center bg-white-custom rounded-[var(--radius-btn)] border border-primary/10 text-primary/30 hover:text-primary transition-all shrink-0"
                              onClick={() =>
                                setQtyMap((p) => ({
                                  ...p,
                                  [item.id]: Math.max(
                                    0.5,
                                    (p[item.id] ?? 1) - 0.5,
                                  ),
                                }))
                              }
                            >
                              <Minus size={9} />
                            </button>
                            <input
                              className="w-12 text-center bg-white-custom border border-primary/10 rounded-[var(--radius-btn)] py-0.5 text-micro font-black text-primary outline-none"
                              min="0.1"
                              step="0.5"
                              type="number"
                              value={qtyMap[item.id] ?? 1}
                              onChange={(e) =>
                                setQtyMap((p) => ({
                                  ...p,
                                  [item.id]: Math.max(
                                    0.1,
                                    Number(e.target.value),
                                  ),
                                }))
                              }
                            />
                            <button
                              className="w-5 h-5 flex items-center justify-center bg-white-custom rounded-[var(--radius-btn)] border border-primary/10 text-primary/30 hover:text-primary transition-all shrink-0"
                              onClick={() =>
                                setQtyMap((p) => ({
                                  ...p,
                                  [item.id]: (p[item.id] ?? 1) + 0.5,
                                }))
                              }
                            >
                              <Plus size={9} />
                            </button>
                            <button
                              className="ml-auto text-micro font-black uppercase text-primary/25 hover:text-primary transition-colors tracking-wide"
                              onClick={() => {
                                setQtyMap((p) => ({ ...p, [item.id]: 1 }));
                              }}
                            >
                              Reset
                            </button>
                          </div>
                        </MotionDiv>
                      )}
                    </AnimatePresence>

                    {(() => {
                      const q = qtyMap[item.id] ?? 1;
                      const sc = (v: number) =>
                        q === 1 ? undefined : Math.round(v * q * 10) / 10;
                      return (
                        <>
                          <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-btn)] bg-bg-main border border-primary/8 px-1">
                            <MacroBadge
                              label="Prot"
                              scaled={sc(item.proteinas)}
                              unit="g"
                              value={item.proteinas}
                            />
                            <MacroBadge
                              label="Carb"
                              scaled={sc(item.carbohidratos)}
                              unit="g"
                              value={item.carbohidratos}
                            />
                            <MacroBadge
                              label="Gras"
                              scaled={sc(item.grasas)}
                              unit="g"
                              value={item.grasas}
                            />
                          </div>

                          {(item.fibra > 0 ||
                            item.sodio > 0 ||
                            item.agua_ml > 0) && (
                            <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-btn)] bg-bg-main border border-primary/8 px-1">
                              {item.fibra > 0 && (
                                <MacroBadge
                                  label="Fibra"
                                  scaled={sc(item.fibra)}
                                  unit="g"
                                  value={item.fibra}
                                />
                              )}
                              {item.sodio > 0 && (
                                <MacroBadge
                                  label="Sodio"
                                  scaled={sc(item.sodio)}
                                  unit="mg"
                                  value={item.sodio}
                                />
                              )}
                              {item.agua_ml > 0 && (
                                <MacroBadge
                                  label="Agua"
                                  scaled={sc(item.agua_ml)}
                                  unit="ml"
                                  value={item.agua_ml}
                                />
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 rounded-[var(--radius-btn)] bg-accent/20 border border-accent/25 px-3 py-1.5">
                            <Flame
                              className="text-accent shrink-0 fill-accent/60"
                              size={10}
                            />
                            <span
                              className={`text-micro font-black tracking-widest uppercase flex-1 transition-colors ${q !== 1 ? "text-accent" : "text-primary/70"}`}
                            >
                              {q === 1 ? item.kcal : Math.round(item.kcal * q)}{" "}
                              kcal
                              {q !== 1 && (
                                <span className="text-primary/30 font-semibold ml-1.5 normal-case tracking-normal text-micro">
                                  ({item.kcal} c/u)
                                </span>
                              )}
                            </span>
                          </div>
                        </>
                      );
                    })()}

                    <div
                      className={`flex items-center justify-between rounded-[var(--radius-btn)] px-2 py-1.5 border ${
                        hasStock
                          ? "bg-accent/5 border-accent/20"
                          : "bg-primary/5 border-primary/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {hasStock ? (
                          <Package
                            className="text-green-400/80 shrink-0"
                            size={11}
                          />
                        ) : (
                          <PackageX
                            className="text-red-300 shrink-0"
                            size={11}
                          />
                        )}
                        <span
                          className={`text-micro font-black uppercase ${hasStock ? "text-green-600/70" : "text-red-400/70"}`}
                        >
                          {hasStock ? `${item.stock_actual} uds.` : "Agotado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="w-5 h-5 flex items-center justify-center bg-white-custom rounded-[var(--radius-btn)] border border-primary/10 text-primary/30 hover:text-red-300 hover:border-red-100 transition-all"
                          onClick={() =>
                            handleUpdateStock(item.id, item.stock_actual, -1)
                          }
                        >
                          <Minus size={10} />
                        </button>
                        <button
                          className="w-5 h-5 flex items-center justify-center bg-white-custom rounded-[var(--radius-btn)] border border-primary/10 text-primary/30 hover:text-green-400/80 hover:border-green-100 transition-all"
                          onClick={() =>
                            handleUpdateStock(item.id, item.stock_actual, 1)
                          }
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </MotionDiv>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 pb-16 sm:pb-6">
            <MotionDiv
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
            />
            <MotionDiv
              animate={{ y: 0, opacity: 1 }}
              className="relative w-full sm:max-w-lg rounded-t-[40px] sm:rounded-[var(--radius-card)] overflow-hidden bg-white-custom shadow-2xl max-h-[92vh] flex flex-col"
              exit={{ y: 60, opacity: 0 }}
              initial={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <div className="flex items-center justify-between px-7 pt-7 pb-4 shrink-0">
                <div>
                  <div className="sm:hidden w-10 h-1 bg-primary/15 rounded-full mb-4" />
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">
                    Nuevo <span className="text-primary/20">Insumo</span>
                  </h2>
                </div>
                <BtnIcon
                  className="hidden sm:flex border-none bg-primary/8 text-primary/40"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X size={16} />
                </BtnIcon>
              </div>

              <div className="overflow-y-auto flex-1 px-7 pb-7">
                <form className="space-y-7" onSubmit={handleSave}>
                  <section className="space-y-4">
                    <SectionTitle>Información básica</SectionTitle>
                    <FieldInput
                      required
                      label="Nombre"
                      placeholder="Tomate, Pollo, Arroz…"
                      value={formData.nombre}
                      onChange={patch("nombre")}
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
                              categoria: e.target.value,
                            }))
                          }
                        >
                          {CATEGORIAS.map((c) => (
                            <option key={c.label} value={c.label}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <FieldInput
                        label="Porción"
                        placeholder="100g"
                        value={formData.porcion_texto}
                        onChange={patch("porcion_texto")}
                      />
                    </div>
                    <FieldInput
                      label="Stock inicial"
                      min="0"
                      type="number"
                      value={formData.stock_actual}
                      onChange={patch("stock_actual")}
                    />
                  </section>

                  <section className="space-y-4">
                    <SectionTitle>Macronutrientes · por porción</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldInput
                        label="Calorías (kcal)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={formData.kcal}
                        onChange={patch("kcal")}
                      />
                      <FieldInput
                        label="Proteínas (g)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={formData.proteinas}
                        onChange={patch("proteinas")}
                      />
                      <FieldInput
                        label="Carbohidratos (g)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={formData.carbohidratos}
                        onChange={patch("carbohidratos")}
                      />
                      <FieldInput
                        label="Grasas (g)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={formData.grasas}
                        onChange={patch("grasas")}
                      />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionTitle>Micronutrientes · opcional</SectionTitle>
                    <div className="grid grid-cols-3 gap-3">
                      <FieldInput
                        label="Fibra (g)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={formData.fibra}
                        onChange={patch("fibra")}
                      />
                      <FieldInput
                        label="Sodio (mg)"
                        min="0"
                        step="1"
                        type="number"
                        value={formData.sodio}
                        onChange={patch("sodio")}
                      />
                      <FieldInput
                        label="Agua (ml)"
                        min="0"
                        step="1"
                        type="number"
                        value={formData.agua_ml}
                        onChange={patch("agua_ml")}
                      />
                    </div>
                  </section>

                  <Btn
                    fullWidth
                    disabled={!formData.nombre.trim()}
                    icon={<Save size={16} />}
                    loading={isSaving}
                    size="lg"
                    type="submit"
                  >
                    Registrar insumo
                  </Btn>
                </form>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editItem && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 pb-16 sm:pb-6">
            <MotionDiv
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setEditItem(null)}
            />
            <MotionDiv
              animate={{ y: 0, opacity: 1 }}
              className="relative w-full sm:max-w-lg rounded-t-[40px] sm:rounded-[var(--radius-card)] overflow-hidden bg-white-custom shadow-2xl max-h-[92vh] flex flex-col"
              exit={{ y: 60, opacity: 0 }}
              initial={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <div className="flex items-center justify-between px-7 pt-7 pb-4 shrink-0">
                <div>
                  <div className="sm:hidden w-10 h-1 bg-primary/15 rounded-full mb-4" />
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary">
                    Editar{" "}
                    <span className="text-primary/20">{editItem.nombre}</span>
                  </h2>
                </div>
                <BtnIcon
                  className="hidden sm:flex border-none bg-primary/8 text-primary/40"
                  variant="ghost"
                  onClick={() => setEditItem(null)}
                >
                  <X size={16} />
                </BtnIcon>
              </div>

              <div className="overflow-y-auto flex-1 px-7 pb-7">
                <form className="space-y-7" onSubmit={handleEditSave}>
                  <section className="space-y-4">
                    <SectionTitle>Información básica</SectionTitle>
                    <FieldInput
                      required
                      label="Nombre"
                      placeholder="Tomate, Pollo, Arroz…"
                      value={editForm.nombre}
                      onChange={patchEdit("nombre")}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-micro font-black uppercase tracking-widest text-primary/40 pl-1">
                          Categoría
                        </label>
                        <select
                          className="input-brand text-micro font-bold appearance-none"
                          value={editForm.categoria}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              categoria: e.target.value,
                            }))
                          }
                        >
                          {CATEGORIAS.map((c) => (
                            <option key={c.label} value={c.label}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <FieldInput
                        label="Porción"
                        placeholder="100g"
                        value={editForm.porcion_texto}
                        onChange={patchEdit("porcion_texto")}
                      />
                    </div>
                    <FieldInput
                      label="Stock actual"
                      min="0"
                      type="number"
                      value={editForm.stock_actual}
                      onChange={patchEdit("stock_actual")}
                    />
                  </section>

                  <section className="space-y-4">
                    <SectionTitle>Macronutrientes · por porción</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldInput
                        label="Calorías (kcal)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={editForm.kcal}
                        onChange={patchEdit("kcal")}
                      />
                      <FieldInput
                        label="Proteínas (g)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={editForm.proteinas}
                        onChange={patchEdit("proteinas")}
                      />
                      <FieldInput
                        label="Carbohidratos (g)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={editForm.carbohidratos}
                        onChange={patchEdit("carbohidratos")}
                      />
                      <FieldInput
                        label="Grasas (g)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={editForm.grasas}
                        onChange={patchEdit("grasas")}
                      />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionTitle>Micronutrientes · opcional</SectionTitle>
                    <div className="grid grid-cols-3 gap-3">
                      <FieldInput
                        label="Fibra (g)"
                        min="0"
                        step="0.1"
                        type="number"
                        value={editForm.fibra}
                        onChange={patchEdit("fibra")}
                      />
                      <FieldInput
                        label="Sodio (mg)"
                        min="0"
                        step="1"
                        type="number"
                        value={editForm.sodio}
                        onChange={patchEdit("sodio")}
                      />
                      <FieldInput
                        label="Agua (ml)"
                        min="0"
                        step="1"
                        type="number"
                        value={editForm.agua_ml}
                        onChange={patchEdit("agua_ml")}
                      />
                    </div>
                  </section>

                  <Btn
                    fullWidth
                    disabled={!editForm.nombre.trim()}
                    icon={<Save size={16} />}
                    loading={isEditSaving}
                    size="lg"
                    type="submit"
                  >
                    Guardar cambios
                  </Btn>
                </form>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

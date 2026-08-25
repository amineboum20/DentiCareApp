"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
// no AppContext import needed
import type { Product, ProductCategory } from "@/types/database";
import { DR } from "@/components/DetailRow";

interface Props {
  initialProducts: Product[];
  userId: string;
}

const CATEGORIES: ProductCategory[] = ["frame", "lens", "contact_lens", "accessory", "other"];

const emptyForm = {
  category: "frame" as ProductCategory,
  brand: "", model: "", sku: "", color: "", material: "",
  description: "", price: "", cost_price: "", stock_quantity: "0", notes: "",
};

const CATEGORY_ICONS: Record<ProductCategory, string> = {
  frame: "🕶️", lens: "🔬", contact_lens: "👁", accessory: "🧴", other: "📦",
};

export default function ProductsClient({ initialProducts, userId }: Props) {
  const t = useTranslations("products");
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Product | null>(null);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    const found = products.find((p) => p.id === id);
    if (found) setDetail(found);
  }, [searchParams]);

  const filtered = useMemo(() =>
    products.filter((p) => {
      const matchSearch = `${p.brand ?? ""} ${p.model ?? ""} ${p.sku ?? ""} ${p.description ?? ""}`
        .toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchCat;
    }),
    [products, search, categoryFilter]
  );

  function f(key: keyof typeof emptyForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      category: p.category,
      brand: p.brand ?? "", model: p.model ?? "", sku: p.sku ?? "",
      color: p.color ?? "", material: p.material ?? "",
      description: p.description ?? "",
      price: p.price.toString(),
      cost_price: p.cost_price?.toString() ?? "",
      stock_quantity: p.stock_quantity.toString(),
      notes: p.notes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave() {
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setError(t("form.priceError")); return; }
    setSaving(true);
    setError("");

    const payload = {
      category: form.category,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      sku: form.sku.trim() || null,
      color: form.color.trim() || null,
      material: form.material.trim() || null,
      description: form.description.trim() || null,
      price,
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      stock_quantity: parseInt(form.stock_quantity, 10) || 0,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { data, error: err } = await supabase.from("products").update(payload).eq("id", editing.id).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      setProducts((ps) => ps.map((p) => (p.id === data.id ? data as Product : p)));
    } else {
      const { data, error: err } = await supabase.from("products").insert({ ...payload, user_id: userId }).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      setProducts((ps) => [data as Product, ...ps]);
    }
    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("products").delete().eq("id", deleteTarget.id);
    setProducts((ps) => ps.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1";

  const stockColor = (qty: number) =>
    qty === 0 ? "text-red-500" : qty <= 3 ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
          + {t("newProduct")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
          <input type="text" placeholder={t("searchPlaceholder")} value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
          {(["all", ...CATEGORIES] as const).map((cat) => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}>
              {cat === "all" ? t("allCategories") : `${CATEGORY_ICONS[cat]} ${t(`categories.${cat}`)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">{search ? "🔍" : "🕶️"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search || categoryFilter !== "all" ? t("noResults") : t("noProducts")}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {search || categoryFilter !== "all" ? t("noResultsDesc", { query: search || categoryFilter }) : t("noProductsDesc")}
            </p>
            {!search && categoryFilter === "all" && (
              <button onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                + {t("newProduct")}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.product")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.category")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.sku")}</th>
                <th className="px-5 py-3 text-end font-medium text-zinc-500 dark:text-zinc-400">{t("columns.price")}</th>
                <th className="px-5 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">{t("columns.stock")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}
                  onClick={() => setDetail(p)}
                  className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{CATEGORY_ICONS[p.category]}</span>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {[p.brand, p.model].filter(Boolean).join(" ") || t("unnamedProduct")}
                        </p>
                        {p.color && <p className="text-xs text-zinc-400">{p.color}{p.material ? ` · ${p.material}` : ""}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{t(`categories.${p.category}`)}</td>
                  <td className="px-5 py-3.5 text-zinc-400 font-mono text-xs">{p.sku ?? "—"}</td>
                  <td className="px-5 py-3.5 text-end font-medium text-zinc-900 dark:text-white">{p.price.toFixed(2)} MAD</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`font-semibold ${stockColor(p.stock_quantity)}`}>{p.stock_quantity}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setDetail(null)}>
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{CATEGORY_ICONS[detail.category]}</span>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">
                    {[detail.brand, detail.model].filter(Boolean).join(" ") || t("unnamedProduct")}
                  </h2>
                  <p className="text-xs text-zinc-400">{t(`categories.${detail.category}`)}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-1">
              <DR label="SKU" value={detail.sku} />
              <DR label={t("form.color")} value={detail.color} />
              <DR label={t("form.material")} value={detail.material} />
              <DR label={t("form.description")} value={detail.description} />
              <DR label={`${t("columns.price")} (MAD)`} value={detail.price.toFixed(2)} />
              {detail.cost_price != null && <DR label={`${t("form.costPrice")} (MAD)`} value={detail.cost_price.toFixed(2)} />}
              <DR label={t("columns.stock")} value={detail.stock_quantity} />
              <DR label={t("form.notes")} value={detail.notes} />
            </div>
            <div className="flex items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => { setDeleteTarget(detail); setDetail(null); }}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Supprimer
              </button>
              <div className="ms-auto">
                <button onClick={() => { openEdit(detail); setDetail(null); }}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                  ✏️ Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editing ? t("form.editTitle") : t("form.addTitle")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={labelCls}>{t("form.category")}</label>
                <select {...f("category")} className={inputCls}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_ICONS[c]} {t(`categories.${c}`)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>{t("form.brand")}</label><input {...f("brand")} className={inputCls} /></div>
                <div><label className={labelCls}>{t("form.model")}</label><input {...f("model")} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>{t("form.color")}</label><input {...f("color")} className={inputCls} /></div>
                <div><label className={labelCls}>{t("form.material")}</label><input {...f("material")} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>{t("form.sku")}</label><input {...f("sku")} className={inputCls} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>{t("form.price")} (MAD) <span className="text-red-500">*</span></label>
                  <input type="number" step="0.01" min="0" {...f("price")} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("form.costPrice")} (MAD)</label>
                  <input type="number" step="0.01" min="0" {...f("cost_price")} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("form.stock")}</label>
                  <input type="number" min="0" {...f("stock_quantity")} className={inputCls} />
                </div>
              </div>
              <div><label className={labelCls}>{t("form.description")}</label><input {...f("description")} className={inputCls} /></div>
              <div>
                <label className={labelCls}>{t("form.notes")}</label>
                <textarea {...f("notes")} rows={2} className={`${inputCls} resize-none`} />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editing && (
                <button type="button" onClick={() => { setDeleteTarget(editing); setModalOpen(false); }}
                  className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                  Supprimer
                </button>
              )}
              <div className="ms-auto flex items-center gap-3">
                <button onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  {t("form.cancel")}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                  {saving ? t("form.saving") : t("form.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("deleteConfirm.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {t("deleteConfirm.message", {
                name: [deleteTarget.brand, deleteTarget.model].filter(Boolean).join(" ") || t("unnamedProduct"),
              })}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                {t("deleteConfirm.cancel")}
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                {t("deleteConfirm.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

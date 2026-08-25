"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { useAppContext } from "@/components/AppContext";
import { exportOrderPdf } from "@/utils/pdf-export";
import type { Order, Client, Product, OrderStatus, OrderItem } from "@/types/database";
import { DR } from "@/components/DetailRow";

type OrderWithClient = Order & { clients: { first_name: string; last_name: string; phone: string | null } };

interface Props {
  initialOrders: OrderWithClient[];
  clients: Pick<Client, "id" | "first_name" | "last_name">[];
  products: Pick<Product, "id" | "brand" | "model" | "price" | "category">[];
  userId: string;
}

const STATUSES: OrderStatus[] = ["pending", "in_progress", "ready", "delivered", "cancelled"];

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:     "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ready:       "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  delivered:   "bg-zinc-50 text-zinc-400 dark:bg-zinc-800/50 dark:text-zinc-500",
  cancelled:   "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
};

const emptyForm = {
  client_id: "", status: "pending" as OrderStatus,
  deposit_paid: "0", notes: "",
};

type FormItem = { product_id: string; description: string; quantity: string; unit_price: string };

const emptyItem = (): FormItem => ({ product_id: "", description: "", quantity: "1", unit_price: "" });

export default function OrdersClient({ initialOrders, clients, products, userId }: Props) {
  const t = useTranslations("orders");
  const supabase = createClient();
  const { shopName, shopAddress, shopPhone, logoUrl } = useAppContext();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<OrderWithClient[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderWithClient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderWithClient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<FormItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderWithClient | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!detail) { setDetailItems([]); return; }
    supabase.from("order_items").select("*").eq("order_id", detail.id)
      .then(({ data }) => setDetailItems((data ?? []) as OrderItem[]));
  }, [detail?.id]);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    const found = orders.find((o) => o.id === id);
    if (found) setDetail(found);
  }, [searchParams]);

  const filtered = useMemo(() =>
    orders.filter((o) => {
      const name = `${o.clients.first_name} ${o.clients.last_name}`.toLowerCase();
      const matchSearch = name.includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [orders, search, statusFilter]
  );

  const totalPrice = useMemo(() =>
    items.reduce((sum, it) => {
      const qty = parseInt(it.quantity, 10) || 0;
      const price = parseFloat(it.unit_price) || 0;
      return sum + qty * price;
    }, 0),
    [items]
  );

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setItem(index: number, key: keyof FormItem, value: string) {
    setItems((its) => its.map((it, i) => {
      if (i !== index) return it;
      const updated = { ...it, [key]: value };
      if (key === "product_id" && value) {
        const prod = products.find((p) => p.id === value);
        if (prod) {
          updated.description = [prod.brand, prod.model].filter(Boolean).join(" ");
          updated.unit_price = prod.price.toString();
        }
      }
      return updated;
    }));
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setItems([emptyItem()]);
    setError("");
    setModalOpen(true);
  }

  async function openEdit(o: OrderWithClient) {
    setEditing(o);
    setForm({
      client_id: o.client_id,
      status: o.status,
      deposit_paid: o.deposit_paid.toString(),
      notes: o.notes ?? "",
    });
    const { data } = await supabase.from("order_items").select("*").eq("order_id", o.id);
    setItems(
      (data ?? []).length > 0
        ? (data as OrderItem[]).map((it) => ({
            product_id: it.product_id ?? "",
            description: it.description,
            quantity: it.quantity.toString(),
            unit_price: it.unit_price.toString(),
          }))
        : [emptyItem()]
    );
    setError("");
    setModalOpen(true);
  }

  async function handleExport(o: OrderWithClient) {
    setExportingId(o.id);
    const [{ data: orderItems }, { data: clientData }] = await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", o.id),
      supabase.from("clients").select("address").eq("id", o.client_id).single(),
    ]);
    await exportOrderPdf({
      orderId: o.id,
      clientName: `${o.clients.first_name} ${o.clients.last_name}`,
      clientPhone: o.clients.phone,
      clientAddress: (clientData as { address?: string | null } | null)?.address ?? null,
      orderedAt: o.ordered_at,
      statusLabel: t(`statuses.${o.status}`),
      items: (orderItems ?? []).map((it: OrderItem) => ({
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })),
      totalPrice: o.total_price,
      depositPaid: o.deposit_paid,
      notes: o.notes,
      shopName,
      shopAddress,
      shopPhone,
      logoUrl,
      vatRate: 0,
    });
    setExportingId(null);
  }

  async function handleSave() {
    if (!form.client_id) { setError(t("form.clientRequired")); return; }
    if (items.every((it) => !it.description.trim())) { setError(t("form.itemRequired")); return; }
    setSaving(true);
    setError("");

    const validItems = items.filter((it) => it.description.trim());
    const total = validItems.reduce((s, it) => s + (parseInt(it.quantity) || 1) * (parseFloat(it.unit_price) || 0), 0);
    const client = clients.find((c) => c.id === form.client_id);
    const clientSnap = client
      ? { first_name: client.first_name, last_name: client.last_name, phone: null }
      : { first_name: "", last_name: "", phone: null };

    const orderPayload = {
      client_id: form.client_id,
      status: form.status,
      deposit_paid: parseFloat(form.deposit_paid) || 0,
      total_price: total,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { data: updatedOrder, error: err } = await supabase
        .from("orders").update(orderPayload).eq("id", editing.id).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      await supabase.from("order_items").delete().eq("order_id", editing.id);
      await supabase.from("order_items").insert(
        validItems.map((it) => ({
          order_id: editing.id,
          product_id: it.product_id || null,
          description: it.description.trim(),
          quantity: parseInt(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
        }))
      );
      setOrders((os) => os.map((o) => o.id === updatedOrder.id
        ? { ...updatedOrder, clients: clientSnap } as OrderWithClient : o));
    } else {
      const { data: newOrder, error: err } = await supabase
        .from("orders").insert({ ...orderPayload, user_id: userId }).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      await supabase.from("order_items").insert(
        validItems.map((it) => ({
          order_id: newOrder.id,
          product_id: it.product_id || null,
          description: it.description.trim(),
          quantity: parseInt(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
        }))
      );
      setOrders((os) => [{ ...newOrder, clients: clientSnap } as OrderWithClient, ...os]);
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleStatusChange(order: OrderWithClient, status: OrderStatus) {
    const { data } = await supabase.from("orders").update({ status }).eq("id", order.id).select().single();
    if (data) setOrders((os) => os.map((o) => o.id === data.id ? { ...data, clients: order.clients } as OrderWithClient : o));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("orders").delete().eq("id", deleteTarget.id);
    setOrders((os) => os.filter((o) => o.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR");
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
          + {t("newOrder")}
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
          {(["all", ...STATUSES] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}>
              {s === "all" ? t("allStatuses") : t(`statuses.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">{search ? "🔍" : "📦"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search || statusFilter !== "all" ? t("noResults") : t("noOrders")}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {search || statusFilter !== "all" ? t("noResultsDesc", { query: search }) : t("noOrdersDesc")}
            </p>
            {!search && statusFilter === "all" && (
              <button onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                + {t("newOrder")}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.client")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.date")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.status")}</th>
                <th className="px-5 py-3 text-end font-medium text-zinc-500 dark:text-zinc-400">{t("columns.total")}</th>
                <th className="px-5 py-3 text-end font-medium text-zinc-500 dark:text-zinc-400">{t("columns.deposit")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}
                  onClick={() => setDetail(o)}
                  className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-zinc-900 dark:text-white">{o.clients.first_name} {o.clients.last_name}</p>
                    {o.clients.phone && <p className="text-xs text-zinc-400">{o.clients.phone}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{formatDate(o.ordered_at)}</td>
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <select value={o.status}
                      onChange={(e) => handleStatusChange(o, e.target.value as OrderStatus)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${STATUS_STYLES[o.status]}`}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{t(`statuses.${s}`)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-end font-medium text-zinc-900 dark:text-white">{o.total_price.toFixed(2)} MAD</td>
                  <td className="px-5 py-3.5 text-end text-zinc-500 dark:text-zinc-400">{o.deposit_paid.toFixed(2)} MAD</td>
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
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-white">
                  {detail.clients.first_name} {detail.clients.last_name}
                </h2>
                <p className="text-xs text-zinc-400">{formatDate(detail.ordered_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[detail.status]}`}>
                  {t(`statuses.${detail.status}`)}
                </span>
                <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-1">
              {detail.clients.phone && <DR label="Téléphone" value={detail.clients.phone} />}
              <DR label="Total (MAD)" value={detail.total_price.toFixed(2)} />
              <DR label="Acompte (MAD)" value={detail.deposit_paid.toFixed(2)} />
              <DR label="Reste (MAD)" value={(detail.total_price - detail.deposit_paid).toFixed(2)} />
              <DR label="Notes" value={detail.notes} />
              {detailItems.length > 0 && (
                <div className="pt-2 mt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">{t("form.items")}</p>
                  <div className="space-y-1">
                    {detailItems.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-700 dark:text-zinc-300">{it.description} × {it.quantity}</span>
                        <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs">{(it.unit_price * it.quantity).toFixed(2)} MAD</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => { setDeleteTarget(detail); setDetail(null); }}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Supprimer
              </button>
              <div className="ms-auto flex flex-wrap items-center gap-2">
                {detail.clients.phone && (
                  <a href={`https://wa.me/${detail.clients.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${detail.clients.first_name}, votre commande est prête ! Vous pouvez passer la récupérer chez nous. Merci 😊`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-sm font-medium transition-colors">
                    💬 WhatsApp
                  </a>
                )}
                <button onClick={() => { handleExport(detail); setDetail(null); }} disabled={exportingId === detail.id}
                  className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 text-sm font-medium transition-colors disabled:opacity-50">
                  📄 PDF
                </button>
                <button onClick={() => { openEdit(detail); setDetail(null); }}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                  ✏️ Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editing ? t("form.editTitle") : t("form.addTitle")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.client")} <span className="text-red-500">*</span>
                  </label>
                  <select value={form.client_id} onChange={(e) => setField("client_id", e.target.value)} className={inputCls}>
                    <option value="">{t("form.selectClient")}</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.status")}</label>
                  <select value={form.status} onChange={(e) => setField("status", e.target.value)} className={inputCls}>
                    {STATUSES.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">{t("form.items")}</p>
                  <button onClick={() => setItems((its) => [...its, emptyItem()])}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ {t("form.addItem")}</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        {i === 0 && <label className="block text-xs text-zinc-400 mb-1">{t("form.product")}</label>}
                        <select value={item.product_id} onChange={(e) => setItem(i, "product_id", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">{t("form.customItem")}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{[p.brand, p.model].filter(Boolean).join(" ")}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        {i === 0 && <label className="block text-xs text-zinc-400 mb-1">{t("form.description")}</label>}
                        <input value={item.description} onChange={(e) => setItem(i, "description", e.target.value)}
                          placeholder={t("form.descriptionPlaceholder")}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="col-span-2">
                        {i === 0 && <label className="block text-xs text-zinc-400 mb-1">{t("form.qty")}</label>}
                        <input type="number" min="1" value={item.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center" />
                      </div>
                      <div className="col-span-2">
                        {i === 0 && <label className="block text-xs text-zinc-400 mb-1">{t("form.unitPrice")}</label>}
                        <input type="number" step="0.01" min="0" value={item.unit_price}
                          onChange={(e) => setItem(i, "unit_price", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {items.length > 1 && (
                          <button onClick={() => setItems((its) => its.filter((_, idx) => idx !== i))}
                            className="text-zinc-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-sm text-zinc-500 me-2">{t("form.total")}:</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">{totalPrice.toFixed(2)} MAD</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.deposit")}</label>
                  <input type="number" step="0.01" min="0" value={form.deposit_paid}
                    onChange={(e) => setField("deposit_paid", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.notes")}</label>
                  <input value={form.notes} onChange={(e) => setField("notes", e.target.value)} className={inputCls} />
                </div>
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
                name: `${deleteTarget.clients.first_name} ${deleteTarget.clients.last_name}`,
                date: formatDate(deleteTarget.ordered_at),
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

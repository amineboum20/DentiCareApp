"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
// no AppContext import needed
import type { Client } from "@/types/database";
import { DR } from "@/components/DetailRow";

interface Props {
  initialClients: Client[];
  userId: string;
}

const emptyForm = {
  first_name: "", last_name: "", email: "",
  phone: "", date_of_birth: "", address: "", notes: "",
};

type HistoryPrescription = {
  id: string;
  prescribed_date: string;
  expiry_date: string | null;
  prescribed_by: string | null;
  od_sphere: number | null; od_cylinder: number | null; od_axis: number | null;
  os_sphere: number | null; os_cylinder: number | null; os_axis: number | null;
  pd_right: number | null; pd_left: number | null;
  notes: string | null;
};

type HistoryOrder = {
  id: string;
  ordered_at: string;
  status: string;
  total_price: number;
  deposit_paid: number;
  notes: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function fmtSign(v: number | null) {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ready:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  delivered:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  cancelled:   "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export default function ClientsClient({ initialClients, userId }: Props) {
  const t = useTranslations("clients");
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<Client | null>(null);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    const found = clients.find((c) => c.id === id);
    if (found) setDetail(found);
  }, [searchParams]);

  // History panel
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPrescriptions, setHistoryPrescriptions] = useState<HistoryPrescription[]>([]);
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([]);

  const filtered = useMemo(() =>
    clients.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email ?? ""} ${c.phone ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ),
    [clients, search]
  );

  function openAdd() {
    setEditingClient(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditingClient(c);
    setForm({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      date_of_birth: c.date_of_birth ?? "",
      address: c.address ?? "",
      notes: c.notes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function openHistory(c: Client) {
    setHistoryClient(c);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryPrescriptions([]);
    setHistoryOrders([]);
    const [{ data: prescriptions }, { data: orders }] = await Promise.all([
      supabase.from("prescriptions")
        .select("id, prescribed_date, expiry_date, prescribed_by, od_sphere, od_cylinder, od_axis, os_sphere, os_cylinder, os_axis, pd_right, pd_left, notes")
        .eq("client_id", c.id)
        .order("prescribed_date", { ascending: false }),
      supabase.from("orders")
        .select("id, ordered_at, status, total_price, deposit_paid, notes")
        .eq("client_id", c.id)
        .order("ordered_at", { ascending: false }),
    ]);
    setHistoryPrescriptions((prescriptions ?? []) as HistoryPrescription[]);
    setHistoryOrders((orders ?? []) as HistoryOrder[]);
    setHistoryLoading(false);
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError(t("form.requiredError"));
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editingClient) {
      const { data, error: err } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingClient.id)
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setClients((cs) => cs.map((c) => (c.id === data.id ? (data as Client) : c)));
    } else {
      const { data, error: err } = await supabase
        .from("clients")
        .insert({ ...payload, user_id: userId })
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }
      setClients((cs) => [data as Client, ...cs]);
    }

    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from("clients").delete().eq("id", deleteTarget.id);
    setClients((cs) => cs.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
          + {t("newClient")}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">{search ? "🔍" : "👤"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search ? t("noResults") : t("noClients")}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {search ? t("noResultsDesc", { query: search }) : t("noClientsDesc")}
            </p>
            {!search && (
              <button onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                + {t("newClient")}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.name")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.phone")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.email")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.dob")}</th>
                <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.added")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}
                  onClick={() => setDetail(c)}
                  className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{c.phone ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{c.email ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{fmtDate(c.date_of_birth)}</td>
                  <td className="px-5 py-3.5 text-zinc-400">{fmtDate(c.created_at)}</td>
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
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 text-lg font-bold">
                  {detail.first_name[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{detail.first_name} {detail.last_name}</h2>
                  <p className="text-xs text-zinc-400">{t("columns.added")}: {fmtDate(detail.created_at)}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-1">
              <DR label={t("columns.phone")} value={detail.phone} />
              <DR label={t("columns.email")} value={detail.email} />
              <DR label={t("columns.dob")} value={fmtDate(detail.date_of_birth)} />
              <DR label="Adresse" value={detail.address} />
              <DR label="Notes" value={detail.notes} />
            </div>
            <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => { setDeleteTarget(detail); setDetail(null); }}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Supprimer
              </button>
              <div className="ms-auto flex flex-wrap items-center gap-2">
                {detail.phone && (
                  <a href={`https://wa.me/${detail.phone.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-sm font-medium transition-colors">
                    💬 WhatsApp
                  </a>
                )}
                <button onClick={() => { openHistory(detail); setDetail(null); }}
                  className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 text-sm font-medium transition-colors">
                  📋 Historique
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

      {/* History slide-over */}
      {historyOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          <div className="fixed inset-y-0 end-0 z-50 w-full max-w-xl bg-white dark:bg-zinc-900 shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-white">
                  {historyClient ? `${historyClient.first_name} ${historyClient.last_name}` : ""}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">{t("history.subtitle")}</p>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="3" x2="15" y2="15" /><line x1="15" y1="3" x2="3" y2="15" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
              {historyLoading ? (
                <div className="flex items-center justify-center py-20">
                  <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              ) : (
                <>
                  {/* Prescriptions */}
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                      🔬 {t("history.prescriptions")}
                      <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                        {historyPrescriptions.length}
                      </span>
                    </h3>
                    {historyPrescriptions.length === 0 ? (
                      <p className="text-sm text-zinc-400 py-4 text-center">{t("history.noPrescriptions")}</p>
                    ) : (
                      <div className="space-y-3">
                        {historyPrescriptions.map((p) => (
                          <div key={p.id}
                            className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                {fmtDate(p.prescribed_date)}
                              </span>
                              {p.expiry_date && (
                                <span className="text-xs text-zinc-400">→ {fmtDate(p.expiry_date)}</span>
                              )}
                            </div>
                            {p.prescribed_by && (
                              <p className="text-xs text-zinc-400 mb-2">Dr. {p.prescribed_by}</p>
                            )}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
                              <div className="flex justify-between">
                                <span className="text-zinc-400">OD Sph</span>
                                <span className="text-zinc-700 dark:text-zinc-300">{fmtSign(p.od_sphere)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-400">OS Sph</span>
                                <span className="text-zinc-700 dark:text-zinc-300">{fmtSign(p.os_sphere)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-400">OD Cyl</span>
                                <span className="text-zinc-700 dark:text-zinc-300">{fmtSign(p.od_cylinder)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-400">OS Cyl</span>
                                <span className="text-zinc-700 dark:text-zinc-300">{fmtSign(p.os_cylinder)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-400">OD Ax</span>
                                <span className="text-zinc-700 dark:text-zinc-300">{p.od_axis != null ? `${p.od_axis}°` : "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-400">OS Ax</span>
                                <span className="text-zinc-700 dark:text-zinc-300">{p.os_axis != null ? `${p.os_axis}°` : "—"}</span>
                              </div>
                              <div className="flex justify-between col-span-2">
                                <span className="text-zinc-400">PD</span>
                                <span className="text-zinc-700 dark:text-zinc-300">
                                  {p.pd_right && p.pd_left ? `${p.pd_right} / ${p.pd_left}` : p.pd_right ?? p.pd_left ?? "—"}
                                </span>
                              </div>
                            </div>
                            {p.notes && (
                              <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700">{p.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Orders */}
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                      📦 {t("history.orders")}
                      <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                        {historyOrders.length}
                      </span>
                    </h3>
                    {historyOrders.length === 0 ? (
                      <p className="text-sm text-zinc-400 py-4 text-center">{t("history.noOrders")}</p>
                    ) : (
                      <div className="space-y-2">
                        {historyOrders.map((o) => (
                          <div key={o.id}
                            className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-zinc-900 dark:text-white">{fmtDate(o.ordered_at)}</p>
                              {o.notes && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{o.notes}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_STYLE[o.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                                {o.status}
                              </span>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{o.total_price.toFixed(2)} MAD</p>
                                {o.deposit_paid > 0 && (
                                  <p className="text-xs text-zinc-400">Ac: {o.deposit_paid.toFixed(2)} MAD</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editingClient ? t("form.editTitle") : t("form.addTitle")}
              </h2>
              <button onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.firstName")} <span className="text-red-500">*</span>
                  </label>
                  <input {...field("first_name")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t("form.lastName")} <span className="text-red-500">*</span>
                  </label>
                  <input {...field("last_name")} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.phone")}</label>
                  <input type="tel" {...field("phone")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.email")}</label>
                  <input type="email" {...field("email")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.dob")}</label>
                <input type="date" {...field("date_of_birth")} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.address")}</label>
                <input {...field("address")} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("form.notes")}</label>
                <textarea {...field("notes")} rows={3} className={`${inputCls} resize-none`} />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              {editingClient && (
                <button type="button" onClick={() => { setDeleteTarget(editingClient); setModalOpen(false); }}
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

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("deleteConfirm.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {t("deleteConfirm.message", {
                name: `${deleteTarget.first_name} ${deleteTarget.last_name}`,
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

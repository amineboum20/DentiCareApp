"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { useAppContext } from "@/components/AppContext";
import { exportPrescriptionPdf, exportPrescriptionCard } from "@/utils/pdf-export";
import type { Prescription, Client } from "@/types/database";
import { DR } from "@/components/DetailRow";

type PrescriptionWithClient = Prescription & {
  clients: { first_name: string; last_name: string };
};

interface Props {
  initialPrescriptions: PrescriptionWithClient[];
  clients: Pick<Client, "id" | "first_name" | "last_name">[];
  userId: string;
}

const emptyForm = {
  client_id: "",
  prescribed_by: "",
  prescribed_date: "",
  expiry_date: "",
  od_sphere: "", od_cylinder: "", od_axis: "", od_addition: "",
  os_sphere: "", os_cylinder: "", os_axis: "", os_addition: "",
  pd_right: "", pd_left: "",
  notes: "",
};

const ACCEPTED = "application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

async function imageToPdf(file: File): Promise<File> {
  const { jsPDF } = await import("jspdf");
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = rej;
    el.src = url;
  });
  URL.revokeObjectURL(url);
  const { naturalWidth: w, naturalHeight: h } = img;
  const pdf = new jsPDF({
    orientation: w > h ? "landscape" : "portrait",
    unit: "px",
    format: [w, h],
  });
  pdf.addImage(img, file.type === "image/png" ? "PNG" : "JPEG", 0, 0, w, h);
  const blob = new Blob([pdf.output("arraybuffer")], { type: "application/pdf" });
  const name = file.name.replace(/\.[^.]+$/, "") + ".pdf";
  return new File([blob], name, { type: "application/pdf" });
}

function numOrNull(v: string) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function intOrNull(v: string) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function formatSign(v: number | null) {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

export default function PrescriptionsClient({ initialPrescriptions, clients, userId }: Props) {
  const t = useTranslations("prescriptions");
  const supabase = createClient();
  const { shopName, shopAddress, shopPhone, logoUrl } = useAppContext();
  const searchParams = useSearchParams();

  const [prescriptions, setPrescriptions] = useState(initialPrescriptions);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PrescriptionWithClient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrescriptionWithClient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportingCardId, setExportingCardId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<PrescriptionWithClient | null>(null);

  useEffect(() => {
    const id = searchParams.get("detail");
    if (!id) return;
    const found = prescriptions.find((p) => p.id === id);
    if (found) setDetail(found);
  }, [searchParams]);

  // Document upload state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingRemoveDoc, setPendingRemoveDoc] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() =>
    prescriptions.filter((p) => {
      const name = `${p.clients.first_name} ${p.clients.last_name}`.toLowerCase();
      const by = (p.prescribed_by ?? "").toLowerCase();
      return name.includes(search.toLowerCase()) || by.includes(search.toLowerCase());
    }),
    [prescriptions, search]
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
    setPendingFile(null);
    setPendingRemoveDoc(false);
    setError("");
    setModalOpen(true);
  }

  function openEdit(p: PrescriptionWithClient) {
    setEditing(p);
    setForm({
      client_id: p.client_id,
      prescribed_by: p.prescribed_by ?? "",
      prescribed_date: p.prescribed_date,
      expiry_date: p.expiry_date ?? "",
      od_sphere: p.od_sphere?.toString() ?? "",
      od_cylinder: p.od_cylinder?.toString() ?? "",
      od_axis: p.od_axis?.toString() ?? "",
      od_addition: p.od_addition?.toString() ?? "",
      os_sphere: p.os_sphere?.toString() ?? "",
      os_cylinder: p.os_cylinder?.toString() ?? "",
      os_axis: p.os_axis?.toString() ?? "",
      os_addition: p.os_addition?.toString() ?? "",
      pd_right: p.pd_right?.toString() ?? "",
      pd_left: p.pd_left?.toString() ?? "",
      notes: p.notes ?? "",
    });
    setPendingFile(null);
    setPendingRemoveDoc(false);
    setError("");
    setModalOpen(true);
  }

  async function handleFileSelected(file: File | null | undefined) {
    if (!file) return;
    if (file.size > MAX_SIZE) { setError(t("form.fileTooLarge")); return; }
    setError("");
    // Convert any image to PDF so camera photos are always stored as PDF
    let finalFile = file;
    if (file.type.startsWith("image/")) {
      try {
        finalFile = await imageToPdf(file);
      } catch {
        // Conversion failed — store as-is
      }
    }
    setPendingFile(finalFile);
    setPendingRemoveDoc(false);
  }

  async function handleExport(p: PrescriptionWithClient) {
    setExportingId(p.id);
    await exportPrescriptionPdf({
      clientName: `${p.clients.first_name} ${p.clients.last_name}`,
      prescribedBy: p.prescribed_by,
      prescribedDate: p.prescribed_date,
      expiryDate: p.expiry_date,
      odSphere: p.od_sphere, odCylinder: p.od_cylinder, odAxis: p.od_axis, odAddition: p.od_addition,
      osSphere: p.os_sphere, osCylinder: p.os_cylinder, osAxis: p.os_axis, osAddition: p.os_addition,
      pdRight: p.pd_right, pdLeft: p.pd_left,
      notes: p.notes,
      shopName,
      shopAddress,
      shopPhone,
      logoUrl,
    });
    setExportingId(null);
  }

  async function handleExportCard(p: PrescriptionWithClient) {
    setExportingCardId(p.id);
    await exportPrescriptionCard({
      clientName: `${p.clients.first_name} ${p.clients.last_name}`,
      prescribedDate: p.prescribed_date,
      expiryDate: p.expiry_date,
      odSphere: p.od_sphere, odCylinder: p.od_cylinder, odAxis: p.od_axis, odAddition: p.od_addition,
      osSphere: p.os_sphere, osCylinder: p.os_cylinder, osAxis: p.os_axis, osAddition: p.os_addition,
      pdRight: p.pd_right, pdLeft: p.pd_left,
      shopName,
      shopPhone: shopPhone || undefined,
    });
    setExportingCardId(null);
  }

  async function handleViewDocument(p: PrescriptionWithClient) {
    if (!p.document_path) return;
    setViewingDocId(p.id);
    const { data } = await supabase.storage.from("prescription-docs").createSignedUrl(p.document_path, 3600);
    setViewingDocId(null);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function uploadDocument(prescriptionId: string, file: File): Promise<string | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${userId}/${prescriptionId}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("prescription-docs")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (uploadErr) { setError(uploadErr.message); return null; }
    return path;
  }

  async function handleSave() {
    if (!form.client_id || !form.prescribed_date) {
      setError(t("form.requiredError"));
      return;
    }
    setSaving(true);
    setError("");

    const client = clients.find((c) => c.id === form.client_id);
    const clientSnap = client
      ? { first_name: client.first_name, last_name: client.last_name }
      : { first_name: "", last_name: "" };

    const basePayload = {
      client_id: form.client_id,
      prescribed_by: form.prescribed_by.trim() || null,
      prescribed_date: form.prescribed_date,
      expiry_date: form.expiry_date || null,
      od_sphere: numOrNull(form.od_sphere),
      od_cylinder: numOrNull(form.od_cylinder),
      od_axis: intOrNull(form.od_axis),
      od_addition: numOrNull(form.od_addition),
      os_sphere: numOrNull(form.os_sphere),
      os_cylinder: numOrNull(form.os_cylinder),
      os_axis: intOrNull(form.os_axis),
      os_addition: numOrNull(form.os_addition),
      pd_right: numOrNull(form.pd_right),
      pd_left: numOrNull(form.pd_left),
      notes: form.notes.trim() || null,
    };

    if (editing) {
      // Handle document removal
      let document_path = editing.document_path;
      if (pendingRemoveDoc && editing.document_path) {
        await supabase.storage.from("prescription-docs").remove([editing.document_path]);
        document_path = null;
      }

      const { data, error: err } = await supabase
        .from("prescriptions")
        .update({ ...basePayload, document_path })
        .eq("id", editing.id)
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }

      // Upload new file after update
      if (pendingFile) {
        const path = await uploadDocument(data.id, pendingFile);
        if (path) {
          await supabase.from("prescriptions").update({ document_path: path }).eq("id", data.id);
          data.document_path = path;
        } else {
          setSaving(false);
          return;
        }
      }

      setPrescriptions((ps) =>
        ps.map((p) => (p.id === data.id ? { ...data, clients: clientSnap } as PrescriptionWithClient : p))
      );
    } else {
      const { data, error: err } = await supabase
        .from("prescriptions")
        .insert({ ...basePayload, user_id: userId, document_path: null })
        .select()
        .single();
      if (err) { setError(err.message); setSaving(false); return; }

      if (pendingFile) {
        const path = await uploadDocument(data.id, pendingFile);
        if (path) {
          await supabase.from("prescriptions").update({ document_path: path }).eq("id", data.id);
          data.document_path = path;
        } else {
          // Prescription saved without doc — still close modal
        }
      }

      setPrescriptions((ps) => [{ ...data, clients: clientSnap } as PrescriptionWithClient, ...ps]);
    }

    setSaving(false);
    setModalOpen(false);
    setPendingFile(null);
    setPendingRemoveDoc(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.document_path) {
      await supabase.storage.from("prescription-docs").remove([deleteTarget.document_path]);
    }
    await supabase.from("prescriptions").delete().eq("id", deleteTarget.id);
    setPrescriptions((ps) => ps.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR");
  }

  const inputCls = "w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center";
  const labelCls = "block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1";

  const showExistingDoc = !pendingRemoveDoc && !pendingFile && editing?.document_path;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
          + {t("newPrescription")}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute inset-y-0 start-3 flex items-center text-zinc-400 text-sm">🔍</span>
        <input type="text" placeholder={t("searchPlaceholder")} value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 pe-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">{search ? "🔍" : "🔬"}</span>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {search ? t("noResults") : t("noPrescriptions")}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {search ? t("noResultsDesc", { query: search }) : t("noPrescriptionsDesc")}
            </p>
            {!search && (
              <button onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                + {t("newPrescription")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.client")}</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.date")}</th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400 text-xs">OD Sph</th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400 text-xs">OD Cyl</th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400 text-xs">OD Ax</th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400 text-xs">OS Sph</th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400 text-xs">OS Cyl</th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400 text-xs">OS Ax</th>
                  <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400 text-xs">PD</th>
                  <th className="px-5 py-3 text-start font-medium text-zinc-500 dark:text-zinc-400">{t("columns.doctor")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}
                    onClick={() => setDetail(p)}
                    className="border-b border-zinc-50 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                      {p.clients.first_name} {p.clients.last_name}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(p.prescribed_date)}
                      {p.expiry_date && (
                        <span className="text-xs text-zinc-400 ms-1">→ {formatDate(p.expiry_date)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center text-zinc-600 dark:text-zinc-300 font-mono text-xs">{formatSign(p.od_sphere)}</td>
                    <td className="px-4 py-3.5 text-center text-zinc-600 dark:text-zinc-300 font-mono text-xs">{formatSign(p.od_cylinder)}</td>
                    <td className="px-4 py-3.5 text-center text-zinc-500 dark:text-zinc-400 text-xs">{p.od_axis ?? "—"}°</td>
                    <td className="px-4 py-3.5 text-center text-zinc-600 dark:text-zinc-300 font-mono text-xs">{formatSign(p.os_sphere)}</td>
                    <td className="px-4 py-3.5 text-center text-zinc-600 dark:text-zinc-300 font-mono text-xs">{formatSign(p.os_cylinder)}</td>
                    <td className="px-4 py-3.5 text-center text-zinc-500 dark:text-zinc-400 text-xs">{p.os_axis ?? "—"}°</td>
                    <td className="px-4 py-3.5 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                      {p.pd_right && p.pd_left ? `${p.pd_right}/${p.pd_left}` : p.pd_right ?? p.pd_left ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{p.prescribed_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  🔬 {detail.clients.first_name} {detail.clients.last_name}
                </h2>
                <p className="text-xs text-zinc-400">{formatDate(detail.prescribed_date)}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-2">
              {detail.prescribed_by && <DR label="Médecin" value={`Dr. ${detail.prescribed_by}`} />}
              {detail.expiry_date && <DR label="Expiration" value={formatDate(detail.expiry_date)} />}
              <div className="pt-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Œil droit (OD)</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {([["Sph", formatSign(detail.od_sphere)], ["Cyl", formatSign(detail.od_cylinder)], ["Ax", detail.od_axis != null ? `${detail.od_axis}°` : "—"], ["Add", formatSign(detail.od_addition)]] as [string, string][]).map(([l, v]) => (
                    <div key={l} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg py-1.5">
                      <p className="text-[9px] text-zinc-400 uppercase">{l}</p>
                      <p className="text-sm font-mono font-medium text-zinc-800 dark:text-zinc-200">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Œil gauche (OS)</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {([["Sph", formatSign(detail.os_sphere)], ["Cyl", formatSign(detail.os_cylinder)], ["Ax", detail.os_axis != null ? `${detail.os_axis}°` : "—"], ["Add", formatSign(detail.os_addition)]] as [string, string][]).map(([l, v]) => (
                    <div key={l} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg py-1.5">
                      <p className="text-[9px] text-zinc-400 uppercase">{l}</p>
                      <p className="text-sm font-mono font-medium text-zinc-800 dark:text-zinc-200">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <DR label="PD (OD / OS)" value={detail.pd_right != null && detail.pd_left != null ? `${detail.pd_right} / ${detail.pd_left}` : (detail.pd_right ?? detail.pd_left)} />
              <DR label="Notes" value={detail.notes} />
            </div>
            <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => { setDeleteTarget(detail); setDetail(null); }}
                className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Supprimer
              </button>
              <div className="ms-auto flex flex-wrap items-center gap-2">
                {detail.document_path && (
                  <button onClick={() => { handleViewDocument(detail); setDetail(null); }} disabled={viewingDocId === detail.id}
                    className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 text-sm font-medium transition-colors disabled:opacity-50">
                    📎 Document
                  </button>
                )}
                <button onClick={() => { handleExportCard(detail); setDetail(null); }} disabled={exportingCardId === detail.id}
                  className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 text-sm font-medium transition-colors disabled:opacity-50">
                  🪪 Carte
                </button>
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

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {editing ? t("form.editTitle") : t("form.addTitle")}
              </h2>
              <button onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Client + dates */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 sm:col-span-1">
                  <label className={labelCls}>{t("form.client")} <span className="text-red-500">*</span></label>
                  <select {...f("client_id")}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{t("form.selectClient")}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t("form.prescribedDate")} <span className="text-red-500">*</span></label>
                  <input type="date" {...f("prescribed_date")}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className={labelCls}>{t("form.expiryDate")}</label>
                  <input type="date" {...f("expiry_date")}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Right eye */}
              <div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                  👁 {t("form.rightEye")} (OD)
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <div><label className={labelCls}>{t("form.sphere")}</label><input type="number" step="0.25" placeholder="+0.00" {...f("od_sphere")} className={inputCls} /></div>
                  <div><label className={labelCls}>{t("form.cylinder")}</label><input type="number" step="0.25" placeholder="0.00" {...f("od_cylinder")} className={inputCls} /></div>
                  <div><label className={labelCls}>{t("form.axis")}</label><input type="number" min="0" max="180" placeholder="0" {...f("od_axis")} className={inputCls} /></div>
                  <div><label className={labelCls}>{t("form.addition")}</label><input type="number" step="0.25" placeholder="+0.00" {...f("od_addition")} className={inputCls} /></div>
                </div>
              </div>

              {/* Left eye */}
              <div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                  👁 {t("form.leftEye")} (OS)
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <div><label className={labelCls}>{t("form.sphere")}</label><input type="number" step="0.25" placeholder="+0.00" {...f("os_sphere")} className={inputCls} /></div>
                  <div><label className={labelCls}>{t("form.cylinder")}</label><input type="number" step="0.25" placeholder="0.00" {...f("os_cylinder")} className={inputCls} /></div>
                  <div><label className={labelCls}>{t("form.axis")}</label><input type="number" min="0" max="180" placeholder="0" {...f("os_axis")} className={inputCls} /></div>
                  <div><label className={labelCls}>{t("form.addition")}</label><input type="number" step="0.25" placeholder="+0.00" {...f("os_addition")} className={inputCls} /></div>
                </div>
              </div>

              {/* PD + doctor */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>{t("form.pdRight")}</label>
                  <input type="number" step="0.5" placeholder="32.0" {...f("pd_right")} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("form.pdLeft")}</label>
                  <input type="number" step="0.5" placeholder="32.0" {...f("pd_left")} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("form.doctor")}</label>
                  <input type="text" placeholder={t("form.doctorPlaceholder")} {...f("prescribed_by")}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>{t("form.notes")}</label>
                <textarea {...f("notes")} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* Document upload */}
              <div>
                <label className={labelCls}>{t("form.document")}</label>

                {/* Existing document banner */}
                {showExistingDoc && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <span className="text-blue-500">📎</span>
                    <span className="text-xs text-blue-700 dark:text-blue-300 flex-1 truncate">
                      {editing!.document_path!.split("/").pop()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingRemoveDoc(true)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">
                      {t("form.removeDocument")}
                    </button>
                  </div>
                )}

                {/* Selected file preview */}
                {(pendingFile || pendingRemoveDoc) && (
                  <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border ${
                    pendingRemoveDoc
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  }`}>
                    <span>{pendingRemoveDoc ? "🗑️" : "📄"}</span>
                    <span className={`text-xs flex-1 truncate ${pendingRemoveDoc ? "text-red-600 dark:text-red-400 line-through" : "text-green-700 dark:text-green-300"}`}>
                      {pendingRemoveDoc
                        ? (editing?.document_path?.split("/").pop() ?? "")
                        : pendingFile?.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setPendingFile(null); setPendingRemoveDoc(false); }}
                      className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium shrink-0">
                      ✕
                    </button>
                  </div>
                )}

                {/* Drop zone — visible when no pending file/removal */}
                {!pendingFile && !pendingRemoveDoc && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFileSelected(e.dataTransfer.files[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors select-none ${
                      dragOver
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}>
                    <div className="text-2xl mb-1">📂</div>
                    <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400">
                      {t("form.dropOrClick")}
                    </p>
                    <p className="block sm:hidden text-xs text-zinc-500 dark:text-zinc-400">
                      {t("form.tapToChoose")}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">{t("form.fileHint")}</p>

                    <div
                      className="flex justify-center mt-3"
                      onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                        📁 {t("form.browseFile")}
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED}
                      className="hidden"
                      onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = ""; }}
                    />
                  </div>
                )}
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

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">{t("deleteConfirm.title")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {t("deleteConfirm.message", {
                name: `${deleteTarget.clients.first_name} ${deleteTarget.clients.last_name}`,
                date: formatDate(deleteTarget.prescribed_date),
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

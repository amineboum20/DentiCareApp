"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { buildOdontogramSvg, isChildAge } from "@/components/odontogram-data";
import { exportFacturePdf, exportOrdonnancePdf } from "@/utils/pdf-export";
import { exportPatientInfoPdf } from "@/utils/patient-print";

interface Portal {
  patient: {
    firstName: string; lastName: string; dob: string | null; phone: string | null; email: string | null;
    address: string | null; cin: string | null; sexe: string | null;
    mutuelleOrganisme: string | null; mutuelleNumero: string | null; mutuelleLien: string | null;
  };
  practice: { name: string | null; address: string | null; phone: string | null; logo_url: string | null } | null;
  teeth: { tooth: string; status: string; note: string | null }[];
  plannedTeeth?: string[];
  dossiers: { id: string; title: string; statut: string; created_at: string }[];
  visites: { id: string; title: string | null; motif: string; exam_date: string; teeth: string | null; treated_by: string | null; clinical_notes: string | null }[];
  factures: { id: string; status: string; total_price: number; deposit_paid: number; created_at: string; notes: string | null; facture_items: { description: string; quantity: number; unit_price: number }[] }[];
  ordonnances: { id: string; created_at: string; status: string; notes: string | null; praticiens: { name: string } | { name: string }[] | null; ordonnance_lignes: { name: string; posologie: string | null; duree: string | null; quantite: string | null; instructions: string | null }[] }[];
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}
function prescriberName(p: Portal["ordonnances"][number]["praticiens"]): string | null {
  if (!p) return null;
  return Array.isArray(p) ? p[0]?.name ?? null : p.name;
}

export default function PortalClient({ token }: { token: string }) {
  const t = useTranslations("portal");
  const tfac = useTranslations("factureStatus");
  const [dob, setDob] = useState("");
  const [data, setData] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, dob }),
      });
      if (!res.ok) {
        setError(t("wrongDob"));
        return;
      }
      setData((await res.json()) as Portal);
    } catch {
      setError(t("wrongDob"));
    } finally {
      setLoading(false);
    }
  }

  const cabinet = {
    shopName: data?.practice?.name ?? "DentiCare",
    shopAddress: data?.practice?.address ?? "",
    shopPhone: data?.practice?.phone ?? "",
    logoUrl: data?.practice?.logo_url ?? null,
  };
  const patientName = data ? `${data.patient.firstName} ${data.patient.lastName}`.trim() : "";

  async function downloadFacture(f: Portal["factures"][number]) {
    await exportFacturePdf({
      factureId: f.id, docType: "facture", patientName,
      patientPhone: data!.patient.phone, patientAddress: data!.patient.address,
      createdAt: f.created_at, statusLabel: tfac(f.status),
      items: f.facture_items ?? [], totalPrice: f.total_price, depositPaid: f.deposit_paid, notes: f.notes,
      shopName: cabinet.shopName, shopAddress: cabinet.shopAddress, shopPhone: cabinet.shopPhone, logoUrl: cabinet.logoUrl,
      patientToken: token,
    });
  }
  async function downloadOrdonnance(o: Portal["ordonnances"][number]) {
    await exportOrdonnancePdf({
      ordonnanceId: o.id, patientName, patientPhone: data!.patient.phone,
      date: o.created_at, prescriber: prescriberName(o.praticiens),
      lines: o.ordonnance_lignes ?? [], notes: o.notes,
      shopName: cabinet.shopName, shopAddress: cabinet.shopAddress, shopPhone: cabinet.shopPhone, logoUrl: cabinet.logoUrl,
      patientToken: token,
    });
  }
  async function downloadSheet() {
    const chart = Object.fromEntries(data!.teeth.map((r) => [r.tooth, { status: r.status }]));
    await exportPatientInfoPdf({
      patientName, dob: data!.patient.dob, sexe: data!.patient.sexe, cin: data!.patient.cin,
      phone: data!.patient.phone, address: data!.patient.address,
      mutuelleOrganisme: data!.patient.mutuelleOrganisme, mutuelleNumero: data!.patient.mutuelleNumero, mutuelleLien: data!.patient.mutuelleLien,
      chart, isChild: isChildAge(data!.patient.dob), plannedTeeth: data!.plannedTeeth ?? [],
      shopName: cabinet.shopName, shopAddress: cabinet.shopAddress, shopPhone: cabinet.shopPhone, logoUrl: cabinet.logoUrl,
      patientToken: token,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-xl">🦷</span>
          <span>{data?.practice?.name ?? "DentiCare"}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {!data ? (
          <div className="max-w-sm mx-auto mt-10 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h1 className="text-lg font-bold mb-1">{t("title")}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">{t("dobPrompt")}</p>
            <form onSubmit={unlock} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("dobLabel")}</label>
                <input
                  type="date" required value={dob} onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors disabled:opacity-60">
                {loading ? "…" : t("unlock")}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-2xl font-bold">{patientName}</h1>
              <button onClick={downloadSheet}
                className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
                🖨️ {t("downloadSheet")}
              </button>
            </div>

            {/* Info */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">{t("info")}</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Row label={t("dobLabel")} value={fmt(data.patient.dob)} />
                <Row label={t("phone")} value={data.patient.phone} />
                <Row label={t("email")} value={data.patient.email} />
                <Row label={t("cin")} value={data.patient.cin} />
                <Row label={t("address")} value={data.patient.address} />
                <Row label={t("mutuelle")} value={data.patient.mutuelleOrganisme} />
              </dl>
            </section>

            {/* Odontogram */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-4">🦷 {t("schema")}</h2>
              <div
                className="mx-auto max-w-[280px] [&_svg]:w-full [&_svg]:h-auto"
                dangerouslySetInnerHTML={{
                  __html: buildOdontogramSvg(
                    Object.fromEntries(data.teeth.map((r) => [r.tooth, { status: r.status }])),
                    isChildAge(data.patient.dob),
                    new Set(data.plannedTeeth ?? [])
                  ),
                }}
              />
            </section>

            {/* Factures */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">🧾 {t("factures")}</h2>
              {data.factures.length === 0 ? <p className="text-sm text-zinc-400">{t("none")}</p> : (
                <ul className="space-y-2">
                  {data.factures.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{fmt(f.created_at)}</p>
                        <p className="text-xs text-zinc-400">{tfac(f.status)} · {f.total_price.toFixed(2)} MAD</p>
                      </div>
                      <button onClick={() => downloadFacture(f)} className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline">⬇ {t("download")}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Ordonnances */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">💊 {t("ordonnances")}</h2>
              {data.ordonnances.length === 0 ? <p className="text-sm text-zinc-400">{t("none")}</p> : (
                <ul className="space-y-2">
                  {data.ordonnances.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{fmt(o.created_at)}</p>
                        {prescriberName(o.praticiens) && <p className="text-xs text-zinc-400">Dr. {prescriberName(o.praticiens)}</p>}
                      </div>
                      <button onClick={() => downloadOrdonnance(o)} className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline">⬇ {t("download")}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* History (visites) */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">🏥 {t("visites")}</h2>
              {data.visites.length === 0 ? <p className="text-sm text-zinc-400">{t("none")}</p> : (
                <ul className="space-y-2">
                  {data.visites.map((v) => (
                    <li key={v.id} className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{v.title || v.motif}</span>
                        <span className="text-xs text-zinc-400">{fmt(v.exam_date)}</span>
                      </div>
                      {v.teeth && <p className="text-xs text-zinc-400 mt-1">{t("teeth")}: {v.teeth}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-center text-xs text-zinc-400 pt-2">{t("footer")}</p>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

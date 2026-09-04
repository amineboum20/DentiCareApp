import { createClient } from "@/utils/supabase/server";

export default async function ReportsPage() {
  const supabase = await createClient();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    { count: totalPatients },
    { data: facturesMois },
    { data: facturesAnnee },
    { data: recentFactures },
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }),
    supabase.from("factures").select("total_price, status").neq("type", "devis").gte("created_at", firstOfMonth),
    supabase.from("factures").select("total_price, status").neq("type", "devis").gte("created_at", firstOfYear),
    supabase
      .from("factures")
      .select("id, status, total_price, created_at, patients(first_name, last_name)")
      .neq("type", "devis")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const revenueMois = (facturesMois ?? [])
    .filter((f) => f.status === "payee")
    .reduce((s, f) => s + (f.total_price ?? 0), 0);
  const revenueAnnee = (facturesAnnee ?? [])
    .filter((f) => f.status === "payee")
    .reduce((s, f) => s + (f.total_price ?? 0), 0);
  const facturesByStatus = {
    en_attente: (facturesMois ?? []).filter((f) => f.status === "en_attente").length,
    en_cours:   (facturesMois ?? []).filter((f) => f.status === "en_cours").length,
    payee:      (facturesMois ?? []).filter((f) => f.status === "payee").length,
    annulee:    (facturesMois ?? []).filter((f) => f.status === "annulee").length,
  };

  const STATUS_LABEL: Record<string, string> = {
    en_attente: "En attente",
    en_cours:   "En cours",
    payee:      "Payée",
    annulee:    "Annulée",
  };
  const STATUS_COLOR: Record<string, string> = {
    en_attente: "bg-amber-100 text-amber-700",
    en_cours:   "bg-teal-100 text-teal-700",
    payee:      "bg-emerald-100 text-emerald-700",
    annulee:    "bg-red-100 text-red-600",
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
        Rapports &amp; Statistiques
      </h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Patients total", value: totalPatients ?? 0, icon: "🦷" },
          { label: "CA ce mois (MAD)", value: revenueMois.toFixed(2), icon: "💰" },
          { label: "CA cette année (MAD)", value: revenueAnnee.toFixed(2), icon: "📈" },
          { label: "Factures ce mois", value: (facturesMois ?? []).length, icon: "🧾" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4"
          >
            <span className="text-2xl">{s.icon}</span>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{s.value}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Facture status breakdown */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
        <h2 className="font-semibold text-zinc-900 dark:text-white mb-4">
          Factures ce mois — par statut
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(facturesByStatus).map(([status, count]) => (
            <div key={status} className="text-center">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? ""}`}
              >
                {STATUS_LABEL[status] ?? status}
              </span>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-2">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent factures */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="font-semibold text-zinc-900 dark:text-white mb-4">Dernières factures</h2>
        {(recentFactures ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-6">Aucune facture</p>
        ) : (
          <div className="space-y-2">
            {((recentFactures ?? []) as unknown as { id: string; created_at: string; status: string; total_price: number | null; patients: { first_name: string; last_name: string } | null }[]).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {f.patients
                      ? `${f.patients.first_name} ${f.patients.last_name}`
                      : "—"}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {new Date(f.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[f.status] ?? ""}`}
                  >
                    {STATUS_LABEL[f.status] ?? f.status}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {f.total_price?.toFixed(2)} MAD
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

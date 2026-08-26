import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { Link } from "@/i18n/navigation";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations("dashboard");
  const firstName = user?.user_metadata?.first_name ?? "";
  const shopName  = user?.user_metadata?.shop_name  ?? "votre cabinet";
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const [
    { count: totalPatients },
    { count: facturesThisMonth },
    { count: appointmentsToday },
    { count: pendingPayments },
    { data: recentFactures },
    { data: upcomingAppointments },
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }),
    supabase.from("factures").select("*", { count: "exact", head: true }).gte("created_at", firstOfMonth).neq("status", "annulee"),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "planifie").gte("scheduled_at", todayStart).lt("scheduled_at", todayEnd),
    supabase.from("factures").select("*", { count: "exact", head: true }).eq("status", "en_attente"),
    supabase.from("factures").select("id, created_at, status, total_price, patients(first_name, last_name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("appointments").select("id, title, scheduled_at, type, patients(first_name, last_name)").eq("status", "planifie").gte("scheduled_at", now.toISOString()).order("scheduled_at").limit(5),
  ]);

  const stats = [
    { label: t("stats.totalPatients"),    value: totalPatients ?? 0,      icon: "👤",
      trend: totalPatients ? `${totalPatients} patient${(totalPatients ?? 0) > 1 ? "s" : ""}` : t("stats.addFirstPatient") },
    { label: t("stats.facturesMonth"),    value: facturesThisMonth ?? 0,   icon: "🧾",
      trend: (facturesThisMonth ?? 0) > 0 ? `${facturesThisMonth} ce mois` : t("stats.noFactures") },
    { label: t("stats.appointmentsToday"), value: appointmentsToday ?? 0, icon: "📅",
      trend: (appointmentsToday ?? 0) > 0 ? `${appointmentsToday} aujourd'hui` : t("stats.noAppointments") },
    { label: t("stats.pendingPayments"),  value: pendingPayments ?? 0,     icon: "⏳",
      trend: (pendingPayments ?? 0) > 0 ? `${pendingPayments} en attente` : t("stats.allPaid") },
  ];

  const statusColors: Record<string, string> = {
    en_attente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    en_cours:   "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    payee:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    annulee:    "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };

  const statusLabel: Record<string, string> = {
    en_attente: "En attente", en_cours: "En cours", payee: "Payée", annulee: "Annulée",
  };

  const typeIcon: Record<string, string> = {
    consultation: "🔍", nettoyage: "🪥", soin: "🦷", chirurgie: "⚕️", controle: "✅", orthodontie: "😁", autre: "📅",
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t("greeting", { name: firstName ? `, ${firstName}` : "" })}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">{t("subtitle", { shop: shopName })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5">
            <span className="text-xl">{s.icon}</span>
            <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{s.value}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
            <div className="mt-1.5 text-xs text-zinc-400">{s.trend}</div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{t("quickActions")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: "👤", label: t("newPatient"),      href: "patients" },
            { icon: "🧾", label: t("newFacture"),      href: "factures" },
            { icon: "📅", label: t("bookAppointment"), href: "appointments" },
            { icon: "🗂️", label: t("newDossier"),     href: "dossiers" },
          ].map((a) => (
            <Link key={a.label} href={`/dashboard/${a.href}`}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:border-teal-300 dark:hover:border-teal-700 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
              <span>{a.icon}</span> {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t("recentActivity")}</h2>
            <Link href="/dashboard/factures" className="text-xs text-teal-600 hover:underline">Tout voir →</Link>
          </div>
          {(recentFactures ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="text-3xl mb-2">🌱</span>
              <p className="text-sm text-zinc-400">{t("shopReadyDesc")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(recentFactures ?? []).map((f: any) => {
                const patient = f.patients as { first_name: string; last_name: string } | null;
                return (
                  <div key={f.id} className="flex items-center justify-between py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {patient ? `${patient.first_name} ${patient.last_name}` : "—"}
                      </p>
                      <p className="text-xs text-zinc-400">{new Date(f.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[f.status]}`}>
                        {statusLabel[f.status] ?? f.status}
                      </span>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{(f.total_price ?? 0).toFixed(0)} MAD</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Prochains rendez-vous</h2>
            <Link href="/dashboard/appointments" className="text-xs text-teal-600 hover:underline">Tout voir →</Link>
          </div>
          {(upcomingAppointments ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="text-3xl mb-2">📅</span>
              <p className="text-sm text-zinc-400">Aucun rendez-vous à venir</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(upcomingAppointments ?? []).map((a: any) => {
                const patient = a.patients as { first_name: string; last_name: string } | null;
                const d = new Date(a.scheduled_at);
                return (
                  <div key={a.id} className="flex items-center gap-3 py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                    <span className="text-lg">{typeIcon[a.type] ?? "📅"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{a.title}</p>
                      <p className="text-xs text-zinc-400">
                        {patient ? `${patient.first_name} ${patient.last_name} · ` : ""}
                        {d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

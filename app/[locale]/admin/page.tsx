import { redirect } from "next/navigation";
import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { approvePractice, revokePractice } from "./actions";
import RejectButton from "./RejectButton";

export const dynamic = "force-dynamic";

type PracticeRow = {
  id: string;
  name: string | null;
  is_approved: boolean;
  created_at: string;
};
type MemberRow = {
  practice_id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
};

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/signin");

  const supabase = createAdminClient();

  const [{ data: practices }, { data: members }, usersRes] = await Promise.all([
    supabase.from("practices").select("id, name, is_approved, created_at").order("created_at", { ascending: false }),
    supabase.from("practice_members").select("practice_id, user_id, first_name, last_name, role"),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailByUser = new Map<string, string>();
  for (const u of usersRes.data?.users ?? []) emailByUser.set(u.id, u.email ?? "");

  const ownerByPractice = new Map<string, MemberRow>();
  for (const m of (members ?? []) as MemberRow[]) {
    if (m.role === "owner" && !ownerByPractice.has(m.practice_id)) ownerByPractice.set(m.practice_id, m);
  }

  const rows = ((practices ?? []) as PracticeRow[]).map((p) => {
    const owner = ownerByPractice.get(p.id);
    return {
      ...p,
      ownerName: owner ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() : "—",
      ownerEmail: owner ? emailByUser.get(owner.user_id) ?? "—" : "—",
    };
  });

  const pending = rows.filter((r) => !r.is_approved);
  const approved = rows.filter((r) => r.is_approved);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🦷</span>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Admin — DentiCare</h1>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Connecté en tant que {admin.email}</p>
          </div>
          <span className="rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 text-xs font-semibold px-3 py-1">
            {pending.length} en attente
          </span>
        </div>

        {/* Pending */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">En attente d&apos;approbation</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
              Aucune inscription en attente 🎉
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((r) => (
                <div key={r.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-white truncate">{r.name || "(sans nom)"}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{r.ownerName} · {r.ownerEmail}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Inscrit le {fmtDate(r.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={approvePractice}>
                      <input type="hidden" name="practice_id" value={r.id} />
                      <button className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 whitespace-nowrap transition">
                        ✅ Approuver
                      </button>
                    </form>
                    <RejectButton practiceId={r.id} shopName={r.name || ""} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Approved */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">Cabinets approuvés ({approved.length})</h2>
          <div className="flex flex-col gap-2">
            {approved.map((r) => (
              <div key={r.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{r.name || "(sans nom)"}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{r.ownerEmail}</p>
                </div>
                <form action={revokePractice}>
                  <input type="hidden" name="practice_id" value={r.id} />
                  <button className="text-xs text-zinc-400 hover:text-red-600 font-medium whitespace-nowrap transition">
                    Révoquer
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

import { createAdminClient } from "@/utils/supabase/admin";
import { Link } from "@/i18n/navigation";
import { approvePractice, revokePractice, approveMember } from "./actions";
import RejectButton from "./RejectButton";
import MemberRejectButton from "./MemberRejectButton";
import LocalInstant from "@/components/LocalInstant";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire",
  dentist: "Dentiste",
  assistant: "Assistant(e)",
};

type PracticeRow = { id: string; name: string | null; is_approved: boolean; created_at: string };
type MemberRow = {
  id: string; practice_id: string; user_id: string;
  first_name: string | null; last_name: string | null; role: string;
  is_approved: boolean; created_at: string;
};

export default async function AdminPage() {
  const supabase = createAdminClient();

  const [{ data: practices }, { data: members }, usersRes] = await Promise.all([
    supabase.from("practices").select("id, name, is_approved, created_at").order("created_at", { ascending: false }),
    supabase.from("practice_members").select("id, practice_id, user_id, first_name, last_name, role, is_approved, created_at"),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailByUser = new Map<string, string>();
  const emailConfirmedByUser = new Map<string, boolean>();
  for (const u of usersRes.data?.users ?? []) {
    emailByUser.set(u.id, u.email ?? "");
    emailConfirmedByUser.set(u.id, Boolean(u.email_confirmed_at));
  }

  const allMembers = (members ?? []) as MemberRow[];

  const ownerByPractice = new Map<string, MemberRow>();
  for (const m of allMembers) {
    if (m.role === "owner" && !ownerByPractice.has(m.practice_id)) ownerByPractice.set(m.practice_id, m);
  }

  const practiceNameById = new Map<string, string>();
  const practiceApprovedById = new Map<string, boolean>();
  for (const p of (practices ?? []) as PracticeRow[]) {
    practiceNameById.set(p.id, p.name || "(sans nom)");
    practiceApprovedById.set(p.id, p.is_approved);
  }

  const rows = ((practices ?? []) as PracticeRow[]).map((p) => {
    const owner = ownerByPractice.get(p.id);
    return {
      ...p,
      ownerName: owner ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() : "—",
      ownerEmail: owner ? emailByUser.get(owner.user_id) ?? "—" : "—",
      ownerConfirmed: owner ? emailConfirmedByUser.get(owner.user_id) ?? false : false,
    };
  });

  // Only accounts whose email is CONFIRMED are shown at all — the same moment the
  // "Nouvelle inscription" email reaches the admins. Unconfirmed signups and
  // not-yet-activated invited members are invisible here.
  const pending = rows.filter((r) => !r.is_approved && r.ownerConfirmed);
  const approved = rows.filter((r) => r.is_approved);

  // Owner-invited members awaiting individual approval (owners are gated at the
  // practice level, so they never appear here).
  const unapprovedMembers = allMembers
    .filter((m) => m.role !== "owner" && m.is_approved === false)
    .map((m) => ({
      ...m,
      practiceName: practiceNameById.get(m.practice_id) ?? "(cabinet inconnu)",
      practiceApproved: practiceApprovedById.get(m.practice_id) ?? false,
      email: emailByUser.get(m.user_id) ?? "—",
      emailConfirmed: emailConfirmedByUser.get(m.user_id) ?? false,
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const pendingMembers = unapprovedMembers.filter((m) => m.emailConfirmed);

  const stats = [
    { label: "En attente", value: pending.length + pendingMembers.length, accent: "text-amber-600 dark:text-amber-400" },
    { label: "Cabinets actifs", value: approved.length, accent: "text-teal-600 dark:text-teal-400" },
    { label: "Membres", value: allMembers.length, accent: "text-zinc-900 dark:text-white" },
  ];

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Approbations</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Validez les nouveaux cabinets et les membres invités.</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className={`text-2xl font-bold ${s.accent}`}>{s.value}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pending practices */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">Cabinets en attente ({pending.length})</h2>
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
                    <p className="text-xs text-zinc-400 mt-0.5">Inscrit le <LocalInstant iso={r.created_at} /></p>
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

        {/* Pending members */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">Membres en attente ({pendingMembers.length})</h2>
          {pendingMembers.length === 0 ? (
            <p className="text-sm text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
              Aucun membre en attente
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingMembers.map((m) => (
                <div key={m.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-white truncate">
                      {`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "(sans nom)"}
                      <span className="ml-2 text-xs font-medium text-zinc-400">{ROLE_LABEL[m.role] ?? m.role}</span>
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{m.email}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Cabinet : {m.practiceName}
                      {!m.practiceApproved && <span className="text-amber-600 dark:text-amber-400"> · cabinet non approuvé</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={approveMember}>
                      <input type="hidden" name="member_id" value={m.id} />
                      <button className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 whitespace-nowrap transition">
                        ✅ Approuver
                      </button>
                    </form>
                    <MemberRejectButton memberId={m.id} memberName={`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim()} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Approved */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">Cabinets approuvés ({approved.length})</h2>
          {approved.length === 0 ? (
            <p className="text-sm text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
              Aucun cabinet approuvé pour l&apos;instant
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {approved.map((r) => (
                <div key={r.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">{r.name || "(sans nom)"}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{r.ownerEmail}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                  <Link href={`/admin/subscriptions/${r.id}#danger`} className="text-xs text-zinc-400 hover:text-red-600 font-medium whitespace-nowrap transition">
                    Supprimer…
                  </Link>
                  <form action={revokePractice}>
                    <input type="hidden" name="practice_id" value={r.id} />
                    <button className="text-xs text-zinc-400 hover:text-red-600 font-medium whitespace-nowrap transition">
                      Révoquer
                    </button>
                  </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

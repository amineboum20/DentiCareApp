import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { open: "Ouvert", answered: "Répondu", closed: "Fermé" };
const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  answered: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};
const FILTERS = [
  { key: "", label: "Tous" },
  { key: "open", label: "Ouverts" },
  { key: "answered", label: "Répondus" },
  { key: "closed", label: "Fermés" },
];

interface Row {
  id: string; subject: string; status: string; last_message_at: string;
  practices: { name: string } | null;
}

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from("support_tickets")
    .select("id, subject, status, last_message_at, practices(name)")
    .order("last_message_at", { ascending: false });
  if (status === "open" || status === "answered" || status === "closed") query = query.eq("status", status);

  const { data } = await query;
  const tickets = (data ?? []) as unknown as Row[];

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Support</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Demandes de support des cabinets.</p>

        <div className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map((f) => {
            const active = (status ?? "") === f.key;
            return (
              <Link key={f.key || "all"} href={f.key ? `/admin/support?status=${f.key}` : "/admin/support"}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}>
                {f.label}
              </Link>
            );
          })}
        </div>

        {tickets.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-10">Aucun ticket.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tickets.map((tk) => (
              <Link key={tk.id} href={`/admin/support/${tk.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-teal-300 dark:hover:border-teal-800 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{tk.subject || "(sans sujet)"}</p>
                  <p className="text-xs text-zinc-400 truncate">{tk.practices?.name ?? "—"} · {new Date(tk.last_message_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[tk.status] ?? ""}`}>{STATUS_LABEL[tk.status] ?? tk.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

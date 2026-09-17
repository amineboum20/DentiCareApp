import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { SUPPORT_BUCKET } from "@/utils/support-attachments";
import AdminReplyBox from "./AdminReplyBox";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { open: "Ouvert", answered: "Répondu", closed: "Fermé" };
const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  answered: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

interface Attachment { id: string; path: string; filename: string; size: number; }
interface Message { id: string; author_role: string; body: string; created_at: string; support_attachments: Attachment[]; }

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: ticket } = await db
    .from("support_tickets")
    .select("id, subject, status, created_at, practice_id, created_by, practices(name)")
    .eq("id", id)
    .single();
  if (!ticket) notFound();

  const practice = (ticket as unknown as { practices: { name: string } | null }).practices;
  let requesterEmail = "—";
  if (ticket.created_by) {
    const { data: u } = await db.auth.admin.getUserById(ticket.created_by);
    requesterEmail = u.user?.email ?? "—";
  }

  const { data: messagesData } = await db
    .from("support_messages")
    .select("id, author_role, body, created_at, support_attachments(id, path, filename, size)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as unknown as Message[];

  const urls = new Map<string, string>();
  for (const m of messages) {
    for (const a of m.support_attachments ?? []) {
      const { data } = await db.storage.from(SUPPORT_BUCKET).createSignedUrl(a.path, 3600);
      if (data?.signedUrl) urls.set(a.id, data.signedUrl);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Link href="/admin/support" className="text-sm text-teal-600 hover:underline">← Tous les tickets</Link>

      <div className="mt-3 mb-1 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{ticket.subject || "(sans sujet)"}</h1>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[ticket.status] ?? ""}`}>{STATUS_LABEL[ticket.status] ?? ticket.status}</span>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{practice?.name ?? "—"} · {requesterEmail}</p>

      <div className="flex flex-col gap-4">
        {messages.map((m) => {
          const isAdmin = m.author_role === "admin";
          return (
            <div key={m.id} className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
              <span className="text-xs text-zinc-400 mb-1 px-1">
                {isAdmin ? "Vous (support)" : (practice?.name ?? "Cabinet")} · {new Date(m.created_at).toLocaleString("fr-FR")}
              </span>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                isAdmin
                  ? "bg-teal-600 text-white rounded-tr-sm"
                  : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-tl-sm"
              }`}>
                {m.body}
                {(m.support_attachments ?? []).length > 0 && (
                  <div className={`mt-2 flex flex-col gap-1 ${isAdmin ? "border-teal-500/40" : "border-zinc-200 dark:border-zinc-700"} border-t pt-2`}>
                    {(m.support_attachments ?? []).map((a) => (
                      <a key={a.id} href={urls.get(a.id) ?? "#"} target="_blank" rel="noopener noreferrer"
                        className={`text-xs underline underline-offset-2 ${isAdmin ? "text-teal-50" : "text-teal-600 dark:text-teal-400"}`}>
                        📎 {a.filename}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AdminReplyBox ticketId={ticket.id} status={ticket.status} />
    </div>
  );
}

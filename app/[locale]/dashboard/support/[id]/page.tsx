import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/server";
import { SUPPORT_BUCKET } from "@/utils/support-attachments";
import { StatusBadge } from "../SupportClient";
import SupportThreadActions from "./SupportThreadActions";

export const dynamic = "force-dynamic";

interface Attachment { id: string; path: string; filename: string; size: number; }
interface Message {
  id: string; author_role: string; body: string; created_at: string;
  support_attachments: Attachment[];
}

export default async function TicketThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("support");
  const db = await createClient();

  const { data: ticket } = await db
    .from("support_tickets")
    .select("id, subject, status, created_at, closed_at")
    .eq("id", id)
    .single();
  if (!ticket) notFound();

  const { data: messagesData } = await db
    .from("support_messages")
    .select("id, author_role, body, created_at, support_attachments(id, path, filename, size)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as unknown as Message[];

  // Signed URLs for every attachment (private bucket).
  const urls = new Map<string, string>();
  for (const m of messages) {
    for (const a of m.support_attachments ?? []) {
      const { data } = await db.storage.from(SUPPORT_BUCKET).createSignedUrl(a.path, 3600);
      if (data?.signedUrl) urls.set(a.id, data.signedUrl);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Link href="/dashboard/support" className="text-sm text-teal-600 hover:underline">{t("backToList")}</Link>

      <div className="mt-3 mb-6 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{ticket.subject || t("noSubject")}</h1>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="flex flex-col gap-4">
        {messages.map((m) => {
          const isUser = m.author_role === "user";
          return (
            <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              <span className="text-xs text-zinc-400 mb-1 px-1">
                {isUser ? t("you") : t("supportTeam")} · {new Date(m.created_at).toLocaleString("fr-FR")}
              </span>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                isUser
                  ? "bg-teal-600 text-white rounded-tr-sm"
                  : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-tl-sm"
              }`}>
                {m.body}
                {(m.support_attachments ?? []).length > 0 && (
                  <div className={`mt-2 flex flex-col gap-1 ${isUser ? "border-teal-500/40" : "border-zinc-200 dark:border-zinc-700"} border-t pt-2`}>
                    {(m.support_attachments ?? []).map((a) => (
                      <a key={a.id} href={urls.get(a.id) ?? "#"} target="_blank" rel="noopener noreferrer"
                        className={`text-xs underline underline-offset-2 ${isUser ? "text-teal-50" : "text-teal-600 dark:text-teal-400"}`}>
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

      <SupportThreadActions ticketId={ticket.id} status={ticket.status} />
    </div>
  );
}

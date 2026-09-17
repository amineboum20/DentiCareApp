import { createClient } from "@/utils/supabase/server";
import SupportClient, { type TicketRow } from "./SupportClient";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const db = await createClient();
  const { data } = await db
    .from("support_tickets")
    .select("id, subject, status, created_at, last_message_at")
    .order("last_message_at", { ascending: false });

  return <SupportClient tickets={(data ?? []) as TicketRow[]} />;
}

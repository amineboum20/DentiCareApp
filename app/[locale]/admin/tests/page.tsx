import { createAdminClient } from "@/utils/supabase/admin";
import { MODULES } from "./data";
import TestsClient, { type ResultRow } from "./TestsClient";

export const dynamic = "force-dynamic";

export default async function AdminTestsPage() {
  const db = createAdminClient();
  const { data } = await db.from("qa_test_results").select("test_id, result, updated_by, note, updated_at");

  const results: Record<string, ResultRow> = {};
  for (const r of (data ?? []) as ResultRow[]) results[r.test_id] = r;

  return <TestsClient modules={MODULES} initialResults={results} />;
}

import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPPORT_BUCKET = "support-attachments";
export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

export function extractFiles(form: FormData): File[] {
  return form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
}

/** Returns an error code string, or null when the files are acceptable. */
export function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return "too_many_files";
  if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) return "too_large";
  return null;
}

/**
 * Uploads each file to the private support bucket under
 * <practiceId>/<ticketId>/… and records a support_attachments row per file.
 * Returns the files as base64 so the caller can also attach them to the email.
 */
export async function storeAttachments(
  db: SupabaseClient,
  files: File[],
  practiceId: string,
  ticketId: string,
  messageId: string
): Promise<{ filename: string; content: string }[]> {
  const mailAttachments: { filename: string; content: string }[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const safe = (file.name || "piece-jointe").replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const path = `${practiceId}/${ticketId}/${crypto.randomUUID()}-${safe}`;
    const up = await db.storage.from(SUPPORT_BUCKET).upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (up.error) { console.error("support attachment upload error:", up.error.message); continue; }
    await db.from("support_attachments").insert({
      message_id: messageId,
      path,
      filename: file.name || safe,
      size: file.size,
    });
    mailAttachments.push({ filename: file.name || safe, content: buf.toString("base64") });
  }
  return mailAttachments;
}

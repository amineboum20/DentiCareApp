"use server";

import { getAdminUser } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { ARCHIVE_BUCKET, type ArchiveIndex } from "@/utils/practice-archive";

// Short-lived signed URLs for every file of one archive (the browser zips them).
export async function getArchiveDownloadUrls(folder: string): Promise<{ path: string; url: string }[]> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Non autorisé");
  if (!/^[\w.-]+$/.test(folder)) throw new Error("Archive invalide");
  const db = createAdminClient();
  const { data: idx } = await db.storage.from(ARCHIVE_BUCKET).download(`${folder}/index.json`);
  if (!idx) throw new Error("Archive introuvable");
  const index = JSON.parse(await idx.text()) as ArchiveIndex;
  const { data, error } = await db.storage.from(ARCHIVE_BUCKET).createSignedUrls(index.files.map((p) => `${folder}/${p}`), 600);
  if (error || !data) throw new Error(error?.message ?? "URLs indisponibles");
  return data
    .filter((d) => d.signedUrl)
    .map((d) => ({ path: (d.path ?? "").slice(folder.length + 1), url: d.signedUrl as string }));
}

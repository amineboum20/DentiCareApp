// Archive a practice before it is permanently deleted (server only, service role).
// Written to the private "archives" bucket:
//   <folder>/index.json          — who / when / counts / file list
//   <folder>/data.json           — every row (admin_practice_snapshot) + auth accounts
//   <folder>/files/<bucket>/...  — a copy of every stored file
// Any failure throws, so the caller never deletes a practice it could not archive.
// Keep this file identical in both apps.

import type { SupabaseClient } from "@supabase/supabase-js";

export const ARCHIVE_BUCKET = "archives";

export interface ArchiveIndex {
  format: "practice-archive/1";
  folder: string;
  practiceId: string;
  practiceName: string;
  deletedAt: string;
  deletedBy: string;
  counts: Record<string, number>;
  files: string[]; // paths inside the archive folder
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sans-nom";

export async function archivePractice(db: SupabaseClient, practiceId: string, practiceName: string, deletedBy: string): Promise<ArchiveIndex> {
  const [{ data: snapshot, error: e1 }, { data: dry, error: e2 }] = await Promise.all([
    db.rpc("admin_practice_snapshot", { p_practice_id: practiceId }),
    db.rpc("admin_delete_practice", { p_practice_id: practiceId, p_execute: false }),
  ]);
  if (e1 || !snapshot) throw new Error(`Archive impossible (données) : ${e1?.message ?? "vide"}`);
  if (e2 || !dry) throw new Error(`Archive impossible (fichiers) : ${e2?.message ?? "vide"}`);
  const { counts, objects } = dry as { counts: Record<string, number>; objects: { bucket: string; name: string }[] };

  const now = new Date().toISOString();
  const folder = `${now.slice(0, 10)}_${slug(practiceName)}_${practiceId.slice(0, 8)}`;
  const store = db.storage.from(ARCHIVE_BUCKET);
  const put = async (path: string, body: Blob | string, contentType: string) => {
    const { error } = await store.upload(`${folder}/${path}`, body, { contentType, upsert: true });
    if (error) throw new Error(`Archive impossible (${path}) : ${error.message}`);
  };

  await put("data.json", JSON.stringify(snapshot, null, 2), "application/json");

  const files: string[] = ["data.json"];
  for (const o of objects ?? []) {
    const { data: blob, error } = await db.storage.from(o.bucket).download(o.name);
    if (error || !blob) throw new Error(`Archive impossible (fichier ${o.bucket}/${o.name}) : ${error?.message ?? "introuvable"}`);
    const path = `files/${o.bucket}/${o.name}`;
    await put(path, blob, blob.type || "application/octet-stream");
    files.push(path);
  }

  const index: ArchiveIndex = { format: "practice-archive/1", folder, practiceId, practiceName, deletedAt: now, deletedBy, counts, files: [...files, "index.json"] };
  await put("index.json", JSON.stringify(index, null, 2), "application/json");
  return index;
}

/** All archives, newest first (reads each folder's index.json). */
export async function listArchives(db: SupabaseClient): Promise<ArchiveIndex[]> {
  const { data: folders } = await db.storage.from(ARCHIVE_BUCKET).list("", { limit: 1000, sortBy: { column: "name", order: "desc" } });
  const out: ArchiveIndex[] = [];
  for (const f of folders ?? []) {
    if (f.id) continue; // a file at the root, not a folder
    const { data } = await db.storage.from(ARCHIVE_BUCKET).download(`${f.name}/index.json`);
    if (!data) continue;
    try { out.push(JSON.parse(await data.text()) as ArchiveIndex); } catch { /* skip unreadable */ }
  }
  return out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

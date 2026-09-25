"use client";

// Download one archive as a ZIP (data.json + index.json + every archived file).

import { useState } from "react";
import { getArchiveDownloadUrls } from "./actions";

export default function ArchiveDownloadButton({ folder }: { folder: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  async function download() {
    setState("busy");
    try {
      const urls = await getArchiveDownloadUrls(folder);
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const { path, url } of urls) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(path);
        zip.file(path, await res.blob());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `archive-${folder}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setState("idle");
    } catch {
      setState("error");
    }
  }
  return (
    <button type="button" onClick={download} disabled={state === "busy"}
      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50 whitespace-nowrap">
      {state === "busy" ? "Préparation…" : state === "error" ? "⚠️ Réessayer" : "🗜️ Télécharger (ZIP)"}
    </button>
  );
}

import { createAdminClient } from "@/utils/supabase/admin";
import { listArchives } from "@/utils/practice-archive";
import ArchiveDownloadButton from "./ArchiveDownloadButton";
import LocalInstant from "@/components/LocalInstant";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  members: "membres", clients: "clients", patients: "patients", prescriptions: "ordonnances", ordonnances: "ordonnances",
  orders: "commandes", factures: "factures", consultations: "visites", dossiers: "dossiers", appointments: "RDV",
  products: "produits", actes: "actes", supplier_orders: "commandes fournisseur", support_tickets: "tickets support",
  invoices: "factures d'abonnement", files: "fichiers",
};
const UNIT = "cabinet";

export default async function AdminArchivesPage() {
  const archives = await listArchives(createAdminClient());
  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Archives</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Copie complète de chaque {UNIT} supprimé(e) définitivement : toutes les données (JSON), les comptes des membres et les fichiers.
          Conservée dans un espace privé, pour pouvoir récupérer quelque chose un jour.
        </p>
        {archives.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-10">Aucune archive pour l&apos;instant.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {archives.map((a) => {
              const summary = Object.entries(a.counts).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${n} ${LABEL[k] ?? k}`).join(" · ");
              return (
                <div key={a.folder} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">🗄️ {a.practiceName || "(sans nom)"}</p>
                    <p className="text-xs text-zinc-400">
                      Supprimé le <LocalInstant iso={a.deletedAt} /> par {a.deletedBy} · {a.files.length} fichiers dans l&apos;archive
                    </p>
                    {summary && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{summary}</p>}
                  </div>
                  <ArchiveDownloadButton folder={a.folder} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

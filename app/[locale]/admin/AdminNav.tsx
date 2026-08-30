import { Link } from "@/i18n/navigation";

export default function AdminNav({ active }: { active: "approvals" | "workspace" }) {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition";
  const on = "bg-teal-600 text-white";
  const off = "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800";
  return (
    <nav className="flex items-center gap-2 mb-6">
      <Link href="/admin" className={`${base} ${active === "approvals" ? on : off}`}>Approbations</Link>
      <Link href="/admin/workspace" className={`${base} ${active === "workspace" ? on : off}`}>Espace technique</Link>
    </nav>
  );
}

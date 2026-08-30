// Full-height embed of the gated technical workspace, deep-linked to one tab.
// The workspace HTML reads the URL hash (#tests | #docs | #infra) to open the
// matching panel on load.
export default function WorkspaceFrame({ locale, tab, title }: { locale: string; tab: "tests" | "docs" | "infra"; title: string }) {
  return (
    <div className="h-[calc(100vh-3.5rem)] sm:h-screen bg-zinc-50 dark:bg-zinc-950">
      <iframe
        src={`/${locale}/admin/workspace/raw#${tab}`}
        title={title}
        className="w-full h-full border-0"
      />
    </div>
  );
}

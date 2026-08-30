import { redirect } from "next/navigation";
import { getAdminUser } from "@/utils/admin-auth";
import WorkspaceFrame from "../WorkspaceFrame";

export const dynamic = "force-dynamic";

export default async function AdminDocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await getAdminUser())) redirect("/signin");
  return <WorkspaceFrame locale={locale} tab="docs" title="Documentation" />;
}

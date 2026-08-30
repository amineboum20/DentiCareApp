import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

// The technical workspace is now split into first-class sidebar sections
// (/admin/tests, /admin/docs, /admin/infra). Keep this path working for old
// bookmarks by sending it to the Tests tab.
export default async function WorkspaceRedirect() {
  const locale = await getLocale();
  redirect({ href: "/admin/tests", locale });
}

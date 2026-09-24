"use client";

import { usePathname } from "@/i18n/navigation";
import { useAppContext } from "@/components/AppContext";
import { canAccessPath } from "@/utils/permissions";
import AccessError from "@/components/AccessError";

/**
 * Blocks dashboard routes the current member's role may not access.
 * A disallowed route shows a 403 page (with a way back home) instead of its
 * content, so restricted content never renders for an assistant who typed the URL.
 */
export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { memberRole } = useAppContext();
  const pathname = usePathname();
  if (!canAccessPath(memberRole, pathname)) return <AccessError code={403} />;
  return <>{children}</>;
}

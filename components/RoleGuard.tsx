"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useAppContext } from "@/components/AppContext";
import { canAccessPath, ASSISTANT_HOME } from "@/utils/permissions";

/**
 * Blocks dashboard routes the current member's role may not access.
 * Renders nothing (and redirects) while the route is disallowed, so restricted
 * content never flashes for an assistant who reached the URL directly.
 */
export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { memberRole } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessPath(memberRole, pathname);

  useEffect(() => {
    if (!allowed) router.replace(ASSISTANT_HOME);
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}

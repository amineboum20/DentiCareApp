import type { MemberRole } from "@/types/database";

/**
 * Role-based access control — UI layer.
 *
 * - owner / dentist → full access to every dashboard section.
 * - assistant       → front-desk only: patients, dossiers (cases) and
 *                     rendez-vous. No billing, clinical visites, prescriptions,
 *                     catalog, reports, suppliers or settings.
 *
 * This gates the UI (sidebar, routes, in-page buttons). Database-level RLS
 * enforcement by role is a planned follow-up — until then this is presentation
 * only, not a security boundary.
 */

/** Dashboard sections an assistant may open (locale-stripped route prefixes). */
export const ASSISTANT_SECTIONS = [
  "/dashboard/patients",
  "/dashboard/dossiers",
  "/dashboard/appointments",
] as const;

/** Where a blocked assistant is sent when they hit a restricted route. */
export const ASSISTANT_HOME = "/dashboard/patients";

/**
 * Whether `role` may open the dashboard route `path`.
 * `path` is locale-stripped (as returned by `@/i18n/navigation` usePathname),
 * e.g. "/dashboard/factures".
 */
export function canAccessPath(role: MemberRole, path: string): boolean {
  if (role !== "assistant") return true;
  if (path === "/dashboard") return true; // shared home — its content is role-aware
  return ASSISTANT_SECTIONS.some((s) => path === s || path.startsWith(`${s}/`));
}

/**
 * Capability flags for in-page buttons/links that lead into restricted areas.
 * Owners and dentists get everything; assistants are front-desk only.
 */
export function can(role: MemberRole) {
  const assistant = role === "assistant";
  return {
    billing: !assistant,       // factures, acomptes, bill a visite
    clinical: !assistant,      // visites/consultations, actes, odontogram edits
    prescriptions: !assistant, // ordonnances
    reports: !assistant,
    suppliers: !assistant,
    settings: role === "owner", // member management stays owner-only (unchanged)
  };
}

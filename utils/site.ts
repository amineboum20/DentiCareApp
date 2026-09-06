// Public base URL used for patient-facing links (QR codes). Override with
// NEXT_PUBLIC_SITE_URL; defaults to the production domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://denticareapp.com").replace(/\/+$/, "");

export function patientPortalUrl(token: string): string {
  return `${SITE_URL}/p/${token}`;
}

import { notFound } from "next/navigation";

// Any unknown /dashboard/* URL → the dashboard's own 404 (with sidebar),
// instead of Next's bare default page.
export default function UnknownDashboardRoute() {
  notFound();
}

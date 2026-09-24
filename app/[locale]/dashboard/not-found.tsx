import AccessError from "@/components/AccessError";

// 404 inside the dashboard (unknown route, or a detail page calling notFound()):
// keeps the sidebar and offers a way back home.
export default function DashboardNotFound() {
  return <AccessError code={404} />;
}

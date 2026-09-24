import { INFRA_HTML } from "./content";

export const dynamic = "force-dynamic";

export default function AdminInfraPage() {
  return (
    <div className="p-4 sm:p-8">
      <div className="admin-prose max-w-4xl mx-auto" dangerouslySetInnerHTML={{ __html: INFRA_HTML }} />
    </div>
  );
}

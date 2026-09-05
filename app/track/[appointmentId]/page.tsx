import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import LocalInstant from "@/components/LocalInstant";

const STATUS_LABELS: Record<string, string> = {
  planifie: "Planifié",
  termine:  "Terminé",
  annule:   "Annulé",
  absent:   "Patient absent",
};

const TYPE_LABELS: Record<string, string> = {
  consultation: "Consultation",
  nettoyage:    "Détartrage / Nettoyage",
  soin:         "Soin dentaire",
  chirurgie:    "Chirurgie",
  controle:     "Contrôle",
  orthodontie:  "Orthodontie",
  autre:        "Autre",
};

const TYPE_EMOJI: Record<string, string> = {
  consultation: "🩺",
  nettoyage:    "🪥",
  soin:         "🦷",
  chirurgie:    "⚕️",
  controle:     "✅",
  orthodontie:  "😁",
  autre:        "📅",
};

export default async function TrackAppointmentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: appt } = await supabase
    .from("appointments")
    .select("title, type, status, scheduled_at, duration_minutes, notes, user_id, patients(first_name, last_name)")
    .eq("id", appointmentId)
    .single();

  if (!appt) notFound();

  // Fetch practice info from user metadata
  const { data: userdata } = await supabase.auth.admin.getUserById(appt.user_id);
  const shopName: string = userdata?.user?.user_metadata?.shop_name ?? "DentiCare";
  const shopPhone: string = userdata?.user?.user_metadata?.shop_phone ?? "";
  const shopAddress: string = userdata?.user?.user_metadata?.shop_address ?? "";

  // supabase-js types a to-one embed as an array, though at runtime it's a single object.
  const patient = appt.patients as unknown as { first_name: string; last_name: string } | null;
  const patientName = patient
    ? `${patient.first_name} ${patient.last_name}`
    : "Patient";
  const statusColor =
    appt.status === "planifie"
      ? "bg-teal-50 text-teal-700 border-teal-200"
      : appt.status === "termine"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="bg-teal-600 px-6 py-5 text-white">
          <p className="text-teal-100 text-sm mb-1">🦷 {shopName}</p>
          <h1 className="text-xl font-bold">Confirmation de rendez-vous</h1>
        </div>
        {/* Content */}
        <div className="px-6 py-6 space-y-5">
          {/* Status */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${statusColor}`}
          >
            {STATUS_LABELS[appt.status] ?? appt.status}
          </div>
          {/* Appointment info */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{TYPE_EMOJI[appt.type] ?? "📅"}</span>
              <div>
                <p className="font-semibold text-zinc-900">{appt.title}</p>
                <p className="text-sm text-zinc-500">{TYPE_LABELS[appt.type] ?? appt.type}</p>
              </div>
            </div>
            <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-400">📅</span>
                <span className="font-medium text-zinc-900 capitalize"><LocalInstant iso={appt.scheduled_at} options={{ weekday: "long", year: "numeric", month: "long", day: "numeric" }} /></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-400">🕐</span>
                <span className="text-zinc-700">
                  <LocalInstant iso={appt.scheduled_at} options={{ hour: "2-digit", minute: "2-digit" }} />
                  {appt.duration_minutes ? ` · ${appt.duration_minutes} min` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-400">👤</span>
                <span className="text-zinc-700">{patientName}</span>
              </div>
            </div>
            {appt.notes && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
                {appt.notes}
              </div>
            )}
          </div>
          {/* Practice contact */}
          {(shopPhone || shopAddress) && (
            <div className="border-t border-zinc-100 pt-4 space-y-1">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Cabinet dentaire
              </p>
              <p className="font-medium text-zinc-900">{shopName}</p>
              {shopAddress && <p className="text-sm text-zinc-500">{shopAddress}</p>}
              {shopPhone && (
                <a
                  href={`tel:${shopPhone.replace(/\s/g, "")}`}
                  className="text-sm text-teal-600 hover:underline"
                >
                  {shopPhone}
                </a>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 text-center">
          <p className="text-xs text-zinc-400">Généré par DentiCare</p>
        </div>
      </div>
    </div>
  );
}

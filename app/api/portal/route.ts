import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Patient portal data endpoint. Public, but gated by the patient's date of birth:
// the caller must present the (unguessable) public_token AND the matching DOB.
export async function POST(req: Request) {
  let body: { token?: string; dob?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const token = String(body.token ?? "").trim();
  const dob = String(body.dob ?? "").trim();
  if (!token || !dob) return NextResponse.json({ error: "missing" }, { status: 400 });

  const db = createAdminClient();
  const { data: patient } = await db
    .from("patients")
    .select("id, practice_id, first_name, last_name, date_of_birth, phone, email, address, cin, sexe, mutuelle_organisme, mutuelle_numero, mutuelle_lien")
    .eq("public_token", token)
    .maybeSingle();

  // Constant-ish response for any failure — don't reveal whether the token exists.
  if (!patient || !patient.date_of_birth || patient.date_of_birth !== dob) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pid = patient.id;
  const [practiceRes, teethRes, dossiersRes, visitesRes, facturesRes, ordonnancesRes] = await Promise.all([
    db.from("practices").select("name, address, phone, logo_url").eq("id", patient.practice_id).maybeSingle(),
    db.from("tooth_chart").select("tooth, status, note").eq("patient_id", pid),
    db.from("dossiers").select("id, title, statut, created_at").eq("patient_id", pid).is("archived_at", null).order("created_at", { ascending: false }),
    db.from("consultations").select("id, title, motif, exam_date, teeth, treated_by, clinical_notes").eq("patient_id", pid).order("exam_date", { ascending: false }),
    db.from("factures").select("id, status, type, total_price, deposit_paid, created_at, notes, facture_items(description, quantity, unit_price)").eq("patient_id", pid).order("created_at", { ascending: false }),
    db.from("ordonnances").select("id, created_at, status, notes, praticiens(name), ordonnance_lignes(name, posologie, duree, quantite, instructions)").eq("patient_id", pid).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    patient: {
      firstName: patient.first_name,
      lastName: patient.last_name,
      dob: patient.date_of_birth,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      cin: patient.cin,
      sexe: patient.sexe,
      mutuelleOrganisme: patient.mutuelle_organisme,
      mutuelleNumero: patient.mutuelle_numero,
      mutuelleLien: patient.mutuelle_lien,
    },
    practice: practiceRes.data ?? null,
    teeth: teethRes.data ?? [],
    dossiers: dossiersRes.data ?? [],
    visites: visitesRes.data ?? [],
    factures: (facturesRes.data ?? []).filter((f: { type: string; status: string }) => f.type === "facture" && f.status !== "annulee"),
    ordonnances: (ordonnancesRes.data ?? []).filter((o: { status: string }) => o.status !== "annulee"),
  });
}

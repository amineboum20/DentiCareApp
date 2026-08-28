import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import PatientsClient from "./PatientsClient";
import type { Patient } from "@/types/database";

export default async function PatientsPage() {
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <PatientsClient
          initialPatients={(patients ?? []) as Patient[]}
        />
      </Suspense>
    </div>
  );
}

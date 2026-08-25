import { createClient } from "@/utils/supabase/server";
import { Suspense } from "react";
import PatientsClient from "./PatientsClient";
import type { Patient } from "@/types/database";

export default async function PatientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 sm:p-8">
      <Suspense>
        <PatientsClient
          initialPatients={(patients ?? []) as Patient[]}
          userId={user!.id}
        />
      </Suspense>
    </div>
  );
}

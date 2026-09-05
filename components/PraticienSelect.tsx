"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Dropdown of the cabinet's praticiens (dentists). onChange returns both the id
// and the name so callers can store praticien_id plus a name snapshot.
export function PraticienSelect({
  value,
  onChange,
  className,
  emptyLabel = "— Aucun —",
}: {
  value: string;
  onChange: (id: string, name: string) => void;
  className?: string;
  emptyLabel?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("praticiens").select("id, name").is("archived_at", null).order("name")
      .then(({ data }) => setList((data ?? []) as { id: string; name: string }[]));
  }, [supabase]);

  return (
    <select
      value={value}
      onChange={(e) => {
        const p = list.find((x) => x.id === e.target.value);
        onChange(e.target.value, p?.name ?? "");
      }}
      className={className}
    >
      <option value="">{emptyLabel}</option>
      {list.map((p) => <option key={p.id} value={p.id}>Dr. {p.name}</option>)}
    </select>
  );
}

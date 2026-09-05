-- Odontogram: per-patient dental chart (current state per tooth, FDI numbering).
create table if not exists public.tooth_chart (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  tooth text not null,          -- FDI code: '11'..'48' (adult), '51'..'85' (child)
  status text not null,         -- carie|obturee|couronne|a_traiter|prothese|bridge|implant|absente
  note text,
  user_id uuid not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, tooth)
);
create index if not exists idx_tooth_chart_patient on public.tooth_chart(patient_id);

alter table public.tooth_chart enable row level security;
drop policy if exists tooth_chart_rls on public.tooth_chart;
create policy tooth_chart_rls on public.tooth_chart
  for all using (practice_id = public.current_practice_id())
  with check (practice_id = public.current_practice_id());

notify pgrst, 'reload schema';

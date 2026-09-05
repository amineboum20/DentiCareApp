-- Ordonnances (prescriptions) + their lines.
-- An ordonnance is issued during a visite (consultation_id) or standalone at
-- patient level. Free-text lines for now; a médicaments catalog comes in Phase 2
-- (medicament_id is reserved for it). RLS scoped by practice_id.
create table if not exists public.ordonnances (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete set null,
  dossier_id uuid references public.dossiers(id) on delete set null,
  user_id uuid not null,
  prescriber text,
  date date not null default current_date,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.ordonnance_lignes (
  id uuid primary key default gen_random_uuid(),
  ordonnance_id uuid not null references public.ordonnances(id) on delete cascade,
  medicament_id uuid,                 -- reserved for the Phase 2 catalog
  name text not null,
  posologie text,
  duree text,
  quantite text,
  instructions text,
  sort_order int not null default 0
);

create index if not exists idx_ordonnances_patient on public.ordonnances(practice_id, patient_id);
create index if not exists idx_ordonnances_consultation on public.ordonnances(consultation_id);
create index if not exists idx_ordonnance_lignes_ordonnance on public.ordonnance_lignes(ordonnance_id);

alter table public.ordonnances enable row level security;
alter table public.ordonnance_lignes enable row level security;

drop policy if exists ordonnances_rls on public.ordonnances;
create policy ordonnances_rls on public.ordonnances
  for all using (practice_id = public.current_practice_id())
  with check (practice_id = public.current_practice_id());

drop policy if exists ordonnance_lignes_rls on public.ordonnance_lignes;
create policy ordonnance_lignes_rls on public.ordonnance_lignes
  for all using (exists (select 1 from public.ordonnances o where o.id = ordonnance_id and o.practice_id = public.current_practice_id()))
  with check (exists (select 1 from public.ordonnances o where o.id = ordonnance_id and o.practice_id = public.current_practice_id()));

notify pgrst, 'reload schema';

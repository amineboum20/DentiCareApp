-- Phase 2 for ordonnances: a médicaments catalog with default prescription
-- values, and a cancel state on ordonnances (soft-cancel, keep the record).

-- 1) Médicaments catalog.
create table if not exists public.medicaments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  form text,
  default_posologie text,
  default_duree text,
  default_quantite text,
  default_instructions text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index if not exists idx_medicaments_practice on public.medicaments(practice_id);
alter table public.medicaments enable row level security;
drop policy if exists medicaments_rls on public.medicaments;
create policy medicaments_rls on public.medicaments
  for all using (practice_id = public.current_practice_id())
  with check (practice_id = public.current_practice_id());

-- Link the reserved ordonnance_lignes.medicament_id to the catalog. Lines keep
-- their own snapshot text so past ordonnances never change if the catalog does.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ordonnance_lignes_medicament_fk') then
    alter table public.ordonnance_lignes
      add constraint ordonnance_lignes_medicament_fk
      foreign key (medicament_id) references public.medicaments(id) on delete set null;
  end if;
end $$;

-- 2) Cancel state for ordonnances.
alter table public.ordonnances add column if not exists status text not null default 'active';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ordonnances_status_chk') then
    alter table public.ordonnances add constraint ordonnances_status_chk check (status in ('active','annulee'));
  end if;
end $$;

notify pgrst, 'reload schema';

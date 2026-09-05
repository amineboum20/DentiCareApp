-- Praticiens (dentists) catalog + mutuelle / feuille de soins support.

-- Practitioners of the cabinet, each with their own INPE. Independent of login
-- (an associate dentist may not have an app account).
create table if not exists public.praticiens (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  inpe text,
  numero_ordre text,
  speciality text,
  phone text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index if not exists idx_praticiens_practice on public.praticiens(practice_id);
alter table public.praticiens enable row level security;
drop policy if exists praticiens_rls on public.praticiens;
create policy praticiens_rls on public.praticiens
  for all using (practice_id = public.current_practice_id())
  with check (practice_id = public.current_practice_id());

-- Attribute visites, ordonnances and rendez-vous to a praticien.
alter table public.consultations add column if not exists praticien_id uuid references public.praticiens(id) on delete set null;
alter table public.ordonnances   add column if not exists praticien_id uuid references public.praticiens(id) on delete set null;
alter table public.appointments  add column if not exists praticien_id uuid references public.praticiens(id) on delete set null;

-- Patient insurer identifiers (feuille de soins).
alter table public.patients add column if not exists mutuelle_organisme text;
alter table public.patients add column if not exists mutuelle_numero text;
alter table public.patients add column if not exists mutuelle_lien text;

-- Nomenclature code (cotation) on actes; per-acte date on facture lines.
alter table public.actes add column if not exists code text;
alter table public.facture_items add column if not exists acte_date date;

notify pgrst, 'reload schema';

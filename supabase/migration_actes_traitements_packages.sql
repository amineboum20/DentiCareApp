-- DentiCare — Two-level catalog: Actes (atomic) + Traitements (packages)
--                + "Consultation" acte seed for visit auto-billing
-- Run once on project isunbvkbhnqpdtdggipa via scripts/apply-migration.mjs
-- NOTE: applied migrations are immutable — fix forward with a new file.

-- 1. Rename the flat catalog -> actes (existing rows = atomic acts: radio, détartrage…)
alter table public.traitements rename to actes;
alter table public.facture_items rename column traitement_id to acte_id;

-- 2. New traitements = reusable package (a group of actes)
create table public.traitements (
  id             uuid primary key default gen_random_uuid(),
  practice_id    uuid not null references public.practices(id) on delete cascade,
  user_id        uuid not null references auth.users(id),
  name           text not null,
  category       text not null default 'autre'
                   check (category in (
                     'nettoyage','obturation','extraction','couronne',
                     'implant','orthodontie','blanchiment','prothese','autre'
                   )),
  description    text,
  notes          text,
  price_override numeric(10,2),          -- null => price = sum of composing actes
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id),
  updated_by     uuid references auth.users(id)
);
alter table public.traitements enable row level security;
drop policy if exists "traitements: practice members only" on public.traitements;
create policy "traitements: practice members only" on public.traitements
  using (practice_id = current_practice_id())
  with check (practice_id = current_practice_id());
create index if not exists traitements_practice_idx on public.traitements (practice_id);
drop trigger if exists trg_traitements_updated_at on public.traitements;
create trigger trg_traitements_updated_at before update on public.traitements
  for each row execute function public.set_updated_at();

-- 3. Package composition (package -> actes with quantities)
create table public.traitement_actes (
  id            uuid primary key default gen_random_uuid(),
  traitement_id uuid not null references public.traitements(id) on delete cascade,
  acte_id       uuid not null references public.actes(id) on delete restrict,
  quantity      int not null default 1,
  sort_order    int not null default 0
);
alter table public.traitement_actes enable row level security;
drop policy if exists "traitement_actes: via parent" on public.traitement_actes;
create policy "traitement_actes: via parent" on public.traitement_actes
  for all
  using (exists (select 1 from public.traitements t
                 where t.id = traitement_id and t.practice_id = current_practice_id()))
  with check (exists (select 1 from public.traitements t
                      where t.id = traitement_id and t.practice_id = current_practice_id()));
create index if not exists traitement_actes_traitement_idx on public.traitement_actes (traitement_id);
create index if not exists traitement_actes_acte_idx       on public.traitement_actes (acte_id);

-- 4. Seed one "Consultation" acte per practice (price 0, editable) for visit auto-billing
insert into public.actes (practice_id, user_id, name, category, price, created_by)
select pm.practice_id, pm.user_id, 'Consultation', 'autre', 0, pm.user_id
from (select distinct on (practice_id) practice_id, user_id
      from public.practice_members order by practice_id) pm
where not exists (
  select 1 from public.actes a
  where a.practice_id = pm.practice_id and lower(a.name) = 'consultation'
);

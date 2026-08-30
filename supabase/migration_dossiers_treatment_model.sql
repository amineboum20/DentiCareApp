-- DentiCare — treatment-case (dossiers) + acomptes billing model
-- Introduces the "dossier" grouping entity above visites (consultations),
-- factures and rendez-vous, with a dossier-level acomptes (payments) ledger.
-- Run once in Supabase SQL Editor (project isunbvkbhnqpdtdggipa).

-- 1. dossiers (treatment case / dossier de soins)
create table if not exists public.dossiers (
  id            uuid primary key default gen_random_uuid(),
  practice_id   uuid not null references public.practices(id) on delete cascade,
  patient_id    uuid not null references public.patients(id) on delete cascade,
  user_id       uuid not null,
  title         text not null,
  statut        text not null default 'ouvert' check (statut in ('ouvert','termine')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  created_by    uuid,
  updated_by    uuid
);
alter table public.dossiers enable row level security;
drop policy if exists "dossiers: practice members only" on public.dossiers;
create policy "dossiers: practice members only" on public.dossiers
  using (practice_id = current_practice_id()) with check (practice_id = current_practice_id());
create index if not exists dossiers_practice_patient_idx on public.dossiers (practice_id, patient_id);
drop trigger if exists trg_dossiers_updated_at on public.dossiers;
create trigger trg_dossiers_updated_at before update on public.dossiers
  for each row execute function public.set_updated_at();

-- 2. acomptes (payments ledger, at dossier level)
create table if not exists public.acomptes (
  id             uuid primary key default gen_random_uuid(),
  practice_id    uuid not null references public.practices(id) on delete cascade,
  dossier_id     uuid not null references public.dossiers(id) on delete cascade,
  montant        numeric(10,2) not null default 0,
  date_paiement  date not null default current_date,
  moyen          text not null default 'especes' check (moyen in ('especes','carte','virement','cheque','autre')),
  note           text,
  created_at     timestamptz not null default now(),
  created_by     uuid
);
alter table public.acomptes enable row level security;
drop policy if exists "acomptes: practice members only" on public.acomptes;
create policy "acomptes: practice members only" on public.acomptes
  using (practice_id = current_practice_id()) with check (practice_id = current_practice_id());
create index if not exists acomptes_dossier_idx on public.acomptes (dossier_id);

-- 3. link existing tables to a dossier
alter table public.consultations add column if not exists dossier_id uuid references public.dossiers(id) on delete set null;
alter table public.factures      add column if not exists dossier_id uuid references public.dossiers(id) on delete set null;
alter table public.factures      add column if not exists type text not null default 'facture' check (type in ('devis','facture'));
alter table public.appointments  add column if not exists dossier_id uuid references public.dossiers(id) on delete set null;
create index if not exists consultations_dossier_idx on public.consultations (dossier_id);
create index if not exists factures_dossier_idx      on public.factures (dossier_id);
create index if not exists appointments_dossier_idx  on public.appointments (dossier_id);

-- 4. backfill: every existing consultation & facture gets a dossier
do $mig$
declare c record; f record; d_id uuid;
begin
  for c in select * from public.consultations where dossier_id is null loop
    insert into public.dossiers (practice_id, patient_id, user_id, title, statut, created_at, created_by)
    values (c.practice_id, c.patient_id, c.user_id, 'Dossier — ' || coalesce(to_char(c.exam_date,'DD/MM/YYYY'),'soin'), 'ouvert', c.created_at, c.created_by)
    returning id into d_id;
    update public.consultations set dossier_id = d_id where id = c.id;
    update public.factures set dossier_id = d_id where consultation_id = c.id and dossier_id is null;
  end loop;
  for f in select * from public.factures where dossier_id is null loop
    insert into public.dossiers (practice_id, patient_id, user_id, title, statut, created_at, created_by)
    values (f.practice_id, f.patient_id, f.user_id, 'Dossier — facture', 'ouvert', f.created_at, f.created_by)
    returning id into d_id;
    update public.factures set dossier_id = d_id where id = f.id;
  end loop;
  insert into public.acomptes (practice_id, dossier_id, montant, date_paiement, moyen, note, created_at, created_by)
  select f.practice_id, f.dossier_id, f.deposit_paid, coalesce(f.created_at::date, current_date), 'especes', 'Acompte migré', f.created_at, f.created_by
  from public.factures f where f.deposit_paid > 0 and f.dossier_id is not null;
end $mig$;

-- DentiCare — Supabase schema
-- Run this in your NEW Supabase project's SQL editor (separate from OptiApp)
-- After running, enable RLS on each table (done below), then create a Storage bucket
-- named "shop-assets" (public) for logo uploads.

-- ─── patients ────────────────────────────────────────────────────────────────
create table public.patients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  email         text,
  phone         text,
  date_of_birth date,
  address       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.patients enable row level security;

create policy "patients: owner only"
  on public.patients
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── dossiers (dental records) ───────────────────────────────────────────────
create table public.dossiers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete cascade,
  type           text not null default 'examen'
                   check (type in ('examen','soin','bilan','urgence','autre')),
  exam_date      date,
  next_exam_date date,
  treated_by     text,
  dental_notes   text,
  document_path  text,
  created_at     timestamptz not null default now()
);

alter table public.dossiers enable row level security;

create policy "dossiers: owner only"
  on public.dossiers
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── traitements (treatment catalog) ─────────────────────────────────────────
create table public.traitements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  category         text not null default 'autre'
                     check (category in (
                       'nettoyage','obturation','extraction','couronne',
                       'implant','orthodontie','blanchiment','prothese','autre'
                     )),
  price            numeric(10,2) not null default 0,
  duration_minutes int,
  description      text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.traitements enable row level security;

create policy "traitements: owner only"
  on public.traitements
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── factures (invoices) ──────────────────────────────────────────────────────
create table public.factures (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  patient_id    uuid not null references public.patients(id) on delete cascade,
  dossier_id    uuid references public.dossiers(id) on delete set null,
  status        text not null default 'en_attente'
                  check (status in ('en_attente','en_cours','payee','annulee')),
  total_price   numeric(10,2) not null default 0,
  deposit_paid  numeric(10,2) not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.factures enable row level security;

create policy "factures: owner only"
  on public.factures
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── facture_items ────────────────────────────────────────────────────────────
create table public.facture_items (
  id            uuid primary key default gen_random_uuid(),
  facture_id    uuid not null references public.factures(id) on delete cascade,
  traitement_id uuid references public.traitements(id) on delete set null,
  description   text not null,
  quantity      int not null default 1,
  unit_price    numeric(10,2) not null default 0
);

alter table public.facture_items enable row level security;

-- facture_items has no user_id — access is granted transitively via the parent facture
create policy "facture_items: owner only"
  on public.facture_items
  for all
  using (
    exists (
      select 1 from public.factures f
      where f.id = facture_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.factures f
      where f.id = facture_id
        and f.user_id = auth.uid()
    )
  );

-- ─── appointments ─────────────────────────────────────────────────────────────
create table public.appointments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  patient_id  uuid references public.patients(id) on delete set null,
  title       text not null,
  type        text not null default 'consultation'
                check (type in (
                  'consultation','nettoyage','soin','chirurgie',
                  'controle','orthodontie','autre'
                )),
  status      text not null default 'planifie'
                check (status in ('planifie','termine','annule','absent')),
  start_time  timestamptz not null,
  end_time    timestamptz,
  notes       text,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.appointments enable row level security;

create policy "appointments: owner only"
  on public.appointments
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── updated_at triggers ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

create trigger trg_traitements_updated_at
  before update on public.traitements
  for each row execute function public.set_updated_at();

create trigger trg_factures_updated_at
  before update on public.factures
  for each row execute function public.set_updated_at();

create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ─── helpful indexes ──────────────────────────────────────────────────────────
create index on public.patients       (user_id);
create index on public.dossiers       (user_id, patient_id);
create index on public.traitements    (user_id);
create index on public.factures       (user_id, patient_id);
create index on public.facture_items  (facture_id);
create index on public.appointments   (user_id, start_time);

-- ─── after running this script ────────────────────────────────────────────────
-- 1. Go to Storage → New bucket → name: "shop-assets" → Public bucket ✓
-- 2. Go to Auth → Settings → enable "Confirm email" = OFF (mailer_autoconfirm: true)
--    OR: Project Settings → Auth → Email → toggle "Enable email confirmations" OFF
-- 3. Copy your Project URL + anon key + service_role key to .env.local

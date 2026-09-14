-- Uniform audit trail across all practice-scoped tables:
--   created_by / created_at  (already present everywhere; set by the app on insert)
--   updated_by / updated_at  (backfilled here + maintained automatically on UPDATE)
-- Goal: every object can show "Créé par …" and "Modifié par …" without the app
-- having to remember to set updated_* on each of its ~40 update call sites.

-- 1. Fill the column gaps so the set of audited tables is uniform (idempotent).
alter table public.acomptes             add column if not exists updated_at timestamptz, add column if not exists updated_by uuid;
alter table public.suppliers            add column if not exists updated_at timestamptz, add column if not exists updated_by uuid;
alter table public.treatment_attributes add column if not exists updated_at timestamptz, add column if not exists updated_by uuid;
alter table public.consultations        add column if not exists updated_at timestamptz;
alter table public.medicaments          add column if not exists updated_at timestamptz;
alter table public.ordonnances          add column if not exists updated_at timestamptz;
alter table public.praticiens           add column if not exists updated_at timestamptz;
alter table public.supplier_orders      add column if not exists updated_at timestamptz;

-- 2. Trigger function: stamp who/when on every UPDATE.
--    auth.uid() is the acting user for normal authenticated writes; it is NULL for
--    service_role writes (patient portal / admin / /api routes) — in that case we
--    keep whatever updated_by was explicitly provided, else leave the old value.
create or replace function public.stamp_updated_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  return new;
end;
$$;

-- 3. Attach the BEFORE UPDATE trigger to every audited table (idempotent).
do $$
declare t text;
begin
  foreach t in array array[
    'acomptes','actes','appointments','consultations','dossiers','factures',
    'medicaments','ordonnances','patients','praticiens','supplier_orders',
    'suppliers','tooth_chart','traitements','treatment_attributes'
  ] loop
    execute format('drop trigger if exists trg_stamp_updated on public.%I', t);
    execute format('create trigger trg_stamp_updated before update on public.%I for each row execute function public.stamp_updated_audit()', t);
  end loop;
end $$;

notify pgrst, 'reload schema';

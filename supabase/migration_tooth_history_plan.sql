-- Odontogram history + planned care (DentiCare).
--
-- 1. tooth_history  — append-only log of every tooth_chart change (status set /
--    changed / cleared, note edits), written by a trigger so no app write path
--    can forget it. Clients can only READ it (no insert/update/delete policy).
-- 2. tooth_chart.source_acte_id — set by billing when an acte changes a tooth,
--    so the history line says which acte did it (manual edits send null).
-- 3. tooth_plan     — "soins prévus": an acte planned on a tooth, then done
--    (auto when that acte is billed on that tooth, or by hand) or cancelled.
-- Idempotent.

-- ── 2. source acte on the current chart row ────────────────────────────────
alter table public.tooth_chart
  add column if not exists source_acte_id uuid references public.actes(id) on delete set null;

-- ── 1. history ─────────────────────────────────────────────────────────────
create table if not exists public.tooth_history (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  tooth text not null,
  status text,                 -- new status; null = cleared
  previous_status text,
  note text,
  acte_id uuid references public.actes(id) on delete set null,
  acte_name text,              -- snapshot, survives acte rename/delete
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index if not exists idx_tooth_history_patient on public.tooth_history(patient_id, changed_at desc);

alter table public.tooth_history enable row level security;
drop policy if exists tooth_history_select on public.tooth_history;
create policy tooth_history_select on public.tooth_history
  for select using (practice_id = public.current_practice_id());

create or replace function public.log_tooth_history()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_acte uuid;
  v_name text;
begin
  if tg_op = 'DELETE' then
    insert into tooth_history (practice_id, patient_id, tooth, status, previous_status, note, changed_by)
    values (old.practice_id, old.patient_id, old.tooth, null, old.status, null, coalesce(auth.uid(), old.updated_by));
    return old;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.note is not distinct from old.note then
    return new; -- nothing clinical changed
  end if;

  v_acte := new.source_acte_id;
  if v_acte is not null then
    select name into v_name from actes where id = v_acte;
  end if;

  insert into tooth_history (practice_id, patient_id, tooth, status, previous_status, note, acte_id, acte_name, changed_by)
  values (new.practice_id, new.patient_id, new.tooth, new.status,
          case when tg_op = 'UPDATE' then old.status end,
          new.note, v_acte, v_name, coalesce(auth.uid(), new.updated_by, new.created_by));
  return new;
end $$;

drop trigger if exists trg_tooth_history on public.tooth_chart;
create trigger trg_tooth_history
  after insert or update or delete on public.tooth_chart
  for each row execute function public.log_tooth_history();

-- Seed: one line per tooth already charted, so existing state has a starting point.
insert into public.tooth_history (practice_id, patient_id, tooth, status, note, changed_by, changed_at)
select tc.practice_id, tc.patient_id, tc.tooth, tc.status, tc.note, coalesce(tc.updated_by, tc.created_by), tc.updated_at
from public.tooth_chart tc
where not exists (select 1 from public.tooth_history h where h.patient_id = tc.patient_id and h.tooth = tc.tooth);

-- ── 3. planned care ────────────────────────────────────────────────────────
create table if not exists public.tooth_plan (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  tooth text not null,
  acte_id uuid references public.actes(id) on delete set null,
  label text not null,         -- acte name snapshot
  note text,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  planned_at date not null default current_date,
  done_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tooth_plan_patient on public.tooth_plan(patient_id, status);

alter table public.tooth_plan enable row level security;
drop policy if exists tooth_plan_rls on public.tooth_plan;
create policy tooth_plan_rls on public.tooth_plan
  for all using (practice_id = public.current_practice_id())
  with check (practice_id = public.current_practice_id());

-- Clinical table: assistants read only (same rule as tooth_chart).
drop policy if exists "assistants cannot insert" on public.tooth_plan;
create policy "assistants cannot insert" on public.tooth_plan as restrictive for insert to authenticated
  with check (current_member_role() <> 'assistant');
drop policy if exists "assistants cannot update" on public.tooth_plan;
create policy "assistants cannot update" on public.tooth_plan as restrictive for update to authenticated
  using (current_member_role() <> 'assistant') with check (current_member_role() <> 'assistant');
drop policy if exists "assistants cannot delete" on public.tooth_plan;
create policy "assistants cannot delete" on public.tooth_plan as restrictive for delete to authenticated
  using (current_member_role() <> 'assistant');

-- "Modifié par" stamping, like every other audited table.
drop trigger if exists trg_stamp_updated on public.tooth_plan;
create trigger trg_stamp_updated before update on public.tooth_plan
  for each row execute function public.stamp_updated_audit();

notify pgrst, 'reload schema';

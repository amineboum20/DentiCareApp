-- Visite (consultations) title — step 1 of 2: add the column + backfill.
-- Applied BEFORE the app deploy that starts sending `title`. Nullable for now so
-- the currently-deployed app (which doesn't send it yet) keeps working.
-- Step 2 (migration_consultation_title_not_null.sql) enforces NOT NULL after deploy.

-- Skip the BEFORE UPDATE audit trigger (stamp_updated_audit) during the backfill,
-- so existing visites don't all show "Modifié par … aujourd'hui".
set session_replication_role = replica;

alter table public.consultations add column if not exists title text;

-- 1) Visites created from a RDV inherit the RDV's title.
update public.consultations c
set title = btrim(a.title)
from public.appointments a
where a.consultation_id = c.id
  and (c.title is null or btrim(c.title) = '')
  and nullif(btrim(a.title), '') is not null;

-- 2) Everything else: the motif label (stored data, French like other generated content).
update public.consultations
set title = case motif
  when 'consultation' then 'Consultation'
  when 'controle'     then 'Contrôle'
  when 'soin'         then 'Soin'
  when 'urgence'      then 'Urgence'
  else 'Autre'
end
where title is null or btrim(title) = '';

set session_replication_role = origin;

notify pgrst, 'reload schema';

-- Visite (consultations) title — step 2 of 2: enforce it.
-- Apply ONLY after the app version that always sends `title` is live on Vercel.

-- Safety net for any visite created by the old app between step 1 and the deploy.
set session_replication_role = replica;
update public.consultations set title = 'Visite' where title is null or btrim(title) = '';
set session_replication_role = origin;

alter table public.consultations alter column title set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'consultations_title_not_blank') then
    alter table public.consultations add constraint consultations_title_not_blank check (btrim(title) <> '');
  end if;
end $$;

notify pgrst, 'reload schema';

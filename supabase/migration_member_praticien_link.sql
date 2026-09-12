-- Link a practice member (a dentist account) to their praticien record so the
-- agenda can default to "everything under my name". Nullable: owners/assistants
-- may have none. ON DELETE SET NULL so removing a praticien just clears the link.
alter table public.practice_members
  add column if not exists praticien_id uuid references public.praticiens(id) on delete set null;

create index if not exists idx_practice_members_praticien_id
  on public.practice_members(praticien_id);

notify pgrst, 'reload schema';

-- Support ticketing: tickets + threaded messages + attachments.
-- Users (practice members) see/write only their own practice's tickets via RLS.
-- Admins (amine/yasmine) act through service-role API routes, which bypass RLS.

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  subject text not null default '',
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('user','admin')),
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.support_messages(id) on delete cascade,
  path text not null,
  filename text not null,
  size integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_practice on public.support_tickets(practice_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_messages_ticket on public.support_messages(ticket_id);
create index if not exists idx_support_attachments_message on public.support_attachments(message_id);

-- ── Ticket status/timestamps kept in sync from messages (any writer) ────────
create or replace function public.support_touch_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets
    set last_message_at = now(),
        updated_at = now(),
        status = case when new.author_role = 'admin' then 'answered' else 'open' end,
        closed_at = null,
        closed_by = null
    where id = new.ticket_id;
  return new;
end $$;

drop trigger if exists support_messages_touch on public.support_messages;
create trigger support_messages_touch after insert on public.support_messages
  for each row execute function public.support_touch_ticket();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;

drop policy if exists support_tickets_select on public.support_tickets;
drop policy if exists support_tickets_insert on public.support_tickets;
drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_select on public.support_tickets for select to authenticated
  using (practice_id = public.current_practice_id());
create policy support_tickets_insert on public.support_tickets for insert to authenticated
  with check (practice_id = public.current_practice_id() and created_by = auth.uid());
create policy support_tickets_update on public.support_tickets for update to authenticated
  using (practice_id = public.current_practice_id())
  with check (practice_id = public.current_practice_id());

drop policy if exists support_messages_select on public.support_messages;
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_select on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t
                 where t.id = ticket_id and t.practice_id = public.current_practice_id()));
-- Users may only post as 'user', as themselves, on their own practice's ticket.
-- Admin replies go through the service role (bypasses RLS) so they can be 'admin'.
create policy support_messages_insert on public.support_messages for insert to authenticated
  with check (author_role = 'user' and author_id = auth.uid()
              and exists (select 1 from public.support_tickets t
                          where t.id = ticket_id and t.practice_id = public.current_practice_id()));

drop policy if exists support_attachments_select on public.support_attachments;
drop policy if exists support_attachments_insert on public.support_attachments;
create policy support_attachments_select on public.support_attachments for select to authenticated
  using (exists (select 1 from public.support_messages m
                 join public.support_tickets t on t.id = m.ticket_id
                 where m.id = message_id and t.practice_id = public.current_practice_id()));
create policy support_attachments_insert on public.support_attachments for insert to authenticated
  with check (exists (select 1 from public.support_messages m
                      join public.support_tickets t on t.id = m.ticket_id
                      where m.id = message_id and t.practice_id = public.current_practice_id()));

-- ── Storage bucket (private) for thread attachments ─────────────────────────
insert into storage.buckets (id, name, public)
  values ('support-attachments', 'support-attachments', false)
  on conflict (id) do nothing;

drop policy if exists "support-attachments: own practice rw" on storage.objects;
create policy "support-attachments: own practice rw" on storage.objects for all to authenticated
  using (bucket_id = 'support-attachments'
         and (storage.foldername(name))[1] in (select practice_id::text from public.practice_members where user_id = auth.uid()))
  with check (bucket_id = 'support-attachments'
              and (storage.foldername(name))[1] in (select practice_id::text from public.practice_members where user_id = auth.uid()));

notify pgrst, 'reload schema';

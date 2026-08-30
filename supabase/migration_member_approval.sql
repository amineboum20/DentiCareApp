-- Member-level approval for practice_members.
-- Owner signups are gated by practices.is_approved; members invited by an owner
-- get their own approval gate so an admin can validate each one.
--
-- Default TRUE so every existing row (owners + members added before this change)
-- stays approved. The member-invite path explicitly inserts is_approved = false.

alter table public.practice_members
  add column if not exists is_approved boolean not null default true;

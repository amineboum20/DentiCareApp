-- Public, unguessable token per patient — used by the QR-code patient portal.
create extension if not exists pgcrypto;
alter table public.patients add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists idx_patients_public_token on public.patients(public_token);

notify pgrst, 'reload schema';

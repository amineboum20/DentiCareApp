-- Shared QA test results for the admin Tests page. Global (not practice-scoped);
-- only admins reach it, and all writes go through the service-role admin API,
-- so RLS is enabled with no public policies (service role bypasses it).
create table if not exists public.qa_test_results (
  test_id text primary key,
  result text not null check (result in ('pass','fail','skip')),
  updated_by text,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.qa_test_results enable row level security;

notify pgrst, 'reload schema';

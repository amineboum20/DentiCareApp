-- Subscriptions (what MediCareApp bills each shop / cabinet for the service).
-- One plan: Standard, 199 MAD / month, 3-month free trial from signup.
-- Invoices are generated automatically on the 1st of each month (pg_cron),
-- also when unpaid: each invoice carries the previous balance
-- (positive = still owed, negative = credit from a large advance payment).
-- Writes are admin-only (service role); a practice OWNER can read its own rows.
-- Identical in both apps except INVOICE_PREFIX ('FA-DEN-' here, 'FA-DEN-' in DentiCare).

-- 1. Tables ------------------------------------------------------------------
create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  practice_id     uuid not null unique references public.practices(id) on delete cascade,
  plan            text not null default 'standard',
  monthly_price   numeric(10,2) not null default 199,
  currency        text not null default 'MAD',
  trial_ends_at   date not null,
  status          text not null default 'trial' check (status in ('trial','active','cancelled')),
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.subscription_invoices (
  id                uuid primary key default gen_random_uuid(),
  practice_id       uuid not null references public.practices(id) on delete cascade,
  number            text not null unique,
  period_start      date not null,
  period_end        date not null,
  issued_at         date not null default current_date,
  plan              text not null,
  amount            numeric(10,2) not null,          -- this month's charge
  previous_balance  numeric(10,2) not null default 0, -- >0 owed, <0 credit, before this invoice
  total_due         numeric(10,2) not null,           -- previous_balance + amount (can be <0)
  currency          text not null default 'MAD',
  created_at        timestamptz not null default now(),
  unique (practice_id, period_start)
);

create table if not exists public.subscription_payments (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid not null references public.practices(id) on delete cascade,
  amount       numeric(10,2) not null check (amount > 0),
  paid_at      date not null default current_date,
  method       text not null default 'virement' check (method in ('virement','especes','cheque','carte','autre')),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_subscription_invoices_practice on public.subscription_invoices(practice_id, period_start);
create index if not exists idx_subscription_payments_practice on public.subscription_payments(practice_id, paid_at);

create sequence if not exists public.subscription_invoice_seq;

-- 2. RLS: owners read their own practice's rows; no client writes ------------
alter table public.subscriptions         enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.subscription_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['subscriptions','subscription_invoices','subscription_payments'] loop
    execute format('drop policy if exists "owner read" on public.%I', t);
    execute format($p$create policy "owner read" on public.%I for select to authenticated using (
      practice_id in (select m.practice_id from public.practice_members m
                      where m.user_id = auth.uid() and m.role = 'owner' and m.deactivated_at is null))$p$, t);
  end loop;
end $$;

-- GRANTs (explicit since 2026-10-30): read for authenticated, all for service_role, nothing for anon.
grant select on public.subscriptions, public.subscription_invoices, public.subscription_payments to authenticated;
grant all on public.subscriptions, public.subscription_invoices, public.subscription_payments to service_role;
grant usage on sequence public.subscription_invoice_seq to service_role;

-- 3. Every practice gets a subscription with a 3-month trial ------------------
create or replace function public.create_practice_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (practice_id, trial_ends_at)
  values (new.id, (new.created_at + interval '3 months')::date)
  on conflict (practice_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_practice_subscription on public.practices;
create trigger trg_practice_subscription after insert on public.practices
  for each row execute function public.create_practice_subscription();

-- Backfill existing practices (trial counted from their signup date).
insert into public.subscriptions (practice_id, trial_ends_at)
select p.id, (p.created_at + interval '3 months')::date from public.practices p
on conflict (practice_id) do nothing;

-- 4. Monthly invoice generation (idempotent: one invoice per practice & month) -
-- Bills the month of p_month (in advance) for every approved, non-cancelled
-- practice whose trial is over by the 1st of that month.
create or replace function public.generate_subscription_invoices(p_month date default current_date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_prefix constant text := 'FA-DEN-';   -- INVOICE_PREFIX
  r record;
  v_prev numeric(10,2);
  n integer := 0;
begin
  for r in
    select s.* from public.subscriptions s
    join public.practices p on p.id = s.practice_id
    where p.is_approved and s.status <> 'cancelled' and s.trial_ends_at <= v_start
      and not exists (select 1 from public.subscription_invoices i
                      where i.practice_id = s.practice_id and i.period_start = v_start)
  loop
    select coalesce((select sum(amount) from public.subscription_invoices where practice_id = r.practice_id), 0)
         - coalesce((select sum(amount) from public.subscription_payments where practice_id = r.practice_id and paid_at <= v_start), 0)
      into v_prev;
    insert into public.subscription_invoices
      (practice_id, number, period_start, period_end, issued_at, plan, amount, previous_balance, total_due, currency)
    values
      (r.practice_id,
       v_prefix || to_char(v_start, 'YYYY') || '-' || lpad(nextval('public.subscription_invoice_seq')::text, 4, '0'),
       v_start, v_end, v_start, r.plan, r.monthly_price, v_prev, v_prev + r.monthly_price, r.currency);
    update public.subscriptions set status = 'active' where id = r.id and status = 'trial';
    n := n + 1;
  end loop;
  return n;
end $$;

-- SECURITY DEFINER: never callable by clients.
revoke all on function public.generate_subscription_invoices(date) from public, anon, authenticated;
revoke all on function public.create_practice_subscription() from public, anon, authenticated;
grant execute on function public.generate_subscription_invoices(date) to service_role;

-- 5. Schedule: 01:00 UTC on the 1st of every month ----------------------------
create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'subscription-invoices-monthly';
  perform cron.schedule('subscription-invoices-monthly', '0 1 1 * *', 'select public.generate_subscription_invoices()');
end $$;

notify pgrst, 'reload schema';

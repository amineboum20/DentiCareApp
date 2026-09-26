-- Subscriptions: per-user pricing. Standard = 199 MAD / month for the first
-- user + 99 MAD / month per additional user. A "user" = an approved, active
-- (not deactivated) practice member, counted when the invoice is generated
-- (the 1st of the month). The invoice keeps the breakdown so its PDF never
-- changes afterwards.
-- Identical in both apps except INVOICE_PREFIX ('FA-DEN-' here, 'FA-OPT-' in OptiCareApp).

-- 1. Plan terms on the subscription ------------------------------------------
alter table public.subscriptions
  add column if not exists included_users   integer       not null default 1,
  add column if not exists extra_user_price numeric(10,2) not null default 99;

-- 2. Breakdown on each invoice (amount = base_amount + extra_users * extra_user_price)
alter table public.subscription_invoices
  add column if not exists base_amount      numeric(10,2),
  add column if not exists users_count      integer       not null default 1,
  add column if not exists extra_users      integer       not null default 0,
  add column if not exists extra_user_price numeric(10,2) not null default 0;
update public.subscription_invoices set base_amount = amount where base_amount is null;
alter table public.subscription_invoices alter column base_amount set not null;

-- 3. Monthly invoice generation, now with the extra users --------------------
create or replace function public.generate_subscription_invoices(p_month date default current_date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_prefix constant text := 'FA-DEN-';   -- INVOICE_PREFIX
  r record;
  v_prev   numeric(10,2);
  v_users  integer;
  v_extra  integer;
  v_amount numeric(10,2);
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
    select count(*) into v_users from public.practice_members m
      where m.practice_id = r.practice_id and m.is_approved and m.deactivated_at is null;
    v_extra  := greatest(v_users - r.included_users, 0);
    v_amount := r.monthly_price + v_extra * r.extra_user_price;
    insert into public.subscription_invoices
      (practice_id, number, period_start, period_end, issued_at, plan,
       base_amount, users_count, extra_users, extra_user_price,
       amount, previous_balance, total_due, currency)
    values
      (r.practice_id,
       v_prefix || to_char(v_start, 'YYYY') || '-' || lpad(nextval('public.subscription_invoice_seq')::text, 4, '0'),
       v_start, v_end, v_start, r.plan,
       r.monthly_price, v_users, v_extra, r.extra_user_price,
       v_amount, v_prev, v_prev + v_amount, r.currency);
    update public.subscriptions set status = 'active' where id = r.id and status = 'trial';
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.generate_subscription_invoices(date) from public, anon, authenticated;
grant execute on function public.generate_subscription_invoices(date) to service_role;

notify pgrst, 'reload schema';

-- OptiApp — full schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ─── clients ─────────────────────────────────────────────────────────────────
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  date_of_birth   date,
  address         text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.clients enable row level security;
create policy "clients: own rows only" on public.clients
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── prescriptions ───────────────────────────────────────────────────────────
create table public.prescriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  prescribed_by    text,                -- doctor / ophthalmologist name
  prescribed_date  date not null,
  expiry_date      date,
  -- right eye (OD = oculus dexter)
  od_sphere        numeric(5,2),
  od_cylinder      numeric(5,2),
  od_axis          smallint,            -- 0–180
  od_addition      numeric(4,2),
  -- left eye (OS = oculus sinister)
  os_sphere        numeric(5,2),
  os_cylinder      numeric(5,2),
  os_axis          smallint,
  os_addition      numeric(4,2),
  -- pupillary distance
  pd_right         numeric(4,1),
  pd_left          numeric(4,1),
  notes            text,
  created_at       timestamptz not null default now()
);

alter table public.prescriptions enable row level security;
create policy "prescriptions: own rows only" on public.prescriptions
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── products ────────────────────────────────────────────────────────────────
create type public.product_category as enum ('frame', 'lens', 'contact_lens', 'accessory', 'other');

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  category        public.product_category not null default 'frame',
  brand           text,
  model           text,
  sku             text,
  color           text,
  material        text,
  description     text,
  price           numeric(10,2) not null default 0,
  cost_price      numeric(10,2),
  stock_quantity  integer not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.products enable row level security;
create policy "products: own rows only" on public.products
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── orders ──────────────────────────────────────────────────────────────────
create type public.order_status as enum ('pending', 'in_progress', 'ready', 'delivered', 'cancelled');

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete restrict,
  prescription_id   uuid references public.prescriptions(id) on delete set null,
  status            public.order_status not null default 'pending',
  total_price       numeric(10,2) not null default 0,
  deposit_paid      numeric(10,2) not null default 0,
  notes             text,
  ordered_at        timestamptz not null default now(),
  ready_at          timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.orders enable row level security;
create policy "orders: own rows only" on public.orders
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── order_items ─────────────────────────────────────────────────────────────
create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  description  text not null,           -- snapshot of product name at order time
  quantity     integer not null default 1,
  unit_price   numeric(10,2) not null
);

-- order_items inherit access via orders; RLS on parent is enough for reads
-- but we need a policy scoped to the optician's user_id via the orders join
alter table public.order_items enable row level security;
create policy "order_items: via orders" on public.order_items
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- ─── appointments ────────────────────────────────────────────────────────────
create type public.appointment_type   as enum ('consultation', 'fitting', 'pickup', 'followup', 'other');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  client_id        uuid references public.clients(id) on delete set null,
  title            text not null,
  scheduled_at     timestamptz not null,
  duration_minutes integer not null default 30,
  type             public.appointment_type   not null default 'consultation',
  status           public.appointment_status not null default 'scheduled',
  notes            text,
  created_at       timestamptz not null default now()
);

alter table public.appointments enable row level security;
create policy "appointments: own rows only" on public.appointments
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── updated_at trigger (shared) ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at    before update on public.clients    for each row execute function public.set_updated_at();
create trigger products_updated_at   before update on public.products   for each row execute function public.set_updated_at();
create trigger orders_updated_at     before update on public.orders     for each row execute function public.set_updated_at();

-- Admin: archive, then permanently delete a cabinet and everything it owns (Admin →
-- Supprimer définitivement). One atomic function: either everything goes or
-- nothing.
--   admin_delete_practice(p, false) → dry run: counts + files + member accounts
--   admin_delete_practice(p, true)  → deletes the data, returns the storage
--                                     objects and auth users the app must then
--                                     remove (Storage API / auth admin API).
-- Order matters: patients / factures / appointments / actes /
-- treatment_attributes have NO ACTION FKs to practices, traitement_actes →
-- actes and supplier_orders → suppliers are RESTRICT.
-- SECURITY DEFINER, callable by service_role only.

create or replace function public.admin_delete_practice(p_practice_id uuid, p_execute boolean default false)
returns jsonb language plpgsql security definer set search_path = public, storage as $$
declare
  v_counts jsonb;
  v_objects jsonb;
  v_members uuid[];
  v_users jsonb;
begin
  if not exists (select 1 from practices where id = p_practice_id) then
    raise exception 'practice % not found', p_practice_id;
  end if;

  v_counts := jsonb_build_object(
    'members',        (select count(*) from practice_members where practice_id = p_practice_id),
    'patients',       (select count(*) from patients where practice_id = p_practice_id),
    'consultations',  (select count(*) from consultations where practice_id = p_practice_id),
    'dossiers',       (select count(*) from dossiers where practice_id = p_practice_id),
    'factures',       (select count(*) from factures where practice_id = p_practice_id),
    'ordonnances',    (select count(*) from ordonnances where practice_id = p_practice_id),
    'appointments',   (select count(*) from appointments where practice_id = p_practice_id),
    'actes',          (select count(*) from actes where practice_id = p_practice_id),
    'support_tickets',(select count(*) from support_tickets where practice_id = p_practice_id),
    'invoices',       (select count(*) from subscription_invoices where practice_id = p_practice_id)
  );

  -- Files: everything under "<practice_id>/" + support attachments.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name)), '[]'::jsonb) into v_objects
  from storage.objects o
  where (o.bucket_id in ('shop-assets', 'support-attachments') and o.name like p_practice_id::text || '/%')
     or (o.bucket_id = 'support-attachments' and o.name in (
          select a.path from support_attachments a join support_messages m on m.id = a.message_id
          join support_tickets t on t.id = m.ticket_id where t.practice_id = p_practice_id));
  v_counts := v_counts || jsonb_build_object('files', jsonb_array_length(v_objects));

  select coalesce(array_agg(user_id), '{}') into v_members
  from practice_members where practice_id = p_practice_id and user_id is not null;

  if p_execute then
    delete from factures where practice_id = p_practice_id;          -- facture_items cascade
    delete from appointments where practice_id = p_practice_id;
    -- tooth_chart's delete trigger writes tooth_history: clear the chart while the
    -- patients still exist, then its history, then the patients.
    delete from tooth_chart where practice_id = p_practice_id;
    delete from tooth_history where practice_id = p_practice_id;
    delete from patients where practice_id = p_practice_id;          -- consultations, dossiers (acomptes), ordonnances, tooth_plan cascade
    delete from traitements where practice_id = p_practice_id;       -- traitement_actes cascade
    delete from supplier_orders where practice_id = p_practice_id;   -- items cascade
    delete from actes where practice_id = p_practice_id;
    delete from treatment_attributes where practice_id = p_practice_id;
    delete from practices where id = p_practice_id;                  -- everything else cascades
  end if;

  -- Accounts that belong to no other cabinet can be deleted by the app.
  select coalesce(jsonb_agg(u), '[]'::jsonb) into v_users
  from unnest(v_members) u
  where not exists (select 1 from practice_members m where m.user_id = u and m.practice_id <> p_practice_id);

  return jsonb_build_object('counts', v_counts, 'objects', v_objects, 'users', v_users, 'executed', p_execute);
end $$;

revoke all on function public.admin_delete_practice(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_delete_practice(uuid, boolean) to service_role;

-- ── Archive before deletion ──────────────────────────────────────────────────
-- admin_practice_snapshot(p) → every row the practice owns, as JSON (all tables
-- with a practice_id + their child tables + the practice row + the members'
-- auth accounts). The app writes it to the private "archives" bucket, together
-- with a copy of the practice's files, BEFORE admin_delete_practice runs.
create or replace function public.admin_practice_snapshot(p_practice_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tbl text;
  v_rows jsonb;
  v_tables jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from practices where id = p_practice_id) then
    raise exception 'practice % not found', p_practice_id;
  end if;
  v_tables := jsonb_build_object('practices', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.practices x where x.id = p_practice_id));
  for v_tbl in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'practice_id' order by 1
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.practice_id = $1', v_tbl) into v_rows using p_practice_id;
    v_tables := v_tables || jsonb_build_object(v_tbl, v_rows);
  end loop;
  v_tables := v_tables || jsonb_build_object('facture_items', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.facture_items x where facture_id in (select id from factures where practice_id = p_practice_id)));
  v_tables := v_tables || jsonb_build_object('ordonnance_lignes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.ordonnance_lignes x where ordonnance_id in (select id from ordonnances where practice_id = p_practice_id)));
  v_tables := v_tables || jsonb_build_object('supplier_order_items', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.supplier_order_items x where supplier_order_id in (select id from supplier_orders where practice_id = p_practice_id)));
  v_tables := v_tables || jsonb_build_object('traitement_actes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.traitement_actes x where traitement_id in (select id from traitements where practice_id = p_practice_id)));
  v_tables := v_tables || jsonb_build_object('treatment_suppliers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.treatment_suppliers x where treatment_id in (select id from actes where practice_id = p_practice_id)));
  v_tables := v_tables || jsonb_build_object('support_messages', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.support_messages x where ticket_id in (select id from support_tickets where practice_id = p_practice_id)));
  v_tables := v_tables || jsonb_build_object('support_attachments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.support_attachments x where message_id in (select m.id from support_messages m join support_tickets t on t.id = m.ticket_id where t.practice_id = p_practice_id)));
  return jsonb_build_object(
    'format', 'practice-archive/1',
    'practice_id', p_practice_id,
    'exported_at', now(),
    'tables', v_tables,
    'auth_users', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
                     'email_confirmed_at', u.email_confirmed_at, 'user_metadata', u.raw_user_meta_data)), '[]'::jsonb)
                   from auth.users u where u.id in (select user_id from practice_members where practice_id = p_practice_id))
  );
end $$;

revoke all on function public.admin_practice_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.admin_practice_snapshot(uuid) to service_role;

-- Private bucket for the archives (no policies → service role only).
insert into storage.buckets (id, name, public) values ('archives', 'archives', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

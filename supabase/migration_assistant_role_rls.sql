-- Role-based write enforcement (RLS) — DentiCare.
--
-- Assistants (front-desk) may only CREATE/EDIT patients, dossiers and
-- rendez-vous. Every other table is read-as-before but write-blocked for them.
-- The UI already hides these; this makes it tamper-proof at the database.
--
-- Mechanism: additive AS RESTRICTIVE policies for INSERT/UPDATE/DELETE only.
-- Restrictive policies are AND-ed with the existing permissive practice-scope
-- policies, so nothing existing is dropped and SELECT is left untouched.
-- Applied to role `authenticated`; the service_role (portal, admin, /api/members)
-- bypasses RLS and is unaffected.

-- 1. Role lookup helper — mirrors current_practice_id().
create or replace function public.current_member_role()
  returns text
  language sql
  stable
  security definer
as $$ select role from public.practice_members where user_id = auth.uid() limit 1 $$;

-- 2. Block assistant writes on every table outside their allowed set
--    (patients, dossiers, appointments are intentionally absent below).
do $$
declare
  t text;
  restricted text[] := array[
    'acomptes', 'actes', 'consultations', 'facture_items', 'factures',
    'medicaments', 'ordonnance_lignes', 'ordonnances', 'praticiens',
    'supplier_order_items', 'supplier_orders', 'suppliers', 'tooth_chart',
    'traitement_actes', 'traitements', 'treatment_attributes', 'treatment_suppliers'
  ];
begin
  foreach t in array restricted loop
    execute format('drop policy if exists %I on public.%I', 'assistants cannot insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated '
      'with check (current_member_role() <> ''assistant'')',
      'assistants cannot insert', t);

    execute format('drop policy if exists %I on public.%I', 'assistants cannot update', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated '
      'using (current_member_role() <> ''assistant'') '
      'with check (current_member_role() <> ''assistant'')',
      'assistants cannot update', t);

    execute format('drop policy if exists %I on public.%I', 'assistants cannot delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated '
      'using (current_member_role() <> ''assistant'')',
      'assistants cannot delete', t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Acte scope (whole mouth vs specific teeth) + per-line teeth on facture_items.
-- Applied live (isunbvkbhnqpdtdggipa) on 2026-09-06.

alter table public.actes
  add column if not exists scope text not null default 'mouth'
    check (scope in ('mouth','tooth'));

alter table public.facture_items
  add column if not exists teeth text[];

update public.actes set scope = 'tooth'
where scope = 'mouth' and (
     name ilike '%obturation%' or name ilike '%extraction%'
  or name ilike '%couronne%'   or name ilike '%dévitalisation%' or name ilike '%devitalisation%'
  or name ilike '%implant%'    or name ilike '%carie%' or name ilike '%bridge%'
);

notify pgrst, 'reload schema';

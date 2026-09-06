-- Explicit "result on the tooth" per acte (drives odontogram updates when billed).
-- Applied live (isunbvkbhnqpdtdggipa) on 2026-09-07.

alter table public.actes
  add column if not exists tooth_status text
    check (tooth_status is null or tooth_status in
      ('carie','obturee','couronne','a_traiter','prothese','bridge','implant','absente'));

-- Seed from category so existing tooth-scoped actes keep updating the odontogram.
update public.actes set tooth_status = case category
  when 'obturation' then 'obturee'
  when 'extraction' then 'absente'
  when 'couronne'   then 'couronne'
  when 'implant'    then 'implant'
  when 'prothese'   then 'prothese'
end
where scope = 'tooth' and tooth_status is null
  and category in ('obturation','extraction','couronne','implant','prothese');

notify pgrst, 'reload schema';

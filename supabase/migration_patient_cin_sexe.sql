-- Patient CIN + Sexe, needed to autofill CNOPS / CNSS feuille de soins.
alter table public.patients add column if not exists cin  text;
alter table public.patients add column if not exists sexe text;  -- 'M' | 'F'

notify pgrst, 'reload schema';

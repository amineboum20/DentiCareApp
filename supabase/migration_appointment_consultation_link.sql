-- Link a rendez-vous to the visite (consultation) it resulted in.
-- A RDV is NOT a visite: it is a future scheduled slot. Once its time has
-- passed and it is marked "Terminé", it is linked to an existing visite or to a
-- newly created one. One RDV -> at most one visite.
alter table public.appointments
  add column if not exists consultation_id uuid references public.consultations(id) on delete set null;

create index if not exists idx_appointments_consultation_id
  on public.appointments(consultation_id);

notify pgrst, 'reload schema';

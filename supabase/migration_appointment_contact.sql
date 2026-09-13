-- A RDV can be booked for someone who is not a patient yet (a phone booking
-- that may cancel or no-show). Store a lightweight contact on the appointment
-- instead of creating a patient record; it can be promoted to a real patient
-- when they show up. All nullable; used only when patient_id is null.
alter table public.appointments
  add column if not exists contact_first_name text,
  add column if not exists contact_last_name text,
  add column if not exists contact_phone text;

notify pgrst, 'reload schema';

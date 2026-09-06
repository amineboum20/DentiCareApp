-- shop-assets: public storage bucket for practice logos.
-- Uploaded from Settings as "<practice_id>/logo.<ext>"; referenced by
-- practices.logo_url and drawn on generated PDFs (facture/devis, ordonnance,
-- plan de traitement, fiche patient).
-- Applied to the live DB (isunbvkbhnqpdtdggipa) on 2026-09-06.

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do update set public = true;

-- Authenticated users manage objects only inside their own practice folder.
drop policy if exists "shop-assets: manage own practice folder" on storage.objects;
create policy "shop-assets: manage own practice folder"
on storage.objects for all to authenticated
using (
  bucket_id = 'shop-assets'
  and (storage.foldername(name))[1] in (
    select practice_id::text from public.practice_members where user_id = auth.uid()
  )
)
with check (
  bucket_id = 'shop-assets'
  and (storage.foldername(name))[1] in (
    select practice_id::text from public.practice_members where user_id = auth.uid()
  )
);

-- Public read (bucket is public; explicit select policy for API reads).
drop policy if exists "shop-assets: public read" on storage.objects;
create policy "shop-assets: public read"
on storage.objects for select to public
using (bucket_id = 'shop-assets');

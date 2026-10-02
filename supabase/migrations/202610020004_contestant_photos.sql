begin;
alter table public.contestants add column if not exists photo_path text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contestant-photos', 'contestant-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "contestant photos admin insert" on storage.objects;
create policy "contestant photos admin insert" on storage.objects for insert to authenticated
with check (bucket_id = 'contestant-photos' and public.is_admin());
drop policy if exists "contestant photos admin delete" on storage.objects;
create policy "contestant photos admin delete" on storage.objects for delete to authenticated
using (bucket_id = 'contestant-photos' and public.is_admin());
drop policy if exists "contestant photos authorized read" on storage.objects;
create policy "contestant photos authorized read" on storage.objects for select to authenticated
using (bucket_id = 'contestant-photos' and (public.is_admin() or exists (
  select 1 from public.event_contestants ec
  where ec.contestant_id::text = (storage.foldername(name))[1] and public.is_assigned(ec.event_id)
)));
commit;

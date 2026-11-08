-- Conserver le PDF d'origine pour que l'IA puisse LIRE images, tableaux et flèches
alter table public.courses add column if not exists file_path text;

insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do nothing;

create policy "course-files: lecture par le propriétaire" on storage.objects
  for select to authenticated
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "course-files: dépôt par le propriétaire" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "course-files: suppression par le propriétaire" on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);

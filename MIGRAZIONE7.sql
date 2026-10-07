-- MIGRAZIONE7: bucket media notizie
insert into storage.buckets (id, name, public) values ('news-media','news-media', true)
on conflict (id) do nothing;

drop policy if exists "news read" on storage.objects;
create policy "news read" on storage.objects for select using (bucket_id = 'news-media');
drop policy if exists "news upload" on storage.objects;
create policy "news upload" on storage.objects for insert to authenticated with check (bucket_id = 'news-media');
drop policy if exists "news update" on storage.objects;
create policy "news update" on storage.objects for update to authenticated using (bucket_id = 'news-media');
drop policy if exists "news delete" on storage.objects;
create policy "news delete" on storage.objects for delete to authenticated using (bucket_id = 'news-media');

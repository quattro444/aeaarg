-- MIGRAZIONE4: super-admin + moderatori + loghi squadre
-- Esegui dopo MIGRAZIONE3

-- 1. staff = admin o moderator (per approvare risultati / news future senza dare pieni poteri)
create or replace function public.is_staff()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator'));
$$;
grant execute on function public.is_staff() to anon, authenticated;

-- is_admin resta solo admin (gestione squadre/ruoli). Super-admin è admin via ruolo + check email frontend.
-- Permetti a staff di gestire proposte e calendario, solo admin squadre/campionati:
drop policy if exists "mp admin write" on public.match_proposals;
create policy "mp staff write" on public.match_proposals for update to authenticated using (public.is_staff());
drop policy if exists "mp admin delete" on public.match_proposals;
create policy "mp staff delete" on public.match_proposals for delete to authenticated using (public.is_staff());
drop policy if exists "fix admin write" on public.fixtures;
create policy "fix staff write" on public.fixtures for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- 2. Ruoli: solo admin può cambiare ruolo altrui (il frontend mostra la sezione solo al super-admin,
-- ma il DB deve comunque impedirlo ai furbi: policy già "update own or admin", ok. Rafforziamo:)
-- niente cambio ruolo a se stessi per non restare senza admin? lo gestiamo via UI con confirm.

-- 3. Storage loghi squadre (bucket pubblico team-logos)
insert into storage.buckets (id, name, public) values ('team-logos','team-logos', true)
on conflict (id) do nothing;

drop policy if exists "logos read" on storage.objects;
create policy "logos read" on storage.objects for select using (bucket_id = 'team-logos');
drop policy if exists "logos auth upload" on storage.objects;
create policy "logos auth upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'team-logos');
drop policy if exists "logos auth update" on storage.objects;
create policy "logos auth update" on storage.objects for update to authenticated
  using (bucket_id = 'team-logos');
drop policy if exists "logos auth delete" on storage.objects;
create policy "logos auth delete" on storage.objects for delete to authenticated
  using (bucket_id = 'team-logos');

-- teams.logo_url esiste già, ok.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

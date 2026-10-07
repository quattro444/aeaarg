-- MIGRAZIONE5: owner può gestire logo+descrizione propria squadra
-- Esegui dopo MIGRAZIONE4. Causa del bug foto: policy teams solo admin.

alter table public.teams add column if not exists description text;

-- policy: admin tutto (esistente) + owner può aggiornare SOLO sue colonne logo/desc
drop policy if exists "teams owner update" on public.teams;
create policy "teams owner update" on public.teams for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

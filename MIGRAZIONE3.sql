-- MIGRAZIONE3: username/bio + calendario fixtures
-- Esegui in Supabase > SQL Editor dopo MIGRAZIONE2

-- 1. username + bio (per notizie future: autore = profiles.id, username solo display)
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text;
-- username univoco case-insensitive (solo se non null)
do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'profiles_username_unique') then
    create unique index profiles_username_unique on public.profiles (lower(username)) where username is not null;
  end if;
end $$;

-- 2. fixtures = calendario generato (separato dai risultati: pro=flessibile, contro=altra tabella ma necessaria)
-- perché separato? scheduled non ha punteggi (NOT NULL su proposals), e le news future linkeranno fixture_id.
create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  round_no int not null default 1,
  home_id uuid references public.teams(id) on delete cascade,
  away_id uuid references public.teams(id) on delete cascade,
  scheduled_at timestamptz,
  created_at timestamptz default now(),
  unique (championship_id, home_id, away_id, round_no)
);
alter table public.fixtures enable row level security;
drop policy if exists "fix read" on public.fixtures;
create policy "fix read" on public.fixtures for select using (true);
drop policy if exists "fix admin write" on public.fixtures;
create policy "fix admin write" on public.fixtures for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3. proposals: lega a fixture + orario proposto (b serve ad a: senza fixture non sai quale partita è)
alter table public.match_proposals add column if not exists fixture_id uuid references public.fixtures(id) on delete set null;
alter table public.match_proposals add column if not exists scheduled_at timestamptz;

grant execute on function public.is_admin() to anon, authenticated;

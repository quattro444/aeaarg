-- MIGRAZIONE2: avatar + owner squadre + proposte risultati + fix permessi
-- Esegui in Supabase > SQL Editor

-- 0. fix permessi funzione (risolve "permission denied for function is_admin")
grant execute on function public.is_admin() to anon, authenticated;

-- 1. profili: nome + avatar + email sincronizzata
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role, email, display_name, avatar_url)
  values (
    new.id, 'user', new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', null),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null)
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- riempi email mancanti
update public.profiles p set email = u.email
from auth.users u where p.id = u.id and (p.email is null or p.email = '');

-- profili leggibili da tutti gli autenticati (serve per mostrare proprietari)
drop policy if exists "read own or admin" on public.profiles;
create policy "profiles read auth" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles read anon" on public.profiles;
-- anon non vede emails? per semplicità niente select anon su profiles (navbar usa sessione)
-- update: solo proprio o admin
drop policy if exists "insert own" on public.profiles;
create policy "insert own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "update own or admin" on public.profiles;
create policy "update own or admin" on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- 2. squadre: proprietario
alter table public.teams add column if not exists owner_id uuid references public.profiles(id) on delete set null;
-- teams leggibili da tutti, scrittura admin, ma owner può vedere? admin gestisce owner
-- (policy esistenti restano, basta grant)

-- 3. proposte risultati (anti-imbroglio)
create table if not exists public.match_proposals (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid references public.championships(id) on delete cascade,
  team_a_id uuid references public.teams(id) on delete cascade,
  team_b_id uuid references public.teams(id) on delete cascade,
  score_a int not null check (score_a >= 0),
  score_b int not null check (score_b >= 0),
  proposed_by uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);
alter table public.match_proposals enable row level security;
drop policy if exists "mp read" on public.match_proposals;
create policy "mp read" on public.match_proposals for select using (true);
drop policy if exists "mp insert own" on public.match_proposals;
create policy "mp insert own" on public.match_proposals for insert to authenticated
  with check (auth.uid() = proposed_by);
drop policy if exists "mp admin write" on public.match_proposals;
create policy "mp admin write" on public.match_proposals for update to authenticated
  using (public.is_admin());
drop policy if exists "mp admin delete" on public.match_proposals;
create policy "mp admin delete" on public.match_proposals for delete to authenticated
  using (public.is_admin());
grant execute on function public.is_admin() to anon, authenticated;

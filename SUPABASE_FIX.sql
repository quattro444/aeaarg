-- FIX v2: compatibile con profiles SENZA colonna email (id + role)
-- Esegui tutto in Supabase > SQL Editor > Run

-- 0. (facoltativo ma consigliato) aggiungi email se vuoi tenerla per dopo
-- se non vuoi, puoi saltarlo: il resto funziona lo stesso
alter table public.profiles add column if not exists email text;

-- 1. Funzione admin sicura
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 2. Trigger: crea profilo automatico a ogni signup (solo id+role, niente email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. RLS
alter table public.profiles enable row level security;
drop policy if exists "read own or admin" on public.profiles;
create policy "read own or admin" on public.profiles for select
  using (auth.uid() = id or public.is_admin());
drop policy if exists "insert own" on public.profiles;
create policy "insert own" on public.profiles for insert
  with check (auth.uid() = id);
drop policy if exists "update own or admin" on public.profiles;
create policy "update own or admin" on public.profiles for update
  using (auth.uid() = id or public.is_admin());

alter table public.teams enable row level security;
drop policy if exists "teams read" on public.teams;
create policy "teams read" on public.teams for select using (true);
drop policy if exists "teams admin write" on public.teams;
create policy "teams admin write" on public.teams for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.championships enable row level security;
drop policy if exists "champs read" on public.championships;
create policy "champs read" on public.championships for select using (true);
drop policy if exists "champs admin write" on public.championships;
create policy "champs admin write" on public.championships for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.championship_teams enable row level security;
drop policy if exists "ct read" on public.championship_teams;
create policy "ct read" on public.championship_teams for select using (true);
drop policy if exists "ct admin write" on public.championship_teams;
create policy "ct admin write" on public.championship_teams for all
  using (public.is_admin()) with check (public.is_admin());

-- 4. Crea profili mancanti per utenti già registrati
insert into public.profiles (id, role)
select id, 'user' from auth.users
on conflict (id) do nothing;

-- 5. PROMUOVI TE AD ADMIN - usa questa (funziona senza colonna email):
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'capostrada1@gmail.com');

-- verifica:
select p.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.id;

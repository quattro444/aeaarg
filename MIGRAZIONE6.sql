-- MIGRAZIONE6: notizie stile X + views uniche + follow + ban/timeout
-- Esegui dopo MIGRAZIONE5

-- 1. colonne moderazione profili
alter table public.profiles add column if not exists news_banned boolean default false;
alter table public.profiles add column if not exists news_muted_until timestamptz;

-- può postare? (b serve ad a: senza, i bannati bypassano dal client)
create or replace function public.can_post_news()
returns boolean language sql security definer stable as $$
  select not exists (
    select 1 from public.profiles
    where id = auth.uid()
    and (news_banned = true or (news_muted_until is not null and news_muted_until > now()))
  );
$$;
grant execute on function public.can_post_news() to authenticated;

-- 2. posts = notizie
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  image_url text,
  video_url text,
  link_url text,
  visibility text not null default 'public' check (visibility in ('public','followers','hidden')),
  created_at timestamptz default now()
);
alter table public.posts enable row level security;
drop policy if exists "posts read" on public.posts;
-- lettura: public + followers (il filtro followers lo fa il client; hidden solo staff/autore)
create policy "posts read" on public.posts for select using (
  visibility = 'public'
  or auth.uid() = author_id
  or public.is_staff()
  or visibility = 'followers'
);
drop policy if exists "posts insert" on public.posts;
create policy "posts insert" on public.posts for insert to authenticated
  with check (auth.uid() = author_id and public.can_post_news());
drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update to authenticated
  using (auth.uid() = author_id or public.is_staff());
drop policy if exists "posts delete" on public.posts;
create policy "posts delete" on public.posts for delete to authenticated
  using (auth.uid() = author_id or public.is_staff());

-- 3. views REALISTICHE: 1 riga = 1 utente ha visto 1 post. Unique impedisce il farming.
create table if not exists public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz default now(),
  primary key (post_id, viewer_id)
);
alter table public.post_views enable row level security;
drop policy if exists "views read" on public.post_views;
create policy "views read" on public.post_views for select using (true);
drop policy if exists "views insert own" on public.post_views;
-- sicurezza: puoi inserire SOLO la tua riga, una sola volta (unique fa il resto)
create policy "views insert own" on public.post_views for insert to authenticated
  with check (auth.uid() = viewer_id);

-- 4. follow: contatori + feed followers
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;
drop policy if exists "follows read" on public.follows;
create policy "follows read" on public.follows for select using (true);
drop policy if exists "follows write own" on public.follows;
create policy "follows write own" on public.follows for insert to authenticated
  with check (auth.uid() = follower_id);
drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows for delete to authenticated
  using (auth.uid() = follower_id);

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

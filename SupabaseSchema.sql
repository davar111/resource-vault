create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  ai_profile jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text null,
  note text null,
  tags text[] not null default '{}',
  type text null,
  source text null,
  favorite boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_onboarding_completed_at_idx on public.users (onboarding_completed_at desc);
create index if not exists links_user_id_idx on public.links (user_id);
create index if not exists links_tags_gin_idx on public.links using gin (tags);
create index if not exists links_created_at_idx on public.links (created_at desc);

alter table public.users enable row level security;
alter table public.links enable row level security;

drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_update_own" on public.users;
create policy "users_select_own" on public.users for select to authenticated using (id = auth.uid());
create policy "users_insert_own" on public.users for insert to authenticated with check (id = auth.uid());
create policy "users_update_own" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "links_select_own" on public.links;
drop policy if exists "links_insert_own" on public.links;
drop policy if exists "links_update_own" on public.links;
drop policy if exists "links_delete_own" on public.links;
create policy "links_select_own" on public.links for select to authenticated using (user_id = auth.uid());
create policy "links_insert_own" on public.links for insert to authenticated with check (user_id = auth.uid());
create policy "links_update_own" on public.links for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "links_delete_own" on public.links for delete to authenticated using (user_id = auth.uid());

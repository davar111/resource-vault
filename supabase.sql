create extension if not exists pgcrypto;

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  title text null,
  note text null,
  tags text[] not null default '{}',
  type text null,
  source text null,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists links_user_id_idx on public.links (user_id);
create index if not exists links_created_at_idx on public.links (created_at desc);
create index if not exists links_favorite_idx on public.links (favorite);
create index if not exists links_source_idx on public.links (source);
create index if not exists links_type_idx on public.links (type);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text null,
  created_at timestamptz not null default now()
);

create index if not exists collections_user_id_idx on public.collections (user_id);
create index if not exists collections_created_at_idx on public.collections (created_at desc);

create table if not exists public.link_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  link_id uuid not null references public.links(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (link_id, collection_id)
);

create index if not exists link_collections_user_id_idx on public.link_collections (user_id);
create index if not exists link_collections_link_id_idx on public.link_collections (link_id);
create index if not exists link_collections_collection_id_idx on public.link_collections (collection_id);

create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  filter jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_filters_user_id_idx on public.saved_filters (user_id);
create index if not exists saved_filters_created_at_idx on public.saved_filters (created_at desc);

alter table public.links enable row level security;
alter table public.collections enable row level security;
alter table public.link_collections enable row level security;
alter table public.saved_filters enable row level security;

drop policy if exists "links_select_own" on public.links;
drop policy if exists "links_insert_own" on public.links;
drop policy if exists "links_update_own" on public.links;
drop policy if exists "links_delete_own" on public.links;
create policy "links_select_own" on public.links for select to authenticated using (user_id = auth.uid());
create policy "links_insert_own" on public.links for insert to authenticated with check (user_id = auth.uid());
create policy "links_update_own" on public.links for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "links_delete_own" on public.links for delete to authenticated using (user_id = auth.uid());

drop policy if exists "collections_select_own" on public.collections;
drop policy if exists "collections_insert_own" on public.collections;
drop policy if exists "collections_update_own" on public.collections;
drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_select_own" on public.collections for select to authenticated using (user_id = auth.uid());
create policy "collections_insert_own" on public.collections for insert to authenticated with check (user_id = auth.uid());
create policy "collections_update_own" on public.collections for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "collections_delete_own" on public.collections for delete to authenticated using (user_id = auth.uid());

drop policy if exists "link_collections_select_own" on public.link_collections;
drop policy if exists "link_collections_insert_own" on public.link_collections;
drop policy if exists "link_collections_update_own" on public.link_collections;
drop policy if exists "link_collections_delete_own" on public.link_collections;
create policy "link_collections_select_own" on public.link_collections for select to authenticated using (user_id = auth.uid());
create policy "link_collections_insert_own" on public.link_collections for insert to authenticated with check (user_id = auth.uid());
create policy "link_collections_update_own" on public.link_collections for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "link_collections_delete_own" on public.link_collections for delete to authenticated using (user_id = auth.uid());

drop policy if exists "saved_filters_select_own" on public.saved_filters;
drop policy if exists "saved_filters_insert_own" on public.saved_filters;
drop policy if exists "saved_filters_update_own" on public.saved_filters;
drop policy if exists "saved_filters_delete_own" on public.saved_filters;
create policy "saved_filters_select_own" on public.saved_filters for select to authenticated using (user_id = auth.uid());
create policy "saved_filters_insert_own" on public.saved_filters for insert to authenticated with check (user_id = auth.uid());
create policy "saved_filters_update_own" on public.saved_filters for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_filters_delete_own" on public.saved_filters for delete to authenticated using (user_id = auth.uid());

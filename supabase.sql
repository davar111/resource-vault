create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  ai_profile jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_onboarding_completed_at_idx on public.users (onboarding_completed_at desc);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  preview_image text null,
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
alter table public.links add column if not exists is_hidden boolean not null default false;
alter table public.links add column if not exists preview_image text;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'links_url_http_check'
      and conrelid = 'public.links'::regclass
  ) then
    alter table public.links
      add constraint links_url_http_check
      check (url ~* '^https?://');
  end if;
end
$$;

create index if not exists links_user_id_idx on public.links (user_id);
create index if not exists links_created_at_idx on public.links (created_at desc);
create index if not exists links_favorite_idx on public.links (favorite);
create index if not exists links_is_hidden_idx on public.links (is_hidden);
create index if not exists links_source_idx on public.links (source);
create index if not exists links_type_idx on public.links (type);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.collections add column if not exists is_shared boolean not null default false;

create index if not exists collections_user_id_idx on public.collections (user_id);
create index if not exists collections_created_at_idx on public.collections (created_at desc);
create index if not exists collections_is_shared_idx on public.collections (is_shared);

create table if not exists public.collection_invites (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  owner_user_id uuid not null,
  invitee_email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists collection_invites_unique_email_per_collection_idx
  on public.collection_invites (collection_id, lower(invitee_email));
create index if not exists collection_invites_owner_user_id_idx on public.collection_invites (owner_user_id);
create index if not exists collection_invites_invitee_email_idx on public.collection_invites (lower(invitee_email));

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

create or replace function public.replace_link_collections(
  p_link_id uuid,
  p_collection_ids uuid[]
)
returns void
language plpgsql
security invoker
as $$
declare
  v_ids uuid[];
begin
  v_ids := coalesce(p_collection_ids, array[]::uuid[]);

  delete from public.link_collections
  where link_id = p_link_id;

  if array_length(v_ids, 1) is null then
    return;
  end if;

  insert into public.link_collections (user_id, link_id, collection_id)
  select auth.uid(), p_link_id, x
  from unnest(v_ids) as x
  where x is not null
  on conflict (link_id, collection_id) do nothing;
end;
$$;

create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  filter jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_filters_user_id_idx on public.saved_filters (user_id);
create index if not exists saved_filters_created_at_idx on public.saved_filters (created_at desc);

create table if not exists public.user_space_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_done integer not null default 0 check (daily_done >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_action_date date null,
  last_streak_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_space_stats_updated_at_idx on public.user_space_stats (updated_at desc);

alter table public.users enable row level security;
alter table public.links enable row level security;
alter table public.collections enable row level security;
alter table public.link_collections enable row level security;
alter table public.saved_filters enable row level security;
alter table public.user_space_stats enable row level security;
alter table public.collection_invites enable row level security;

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
create policy "links_select_own" on public.links for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.link_collections lc
    join public.collections c on c.id = lc.collection_id
    where lc.link_id = links.id
      and c.is_shared = true
      and (
        c.user_id = auth.uid()
        or exists (
          select 1
          from public.collection_invites ci
          where ci.collection_id = c.id
            and lower(ci.invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
      )
  )
);
create policy "links_insert_own" on public.links for insert to authenticated with check (user_id = auth.uid());
create policy "links_update_own" on public.links for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "links_delete_own" on public.links for delete to authenticated using (user_id = auth.uid());

drop policy if exists "collections_select_own" on public.collections;
drop policy if exists "collections_insert_own" on public.collections;
drop policy if exists "collections_update_own" on public.collections;
drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_select_own" on public.collections for select to authenticated using (
  user_id = auth.uid()
  or (
    is_shared = true
    and exists (
      select 1
      from public.collection_invites ci
      where ci.collection_id = collections.id
        and lower(ci.invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
);
create policy "collections_insert_own" on public.collections for insert to authenticated with check (user_id = auth.uid());
create policy "collections_update_own" on public.collections for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "collections_delete_own" on public.collections for delete to authenticated using (user_id = auth.uid());

drop policy if exists "link_collections_select_own" on public.link_collections;
drop policy if exists "link_collections_insert_own" on public.link_collections;
drop policy if exists "link_collections_update_own" on public.link_collections;
drop policy if exists "link_collections_delete_own" on public.link_collections;
create policy "link_collections_select_own" on public.link_collections for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.collections c
    where c.id = link_collections.collection_id
      and c.is_shared = true
      and (
        c.user_id = auth.uid()
        or exists (
          select 1
          from public.collection_invites ci
          where ci.collection_id = c.id
            and lower(ci.invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
      )
  )
);
create policy "link_collections_insert_own" on public.link_collections for insert to authenticated with check (
  user_id = auth.uid()
  and (
    exists (select 1 from public.collections c where c.id = link_collections.collection_id and c.user_id = auth.uid())
    or exists (
      select 1
      from public.collections c
      join public.collection_invites ci on ci.collection_id = c.id
      where c.id = link_collections.collection_id
        and c.is_shared = true
        and lower(ci.invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
);
create policy "link_collections_update_own" on public.link_collections for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "link_collections_delete_own" on public.link_collections for delete to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.collections c where c.id = link_collections.collection_id and c.user_id = auth.uid())
);

drop policy if exists "saved_filters_select_own" on public.saved_filters;
drop policy if exists "saved_filters_insert_own" on public.saved_filters;
drop policy if exists "saved_filters_update_own" on public.saved_filters;
drop policy if exists "saved_filters_delete_own" on public.saved_filters;
create policy "saved_filters_select_own" on public.saved_filters for select to authenticated using (user_id = auth.uid());
create policy "saved_filters_insert_own" on public.saved_filters for insert to authenticated with check (user_id = auth.uid());
create policy "saved_filters_update_own" on public.saved_filters for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_filters_delete_own" on public.saved_filters for delete to authenticated using (user_id = auth.uid());

drop policy if exists "user_space_stats_select_own" on public.user_space_stats;
drop policy if exists "user_space_stats_insert_own" on public.user_space_stats;
drop policy if exists "user_space_stats_update_own" on public.user_space_stats;
drop policy if exists "user_space_stats_delete_own" on public.user_space_stats;
create policy "user_space_stats_select_own" on public.user_space_stats for select to authenticated using (user_id = auth.uid());
create policy "user_space_stats_insert_own" on public.user_space_stats for insert to authenticated with check (user_id = auth.uid());
create policy "user_space_stats_update_own" on public.user_space_stats for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_space_stats_delete_own" on public.user_space_stats for delete to authenticated using (user_id = auth.uid());

drop policy if exists "collection_invites_select_own_or_received" on public.collection_invites;
drop policy if exists "collection_invites_insert_owner_only" on public.collection_invites;
drop policy if exists "collection_invites_delete_owner_only" on public.collection_invites;
create policy "collection_invites_select_own_or_received" on public.collection_invites for select to authenticated using (
  owner_user_id = auth.uid()
  or lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
);
create policy "collection_invites_insert_owner_only" on public.collection_invites for insert to authenticated with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.collections c
    where c.id = collection_invites.collection_id
      and c.user_id = auth.uid()
      and c.is_shared = true
  )
);
create policy "collection_invites_delete_owner_only" on public.collection_invites for delete to authenticated using (
  owner_user_id = auth.uid()
  or lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))
);

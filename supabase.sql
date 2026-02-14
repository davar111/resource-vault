create table if not exists public.vault_states (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.vault_states enable row level security;

drop policy if exists "anon can read vault states" on public.vault_states;
drop policy if exists "anon can write vault states" on public.vault_states;
drop policy if exists "anon can update vault states" on public.vault_states;
drop policy if exists "users can read own vault states" on public.vault_states;
drop policy if exists "users can insert own vault states" on public.vault_states;
drop policy if exists "users can update own vault states" on public.vault_states;

create policy "users can read own vault states"
on public.vault_states
for select
to authenticated
using (id = ('user_' || auth.uid()::text));

create policy "users can insert own vault states"
on public.vault_states
for insert
to authenticated
with check (id = ('user_' || auth.uid()::text));

create policy "users can update own vault states"
on public.vault_states
for update
to authenticated
using (id = ('user_' || auth.uid()::text))
with check (id = ('user_' || auth.uid()::text));

create table if not exists public.vault_states (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.vault_states enable row level security;

drop policy if exists "anon can read vault states" on public.vault_states;
create policy "anon can read vault states"
on public.vault_states
for select
to anon
using (true);

drop policy if exists "anon can write vault states" on public.vault_states;
create policy "anon can write vault states"
on public.vault_states
for insert
to anon
with check (true);

drop policy if exists "anon can update vault states" on public.vault_states;
create policy "anon can update vault states"
on public.vault_states
for update
to anon
using (true)
with check (true);

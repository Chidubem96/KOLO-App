-- ============================================================
--  KOLO — schema v4  (product events / analytics)
--  ADDITIVE. Run once after schema-v3.sql, in the SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,                       -- 'ask_kolo', 'txn_logged', 'circle_created', ...
  props jsonb not null default '{}',
  screen text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ev_name_created on events(name, created_at desc);
create index if not exists ev_user on events(user_id);
create index if not exists ev_created on events(created_at desc);

alter table events enable row level security;

-- a signed-in user writes events as themselves (user_id defaults to auth.uid())
-- and can read their own back. You read everything from the dashboard / SQL editor.
drop policy if exists "insert own events" on events;
create policy "insert own events" on events for insert
  with check (user_id = auth.uid());

drop policy if exists "read own events" on events;
create policy "read own events" on events for select
  using (user_id = auth.uid());

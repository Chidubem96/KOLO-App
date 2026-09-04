-- ============================================================
--  KOLO — schema v3  (in-app feedback)
--  ADDITIVE. Run once after schema-v2.sql, in the SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  screen text not null default '',          -- which tab/sheet they were on
  rating int,                                -- optional 1-5 quick sentiment
  message text not null default '',
  app_version text not null default 'v2',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists fb_created on feedback(created_at desc);
create index if not exists fb_user on feedback(user_id);

alter table feedback enable row level security;

-- a signed-in user may file feedback as themselves, and read their own back.
-- you (the project owner) read everything from the Supabase dashboard / SQL editor.
drop policy if exists "insert own feedback" on feedback;
create policy "insert own feedback" on feedback for insert
  with check (user_id = auth.uid());

drop policy if exists "read own feedback" on feedback;
create policy "read own feedback" on feedback for select
  using (user_id = auth.uid());

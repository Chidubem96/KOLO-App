-- ============================================================
--  KOLO — database schema
--  Run once: Supabase dashboard -> SQL Editor -> New query -> paste -> Run
-- ============================================================

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  income_type text not null default 'salaried',   -- salaried | irregular | mixed
  income_amount numeric not null default 0,
  income_day int not null default 25,
  buffer_k numeric not null default 0.5,
  rent numeric,
  salary_day int,
  lang text not null default 'en',
  dismissed_sigs text[] not null default '{}',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- accounts ----------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance numeric not null default 0,
  liquid boolean not null default true,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists accounts_user on accounts(user_id);

-- ---------- transactions ----------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  amount numeric not null,
  category text,
  note text not null default '',
  person boolean not null default false,
  source text not null default 'manual',
  auto boolean not null default false,
  period text,                       -- idempotency key for recurring auto-post
  created_at timestamptz not null default now()
);
create index if not exists tx_user on transactions(user_id);
create index if not exists tx_period on transactions(user_id, period);

-- ---------- obligations ----------
create table if not exists obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null default 'bill',
  amount numeric not null,
  cadence text not null default 'monthly',
  anchor_day int not null default 1,
  active boolean not null default true,
  source text not null default 'manual',
  category text not null default 'rent',
  auto_post boolean not null default true,
  since date not null default current_date,
  sig text,
  created_at timestamptz not null default now()
);
create index if not exists obl_user on obligations(user_id);

-- ---------- goals ----------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target numeric not null,
  saved numeric not null default 0,
  deadline date not null,
  priority int not null default 2,
  paused boolean not null default false,
  contrib_log jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists goals_user on goals(user_id);

-- ---------- circles (shared) ----------
create table if not exists circles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  type text not null default 'rotating',
  cadence text not null default 'monthly',
  amount numeric not null,
  start_date date not null default current_date,
  anchor_day int not null default 1,
  grace_days int not null default 3,
  late_fee numeric not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slot int not null,
  auto_debit boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (circle_id, user_id),
  unique (circle_id, slot)
);
create index if not exists cm_circle on circle_members(circle_id);
create index if not exists cm_user on circle_members(user_id);

create table if not exists circle_contributions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle int not null,
  paid_on date not null default current_date,
  amount numeric not null,
  auto boolean not null default false,
  created_at timestamptz not null default now(),
  unique (circle_id, user_id, cycle)
);
create index if not exists cc_circle on circle_contributions(circle_id);

-- ---------- membership helper (avoids RLS recursion) ----------
create or replace function is_circle_member(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from circle_members where circle_id = cid and user_id = auth.uid());
$$;

-- ============================================================
--  Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table obligations enable row level security;
alter table goals enable row level security;
alter table circles enable row level security;
alter table circle_members enable row level security;
alter table circle_contributions enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own accounts" on accounts;
create policy "own accounts" on accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own transactions" on transactions;
create policy "own transactions" on transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own obligations" on obligations;
create policy "own obligations" on obligations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own goals" on goals;
create policy "own goals" on goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read circles youre in" on circles;
create policy "read circles youre in" on circles for select using (is_circle_member(id) or created_by = auth.uid());
drop policy if exists "create circles" on circles;
create policy "create circles" on circles for insert with check (created_by = auth.uid());
drop policy if exists "organiser updates circle" on circles;
create policy "organiser updates circle" on circles for update using (created_by = auth.uid());
drop policy if exists "organiser deletes circle" on circles;
create policy "organiser deletes circle" on circles for delete using (created_by = auth.uid());

drop policy if exists "read roster" on circle_members;
create policy "read roster" on circle_members for select using (is_circle_member(circle_id));
drop policy if exists "join self" on circle_members;
create policy "join self" on circle_members for insert with check (user_id = auth.uid());
drop policy if exists "update own membership" on circle_members;
create policy "update own membership" on circle_members for update using (user_id = auth.uid());
drop policy if exists "leave self" on circle_members;
create policy "leave self" on circle_members for delete using (user_id = auth.uid());

drop policy if exists "read contributions" on circle_contributions;
create policy "read contributions" on circle_contributions for select using (is_circle_member(circle_id));
drop policy if exists "record own contribution" on circle_contributions;
create policy "record own contribution" on circle_contributions for insert with check (user_id = auth.uid());
drop policy if exists "update own contribution" on circle_contributions;
create policy "update own contribution" on circle_contributions for update using (user_id = auth.uid());

-- ============================================================
--  RPCs
-- ============================================================
create or replace function create_circle(
  p_name text, p_type text, p_cadence text, p_amount numeric,
  p_anchor_day int, p_grace_days int, p_late_fee numeric,
  p_my_slot int, p_my_name text, p_auto_debit boolean
) returns text language plpgsql security definer set search_path = public as $$
declare new_id uuid; new_code text;
begin
  new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into circles(code, name, type, cadence, amount, anchor_day, grace_days, late_fee, created_by)
    values (new_code, p_name, p_type, p_cadence, p_amount, greatest(1, coalesce(p_anchor_day,1)),
            greatest(0, coalesce(p_grace_days,0)), greatest(0, coalesce(p_late_fee,0)), auth.uid())
    returning id into new_id;
  insert into circle_members(circle_id, user_id, name, slot, auto_debit)
    values (new_id, auth.uid(), coalesce(nullif(p_my_name,''),'You'),
            greatest(1, coalesce(p_my_slot,1)), coalesce(p_auto_debit, true));
  return new_code;
end;
$$;

create or replace function join_circle(p_code text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c circles%rowtype; next_slot int;
begin
  select * into c from circles where code = upper(trim(p_code));
  if not found then raise exception 'No circle with that code'; end if;
  if exists (select 1 from circle_members where circle_id = c.id and user_id = auth.uid()) then
    return c.id;
  end if;
  select coalesce(max(slot),0) + 1 into next_slot from circle_members where circle_id = c.id;
  insert into circle_members(circle_id, user_id, name, slot)
    values (c.id, auth.uid(), coalesce(nullif(p_name,''),'Member'), next_slot);
  return c.id;
end;
$$;

create or replace function peek_circle(p_code text)
returns table (name text, type text, cadence text, amount numeric, members int)
language sql security definer set search_path = public as $$
  select c.name, c.type, c.cadence, c.amount,
         (select count(*)::int from circle_members m where m.circle_id = c.id)
  from circles c where c.code = upper(trim(p_code));
$$;

grant execute on function create_circle(text, text, text, numeric, int, int, numeric, int, text, boolean) to authenticated;
grant execute on function join_circle(text, text) to authenticated;
grant execute on function peek_circle(text) to authenticated;
grant execute on function is_circle_member(uuid) to authenticated;

-- ---------- auto-create a profile row on signup ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, name)
    values (new.id, coalesce(new.raw_user_meta_data->>'name',''))
    on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
--  Realtime (safe to re-run)
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table circles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_contributions; exception when duplicate_object then null; end;
end $$;

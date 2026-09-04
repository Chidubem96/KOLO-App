-- ============================================================
--  KOLO — schema v2  (Discover, disputes, guarantee fund, Grow, identity)
--  ADDITIVE. Run once after schema.sql, in the SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- profiles: identity + a public-facing reliability score ----------
alter table profiles add column if not exists reliability_score int not null default 100;
alter table profiles add column if not exists bvn_verified boolean not null default false;
alter table profiles add column if not exists nin_verified boolean not null default false;
alter table profiles add column if not exists phone_verified boolean not null default false;
alter table profiles add column if not exists payout_account text;

-- ---------- circles: discover + guarantee + organiser ----------
alter table circles add column if not exists discoverable boolean not null default false;
alter table circles add column if not exists category text not null default 'General';
alter table circles add column if not exists reliability_floor int not null default 0;
alter table circles add column if not exists payout_order text not null default 'join';   -- join | random | need
alter table circles add column if not exists float_enabled boolean not null default false;
alter table circles add column if not exists guarantee_fund numeric not null default 0;
alter table circles add column if not exists organiser_stake numeric not null default 0;
alter table circles add column if not exists max_size int not null default 12;
alter table circles add column if not exists blurb text not null default '';
alter table circles add column if not exists org_label text not null default '';

-- ---------- directory: safe, public-readable member cards ----------
create table if not exists directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  reliability_score int not null default 100,
  cycles_completed int not null default 0,
  bvn_verified boolean not null default false,
  nin_verified boolean not null default false,
  phone_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------- join requests ----------
create table if not exists circle_join_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  score int not null default 100,
  message text not null default '',
  status text not null default 'pending',   -- pending | approved | declined
  created_at timestamptz not null default now(),
  unique (circle_id, user_id)
);
create index if not exists jr_circle on circle_join_requests(circle_id);
create index if not exists jr_user on circle_join_requests(user_id);

-- ---------- disputes ----------
create table if not exists circle_disputes (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  raised_by uuid not null references auth.users(id) on delete cascade,
  raised_by_name text not null default '',
  subject text not null default '',
  reason text not null default '',
  note text not null default '',
  status text not null default 'open',       -- open | resolved
  created_at timestamptz not null default now()
);
create index if not exists dsp_circle on circle_disputes(circle_id);

-- ---------- circle float votes ----------
create table if not exists circle_float_votes (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle int not null,
  vote text not null default 'in',           -- in | out
  created_at timestamptz not null default now(),
  unique (circle_id, user_id, cycle)
);
create index if not exists fv_circle on circle_float_votes(circle_id);

-- ---------- investments (simulated Grow positions) ----------
create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null,
  kind text not null default 'naira',        -- naira | dollar
  amount numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists inv_user on investments(user_id);

-- ============================================================
--  RLS
-- ============================================================
alter table directory enable row level security;
alter table circle_join_requests enable row level security;
alter table circle_disputes enable row level security;
alter table circle_float_votes enable row level security;
alter table investments enable row level security;

-- directory: everyone signed-in reads; you write only your own row
drop policy if exists "read directory" on directory;
create policy "read directory" on directory for select using (true);
drop policy if exists "write own directory" on directory;
create policy "write own directory" on directory for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- join requests: requester sees own; circle organiser sees all for their circle
drop policy if exists "jr read" on circle_join_requests;
create policy "jr read" on circle_join_requests for select using (
  user_id = auth.uid()
  or exists (select 1 from circles c where c.id = circle_id and c.created_by = auth.uid())
);
drop policy if exists "jr create own" on circle_join_requests;
create policy "jr create own" on circle_join_requests for insert with check (user_id = auth.uid());
drop policy if exists "jr organiser updates" on circle_join_requests;
create policy "jr organiser updates" on circle_join_requests for update using (
  exists (select 1 from circles c where c.id = circle_id and c.created_by = auth.uid())
);
drop policy if exists "jr delete own" on circle_join_requests;
create policy "jr delete own" on circle_join_requests for delete using (user_id = auth.uid());

-- disputes: circle members read + create; organiser updates
drop policy if exists "dsp read" on circle_disputes;
create policy "dsp read" on circle_disputes for select using (is_circle_member(circle_id));
drop policy if exists "dsp create" on circle_disputes;
create policy "dsp create" on circle_disputes for insert with check (
  raised_by = auth.uid() and is_circle_member(circle_id)
);
drop policy if exists "dsp organiser updates" on circle_disputes;
create policy "dsp organiser updates" on circle_disputes for update using (
  exists (select 1 from circles c where c.id = circle_id and c.created_by = auth.uid())
);

-- float votes: circle members read; you write your own
drop policy if exists "fv read" on circle_float_votes;
create policy "fv read" on circle_float_votes for select using (is_circle_member(circle_id));
drop policy if exists "fv write own" on circle_float_votes;
create policy "fv write own" on circle_float_votes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- investments: own only
drop policy if exists "inv own" on investments;
create policy "inv own" on investments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
--  RPCs
-- ============================================================

-- extended circle creation (replaces the v1 create_circle signature)
create or replace function create_circle_v2(
  p_name text, p_type text, p_cadence text, p_amount numeric,
  p_anchor_day int, p_grace_days int, p_late_fee numeric,
  p_my_slot int, p_my_name text, p_auto_debit boolean,
  p_category text, p_max_size int, p_payout_order text,
  p_float_enabled boolean, p_discoverable boolean,
  p_reliability_floor int, p_organiser_stake numeric, p_blurb text
) returns text language plpgsql security definer set search_path = public as $$
declare new_id uuid; new_code text;
begin
  new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into circles(code, name, type, cadence, amount, anchor_day, grace_days, late_fee, created_by,
                      category, max_size, payout_order, float_enabled, discoverable,
                      reliability_floor, organiser_stake, guarantee_fund, blurb, org_label)
    values (new_code, p_name, p_type, p_cadence, p_amount, greatest(1, coalesce(p_anchor_day,1)),
            greatest(0, coalesce(p_grace_days,0)), greatest(0, coalesce(p_late_fee,0)), auth.uid(),
            coalesce(nullif(p_category,''),'General'), greatest(3, coalesce(p_max_size,12)),
            coalesce(nullif(p_payout_order,''),'join'), coalesce(p_float_enabled,false),
            coalesce(p_discoverable,false), greatest(0, coalesce(p_reliability_floor,0)),
            greatest(0, coalesce(p_organiser_stake,0)), greatest(0, coalesce(p_amount,0)),
            coalesce(p_blurb,''),
            'Organiser: ' || coalesce(nullif(p_my_name,''),'You'))
    returning id into new_id;
  insert into circle_members(circle_id, user_id, name, slot, auto_debit)
    values (new_id, auth.uid(), coalesce(nullif(p_my_name,''),'You'),
            greatest(1, coalesce(p_my_slot,1)), coalesce(p_auto_debit, true));
  return new_code;
end;
$$;
grant execute on function create_circle_v2(text,text,text,numeric,int,int,numeric,int,text,boolean,text,int,text,boolean,boolean,int,numeric,text) to authenticated;

-- discoverable circles the caller is NOT in, with a joinable flag
create or replace function discover_circles()
returns table (
  id uuid, code text, name text, org_label text, category text, blurb text,
  amount numeric, cadence text, type text, max_size int, member_count int,
  reliability_floor int, guarantee_fund numeric, organiser_stake numeric,
  completion int, cycles_done int, my_score int, pending boolean
) language sql security definer set search_path = public as $$
  select c.id, c.code, c.name, c.org_label, c.category, c.blurb,
         c.amount, c.cadence, c.type, c.max_size,
         (select count(*)::int from circle_members m where m.circle_id = c.id) as member_count,
         c.reliability_floor, c.guarantee_fund, c.organiser_stake,
         98 as completion,
         greatest(1, ((now()::date - c.start_date) / 30))::int as cycles_done,
         coalesce((select p.reliability_score from profiles p where p.id = auth.uid()), 100) as my_score,
         exists (select 1 from circle_join_requests r
                 where r.circle_id = c.id and r.user_id = auth.uid() and r.status = 'pending') as pending
  from circles c
  where c.discoverable = true
    and c.created_by <> auth.uid()
    and not exists (select 1 from circle_members m where m.circle_id = c.id and m.user_id = auth.uid())
  order by c.created_at desc;
$$;
grant execute on function discover_circles() to authenticated;

-- request to join a discoverable circle
create or replace function request_join(p_circle uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare sc int; nm text;
begin
  select coalesce(reliability_score,100) into sc from profiles where id = auth.uid();
  select coalesce(nullif(name,''),'Member') into nm from directory where user_id = auth.uid();
  insert into circle_join_requests(circle_id, user_id, name, score, message)
    values (p_circle, auth.uid(), coalesce(nm,'Member'), coalesce(sc,100), coalesce(p_message,''))
  on conflict (circle_id, user_id) do update set message = excluded.message, status = 'pending';
end;
$$;
grant execute on function request_join(uuid, text) to authenticated;

-- organiser approves a request -> adds the member at the next free slot
create or replace function approve_join(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r circle_join_requests%rowtype; next_slot int;
begin
  select * into r from circle_join_requests where id = p_request;
  if not found then raise exception 'Request not found'; end if;
  if not exists (select 1 from circles c where c.id = r.circle_id and c.created_by = auth.uid()) then
    raise exception 'Not the organiser'; end if;
  select coalesce(max(slot),0)+1 into next_slot from circle_members where circle_id = r.circle_id;
  insert into circle_members(circle_id, user_id, name, slot)
    values (r.circle_id, r.user_id, r.name, next_slot)
  on conflict (circle_id, user_id) do nothing;
  update circle_join_requests set status = 'approved' where id = p_request;
end;
$$;
grant execute on function approve_join(uuid) to authenticated;

create or replace function decline_join(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from circle_join_requests r join circles c on c.id = r.circle_id
                 where r.id = p_request and c.created_by = auth.uid()) then
    raise exception 'Not the organiser'; end if;
  update circle_join_requests set status = 'declined' where id = p_request;
end;
$$;
grant execute on function decline_join(uuid) to authenticated;

-- ============================================================
--  Realtime
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table circle_join_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_disputes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table circle_float_votes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table directory; exception when duplicate_object then null; end;
end $$;

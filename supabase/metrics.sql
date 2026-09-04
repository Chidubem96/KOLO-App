-- ============================================================
--  KOLO — metrics pack
--  Supabase dashboard -> SQL Editor. Select ONE block (between the
--  === lines) and press Run. The editor only shows the last result
--  when several run at once, so run them one at a time.
--
--  Read-only. Safe to run any time. Nothing here writes.
-- ============================================================


-- ============================================================
-- 1. SIGNUPS  —  how many people, and when
-- ============================================================
select
  count(*)                                          as total_users,
  count(*) filter (where created_at > now() - interval '7 days')  as last_7d,
  count(*) filter (where created_at > now() - interval '1 day')   as last_24h,
  min(created_at)::date                             as first_signup,
  max(created_at)::date                             as latest_signup
from auth.users;


-- ============================================================
-- 2. SIGNUPS BY DAY  —  the acquisition curve
-- ============================================================
select
  created_at::date            as day,
  count(*)                    as signups
from auth.users
group by 1
order by 1 desc;


-- ============================================================
-- 3. ACTIVATION FUNNEL  —  how far people get in setup
--    Each step is a % of all signups.
-- ============================================================
with u as (select id from auth.users),
totals as (select count(*)::numeric as n from u)
select
  (select n from totals)                                                        as signed_up,
  count(distinct p.id) filter (where p.onboarded)                               as finished_onboarding,
  count(distinct a.user_id)                                                     as added_an_account,
  count(distinct o.user_id)                                                     as added_an_obligation,
  count(distinct g.user_id)                                                     as added_a_goal,
  count(distinct t.user_id)                                                     as logged_a_transaction,
  count(distinct cm.user_id)                                                    as joined_a_circle,
  round(100 * count(distinct p.id) filter (where p.onboarded) / (select n from totals), 0)  as pct_onboarded,
  round(100 * count(distinct t.user_id)               / (select n from totals), 0)          as pct_logged_txn,
  round(100 * count(distinct cm.user_id)              / (select n from totals), 0)          as pct_in_circle
from u
left join profiles p               on p.id = u.id
left join accounts a               on a.user_id = u.id
left join obligations o            on o.user_id = u.id
left join goals g                  on g.user_id = u.id
left join transactions t           on t.user_id = u.id
left join circle_members cm        on cm.user_id = u.id;


-- ============================================================
-- 4. PER-USER SCORECARD  —  one row per person, what they've done
--    'last_active' = most recent write of any kind. This is your
--    engagement + retention view. Sort/scan it each week.
-- ============================================================
with act as (
  select user_id, max(created_at) as ts from transactions        group by 1
  union all select user_id, max(created_at) from obligations       group by 1
  union all select user_id, max(created_at) from goals             group by 1
  union all select user_id, max(created_at) from accounts          group by 1
  union all select user_id, max(created_at) from circle_contributions group by 1
  union all select user_id, max(created_at) from feedback          group by 1
)
select
  u.email,
  coalesce(p.name, '')                                    as name,
  u.created_at::date                                      as joined,
  p.onboarded,
  (select count(*) from accounts    a where a.user_id = u.id)  as accounts,
  (select count(*) from obligations o where o.user_id = u.id)  as obligations,
  (select count(*) from goals       g where g.user_id = u.id)  as goals,
  (select count(*) from transactions t where t.user_id = u.id) as txns,
  (select count(*) from transactions t where t.user_id = u.id
     and t.created_at > now() - interval '7 days')             as txns_last_7d,
  (select count(*) from circle_members m where m.user_id = u.id) as circles,
  (select count(*) from circle_contributions c where c.user_id = u.id) as contribs_made,
  (select count(*) from feedback f where f.user_id = u.id)     as feedback_items,
  max(act.ts)::date                                            as last_active,
  (now()::date - max(act.ts)::date)                            as days_since_active
from auth.users u
left join profiles p on p.id = u.id
left join act        on act.user_id = u.id
group by u.id, u.email, u.created_at, p.name, p.onboarded
order by last_active desc nulls last;


-- ============================================================
-- 5. WEEKLY ACTIVE  —  distinct people who wrote anything, by week
-- ============================================================
with act as (
  select user_id, created_at from transactions
  union all select user_id, created_at from obligations
  union all select user_id, created_at from goals
  union all select user_id, created_at from circle_contributions
  union all select user_id, created_at from feedback
)
select
  date_trunc('week', created_at)::date  as week,
  count(distinct user_id)              as active_users
from act
group by 1
order by 1 desc;


-- ============================================================
-- 6. RETENTION  —  did they come back after day 0?
--    'returned_after_24h' = has activity dated >1 day after signup.
-- ============================================================
with act as (
  select user_id, created_at from transactions
  union all select user_id, created_at from obligations
  union all select user_id, created_at from goals
  union all select user_id, created_at from circle_contributions
  union all select user_id, created_at from feedback
)
select
  count(distinct u.id)                                                                as cohort,
  count(distinct a.user_id) filter (where a.created_at > u.created_at + interval '1 day')  as returned_after_24h,
  count(distinct a.user_id) filter (where a.created_at > u.created_at + interval '3 days') as returned_after_3d,
  count(distinct a.user_id) filter (where a.created_at > u.created_at + interval '7 days') as returned_after_7d
from auth.users u
left join act a on a.user_id = u.id;


-- ============================================================
-- 7. CIRCLES  —  are the ajo circles being used together?
-- ============================================================
select
  c.name,
  c.code,
  c.category,
  c.discoverable,
  to_char(c.amount, 'FM999,999,999')          as amount,
  c.cadence,
  (select count(*) from circle_members m       where m.circle_id = c.id)  as members,
  (select count(*) from circle_contributions x where x.circle_id = c.id)  as contributions_recorded,
  (select count(*) from circle_join_requests r  where r.circle_id = c.id and r.status = 'pending')  as pending_requests,
  (select count(*) from circle_disputes d       where d.circle_id = c.id and d.status = 'open')     as open_disputes,
  c.created_at::date                            as created
from circles c
order by members desc, c.created_at desc;


-- ============================================================
-- 8. SPENDING SIGNAL  —  what people are actually logging
--    (only real inputs, not the recurring auto-posts)
-- ============================================================
select
  coalesce(category, 'uncategorised')  as category,
  count(*)                             as entries,
  count(distinct user_id)             as people,
  round(avg(amount), 0)               as avg_amount,
  round(sum(amount), 0)               as total
from transactions
where source in ('manual', 'paste', 'csv')
group by 1
order by entries desc;


-- ============================================================
-- 9. FEEDBACK  —  everything people have sent, newest first
-- ============================================================
select
  created_at,
  name,
  email,
  screen,
  rating,
  message
from feedback
order by created_at desc;


-- ============================================================
-- 10. FEEDBACK BY SCREEN  —  where the friction clusters
-- ============================================================
select
  screen,
  count(*)                 as items,
  round(avg(rating), 1)    as avg_rating
from feedback
group by 1
order by items desc;

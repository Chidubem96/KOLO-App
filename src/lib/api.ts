import { supabase } from "./supabase";
import type {
  Account,
  Circle,
  CircleContribution,
  CircleFull,
  CircleMember,
  DirectoryEntry,
  DiscoverCircle,
  Dispute,
  FloatVote,
  Goal,
  Investment,
  JoinRequest,
  KoloData,
  Obligation,
  Profile,
  Txn,
} from "./types";
import { iso, todayStr } from "./format";

/* ---------- row -> domain mappers ---------- */
const mapProfile = (r: any): Profile => ({
  id: r.id,
  name: r.name ?? "",
  incomeType: r.income_type ?? "salaried",
  incomeAmount: Number(r.income_amount ?? 0),
  incomeDay: r.income_day ?? 25,
  bufferK: Number(r.buffer_k ?? 0.5),
  rent: r.rent == null ? null : Number(r.rent),
  salaryDay: r.salary_day ?? null,
  lang: r.lang ?? "en",
  dismissedSigs: r.dismissed_sigs ?? [],
  onboarded: !!r.onboarded,
  reliabilityScore: r.reliability_score ?? 100,
  bvnVerified: !!r.bvn_verified,
  ninVerified: !!r.nin_verified,
  phoneVerified: !!r.phone_verified,
  payoutAccount: r.payout_account ?? null,
});
const mapAccount = (r: any): Account => ({
  id: r.id,
  name: r.name,
  balance: Number(r.balance),
  liquid: !!r.liquid,
  locked: !!r.locked,
});
const mapTxn = (r: any): Txn => ({
  id: r.id,
  date: r.date,
  amount: Number(r.amount),
  category: r.category,
  note: r.note ?? "",
  person: !!r.person,
  source: r.source ?? "manual",
  auto: !!r.auto,
  period: r.period ?? null,
});
const mapObl = (r: any): Obligation => ({
  id: r.id,
  label: r.label,
  kind: r.kind ?? "bill",
  amount: Number(r.amount),
  cadence: r.cadence ?? "monthly",
  anchorDay: r.anchor_day ?? 1,
  active: r.active !== false,
  source: r.source ?? "manual",
  category: r.category ?? "rent",
  autoPost: r.auto_post !== false,
  since: r.since ?? todayStr(),
  sig: r.sig ?? null,
});
const mapGoal = (r: any): Goal => ({
  id: r.id,
  name: r.name,
  target: Number(r.target),
  saved: Number(r.saved),
  deadline: r.deadline,
  priority: r.priority ?? 2,
  paused: !!r.paused,
  contribLog: Array.isArray(r.contrib_log) ? r.contrib_log : [],
});
const mapCircle = (r: any): Circle => ({
  id: r.id,
  code: r.code,
  name: r.name,
  type: r.type ?? "rotating",
  cadence: r.cadence ?? "monthly",
  amount: Number(r.amount),
  startDate: r.start_date,
  anchorDay: r.anchor_day ?? 1,
  graceDays: r.grace_days ?? 3,
  lateFee: Number(r.late_fee ?? 0),
  createdBy: r.created_by ?? null,
  discoverable: !!r.discoverable,
  category: r.category ?? "General",
  reliabilityFloor: r.reliability_floor ?? 0,
  payoutOrder: r.payout_order ?? "join",
  floatEnabled: !!r.float_enabled,
  guaranteeFund: Number(r.guarantee_fund ?? 0),
  organiserStake: Number(r.organiser_stake ?? 0),
  maxSize: r.max_size ?? 12,
  blurb: r.blurb ?? "",
  orgLabel: r.org_label ?? "",
});
const mapJoinReq = (r: any): JoinRequest => ({
  id: r.id,
  circleId: r.circle_id,
  userId: r.user_id,
  name: r.name ?? "",
  score: r.score ?? 100,
  message: r.message ?? "",
  status: r.status ?? "pending",
  createdAt: r.created_at,
});
const mapDispute = (r: any): Dispute => ({
  id: r.id,
  circleId: r.circle_id,
  raisedBy: r.raised_by,
  raisedByName: r.raised_by_name ?? "",
  subject: r.subject ?? "",
  reason: r.reason ?? "",
  note: r.note ?? "",
  status: r.status ?? "open",
  createdAt: r.created_at,
});
const mapFloatVote = (r: any): FloatVote => ({
  id: r.id,
  circleId: r.circle_id,
  userId: r.user_id,
  cycle: r.cycle,
  vote: r.vote ?? "in",
});
const mapInvestment = (r: any): Investment => ({
  id: r.id,
  product: r.product,
  kind: r.kind ?? "naira",
  amount: Number(r.amount),
  createdAt: r.created_at,
});
const mapDirectory = (r: any): DirectoryEntry => ({
  userId: r.user_id,
  name: r.name ?? "",
  reliabilityScore: r.reliability_score ?? 100,
  cyclesCompleted: r.cycles_completed ?? 0,
  bvnVerified: !!r.bvn_verified,
  ninVerified: !!r.nin_verified,
  phoneVerified: !!r.phone_verified,
});
const mapMember = (r: any): CircleMember => ({
  id: r.id,
  circleId: r.circle_id,
  userId: r.user_id,
  name: r.name,
  slot: r.slot,
  autoDebit: r.auto_debit !== false,
  joinedAt: (r.joined_at || "").slice(0, 10) || "2020-01-01",
});
const mapContribution = (r: any): CircleContribution => ({
  id: r.id,
  circleId: r.circle_id,
  userId: r.user_id,
  cycle: r.cycle,
  paidOn: r.paid_on,
  amount: Number(r.amount),
  auto: !!r.auto,
});

/* ---------- load everything ---------- */
export async function loadKolo(userId: string): Promise<KoloData> {
  const sb = supabase();

  let { data: prof } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) {
    await sb.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
    const r = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    prof = r.data;
  }
  if (!prof) prof = { id: userId }; // last-resort default; mapProfile fills the rest

  const [acc, tx, obl, gl, circleRows, inv, myReq] = await Promise.all([
    sb.from("accounts").select("*").order("created_at"),
    sb.from("transactions").select("*").order("date", { ascending: false }),
    sb.from("obligations").select("*").order("created_at"),
    sb.from("goals").select("*").order("created_at"),
    sb.from("circles").select("*").order("created_at"),
    sb.from("investments").select("*").order("created_at", { ascending: false }),
    sb.from("circle_join_requests").select("*").eq("user_id", userId),
  ]);

  const circles: CircleFull[] = [];
  const circleIds = (circleRows.data ?? []).map((c: any) => c.id);
  let members: any[] = [];
  let contribs: any[] = [];
  let disputes: any[] = [];
  let joinReqs: any[] = [];
  let floatVotes: any[] = [];
  if (circleIds.length) {
    const [m, c, d, j, f] = await Promise.all([
      sb.from("circle_members").select("*").in("circle_id", circleIds),
      sb.from("circle_contributions").select("*").in("circle_id", circleIds),
      sb.from("circle_disputes").select("*").in("circle_id", circleIds),
      sb.from("circle_join_requests").select("*").in("circle_id", circleIds),
      sb.from("circle_float_votes").select("*").in("circle_id", circleIds),
    ]);
    members = m.data ?? [];
    contribs = c.data ?? [];
    disputes = d.data ?? [];
    joinReqs = j.data ?? [];
    floatVotes = f.data ?? [];
  }
  for (const cr of circleRows.data ?? []) {
    circles.push({
      ...mapCircle(cr),
      members: members
        .filter((x) => x.circle_id === cr.id)
        .map(mapMember)
        .sort((a, b) => a.slot - b.slot),
      contributions: contribs.filter((x) => x.circle_id === cr.id).map(mapContribution),
      disputes: disputes.filter((x) => x.circle_id === cr.id).map(mapDispute),
      joinRequests: joinReqs.filter((x) => x.circle_id === cr.id).map(mapJoinReq),
      floatVotes: floatVotes.filter((x) => x.circle_id === cr.id).map(mapFloatVote),
    });
  }

  // directory entries for every member of my circles + me
  const memberIds = Array.from(
    new Set([userId, ...members.map((m) => m.user_id)])
  );
  const dirRows = memberIds.length
    ? (await sb.from("directory").select("*").in("user_id", memberIds)).data ?? []
    : [];
  const directory: Record<string, DirectoryEntry> = {};
  dirRows.forEach((r: any) => (directory[r.user_id] = mapDirectory(r)));

  return {
    profile: mapProfile(prof),
    accounts: (acc.data ?? []).map(mapAccount),
    transactions: (tx.data ?? []).map(mapTxn),
    obligations: (obl.data ?? []).map(mapObl),
    goals: (gl.data ?? []).map(mapGoal),
    circles,
    investments: (inv.data ?? []).map(mapInvestment),
    directory,
    myRequests: (myReq.data ?? []).map(mapJoinReq),
    userId,
  };
}

/* ---------- mutations (thin wrappers) ---------- */
export async function saveProfile(userId: string, patch: Record<string, unknown>) {
  await supabase().from("profiles").update(patch).eq("id", userId);
}

export async function addAccount(userId: string, a: Omit<Account, "id">) {
  await supabase().from("accounts").insert({
    user_id: userId,
    name: a.name,
    balance: a.balance,
    liquid: a.liquid,
    locked: a.locked,
  });
}
export async function updateAccount(id: string, patch: Partial<Account>) {
  const p: any = {};
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.balance !== undefined) p.balance = patch.balance;
  if (patch.liquid !== undefined) p.liquid = patch.liquid;
  if (patch.locked !== undefined) p.locked = patch.locked;
  await supabase().from("accounts").update(p).eq("id", id);
}
export async function deleteRow(table: string, id: string) {
  await supabase().from(table).delete().eq("id", id);
}

export async function addTxns(
  userId: string,
  rows: Omit<Txn, "id">[]
) {
  const payload = rows.map((t) => ({
    user_id: userId,
    date: t.date,
    amount: t.amount,
    category: t.category,
    note: t.note,
    person: t.person,
    source: t.source,
    auto: t.auto,
    period: t.period,
  }));
  if (payload.length) await supabase().from("transactions").insert(payload);
}
export async function setTxnCategory(id: string, category: string) {
  await supabase().from("transactions").update({ category }).eq("id", id);
}

export async function addObligation(userId: string, o: Omit<Obligation, "id">) {
  await supabase().from("obligations").insert({
    user_id: userId,
    label: o.label,
    kind: o.kind,
    amount: o.amount,
    cadence: o.cadence,
    anchor_day: o.anchorDay,
    active: o.active,
    source: o.source,
    category: o.category,
    auto_post: o.autoPost,
    since: o.since,
    sig: o.sig,
  });
}
export async function updateObligation(id: string, patch: Partial<Obligation>) {
  const p: any = {};
  if (patch.label !== undefined) p.label = patch.label;
  if (patch.amount !== undefined) p.amount = patch.amount;
  if (patch.cadence !== undefined) p.cadence = patch.cadence;
  if (patch.anchorDay !== undefined) p.anchor_day = patch.anchorDay;
  if (patch.active !== undefined) p.active = patch.active;
  if (patch.category !== undefined) p.category = patch.category;
  if (patch.autoPost !== undefined) p.auto_post = patch.autoPost;
  await supabase().from("obligations").update(p).eq("id", id);
}
export async function dismissSig(userId: string, current: string[], sig: string) {
  await supabase()
    .from("profiles")
    .update({ dismissed_sigs: Array.from(new Set([...current, sig])) })
    .eq("id", userId);
}

export async function addGoal(userId: string, g: Omit<Goal, "id">) {
  await supabase().from("goals").insert({
    user_id: userId,
    name: g.name,
    target: g.target,
    saved: g.saved,
    deadline: g.deadline,
    priority: g.priority,
    paused: g.paused,
    contrib_log: g.contribLog,
  });
}
export async function updateGoal(id: string, patch: Partial<Goal>) {
  const p: any = {};
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.target !== undefined) p.target = patch.target;
  if (patch.saved !== undefined) p.saved = patch.saved;
  if (patch.deadline !== undefined) p.deadline = patch.deadline;
  if (patch.priority !== undefined) p.priority = patch.priority;
  if (patch.paused !== undefined) p.paused = patch.paused;
  if (patch.contribLog !== undefined) p.contrib_log = patch.contribLog;
  await supabase().from("goals").update(p).eq("id", id);
}

/* ---------- circles ---------- */
export async function createCircle(args: {
  name: string;
  type: string;
  cadence: string;
  amount: number;
  anchorDay: number;
  graceDays: number;
  lateFee: number;
  mySlot: number;
  myName: string;
  autoDebit: boolean;
  category: string;
  maxSize: number;
  payoutOrder: string;
  floatEnabled: boolean;
  discoverable: boolean;
  reliabilityFloor: number;
  organiserStake: number;
  blurb: string;
}) {
  const { data, error } = await supabase().rpc("create_circle_v2", {
    p_name: args.name,
    p_type: args.type,
    p_cadence: args.cadence,
    p_amount: args.amount,
    p_anchor_day: args.anchorDay,
    p_grace_days: args.graceDays,
    p_late_fee: args.lateFee,
    p_my_slot: args.mySlot,
    p_my_name: args.myName,
    p_auto_debit: args.autoDebit,
    p_category: args.category,
    p_max_size: args.maxSize,
    p_payout_order: args.payoutOrder,
    p_float_enabled: args.floatEnabled,
    p_discoverable: args.discoverable,
    p_reliability_floor: args.reliabilityFloor,
    p_organiser_stake: args.organiserStake,
    p_blurb: args.blurb,
  });
  if (!error) return data as string;

  // fall back to the v1 RPC if schema-v2 hasn't been run yet
  const v1 = await supabase().rpc("create_circle", {
    p_name: args.name,
    p_type: args.type,
    p_cadence: args.cadence,
    p_amount: args.amount,
    p_anchor_day: args.anchorDay,
    p_grace_days: args.graceDays,
    p_late_fee: args.lateFee,
    p_my_slot: args.mySlot,
    p_my_name: args.myName,
    p_auto_debit: args.autoDebit,
  });
  if (v1.error) throw error;
  return v1.data as string;
}

/* ---------- directory / identity ---------- */
export async function syncDirectory(
  userId: string,
  e: Omit<DirectoryEntry, "userId">
) {
  await supabase()
    .from("directory")
    .upsert(
      {
        user_id: userId,
        name: e.name,
        reliability_score: e.reliabilityScore,
        cycles_completed: e.cyclesCompleted,
        bvn_verified: e.bvnVerified,
        nin_verified: e.ninVerified,
        phone_verified: e.phoneVerified,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
}

/* ---------- discover ---------- */
export async function discoverCircles(): Promise<DiscoverCircle[]> {
  const { data } = await supabase().rpc("discover_circles");
  return (Array.isArray(data) ? data : []).map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    orgLabel: r.org_label ?? "",
    category: r.category ?? "General",
    blurb: r.blurb ?? "",
    amount: Number(r.amount),
    cadence: r.cadence ?? "monthly",
    type: r.type ?? "rotating",
    maxSize: r.max_size ?? 12,
    memberCount: r.member_count ?? 0,
    reliabilityFloor: r.reliability_floor ?? 0,
    guaranteeFund: Number(r.guarantee_fund ?? 0),
    organiserStake: Number(r.organiser_stake ?? 0),
    completion: r.completion ?? 98,
    cyclesDone: r.cycles_done ?? 1,
    myScore: r.my_score ?? 100,
    pending: !!r.pending,
  }));
}
export async function requestJoin(circleId: string, message: string) {
  const { error } = await supabase().rpc("request_join", {
    p_circle: circleId,
    p_message: message,
  });
  if (error) throw error;
}
export async function approveJoin(requestId: string) {
  const { error } = await supabase().rpc("approve_join", { p_request: requestId });
  if (error) throw error;
}
export async function declineJoin(requestId: string) {
  const { error } = await supabase().rpc("decline_join", { p_request: requestId });
  if (error) throw error;
}

/* ---------- disputes ---------- */
export async function raiseDispute(args: {
  circleId: string;
  userId: string;
  name: string;
  subject: string;
  reason: string;
  note: string;
}) {
  await supabase().from("circle_disputes").insert({
    circle_id: args.circleId,
    raised_by: args.userId,
    raised_by_name: args.name,
    subject: args.subject,
    reason: args.reason,
    note: args.note,
  });
}
export async function resolveDispute(id: string) {
  await supabase().from("circle_disputes").update({ status: "resolved" }).eq("id", id);
}

/* ---------- float votes ---------- */
export async function castFloatVote(args: {
  circleId: string;
  userId: string;
  cycle: number;
  vote: "in" | "out";
}) {
  await supabase()
    .from("circle_float_votes")
    .upsert(
      {
        circle_id: args.circleId,
        user_id: args.userId,
        cycle: args.cycle,
        vote: args.vote,
      },
      { onConflict: "circle_id,user_id,cycle" }
    );
}

/* ---------- investments ---------- */
export async function addInvestment(args: {
  userId: string;
  product: string;
  kind: "naira" | "dollar";
  amount: number;
}) {
  await supabase().from("investments").insert({
    user_id: args.userId,
    product: args.product,
    kind: args.kind,
    amount: args.amount,
  });
}
/* ---------- feedback ---------- */
export async function sendFeedback(args: {
  userId: string;
  name: string;
  screen: string;
  rating: number | null;
  message: string;
}) {
  const sb = supabase();
  let email = "";
  try {
    email = (await sb.auth.getUser()).data.user?.email ?? "";
  } catch {}
  await sb.from("feedback").insert({
    user_id: args.userId,
    name: args.name,
    email,
    screen: args.screen,
    rating: args.rating,
    message: args.message,
    app_version: "v2",
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : "",
  });
}

export async function peekCircle(code: string) {
  const { data } = await supabase().rpc("peek_circle", { p_code: code });
  return Array.isArray(data) && data[0] ? data[0] : null;
}
export async function joinCircle(code: string, name: string) {
  const { data, error } = await supabase().rpc("join_circle", {
    p_code: code,
    p_name: name,
  });
  if (error) throw error;
  return data as string;
}
export async function leaveCircle(circleId: string, userId: string) {
  await supabase()
    .from("circle_members")
    .delete()
    .eq("circle_id", circleId)
    .eq("user_id", userId);
}
export async function setMemberAutoDebit(
  circleId: string,
  userId: string,
  v: boolean
) {
  await supabase()
    .from("circle_members")
    .update({ auto_debit: v })
    .eq("circle_id", circleId)
    .eq("user_id", userId);
}
export async function recordContribution(args: {
  circleId: string;
  userId: string;
  cycle: number;
  amount: number;
  paidOn: string;
  auto: boolean;
}) {
  await supabase()
    .from("circle_contributions")
    .upsert(
      {
        circle_id: args.circleId,
        user_id: args.userId,
        cycle: args.cycle,
        amount: args.amount,
        paid_on: args.paidOn,
        auto: args.auto,
      },
      { onConflict: "circle_id,user_id,cycle", ignoreDuplicates: true }
    );
}

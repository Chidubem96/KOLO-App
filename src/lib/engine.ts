import {
  D,
  addDays,
  clamp,
  daysAgo,
  daysBetween,
  fmt,
  fmtDate,
  iso,
  monthsUntil,
  stdev,
  sum,
  todayD,
  todayStr,
} from "./format";
import type {
  CircleContribution,
  CircleFull,
  Goal,
  KoloData,
  Obligation,
} from "./types";

/* ---------- category taxonomy ---------- */
export const CATS: { id: string; label: string; disc: boolean }[] = [
  { id: "food", label: "Food & market", disc: true },
  { id: "transport", label: "Transport & fuel", disc: true },
  { id: "data", label: "Data & airtime", disc: true },
  { id: "generator", label: "Generator & diesel", disc: true },
  { id: "home", label: "Sent home", disc: false },
  { id: "school", label: "School fees", disc: false },
  { id: "rent", label: "Rent & bills", disc: false },
  { id: "faith", label: "Church / mosque", disc: true },
  { id: "levy", label: "Levies & dues", disc: false },
  { id: "health", label: "Health", disc: true },
  { id: "shopping", label: "Shopping & personal", disc: true },
  { id: "circle", label: "Circle contribution", disc: false },
  { id: "other", label: "Other", disc: true },
];
export const catLabel = (id: string | null) =>
  (CATS.find((c) => c.id === id) || { label: "Uncategorised" }).label;
export const isDisc = (id: string | null) => {
  const c = CATS.find((x) => x.id === id);
  return c ? c.disc : true;
};

/* ---------- text -> transaction parsing ---------- */
export function guessCategory(text: string): string | null {
  const s = (text || "").toLowerCase();
  const rules: [RegExp, string][] = [
    [/uber|bolt| taxi|fuel|petrol|filling|nnpc|transport|\bbrt\b|\bkeke\b|danfo/, "transport"],
    [/mtn|airtel|\bglo\b|9 ?mobile|data bundle|airtime|recharge|vtu/, "data"],
    [/diesel|generator|\bgen\b|litres of/, "generator"],
    [/school|tuition| fees|lesson|waec|jamb|neco/, "school"],
    [/\brent\b|landlord|phcn|phed|ikedc|eko ?elec|aedc|kaedco|electric|prepaid meter|\bdstv\b|\bgotv\b|startimes|water board/, "rent"],
    [/church|mosque|tithe|offering|zakat|\bseed\b|winners|deeper life/, "faith"],
    [/\blevy\b|\bdues\b|association|\bunion\b|estate due|market assoc/, "levy"],
    [/hospital|pharmacy|chemist|clinic|\bdrug|medic|lab test/, "health"],
    [/shoprite|\bspar\b|\bmart\b| market|grocery|restaurant|eatery|kitchen|\bbuka\b|chicken republic|kfc/, "food"],
    [/\bajo\b|esusu|adashe|contribution|thrift|cooperative|\bcoop\b|society/, "circle"],
    [/salon|barb|boutique|fashion|jumia|konga|store|pos purchase/, "shopping"],
  ];
  for (const [re, c] of rules) if (re.test(s)) return c;
  return null;
}

export interface RawDraft {
  amount: number;
  date: string | null;
  direction: "debit" | "credit";
  counterparty?: string;
  category: string | null;
  note: string;
  is_person?: boolean;
}

export function parseAlerts(text: string): RawDraft[] {
  const blocks = text
    .split(/\n\s*\n|(?=\b(?:Dear|Txn|Transaction|Debit|Credit|Acct|A\/C|You have)\b)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 6);
  const out: RawDraft[] = [];
  for (const b of blocks) {
    const am = b.match(
      /(?:NGN|N|₦)\s?([\d]{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i
    );
    if (!am) continue;
    const amount = Math.round(parseFloat(am[1].replace(/,/g, "")));
    if (!(amount > 0)) continue;
    const isCredit =
      /\b(credit(ed)?|\bcr\b|received|inflow|deposit|reversal)\b/i.test(b) &&
      !/\bdebit/i.test(b);
    let date: string | null = null;
    const dm =
      b.match(/(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{2,4})/) ||
      b.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dm) {
      const p = Date.parse(dm[0].replace(/-/g, " "));
      if (!isNaN(p)) {
        const d = new Date(p);
        d.setHours(12, 0, 0, 0);
        date = iso(d);
      }
    }
    const cp = (b.match(
      /\b(?:to|at|from|@)\s+([A-Za-z0-9][A-Za-z0-9 &.\-'/]{2,34})/i
    ) || [])[1];
    const note = (cp || b.slice(0, 40)).replace(/\s+/g, " ").trim();
    out.push({
      amount,
      date,
      direction: isCredit ? "credit" : "debit",
      counterparty: cp || "",
      category: guessCategory(b),
      note,
      is_person: /\b(mr|mrs|miss|chief|alhaji)\b/i.test(b),
    });
  }
  return out;
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }
  return rows;
}

export function amountInSource(amount: number, src: string): boolean {
  const digits = String(Math.round(amount));
  const withCommas = Math.round(amount).toLocaleString("en-US");
  return src.replace(/,/g, "").includes(digits) || src.includes(withCommas);
}

/* ============================================================
   THE ENGINE
   ============================================================ */
export function nextIncomeDate(d: KoloData): Date {
  const p = d.profile;
  const now = todayD();
  if (p.incomeType === "salaried" || p.incomeType === "mixed") {
    const day = clamp(p.incomeDay || 25, 1, 28);
    let x = new Date(now.getFullYear(), now.getMonth(), day, 12);
    if (x <= now) x = new Date(now.getFullYear(), now.getMonth() + 1, day, 12);
    if (p.incomeType === "salaried") return x;
    return x;
  }
  // irregular: no history model here -> 30-day horizon
  return addDays(now, 30);
}

export function obligationDue(o: Obligation): Date {
  const now = todayD();
  if (o.cadence === "weekly") {
    const wd = o.anchorDay == null ? 5 : o.anchorDay;
    let d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d = addDays(d, (wd - d.getDay() + 7) % 7);
    return d;
  }
  const day = clamp(o.anchorDay || 1, 1, 28);
  let d = new Date(now.getFullYear(), now.getMonth(), day, 12);
  if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, day, 12);
  return d;
}

export function monthlyAccrual(g: Goal): number {
  if (g.paused) return 0;
  const remaining = Math.max(0, g.target - g.saved);
  if (remaining <= 0) return 0;
  const periods = Math.max(1, Math.ceil(monthsUntil(g.deadline)));
  return remaining / periods;
}

export function goalRunRate(g: Goal): number {
  const logged = (g.contribLog || []).filter((x) => daysAgo(x.date) <= 90);
  if (logged.length >= 1) {
    const span = clamp(daysAgo([...logged].sort((a, b) => a.date.localeCompare(b.date))[0].date), 15, 90);
    return Math.round((sum(logged.map((x) => x.amount)) * 30) / span);
  }
  return Math.round(monthlyAccrual(g));
}

/* ---------- circle math ---------- */
export function circleCycleIndex(c: CircleFull): number {
  const start = D(c.startDate);
  const now = todayD();
  if (c.cadence === "weekly")
    return Math.max(0, Math.floor(daysBetween(c.startDate, todayStr()) / 7));
  return Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())
  );
}
export function circleCycleDue(c: CircleFull, idx: number): Date {
  if (c.cadence === "weekly") return addDays(c.startDate, idx * 7);
  const start = D(c.startDate);
  return new Date(
    start.getFullYear(),
    start.getMonth() + idx,
    Math.min(28, start.getDate()),
    12
  );
}
export interface ContribStatus {
  paid: boolean;
  onTime: boolean;
  paidOn?: string;
  late?: boolean;
  atRisk?: boolean;
  upcoming?: boolean;
  due: Date;
}
export function circleContribStatus(
  c: CircleFull,
  idx: number,
  userId: string
): ContribStatus {
  const rec = c.contributions.find(
    (x) => x.userId === userId && x.cycle === idx
  );
  const due = circleCycleDue(c, idx);
  const grace = addDays(due, c.graceDays || 0);
  if (rec) {
    return { paid: true, onTime: D(rec.paidOn) <= grace, paidOn: rec.paidOn, due };
  }
  const now = todayD();
  if (now > grace) return { paid: false, onTime: false, late: true, due };
  if (now >= addDays(due, -Math.max(3, c.graceDays || 3)))
    return { paid: false, onTime: false, atRisk: true, due };
  return { paid: false, onTime: false, upcoming: true, due };
}

export function myReliability(circles: CircleFull[], userId: string) {
  let onTime = 0;
  let total = 0;
  for (const c of circles) {
    const me = c.members.find((m) => m.userId === userId);
    if (!me) continue;
    const cur = circleCycleIndex(c);
    for (let i = 0; i <= cur; i++) {
      if (circleCycleDue(c, i) < D(me.joinedAt)) continue;
      const st = circleContribStatus(c, i, userId);
      if (st.paid) {
        total++;
        if (st.onTime) onTime++;
      } else if (st.late) total++;
    }
  }
  return { score: total === 0 ? 100 : Math.round((100 * onTime) / total), onTime, total };
}

/* ---------- buffer + rollups ---------- */
export function volatilityBuffer(d: KoloData, availableLiquid: number) {
  const k = d.profile.bufferK;
  const txns = d.transactions.filter(
    (t) => t.category && isDisc(t.category) && daysAgo(t.date) <= 90 && daysAgo(t.date) >= 0
  );
  const span = txns.length
    ? clamp(daysAgo([...txns].sort((a, b) => a.date.localeCompare(b.date))[0].date), 7, 90)
    : 0;
  if (txns.length < 6 || span < 14) {
    return {
      value: Math.round(k * 0.12 * availableLiquid),
      basis: "estimate",
      weak: true,
    };
  }
  const weeks = Math.max(2, Math.round(span / 7));
  const buckets: Record<number, number> = {};
  txns.forEach((t) => {
    const w = Math.floor(daysAgo(t.date) / 7);
    buckets[w] = (buckets[w] || 0) + t.amount;
  });
  const arr: number[] = [];
  for (let i = 0; i < weeks; i++) arr.push(buckets[i] || 0);
  return {
    value: Math.round(k * stdev(arr)),
    basis: "90-day σ of weekly spend",
    weak: false,
  };
}

export function monthlyRollups(d: KoloData) {
  const spend90 = d.transactions.filter(
    (t) => t.category && daysAgo(t.date) <= 90 && daysAgo(t.date) >= 0
  );
  const span = spend90.length
    ? clamp(daysAgo([...spend90].sort((a, b) => a.date.localeCompare(b.date))[0].date), 7, 90)
    : 30;
  const scale = 30 / span;
  const disc = sum(spend90.filter((t) => isDisc(t.category)).map((t) => t.amount)) * scale;
  const committedTx = sum(spend90.filter((t) => !isDisc(t.category)).map((t) => t.amount)) * scale;
  const income =
    d.profile.incomeType === "salaried"
      ? d.profile.incomeAmount || 0
      : d.profile.incomeAmount || 0;
  const obligMonthly = sum(
    d.obligations
      .filter((o) => o.active)
      .map((o) => (o.cadence === "weekly" ? o.amount * 4.33 : o.amount))
  );
  const goalsMonthly = sum(d.goals.map(monthlyAccrual));
  const committed = Math.max(committedTx, obligMonthly);
  return {
    income: Math.round(income),
    discretionary: Math.round(disc),
    committed: Math.round(committed),
    goalsMonthly: Math.round(goalsMonthly),
    surplus: Math.round(income - committed - disc - goalsMonthly),
  };
}

/* ---------- THE NUMBER ---------- */
export interface StSResult {
  availableLiquid: number;
  horizon: Date;
  sts: number;
  partial: boolean;
  reasons: string[];
  obligTotal: number;
  circleTotal: number;
  goalTotal: number;
  buffer: { value: number; basis: string; weak: boolean };
  obligItems: { label: string; amount: number; due: Date }[];
  circleItems: { label: string; amount: number; due: Date }[];
  goalItems: { label: string; amount: number }[];
  accountCount: number;
}
export function safeToSpend(d: KoloData): StSResult {
  const liquid = d.accounts.filter((a) => a.liquid && !a.locked);
  const availableLiquid = sum(liquid.map((a) => a.balance));
  const horizon = nextIncomeDate(d);

  const obligItems = d.obligations
    .filter((o) => o.active)
    .map((o) => ({ label: o.label, amount: o.amount, due: obligationDue(o) }))
    .filter((o) => o.due <= horizon);
  const obligTotal = sum(obligItems.map((o) => o.amount));

  const circleItems: { label: string; amount: number; due: Date }[] = [];
  for (const c of d.circles) {
    if (!c.members.some((m) => m.userId === d.userId)) continue;
    const cur = circleCycleIndex(c);
    const st = circleContribStatus(c, cur, d.userId);
    if (!st.paid && st.due <= horizon)
      circleItems.push({ label: c.name, amount: c.amount, due: st.due });
  }
  const circleTotal = sum(circleItems.map((c) => c.amount));

  const goalItems = d.goals
    .filter((g) => !g.paused && monthlyAccrual(g) > 0)
    .map((g) => ({ label: g.name, amount: Math.round(monthlyAccrual(g)) }));
  const goalTotal = sum(goalItems.map((g) => g.amount));

  const buffer = volatilityBuffer(d, availableLiquid);
  const sts = Math.round(
    availableLiquid - obligTotal - circleTotal - goalTotal - buffer.value
  );

  const reasons: string[] = [];
  if (d.accounts.length < 2)
    reasons.push("only " + d.accounts.length + " account linked");
  if (!d.profile.incomeAmount) reasons.push("no income set");
  if (buffer.weak) reasons.push("less than 2 weeks of spending history");

  return {
    availableLiquid,
    horizon,
    sts,
    partial: reasons.length > 0,
    reasons,
    obligTotal,
    circleTotal,
    goalTotal,
    buffer,
    obligItems,
    circleItems,
    goalItems,
    accountCount: d.accounts.length,
  };
}

export function homeNudge(d: KoloData, r: StSResult): { tone: string; text: string } {
  for (const c of d.circles) {
    if (!c.members.some((m) => m.userId === d.userId)) continue;
    const cur = circleCycleIndex(c);
    const st = circleContribStatus(c, cur, d.userId);
    if (!st.paid) {
      const dd = daysBetween(todayStr(), st.due);
      if (dd >= 0 && dd <= 4) {
        if (r.availableLiquid >= c.amount)
          return {
            tone: "",
            text: `Your "${c.name}" debit is ${fmtDate(st.due)} — the ${fmt(
              c.amount
            )} is there.`,
          };
        return {
          tone: "warn",
          text: `Your "${c.name}" debit is ${fmtDate(
            st.due
          )} and your liquid balance is short by ${fmt(
            c.amount - r.availableLiquid
          )}. Check Circles for options.`,
        };
      }
    }
  }
  if (r.sts < 0)
    return {
      tone: "bad",
      text: `You're ${fmt(-r.sts)} over for this period. Tap the number for three ways back.`,
    };
  const roll = monthlyRollups(d);
  if (d.transactions.length > 15 && roll.surplus > 0)
    return {
      tone: "",
      text: `On this month's pattern you're running a ${fmt(
        roll.surplus
      )} surplus. Keeping it here sharpens next month's number.`,
    };
  if (r.partial)
    return {
      tone: "warn",
      text: `This is a partial figure — ${r.reasons[0]}. Fill it in under Settings and it tightens.`,
    };
  return {
    tone: "",
    text: `Your money is accounted for. ${fmt(r.sts)} is genuinely free until ${fmtDate(
      r.horizon
    )}.`,
  };
}

export function recoveryOptions(d: KoloData, r: StSResult) {
  const opts: { label: string; gain: number; kind: string; id?: string; note?: string }[] = [];
  const goalsByPrio = d.goals
    .filter((g) => !g.paused && monthlyAccrual(g) > 0)
    .sort((a, b) => b.priority - a.priority);
  if (goalsByPrio[0]) {
    const g = goalsByPrio[0];
    opts.push({
      label: `Pause "${g.name}" accrual this month`,
      gain: Math.round(monthlyAccrual(g)),
      kind: "pauseGoal",
      id: g.id,
    });
  }
  if (r.buffer.value > 0)
    opts.push({
      label: "Set volatility buffer to 0 (k = 0)",
      gain: r.buffer.value,
      kind: "zeroBuffer",
    });
  const soon = [...r.obligItems].sort((a, b) => +a.due - +b.due)[0];
  if (soon)
    opts.push({
      label: `Move "${soon.label}" past ${fmtDate(r.horizon)}`,
      gain: soon.amount,
      kind: "manual",
      note: "reschedule the bill",
    });
  return { gap: -r.sts, opts };
}

/* ---------- obligation detection ---------- */
export interface DetectedObl {
  sig: string;
  category: string | null;
  note: string;
  amount: number;
  cadence: "monthly" | "weekly";
  anchorDay: number;
  count: number;
  person: boolean;
  label: string;
}
function sigOf(t: { category: string | null; note: string; amount: number }) {
  const note = (t.note || "")
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
  return t.category + "|" + note + "|" + Math.round(t.amount / 1000);
}
export function detectObligations(d: KoloData): DetectedObl[] {
  const byS: Record<string, typeof d.transactions> = {};
  for (const t of d.transactions) {
    if (!t.category || daysAgo(t.date) > 120 || daysAgo(t.date) < 0) continue;
    const k = sigOf(t);
    (byS[k] = byS[k] || []).push(t);
  }
  const out: DetectedObl[] = [];
  for (const [k, list] of Object.entries(byS)) {
    if (list.length < 3) continue;
    if (d.profile.dismissedSigs.includes(k)) continue;
    if (d.obligations.some((o) => o.sig === k)) continue;
    const dates = list.map((t) => t.date).sort();
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++)
      gaps.push(daysBetween(dates[i - 1], dates[i]));
    const avgGap = sum(gaps) / gaps.length;
    let cadence: "monthly" | "weekly" | null = null;
    let anchorDay = 1;
    if (avgGap >= 24 && avgGap <= 35) {
      cadence = "monthly";
      anchorDay = D(dates[dates.length - 1]).getDate();
    } else if (avgGap >= 5 && avgGap <= 9) {
      cadence = "weekly";
      anchorDay = D(dates[dates.length - 1]).getDay();
    } else continue;
    const amt = Math.round(sum(list.map((t) => t.amount)) / list.length);
    const spread =
      Math.max(...list.map((t) => t.amount)) -
      Math.min(...list.map((t) => t.amount));
    if (spread / amt > 0.25) continue;
    const t0 = list[0];
    out.push({
      sig: k,
      category: t0.category,
      note: t0.note,
      amount: amt,
      cadence,
      anchorDay,
      count: list.length,
      person: !!t0.person,
      label: t0.note && t0.note.trim() ? t0.note.trim() : catLabel(t0.category),
    });
  }
  return out;
}

/* ---------- recurring auto-post ---------- */
export function oblCategory(o: Obligation) {
  return o.category || (o.kind === "transfer" ? "home" : "rent");
}
export function dueDatesInWindow(o: Obligation, backDays: number): Date[] {
  const now = todayD();
  const floorStr =
    o.since && o.since > iso(addDays(now, -backDays))
      ? o.since
      : iso(addDays(now, -backDays));
  const floor = D(floorStr);
  const out: Date[] = [];
  if (o.cadence === "weekly") {
    const wd = o.anchorDay == null ? 5 : o.anchorDay;
    let d = new Date(floor);
    d.setHours(12, 0, 0, 0);
    d = addDays(d, (wd - d.getDay() + 7) % 7);
    for (; d <= now; d = addDays(d, 7)) if (d >= floor) out.push(new Date(d));
  } else {
    const day = clamp(o.anchorDay || 1, 1, 28);
    let d = new Date(floor.getFullYear(), floor.getMonth(), day, 12);
    for (
      ;
      d <= now;
      d = new Date(d.getFullYear(), d.getMonth() + 1, day, 12)
    )
      if (d >= floor) out.push(new Date(d));
  }
  return out;
}

export interface RecurringPost {
  target: "transaction" | "contribution";
  // transaction
  date?: string;
  amount?: number;
  category?: string;
  note?: string;
  person?: boolean;
  period?: string;
  // contribution
  circleId?: string;
  cycle?: number;
}
/** Pure: compute the recurring items that SHOULD exist but don't yet. */
export function pendingRecurring(d: KoloData): RecurringPost[] {
  const out: RecurringPost[] = [];
  for (const o of d.obligations) {
    if (!o.active || o.autoPost === false) continue;
    for (const due of dueDatesInWindow(o, 40)) {
      if (iso(due) >= todayStr()) continue;
      const period = "obl:" + o.id + "@" + iso(due);
      if (d.transactions.some((t) => t.period === period)) continue;
      out.push({
        target: "transaction",
        date: iso(due),
        amount: o.amount,
        category: oblCategory(o),
        note: o.label,
        person: o.kind === "transfer",
        period,
      });
    }
  }
  for (const c of d.circles) {
    const me = c.members.find((m) => m.userId === d.userId);
    if (!me || me.autoDebit === false) continue;
    const cur = circleCycleIndex(c);
    for (let i = 0; i <= cur; i++) {
      const due = circleCycleDue(c, i);
      if (iso(due) >= todayStr()) continue;
      if (due < D(me.joinedAt)) continue; // not on the hook for cycles before joining
      const has = c.contributions.some(
        (x) => x.userId === d.userId && x.cycle === i
      );
      if (has) continue;
      const period = "cir:" + c.id + "@" + i;
      out.push({
        target: "contribution",
        circleId: c.id,
        cycle: i,
        amount: c.amount,
        date: iso(due),
        category: "circle",
        note: c.name + " contribution",
        period,
      });
    }
  }
  return out;
}

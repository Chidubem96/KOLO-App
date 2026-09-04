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
    [/diesel|generator|\bgen set\b|genset|litres of (diesel|petrol)/, "generator"],
    [/school|tuition| fees|lesson|waec|jamb|neco/, "school"],
    [/\brent\b|landlord|phcn|phed|ikedc|eko ?elec|aedc|kaedco|kedco|bedc|ibedc|jedc|electric|prepaid meter|prepaid token|nepa|power token|units? token|\bdstv\b|\bgotv\b|startimes|water board|lawma|waste/, "rent"],
    [/netflix|spotify|showmax|youtube ?premium|apple\.com\/bill|apple music|prime video|amazon prime|icloud|google ?(one|storage)|canva|adobe|chatgpt|openai|notion|dropbox|linkedin premium/, "shopping"],
    [/church|mosque|tithe|offering|zakat|\bseed\b|winners|deeper life/, "faith"],
    [/\blevy\b|\bdues\b|association|\bunion\b|estate due|market assoc/, "levy"],
    [/hospital|pharmacy|chemist|clinic|\bdrug|medic|lab test/, "health"],
    [/shoprite|\bspar\b|\bmart\b| market|grocery|restaurant|eatery|kitchen|\bbuka\b|chicken republic|kfc/, "food"],
    [/\bajo\b|esusu|adashe|contribution|thrift|cooperative|\bcoop\b|society/, "circle"],
    [/salon|barb|boutique|fashion|jumia|konga|store|pos purchase|\bpos\b|supermarket/, "shopping"],
  ];
  for (const [re, c] of rules) if (re.test(s)) return c;
  return null;
}

/** Never returns null — falls back to a sensible bucket so a parsed row is
    always usable without the user having to pick a category. */
export function categoriseOr(text: string, isPerson = false): string {
  return guessCategory(text) || (isPerson ? "home" : "other");
}

export interface RawDraft {
  amount: number;
  date: string | null;
  direction: "debit" | "credit";
  counterparty?: string;
  category: string | null;
  note: string;
  is_person?: boolean;
  currency?: string; // set when the alert is NOT in naira — do not store the number
}

const FX = /\b(USD|GBP|EUR|CAD|AUD|ZAR|GHS|KES|AED|CNY|JPY|INR)\b|(?<![A-Za-z])[$£€](?=\s?\d)/;

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
    const fx = b.match(FX);
    // Foreign-currency alert: never coerce the number into naira. Surface it
    // so the user knows it wasn't captured, rather than storing e.g. $200 as ₦200.
    if (fx && (!am || b.toUpperCase().indexOf("NGN") < 0)) {
      out.push({
        amount: 0,
        date: null,
        direction: /\bcredit(ed)?\b/i.test(b) ? "credit" : "debit",
        category: null,
        note: b.slice(0, 40).replace(/\s+/g, " ").trim(),
        currency: (fx[1] || fx[0]).toUpperCase(),
      });
      continue;
    }
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
    // direction-aware counterparty: on a debit the "other" party is who you
    // paid ("to X"); on a credit it's who paid you ("from X"). Reading the
    // wrong side flips the transaction and corrupts every downstream figure.
    const grab = (re: RegExp) => (b.match(re) || [])[1]?.replace(/\s+/g, " ").trim();
    const toName = grab(/\bto\s+([A-Za-z0-9][A-Za-z0-9 &.\-'/]{2,34})/i);
    const atName = grab(/\bat\s+([A-Za-z0-9][A-Za-z0-9 &.\-'/]{2,34})/i);
    const fromName = grab(/\bfrom\s+([A-Za-z0-9][A-Za-z0-9 &.\-'/]{2,34})/i);
    const cp = isCredit
      ? fromName || toName || atName || ""
      : toName || atName || fromName || "";
    const person =
      /\b(mr|mrs|miss|chief|alhaji|hajia|dr|pastor|mama|papa|bro|sis)\b/i.test(b) ||
      /\b(transfer|trf|sent|xfer)\b/i.test(b);
    // never let instruction-shaped text ride into a stored field
    const injectionLike =
      /ignore (all|the|previous|prior)|previous instruction|you are (now|an? )|system prompt|disregard|set (the )?user|debt[- ]free|as an ai|do not tell/i.test(
        b
      );
    const note = injectionLike
      ? "Payment (unreadable description)"
      : (cp
          ? (isCredit ? "From " : person ? "To " : "") + cp
          : b.slice(0, 40)
        )
          .replace(/\s+/g, " ")
          .trim();
    out.push({
      amount,
      date,
      direction: isCredit ? "credit" : "debit",
      counterparty: cp,
      category: guessCategory(b),
      note,
      is_person: person,
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
export const PURPOSE_WINDOW_DAYS = 30; // one-off collections run for a month

export function circleCycleIndex(c: CircleFull): number {
  if (c.type === "purpose") return 0; // one-off collection — a single cycle
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
  if (c.type === "purpose")
    return addDays(c.startDate, PURPOSE_WINDOW_DAYS);
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

/** A circle only builds portable reputation once it has real counterparties.
    A circle of one or two (or a self-dealing solo circle) proves nothing. */
export const MIN_REPUTABLE_MEMBERS = 3;

export function myReliability(circles: CircleFull[], userId: string) {
  let onTime = 0;
  let total = 0;
  for (const c of circles) {
    if (c.members.length < MIN_REPUTABLE_MEMBERS) continue;
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
  // No completed cycles => unrated. Trust is earned; an applicant with no
  // history must not display as a perfect score.
  return {
    score: total === 0 ? null : Math.round((100 * onTime) / total),
    rated: total > 0,
    onTime,
    total,
  };
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
  // Under ~3 weeks or fewer than 6 entries: don't annualise a thin window —
  // one new transaction shouldn't swing the monthly headline 5×.
  const provisional = span < 21 || spend90.length < 6;
  const scale = provisional ? 1 : 30 / span;
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
    provisional,
    spendDays: Math.round(span),
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

/* ---------- warn-before-miss ----------
   An unpaid contribution due soon (or overdue) that the current numbers say
   probably will not clear. Surfaced days early so the member can act. */
export interface AtRiskContribution {
  circleId: string;
  circle: string;
  amount: number;
  due: Date;
  days: number; // days until due; negative = overdue
  shortBy: number; // liquid shortfall against the amount
}
export function contributionsAtRisk(
  d: KoloData,
  r: StSResult
): AtRiskContribution[] {
  const out: AtRiskContribution[] = [];
  for (const c of d.circles) {
    if (!c.members.some((m) => m.userId === d.userId)) continue;
    const cur = circleCycleIndex(c);
    const st = circleContribStatus(c, cur, d.userId);
    if (st.paid) continue;
    const days = daysBetween(todayStr(), st.due);
    if (days > 5) continue; // only the 5-day window, plus anything overdue
    const cantAfford = r.availableLiquid < c.amount;
    const overCommitted = r.sts < 0;
    if (!cantAfford && !overCommitted) continue;
    out.push({
      circleId: c.id,
      circle: c.name,
      amount: c.amount,
      due: st.due,
      days,
      shortBy: Math.max(0, c.amount - r.availableLiquid),
    });
  }
  return out.sort((a, b) => a.days - b.days);
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

  // Always give the user real choices — top up to three.
  const gap = Math.max(0, -r.sts);
  const roll = monthlyRollups(d);
  if (opts.length < 3 && roll.discretionary > 0)
    opts.push({
      label: "Cut discretionary spending until " + fmtDate(r.horizon),
      gain: Math.min(gap || roll.discretionary, roll.discretionary),
      kind: "manual",
      note: "your flexible spend is " + fmt(roll.discretionary) + "/mo",
    });
  const parked = d.accounts
    .filter((a) => (!a.liquid || a.locked) && a.balance > 0)
    .sort((a, b) => b.balance - a.balance)[0];
  if (opts.length < 3 && parked)
    opts.push({
      label: 'Move money from "' + parked.name + '" into a spending account',
      gain: Math.min(gap || parked.balance, parked.balance),
      kind: "manual",
      note: fmt(parked.balance) + " is sitting there, not counted as liquid",
    });
  if (opts.length < 3)
    opts.push({
      label: "Hold non-essential purchases until " + fmtDate(r.horizon),
      gain: gap,
      kind: "manual",
      note: "the gap clears when your next income lands",
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

/* ============================================================
   CIRCLE MARKETPLACE / GROW  helpers + static data
   ============================================================ */
export function circlePot(c: { amount: number; members: unknown[] }) {
  return c.amount * c.members.length;
}
export function payoutRecipient(c: CircleFull, cycleIdx: number) {
  if (!c.members.length) return null;
  if (c.type === "purpose")
    // the whole pot goes to the organiser, who disburses it for the stated purpose
    return c.members.find((m) => m.userId === c.createdBy) || c.members[0];
  const slot = (cycleIdx % c.members.length) + 1;
  return c.members.find((m) => m.slot === slot) || null;
}
export function cyclesCompletedByUser(circles: CircleFull[], userId: string) {
  let n = 0;
  for (const c of circles) {
    if (c.members.length < MIN_REPUTABLE_MEMBERS) continue;
    const me = c.members.find((m) => m.userId === userId);
    if (!me) continue;
    const cur = circleCycleIndex(c);
    for (let i = 0; i < cur; i++) {
      if (circleCycleDue(c, i) < D(me.joinedAt)) continue;
      if (circleContribStatus(c, i, userId).paid) n++;
    }
  }
  return n;
}
export function floatProjectedYield(pot: number, days: number) {
  // simulated: ~20% p.a. money-market rate, pro-rated
  return Math.round((pot * 0.2 * days) / 365);
}

export const SEED_DISCOVER = [
  {
    id: "seed-yaba",
    code: "YABA24",
    name: "Yaba Traders Adashe",
    orgLabel: "Yaba Market Traders Assoc.",
    category: "Business",
    blurb:
      "Long-running association circle. Pot rotates monthly; organiser stakes ₦300k against default.",
    amount: 100000,
    cadence: "monthly",
    type: "rotating",
    maxSize: 15,
    memberCount: 15,
    reliabilityFloor: 88,
    guaranteeFund: 100000,
    organiserStake: 300000,
    completion: 99,
    cyclesDone: 24,
    seed: true,
  },
  {
    id: "seed-rent",
    code: "IKEJA12",
    name: "Ikeja Rent Circle 12",
    orgLabel: "Organiser: Ada O. · 96% track record",
    category: "Rent",
    blurb:
      "For members clearing annual rent. Payout timed to landlords' Q1 renewal window.",
    amount: 75000,
    cadence: "monthly",
    type: "rotating",
    maxSize: 12,
    memberCount: 9,
    reliabilityFloor: 80,
    guaranteeFund: 75000,
    organiserStake: 150000,
    completion: 100,
    cyclesDone: 6,
    seed: true,
  },
  {
    id: "seed-detty",
    code: "DETTY26",
    name: "Detty December Fund",
    orgLabel: "Organiser: Tobi A. · verified",
    category: "Target",
    blurb:
      "Everyone saves weekly; the whole fund unlocks to each member on 20 Dec. No rotation.",
    amount: 25000,
    cadence: "weekly",
    type: "target",
    maxSize: 20,
    memberCount: 15,
    reliabilityFloor: 70,
    guaranteeFund: 25000,
    organiserStake: 100000,
    completion: 97,
    cyclesDone: 4,
    seed: true,
  },
  {
    id: "seed-school",
    code: "FEESAJ",
    name: "Second-Term Fees Ajo",
    orgLabel: "Organiser: Mrs Balogun · 3 circles run",
    category: "School fees",
    blurb: "Timed so each payout lands two weeks before a school term begins.",
    amount: 60000,
    cadence: "monthly",
    type: "rotating",
    maxSize: 10,
    memberCount: 8,
    reliabilityFloor: 85,
    guaranteeFund: 60000,
    organiserStake: 180000,
    completion: 98,
    cyclesDone: 9,
    seed: true,
  },
  {
    id: "seed-biz",
    code: "STOCK08",
    name: "Balogun Stock-Up Circle",
    orgLabel: "Balogun Market Women Assoc.",
    category: "Business",
    blurb:
      "High-value restocking circle. Perfect payment record over 5 years; strict reliability floor.",
    amount: 150000,
    cadence: "monthly",
    type: "rotating",
    maxSize: 8,
    memberCount: 7,
    reliabilityFloor: 92,
    guaranteeFund: 150000,
    organiserStake: 450000,
    completion: 100,
    cyclesDone: 40,
    seed: true,
  },
];

export const NAIRA_PRODUCTS = [
  {
    name: "Money Market Fund",
    kind: "naira" as const,
    risk: "low",
    riskLabel: "Low",
    ret: "20% p.a.",
    retNote: "est., variable",
    min: 5000,
    liq: "Withdraw in 1 day",
    desc: "Pools into Treasury bills and top-bank placements. The usual home for an idle pot.",
    long:
      "A regulated naira money-market fund. Yield tracks the central bank rate and moves over time. Historically stable in value but not guaranteed; no lock-in.",
  },
  {
    name: "Treasury Bills · 91-day",
    kind: "naira" as const,
    risk: "lower",
    riskLabel: "Lower",
    ret: "22% p.a.",
    retNote: "fixed at purchase",
    min: 50000,
    liq: "Locked 91 days",
    desc: "Lending directly to the Federal Government for one quarter. Rate fixed on the day you buy.",
    long:
      "FGN Treasury bills held to maturity. The safest naira instrument here — backed by the government — but your money is locked for the full 91 days.",
  },
  {
    name: "Fixed Savings Lock",
    kind: "naira" as const,
    risk: "lower",
    riskLabel: "Lower",
    ret: "18% p.a.",
    retNote: "fixed",
    min: 10000,
    liq: "Choose 30–180 days",
    desc: "Set an amount aside for a fixed term at a rate agreed upfront. Break early and you forfeit the interest.",
    long:
      "A term deposit with a partner bank. Principal is protected; breaking the lock early costs the accrued interest, not the principal.",
  },
];
export const DOLLAR_PRODUCTS = [
  {
    name: "Dollar Fund (USD)",
    kind: "dollar" as const,
    risk: "low",
    riskLabel: "Low",
    ret: "≈6% p.a.",
    retNote: "+ naira hedge",
    min: 15000,
    liq: "Withdraw in 3 days",
    desc: "Holds US-dollar Eurobonds. Mainly a hedge against the naira sliding, with a modest yield.",
    long:
      "A dollar-denominated bond fund. The point is currency protection: if the naira weakens, your balance in naira terms rises. Bond prices can still move; FX spreads apply.",
  },
  {
    name: "Stablecoin Savings (USDC)",
    kind: "dollar" as const,
    risk: "medium",
    riskLabel: "Medium",
    ret: "≈8% p.a.",
    retNote: "variable",
    min: 2000,
    liq: "Instant",
    desc: "Hold value in dollars on-chain and earn lending yield. Instant in and out. Not NDIC-insured.",
    long:
      "Your balance is converted to USDC, a dollar-pegged stablecoin, and lent through vetted protocols for yield. Removes naira exposure and moves instantly, but adds smart-contract and custody risk, and the peg can wobble in stress.",
  },
  {
    name: "Growth Sleeve (BTC/ETH)",
    kind: "dollar" as const,
    risk: "higher",
    riskLabel: "Higher",
    ret: "Volatile",
    retNote: "can lose value fast",
    min: 5000,
    liq: "Instant",
    desc: "A small Bitcoin/Ether basket for members who want upside. Hard-capped at 10% of your balance.",
    long:
      "A market-cap-weighted basket of Bitcoin and Ether. Historically high growth over long periods and severe drops in between. Kolo caps this at 10% of your available balance so a bad run can't touch the money your circle is counting on.",
  },
];

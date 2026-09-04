/* Planning helpers for "Ask Kolo".
   Every figure a planning answer needs is computed HERE, deterministically,
   so the adviser model can narrate it without tripping the numeral guardrail. */
import { catLabel, isDisc, monthlyRollups } from "./engine";
import { daysAgo, iso } from "./format";
import type { KoloData } from "./types";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Discretionary ("wants") spend by category, normalised to a monthly figure. */
export function discretionaryByCategory(d: KoloData) {
  const spend = d.transactions.filter(
    (t) =>
      t.category &&
      isDisc(t.category) &&
      daysAgo(t.date) >= 0 &&
      daysAgo(t.date) <= 90
  );
  if (!spend.length) return [];
  const oldest = [...spend].sort((a, b) => a.date.localeCompare(b.date))[0];
  const span = Math.min(90, Math.max(7, daysAgo(oldest.date)));
  const scale = 30 / span;
  const by: Record<string, number> = {};
  spend.forEach((t) => {
    const k = t.category as string;
    by[k] = (by[k] || 0) + t.amount;
  });
  return Object.entries(by)
    .map(([id, v]) => ({ category: catLabel(id), monthly: Math.round(v * scale) }))
    .sort((a, b) => b.monthly - a.monthly);
}

/** 50/30/20 guide against real income, plus the user's actual split. */
export function budgetFrame(d: KoloData) {
  const roll = monthlyRollups(d);
  const inc = roll.income;
  return {
    monthly_income: inc,
    guide_50_30_20: inc
      ? {
          needs_max: Math.round(inc * 0.5),
          wants_max: Math.round(inc * 0.3),
          savings_min: Math.round(inc * 0.2),
        }
      : null,
    your_actual: {
      needs_committed: roll.committed,
      wants_discretionary: roll.discretionary,
      savings_goal_accruals: roll.goalsMonthly,
    },
    unallocated_each_month: roll.surplus,
  };
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const STOP_LABEL =
  /\b(by|in|before|come|this|next|within|over|for|so|and|to|month|months|year|years|week|weeks|day|days)\b.*$/i;

/** Pull a target amount, a horizon (months) and a label out of a free-text question. */
export function parsePlanRequest(q: string): {
  target: number | null;
  months: number | null;
  label: string | null;
} {
  const text = " " + q.toLowerCase().replace(/,/g, "") + " ";

  // ---- amount ----
  let target: number | null = null;
  const amt = text.match(
    /₦?\s?(\d+(?:\.\d+)?)\s?(k|m|million|thousand|grand)?\b/g
  );
  if (amt) {
    // take the largest plausible money figure mentioned
    let best = 0;
    for (const raw of amt) {
      const mm = raw.match(/(\d+(?:\.\d+)?)\s?(k|m|million|thousand|grand)?/);
      if (!mm) continue;
      let n = parseFloat(mm[1]);
      const suf = mm[2];
      if (suf === "k" || suf === "thousand" || suf === "grand") n *= 1_000;
      else if (suf === "m" || suf === "million") n *= 1_000_000;
      // ignore bare small integers that are probably "3 months", "2 people"
      if (!suf && n < 1000) continue;
      if (n > best) best = n;
    }
    if (best > 0) target = Math.round(best);
  }

  // ---- horizon ----
  let months: number | null = null;
  const inN = text.match(/\bin\s+(\d{1,2})\s+months?\b/) ||
    text.match(/\b(\d{1,2})\s+months?\b/) ||
    text.match(/\bnext\s+(\d{1,2})\s+months?\b/);
  if (inN) months = Math.min(60, parseInt(inN[1], 10));
  else if (/\bnext year\b|\bby year end\b|\bend of the year\b|\byear-end\b/.test(text)) {
    const now = new Date();
    months = 12 - now.getMonth() || 12;
  } else {
    for (let i = 0; i < 12; i++) {
      if (new RegExp("\\b(by |before |for |come )?" + MONTHS[i] + "\\b").test(text)) {
        const now = new Date();
        let m = i - now.getMonth();
        if (m <= 0) m += 12;
        months = m;
        break;
      }
    }
  }

  // ---- label ("... for a vacation by December" -> "vacation") ----
  let label: string | null = null;
  const lm = q.match(
    /(?:sav(?:e|ing)\s+(?:up\s+)?(?:for|toward|towards)|toward|towards|for)\s+(?:a |an |my |the |some )?([A-Za-z][A-Za-z '-]{2,32})/i
  );
  if (lm) {
    const cleaned = lm[1].replace(STOP_LABEL, "").trim();
    if (cleaned.length >= 3) label = cleaned;
  }

  return { target, months, label };
}

/** Turn a parsed request into a concrete sinking-fund plan. */
export function planForTarget(
  d: KoloData,
  target: number | null,
  months: number | null,
  label?: string | null
) {
  if (!target) return null;
  const roll = monthlyRollups(d);
  const capacity = Math.max(0, roll.surplus);
  const disc = discretionaryByCategory(d);
  const goalName = (label || "vacation").replace(/^./, (c) => c.toUpperCase());

  const out: Record<string, unknown> = {
    target,
    unallocated_monthly_now: capacity,
  };

  if (months && months > 0) {
    const required = Math.ceil(target / months);
    const deadline = new Date();
    deadline.setDate(1);
    deadline.setMonth(deadline.getMonth() + months);
    out.months = months;
    out.required_monthly = required;
    out.covered_by_unallocated = capacity >= required;
    out.monthly_shortfall = Math.max(0, required - capacity);
    if (required > capacity && disc.length) {
      out.trim_candidates = disc.slice(0, 4);
    }
    // engine-built spec the UI turns into a pre-filled "New goal" sheet
    out.suggested_goal = {
      name: goalName,
      target,
      deadline_iso: iso(deadline),
      monthly: required,
      priority: 1,
    };
  } else {
    out.months_at_current_pace =
      capacity > 0 ? Math.ceil(target / capacity) : null;
  }
  return out;
}

/** "what would ₦500,000 grow to in 3 years at 25% a year" */
export function parseGrowthQuestion(q: string): {
  principal: number | null;
  ratePct: number | null;
  years: number | null;
} {
  const t = " " + q.toLowerCase().replace(/,/g, "") + " ";

  let principal: number | null = null;
  const amts = t.match(/₦?\s?(\d+(?:\.\d+)?)\s?(k|m|million|thousand|grand)?\b/g);
  if (amts) {
    let best = 0;
    for (const raw of amts) {
      const mm = raw.match(/(\d+(?:\.\d+)?)\s?(k|m|million|thousand|grand)?/);
      if (!mm) continue;
      let n = parseFloat(mm[1]);
      const suf = mm[2];
      if (suf === "k" || suf === "thousand" || suf === "grand") n *= 1_000;
      else if (suf === "m" || suf === "million") n *= 1_000_000;
      if (!suf && n < 1000) continue;
      if (n > best) best = n;
    }
    if (best > 0) principal = Math.round(best);
  }

  let ratePct: number | null = null;
  const rm =
    t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|per ?cent)/) ||
    t.match(/at\s+(\d+(?:\.\d+)?)\s+(?:a|per)\s+year/);
  if (rm) ratePct = Math.min(200, parseFloat(rm[1]));

  let years: number | null = null;
  const ym =
    t.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/) ||
    t.match(/(?:over|in|after|for)\s+(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
  if (ym) years = Math.min(50, parseFloat(ym[1]));

  return { principal, ratePct, years };
}

/** Plain compound arithmetic on a rate the user supplied — NOT a forecast. */
export function projectGrowth(principal: number, ratePct: number, years: number) {
  const r = ratePct / 100;
  const whole = Math.min(50, Math.ceil(years));
  const yearly: { year: number; value: number }[] = [];
  let v = principal;
  for (let i = 1; i <= whole; i++) {
    v = v * (1 + r);
    yearly.push({ year: i, value: Math.round(v) });
  }
  const future = Math.round(principal * Math.pow(1 + r, years));
  return {
    principal,
    annual_rate_pct: ratePct,
    years,
    future_value: future,
    total_gain: future - principal,
    yearly,
    caveat:
      "straight compounding at the rate the user gave — not a forecast; real returns move and can be negative",
  };
}

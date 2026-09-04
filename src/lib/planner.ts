/* Planning helpers for "Ask Kolo".
   Every figure a planning answer needs is computed HERE, deterministically,
   so the adviser model can narrate it without tripping the numeral guardrail. */
import { catLabel, isDisc, monthlyRollups } from "./engine";
import { daysAgo } from "./format";
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

/** Pull a target amount and a horizon (in months) out of a free-text question. */
export function parsePlanRequest(q: string): {
  target: number | null;
  months: number | null;
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

  return { target, months };
}

/** Turn a parsed request into a concrete sinking-fund plan. */
export function planForTarget(
  d: KoloData,
  target: number | null,
  months: number | null
) {
  if (!target) return null;
  const roll = monthlyRollups(d);
  const capacity = Math.max(0, roll.surplus);
  const disc = discretionaryByCategory(d);

  const out: Record<string, unknown> = {
    target,
    unallocated_monthly_now: capacity,
  };

  if (months && months > 0) {
    const required = Math.ceil(target / months);
    out.months = months;
    out.required_monthly = required;
    out.covered_by_unallocated = capacity >= required;
    out.monthly_shortfall = Math.max(0, required - capacity);
    if (required > capacity && disc.length) {
      out.trim_candidates = disc.slice(0, 4);
    }
  } else {
    out.months_at_current_pace =
      capacity > 0 ? Math.ceil(target / capacity) : null;
  }
  return out;
}

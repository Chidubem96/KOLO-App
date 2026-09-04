import {
  circleContribStatus,
  circleCycleIndex,
  goalRunRate,
  monthlyRollups,
  myReliability,
  safeToSpend,
} from "./engine";
import {
  budgetFrame,
  discretionaryByCategory,
  parseGrowthQuestion,
  parsePlanRequest,
  planForTarget,
  projectGrowth,
} from "./planner";
import { fmtDateY, fmtMonthY, iso, monthsUntil, todayStr } from "./format";
import type { KoloData } from "./types";

export function buildAskContext(d: KoloData, question?: string) {
  const r = safeToSpend(d);
  const roll = monthlyRollups(d);
  const rel = myReliability(d.circles, d.userId);

  const goals = d.goals.map((g) => {
    const remaining = Math.max(0, g.target - g.saved);
    const monthsLeft = Math.max(1, Math.ceil(monthsUntil(g.deadline)));
    const rate = goalRunRate(g);
    return {
      name: g.name,
      target: g.target,
      saved: g.saved,
      remaining,
      deadline: fmtMonthY(g.deadline),
      required_monthly_to_hit_deadline: Math.ceil(remaining / monthsLeft),
      recent_monthly_rate: rate,
      months_to_finish_at_recent_rate: rate > 0 ? Math.ceil(remaining / rate) : null,
      paused: g.paused,
    };
  });

  const circles = d.circles.map((c) => {
    const cur = circleCycleIndex(c);
    const st = circleContribStatus(c, cur, d.userId);
    return {
      name: c.name,
      amount: c.amount,
      cadence: c.cadence,
      members: c.members.length,
      next_contribution_due: fmtDateY(st.due),
      my_contribution_paid: st.paid,
    };
  });

  const ctx = {
    today: fmtDateY(todayStr()),
    currency: "NGN (naira)",
    safe_to_spend: r.sts,
    horizon_date: fmtDateY(r.horizon),
    available_liquid_balance: r.availableLiquid,
    account_count: r.accountCount,
    figure_is_partial: r.partial,
    subtractions: {
      bills_and_obligations_before_income: r.obligTotal,
      circle_contributions_this_period: r.circleTotal,
      goal_accruals_this_period: r.goalTotal,
      volatility_buffer: r.buffer.value,
      buffer_k: d.profile.bufferK,
      buffer_note:
        "the buffer is k × spending volatility; k is " +
        d.profile.bufferK +
        ", set on the Settings slider. There is no other buffer setting.",
    },
    monthly_pattern: {
      income: roll.income,
      committed_spending: roll.committed,
      discretionary_spending: roll.discretionary,
      goal_accruals: roll.goalsMonthly,
      surplus: roll.surplus,
    },
    goals,
    circles,
    reliability_score: rel.score,
    reliability_rated: rel.rated,
    budget_frame: budgetFrame(d),
    discretionary_by_category: discretionaryByCategory(d).slice(0, 6),
    assumptions: {
      salary_lands_on_day: d.profile.salaryDay,
      rent_monthly: d.profile.rent,
      income_pattern: d.profile.incomeType,
    },
  } as Record<string, unknown>;

  if (question) {
    const { target, months, label } = parsePlanRequest(question);
    const plan = planForTarget(d, target, months, label);
    if (plan) ctx.planning_request = plan;

    const g = parseGrowthQuestion(question);
    if (g.principal && g.ratePct != null && g.years) {
      ctx.growth_projection = projectGrowth(g.principal, g.ratePct, g.years);
    }
  }

  const roundDeep = (v: any): any => {
    if (typeof v === "number" && Number.isFinite(v))
      return Math.abs(v) >= 1000 ? Math.round(v / 100) * 100 : Math.round(v);
    if (Array.isArray(v)) return v.map(roundDeep);
    if (v && typeof v === "object") {
      const o: any = {};
      for (const k in v) o[k] = roundDeep(v[k]);
      return o;
    }
    return v;
  };
  return roundDeep(ctx);
}

export function assumeLine(ctx: any): string {
  const parts = [
    ctx.assumptions.income_pattern === "salaried" &&
    ctx.assumptions.salary_lands_on_day
      ? "salary lands on the " + ctx.assumptions.salary_lands_on_day
      : null,
    ctx.assumptions.rent_monthly
      ? "rent is ₦" +
        Math.round(ctx.assumptions.rent_monthly).toLocaleString("en-NG") +
        "/mo"
      : null,
  ].filter(Boolean);
  return "Assuming " + (parts.join(" · ") || "the figures in Settings are current.");
}

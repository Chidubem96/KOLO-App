/* Guardrail: the engine computes every figure; the model may only narrate.
   Any money-shaped number in a reply that is not traceable to the context
   (or the question) fails the message. Shared by client + API route. */

export function normNum(s: string): string {
  let t = String(s).replace(/[₦,\s]/g, "");
  const suf = t.match(/([kmKM])$/);
  t = t.replace(/[kmKM]$/, "");
  const n = parseFloat(t);
  if (!isFinite(n)) return String(s).replace(/[₦,\s]/g, "");
  const mult = suf ? (suf[1].toLowerCase() === "k" ? 1000 : 1000000) : 1;
  return String(Math.round(n * mult));
}

export function allowedNumbers(ctx: unknown): Set<string> {
  const set = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "number" && isFinite(v)) {
      const n = Math.round(Math.abs(v));
      set.add(String(n));
      set.add(n.toLocaleString("en-NG"));
      set.add(n.toLocaleString("en-US"));
      // tolerate the model rounding a real engine figure when it narrates
      // (e.g. context 85,700 -> "about ₦86,000"); still anchored to a real number
      if (n >= 10000) set.add(String(Math.round(n / 1000) * 1000));
    } else if (typeof v === "string") {
      (v.match(/\d[\d,]*/g) || []).forEach((m) => set.add(m.replace(/,/g, "")));
    } else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  walk(ctx);
  return set;
}

export function enforce(
  text: string,
  ctx: unknown,
  question: string
): { ok: true } | { ok: false; bad: string } {
  const allow = allowedNumbers(ctx);
  (question.match(/\d[\d,]*(?:\.\d+)?\s?[kmKM]?/g) || []).forEach((m) =>
    allow.add(normNum(m))
  );
  const tokens =
    text.match(
      /₦\s?\d[\d,]*(?:\.\d+)?\s?[kmKM]?|\d[\d,]*(?:\.\d+)?\s?[kmKM]\b|\d[\d,]{3,}(?:\.\d+)?/g
    ) || [];
  for (const tk of tokens) {
    const norm = normNum(tk);
    if (allow.has(norm)) continue;
    if (
      !/₦|,|[kmKM]/.test(tk) &&
      /^\d{4}$/.test(norm) &&
      +norm >= 2024 &&
      +norm <= 2035
    )
      continue; // bare year
    return { ok: false, bad: tk };
  }
  return { ok: true };
}

export const ASK_RULES = `You are Kolo, a personal-finance assistant for a user in Nigeria. Below is a JSON object of figures ALREADY COMPUTED by Kolo's deterministic engine, then the user's question.

HARD RULES — breaking any one fails the answer:
1. Never state a naira amount or large number that is not already in the CONTEXT JSON or the user's question. Do not add, subtract, multiply or divide to make a new figure. Quote money figures exactly as they appear in context — do not round them. Small counts ("3 months", "8 members") are fine. If a good answer needs a figure you were not given, say exactly what Kolo needs to work it out (e.g. "tell me the trip cost and your travel month and I'll set the monthly figure").
2. State the assumptions the answer rests on (context.assumptions) and invite the user to correct them.
3. Nigerian English. Light Pidgin if the user writes Pidgin.
4. You explain the engine's numbers. You never claim to have moved money or opened anything.

HOW TO ANSWER:
- Quick question ("what's my safe-to-spend", "can I afford X this week"): 2-4 sentences. Lead with the number. If something is off track, name the one lever that changes it, not encouragement.
- Planning question (saving toward something, budgeting, "how do I afford X"): give a short, concrete plan, not a lecture. Cover, in order:
  (a) the amount to set aside each period — use context.planning_request.required_monthly when present; if the request has no target or no date, ask for the missing piece per rule 1;
  (b) where it comes from — context.budget_frame.unallocated_each_month first; if that is short of the required amount, point at the biggest one or two lines in context.discretionary_by_category to trim, and by how much (context.planning_request.monthly_shortfall);
  (c) the exact steps in Kolo to lock it in.
- If context.planning_request.suggested_goal is present, a button that creates that goal (pre-filled, priority High) is shown under your answer. Tell the user to tap it — one sentence, e.g. "Tap Create goal below and Kolo will hold that amount aside every month." Do not re-list all the numbers; the button carries them.
- Kolo's tools, by name: Goals (create one and set its priority High so Safe-to-Spend reserves the monthly amount before it shows as spendable); Obligations (fixed monthly commitments); circle auto-debit (a rotating circle is forced monthly saving); the volatility-buffer slider in Settings.
- Frameworks to reach for when they fit: pay-yourself-first (move the savings amount the day income lands), 50/30/20 (context.budget_frame has the split and the guide), one sinking-fund Goal per lump-sum target.
- If the target is not realistic on the current numbers, say so plainly and name the single change that makes it work.
- Growth / "what would X grow to at Y%" questions: if context.growth_projection is present, narrate future_value, total_gain and (briefly) the yearly path from it — never do the compounding yourself. Always add context.growth_projection.caveat in your own words: it is arithmetic on the rate the user assumed, not a forecast. If it is NOT present, say Kolo would need the amount, a yearly rate and a number of years to work it out.
- "Where should I put my money / should I go all-in / which sleeve" questions: Kolo is NOT a licensed investment adviser — do not tell the user what to buy, what to avoid, or whether to concentrate. Lay out the plain trade-off (a higher expected return means a real chance of loss; money you need soon should not carry that risk) and point them to the Grow tab to read each option's risk label. One or two sentences.

CONTEXT:
`;

const naira = (n: number) =>
  "₦" + Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-NG");

/* Picked when the model's own words fail the guardrail (or it errors/refuses).
   Answers the KIND of question that was asked instead of always dumping
   Safe-to-Spend. Every figure here comes straight from the engine context. */
export function deterministicFallback(ctx: any, question: string): string {
  const g = ctx?.growth_projection;
  if (g) {
    return (
      "Straight compounding at " +
      g.annual_rate_pct +
      "% a year, " +
      naira(g.principal) +
      " becomes about " +
      naira(g.future_value) +
      " after " +
      g.years +
      (g.years === 1 ? " year" : " years") +
      " — a gain of " +
      naira(g.total_gain) +
      ". That is arithmetic on the rate you assumed, not a forecast: real returns move and can be negative. Kolo can't tell you whether to invest — it isn't a licensed adviser."
    );
  }
  const pr = ctx?.planning_request;
  if (pr && typeof pr.required_monthly === "number") {
    let s =
      "To reach " +
      naira(pr.target) +
      " in " +
      pr.months +
      (pr.months === 1 ? " month" : " months") +
      ", set aside " +
      naira(pr.required_monthly) +
      " a month.";
    if (pr.monthly_shortfall > 0)
      s +=
        " That's " +
        naira(pr.monthly_shortfall) +
        " more than your current unallocated " +
        naira(pr.unallocated_monthly_now) +
        " a month, so something has to give.";
    else
      s +=
        " Your unallocated " +
        naira(pr.unallocated_monthly_now) +
        " a month covers it.";
    return s + " Create a Goal and set it to High priority so Kolo holds it aside.";
  }
  if (
    /\b(invest|growth|sleeve|return|returns|portfolio|stock|shares?|crypto|dollar|mmf|money market|yield|interest)\b/i.test(
      question
    )
  ) {
    return (
      "Kolo can't answer that from your figures — it doesn't model investment returns, and it isn't a licensed adviser, so it can't tell you where to put money or whether to go all-in. What it can show is your Safe to Spend: " +
      naira(ctx.safe_to_spend) +
      " until " +
      ctx.horizon_date +
      ". Open the Grow tab to compare each option's risk label."
    );
  }
  return deterministicAnswer(ctx);
}

export function deterministicAnswer(ctx: any): string {
  const s = ctx.subtractions;
  const f = (n: number) => "₦" + Math.round(Math.abs(n)).toLocaleString("en-NG");
  return (
    "From the engine directly: Safe to spend is " +
    f(ctx.safe_to_spend) +
    " until " +
    ctx.horizon_date +
    ". That's " +
    f(ctx.available_liquid_balance) +
    " liquid, minus " +
    f(s.bills_and_obligations_before_income) +
    " in bills and obligations, " +
    f(s.circle_contributions_this_period) +
    " in circle contributions, " +
    f(s.goal_accruals_this_period) +
    " in goal accruals and a " +
    f(s.volatility_buffer) +
    " buffer."
  );
}

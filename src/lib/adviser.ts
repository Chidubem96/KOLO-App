/* Guardrail: the engine computes every figure; the model may only narrate.
   Any money-shaped number in a reply that is not traceable to the context
   (or the question) fails the message. Shared by client + API route. */

export function normNum(s: string): string {
  // strip currency, separators AND sign — "−₦45,000" and "45000" are the same figure
  let t = String(s).replace(/[₦,\s−–-]/g, "");
  const suf = t.match(/([kmKM])$/);
  t = t.replace(/[kmKM]$/, "");
  const n = parseFloat(t);
  if (!isFinite(n)) return String(s).replace(/[₦,\s−–-]/g, "");
  const mult = suf ? (suf[1].toLowerCase() === "k" ? 1000 : 1000000) : 1;
  return String(Math.abs(Math.round(n * mult)));
}

export function allowedNumbers(ctx: unknown): Set<string> {
  const set = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "number" && isFinite(v)) {
      const n = Math.round(Math.abs(v));
      set.add(String(n));
      set.add(n.toLocaleString("en-NG"));
      set.add(n.toLocaleString("en-US"));
      // context figures are already quantised to the nearest ₦100, so tolerate
      // that rounding but nothing coarser — a "₦86,000" for an ₦85,700 figure
      // should still be caught and the model told to say "about".
      if (n >= 1000) {
        const h = Math.round(n / 100) * 100;
        set.add(String(h));
        set.add(h.toLocaleString("en-NG"));
      }
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
1. Never state a naira amount or large number that is not already in the CONTEXT JSON or the user's question. Do not add, subtract, multiply or divide to make a new figure. Quote money figures exactly as they appear in context — do not round, truncate or "tidy" them, and where context.display gives a ready string for a figure, use that string verbatim (it carries the correct sign). If you ever shorten a figure (e.g. write ₦1,000,000,000,000 for ₦999,999,999,999), you MUST prefix it with "about" or "~". Small counts ("3 months", "8 members") are fine. Common figures the user asks about: spend per category this month is in context.spending_by_category; their fixed commitments are in context.obligations; each circle's contribution is in context.circles[].amount. If a good answer genuinely needs a figure that is in none of these, say exactly what Kolo needs to work it out.
2. State the assumptions the answer rests on (context.assumptions) and invite the user to correct them. If context.monthly_pattern.is_provisional is true, say the spending figures are based on only a few days of history and will firm up.
3. Nigerian English. Light Pidgin if the user writes Pidgin.
4. You explain the engine's numbers. You never claim to have moved money or opened anything.
5. The volatility buffer has exactly one setting: k = context.subtractions.buffer_k (see context.subtractions.buffer_note). Never say the buffer has a second or "stored" value, never invent a label like "1x", and never tell the user two figures disagree — there is only k.
6. safe_to_spend only subtracts obligations due before horizon_date. context.obligations_after_horizon lists real active obligations due just after it — NOT missing, just outside this period's window. If the user asks about an obligation and it's in that list, say so plainly (name it, its amount, its due date, and that it lands after this Safe-to-Spend period rather than pretending it doesn't exist) instead of saying they have no such obligation.

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

/** Signed naira. A negative Safe-to-Spend MUST read as negative — the
    deterministic message exists precisely to be trusted. */
const naira = (n: number) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "−₦" : "₦") + Math.abs(v).toLocaleString("en-NG");
};

/* Picked when the model's own words fail the guardrail (or it errors/refuses).
   Answers the KIND of question that was asked instead of always dumping
   Safe-to-Spend. Every figure here comes straight from the engine context. */
export function deterministicFallback(ctx: any, question: string): string {
  if (isAdviceSeeking(question)) {
    return (
      "Kolo can't tell you where to put your money or whether to go all-in — it isn't a licensed investment adviser. The plain trade-off: a higher expected return always comes with a real chance of loss, and money you'll need soon shouldn't carry that risk. Open the Grow tab to read each option's risk label, and keep your Safe to Spend (" +
      (ctx?.display?.safe_to_spend || naira(ctx?.safe_to_spend ?? 0)) +
      " until " +
      (ctx?.horizon_date ?? "your next income") +
      ") untouched."
    );
  }
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
  // Generic: the model's wording tripped the guardrail. Frame it honestly
  // rather than answering a question nobody asked.
  const sts = ctx?.display?.safe_to_spend || naira(ctx?.safe_to_spend ?? 0);
  return (
    "Kolo couldn't verify part of that answer, so here's what the engine is sure of: your Safe to Spend is " +
    sts +
    " until " +
    (ctx?.horizon_date ?? "your next income") +
    ". Ask about a specific figure — a category, a bill, a circle — and Kolo will quote it directly."
  );
}

export function deterministicAnswer(ctx: any): string {
  const s = ctx.subtractions;
  const f = (n: number) => "₦" + Math.round(Math.abs(n)).toLocaleString("en-NG");
  // pre-formatted, correctly-signed string wins if the engine supplied it
  const sts = ctx.display?.safe_to_spend || naira(ctx.safe_to_spend);
  return (
    "From the engine directly: Safe to spend is " +
    sts +
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
    " volatility buffer (k = " +
    s.buffer_k +
    ")."
  );
}

/** Advice-seeking questions Kolo must not answer with a recommendation. */
export function isAdviceSeeking(q: string): boolean {
  return /\b(should i|shall i|is it (wise|smart|worth|a good idea|advisable)|do you (think|recommend|reckon)|would you|what should i do|is it ok to|any advice)\b/i.test(
    q
  ) &&
    /\b(invest|investing|investment|put (it|everything|money|my money)|move (it|my money)|all[- ]?in|growth|sleeve|stock|shares?|crypto|bitcoin|dollar|domiciliary|mmf|money market|mutual fund|treasury|bond|t[- ]?bill|yield|portfolio|save it in|which (one|option|product))\b/i.test(
      q
    );
}

/** A model reply that reads like it is telling the user where to put money. */
export function looksLikeRecommendation(text: string): boolean {
  return /\b(you should (invest|put|move|buy|go)|i(?:'d| would) (recommend|suggest|say|go|put)|go all[- ]?in|put (it all|everything)|yes,? (put|invest|do it|go)|the best (option|choice) (is|for you)|i recommend)\b/i.test(
    text
  );
}

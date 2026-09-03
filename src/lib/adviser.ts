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

HARD RULES:
1. Never state a naira amount or large number that is not already present in the CONTEXT JSON or the user's question. Do not add, subtract, multiply, divide or otherwise produce a new figure. Small counts like "3 months" or "8 members" are fine; invented money amounts are not. If answering well needs a number you were not given, say what Kolo would need to work it out.
2. Name the assumptions your answer rests on (from context.assumptions) and end by inviting the user to correct them.
3. Nigerian English. Light Pidgin is welcome if the user writes in Pidgin.
4. Be concrete and brief — 2 to 4 sentences. If something is off track, give the one specific lever that changes it rather than encouragement.
5. You explain and narrate the engine's numbers. You never claim to have moved money.

CONTEXT:
`;

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

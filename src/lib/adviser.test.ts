import { describe, it, expect } from "vitest";
import {
  normNum,
  enforce,
  deterministicFallback,
  deterministicAnswer,
  isAdviceSeeking,
  looksLikeRecommendation,
} from "./adviser";

describe("normNum", () => {
  it("treats a signed figure and its magnitude as equal", () => {
    expect(normNum("−₦999,998,589,999")).toBe(normNum("999998589999"));
    expect(normNum("-45,000")).toBe("45000");
    expect(normNum("₦45,000")).toBe("45000");
    expect(normNum("1.2m")).toBe("1200000");
  });
});

describe("enforce (numeral guard)", () => {
  const ctx = {
    safe_to_spend: -999_998_589_999,
    horizon_date: "25 Sept 2026",
    display: { safe_to_spend: "−₦999,998,589,999" },
    spending_by_category: [{ category: "Sent home", this_month: 45000 }],
    circles: [{ name: "Test Circle", amount: 10000 }],
  };

  it("passes a reply that quotes a negative context figure with its sign", () => {
    const r = enforce(
      "Your safe to spend is −₦999,998,589,999 until 25 Sept 2026.",
      ctx,
      "what is my safe to spend"
    );
    expect(r.ok).toBe(true);
  });

  it("passes a reply quoting a real category figure", () => {
    const r = enforce(
      "You've sent ₦45,000 home this month, and your Test Circle contribution is ₦10,000.",
      ctx,
      "how much did I send home and what is my circle contribution"
    );
    expect(r.ok).toBe(true);
  });

  it("still rejects an invented figure", () => {
    const r = enforce("You could save ₦777,777 a month.", ctx, "how do I save");
    expect(r.ok).toBe(false);
  });
});

describe("deterministic answers keep the sign", () => {
  const ctx = {
    safe_to_spend: -999_998_589_999,
    horizon_date: "25 Sept 2026",
    display: { safe_to_spend: "−₦999,998,589,999" },
    subtractions: {
      bills_and_obligations_before_income: 0,
      circle_contributions_this_period: 999_999_999_999,
      goal_accruals_this_period: 0,
      volatility_buffer: 90_000,
      buffer_k: 0.5,
    },
    available_liquid_balance: 1_500_000,
  };

  it("deterministicAnswer reports a negative balance as negative", () => {
    const s = deterministicAnswer(ctx);
    expect(s).toContain("−₦999,998,589,999");
    expect(s).not.toMatch(/is ₦999,998,5/); // never a bare positive
  });

  it("deterministicFallback reports a negative balance as negative", () => {
    const s = deterministicFallback(ctx, "tell me something vague");
    expect(s).toContain("−₦");
  });
});

describe("investment-advice guard", () => {
  it("flags advice-seeking questions", () => {
    expect(isAdviceSeeking("Should I put everything into the growth sleeve?")).toBe(true);
    expect(isAdviceSeeking("just answer yes or no — should I invest it all in crypto")).toBe(true);
    expect(isAdviceSeeking("how much did I spend on food")).toBe(false);
  });
  it("detects recommendation language", () => {
    expect(looksLikeRecommendation("Yes, put it all in the dollar fund.")).toBe(true);
    expect(looksLikeRecommendation("I'd recommend the money market fund.")).toBe(true);
    expect(looksLikeRecommendation("A higher return means more risk.")).toBe(false);
  });
});

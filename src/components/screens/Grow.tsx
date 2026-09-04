"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import {
  circleCycleIndex,
  circlePot,
  DOLLAR_PRODUCTS,
  floatProjectedYield,
  NAIRA_PRODUCTS,
  safeToSpend,
} from "@/lib/engine";
import { fmt, sum } from "@/lib/format";
import { InvestSheet } from "../sheets/InvestSheet";
import { FloatVoteSheet } from "../sheets/FloatVoteSheet";

export function Grow() {
  const { data } = useKolo();
  const d = data!;
  const sheet = useSheet();
  const r = safeToSpend(d);

  const invested = sum(d.investments.map((i) => i.amount));
  const idle = Math.max(0, r.availableLiquid - Math.max(0, r.sts) - invested);

  const floatCircle = d.circles.find(
    (c) => c.floatEnabled && c.members.some((m) => m.userId === d.userId)
  );

  return (
    <div className="pad">
      <div className="scr-head">
        <div>
          <h1>Grow</h1>
          <div className="meta">Put money to work between payouts</div>
        </div>
      </div>

      <div className="idle">
        <div className="tag">Available to invest</div>
        <div className="amount">{fmt(idle)}</div>
        <div className="note">
          Liquid balance that isn&apos;t already spoken for by Safe-to-Spend. Withdraw any time the
          option allows.
        </div>
      </div>

      {invested > 0 && (
        <>
          <div className="section-label">Your positions</div>
          <div className="card tight">
            {d.investments.map((i) => (
              <div key={i.id} className="kv">
                <span className="lab">{i.product}</span>
                <span className="num">{fmt(i.amount)}</span>
              </div>
            ))}
            <div className="kv">
              <span className="lab" style={{ color: "var(--ink)", fontWeight: 600 }}>
                Total invested
              </span>
              <span className="num" style={{ color: "var(--pos)" }}>
                {fmt(invested)}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="section-label">Lower risk · naira</div>
      <div className="card tight">
        {NAIRA_PRODUCTS.map((o) => (
          <button key={o.name} className="io" onClick={() => sheet.open(<InvestSheet product={o} idle={idle} />)}>
            <div className="io-main">
              <div className="io-nm">
                {o.name} <span className={"risk " + o.risk}>{o.riskLabel}</span>
              </div>
              <div className="io-desc">{o.desc}</div>
              <div className="io-desc" style={{ color: "var(--mut)", marginTop: 4 }}>
                {o.liq} · min {fmt(o.min)}
              </div>
            </div>
            <div className="io-ret">
              <b>{o.ret}</b>
              <small>{o.retNote}</small>
            </div>
          </button>
        ))}
      </div>

      <div className="section-label">Dollar & crypto</div>
      <div className="card tight">
        {DOLLAR_PRODUCTS.map((o) => (
          <button key={o.name} className="io" onClick={() => sheet.open(<InvestSheet product={o} idle={idle} />)}>
            <div className="io-main">
              <div className="io-nm">
                {o.name} <span className={"risk " + o.risk}>{o.riskLabel}</span>
              </div>
              <div className="io-desc">{o.desc}</div>
              <div className="io-desc" style={{ color: "var(--mut)", marginTop: 4 }}>
                {o.liq} · min {fmt(o.min)}
              </div>
            </div>
            <div className="io-ret">
              <b>{o.ret}</b>
              <small>{o.retNote}</small>
            </div>
          </button>
        ))}
      </div>

      {floatCircle && (
        <>
          <div className="section-label">Circle float</div>
          <div className="float-vote">
            <b>{floatCircle.name}</b> can hold this cycle&apos;s{" "}
            {fmt(circlePot(floatCircle))} pot in the Money Market Fund until payout day. Projected
            yield <b>{fmt(floatProjectedYield(circlePot(floatCircle), 14))}</b>, split{" "}
            {floatCircle.members.length} ways. You can opt your share out.
            <div style={{ marginTop: 10 }}>
              <button
                className="btn ghost sm"
                onClick={() =>
                  sheet.open(
                    <FloatVoteSheet
                      circleId={floatCircle.id}
                      cycle={circleCycleIndex(floatCircle)}
                    />
                  )
                }
              >
                See the vote
              </button>
            </div>
          </div>
        </>
      )}

      <p className="disclosure">
        Estimated returns are illustrative and <b>not guaranteed</b>. Naira funds carry issuer and
        interest-rate risk. Dollar and stablecoin options carry currency and platform risk and are
        not NDIC-insured. The growth sleeve is volatile and capped at 10% of your balance. Kolo is
        not a licensed investment adviser; this prototype shows figures for illustration only and
        moves no real money.
      </p>
    </div>
  );
}

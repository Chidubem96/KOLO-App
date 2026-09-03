"use client";
import { useEffect, useRef, useState } from "react";
import { useKolo } from "@/lib/store";
import {
  homeNudge,
  monthlyAccrual,
  recoveryOptions,
  safeToSpend,
} from "@/lib/engine";
import { saveProfile, updateGoal } from "@/lib/api";
import { fmt, fmtDate, fmtSigned, clamp } from "@/lib/format";
import { Icon } from "../ui";

export function Home({ goTo }: { goTo: (t: any) => void }) {
  const { data, reload, recurringPosted, clearRecurringNote } = useKolo();
  const d = data!;
  const r = safeToSpend(d);
  const [open, setOpen] = useState<string | null>(null);
  const figRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = figRef.current;
    if (!node || window.matchMedia("(prefers-reduced-motion:reduce)").matches) {
      if (node) node.textContent = fmtSigned(r.sts);
      return;
    }
    const target = r.sts;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = clamp((now - start) / 260, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmtSigned(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else node.textContent = fmtSigned(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [r.sts]);

  const neg = r.sts < 0;
  const rows = [
    {
      key: "oblig",
      label: "Bills & obligations",
      sub: "due before " + fmtDate(r.horizon),
      val: r.obligTotal,
      items: r.obligItems,
    },
    {
      key: "circle",
      label: "Circle contributions",
      sub: r.circleItems.length + " due this period",
      val: r.circleTotal,
      items: r.circleItems,
    },
    {
      key: "goal",
      label: "Goal accruals",
      sub:
        r.goalItems.length +
        " active goal" +
        (r.goalItems.length === 1 ? "" : "s"),
      val: r.goalTotal,
      items: r.goalItems,
    },
    {
      key: "buffer",
      label: "Volatility buffer",
      sub: "k = " + d.profile.bufferK + " · " + r.buffer.basis,
      val: r.buffer.value,
      items: null as any,
    },
  ];

  const nudge = homeNudge(d, r);

  return (
    <div className="pad">
      <div className="hero">
        <div className="hero-kick">
          Safe to spend · until {fmtDate(r.horizon)}
        </div>
        <div
          ref={figRef}
          className={"hero-fig" + (neg ? " neg" : "")}
        >
          {fmtSigned(r.sts)}
        </div>
        <div className="hero-sub">
          of <b>{fmt(r.availableLiquid)}</b> across {r.accountCount} account
          {r.accountCount === 1 ? "" : "s"}. Every line below is tappable.
        </div>
        {r.partial && (
          <div className="partial-tag">Partial — {r.reasons.join(" · ")}</div>
        )}
      </div>

      <div className="brk">
        {rows.map((row) => (
          <div key={row.key}>
            <button
              className={"brk-row" + (open === row.key ? " open" : "")}
              onClick={() => setOpen(open === row.key ? null : row.key)}
            >
              <div className="l">
                {row.label}
                <small>{row.sub}</small>
              </div>
              <div className="v minus">−{fmt(row.val)}</div>
              <span className="chev">{Icon.chev}</span>
            </button>
            {open === row.key && (
              <div className="brk-detail">
                {row.key === "buffer" ? (
                  <>
                    <div className="brk-line">
                      <span>
                        {r.buffer.weak
                          ? "Estimated at 12% of liquid balance until Kolo has 2+ weeks of spending history."
                          : "Half a standard deviation of your weekly discretionary spend over 90 days."}
                      </span>
                    </div>
                    <div style={{ padding: 8 }}>
                      <div className="kicker" style={{ marginBottom: 6 }}>
                        Buffer sensitivity — k = {d.profile.bufferK}
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.1}
                        defaultValue={d.profile.bufferK}
                        style={{ width: "100%" }}
                        onChange={async (e) => {
                          await saveProfile(d.userId, {
                            buffer_k: Number(e.target.value),
                          });
                          reload();
                        }}
                      />
                    </div>
                  </>
                ) : row.items && row.items.length ? (
                  row.items.map((it: any, i: number) => (
                    <div key={i} className="brk-line">
                      <span>
                        {it.label}
                        {it.due ? " · " + fmtDate(it.due) : ""}
                      </span>
                      <span className="mono">−{fmt(it.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="brk-line">
                    <span>Nothing in this bucket right now.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="brk-total">
          <div className="l">Safe to spend</div>
          <div className="v">{fmtSigned(r.sts)}</div>
          <span />
        </div>
      </div>

      {neg && (
        <div
          className="card"
          style={{ marginTop: 16, borderColor: "var(--critical-wash)" }}
        >
          <p
            className="kicker"
            style={{ color: "var(--critical)", marginBottom: 8 }}
          >
            Three ways back — pick one
          </p>
          {recoveryOptions(d, r).opts.map((o, i) => (
            <div
              key={i}
              className="lrow"
              style={{ cursor: "default" }}
            >
              <div className="grow">
                <div className="t" style={{ fontSize: 13.5 }}>
                  {o.label}
                </div>
                {o.note && <div className="s">{o.note}</div>}
              </div>
              <div className="r" style={{ color: "var(--good)" }}>
                +{fmt(o.gain)}
              </div>
              {o.kind !== "manual" && (
                <button
                  className="btn sm brass"
                  onClick={async () => {
                    if (o.kind === "pauseGoal" && o.id)
                      await updateGoal(o.id, { paused: true });
                    if (o.kind === "zeroBuffer")
                      await saveProfile(d.userId, { buffer_k: 0 });
                    reload();
                  }}
                >
                  Do it
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {recurringPosted > 0 && (
        <div
          className="advise"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>
            <b style={{ display: "inline", margin: 0 }}>Auto-logged&nbsp;&nbsp;</b>
            {recurringPosted} recurring{" "}
            {recurringPosted === 1 ? "payment" : "payments"} posted — rent, dues
            and mandates you don&apos;t re-enter.
          </span>
          <button className="btn sm ghost" onClick={clearRecurringNote}>
            OK
          </button>
        </div>
      )}

      <div className={"advise " + nudge.tone}>
        <b>Kolo</b>
        {nudge.text}
      </div>

      <div className="btnrow" style={{ marginTop: 18 }}>
        <button className="btn ghost sm" onClick={() => goTo("money")}>
          Log a spend
        </button>
        <button className="btn ghost sm" onClick={() => goTo("ask")}>
          Ask Kolo why
        </button>
      </div>
    </div>
  );
}

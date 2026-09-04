"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import {
  circleContribStatus,
  circleCycleDue,
  circleCycleIndex,
  circlePot,
  contributionsAtRisk,
  homeNudge,
  monthlyAccrual,
  payoutRecipient,
  recoveryOptions,
  safeToSpend,
} from "@/lib/engine";
import { saveProfile, updateGoal, recordContribution, addTxns } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { fmt, fmtDate, fmtSigned, clamp, todayStr } from "@/lib/format";
import { Icon } from "../ui";
import { CircleDetail } from "../sheets/CircleDetail";
import { AskSheet } from "../sheets/AskSheet";
import { FeedbackSheet } from "../sheets/FeedbackSheet";

export function Home({ goTo }: { goTo: (t: any) => void }) {
  const { data, reload, recurringPosted, clearRecurringNote, toast } = useKolo();
  const d = data!;
  const sheet = useSheet();
  const r = safeToSpend(d);
  const [open, setOpen] = useState<string | null>(null);
  const neg = r.sts < 0;
  const atRisk = contributionsAtRisk(d, r);

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
      sub: r.goalItems.length + " active goal" + (r.goalItems.length === 1 ? "" : "s"),
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

  const myCycleCircles = d.circles.filter((c) =>
    c.members.some((m) => m.userId === d.userId)
  );

  return (
    <div className="pad">
      <div className="sts">
        <div className="tag">Safe to spend · until {fmtDate(r.horizon)}</div>
        <div className={"fig" + (neg ? " neg" : "")}>{fmtSigned(r.sts)}</div>
        <div className="sub">
          of <b>{fmt(r.availableLiquid)}</b> across {r.accountCount} account
          {r.accountCount === 1 ? "" : "s"}
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
              <div className="v">−{fmt(row.val)}</div>
              <span className="chev">{Icon.chev}</span>
            </button>
            {open === row.key && (
              <div className="brk-detail">
                {row.key === "buffer" ? (
                  <div style={{ padding: 8 }}>
                    <div className="kicker" style={{ marginBottom: 6 }}>
                      Buffer sensitivity — k = {d.profile.bufferK}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.1}
                      value={d.profile.bufferK}
                      style={{ width: "100%", accentColor: "var(--brand)" }}
                      onChange={async (e) => {
                        await saveProfile(d.userId, { buffer_k: Number(e.target.value) });
                        reload();
                      }}
                    />
                  </div>
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

      {atRisk.length > 0 && (
        <div
          className="card"
          style={{ marginTop: 14, borderColor: "rgba(232,184,75,.4)" }}
        >
          <p className="kicker" style={{ color: "var(--gold)", marginBottom: 8 }}>
            {atRisk.length === 1 ? "A contribution" : atRisk.length + " contributions"} may not
            clear
          </p>
          {atRisk.map((a) => (
            <button
              key={a.circleId}
              className="lrow"
              onClick={() => sheet.open(<CircleDetail circleId={a.circleId} />)}
            >
              <div className="grow">
                <div className="t" style={{ fontSize: 13.5 }}>
                  {a.circle} · {fmt(a.amount)}
                </div>
                <div className="s">
                  {a.days < 0
                    ? "overdue " + fmtDate(a.due)
                    : a.days === 0
                    ? "due today"
                    : "due " + fmtDate(a.due) + " · in " + a.days + " day" + (a.days === 1 ? "" : "s")}
                  {a.shortBy > 0 ? " · liquid short by " + fmt(a.shortBy) : " · you're over-committed this period"}
                </div>
              </div>
              <span className="chev">{Icon.chev}</span>
            </button>
          ))}
          <p className="hint" style={{ marginTop: 8 }}>
            Move money into a liquid account, pause a goal, or talk to the circle before the date.
          </p>
        </div>
      )}

      {neg && (() => {
        const rec = recoveryOptions(d, r).opts;
        return (
        <div className="card" style={{ marginTop: 14, borderColor: "rgba(255,92,108,.3)" }}>
          <p className="kicker" style={{ color: "var(--neg)", marginBottom: 8 }}>
            {rec.length >= 3
              ? "Three ways back — pick one"
              : rec.length === 2
              ? "Two ways back — pick one"
              : "One move that closes the gap"}
          </p>
          {rec.map((o, i) => (
            <div key={i} className="lrow" style={{ cursor: "default" }}>
              <div className="grow">
                <div className="t" style={{ fontSize: 13 }}>
                  {o.label}
                </div>
                {o.note && <div className="s">{o.note}</div>}
              </div>
              <div className="r" style={{ color: "var(--pos)" }}>
                +{fmt(o.gain)}
              </div>
              {o.kind !== "manual" && (
                <button
                  className="btn sm"
                  onClick={async () => {
                    if (o.kind === "pauseGoal" && o.id)
                      await updateGoal(o.id, { paused: true });
                    if (o.kind === "zeroBuffer")
                      await saveProfile(d.userId, { buffer_k: 0 });
                    logEvent("recovery_action", { kind: o.kind, gain: o.gain }, "Home");
                    reload();
                  }}
                >
                  Do it
                </button>
              )}
            </div>
          ))}
        </div>
        );
      })()}

      {recurringPosted > 0 && (
        <div
          className="advise"
          style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}
        >
          <span>{recurringPosted} recurring payment{recurringPosted === 1 ? "" : "s"} auto-logged.</span>
          <button className="btn sm ghost" onClick={clearRecurringNote}>
            OK
          </button>
        </div>
      )}

      <div className={"advise " + nudge.tone}>
        <b>Kolo</b>
        {nudge.text}
      </div>

      <div className="btnrow" style={{ marginTop: 14 }}>
        <button className="btn ghost sm" onClick={() => sheet.open(<AskSheet />)}>
          Ask Kolo
        </button>
        <button className="btn ghost sm" onClick={() => goTo("you")}>
          Spending & goals
        </button>
      </div>

      {myCycleCircles.length > 0 && (
        <>
          <div className="section-label">Your circles this cycle</div>
          {myCycleCircles.map((c) => {
            const cur = circleCycleIndex(c);
            const due = circleCycleDue(c, cur);
            const st = circleContribStatus(c, cur, d.userId);
            const paidCount = c.contributions.filter((x) => x.cycle === cur).length;
            const rec = payoutRecipient(c, cur);
            return (
              <button
                key={c.id}
                className="card"
                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 11 }}
                onClick={() => sheet.open(<CircleDetail circleId={c.id} />)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div className="h-sec">{c.name}</div>
                  <span className="mono" style={{ fontSize: 12, color: "var(--gold-soft)" }}>
                    {fmt(circlePot(c))}
                  </span>
                </div>
                <div className="hint" style={{ margin: "3px 0 9px" }}>
                  {c.type === "target"
                    ? "Target save · unlocks together"
                    : (rec ? rec.name : "—") + " receives this cycle"}
                  {" · "}
                  {paidCount}/{c.members.length} paid
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {st.paid ? (
                    <span className="chip paid">you paid</span>
                  ) : (
                    <span className="chip due">your {fmt(c.amount)} due {fmtDate(due)}</span>
                  )}
                  {!st.paid && (
                    <button
                      className="btn sm gold"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await recordContribution({
                          circleId: c.id,
                          userId: d.userId,
                          cycle: cur,
                          amount: c.amount,
                          paidOn: todayStr(),
                          auto: false,
                        });
                        await addTxns(d.userId, [
                          {
                            date: todayStr(),
                            amount: c.amount,
                            category: "circle",
                            note: c.name + " contribution",
                            person: false,
                            source: "circle",
                            auto: false,
                            period: null,
                          },
                        ] as any);
                        logEvent("contribution_paid", { amount: c.amount, cycle: cur, via: "home" }, "Home");
                        toast(fmt(c.amount) + " contribution recorded for " + c.name);
                        reload();
                      }}
                    >
                      Pay {fmt(c.amount)}
                    </button>
                  )}
                </div>
              </button>
            );
          })}
        </>
      )}

      <button
        className="btn ghost sm"
        style={{ margin: "22px auto 4px", display: "block", opacity: 0.75 }}
        onClick={() => sheet.open(<FeedbackSheet screen="Home" />)}
      >
        Test build · send feedback
      </button>
    </div>
  );
}

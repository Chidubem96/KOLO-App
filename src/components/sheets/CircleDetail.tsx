"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import {
  circleContribStatus,
  circleCycleDue,
  circleCycleIndex,
  circlePot,
  floatDecision,
  payoutRecipient,
} from "@/lib/engine";
import {
  addTxns,
  approveJoin,
  declineJoin,
  deleteCircle,
  leaveCircle,
  recordContribution,
  resolveDispute,
  setMemberAutoDebit,
} from "@/lib/api";
import { logEvent } from "@/lib/events";
import { fmt, fmtDate, fmtDateY, todayStr } from "@/lib/format";
import { Sheet, initials } from "../ui";
import { DisputeSheet } from "./DisputeSheet";
import { FloatVoteSheet } from "./FloatVoteSheet";

type Panel = "cycle" | "rotation" | "activity";

export function CircleDetail({ circleId }: { circleId: string }) {
  const { data, reload, toast } = useKolo();
  const { open, close } = useSheet();
  const [panel, setPanel] = useState<Panel>("cycle");
  const [armExit, setArmExit] = useState(false);
  const [exitBusy, setExitBusy] = useState(false);
  const c = data!.circles.find((x) => x.id === circleId);
  if (!c)
    return (
      <Sheet title="Circle" onClose={close}>
        <p>Not found.</p>
      </Sheet>
    );

  const uid = data!.userId;
  const cur = circleCycleIndex(c);
  const due = circleCycleDue(c, cur);
  const me = c.members.find((m) => m.userId === uid);
  const isOrganiser = c.createdBy === uid;
  const pot = circlePot(c);
  const rec = payoutRecipient(c, cur);
  const myst = circleContribStatus(c, cur, uid);
  const paidCount = c.contributions.filter((x) => x.cycle === cur).length;
  const atRisk = c.members.filter((m) => {
    const st = circleContribStatus(c, cur, m.userId);
    return st.late || st.atRisk;
  });
  const openDisputes = c.disputes.filter((x) => x.status === "open");
  const pendingReqs = c.joinRequests.filter((x) => x.status === "pending");

  const pay = async () => {
    await recordContribution({
      circleId: c.id,
      userId: uid,
      cycle: cur,
      amount: c.amount,
      paidOn: todayStr(),
      auto: false,
    });
    await addTxns(uid, [
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
    logEvent("contribution_paid", { amount: c.amount, cycle: cur, via: "detail" }, "CircleDetail");
    toast(fmt(c.amount) + " contribution recorded");
    reload();
  };

  // build the rotation
  const rotation = c.members
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((m) => {
      const cyc = m.slot - 1;
      const isDone = cyc < cur;
      const isNow = cyc === cur;
      const isYou = m.userId === uid;
      return { m, cyc, isDone, isNow, isYou };
    });

  return (
    <Sheet title={c.name} onClose={close}>
      <div className="metric-strip">
        <div>
          <div className="mv">{fmt(c.amount)}</div>
          <div className="ml">
            {c.type === "purpose" ? "one-off" : "per " + (c.cadence === "weekly" ? "week" : "month")}
          </div>
        </div>
        <div>
          <div className="mv">{fmt(pot)}</div>
          <div className="ml">{c.type === "purpose" ? "collected" : "pot (recorded)"}</div>
        </div>
        {c.type !== "purpose" && c.type !== "target" && (
          <div>
            <div className="mv">#{me ? me.slot : "—"}</div>
            <div className="ml">your slot</div>
          </div>
        )}
      </div>

      <p className="kicker" style={{ margin: "2px 0 12px" }}>
        {c.type === "purpose"
          ? "One-off collection · closes " + fmtDateY(due)
          : "Cycle " + (cur + 1) + " · due " + fmtDateY(due)}{" "}
        · code {c.code}
      </p>

      {isOrganiser && pendingReqs.length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderColor: "rgba(245,166,35,.3)" }}>
          <p className="kicker" style={{ color: "var(--warn)", marginBottom: 8 }}>
            {pendingReqs.length} join request{pendingReqs.length === 1 ? "" : "s"}
          </p>
          {pendingReqs.map((r) => (
            <div key={r.id} className="lrow" style={{ cursor: "default" }}>
              <span className="avatar">{initials(r.name)}</span>
              <div className="grow">
                <div className="t" style={{ fontSize: 13 }}>
                  {r.name} · {r.score}% reliability
                </div>
                {r.message && <div className="s">&ldquo;{r.message}&rdquo;</div>}
              </div>
              <button
                className="btn sm"
                onClick={async () => {
                  await approveJoin(r.id);
                  toast(r.name + " added to " + c.name);
                  reload();
                }}
              >
                Approve
              </button>
              <button
                className="btn sm ghost"
                onClick={async () => {
                  await declineJoin(r.id);
                  reload();
                }}
              >
                Decline
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="seg">
        {(
          [
            ["cycle", c.type === "purpose" ? "Collection" : "This cycle"],
            ...(c.type === "purpose" || c.type === "target"
              ? []
              : [["rotation", "Rotation"] as [Panel, string]]),
            ["activity", "Activity"],
          ] as [Panel, string][]
        ).map(([p, l]) => (
          <button key={p} className={panel === p ? "on" : ""} onClick={() => setPanel(p)}>
            {l}
          </button>
        ))}
      </div>

      {panel === "cycle" && (
        <>
          <div className="pot">
            <div className="tag">
              {c.type === "purpose" ? "Collection total" : "This cycle's pot"}
            </div>
            <div className="amount">{fmt(pot)}</div>
            <div className="who">
              {c.type === "target" ? (
                <>Everyone withdraws together on payout day</>
              ) : c.type === "purpose" ? (
                <>
                  For <b>{c.blurb || "the stated purpose"}</b> · held by{" "}
                  <b>{rec ? (rec.userId === uid ? "you" : rec.name) : "the organiser"}</b>
                </>
              ) : (
                <>
                  Goes to <b>{rec ? (rec.userId === uid ? "You" : rec.name) : "—"}</b>
                </>
              )}
            </div>
            <div className="when">
              {c.type === "purpose"
                ? "Closes " + fmtDate(due) + ", once everyone has paid"
                : "Pays out " + fmtDate(due) + ", once everyone has contributed"}
            </div>
            <div className="bar">
              <i
                className="gold"
                style={{ width: Math.round((paidCount / Math.max(1, c.members.length)) * 100) + "%" }}
              />
            </div>
            <div className="bar-caption">
              <span>
                {paidCount} of {c.members.length} contributed
              </span>
              <span>{fmt(paidCount * c.amount)} in</span>
            </div>
          </div>

          {me && (
            <div className="card" style={{ marginTop: 11 }}>
              <div className="yours">
                <div className="left">
                  <div className="k">Your contribution · Cycle {cur + 1}</div>
                  <div className="v">{fmt(c.amount)}</div>
                </div>
                {myst.paid ? (
                  <span className={"chip " + (myst.onTime ? "paid" : "due")}>
                    {myst.onTime ? "paid " + fmtDate(myst.paidOn!) : "paid late"}
                  </span>
                ) : (
                  <button className="btn gold" onClick={pay}>
                    Pay {fmt(c.amount)}
                  </button>
                )}
              </div>
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  fontSize: 12,
                  color: "var(--mut)",
                  marginTop: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={me.autoDebit}
                  onChange={async (e) => {
                    await setMemberAutoDebit(c.id, uid, e.target.checked);
                    reload();
                  }}
                />
                Auto-debit my contribution on the due date (standing mandate)
              </label>
            </div>
          )}

          <div className="section-label">Contributions this cycle</div>
          <div className="card tight">
            {c.members.map((m) => {
              const st = circleContribStatus(c, cur, m.userId);
              return (
                <div key={m.id} className="m-row" style={{ cursor: "default" }}>
                  <span className={"avatar" + (m.userId === uid ? " gold" : "")}>
                    {initials(m.name)}
                  </span>
                  <span className="nm">
                    {m.userId === uid ? "You" : m.name}
                    <small>slot {m.slot}</small>
                  </span>
                  {!st.paid && m.userId !== uid && (
                    <button
                      className="remind"
                      onClick={() =>
                        toast("Reminder sent to " + m.name + " by SMS + WhatsApp")
                      }
                    >
                      Remind
                    </button>
                  )}
                  <span
                    className={
                      "chip " +
                      (st.paid
                        ? st.onTime
                          ? "paid"
                          : "due"
                        : st.late
                        ? "missed"
                        : st.atRisk
                        ? "due"
                        : "neutral")
                    }
                  >
                    {st.paid
                      ? st.onTime
                        ? "paid"
                        : "paid late"
                      : st.late
                      ? "missed"
                      : st.atRisk
                      ? "at risk"
                      : "upcoming"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="card tight" style={{ marginTop: 11 }}>
            <div className="kv">
              <span className="lab">Guarantee fund</span>
              <span className="num">{fmt(c.guaranteeFund)} held</span>
            </div>
            <div className="kv">
              <span className="lab">Organiser stake</span>
              <span className="num">{fmt(c.organiserStake)}</span>
            </div>
            <div className="kv">
              <span className="lab">Grace · late fee</span>
              <span className="num">
                {c.graceDays}d · {fmt(c.lateFee)}
              </span>
            </div>
          </div>

          {isOrganiser && (
            <div className="advise warn" style={{ marginTop: 12 }}>
              <b>Organiser view</b>
              {atRisk.length
                ? atRisk.map((m) => m.name).join(", ") +
                  " " +
                  (atRisk.length === 1 ? "has" : "have") +
                  " not paid for " +
                  fmtDate(due) +
                  ". The guarantee fund covers the gap this cycle; the shortfall is recovered from their later payout."
                : "Every member is settled or on schedule for this cycle."}
            </div>
          )}

          {c.floatEnabled && (() => {
            const dec = floatDecision(c, cur);
            return (
              <>
                <div
                  className="advise"
                  style={{
                    marginTop: 12,
                    borderColor: dec.active ? "rgba(53,211,153,.4)" : undefined,
                  }}
                >
                  <b>Idle pot</b>
                  {dec.active
                    ? "All " + dec.total + " members agreed — this cycle's pot is earning yield in the fund."
                    : "In escrow. Moving it to the fund needs every member to agree (" +
                      dec.inCount +
                      "/" +
                      dec.total +
                      " so far · " +
                      dec.blockedReason +
                      ")."}
                </div>
                <button
                  className="btn ghost full"
                  onClick={() => open(<FloatVoteSheet circleId={c.id} cycle={cur} />)}
                >
                  Circle float vote
                </button>
              </>
            );
          })()}
        </>
      )}

      {panel === "rotation" && (
        <>
          <div className="section-label">Payout rotation</div>
          <div className="card">
            <div className="rota">
              {rotation.map(({ m, cyc, isDone, isNow, isYou }) => (
                <div
                  key={m.id}
                  className={"step" + (isDone ? " done" : isNow ? " now" : isYou ? " you" : "")}
                >
                  <div className="cy">Cycle {cyc + 1}</div>
                  <div className="nm2">{isYou ? "You" : m.name}</div>
                  <div className="amt">
                    {isDone
                      ? fmt(pot) + " paid out"
                      : isNow
                      ? fmt(paidCount * c.amount) + " of " + fmt(pot) + " collected"
                      : "upcoming"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-label">Members &amp; reliability</div>
          <div className="card tight">
            {c.members.map((m) => {
              const dir = data!.directory[m.userId];
              const score = dir?.reliabilityScore ?? (m.userId === uid ? data!.profile.reliabilityScore : 90);
              const col = score >= 95 ? "var(--pos)" : score >= 85 ? "var(--warn)" : "var(--neg)";
              return (
                <div key={m.id} className="m-row" style={{ cursor: "default" }}>
                  <span className={"avatar" + (m.userId === uid ? " gold" : "")}>
                    {initials(m.name)}
                  </span>
                  <span className="nm">
                    {m.userId === uid ? "You" : m.name}
                    <small>
                      {[
                        dir?.bvnVerified && "BVN",
                        dir?.ninVerified && "NIN",
                        dir?.phoneVerified && "Phone",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "unverified"}
                    </small>
                  </span>
                  <span className="chip neutral" style={{ color: col }}>
                    ● {score}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {panel === "activity" && (
        <>
          {openDisputes.length > 0 && (
            <div className="card" style={{ marginBottom: 11, borderColor: "rgba(255,92,108,.3)" }}>
              <p className="kicker" style={{ color: "var(--neg)", marginBottom: 8 }}>
                {openDisputes.length} open dispute{openDisputes.length === 1 ? "" : "s"}
              </p>
              {openDisputes.map((dp) => (
                <div key={dp.id} className="lrow" style={{ cursor: "default" }}>
                  <div className="grow">
                    <div className="t" style={{ fontSize: 13 }}>
                      {dp.raisedByName}: {dp.reason}
                    </div>
                    <div className="s">
                      {dp.subject}
                      {dp.note ? " — " + dp.note : ""}
                    </div>
                  </div>
                  {(isOrganiser || dp.raisedBy === uid) && (
                    <button
                      className="btn sm ghost"
                      onClick={async () => {
                        await resolveDispute(dp.id);
                        toast("Dispute resolved");
                        reload();
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="section-label">Ledger — shared, time-stamped</div>
          <div className="card tight">
            {c.contributions
              .slice()
              .sort((a, b) => (a.paidOn < b.paidOn ? 1 : -1))
              .slice(0, 30)
              .map((x) => {
                const m = c.members.find((mm) => mm.userId === x.userId);
                return (
                  <div key={x.id} className="led">
                    <span className="ic">↓</span>
                    <div className="desc">
                      {m?.userId === uid ? "You" : m?.name || "Member"}
                      <small>
                        Cycle {x.cycle + 1} contribution{x.auto ? " · auto-debit" : ""}
                      </small>
                    </div>
                    <div className="val in">
                      +{fmt(x.amount)}
                      <small>{fmtDate(x.paidOn)}</small>
                    </div>
                    <button
                      className="dispute-link"
                      onClick={() =>
                        open(
                          <DisputeSheet
                            circleId={c.id}
                            subject={
                              (m?.name || "Member") +
                              " — Cycle " +
                              (x.cycle + 1) +
                              " contribution (" +
                              fmt(x.amount) +
                              ")"
                            }
                          />
                        )
                      }
                    >
                      Dispute
                    </button>
                  </div>
                );
              })}
            {!c.contributions.length && (
              <p className="hint" style={{ padding: 8 }}>
                No contributions recorded yet.
              </p>
            )}
          </div>
          <p className="disclosure">
            Records are shared with every member and time-stamped. Neither the organiser nor Braid
            can edit a past entry.
          </p>
        </>
      )}

      <div className="divider" />
      {(() => {
        const sole = c.members.length <= 1;
        const canDelete = sole || isOrganiser;
        const label = canDelete ? "Delete circle" : "Leave circle";
        const confirmText = canDelete
          ? sole
            ? "Delete this circle? It has no other members. This can't be undone."
            : "Delete this circle for all " +
              c.members.length +
              " members? This can't be undone."
          : "Leave " + c.name + "?";

        // A committed confirm step, not a timed re-arm: it was silently
        // reverting before a second, slower tap landed, so nothing appeared
        // to happen. This stays open until Cancel or the real action.
        const doExit = async () => {
          setExitBusy(true);
          try {
            if (canDelete) {
              const r = await deleteCircle(c.id);
              toast(r === "deleted" ? "Circle deleted" : "You've left " + c.name);
            } else {
              await leaveCircle(c.id, uid);
              toast("You've left " + c.name);
            }
            await reload();
            close();
          } catch (e: any) {
            toast(e?.message || "Couldn't do that — try again");
            setExitBusy(false);
            setArmExit(false);
          }
        };

        if (!armExit)
          return (
            <button className="btn danger full" onClick={() => setArmExit(true)}>
              {label}
            </button>
          );

        return (
          <div className="warn-box red">
            <p style={{ marginBottom: 10 }}>{confirmText}</p>
            <div className="btnrow">
              <button className="btn sm danger" disabled={exitBusy} onClick={doExit}>
                {exitBusy ? "Working…" : "Yes, " + label.toLowerCase()}
              </button>
              <button
                className="btn sm ghost"
                disabled={exitBusy}
                onClick={() => setArmExit(false)}
              >
                Cancel
              </button>
            </div>
            {isOrganiser && !sole && (
              <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                You&apos;re the organiser — deleting removes the circle for
                everyone. There&apos;s no partial leave.
              </p>
            )}
          </div>
        );
      })()}
    </Sheet>
  );
}

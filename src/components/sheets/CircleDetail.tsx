"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import {
  circleContribStatus,
  circleCycleDue,
  circleCycleIndex,
} from "@/lib/engine";
import {
  leaveCircle,
  recordContribution,
  setMemberAutoDebit,
} from "@/lib/api";
import { addDays, D, fmt, fmtDate, fmtDateY, todayStr } from "@/lib/format";
import { Sheet } from "../ui";

export function CircleDetail({ circleId }: { circleId: string }) {
  const { data, reload } = useKolo();
  const { close } = useSheet();
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
  const pot = c.amount * c.members.length;
  const payoutSlot = (cur % c.members.length) + 1;
  const recipient = c.members.find((m) => m.slot === payoutSlot);
  const myst = circleContribStatus(c, cur, uid);
  const atRisk = c.members.filter((m) => {
    const st = circleContribStatus(c, cur, m.userId);
    return st.late || st.atRisk;
  });

  return (
    <Sheet title={c.name} onClose={close}>
      <div className="metric-strip">
        <div>
          <div className="mv">{fmt(c.amount)}</div>
          <div className="ml">per {c.cadence}</div>
        </div>
        <div>
          <div className="mv">{fmt(pot)}</div>
          <div className="ml">pot (recorded)</div>
        </div>
        <div>
          <div className="mv">#{me ? me.slot : "—"}</div>
          <div className="ml">your slot</div>
        </div>
      </div>

      <p className="kicker" style={{ margin: "4px 0 8px" }}>
        Cycle {cur + 1} · due {fmtDateY(due)} · code {c.code}
      </p>
      {c.type === "rotating" && (
        <div className="advise" style={{ marginTop: 0, marginBottom: 12 }}>
          <b>This cycle&apos;s payout</b>
          {(recipient ? recipient.name : "—")} collects {fmt(pot)} (slot{" "}
          {payoutSlot}).
        </div>
      )}

      {me && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div className="t" style={{ fontWeight: 600 }}>
                Your contribution
              </div>
              <div
                className="s"
                style={{ fontSize: 12, color: "var(--muted)" }}
              >
                {myst.paid
                  ? "Paid " +
                    fmtDate(myst.paidOn!) +
                    (myst.onTime ? " · on time" : " · late")
                  : "Due " + fmtDate(due)}
              </div>
            </div>
            {myst.paid ? (
              <span className={"pill " + (myst.onTime ? "ok" : "warn")}>
                {myst.onTime ? "settled" : "paid late"}
              </span>
            ) : (
              <button
                className="btn sm brass"
                onClick={async () => {
                  await recordContribution({
                    circleId: c.id,
                    userId: uid,
                    cycle: cur,
                    amount: c.amount,
                    paidOn: todayStr(),
                    auto: false,
                  });
                  reload();
                }}
              >
                Mark {fmt(c.amount)} paid
              </button>
            )}
          </div>
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 12,
              color: "var(--muted)",
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
            Auto-debit my contribution on the due date
          </label>
        </div>
      )}

      <p className="kicker" style={{ margin: "8px 0 4px" }}>
        Open ledger — cycle {cur + 1}
      </p>
      {c.members.map((m) => {
        const st = circleContribStatus(c, cur, m.userId);
        return (
          <div key={m.id} className="lrow" style={{ cursor: "default" }}>
            <div className={"avatar" + (m.userId === uid ? " brass" : "")}>
              {(m.name[0] || "?").toUpperCase()}
            </div>
            <div className="grow">
              <div className="t" style={{ fontSize: 13.5 }}>
                {m.name}
                {m.userId === uid ? " (you)" : ""}
              </div>
              <div className="s">slot {m.slot}</div>
            </div>
            {st.paid ? (
              <span className={"pill " + (st.onTime ? "ok" : "warn")}>
                {(st.onTime ? "paid " : "paid late ") + fmtDate(st.paidOn!)}
              </span>
            ) : st.late ? (
              <span className="pill bad">late</span>
            ) : st.atRisk ? (
              <span className="pill warn">at risk</span>
            ) : (
              <span className="pill neutral">upcoming</span>
            )}
          </div>
        );
      })}

      {isOrganiser && (
        <div className="advise warn" style={{ marginTop: 12 }}>
          <b>Organiser view</b>
          {atRisk.length
            ? atRisk.map((m) => m.name).join(", ") +
              " " +
              (atRisk.length === 1 ? "has" : "have") +
              " not paid for " +
              fmtDate(due) +
              ". Grace is " +
              (c.graceDays || 0) +
              " days; late fee " +
              fmt(c.lateFee) +
              " — rules set at creation."
            : "Every member is settled or on schedule for this cycle."}
        </div>
      )}

      <div className="divider" />
      <p className="kicker" style={{ marginBottom: 6 }}>
        Rules — agreed at creation
      </p>
      <div className="abouttext" style={{ fontSize: 12.5 }}>
        <p>
          Grace period: {c.graceDays || 0} days · Late fee: {fmt(c.lateFee || 0)}.
          This V1 records contributions; it does not hold or move money.
        </p>
      </div>
      <button
        className="btn danger block"
        style={{ marginTop: 8 }}
        onClick={async () => {
          if (confirm("Leave this circle?")) {
            await leaveCircle(c.id, uid);
            await reload();
            close();
          }
        }}
      >
        Leave circle
      </button>
    </Sheet>
  );
}

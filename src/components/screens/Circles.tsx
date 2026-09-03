"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import {
  circleContribStatus,
  circleCycleDue,
  circleCycleIndex,
  myReliability,
  safeToSpend,
} from "@/lib/engine";
import { joinCircle, peekCircle } from "@/lib/api";
import { fmt, fmtDate } from "@/lib/format";
import { Icon } from "../ui";
import { CircleSheet } from "../sheets/CircleSheet";
import { CircleDetail } from "../sheets/CircleDetail";

export function Circles() {
  const { data, reload } = useKolo();
  const d = data!;
  const sheet = useSheet();
  const rel = myReliability(d.circles, d.userId);
  const r = safeToSpend(d);

  const [code, setCode] = useState("");
  const [peek, setPeek] = useState<any>(null);
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState("");

  const doPeek = async () => {
    setErr("");
    setPeek(null);
    if (code.trim().length < 4) return;
    const p = await peekCircle(code.trim());
    if (!p) setErr("No circle with that code.");
    else setPeek(p);
  };
  const doJoin = async () => {
    setJoining(true);
    try {
      await joinCircle(code.trim(), d.profile.name || "Member");
      setCode("");
      setPeek(null);
      await reload();
    } catch (e: any) {
      setErr(e.message || "Could not join.");
    }
    setJoining(false);
  };

  return (
    <div className="pad">
      <div
        className="card"
        style={{
          marginBottom: 14,
          background: "var(--brand-wash)",
          borderColor: "transparent",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p className="kicker" style={{ color: "var(--brand-deep)" }}>
              Your reliability
            </p>
            <div
              style={{
                fontFamily: "var(--f-display)",
                fontWeight: 600,
                fontSize: 28,
                color: "var(--brand-deep)",
              }}
            >
              {rel.total ? rel.score : "—"}
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              fontSize: 12,
              color: "var(--brand-deep)",
            }}
          >
            <div>
              {rel.total
                ? rel.onTime + " / " + rel.total + " on time"
                : "no history yet"}
            </div>
            <div className="dim" style={{ marginTop: 2 }}>
              portable across every circle
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <p className="kicker" style={{ marginBottom: 8 }}>
          Join a circle
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={code}
            placeholder="6-letter code"
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid var(--rule)",
              borderRadius: 10,
              background: "var(--surface)",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              fontFamily: "var(--f-mono)",
            }}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          />
          <button className="btn sm ghost" onClick={doPeek}>
            Find
          </button>
        </div>
        {err && (
          <p className="hint" style={{ color: "var(--critical)" }}>
            {err}
          </p>
        )}
        {peek && (
          <div style={{ marginTop: 10 }}>
            <p className="hint">
              <b>{peek.name}</b> · {fmt(Number(peek.amount))}/{peek.cadence} ·{" "}
              {peek.members} member{peek.members === 1 ? "" : "s"}
            </p>
            <button
              className="btn brass block"
              style={{ marginTop: 8 }}
              disabled={joining}
              onClick={doJoin}
            >
              {joining ? "Joining…" : "Join this circle"}
            </button>
          </div>
        )}
      </div>

      {!d.circles.length && (
        <div className="empty">
          <span style={{ width: 34, height: 34, display: "inline-flex" }}>
            {Icon.circles}
          </span>
          <p>No circles yet.</p>
          <p className="hint">
            A circle is your ajo, esusu, cooperative or family fund — the
            schedule, the members and the ledger, in one place, synced with
            everyone in it.
          </p>
          <button
            className="btn brass"
            style={{ marginTop: 14 }}
            onClick={() => sheet.open(<CircleSheet />)}
          >
            Create a circle
          </button>
        </div>
      )}

      {d.circles.map((c) => {
        const cur = circleCycleIndex(c);
        const due = circleCycleDue(c, cur);
        const paidCount = c.contributions.filter((x) => x.cycle === cur).length;
        const myst = circleContribStatus(c, cur, d.userId);
        const pot = c.amount * c.members.length;
        return (
          <div key={c.id}>
            <button
              className="card"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                marginBottom: 12,
              }}
              onClick={() => sheet.open(<CircleDetail circleId={c.id} />)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <div className="h-sec">{c.name}</div>
                <span className="pill neutral">{c.type}</span>
              </div>
              <p className="hint" style={{ margin: "4px 0 10px" }}>
                {fmt(c.amount)} / {c.cadence} · {c.members.length} members · pot{" "}
                {fmt(pot)} · code {c.code}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  className={
                    "pill " +
                    (paidCount === c.members.length ? "ok" : "warn")
                  }
                >
                  {paidCount} of {c.members.length} paid
                </span>
                <span
                  className={
                    "pill " +
                    (myst.paid ? "ok" : myst.late ? "bad" : "warn")
                  }
                >
                  {myst.paid
                    ? "you paid"
                    : myst.late
                    ? "you're late"
                    : "your turn " + fmtDate(due)}
                </span>
              </div>
            </button>
            {!myst.paid && r.availableLiquid < c.amount && (
              <div
                className="advise warn"
                style={{ marginTop: -6, marginBottom: 12 }}
              >
                <b>Warn before miss</b>
                Your {fmt(c.amount)} contribution to &quot;{c.name}&quot; is due{" "}
                {fmtDate(due)} and your liquid balance is{" "}
                {fmt(r.availableLiquid)}.
              </div>
            )}
          </div>
        );
      })}

      {d.circles.length > 0 && (
        <button
          className="btn ghost block"
          onClick={() => sheet.open(<CircleSheet />)}
        >
          + New circle
        </button>
      )}

      <div
        className="card"
        style={{
          marginTop: 16,
          background: "var(--surface-2)",
          borderColor: "transparent",
        }}
      >
        <p className="hint" style={{ margin: 0 }}>
          Circles sync live between everyone in them. Auto-debit posts your
          contribution on the due date (toggle it in a circle). In this V1 there
          is no escrow account — contributions are recorded, not moved.
        </p>
      </div>
    </div>
  );
}

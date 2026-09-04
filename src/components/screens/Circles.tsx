"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import {
  circleContribStatus,
  circleCycleDue,
  circleCycleIndex,
  circlePot,
  myReliability,
} from "@/lib/engine";
import { joinCircle, peekCircle } from "@/lib/api";
import { fmt, fmtDate } from "@/lib/format";
import { Icon, Ring } from "../ui";
import { CircleSheet } from "../sheets/CircleSheet";
import { CircleDetail } from "../sheets/CircleDetail";

export function Circles() {
  const { data, reload, toast } = useKolo();
  const d = data!;
  const sheet = useSheet();
  const rel = myReliability(d.circles, d.userId);

  const [code, setCode] = useState("");
  const [peek, setPeek] = useState<any>(null);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    try {
      await joinCircle(code.trim(), d.profile.name || "Member");
      setCode("");
      setPeek(null);
      toast("Joined " + (peek?.name || "the circle"));
      await reload();
    } catch (e: any) {
      setErr(e.message || "Could not join.");
    }
    setBusy(false);
  };

  return (
    <div className="pad">
      <div className="scr-head">
        <div>
          <h1>Circles</h1>
          <div className="meta">Your ajo, esusu, cooperative & family funds</div>
        </div>
      </div>

      <div className="card" style={{ background: "var(--card-2)", borderColor: "transparent" }}>
        <div className="ring-wrap">
          <Ring score={rel.total ? rel.score : 100} />
          <div className="txt">
            <div className="big">Your reliability</div>
            <div className="small">
              {rel.total
                ? rel.onTime + " / " + rel.total + " contributions on time · portable to any circle"
                : "No history yet — complete a cycle to build it"}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 11 }}>
        <p className="kicker" style={{ marginBottom: 8 }}>
          Join with a code
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={code}
            placeholder="6-letter code"
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 11,
              background: "var(--bg)",
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
          <p className="hint" style={{ color: "var(--neg)" }}>
            {err}
          </p>
        )}
        {peek && (
          <div style={{ marginTop: 10 }}>
            <p className="hint">
              <b style={{ color: "var(--ink)" }}>{peek.name}</b> · {fmt(Number(peek.amount))}/
              {peek.cadence} · {peek.members} member{peek.members === 1 ? "" : "s"}
            </p>
            <button className="btn full" disabled={busy} onClick={doJoin}>
              {busy ? "Joining…" : "Join this circle"}
            </button>
          </div>
        )}
      </div>

      {!d.circles.length && (
        <div className="empty">
          <span style={{ width: 32, height: 32, display: "inline-flex" }}>{Icon.circles}</span>
          <p>No circles yet.</p>
          <p className="hint">
            Create one and share the code, join a friend&apos;s with a code, or find a public
            circle under Discover.
          </p>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => sheet.open(<CircleSheet />)}>
            Create a circle
          </button>
        </div>
      )}

      {d.circles.map((c) => {
        const cur = circleCycleIndex(c);
        const due = circleCycleDue(c, cur);
        const st = circleContribStatus(c, cur, d.userId);
        const paidCount = c.contributions.filter((x) => x.cycle === cur).length;
        const openDisputes = c.disputes.filter((x) => x.status === "open").length;
        const pendingReqs =
          c.createdBy === d.userId
            ? c.joinRequests.filter((x) => x.status === "pending").length
            : 0;
        return (
          <button
            key={c.id}
            className="card"
            style={{ display: "block", width: "100%", textAlign: "left", marginTop: 11 }}
            onClick={() => sheet.open(<CircleDetail circleId={c.id} />)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="h-sec">{c.name}</div>
              <span className="chip neutral">{c.type}</span>
            </div>
            <p className="hint" style={{ margin: "4px 0 10px" }}>
              {fmt(c.amount)} / {c.cadence} · {c.members.length} members · pot{" "}
              {fmt(circlePot(c))} · code {c.code}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className={"chip " + (paidCount === c.members.length ? "paid" : "due")}>
                {paidCount}/{c.members.length} paid
              </span>
              <span className={"chip " + (st.paid ? "paid" : st.late ? "missed" : "due")}>
                {st.paid ? "you paid" : st.late ? "you're late" : "your turn " + fmtDate(due)}
              </span>
              {openDisputes > 0 && <span className="chip missed">{openDisputes} dispute</span>}
              {pendingReqs > 0 && <span className="chip due">{pendingReqs} to review</span>}
            </div>
          </button>
        );
      })}

      {d.circles.length > 0 && (
        <button
          className="btn ghost full"
          style={{ marginTop: 14 }}
          onClick={() => sheet.open(<CircleSheet />)}
        >
          + New circle
        </button>
      )}

      <p className="disclosure">
        V1: circles are recorded, not settled. Contributions and payouts are tracked and shared
        live; no real money moves and there is no escrow account yet.
      </p>
    </div>
  );
}

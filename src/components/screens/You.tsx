"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import {
  circleContribStatus,
  circleCycleIndex,
  monthlyRollups,
  myReliability,
} from "@/lib/engine";
import { saveProfile } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { fmt } from "@/lib/format";
import { Icon, Ring } from "../ui";
import { MoneySheet } from "../sheets/MoneySheet";
import { GoalsSheet } from "../sheets/GoalsSheet";
import { SettingsSheet } from "../sheets/SettingsSheet";
import { AskSheet } from "../sheets/AskSheet";
import { FeedbackSheet } from "../sheets/FeedbackSheet";
import { CircleDetail } from "../sheets/CircleDetail";

export function You({ goTo }: { goTo: (t: any) => void }) {
  const { data, reload, signOut, toast } = useKolo();
  const d = data!;
  const sheet = useSheet();
  const rel = myReliability(d.circles, d.userId);
  const roll = monthlyRollups(d);
  const p = d.profile;

  const verify = async (field: string, label: string) => {
    await saveProfile(d.userId, { [field]: true });
    logEvent("identity_verified", { field }, "You");
    toast(label + " verified");
    reload();
  };

  return (
    <div className="pad">
      <div className="scr-head">
        <div>
          <h1>You</h1>
          <div className="meta">Reputation, identity & everything else</div>
        </div>
        <button className="iconbtn" aria-label="Settings" onClick={() => sheet.open(<SettingsSheet />)}>
          {Icon.gear}
        </button>
      </div>

      <div className="card">
        <div className="ring-wrap">
          <Ring score={rel.score} />
          <div className="txt">
            <div className="big">Your reliability</div>
            <div className="small">
              {rel.rated
                ? rel.onTime +
                  " of " +
                  rel.total +
                  " contributions on time across circles with 3+ members. Portable to any circle you request."
                : "No completed cycles yet in a circle with 3+ members. Your score appears once you finish your first — until then you show as unrated to organisers."}
            </div>
          </div>
        </div>
      </div>

      <div className="section-label">Identity</div>
      <div className="card tight">
        {[
          ["bvn_verified", p.bvnVerified, "BVN"],
          ["nin_verified", p.ninVerified, "NIN"],
          ["phone_verified", p.phoneVerified, "Phone & selfie"],
        ].map(([field, ok, label]) => (
          <div key={label as string} className="kv">
            <span className="lab">{label as string}</span>
            {ok ? (
              <span className="verified">Verified ✓</span>
            ) : (
              <button
                className="btn sm ghost"
                onClick={() => verify(field as string, label as string)}
              >
                Verify
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="section-label">Your money</div>
      <div className="card tight">
        <button className="lrow" onClick={() => sheet.open(<MoneySheet />)}>
          <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 9, background: "var(--card-2)", color: "var(--mut)" }}>
            {Icon.money}
          </span>
          <div className="grow">
            <div className="t">Spending & obligations</div>
            <div className="s">
              {fmt(roll.discretionary + roll.committed)} / mo · auto-logging
            </div>
          </div>
          <span className="chev">{Icon.chev}</span>
        </button>
        <button className="lrow" onClick={() => sheet.open(<GoalsSheet />)}>
          <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 9, background: "var(--card-2)", color: "var(--mut)" }}>
            {Icon.goals}
          </span>
          <div className="grow">
            <div className="t">Goals</div>
            <div className="s">
              {d.goals.length} goal{d.goals.length === 1 ? "" : "s"} ·{" "}
              {fmt(roll.goalsMonthly)} / mo accruing
            </div>
          </div>
          <span className="chev">{Icon.chev}</span>
        </button>
        <button className="lrow" onClick={() => sheet.open(<AskSheet />)}>
          <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 9, background: "var(--card-2)", color: "var(--mut)" }}>
            {Icon.ask}
          </span>
          <div className="grow">
            <div className="t">Ask Kolo</div>
            <div className="s">The guardrailed money assistant</div>
          </div>
          <span className="chev">{Icon.chev}</span>
        </button>
      </div>

      <div className="section-label">Your circles</div>
      {!d.circles.length && (
        <p className="hint">You&apos;re not in any circles yet.</p>
      )}
      <div className="card tight">
        {d.circles.map((c) => {
          const cur = circleCycleIndex(c);
          const st = circleContribStatus(c, cur, d.userId);
          return (
            <button key={c.id} className="m-row" onClick={() => sheet.open(<CircleDetail circleId={c.id} />)}>
              <span className="avatar">{(c.name[0] || "?").toUpperCase()}</span>
              <span className="nm">
                {c.name}
                <small>
                  {fmt(c.amount)}/{c.cadence} · cycle {cur + 1}
                </small>
              </span>
              <span className={"chip " + (st.paid ? "paid" : st.late ? "missed" : "due")}>
                {st.paid ? "on track" : st.late ? "late" : "due"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="section-label">This is a test build</div>
      <div className="card tight">
        <button className="lrow" onClick={() => sheet.open(<FeedbackSheet screen="You" />)}>
          <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 9, background: "var(--card-2)", color: "var(--mut)" }}>
            {Icon.ask}
          </span>
          <div className="grow">
            <div className="t">Send feedback</div>
            <div className="s">
              Anything broken, confusing or missing — it shapes the next version
            </div>
          </div>
          <span className="chev">{Icon.chev}</span>
        </button>
      </div>

      <button className="btn ghost full" style={{ marginTop: 16 }} onClick={signOut}>
        Sign out
      </button>
      <p className="disclosure" style={{ textAlign: "center" }}>
        Kolo V1 · working name · figures are yours, held in your account · no real money moves
      </p>
    </div>
  );
}

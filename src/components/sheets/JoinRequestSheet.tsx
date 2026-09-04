"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { requestJoin } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { fmt } from "@/lib/format";
import { Field, Sheet } from "../ui";
import type { DiscoverCircle } from "@/lib/types";

export function JoinRequestSheet({
  circle: c,
  qualifies,
  myScore,
}: {
  circle: DiscoverCircle;
  qualifies: boolean;
  myScore: number;
}) {
  const { reload, toast } = useKolo();
  const { close } = useSheet();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const spots = Math.max(0, c.maxSize - c.memberCount);
  const isTarget = c.type === "target";

  const submit = async () => {
    setBusy(true);
    logEvent(
      "circle_join_requested",
      { seed: !!c.seed, category: c.category, qualifies, spots },
      "Discover"
    );
    try {
      if (c.seed) {
        toast(
          spots > 0
            ? "Request sent to " + c.name + " — you'll hear back within 24h"
            : "Added to the " + c.name + " waitlist"
        );
      } else {
        await requestJoin(c.id, msg);
        toast("Request sent — the organiser reviews it");
        await reload();
      }
    } catch (e: any) {
      toast(e.message || "Could not send request");
    }
    setBusy(false);
    close();
  };

  return (
    <Sheet title={c.name} onClose={close}>
      <p className="hint">{c.orgLabel}</p>
      <div className="badge-row">
        <span className="badge">✓ {c.orgLabel.includes("Assoc") ? "Registered association" : "Verified organiser"}</span>
        <span className="badge" style={{ background: "rgba(108,92,231,.14)", color: "var(--brand-soft)" }}>
          ✓ Escrow-held
        </span>
      </div>

      <div className="review">
        <div className="rrow">
          <span className="rl">Structure</span>
          <span className="rv">{isTarget ? "Target save — all withdraw together" : "Rotating pot"}</span>
        </div>
        <div className="rrow">
          <span className="rl">Contribution</span>
          <span className="rv">
            {fmt(c.amount)} / {c.cadence === "weekly" ? "wk" : "mo"}
          </span>
        </div>
        <div className="rrow">
          <span className="rl">{isTarget ? "Fund size" : "Pot each turn"}</span>
          <span className="rv">{fmt(c.maxSize * c.amount)}</span>
        </div>
        <div className="rrow">
          <span className="rl">Members</span>
          <span className="rv">
            {c.memberCount} · {spots} open
          </span>
        </div>
        <div className="rrow">
          <span className="rl">Track record</span>
          <span className="rv">
            {c.completion}% over {c.cyclesDone}
          </span>
        </div>
        <div className="rrow">
          <span className="rl">Reliability floor</span>
          <span className="rv">{c.reliabilityFloor}%</span>
        </div>
        <div className="rrow">
          <span className="rl">Guarantee fund</span>
          <span className="rv">{fmt(c.guaranteeFund)}</span>
        </div>
        <div className="rrow">
          <span className="rl">Organiser stake</span>
          <span className="rv">{fmt(c.organiserStake)}</span>
        </div>
      </div>

      {qualifies ? (
        <>
          <div className="warn-box pos">
            If a member defaults, the guarantee fund covers the gap that cycle and the shortfall is
            recovered from their later payout. The organiser&apos;s stake backs anything beyond that.
          </div>
          <Field label="A note for the organiser (optional)">
            <input
              value={msg}
              placeholder="Why you'd be a good member"
              onChange={(e) => setMsg(e.target.value)}
            />
          </Field>
          <button className="btn full" disabled={busy} onClick={submit}>
            {busy
              ? "Sending…"
              : spots > 0
              ? "Request to join · organiser reviews in 24h"
              : "Join the waitlist"}
          </button>
        </>
      ) : (
        <>
          <div className="warn-box">
            Your reliability is <b>{myScore}%</b>. This circle needs <b>{c.reliabilityFloor}%</b>.
            Complete more cycles on time to unlock it.
          </div>
          <button className="btn ghost full" onClick={close}>
            Close
          </button>
        </>
      )}
    </Sheet>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { discoverCircles } from "@/lib/api";
import { myReliability, SEED_DISCOVER } from "@/lib/engine";
import { fmt } from "@/lib/format";
import type { DiscoverCircle } from "@/lib/types";
import { JoinRequestSheet } from "../sheets/JoinRequestSheet";

const CATS = ["All", "Rent", "School fees", "Business", "Target"];

export function Discover() {
  const { data } = useKolo();
  const d = data!;
  const sheet = useSheet();
  const rel = myReliability(d.circles, d.userId);
  const myScore = Math.max(rel.total ? rel.score : 100, d.profile.reliabilityScore || 0);

  const [cat, setCat] = useState("All");
  const [real, setReal] = useState<DiscoverCircle[]>([]);

  useEffect(() => {
    discoverCircles()
      .then(setReal)
      .catch(() => setReal([]));
  }, []);

  const seeds: DiscoverCircle[] = SEED_DISCOVER.map((c) => ({
    ...c,
    orgLabel: c.orgLabel,
    myScore,
    pending: false,
  })) as any;

  const all = [...real, ...seeds].filter(
    (c) => cat === "All" || c.category === cat
  );
  const qualifyCount = all.filter((c) => myScore >= c.reliabilityFloor).length;

  return (
    <div className="pad">
      <div className="scr-head">
        <div>
          <h1>Discover circles</h1>
          <div className="meta">Save with people beyond your own network</div>
        </div>
      </div>

      <div className="eligible">
        <div className="big">Your reliability opens doors</div>
        At <b>{myScore}%</b> you qualify for <b>{qualifyCount} of {all.length}</b> open circles here
        — including higher-value and stranger circles. Miss a contribution and that number drops.
      </div>

      <div className="filter-row" style={{ marginTop: 14 }}>
        {CATS.map((c) => (
          <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      {all.map((c) => {
        const qualifies = myScore >= c.reliabilityFloor;
        const spots = Math.max(0, c.maxSize - c.memberCount);
        const joinable = qualifies && spots > 0 && !c.pending;
        return (
          <button
            key={c.id}
            className={"pc" + (qualifies ? "" : " locked")}
            onClick={() =>
              sheet.open(<JoinRequestSheet circle={c} qualifies={qualifies} myScore={myScore} />)
            }
          >
            <div className="pc-top">
              <div>
                <div className="pc-nm">{c.name}</div>
                <div className="pc-org">
                  <span className={"org-badge" + (c.orgLabel.includes("Assoc") ? " assoc" : "")}>
                    {c.orgLabel.includes("Assoc") ? "Association" : "Verified"}
                  </span>
                  {c.orgLabel}
                </div>
              </div>
              <span className="cat-tag">{c.category}</span>
            </div>
            <div className="pc-blurb">{c.blurb}</div>
            <div className="pc-stats">
              <div>
                <b>
                  {c.maxSize} × {fmt(c.amount)}
                </b>
                per {c.cadence === "weekly" ? "week" : "month"}
              </div>
              <div>
                <b>{fmt(c.maxSize * c.amount)}</b>
                {c.type === "target" ? "target" : "pot / turn"}
              </div>
              <div>
                <b>{c.completion}%</b>
                {c.cyclesDone} cycles done
              </div>
            </div>
            <div className="pc-cta">
              <span className={"pc-gate " + (qualifies ? "ok" : "no")}>
                {c.pending
                  ? "Request pending"
                  : qualifies
                  ? spots > 0
                    ? spots + " spot" + (spots > 1 ? "s" : "") + " left"
                    : "Full — join waitlist"
                  : "Needs " + c.reliabilityFloor + "% reliability"}
              </span>
              <span
                className={"btn sm" + (joinable ? "" : " ghost")}
                style={joinable ? {} : { pointerEvents: "none", opacity: 0.6 }}
              >
                {c.pending ? "Pending" : qualifies ? (spots > 0 ? "Request" : "Waitlist") : "Locked"}
              </span>
            </div>
          </button>
        );
      })}

      <p className="disclosure">
        Every open circle is escrow-held and identity-gated in the real product. A reliability floor
        and an organiser stake stand in for the trust you&apos;d get from knowing everyone. Example
        circles are illustrative.
      </p>
    </div>
  );
}

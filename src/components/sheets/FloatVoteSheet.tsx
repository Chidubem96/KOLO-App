"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { castFloatVote } from "@/lib/api";
import { circlePot, floatDecision, floatProjectedYield } from "@/lib/engine";
import { fmt } from "@/lib/format";
import { Sheet } from "../ui";

export function FloatVoteSheet({
  circleId,
  cycle,
}: {
  circleId: string;
  cycle: number;
}) {
  const { data, reload, toast } = useKolo();
  const { close } = useSheet();
  const c = data!.circles.find((x) => x.id === circleId);
  if (!c)
    return (
      <Sheet title="Float vote" onClose={close}>
        <p>Circle not found.</p>
      </Sheet>
    );

  const votes = c.floatVotes.filter((v) => v.cycle === cycle);
  const myVote = votes.find((v) => v.userId === data!.userId)?.vote;
  const dec = floatDecision(c, cycle);
  const pot = circlePot(c);
  const yld = floatProjectedYield(pot, 14);
  const share = Math.round(yld / Math.max(1, c.members.length));

  const vote = async (v: "in" | "out") => {
    await castFloatVote({ circleId, userId: data!.userId, cycle, vote: v });
    toast(
      v === "in"
        ? "You've agreed — the pot moves only if everyone does"
        : "You've declined — the pot stays in escrow this cycle"
    );
    await reload();
    close();
  };

  return (
    <Sheet title="Circle float vote" onClose={close}>
      <p className="hint">
        Hold this cycle&apos;s <b>{fmt(pot)}</b> pot in the Money Market Fund for
        ~14 days, until payout day? It&apos;s all or nothing — the whole pot moves
        only if <b>every member agrees</b>. One decline, or one missing vote, and
        it stays in escrow.
      </p>

      <div className="review">
        <div className="rrow">
          <span className="rl">Status</span>
          <span
            className="rv"
            style={{ color: dec.active ? "var(--pos)" : "var(--mut)" }}
          >
            {dec.active
              ? "Unanimous — pot goes into the fund"
              : "Not running · " + dec.blockedReason}
          </span>
        </div>
        <div className="rrow">
          <span className="rl">Agreed</span>
          <span className="rv">
            {dec.inCount} of {dec.total}
          </span>
        </div>
        {dec.against.length > 0 && (
          <div className="rrow">
            <span className="rl">Declined</span>
            <span className="rv" style={{ color: "var(--neg)" }}>
              {dec.against.join(", ")}
            </span>
          </div>
        )}
        {dec.notVoted.length > 0 && (
          <div className="rrow">
            <span className="rl">Yet to vote</span>
            <span className="rv">{dec.notVoted.join(", ")}</span>
          </div>
        )}
        <div className="rrow">
          <span className="rl">Projected yield</span>
          <span className="rv">
            ≈ {fmt(yld)} · {fmt(share)} each
          </span>
        </div>
      </div>

      <div className="warn-box pos">
        The fund holds value in normal conditions but is not guaranteed. Whoever
        is due this cycle still receives the full pot on payout day regardless of
        yield.
      </div>

      <button
        className={"btn full" + (myVote === "in" ? " done" : "")}
        onClick={() => vote("in")}
      >
        {myVote === "in" ? "You agreed ✓" : "Agree — move the pot"}
      </button>
      <button
        className="btn ghost full"
        style={{ marginTop: 8 }}
        onClick={() => vote("out")}
      >
        {myVote === "out" ? "You declined ✓" : "Decline — keep it in escrow"}
      </button>
    </Sheet>
  );
}

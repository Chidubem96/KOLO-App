"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { castFloatVote } from "@/lib/api";
import { circlePot, floatProjectedYield } from "@/lib/engine";
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
  const inVotes = votes.filter((v) => v.vote === "in");
  const outVotes = votes.filter((v) => v.vote === "out");
  const myVote = votes.find((v) => v.userId === data!.userId)?.vote;
  const pot = circlePot(c);
  const yld = floatProjectedYield(pot, 14);
  const share = Math.round(yld / Math.max(1, c.members.length));
  const nameOf = (id: string) =>
    id === data!.userId ? "You" : c.members.find((m) => m.userId === id)?.name || "Member";

  const vote = async (v: "in" | "out") => {
    await castFloatVote({ circleId, userId: data!.userId, cycle, vote: v });
    toast(
      v === "in"
        ? "Your " + fmt(c.amount) + " share stays in the float until payout"
        : "Your share sits in escrow — no yield, no exposure"
    );
    await reload();
    close();
  };

  return (
    <Sheet title="Circle float vote" onClose={close}>
      <p className="hint">
        Hold this cycle&apos;s {fmt(pot)} pot in the Money Market Fund for ~14 days, until payout
        day?
      </p>
      <div className="review">
        <div className="rrow">
          <span className="rl">In favour</span>
          <span className="rv" style={{ color: "var(--pos)" }}>
            {inVotes.length || 0}
            {inVotes.length ? " — " + inVotes.map((v) => nameOf(v.userId)).join(", ") : ""}
          </span>
        </div>
        <div className="rrow">
          <span className="rl">Against</span>
          <span className="rv" style={{ color: "var(--neg)" }}>
            {outVotes.length || 0}
            {outVotes.length ? " — " + outVotes.map((v) => nameOf(v.userId)).join(", ") : ""}
          </span>
        </div>
        <div className="rrow">
          <span className="rl">Projected yield</span>
          <span className="rv">≈ {fmt(yld)}</span>
        </div>
        <div className="rrow">
          <span className="rl">Your share</span>
          <span className="rv">≈ {fmt(share)}</span>
        </div>
      </div>
      <div className="warn-box pos">
        The fund holds value in normal conditions but is not guaranteed. The member receiving this
        cycle still gets the full pot on payout day regardless of yield.
      </div>
      <button className={"btn full" + (myVote === "in" ? " done" : "")} onClick={() => vote("in")}>
        {myVote === "in" ? "Your share is in ✓" : "Keep my share in"}
      </button>
      <button
        className="btn ghost full"
        style={{ marginTop: 8 }}
        onClick={() => vote("out")}
      >
        {myVote === "out" ? "Your share is out ✓" : "Opt my share out"}
      </button>
    </Sheet>
  );
}

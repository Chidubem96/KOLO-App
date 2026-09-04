"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { goalRunRate, monthlyAccrual } from "@/lib/engine";
import { addMonths, clamp, D, fmt, fmtMonthY, sum } from "@/lib/format";
import { GoalSheet } from "../sheets/GoalSheet";
import { GoalDetail } from "../sheets/GoalDetail";
import { Icon } from "../ui";

export function Goals({ embedded }: { embedded?: boolean }) {
  const { data } = useKolo();
  const d = data!;
  const sheet = useSheet();
  const totalAccrual = sum(d.goals.map(monthlyAccrual));

  return (
    <div className={embedded ? "" : "pad"}>
      <p className="kicker" style={{ marginBottom: 12 }}>
        {d.goals.length} goal{d.goals.length === 1 ? "" : "s"} ·{" "}
        {fmt(totalAccrual)} / month accruing
      </p>

      {!d.goals.length && (
        <div className="empty">
          <span style={{ width: 34, height: 34, display: "inline-flex" }}>
            {Icon.goals}
          </span>
          <p>No goals yet.</p>
          <p className="hint">
            A goal reserves money every period so Safe-to-Spend already knows
            it&apos;s spoken for.
          </p>
          <button
            className="btn gold"
            style={{ marginTop: 14 }}
            onClick={() => sheet.open(<GoalSheet />)}
          >
            Add a goal
          </button>
        </div>
      )}

      {d.goals.map((g) => {
        const acc = monthlyAccrual(g);
        const pct = clamp((g.saved / g.target) * 100, 0, 100);
        const runRate = goalRunRate(g);
        const projected =
          runRate > 0 && g.saved < g.target
            ? addMonths(
                new Date(),
                Math.min(600, Math.ceil((g.target - g.saved) / runRate))
              )
            : null;
        const onTrack = projected
          ? D(projected) <= D(g.deadline)
          : g.saved >= g.target;
        return (
          <button
            key={g.id}
            className="card"
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              marginBottom: 12,
            }}
            onClick={() => sheet.open(<GoalDetail goalId={g.id} />)}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <div className="h-sec">
                {g.name}
                {g.paused ? " · paused" : ""}
              </div>
              <span
                className={
                  "pill " +
                  (g.saved >= g.target ? "ok" : onTrack ? "ok" : "warn")
                }
              >
                {g.saved >= g.target
                  ? "done"
                  : onTrack
                  ? "on track"
                  : "behind"}
              </span>
            </div>
            <p className="hint" style={{ margin: "4px 0 8px" }}>
              {fmt(g.saved)} of {fmt(g.target)} · target{" "}
              {fmtMonthY(g.deadline)}
            </p>
            <div className="bar">
              <i
                className={onTrack ? "" : "warn"}
                style={{ width: pct + "%" }}
              />
            </div>
            <p className="hint" style={{ marginTop: 6 }}>
              {g.paused
                ? "Accrual paused — not in Safe-to-Spend."
                : projected
                ? "At " + fmt(runRate) + "/mo → lands " + fmtMonthY(projected)
                : "Reserving " + fmt(acc) + "/mo"}
            </p>
          </button>
        );
      })}
      {d.goals.length > 0 && (
        <button
          className="btn ghost block"
          onClick={() => sheet.open(<GoalSheet />)}
        >
          + New goal
        </button>
      )}
    </div>
  );
}

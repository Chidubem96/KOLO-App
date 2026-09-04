"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { deleteRow, updateGoal } from "@/lib/api";
import { goalRunRate, hasContribHistory } from "@/lib/engine";
import {
  D,
  addMonths,
  fmt,
  fmtMonthY,
  monthsUntil,
  parseMoney,
  todayStr,
} from "@/lib/format";
import { Field, Seg, Sheet } from "../ui";

export function GoalDetail({ goalId }: { goalId: string }) {
  const { data, reload } = useKolo();
  const { close } = useSheet();
  const g = data!.goals.find((x) => x.id === goalId);
  const [addAmt, setAddAmt] = useState("");
  if (!g)
    return (
      <Sheet title="Goal" onClose={close}>
        <p>Not found.</p>
      </Sheet>
    );

  const remaining = Math.max(0, g.target - g.saved);
  const monthsLeft = Math.max(1, Math.ceil(monthsUntil(g.deadline)));
  const requiredMonthly = Math.ceil(remaining / monthsLeft);
  const runRate = goalRunRate(g);
  const tracked = hasContribHistory(g);
  // No real contribution history -> runRate just mirrors the required
  // accrual; re-deriving a landing date from that overshoots the actual
  // deadline (see Goals.tsx). The deadline is the honest answer until
  // there's real behaviour to project from.
  const projected =
    remaining <= 0
      ? null
      : tracked && runRate > 0
      ? addMonths(new Date(), Math.min(600, Math.ceil(remaining / runRate)))
      : D(g.deadline);

  return (
    <Sheet title={g.name} onClose={close}>
      <div className="metric-strip">
        <div>
          <div className="mv">{fmt(g.saved)}</div>
          <div className="ml">saved</div>
        </div>
        <div>
          <div className="mv">{fmt(remaining)}</div>
          <div className="ml">to go</div>
        </div>
        <div>
          <div className="mv">{monthsLeft}mo</div>
          <div className="ml">to deadline</div>
        </div>
      </div>

      <div className="advise" style={{ marginTop: 4 }}>
        <b>Forecast</b>
        {g.saved >= g.target
          ? "This goal is fully funded."
          : !projected
          ? `Set a contribution rate to forecast a date. To hit ${fmtMonthY(
              g.deadline
            )} you'd need ${fmt(requiredMonthly)}/month.`
          : tracked
          ? `At your recent rate of ${fmt(runRate)}/month, "${g.name}" lands ${fmtMonthY(
              projected
            )}. To hit ${fmtMonthY(g.deadline)} you'd need ${fmt(
              requiredMonthly
            )}/month.`
          : `Reserving ${fmt(
              requiredMonthly
            )}/month keeps "${g.name}" on track for ${fmtMonthY(g.deadline)}.`}
      </div>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <div className="money-input" style={{ flex: 1 }}>
          <span>₦</span>
          <input
            type="number"
            placeholder="Amount"
            value={addAmt}
            style={{ paddingLeft: 26 }}
            onChange={(e) => setAddAmt(e.target.value)}
          />
        </div>
        <button
          className="btn gold"
          onClick={async () => {
            const v = parseMoney(addAmt);
            if (v <= 0) return;
            await updateGoal(g.id, {
              saved: g.saved + v,
              contribLog: [
                ...g.contribLog,
                { date: todayStr(), amount: v },
              ],
            });
            await reload();
            close();
          }}
        >
          Add to goal
        </button>
      </div>

      <Field label="Deadline">
        <input
          type="date"
          value={g.deadline}
          onChange={async (e) => {
            await updateGoal(g.id, { deadline: e.target.value });
            reload();
          }}
        />
      </Field>
      <Field label="Priority (1 = protect first)">
        <Seg
          options={[
            ["1", "High"],
            ["2", "Medium"],
            ["3", "Low"],
          ]}
          value={String(g.priority) as any}
          onChange={async (v) => {
            await updateGoal(g.id, { priority: Number(v) });
            reload();
          }}
        />
      </Field>

      <div className="btnrow" style={{ marginTop: 6 }}>
        <button
          className="btn ghost"
          onClick={async () => {
            await updateGoal(g.id, { paused: !g.paused });
            reload();
          }}
        >
          {g.paused ? "Resume accrual" : "Pause accrual"}
        </button>
        <button
          className="btn danger"
          onClick={async () => {
            if (confirm("Delete goal?")) {
              await deleteRow("goals", g.id);
              await reload();
              close();
            }
          }}
        >
          Delete
        </button>
      </div>
    </Sheet>
  );
}

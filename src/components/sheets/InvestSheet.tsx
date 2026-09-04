"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { addInvestment } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { fmt } from "@/lib/format";
import { Sheet } from "../ui";

export function InvestSheet({
  product: o,
  idle,
}: {
  product: {
    name: string;
    kind: "naira" | "dollar";
    risk: string;
    riskLabel: string;
    ret: string;
    retNote: string;
    liq: string;
    min: number;
    long: string;
  };
  idle: number;
}) {
  const { data, reload, toast } = useKolo();
  const { close } = useSheet();
  const [amt, setAmt] = useState(0);
  const [busy, setBusy] = useState(false);
  const speculative = o.risk === "higher";
  const cap = speculative ? Math.round(idle * 0.1) : idle;
  const presets = speculative
    ? [
        [50000, "₦50k"],
        [Math.max(1, cap), "Max 10% (" + fmt(cap) + ")"],
      ]
    : [
        [50000, "₦50k"],
        [100000, "₦100k"],
        [Math.max(1, idle), "All idle"],
      ];

  const submit = async () => {
    if (amt <= 0) return toast("Enter an amount");
    setBusy(true);
    await addInvestment({
      userId: data!.userId,
      product: o.name,
      kind: o.kind,
      amount: amt,
    });
    logEvent("invest", { product: o.name, kind: o.kind, amount: amt, risk: o.risk }, "Grow");
    toast(fmt(amt) + " moved into " + o.name + " — track it under Grow");
    await reload();
    setBusy(false);
    close();
  };

  return (
    <Sheet title={o.name} onClose={close}>
      <p className="hint">
        <span className={"risk " + o.risk}>{o.riskLabel} risk</span> &nbsp; {o.ret} · {o.retNote} ·{" "}
        {o.liq}
      </p>
      <p style={{ fontSize: 12.5, color: "var(--mut)", marginTop: 14 }}>{o.long}</p>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Amount to move from your {fmt(idle)}</label>
        <div className="money-input">
          <span>₦</span>
          <input
            type="number"
            value={amt || ""}
            placeholder="0"
            onChange={(e) => setAmt(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
      </div>
      <div className="opts" style={{ marginTop: 4 }}>
        {presets.map(([v, label]) => (
          <button
            key={label as string}
            type="button"
            className={amt === v ? "on" : ""}
            onClick={() => setAmt(v as number)}
          >
            {label}
          </button>
        ))}
      </div>

      {speculative ? (
        <div className="warn-box red">
          This can lose value quickly and without warning. Only money you could do without belongs
          here. Capped at {fmt(cap)} — 10% of your idle balance.
        </div>
      ) : o.risk === "medium" ? (
        <div className="warn-box">
          Adds currency and platform risk on top of market movement. Not NDIC-insured. The dollar
          peg can move under stress.
        </div>
      ) : (
        <div className="warn-box pos">
          Lower risk, but returns are still estimates, not promises, and can change with interest
          rates.
        </div>
      )}

      <button className="btn full" disabled={busy} onClick={submit}>
        {busy ? "Moving…" : "Move money in"}
      </button>
      <p className="disclosure" style={{ textAlign: "center" }}>
        Kolo is not a licensed investment adviser. Illustrative prototype — no real money moves.
      </p>
    </Sheet>
  );
}

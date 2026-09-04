"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { addObligation, updateObligation } from "@/lib/api";
import { parseMoney, todayStr } from "@/lib/format";
import { CatSelect, Field, MoneyInput, Seg, Sheet } from "../ui";

export function ObligationSheet({ oblId }: { oblId?: string }) {
  const { data, reload } = useKolo();
  const { close } = useSheet();
  const src = oblId ? data!.obligations.find((o) => o.id === oblId) : null;

  const [label, setLabel] = useState(src?.label || "");
  const [amount, setAmount] = useState(src?.amount || 0);
  const [cadence, setCadence] = useState<"monthly" | "weekly">(
    src?.cadence || "monthly"
  );
  const [anchorDay, setAnchorDay] = useState(src?.anchorDay ?? 1);
  const [category, setCategory] = useState<string | null>(src?.category || "rent");
  const [autoPost, setAutoPost] = useState(src ? src.autoPost : true);

  return (
    <Sheet title={oblId ? "Edit obligation" : "Add an obligation"} onClose={close}>
      {!oblId && (
        <p className="hint" style={{ marginBottom: 12 }}>
          A commitment that leaves before your money is really yours — rent,
          upkeep sent home, cooperative dues, a loan repayment.
        </p>
      )}
      <Field label="What is it">
        <input
          value={label}
          placeholder="Rent, Mama upkeep, co-op…"
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <Field label="Amount">
        <MoneyInput value={amount || ""} onChange={setAmount} />
      </Field>
      <Field label="Cadence">
        <Seg
          options={[
            ["monthly", "Monthly"],
            ["weekly", "Weekly"],
          ]}
          value={cadence}
          onChange={setCadence}
        />
      </Field>
      <Field label="Day (of month 1–28, or 0–6 for a weekday)">
        <input
          type="number"
          min={0}
          max={28}
          value={anchorDay}
          onChange={(e) => setAnchorDay(Number(e.target.value))}
        />
      </Field>
      <Field label="Logs to category">
        <CatSelect value={category} onChange={(v) => setCategory(v || "rent")} />
      </Field>
      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontSize: 13,
          color: "var(--mut)",
          margin: "2px 0 16px",
        }}
      >
        <input
          type="checkbox"
          checked={autoPost}
          onChange={(e) => setAutoPost(e.target.checked)}
        />
        Auto-log this every {cadence === "weekly" ? "week" : "month"} on the due
        date
      </label>
      <button
        className="btn block"
        onClick={async () => {
          if (!label.trim() || amount <= 0)
            return alert("Give it a name and an amount.");
          if (oblId)
            await updateObligation(oblId, {
              label: label.trim(),
              amount,
              cadence,
              anchorDay,
              category: category || "rent",
              autoPost,
            });
          else
            await addObligation(data!.userId, {
              label: label.trim(),
              kind: "bill",
              amount,
              cadence,
              anchorDay,
              active: true,
              source: "manual",
              category: category || "rent",
              autoPost,
              since: todayStr(),
              sig: null,
            });
          await reload();
          close();
        }}
      >
        {oblId ? "Save" : "Add"}
      </button>
    </Sheet>
  );
}

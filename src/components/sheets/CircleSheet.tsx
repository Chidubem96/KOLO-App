"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { createCircle } from "@/lib/api";
import { Field, MoneyInput, Seg, Sheet } from "../ui";

export function CircleSheet() {
  const { data, reload } = useKolo();
  const { close } = useSheet();
  const [name, setName] = useState("");
  const [type, setType] = useState<"rotating" | "accumulating" | "family" | "purpose">(
    "rotating"
  );
  const [amount, setAmount] = useState(0);
  const [cadence, setCadence] = useState<"monthly" | "weekly">("monthly");
  const [graceDays, setGraceDays] = useState(3);
  const [lateFee, setLateFee] = useState(2000);
  const [mySlot, setMySlot] = useState(1);
  const [autoDebit, setAutoDebit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  if (created)
    return (
      <Sheet title="Circle created" onClose={close}>
        <p className="abouttext">
          Share this code with the people in your circle. They open Kolo, go to
          Circles, tap <b>Find</b> and enter it.
        </p>
        <div
          className="codebox"
          style={{
            fontSize: 32,
            padding: "18px 0",
            background: "var(--brass-wash)",
            borderRadius: 12,
            color: "var(--brass)",
            margin: "12px 0",
          }}
        >
          {created}
        </div>
        <button
          className="btn block"
          onClick={() => {
            navigator.clipboard?.writeText(created).catch(() => {});
          }}
        >
          Copy code
        </button>
        <button
          className="btn ghost block"
          style={{ marginTop: 10 }}
          onClick={close}
        >
          Done
        </button>
      </Sheet>
    );

  return (
    <Sheet title="Create a circle" onClose={close}>
      <p className="hint" style={{ marginBottom: 12 }}>
        The schedule and the rules — agreed once, then enforced. Everyone you
        invite sees the same live ledger.
      </p>
      <Field label="Circle name">
        <input
          value={name}
          placeholder="Ilupeju Ajo, Office co-op…"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Type">
        <Seg
          options={[
            ["rotating", "Rotating"],
            ["accumulating", "Accumulating"],
            ["family", "Family"],
            ["purpose", "Purpose"],
          ]}
          value={type}
          onChange={setType}
        />
      </Field>
      <Field label="Contribution amount">
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
      <Field label="Grace days">
        <input
          type="number"
          min={0}
          max={14}
          value={graceDays}
          onChange={(e) => setGraceDays(Number(e.target.value))}
        />
      </Field>
      <Field label="Late fee">
        <MoneyInput value={lateFee || ""} onChange={setLateFee} />
      </Field>
      <Field label="Your slot (payout position)">
        <input
          type="number"
          min={1}
          value={mySlot}
          onChange={(e) => setMySlot(Number(e.target.value))}
        />
      </Field>
      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontSize: 13,
          color: "var(--ink-soft)",
          marginBottom: 14,
        }}
      >
        <input
          type="checkbox"
          checked={autoDebit}
          onChange={(e) => setAutoDebit(e.target.checked)}
        />
        Auto-debit my contribution each cycle
      </label>
      <button
        className="btn block"
        disabled={busy}
        onClick={async () => {
          if (!name.trim() || amount <= 0)
            return alert("Name and amount needed.");
          setBusy(true);
          try {
            const code = await createCircle({
              name: name.trim(),
              type,
              cadence,
              amount,
              anchorDay: new Date().getDate(),
              graceDays,
              lateFee,
              mySlot,
              myName: data!.profile.name || "You",
              autoDebit,
            });
            await reload();
            setCreated(code);
          } catch (e: any) {
            alert(e.message || "Could not create circle.");
          }
          setBusy(false);
        }}
      >
        {busy ? "Creating…" : "Create circle"}
      </button>
    </Sheet>
  );
}

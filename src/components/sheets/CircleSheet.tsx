"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { createCircle } from "@/lib/api";
import { Field, MoneyInput, Seg, Sheet } from "../ui";
import { fmt } from "@/lib/format";

export function CircleSheet() {
  const { data, reload, toast } = useKolo();
  const { close } = useSheet();
  const [step, setStep] = useState(1);
  const [d, setD] = useState({
    name: "",
    type: "rotating",
    amount: 0,
    cadence: "monthly",
    graceDays: 3,
    lateFee: 2000,
    mySlot: 1,
    autoDebit: true,
    category: "General",
    maxSize: 10,
    payoutOrder: "join",
    floatEnabled: true,
    discoverable: false,
    reliabilityFloor: 70,
    organiserStake: 0,
    blurb: "",
  });
  const set = (p: Partial<typeof d>) => setD((s) => ({ ...s, ...p }));
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const pot = d.maxSize * d.amount;

  if (created)
    return (
      <Sheet title="Circle created" onClose={close}>
        <p className="abouttext">
          Share this code with the people in your circle. They open Kolo, go to Circles, tap{" "}
          <b>Find</b> and enter it.
        </p>
        <div
          className="codebox"
          style={{
            fontSize: 32,
            padding: "18px 0",
            background: "var(--brand-wash)",
            borderRadius: 12,
            color: "var(--brand-soft)",
            margin: "12px 0",
          }}
        >
          {created}
        </div>
        <button
          className="btn full"
          onClick={() => {
            navigator.clipboard?.writeText(created).catch(() => {});
            toast("Code copied");
          }}
        >
          Copy code
        </button>
        <button className="btn ghost full" style={{ marginTop: 8 }} onClick={close}>
          Done
        </button>
      </Sheet>
    );

  return (
    <Sheet title="New savings circle" onClose={close}>
      {step === 1 && (
        <>
          <p className="hint" style={{ marginBottom: 4 }}>
            Step 1 of 3 · the basics
          </p>
          <Field label="Circle name">
            <input
              value={d.name}
              placeholder="e.g. Family August Ajo"
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <Seg
              options={[
                ["rotating", "Rotating"],
                ["target", "Target"],
                ["family", "Family"],
              ]}
              value={d.type}
              onChange={(v) => set({ type: v })}
            />
          </Field>
          <Field label={"Members — " + d.maxSize + " people"}>
            <input
              type="range"
              min={3}
              max={20}
              value={d.maxSize}
              onChange={(e) => set({ maxSize: Number(e.target.value) })}
            />
          </Field>
          <Field label="Amount each, per turn">
            <MoneyInput value={d.amount || ""} onChange={(v) => set({ amount: v })} />
          </Field>
          <Field label="Frequency">
            <Seg
              options={[
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
              ]}
              value={d.cadence}
              onChange={(v) => set({ cadence: v })}
            />
          </Field>
          <button
            className="btn full"
            onClick={() => {
              if (!d.name.trim() || d.amount <= 0) return toast("Name and amount needed");
              setStep(2);
            }}
          >
            Continue
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <p className="hint" style={{ marginBottom: 4 }}>
            Step 2 of 3 · payout order &amp; the idle pot
          </p>
          <div className="radio-list">
            {(
              [
                ["join", "By the order people join"],
                ["random", "Random draw when the circle fills"],
                ["need", "Members state need / bid each cycle"],
              ] as [string, string][]
            ).map(([v, l]) => (
              <label key={v}>
                <input
                  type="radio"
                  name="ord"
                  checked={d.payoutOrder === v}
                  onChange={() => set({ payoutOrder: v })}
                />
                {l}
              </label>
            ))}
          </div>
          <Field label="Between payouts">
            <div className="radio-list" style={{ marginTop: 0 }}>
              <label>
                <input
                  type="radio"
                  name="grw"
                  checked={d.floatEnabled}
                  onChange={() => set({ floatEnabled: true })}
                />
                Hold the pot in the Money Market Fund and split the yield (members vote each cycle)
              </label>
              <label>
                <input
                  type="radio"
                  name="grw"
                  checked={!d.floatEnabled}
                  onChange={() => set({ floatEnabled: false })}
                />
                Keep the pot in escrow, no yield
              </label>
            </div>
          </Field>
          <Field label="Your slot (payout position)">
            <input
              type="number"
              min={1}
              max={d.maxSize}
              value={d.mySlot}
              onChange={(e) => set({ mySlot: Number(e.target.value) })}
            />
          </Field>
          <Field label="Grace days">
            <input
              type="number"
              min={0}
              max={14}
              value={d.graceDays}
              onChange={(e) => set({ graceDays: Number(e.target.value) })}
            />
          </Field>
          <button className="btn full" onClick={() => setStep(3)}>
            Review
          </button>
          <button className="btn ghost full" style={{ marginTop: 8 }} onClick={() => setStep(1)}>
            Back
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <p className="hint" style={{ marginBottom: 4 }}>
            Step 3 of 3 · review &amp; create
          </p>
          <div className="review">
            <div className="headline">
              {d.maxSize} people × {fmt(d.amount)} / {d.cadence === "weekly" ? "week" : "month"}
            </div>
            <div className="rrow">
              <span className="rl">Name</span>
              <span className="rv">{d.name || "Untitled circle"}</span>
            </div>
            <div className="rrow">
              <span className="rl">Pot each turn</span>
              <span className="rv">{fmt(pot)}</span>
            </div>
            <div className="rrow">
              <span className="rl">Payout order</span>
              <span className="rv">
                {{ join: "Join order", random: "Random draw", need: "By need / bid" }[d.payoutOrder]}
              </span>
            </div>
            <div className="rrow">
              <span className="rl">Idle pot</span>
              <span className="rv">{d.floatEnabled ? "Money Market Fund" : "Escrow only"}</span>
            </div>
            <div className="rrow">
              <span className="rl">Guarantee fund</span>
              <span className="rv">{fmt(d.amount)}</span>
            </div>
          </div>

          <Field label="List on Discover?">
            <div className="radio-list" style={{ marginTop: 0 }}>
              <label>
                <input
                  type="radio"
                  name="disc"
                  checked={!d.discoverable}
                  onChange={() => set({ discoverable: false })}
                />
                Private — invite by code only
              </label>
              <label>
                <input
                  type="radio"
                  name="disc"
                  checked={d.discoverable}
                  onChange={() => set({ discoverable: true })}
                />
                Public — people can request to join
              </label>
            </div>
          </Field>
          {d.discoverable && (
            <>
              <Field label="Category">
                <select
                  value={d.category}
                  onChange={(e) => set({ category: e.target.value })}
                >
                  {["General", "Rent", "School fees", "Business", "Target"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={"Minimum reliability to join — " + d.reliabilityFloor + "%"}>
                <input
                  type="range"
                  min={0}
                  max={99}
                  value={d.reliabilityFloor}
                  onChange={(e) => set({ reliabilityFloor: Number(e.target.value) })}
                />
              </Field>
              <Field label="Your stake against default (optional)">
                <MoneyInput
                  value={d.organiserStake || ""}
                  onChange={(v) => set({ organiserStake: v })}
                />
              </Field>
              <Field label="One line for the listing">
                <input
                  value={d.blurb}
                  placeholder="What this circle is for"
                  onChange={(e) => set({ blurb: e.target.value })}
                />
              </Field>
            </>
          )}

          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 13,
              color: "var(--mut)",
              margin: "6px 0 14px",
            }}
          >
            <input
              type="checkbox"
              checked={d.autoDebit}
              onChange={(e) => set({ autoDebit: e.target.checked })}
            />
            Auto-debit my own contribution each cycle
          </label>

          <button
            className="btn full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const code = await createCircle({
                  name: d.name.trim(),
                  type: d.type,
                  cadence: d.cadence,
                  amount: d.amount,
                  anchorDay: new Date().getDate(),
                  graceDays: d.graceDays,
                  lateFee: d.lateFee,
                  mySlot: d.mySlot,
                  myName: data!.profile.name || "You",
                  autoDebit: d.autoDebit,
                  category: d.category,
                  maxSize: d.maxSize,
                  payoutOrder: d.payoutOrder,
                  floatEnabled: d.floatEnabled,
                  discoverable: d.discoverable,
                  reliabilityFloor: d.reliabilityFloor,
                  organiserStake: d.organiserStake,
                  blurb: d.blurb,
                });
                await reload();
                setCreated(code);
              } catch (e: any) {
                toast(e.message || "Could not create circle");
              }
              setBusy(false);
            }}
          >
            {busy ? "Creating…" : "Create circle & get invite code"}
          </button>
          <button className="btn ghost full" style={{ marginTop: 8 }} onClick={() => setStep(2)}>
            Back
          </button>
        </>
      )}
    </Sheet>
  );
}

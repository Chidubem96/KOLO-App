"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { raiseDispute } from "@/lib/api";
import { Field, Sheet } from "../ui";

const REASONS = [
  "I did not receive this money",
  "The amount is wrong",
  "This contribution was on time, not late",
  "Duplicate entry",
];

export function DisputeSheet({
  circleId,
  subject,
}: {
  circleId: string;
  subject: string;
}) {
  const { data, reload, toast } = useKolo();
  const { close } = useSheet();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    await raiseDispute({
      circleId,
      userId: data!.userId,
      name: data!.profile.name || "Member",
      subject,
      reason,
      note,
    });
    toast("Dispute opened. Payouts on this entry are paused for 48h.");
    await reload();
    setBusy(false);
    close();
  };

  return (
    <Sheet title="Raise a dispute" onClose={close}>
      <p className="hint">{subject}</p>
      <div className="radio-list">
        {REASONS.map((r) => (
          <label key={r}>
            <input
              type="radio"
              name="dr"
              checked={reason === r}
              onChange={() => setReason(r)}
            />
            {r}
          </label>
        ))}
      </div>
      <Field label="Add a note for the circle">
        <input
          value={note}
          placeholder="Optional — what happened"
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <button className="btn full" disabled={busy} onClick={submit}>
        {busy ? "Submitting…" : "Submit to circle · all members notified"}
      </button>
    </Sheet>
  );
}

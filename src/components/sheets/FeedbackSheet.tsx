"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { sendFeedback } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { Field, Sheet } from "../ui";

const FACES: [number, string, string][] = [
  [1, "😖", "Bad"],
  [2, "😐", "Meh"],
  [3, "🙂", "OK"],
  [4, "😄", "Good"],
  [5, "🤩", "Love it"],
];

export function FeedbackSheet({ screen = "You" }: { screen?: string }) {
  const { data, toast } = useKolo();
  const { close } = useSheet();
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message.trim() && rating == null) {
      toast("Add a note or pick a face first");
      return;
    }
    setBusy(true);
    try {
      await sendFeedback({
        userId: data!.userId,
        name: data!.profile.name || "Member",
        screen,
        rating,
        message: message.trim(),
      });
      logEvent("feedback_sent", { rating, has_note: !!message.trim() }, screen);
      toast("Sent — thank you 🙏");
      close();
    } catch {
      toast("Couldn't send. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Send feedback" onClose={close}>
      <p className="hint" style={{ marginBottom: 14 }}>
        Anything confusing, broken, missing or wrong. Small notes are welcome —
        this is exactly what shapes the next version.
      </p>

      <div className="field">
        <label>How does Kolo feel right now?</label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {FACES.map(([n, face, lbl]) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              aria-label={lbl}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: 22,
                borderRadius: 12,
                background:
                  rating === n ? "var(--brand)" : "var(--card-2)",
                border:
                  "1px solid " +
                  (rating === n ? "var(--brand)" : "var(--line)"),
                cursor: "pointer",
                transition: "background .12s",
              }}
            >
              {face}
            </button>
          ))}
        </div>
      </div>

      <Field label="What's on your mind?">
        <textarea
          rows={5}
          value={message}
          placeholder="e.g. Safe-to-Spend looked too low after I added rent…"
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>

      <button className="btn full" disabled={busy} onClick={submit}>
        {busy ? "Sending…" : "Send to the builder"}
      </button>
      <p className="hint" style={{ marginTop: 10, textAlign: "center" }}>
        Sends with your name so we can follow up.
      </p>
    </Sheet>
  );
}

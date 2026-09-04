"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { addGoal } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { addMonths, iso } from "@/lib/format";
import { Field, MoneyInput, Seg, Sheet } from "../ui";

export function GoalSheet({
  prefill,
}: {
  prefill?: {
    name?: string;
    target?: number;
    deadline?: string;
    priority?: number;
  };
}) {
  const { data, reload } = useKolo();
  const { close } = useSheet();
  const [name, setName] = useState(prefill?.name || "");
  const [target, setTarget] = useState(prefill?.target || 0);
  const [saved, setSaved] = useState(0);
  const [deadline, setDeadline] = useState(
    prefill?.deadline || iso(addMonths(new Date(), 12))
  );
  const [priority, setPriority] = useState<"1" | "2" | "3">(
    prefill?.priority ? (String(prefill.priority) as "1" | "2" | "3") : "2"
  );

  return (
    <Sheet title="New goal" onClose={close}>
      <Field label="Name">
        <input
          value={name}
          placeholder="Emergency fund, rent, December…"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Target amount">
        <MoneyInput value={target || ""} onChange={setTarget} />
      </Field>
      <Field label="Already saved">
        <MoneyInput value={saved || ""} onChange={setSaved} />
      </Field>
      <Field label="Target date">
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </Field>
      <Field label="Priority">
        <Seg
          options={[
            ["1", "High"],
            ["2", "Medium"],
            ["3", "Low"],
          ]}
          value={priority}
          onChange={setPriority}
        />
      </Field>
      <button
        className="btn block"
        onClick={async () => {
          if (!name.trim() || target <= 0)
            return alert("Name and target needed.");
          await addGoal(data!.userId, {
            name: name.trim(),
            target,
            saved,
            deadline,
            priority: Number(priority),
            paused: false,
            contribLog: [],
          });
          logEvent("goal_added", {
            target,
            saved,
            priority: Number(priority),
            from_adviser: !!prefill,
          });
          await reload();
          close();
        }}
      >
        Create goal
      </button>
    </Sheet>
  );
}

"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { addAccount, updateAccount } from "@/lib/api";
import { Field, MoneyInput, Sheet } from "../ui";

export function AccountSheet({ accountId }: { accountId?: string }) {
  const { data, reload } = useKolo();
  const { close } = useSheet();
  const existing = accountId
    ? data!.accounts.find((a) => a.id === accountId)
    : null;
  const [name, setName] = useState(existing?.name || "");
  const [balance, setBalance] = useState(existing?.balance || 0);
  const [liquid, setLiquid] = useState(existing?.liquid ?? true);
  const [locked, setLocked] = useState(existing?.locked ?? false);

  return (
    <Sheet title={accountId ? "Edit account" : "Add account"} onClose={close}>
      <Field label="Name">
        <input
          value={name}
          placeholder="GTBank, OPay, cash…"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Balance">
        <MoneyInput value={balance || ""} onChange={setBalance} />
      </Field>
      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontSize: 13,
          marginBottom: 8,
        }}
      >
        <input
          type="checkbox"
          checked={liquid}
          onChange={(e) => setLiquid(e.target.checked)}
        />
        Spendable / liquid
      </label>
      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontSize: 13,
          marginBottom: 14,
        }}
      >
        <input
          type="checkbox"
          checked={locked}
          onChange={(e) => setLocked(e.target.checked)}
        />
        Locked (excluded from Safe-to-Spend)
      </label>
      <button
        className="btn block"
        onClick={async () => {
          if (!name.trim()) return alert("Name needed.");
          if (accountId)
            await updateAccount(accountId, {
              name: name.trim(),
              balance,
              liquid,
              locked,
            });
          else
            await addAccount(data!.userId, {
              name: name.trim(),
              balance,
              liquid,
              locked,
            });
          await reload();
          close();
        }}
      >
        {accountId ? "Save" : "Add account"}
      </button>
    </Sheet>
  );
}

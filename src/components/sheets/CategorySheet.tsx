"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { CATS } from "@/lib/engine";
import { setTxnCategory } from "@/lib/api";
import { fmt, fmtDate } from "@/lib/format";
import { Sheet } from "../ui";
import type { Txn } from "@/lib/types";

export function CategorySheet({ txn }: { txn: Txn }) {
  const { reload } = useKolo();
  const { close } = useSheet();
  return (
    <Sheet title="Sort this transaction" onClose={close}>
      <p className="hint" style={{ marginBottom: 12 }}>
        {(txn.note || "Transfer") + " · " + fmt(txn.amount) + " · " + fmtDate(txn.date)}
      </p>
      <div className="chips">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip-btn"
            onClick={async () => {
              await setTxnCategory(txn.id, c.id);
              await reload();
              close();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

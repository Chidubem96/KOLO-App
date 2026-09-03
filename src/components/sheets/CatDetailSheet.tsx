"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { catLabel } from "@/lib/engine";
import { deleteRow } from "@/lib/api";
import { daysAgo, fmt, fmtDate, sum } from "@/lib/format";
import { Icon, Sheet } from "../ui";

export function CatDetailSheet({ catId }: { catId: string }) {
  const { data, reload } = useKolo();
  const { close } = useSheet();
  const items = data!.transactions
    .filter(
      (t) =>
        (t.category || "__unc") === catId &&
        daysAgo(t.date) >= 0 &&
        daysAgo(t.date) <= 30
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = sum(items.map((t) => t.amount));
  return (
    <Sheet
      title={(catId === "__unc" ? "Uncategorised" : catLabel(catId)) + " · " + fmt(total)}
      onClose={close}
    >
      {items.length ? (
        items.map((t) => (
          <div key={t.id} className="lrow" style={{ cursor: "default" }}>
            <div className="grow">
              <div className="t" style={{ fontSize: 13.5 }}>
                {t.note || "Transaction"}
                {t.auto ? "  ·  auto" : ""}
              </div>
              <div className="s">{fmtDate(t.date)}</div>
            </div>
            <div className="r">{fmt(t.amount)}</div>
            <button
              className="iconbtn"
              aria-label="Delete"
              onClick={async () => {
                await deleteRow("transactions", t.id);
                reload();
              }}
            >
              {Icon.x}
            </button>
          </div>
        ))
      ) : (
        <p className="hint">Nothing in the last 30 days.</p>
      )}
    </Sheet>
  );
}

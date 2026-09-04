"use client";
import { useMemo, useState } from "react";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { addObligation, addTxns } from "@/lib/api";
import { logEvent } from "@/lib/events";
import {
  CATS,
  amountInSource,
  categoriseOr,
  parseAlerts,
  parseCSV,
} from "@/lib/engine";
import { addDays, daysAgo, iso, parseMoney, todayD, todayStr } from "@/lib/format";
import { CatSelect, Field, MoneyInput, Sheet } from "../ui";
import type { DraftTxn } from "@/lib/types";

type Mode = "manual" | "paste" | "csv";

export function TxnSheet({ mode: initial }: { mode: Mode }) {
  const { close } = useSheet();
  const [mode, setMode] = useState<Mode>(initial);
  return (
    <Sheet title="Add transactions" onClose={close}>
      <div className="chips" style={{ marginBottom: 16 }}>
        {(
          [
            ["manual", "Type it"],
            ["paste", "Paste alert"],
            ["csv", "Import CSV"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            className={"chip-btn" + (mode === m ? " on" : "")}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "manual" ? (
        <ManualForm />
      ) : mode === "paste" ? (
        <PasteForm />
      ) : (
        <CsvForm />
      )}
    </Sheet>
  );
}

function ManualForm() {
  const { data, reload } = useKolo();
  const { close } = useSheet();
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [person, setPerson] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const oblish =
    person || ["home", "rent", "levy", "school", "faith"].includes(category);

  return (
    <div>
      <Field label="Amount">
        <MoneyInput value={amount || ""} onChange={setAmount} />
      </Field>
      <Field label="Category">
        <div className="chips">
          {CATS.filter((c) => c.id !== "circle").map((c) => (
            <button
              key={c.id}
              type="button"
              className={"chip-btn" + (category === c.id ? " on" : "")}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Note (optional)">
        <input
          value={note}
          placeholder="Market, Bolt, Mama…"
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontSize: 13,
          color: "var(--mut)",
          marginBottom: 14,
        }}
      >
        <input
          type="checkbox"
          checked={person}
          onChange={(e) => setPerson(e.target.checked)}
        />
        This went to a person (not a shop)
      </label>
      {oblish && (
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 13,
            color: "var(--mut)",
            margin: "-6px 0 14px",
          }}
        >
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          This repeats every month — track it as an obligation
        </label>
      )}
      <button
        className="btn block"
        onClick={async () => {
          if (amount <= 0) return alert("Enter an amount.");
          await addTxns(data!.userId, [
            {
              date,
              amount,
              category,
              note: note.trim(),
              person,
              source: "manual",
              auto: false,
              period: null,
            },
          ]);
          logEvent("txn_logged", { count: 1, via: "manual", category }, "Money");
          if (recurring)
            await addObligation(data!.userId, {
              label: note.trim() || (person ? "Monthly transfer" : "Monthly bill"),
              kind: person ? "transfer" : "bill",
              amount,
              cadence: "monthly",
              anchorDay: new Date(date).getDate() || 1,
              active: true,
              source: "confirmed",
              category: category || (person ? "home" : "rent"),
              autoPost: false,
              since: todayStr(),
              sig: null,
            });
          await reload();
          close();
        }}
      >
        Save
      </button>
    </div>
  );
}

function normalizeDraft(x: any): DraftTxn {
  return {
    amount: Math.round(Math.abs(Number(x.amount) || 0)),
    date:
      x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : todayStr(),
    direction: x.direction === "credit" ? "credit" : "debit",
    category: CATS.some((c) => c.id === x.category)
      ? x.category
      : categoriseOr(
          (x.note || "") + " " + (x.counterparty || ""),
          !!x.is_person
        ),
    note: (x.note || x.counterparty || "")
      .toString()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50),
    person: !!x.is_person,
    include: true,
  };
}

const dkey = (d: { amount: number; date: string; note: string }) =>
  d.amount + "|" + d.date + "|" + (d.note || "").toLowerCase().slice(0, 24);

function PasteForm() {
  const { data } = useKolo();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [drafts, setDrafts] = useState<DraftTxn[] | null>(null);
  const [busy, setBusy] = useState(false);

  const parse = async () => {
    const raw = text.trim();
    if (raw.length < 6) {
      setStatus("Paste an alert first.");
      return;
    }
    setBusy(true);
    setStatus("Reading the text…");
    setDrafts(null);
    let rows: any[] = [];
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: raw }),
      });
      const j = await res.json();
      rows = Array.isArray(j.rows) ? j.rows : [];
    } catch {
      rows = [];
    }
    // Also run the regex parser and merge in anything the model missed.
    const regexRows = parseAlerts(raw);
    const seen = new Set(
      rows
        .filter((r: any) => Number(r.amount) > 0)
        .map((r: any) => Math.round(Math.abs(Number(r.amount))))
    );
    for (const rr of regexRows) {
      if (rr.currency || rr.amount <= 0) rows.push(rr);
      else if (!seen.has(rr.amount)) {
        rows.push(rr);
        seen.add(rr.amount);
      }
    }
    setBusy(false);

    const isNgn = (r: any) =>
      !r.currency || String(r.currency).toUpperCase() === "NGN";

    // 1. foreign currency — never coerced into naira
    const fxRows = rows.filter((r: any) => !isNgn(r));
    // 2. an alert we could read at all but with no usable naira amount
    const blankRows = rows.filter(
      (r: any) => isNgn(r) && !(Number(r.amount) > 0)
    );
    // 3. usable naira debits that actually appear in the pasted text
    let ds = rows
      .filter(
        (r: any) =>
          isNgn(r) && Number(r.amount) > 0 && r.direction !== "credit"
      )
      .map(normalizeDraft)
      .filter((d) => d.amount > 0 && amountInSource(d.amount, raw));

    // dedupe within the batch, and against transactions logged in the last 10 days
    const recent = new Set(
      (data?.transactions ?? [])
        .filter((t) => Math.abs(daysAgo(t.date)) <= 10)
        .map((t) => dkey({ amount: t.amount, date: t.date, note: t.note }))
    );
    const batch = new Set<string>();
    ds = ds.map((d) => {
      const k = dkey(d);
      const isDupe = batch.has(k) || recent.has(k);
      batch.add(k);
      return isDupe ? { ...d, dupe: true, include: false } : d;
    });
    const dupeCount = ds.filter((d) => d.dupe).length;

    if (!ds.length && !fxRows.length && !blankRows.length) {
      setStatus("No debit found. Paste the alert exactly as your bank sent it.");
      return;
    }

    const parts: string[] = [];
    if (ds.length)
      parts.push(
        ds.length -
          dupeCount +
          " ready below" +
          (dupeCount ? " · " + dupeCount + " possible duplicate" + (dupeCount === 1 ? "" : "s") + " unticked" : "")
      );
    if (fxRows.length)
      parts.push(
        fxRows.length +
          " in foreign currency (" +
          Array.from(new Set(fxRows.map((r: any) => r.currency))).join(", ") +
          ") — Kolo only reads naira, add " +
          (fxRows.length === 1 ? "it" : "them") +
          " by hand"
      );
    if (blankRows.length) {
      const snip = blankRows
        .slice(0, 2)
        .map((r: any) => '"' + String(r.note || "").slice(0, 32) + '…"')
        .join(", ");
      parts.push(
        blankRows.length +
          " alert" +
          (blankRows.length === 1 ? "" : "s") +
          " had no readable amount: " +
          snip
      );
    }
    setStatus(parts.join(". ") + ".");
    setDrafts(ds.length ? ds : null); // no empty review list
  };

  return (
    <div>
      <p className="hint" style={{ marginBottom: 8 }}>
        Kolo reads the pasted text and only keeps amounts that appear in it.
      </p>
      <Field label="Alert text">
        <textarea
          rows={7}
          value={text}
          placeholder={
            "Paste one or more debit / credit alerts…\n\nTxn Alert: Debit\nAmt: NGN 12,500.00\nDesc: POS/SHOPRITE IKEJA\nDate: 03-Sep-2026"
          }
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <button className="btn block" disabled={busy} onClick={parse}>
        {busy ? "Reading…" : "Parse"}
      </button>
      {status && (
        <div className="hint" style={{ margin: "10px 0" }}>
          {status}
        </div>
      )}
      {drafts && <DraftReview drafts={drafts} via="paste" />}
    </div>
  );
}

function CsvForm() {
  const [rows, setRows] = useState<string[][] | null>(null);
  return (
    <div>
      <p className="hint" style={{ marginBottom: 10 }}>
        Export a statement as CSV from your bank or wallet app, then pick it here.
        Only debits are imported.
      </p>
      <Field label="Statement file">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const rd = new FileReader();
            rd.onload = () => setRows(parseCSV(String(rd.result)));
            rd.readAsText(f);
          }}
        />
      </Field>
      {rows && <CsvMapper rows={rows} />}
    </div>
  );
}

function CsvMapper({ rows }: { rows: string[][] }) {
  const header = rows[0].map((h) => String(h).trim());
  const body = rows.slice(1);
  const guess = (re: RegExp) => header.findIndex((h) => re.test(h));
  const [map, setMap] = useState({
    date: Math.max(0, guess(/date|posted|value|trans/i)),
    amount: Math.max(0, guess(/debit|withdraw|amount|money ?out|dr\b/i)),
    desc: Math.max(0, guess(/desc|narration|detail|remark|reference|particular|memo/i)),
  });
  const [drafts, setDrafts] = useState<DraftTxn[] | null>(null);

  if (rows.length < 2)
    return <p className="hint">That file has no data rows.</p>;

  const sel = (key: keyof typeof map, label: string) => (
    <Field label={label}>
      <select
        value={map[key]}
        onChange={(e) =>
          setMap((m) => ({ ...m, [key]: Number(e.target.value) }))
        }
      >
        {header.map((h, i) => (
          <option key={i} value={i}>
            {h || "Column " + (i + 1)}
          </option>
        ))}
      </select>
    </Field>
  );

  if (drafts) return <DraftReview drafts={drafts} via="csv" />;

  return (
    <div>
      {sel("date", "Date column")}
      {sel("amount", "Amount column")}
      {sel("desc", "Description column")}
      <button
        className="btn block"
        onClick={() => {
          const ds = body
            .map((r) => {
              const amt = parseMoney(r[map.amount]);
              let dt = todayStr();
              const p = Date.parse(String(r[map.date] || "").replace(/-/g, " "));
              if (!isNaN(p)) {
                const dd = new Date(p);
                dd.setHours(12, 0, 0, 0);
                if (dd <= todayD() && dd > addDays(todayD(), -400)) dt = iso(dd);
              }
              const note = String(r[map.desc] || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 50);
              return {
                amount: Math.round(Math.abs(amt)),
                date: dt,
                direction: "debit" as const,
                category: categoriseOr(note),
                note,
                person: false,
                include: amt > 0,
              };
            })
            .filter((d) => d.amount > 0);
          if (!ds.length) return alert("No usable amounts — pick the debit column.");
          setDrafts(ds);
        }}
      >
        Read {body.length} rows
      </button>
    </div>
  );
}

function DraftReview({
  drafts,
  via = "import",
}: {
  drafts: DraftTxn[];
  via?: string;
}) {
  const { data, reload } = useKolo();
  const { close } = useSheet();
  const [list, setList] = useState(drafts.slice(0, 60));
  const patch = (i: number, p: Partial<DraftTxn>) =>
    setList((s) => s.map((d, j) => (j === i ? { ...d, ...p } : d)));

  return (
    <div style={{ marginTop: 8 }}>
      {list.map((d, i) => (
        <div
          key={i}
          className="card"
          style={{ marginBottom: 8, padding: "11px 12px" }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={d.include}
              onChange={(e) => patch(i, { include: e.target.checked })}
            />
            <input
              type="text"
              value={d.note}
              placeholder="Note"
              style={{ flex: 1 }}
              onChange={(e) => patch(i, { note: e.target.value })}
            />
            {d.dupe && (
              <span className="chip" style={{ color: "var(--warn)" }}>
                possible duplicate
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="money-input" style={{ flex: 1 }}>
              <span>₦</span>
              <input
                type="number"
                value={d.amount}
                style={{ paddingLeft: 26 }}
                onChange={(e) => patch(i, { amount: parseMoney(e.target.value) })}
              />
            </div>
            <input
              type="date"
              value={d.date}
              style={{ flex: 1 }}
              onChange={(e) => patch(i, { date: e.target.value })}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <CatSelect
              value={d.category}
              onChange={(v) => patch(i, { category: v })}
            />
          </div>
          {(d.person ||
            ["home", "rent", "levy", "school", "faith"].includes(
              d.category || ""
            )) && (
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontSize: 12.5,
                color: "var(--mut)",
                marginTop: 8,
              }}
            >
              <input
                type="checkbox"
                checked={!!d.recurring}
                onChange={(e) => patch(i, { recurring: e.target.checked })}
              />
              This repeats every month — track it as an obligation
            </label>
          )}
        </div>
      ))}
      <button
        className="btn block"
        style={{ marginTop: 4 }}
        onClick={async () => {
          const keep = list.filter((d) => d.include && d.amount > 0);
          if (!keep.length) return close();
          logEvent("txn_logged", { count: keep.length, via }, "Money");
          await addTxns(
            data!.userId,
            keep.map((d) => ({
              date: d.date,
              amount: d.amount,
              category: d.category,
              note: (d.note || "").trim(),
              person: !!d.person,
              source: "import",
              auto: false,
              period: null,
            }))
          );
          // "one question, asked once" — rows the user marked as monthly
          // become obligations straight away, no 3-occurrence wait.
          for (const d of keep.filter((x) => x.recurring)) {
            await addObligation(data!.userId, {
              label: (d.note || "Monthly commitment").trim(),
              kind: d.person ? "transfer" : "bill",
              amount: d.amount,
              cadence: "monthly",
              anchorDay: new Date(d.date).getDate() || 1,
              active: true,
              source: "confirmed",
              category: d.category || (d.person ? "home" : "rent"),
              autoPost: false,
              since: todayStr(),
              sig: null,
            });
            logEvent("obligation_added", { amount: d.amount, source: "paste_confirm" });
          }
          await reload();
          close();
        }}
      >
        Add these transactions
      </button>
    </div>
  );
}

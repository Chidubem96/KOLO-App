"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import {
  CATS,
  catLabel,
  detectObligations,
  isDisc,
  monthlyRollups,
  obligationDue,
} from "@/lib/engine";
import {
  addObligation,
  dismissSig,
  updateObligation,
  deleteRow,
} from "@/lib/api";
import {
  clamp,
  daysAgo,
  fmt,
  fmtDate,
  fmtSigned,
  sum,
  todayStr,
} from "@/lib/format";
import { Icon } from "../ui";
import { TxnSheet } from "../sheets/TxnSheet";
import { CategorySheet } from "../sheets/CategorySheet";
import { CatDetailSheet } from "../sheets/CatDetailSheet";
import { ObligationSheet } from "../sheets/ObligationSheet";

export function Money() {
  const { data, reload, recurringPosted } = useKolo();
  const d = data!;
  const sheet = useSheet();

  const monthTx = d.transactions.filter(
    (t) => daysAgo(t.date) >= 0 && daysAgo(t.date) <= 30
  );
  const spent = sum(monthTx.map((t) => t.amount));
  const roll = monthlyRollups(d);
  const earned =
    d.profile.incomeType === "salaried"
      ? d.profile.incomeAmount || 0
      : roll.income;

  const unc = d.transactions.filter(
    (t) => !t.category && daysAgo(t.date) <= 60
  );
  const det = detectObligations(d);

  const byCat: Record<string, number> = {};
  monthTx.forEach((t) => {
    const k = t.category || "__unc";
    byCat[k] = (byCat[k] || 0) + t.amount;
  });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxC = cats.length ? cats[0][1] : 1;

  return (
    <div className="pad">
      <div className="metric-strip">
        <div>
          <div className="mv">{fmt(earned)}</div>
          <div className="ml">Income / mo</div>
        </div>
        <div>
          <div className="mv">{fmt(spent)}</div>
          <div className="ml">Spent · 30d</div>
        </div>
        <div>
          <div className="mv">{fmtSigned(earned - spent)}</div>
          <div className="ml">Net of income</div>
        </div>
      </div>

      {recurringPosted > 0 && (
        <div className="advise" style={{ marginTop: 0, marginBottom: 14 }}>
          <b>Auto-logged</b>
          {recurringPosted} recurring{" "}
          {recurringPosted === 1 ? "item" : "items"} posted since you were last
          here.
        </div>
      )}

      <div className="btnrow" style={{ marginBottom: 16 }}>
        <button
          className="btn sm"
          onClick={() => sheet.open(<TxnSheet mode="paste" />)}
        >
          Paste an alert
        </button>
        <button
          className="btn sm ghost"
          onClick={() => sheet.open(<TxnSheet mode="csv" />)}
        >
          Import statement
        </button>
      </div>

      {unc.length > 0 && (
        <div
          className="card"
          style={{ marginBottom: 14, borderColor: "var(--warn-wash)" }}
        >
          <p
            className="kicker"
            style={{ color: "var(--warn)", marginBottom: 8 }}
          >
            {unc.length} transaction{unc.length === 1 ? "" : "s"} need a category
          </p>
          {unc.slice(0, 4).map((t) => (
            <div key={t.id} className="lrow" style={{ cursor: "default" }}>
              <div className="grow">
                <div className="t" style={{ fontSize: 13.5 }}>
                  {t.note || "Transfer"}
                </div>
                <div className="s">
                  {fmtDate(t.date)}
                  {t.person ? " · to a person" : ""}
                </div>
              </div>
              <div className="r">{fmt(t.amount)}</div>
              <button
                className="btn sm ghost"
                onClick={() => sheet.open(<CategorySheet txn={t} />)}
              >
                Sort
              </button>
            </div>
          ))}
        </div>
      )}

      {det.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="kicker" style={{ marginBottom: 4 }}>
            Looks like a recurring obligation
          </p>
          <p className="hint" style={{ marginBottom: 8 }}>
            Confirming teaches Kolo and pulls it into Safe-to-Spend.
          </p>
          {det.slice(0, 3).map((x) => (
            <div key={x.sig} className="lrow" style={{ cursor: "default" }}>
              <div className="grow">
                <div className="t" style={{ fontSize: 13.5 }}>
                  {x.label}
                </div>
                <div className="s">
                  ~{fmt(x.amount)} · {x.cadence} · seen {x.count}×
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn sm brass"
                  onClick={async () => {
                    await addObligation(d.userId, {
                      label: x.label,
                      kind: x.person ? "transfer" : "bill",
                      amount: x.amount,
                      cadence: x.cadence,
                      anchorDay: x.anchorDay,
                      active: true,
                      source: "detected",
                      category: x.category || (x.person ? "home" : "other"),
                      autoPost: true,
                      since: todayStr(),
                      sig: x.sig,
                    });
                    reload();
                  }}
                >
                  Yes
                </button>
                <button
                  className="btn sm ghost"
                  onClick={async () => {
                    await dismissSig(
                      d.userId,
                      d.profile.dismissedSigs,
                      x.sig
                    );
                    reload();
                  }}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="h-sec" style={{ margin: "6px 0 4px" }}>
        Where it went · last 30 days
      </h3>
      {!cats.length && (
        <div className="empty">
          Nothing logged in the last 30 days. Tap ＋ to add a spend.
        </div>
      )}
      {cats.map(([k, v]) => (
        <button
          key={k}
          className="lrow"
          onClick={() => sheet.open(<CatDetailSheet catId={k} />)}
        >
          <div className="grow">
            <div className="t" style={{ fontSize: 14 }}>
              {k === "__unc" ? "Uncategorised" : catLabel(k)}
            </div>
            <div className="bar">
              <i
                className={isDisc(k) ? "" : "warn"}
                style={{ width: clamp((v / maxC) * 100, 4, 100) + "%" }}
              />
            </div>
          </div>
          <div className="r">{fmt(v)}</div>
          <span style={{ width: 16, height: 16, display: "inline-flex" }}>
            {Icon.chev}
          </span>
        </button>
      ))}

      <div className="divider" />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 className="h-sec">Obligations</h3>
        <button
          className="btn ghost sm"
          onClick={() => sheet.open(<ObligationSheet />)}
        >
          + Add
        </button>
      </div>
      {!d.obligations.length && (
        <p className="hint" style={{ marginTop: 8 }}>
          None yet. These are the commitments that come out before your income
          is really yours — rent, upkeep, cooperative dues.
        </p>
      )}
      {d.obligations.map((o) => (
        <div key={o.id} className="lrow" style={{ cursor: "default" }}>
          <div className="grow">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="t" style={{ fontSize: 14 }}>
                {o.label}
              </span>
              {o.autoPost && <span className="pill ok">auto</span>}
            </div>
            <div className="s">
              {fmt(o.amount)} · {o.cadence} · next{" "}
              {fmtDate(obligationDue(o))}
              {o.source === "detected" ? " · auto-detected" : ""}
            </div>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            <input
              type="checkbox"
              checked={o.active}
              onChange={async (e) => {
                await updateObligation(o.id, { active: e.target.checked });
                reload();
              }}
            />
            on
          </label>
          <button
            className="iconbtn"
            aria-label="Edit"
            onClick={() => sheet.open(<ObligationSheet oblId={o.id} />)}
          >
            {Icon.gear}
          </button>
          <button
            className="iconbtn"
            aria-label="Delete"
            onClick={async () => {
              await deleteRow("obligations", o.id);
              reload();
            }}
          >
            {Icon.x}
          </button>
        </div>
      ))}
      <p className="hint" style={{ marginTop: 10 }}>
        Items marked “auto” post their transaction on the due date each cycle, so
        you never re-enter rent, upkeep or dues.
      </p>
    </div>
  );
}

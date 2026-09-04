"use client";
import { useKolo } from "@/lib/store";
import { useSheet } from "../sheet-context";
import { saveProfile } from "@/lib/api";
import { Field, Icon, MoneyInput, Seg } from "../ui";
import { AccountSheet } from "../sheets/AccountSheet";
import { fmt } from "@/lib/format";
import { deleteRow } from "@/lib/api";

export function Settings({ embedded }: { embedded?: boolean }) {
  const { data, reload, signOut } = useKolo();
  const d = data!;
  const sheet = useSheet();
  const p = d.profile;
  const set = async (patch: Record<string, unknown>) => {
    await saveProfile(d.userId, patch);
    reload();
  };

  return (
    <div className={embedded ? "" : "pad"}>
      <h3 className="h-sec">Profile</h3>
      <Field label="Name">
        <input
          defaultValue={p.name}
          onBlur={(e) => set({ name: e.target.value })}
        />
      </Field>
      <Field label="Adviser language">
        <Seg
          options={[
            ["en", "Nigerian English"],
            ["pidgin", "Pidgin"],
          ]}
          value={(p.lang as any) || "en"}
          onChange={(v) => set({ lang: v })}
        />
      </Field>

      <div className="divider" />
      <h3 className="h-sec">Assumptions</h3>
      <p className="hint" style={{ margin: "4px 0 10px" }}>
        Kolo states these on every recommendation. Correcting one retrains your
        figure.
      </p>
      <Field label="Income pattern">
        <Seg
          options={[
            ["salaried", "Salaried"],
            ["irregular", "Irregular"],
            ["mixed", "Mixed"],
          ]}
          value={p.incomeType}
          onChange={(v) => set({ income_type: v })}
        />
      </Field>
      <Field
        label={p.incomeType === "irregular" ? "Typical amount" : "Monthly income"}
      >
        <MoneyInput
          value={p.incomeAmount || ""}
          onChange={(v) => set({ income_amount: v })}
        />
      </Field>
      {p.incomeType !== "irregular" && (
        <Field label="Salary day of month">
          <input
            type="number"
            min={1}
            max={28}
            defaultValue={p.incomeDay || 25}
            onBlur={(e) =>
              set({
                income_day: Number(e.target.value) || 25,
                salary_day: Number(e.target.value) || 25,
              })
            }
          />
        </Field>
      )}
      <Field label="Rent (monthly)">
        <MoneyInput
          value={p.rent || ""}
          onChange={(v) => set({ rent: v })}
        />
      </Field>
      <Field label={"Volatility buffer — k = " + p.bufferK}>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.1}
          defaultValue={p.bufferK}
          onChange={(e) => set({ buffer_k: Number(e.target.value) })}
        />
      </Field>

      <div className="divider" />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 className="h-sec">Accounts</h3>
        <button
          className="btn ghost sm"
          onClick={() => sheet.open(<AccountSheet />)}
        >
          + Add
        </button>
      </div>
      {d.accounts.map((a) => (
        <div key={a.id} className="lrow" style={{ cursor: "default" }}>
          <div className="grow">
            <div className="t" style={{ fontSize: 14 }}>
              {a.name}
            </div>
            <div className="s">
              {fmt(a.balance)}
              {a.locked ? " · locked" : a.liquid ? "" : " · not liquid"}
            </div>
          </div>
          <button
            className="btn ghost sm"
            onClick={() => sheet.open(<AccountSheet accountId={a.id} />)}
          >
            Edit
          </button>
          <button
            className="iconbtn"
            aria-label="Delete"
            onClick={async () => {
              await deleteRow("accounts", a.id);
              reload();
            }}
          >
            {Icon.x}
          </button>
        </div>
      ))}

      <div className="divider" />
      <h3 className="h-sec">How Safe-to-Spend is built</h3>
      <div className="abouttext" style={{ marginTop: 8 }}>
        <p className="pull">Balance is a lie. Safe-to-Spend is the product.</p>
        <p>
          <strong>Safe to spend</strong> = your liquid balance, minus obligations
          due before your next income, minus what your active goals need this
          period, minus a buffer for how bumpy your spending is.
        </p>
        <p>
          A deterministic engine computes every figure. The assistant may only
          read and narrate those figures — it is blocked from putting a naira
          amount on screen that the engine didn&apos;t produce.
        </p>
        <p>
          <strong>Circles</strong> sync live between everyone in them. This V1
          records contributions; it does not hold or move money, and there is no
          escrow account yet.
        </p>
      </div>

      <button
        className="btn ghost block"
        style={{ marginTop: 20 }}
        onClick={signOut}
      >
        Sign out
      </button>
      <p
        className="hint"
        style={{ marginTop: 16, textAlign: "center" }}
      >
        Kolo V1 · working name · figures are yours, held in your account.
      </p>
    </div>
  );
}

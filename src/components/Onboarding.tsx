"use client";
import { useState } from "react";
import { useKolo } from "@/lib/store";
import { addAccount, saveProfile } from "@/lib/api";
import { Field, Icon, MoneyInput, Seg } from "./ui";
import { parseMoney } from "@/lib/format";

export function Onboarding() {
  const { data, reload } = useKolo();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(data?.profile.name || "");
  const [lang, setLang] = useState<"en" | "pidgin">("en");
  const [accts, setAccts] = useState<{ name: string; balance: number }[]>([
    { name: "", balance: 0 },
  ]);
  const [incomeType, setIncomeType] = useState<
    "salaried" | "irregular" | "mixed"
  >("salaried");
  const [incAmount, setIncAmount] = useState(0);
  const [incDay, setIncDay] = useState(25);

  const finish = async () => {
    setBusy(true);
    const uid = data!.userId;
    const valid = accts.filter((a) => a.name.trim());
    for (const a of valid)
      await addAccount(uid, {
        name: a.name.trim(),
        balance: a.balance,
        liquid: true,
        locked: false,
      });
    await saveProfile(uid, {
      name: name.trim(),
      lang,
      income_type: incomeType,
      income_amount: incAmount,
      income_day: incDay,
      salary_day: incomeType !== "irregular" ? incDay : null,
      onboarded: true,
    });
    await reload();
  };

  return (
    <div className="wrap">
      <div className="app">
        <div className="screen">
          <div className="pad" style={{ maxWidth: 400, margin: "0 auto" }}>
            {step === 1 && (
              <>
                <div className="wordmark-lg" style={{ margin: "18px 0 4px", fontSize: 34 }}>
                  k<b>o</b>lo
                </div>
                <p className="pull">Save in circles. Know what&apos;s yours to spend.</p>
                <p className="abouttext">
                  Kolo runs your ajo circles, does the money arithmetic your head does badly, and
                  shows the one figure that&apos;s actually yours to spend this month.
                </p>
                <Field label="Your name">
                  <input
                    value={name}
                    placeholder="e.g. Chidubem"
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Language">
                  <Seg
                    options={[
                      ["en", "Nigerian English"],
                      ["pidgin", "Pidgin"],
                    ]}
                    value={lang}
                    onChange={setLang}
                  />
                </Field>
                <button
                  className="btn block"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    if (!name.trim()) return alert("Add your name to continue.");
                    setStep(2);
                  }}
                >
                  Continue
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <p className="kicker" style={{ marginBottom: 6 }}>
                  Step 2 of 3
                </p>
                <h2 className="h-title">Where is your money?</h2>
                <p className="abouttext" style={{ margin: "8px 0 16px" }}>
                  Add the accounts and wallets you actually use. Balances only —
                  Kolo never moves money. Two or more gives a full picture.
                </p>
                {accts.map((a, i) => (
                  <div
                    key={i}
                    className="card"
                    style={{ marginBottom: 10 }}
                  >
                    <Field label="Account name">
                      <input
                        value={a.name}
                        placeholder="GTBank salary, OPay wallet…"
                        onChange={(e) =>
                          setAccts((s) =>
                            s.map((x, j) =>
                              j === i ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                      />
                    </Field>
                    <Field label="Current balance">
                      <MoneyInput
                        value={a.balance || ""}
                        onChange={(v) =>
                          setAccts((s) =>
                            s.map((x, j) =>
                              j === i ? { ...x, balance: v } : x
                            )
                          )
                        }
                      />
                    </Field>
                    {accts.length > 1 && (
                      <button
                        className="btn danger sm"
                        onClick={() =>
                          setAccts((s) => s.filter((_, j) => j !== i))
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="btn ghost sm"
                  onClick={() =>
                    setAccts((s) => [...s, { name: "", balance: 0 }])
                  }
                >
                  + Add another account
                </button>
                <button
                  className="btn block"
                  style={{ marginTop: 14 }}
                  onClick={() => {
                    if (!accts.some((a) => a.name.trim()))
                      return alert("Add at least one account.");
                    setStep(3);
                  }}
                >
                  Continue
                </button>
                <button
                  className="btn ghost block"
                  style={{ marginTop: 10 }}
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <p className="kicker" style={{ marginBottom: 6 }}>
                  Step 3 of 3
                </p>
                <h2 className="h-title">How does income arrive?</h2>
                <p className="abouttext" style={{ margin: "8px 0 16px" }}>
                  This sets your horizon — the date Safe-to-Spend counts down to.
                </p>
                <Field label="Pattern">
                  <Seg
                    options={[
                      ["salaried", "Salaried"],
                      ["irregular", "Irregular"],
                      ["mixed", "Mixed"],
                    ]}
                    value={incomeType}
                    onChange={setIncomeType}
                  />
                </Field>
                <Field
                  label={
                    incomeType === "irregular"
                      ? "Typical amount when it lands"
                      : "Monthly amount"
                  }
                >
                  <MoneyInput
                    value={incAmount || ""}
                    onChange={setIncAmount}
                  />
                </Field>
                {incomeType !== "irregular" && (
                  <Field label="Day of month it lands">
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={incDay}
                      onChange={(e) => setIncDay(Number(e.target.value) || 25)}
                    />
                  </Field>
                )}
                <button
                  className="btn block"
                  style={{ marginTop: 8 }}
                  disabled={busy}
                  onClick={finish}
                >
                  {busy ? "Setting up…" : "See my number"}
                </button>
                <button
                  className="btn ghost block"
                  style={{ marginTop: 10 }}
                  onClick={() => setStep(2)}
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

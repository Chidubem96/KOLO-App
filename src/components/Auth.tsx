"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon } from "./ui";

export function Auth() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setErr("");
    if (!/.+@.+\..+/.test(email)) return setErr("Enter a valid email.");
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, data: { name: name.trim() } },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setStep("code");
  };

  const verify = async () => {
    setErr("");
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) return setErr("That code didn't work — check it and try again.");
    // onAuthStateChange in page.tsx picks it up
  };

  return (
    <div className="authwrap">
      <div className="authcard">
        <div className="wordmark-lg">
          k<b>o</b>lo
        </div>
        <p className="pull" style={{ margin: "14px 0 18px" }}>
          Save in circles. Know what&apos;s yours to spend.
        </p>

        {step === "email" ? (
          <>
            <div className="field">
              <label>Your name</label>
              <input
                value={name}
                placeholder="e.g. Chikamso"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendCode()}
              />
            </div>
            {err && (
              <p className="hint" style={{ color: "var(--neg)" }}>
                {err}
              </p>
            )}
            <button
              className="btn block"
              disabled={busy}
              onClick={sendCode}
              style={{ marginTop: 6 }}
            >
              {busy ? "Sending…" : "Send me a code"}
            </button>
            <p className="hint" style={{ marginTop: 12 }}>
              We&apos;ll email you a 6-digit code. No password.
            </p>
          </>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 12 }}>
              Enter the code sent to <b>{email}</b>.
            </p>
            <div className="field">
              <input
                className="codebox"
                inputMode="numeric"
                maxLength={10}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                onKeyDown={(e) => e.key === "Enter" && verify()}
              />
            </div>
            {err && (
              <p className="hint" style={{ color: "var(--neg)" }}>
                {err}
              </p>
            )}
            <button
              className="btn block"
              disabled={busy || code.length < 6}
              onClick={verify}
            >
              {busy ? "Checking…" : "Verify"}
            </button>
            <button
              className="btn ghost block"
              style={{ marginTop: 10 }}
              onClick={() => {
                setStep("email");
                setCode("");
                setErr("");
              }}
            >
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}

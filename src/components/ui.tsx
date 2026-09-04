"use client";
import React, { useEffect, useState } from "react";
import { CATS } from "@/lib/engine";
import { parseMoney } from "@/lib/format";

/* ---------- icons ---------- */
const s = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    {d}
  </svg>
);
export const Icon = {
  coin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <ellipse cx="12" cy="6" rx="8" ry="3.2" />
      <path d="M4 6v6c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6" />
      <path d="M4 12v6c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-6" />
    </svg>
  ),
  home: s(
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
    </>
  ),
  circles: s(
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c.7-3 3-4.5 5.5-4.5S13.8 16 14.5 19" />
      <path d="M16 6.5a3 3 0 0 1 0 5.8M17 14.5c2.2.4 3.8 1.9 4.4 4.5" />
    </>
  ),
  discover: s(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      <path d="M11 8.5 12.2 11l2.5 1.2-2.5 1.1L11 15.7 9.9 13.3 7.4 12.2 9.9 11z" />
    </>
  ),
  grow: s(
    <>
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="M7 15l3.5-4 3 2.5L18 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  you: s(
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c.7-3.6 3.4-5.5 6.5-5.5s5.8 1.9 6.5 5.5" />
    </>
  ),
  ask: s(
    <>
      <path d="M4 5h16v11H8l-4 3.5z" strokeLinejoin="round" />
      <path d="M9 9h6M9 12h4" strokeLinecap="round" />
    </>
  ),
  gear: s(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M4.2 7l2.2 1.3M17.6 15.7l2.2 1.3M4.2 17l2.2-1.3M17.6 8.3l2.2-1.3" />
    </>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  chev: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  ),
  money: s(
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  goals: s(
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
};

/* ---------- sheet ---------- */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div
      className="scrim"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet">
        <div className="grabber" />
        <div className="sheet-hd">
          <h3>{title || ""}</h3>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>
            {Icon.x}
          </button>
        </div>
        <div className="sheet-bd">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function MoneyInput({
  value,
  onChange,
}: {
  value: string | number;
  onChange: (v: number) => void;
}) {
  const [txt, setTxt] = useState(
    value ? Number(value).toLocaleString("en-NG") : ""
  );
  return (
    <div className="money-input">
      <span>₦</span>
      <input
        inputMode="numeric"
        value={txt}
        onChange={(e) => {
          const raw = parseMoney(e.target.value);
          setTxt(raw ? raw.toLocaleString("en-NG") : "");
          onChange(raw);
        }}
      />
    </div>
  );
}

export function Seg({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: any) => void;
}) {
  return (
    <div className="opts">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={value === v ? "on" : ""}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function CatSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— pick a category —</option>
      {CATS.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

export function Pill({
  kind,
  children,
}: {
  kind: "ok" | "warn" | "bad" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={"pill " + kind}>{children}</span>;
}

/* ---------- reliability ring ---------- */
export function Ring({ score }: { score: number }) {
  const r = 33;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const col =
    score >= 95 ? "var(--pos)" : score >= 85 ? "var(--warn)" : "var(--neg)";
  return (
    <div className="ring">
      <svg width="82" height="82" viewBox="0 0 82 82">
        <circle cx="41" cy="41" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle
          cx="41"
          cy="41"
          r={r}
          fill="none"
          stroke={col}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
        />
      </svg>
      <div className="val" style={{ color: col }}>
        {score}
      </div>
    </div>
  );
}

/* ---------- avatar helper ---------- */
export function initials(n: string) {
  const p = (n || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

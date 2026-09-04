"use client";
import { useEffect, useRef, useState } from "react";
import { useKolo } from "@/lib/store";
import { buildAskContext, assumeLine } from "@/lib/askContext";
import { deterministicAnswer } from "@/lib/adviser";

interface Msg {
  role: "user" | "kolo";
  text: string;
  assume?: string;
  flagged?: boolean;
}

const SUGGESTIONS = [
  "Why is my safe-to-spend where it is?",
  "Can I afford ₦380,000 for a generator this month?",
  "Am I on track for my goals?",
  "I wan buy fridge for ₦250k. E fit work?",
];

export function Ask() {
  const { data } = useKolo();
  const d = data!;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  const ask = async (q: string) => {
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    const ctx = buildAskContext(d);
    const assume = assumeLine(ctx);
    try {
      const res = await fetch("/api/adviser", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, context: ctx }),
      });
      const j = await res.json();
      setMsgs((m) => [
        ...m,
        {
          role: "kolo",
          text: j.answer || deterministicAnswer(ctx),
          assume,
          flagged: !!j.flagged,
        },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "kolo",
          text:
            deterministicAnswer(ctx) + " (Couldn't reach the assistant just now.)",
          assume,
        },
      ]);
    }
    setBusy(false);
  };

  return (
    <div>
      <div style={{ minHeight: 200 }}>
        {msgs.length === 0 ? (
          <>
            <div className="advise" style={{ marginTop: 4 }}>
              <b>Ask Kolo</b>
              Ask about your money in plain words. Every figure in the answer
              comes straight from the engine — Kolo narrates, it never does the
              sums itself.
            </div>
            <div className="suggest">
              {SUGGESTIONS.map((q) => (
                <button key={q} onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={"ask-msg " + (m.role === "user" ? "you" : "kolo")}>
              <div className="ask-bubble">{m.text}</div>
              {m.assume && (
                <div className="ask-assume">{m.assume}</div>
              )}
              {m.flagged && (
                <div className="ask-flag">
                  ⚑ Kolo&apos;s phrasing used a figure the engine couldn&apos;t
                  verify, so the answer above is the engine&apos;s own read.
                </div>
              )}
            </div>
          ))
        )}
        {busy && (
          <div className="ask-msg kolo">
            <div className="think">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="askform"
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.trim();
          if (v && !busy) {
            setInput("");
            ask(v);
          }
        }}
      >
        <input
          placeholder="Ask about your money…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          Ask
        </button>
      </form>
    </div>
  );
}

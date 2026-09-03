import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CATS } from "@/lib/engine";

export const runtime = "nodejs";
export const maxDuration = 30;

// Classification / extraction -> a small, cheap model (per the product spec).
const MODEL = process.env.ANTHROPIC_PARSE_MODEL || "claude-haiku-4-5";

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ rows: [], error: "no key" }, { status: 200 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ rows: [] }, { status: 400 });
  }
  const raw = (body.text || "").toString().slice(0, 6000);
  if (raw.length < 6) return NextResponse.json({ rows: [] });

  const anthropic = new Anthropic({ apiKey: key });
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content:
            "Extract every money transaction from these Nigerian bank / wallet alert messages. " +
            "Reply with ONLY a JSON array (no prose). Each element: " +
            '{"amount": number with no currency symbol or commas, "date": "YYYY-MM-DD" or null, ' +
            '"direction": "debit" or "credit", "counterparty": string, ' +
            '"category": one of [' +
            CATS.map((c) => c.id).join(", ") +
            '] or null, "is_person": boolean, "note": short label}. ' +
            "Only use amounts that appear verbatim in the text — never calculate one. " +
            "If there are none, reply []. Messages:\n\n" +
            raw,
        },
      ],
    });
    const text = (msg.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text as string)
      .join("");
    const m = text.match(/\[[\s\S]*\]/);
    const rows = m ? JSON.parse(m[0]) : [];
    return NextResponse.json({ rows: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return NextResponse.json({ rows: [], error: String(e?.message || e) });
  }
}

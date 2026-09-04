import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { ASK_RULES, enforce, deterministicAnswer } from "@/lib/adviser";

export const runtime = "nodejs";
export const maxDuration = 45;

// Freeform Q&A -> a capable model. Override with ANTHROPIC_MODEL.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  let body: { question?: string; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const question = (body.question || "").toString().slice(0, 600);
  const context = body.context ?? {};
  if (!question) return NextResponse.json({ error: "no question" }, { status: 400 });

  // engine-built action the client turns into a pre-filled "New goal" sheet.
  // Every field here comes from Kolo's deterministic planner, never the model.
  const sg = (context as any)?.planning_request?.suggested_goal;
  const action =
    sg && typeof sg.target === "number" && sg.deadline_iso
      ? {
          kind: "new_goal" as const,
          name: String(sg.name || "Vacation"),
          target: Math.round(sg.target),
          deadline: String(sg.deadline_iso),
          monthly: Math.round(sg.monthly || 0),
          priority: 1,
        }
      : undefined;

  const anthropic = new Anthropic({ apiKey: key });
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // planning answers need a few reasoning steps; quick ones still return fast
      output_config: { effort: "medium" },
      messages: [
        {
          role: "user",
          content:
            ASK_RULES +
            JSON.stringify(context, null, 1) +
            "\n\nUSER QUESTION: " +
            question,
        },
      ],
    } as any);

    if (msg.stop_reason === "refusal")
      return NextResponse.json({ answer: deterministicAnswer(context), flagged: false, action });

    const text = (msg.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text as string)
      .join("")
      .trim();

    if (!text)
      return NextResponse.json({ answer: deterministicAnswer(context), flagged: false, action });

    const check = enforce(text, context, question);
    return NextResponse.json(
      check.ok
        ? { answer: text, flagged: false, action }
        : { answer: deterministicAnswer(context), flagged: true, action }
    );
  } catch (e: any) {
    return NextResponse.json({
      answer: deterministicAnswer(context),
      flagged: false,
      action,
      error: String(e?.message || e),
    });
  }
}

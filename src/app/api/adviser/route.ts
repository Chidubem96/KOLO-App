import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  ASK_RULES,
  enforce,
  deterministicFallback,
  isAdviceSeeking,
  looksLikeRecommendation,
} from "@/lib/adviser";

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
  // Every field here comes from Braid's deterministic planner, never the model.
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
      return NextResponse.json({ answer: deterministicFallback(context, question), flagged: false, action });

    const text = (msg.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text as string)
      .join("")
      .trim();

    if (!text)
      return NextResponse.json({ answer: deterministicFallback(context, question), flagged: false, action });

    // Advice guard: if the question is asking where to put money and the reply
    // reads like a recommendation, replace it with the neutral trade-off.
    if (isAdviceSeeking(question) && looksLikeRecommendation(text))
      return NextResponse.json({
        answer: deterministicFallback(context, question),
        flagged: true,
        action,
      });

    const check = enforce(text, context, question);
    if (!check.ok) {
      // log what was rejected so a false positive is visible, not silent
      console.warn(
        "[adviser] numeral guard rejected token:",
        (check as any).bad,
        "| question:",
        question.slice(0, 120)
      );
      return NextResponse.json({
        answer: deterministicFallback(context, question),
        flagged: true,
        action,
        debug_rejected: (check as any).bad,
      });
    }
    return NextResponse.json({ answer: text, flagged: false, action });
  } catch (e: any) {
    return NextResponse.json({
      answer: deterministicFallback(context, question),
      flagged: false,
      action,
      error: String(e?.message || e),
    });
  }
}

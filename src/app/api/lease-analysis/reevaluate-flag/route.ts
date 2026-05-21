import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/secure-settings"
import { NextRequest, NextResponse } from "next/server";

type FlagTone = "red" | "orange" | "green";

export async function POST(req: NextRequest) {
  try {
    const { reportRaw, flag, note, tone } = await req.json();

    if (!reportRaw || !flag || !note || !tone) {
      return new Response("Missing required fields", { status: 400 });
    }

    const client = new Anthropic({
      apiKey: await getAnthropicApiKey(),
    });

    const prompt = [
      "You are reevaluating one lease-analysis flag only.",
      "Your task is to assess whether the challenged flag should remain in the same color, move to a different color, or be removed entirely.",
      "Use only the provided report context, the flag text, the source quote/citation, and the reviewer note.",
      "Do not analyze the full lease package. Do not create any additional flags.",
      "If the reviewer note correctly shows the current flag is unsupported, either downgrade it, rewrite it, or remove it.",
      'Return strict JSON with this schema: {"decision":"red"|"orange"|"green"|"remove","issue":"string","whyItMatters":"string","sourceSection":"string","reasoning":"string"}',
      "",
      `Current flag tone: ${tone}`,
      `Current issue: ${flag.issue ?? ""}`,
      `Current impact: ${flag.whyItMatters ?? ""}`,
      `Current source: ${flag.sourceSection ?? ""}`,
      `Reviewer note: ${note}`,
      "",
      "Full report context:",
      reportRaw,
    ].join("\n");

    const result = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      temperature: 0,
      system: "You are a precise lease diligence QA reviewer. Output valid JSON only.",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });

    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const parsed = parseJsonResponse(text);

    if (!isValidDecision(parsed?.decision)) {
      throw new Error("Model returned an invalid reevaluation decision.");
    }

    return NextResponse.json({
      decision: parsed.decision,
      flag: {
        issue: String(parsed.issue ?? flag.issue ?? "").trim(),
        whyItMatters: String(parsed.whyItMatters ?? flag.whyItMatters ?? "").trim(),
        sourceSection: String(parsed.sourceSection ?? flag.sourceSection ?? "").trim(),
      },
      reasoning: String(parsed.reasoning ?? "").trim(),
    });
  } catch (error: any) {
    console.error("[lease-analysis][reevaluate-flag]", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to reevaluate flag" },
      { status: 500 },
    );
  }
}

function parseJsonResponse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? text.match(/```([\s\S]*?)```/i)?.[1];
    if (fenced) {
      return JSON.parse(fenced);
    }
    throw new Error("Failed to parse model JSON response.");
  }
}

function isValidDecision(value: unknown): value is FlagTone | "remove" {
  return value === "red" || value === "orange" || value === "green" || value === "remove";
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  analyzeOwnerGmTranscript,
  serializeOwnerGmAssessment,
  parseStoredOwnerGmAssessment,
} from "@/lib/owner-gm-assessment/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECTION_KEY = "ownerGmAssessment";

// ── GET: load cached assessment ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return new Response("Missing clientId", { status: 400 });

    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    });

    const data = (client?.sectionSubmissions as Record<string, any>) ?? {};
    const stored = data[SECTION_KEY] ?? null;

    if (!stored) {
      return NextResponse.json({ assessment: null });
    }

    const parsed =
      typeof stored === "string"
        ? parseStoredOwnerGmAssessment(stored)
        : (stored as any);

    return NextResponse.json({ assessment: parsed ?? null });
  } catch (error) {
    console.error("[owner-gm-assessment] GET error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ── POST: run analysis on uploaded transcript ────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { clientId, fileName, base64, mediaType } = await req.json();

    if (!clientId || !base64) {
      return new Response("Missing clientId or file data", { status: 400 });
    }

    const assessment = await analyzeOwnerGmTranscript({
      fileName: fileName || "transcript",
      base64,
      mediaType: mediaType || "text/plain",
    });

    // Store in client sectionSubmissions
    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    });

    const existing = (client?.sectionSubmissions as Record<string, any>) ?? {};
    existing[SECTION_KEY] = assessment;

    await (prisma as any).clientProfile.update({
      where: { id: clientId },
      data: { sectionSubmissions: existing },
    });

    return NextResponse.json({ assessment });
  } catch (error) {
    console.error("[owner-gm-assessment] POST error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ── DELETE: reset assessment ─────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return new Response("Missing clientId", { status: 400 });

    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    });

    const existing = (client?.sectionSubmissions as Record<string, any>) ?? {};
    delete existing[SECTION_KEY];

    await (prisma as any).clientProfile.update({
      where: { id: clientId },
      data: { sectionSubmissions: existing },
    });

    console.info("[owner-gm-assessment] Reset complete", { clientId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[owner-gm-assessment] DELETE error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

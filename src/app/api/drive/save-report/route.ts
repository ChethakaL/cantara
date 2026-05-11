import { NextRequest, NextResponse } from "next/server";
import { saveGeneratedReportToDrive } from "@/lib/composio";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function extractDriveFolderId(value?: string | null) {
  if (!value) return null;
  const match = value.match(/\/folders\/([^/?#]+)/);
  return match?.[1] ?? value;
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, fileName, html } = await req.json();
    if (!clientId || !fileName || !html) {
      return new Response("clientId, fileName, and html are required", { status: 400 });
    }

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { driveFolderId: true },
    });
    const folderId = extractDriveFolderId(client?.driveFolderId);
    if (!folderId) {
      return new Response("Client does not have a Google Drive folder", { status: 409 });
    }

    const result = await saveGeneratedReportToDrive({ folderId, fileName, html });
    return NextResponse.json({ saved: true, result });
  } catch (error) {
    console.error("Save report to Drive error:", error);
    return new Response("Failed to save report to Google Drive", { status: 500 });
  }
}

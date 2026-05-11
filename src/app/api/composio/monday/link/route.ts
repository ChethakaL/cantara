import { NextRequest, NextResponse } from "next/server";
import { postMondayUpdate } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, reportType, clientName, fileUrl } = body as {
      itemId: string;
      reportType: "CIM" | "Teaser";
      clientName: string;
      fileUrl: string;
    };

    if (!itemId || !reportType || !clientName || !fileUrl) {
      return new Response("itemId, reportType, clientName, and fileUrl are required", { status: 400 });
    }

    await postMondayUpdate({ itemId, reportType, clientName, fileUrl });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Monday.com link error:", error);
    return new Response(
      error instanceof Error ? error.message : "Failed to link to Monday.com",
      { status: 500 }
    );
  }
}

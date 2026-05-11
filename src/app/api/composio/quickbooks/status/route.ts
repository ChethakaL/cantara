import { NextRequest, NextResponse } from "next/server";
import { getQuickBooksConnections } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return new Response("clientId is required", { status: 400 });

    const connections = await getQuickBooksConnections(clientId);
    const latest = connections.items?.[0] ?? null;

    return NextResponse.json({
      connected: latest?.status === "ACTIVE" && !latest.is_disabled,
      connection: latest
        ? {
            id: latest.id,
            status: latest.status,
            updatedAt: latest.updated_at ?? null,
            statusReason: latest.status_reason ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("QuickBooks status error:", error);
    return new Response("Failed to fetch QuickBooks status", { status: 500 });
  }
}

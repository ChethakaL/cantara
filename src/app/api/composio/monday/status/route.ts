import { NextResponse } from "next/server";
import { getMondayConnection } from "@/lib/composio";
import {
  getStoredComposioMondayConnectedAccountId,
  maskSecret,
} from "@/lib/secure-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storedId = await getStoredComposioMondayConnectedAccountId().catch(() => null);
    const connection = await getMondayConnection();
    const isConnected =
      Boolean(connection) &&
      ["ACTIVE", "VERIFYING", "INITIATED"].includes(String(connection?.status || "")) &&
      !connection?.is_disabled;

    return NextResponse.json({
      connected: isConnected,
      source: storedId ? "database" : connection?.id ? "composio" : null,
      connection: connection
        ? {
            id: maskSecret(connection.id),
            status: connection.status,
            userId: connection.user_id ?? null,
            updatedAt: connection.updated_at ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("Monday.com status error:", error);
    return new Response("Failed to fetch Monday.com status", { status: 500 });
  }
}

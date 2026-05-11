import { NextResponse } from "next/server";
import { getMondayConnection } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connection = await getMondayConnection();
    const isConnected = connection && 
      ["ACTIVE", "VERIFYING", "INITIATED"].includes(connection.status) && 
      !connection.is_disabled;

    return NextResponse.json({
      connected: isConnected,
      connection: connection
        ? {
            id: connection.id,
            status: connection.status,
            updatedAt: connection.updated_at ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("Monday.com status error:", error);
    return new Response("Failed to fetch Monday.com status", { status: 500 });
  }
}

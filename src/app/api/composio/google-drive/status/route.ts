import { NextResponse } from "next/server";
import { getGoogleDriveConnection } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connection = await getGoogleDriveConnection();
    return NextResponse.json({
      connected: connection?.status === "ACTIVE" && !connection.is_disabled,
      connection: connection
        ? {
            id: connection.id,
            status: connection.status,
            updatedAt: connection.updated_at ?? null,
            statusReason: connection.status_reason ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("Google Drive status error:", error);
    return new Response("Failed to fetch Google Drive status", { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getDocuSignConnection } from "@/lib/composio/docusign";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connection = await getDocuSignConnection();
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
  } catch (error: any) {
    console.error("DocuSign status error:", error);
    return NextResponse.json(
      {
        connected: false,
        connection: null,
        error: error?.message || "Failed to fetch DocuSign status",
      },
      { status: 500 }
    );
  }
}

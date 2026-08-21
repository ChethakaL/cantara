import { NextRequest, NextResponse } from "next/server";
import { createMondayConnectLink } from "@/lib/composio";
import { publicAppOrigin } from "@/lib/public-origin";
import { saveStoredComposioMondayConnectedAccountId } from "@/lib/secure-settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const origin = publicAppOrigin(req);
    const link = await createMondayConnectLink(`${origin}/admin?monday=connected`);
    if (link.connected_account_id) {
      await saveStoredComposioMondayConnectedAccountId(link.connected_account_id).catch((err) =>
        console.warn("[monday/connect] Failed to persist connected account id:", err),
      );
    }
    return NextResponse.json(link);
  } catch (error) {
    console.error("Monday.com connect link error:", error);
    return new Response("Failed to create Monday.com connect link", { status: 500 });
  }
}

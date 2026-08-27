import { NextRequest, NextResponse } from "next/server";
import { createDocuSignConnectLink } from "@/lib/composio/docusign";
import { publicAppOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const origin = publicAppOrigin(req);
    const link = await createDocuSignConnectLink(
      `${origin}/admin/automations?tab=connections&docusign=connected`
    );
    return NextResponse.json(link);
  } catch (error: any) {
    console.error("DocuSign connect link error:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to create DocuSign connect link. Ensure COMPOSIO_DOCUSIGN_AUTH_CONFIG_ID or DOCUSIGN_INTEGRATION_KEY + DOCUSIGN_SECRET_KEY are set.",
      },
      { status: 500 }
    );
  }
}

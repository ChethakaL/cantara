import { NextResponse } from "next/server";
import { disconnectDocuSign } from "@/lib/composio/docusign";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await disconnectDocuSign();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DocuSign disconnect error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to disconnect DocuSign" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getMondayInstallUrl } from "@/lib/composio";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ url: getMondayInstallUrl() });
}

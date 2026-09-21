import { NextResponse } from "next/server";
import { getPlacesApiKey } from "@/lib/secure-settings";

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = await getPlacesApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places API key is not set. Add it in Admin Settings.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ apiKey });
}

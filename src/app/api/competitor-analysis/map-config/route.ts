import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.GOOGLE_SERVICES_API;

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps key is not configured.' }, { status: 500 });
  }

  return NextResponse.json({ apiKey });
}

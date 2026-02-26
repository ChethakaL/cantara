import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/constants";

export async function POST(request: Request) {
  await destroySession();
  const base = getAppBaseUrl(new URL(request.url).origin);
  return NextResponse.redirect(new URL("/login", base || request.url));
}

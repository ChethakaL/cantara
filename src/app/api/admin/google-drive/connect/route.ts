import { Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/auth";
import { GOOGLE_OAUTH_STATE_COOKIE_NAME } from "@/lib/constants";
import { createGoogleDriveConsentUrl } from "@/lib/drive";

export async function GET(request: Request) {
  const auth = await requireUserForRoute(Role.ADMIN);

  if ("error" in auth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const store = await cookies();

  store.set({
    name: GOOGLE_OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const consentUrl = createGoogleDriveConsentUrl(state);

  return NextResponse.redirect(consentUrl);
}

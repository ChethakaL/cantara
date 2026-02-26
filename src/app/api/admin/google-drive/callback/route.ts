import { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/auth";
import { getAppBaseUrl, GOOGLE_OAUTH_STATE_COOKIE_NAME } from "@/lib/constants";
import { exchangeGoogleCodeForTokens } from "@/lib/drive";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireUserForRoute(Role.ADMIN);
  const base = getAppBaseUrl(new URL(request.url).origin);

  if ("error" in auth) {
    return NextResponse.redirect(new URL("/login", base || request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/admin?drive_error=${encodeURIComponent(oauthError)}`, base || request.url));
  }

  const store = await cookies();
  const expectedState = store.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value;

  store.set({
    name: GOOGLE_OAUTH_STATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/admin?drive_error=invalid_oauth_state", base || request.url));
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens(code);

    const existing = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { googleRefreshToken: true, googleAccessToken: true },
    });

    const refreshToken = tokens.refresh_token ?? existing?.googleRefreshToken ?? null;
    const accessToken = tokens.access_token ?? existing?.googleAccessToken ?? null;

    if (!refreshToken) {
      return NextResponse.redirect(
        new URL("/admin?drive_error=missing_refresh_token", base || request.url),
      );
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    return NextResponse.redirect(new URL("/admin?drive_connected=1", base || request.url));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/admin?drive_error=oauth_exchange_failed", base || request.url));
  }
}

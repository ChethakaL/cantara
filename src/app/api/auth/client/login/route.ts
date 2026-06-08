import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      return new Response("Email and password are required", { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { ClientProfile: true },
    });

    if (!user || user.role !== "CLIENT") {
      return new Response("Invalid credentials", { status: 401 });
    }

    if (user.passwordHash !== password) {
      return new Response("Invalid credentials", { status: 401 });
    }

    const clientProfile =
      user.ClientProfile ??
      (await (prisma as any).clientProfile.findFirst({
        where: { TeamMembers: { some: { email: user.email } } },
      }));

    if (!clientProfile) {
      return new Response("Invalid credentials", { status: 401 });
    }

    await prisma.clientProfile.update({
      where: { id: clientProfile.id },
      data: { lastLogin: new Date() },
    });

    const response = NextResponse.json({
      success: true,
      clientId: clientProfile.id,
      email: user.email,
      name: user.name,
    });

    response.cookies.set("cantara_role", "client", { httpOnly: false, sameSite: "lax", path: "/" });
    response.cookies.set("cantara_client_email", user.email, { httpOnly: false, sameSite: "lax", path: "/" });
    response.cookies.set("cantara_client_id", clientProfile.id, { httpOnly: false, sameSite: "lax", path: "/" });

    return response;
  } catch (error) {
    console.error("Client Login Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

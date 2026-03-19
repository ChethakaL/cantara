import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, company } = await req.json();

    if (!name || !email || !password) {
      return new Response("Name, email, and password are required", { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return new Response("An account with this email already exists", { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: password,
        role: "CLIENT",
      },
    });

    const profile = await prisma.clientProfile.create({
      data: {
        userId: user.id,
        businessName: company || name,
        email,
        stage: "ONBOARDING",
        businessType: "SINGLE",
      },
    });

    const response = NextResponse.json({ success: true, clientId: profile.id });
    response.cookies.set("cantara_role", "client", { httpOnly: false, sameSite: "lax", path: "/" });
    response.cookies.set("cantara_client_email", email, { httpOnly: false, sameSite: "lax", path: "/" });
    response.cookies.set("cantara_client_id", profile.id, { httpOnly: false, sameSite: "lax", path: "/" });
    return response;
  } catch (error) {
    console.error("Client Register Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

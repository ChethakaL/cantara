import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response("Email and password are required", { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.role !== "ADMIN") {
      return new Response("Invalid credentials or unauthorized", { status: 401 });
    }

    // For now, doing a direct password check as requested (assuming storage of plain or simple hashes for this stage)
    // IMPORTANT: In production, use bcrypt or similar to verify passwordHash
    if (user.passwordHash !== password) {
      return new Response("Invalid credentials", { status: 401 });
    }

    // Set session cookies
    const response = NextResponse.json({ success: true, name: user.name });
    response.cookies.set("cantara_role", "admin", { httpOnly: false, sameSite: "lax", path: "/" });
    response.cookies.set("cantara_admin_name", user.name, { httpOnly: false, sameSite: "lax", path: "/" });
    response.cookies.set("cantara_admin_email", user.email, { httpOnly: false, sameSite: "lax", path: "/" });

    return response;
  } catch (error) {
    console.error("Login Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

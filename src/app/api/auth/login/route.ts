import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { portalRoutes } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid credentials" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      select: {
        id: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const passwordValid = await verifyPassword(parsed.data.password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user.id);

    return NextResponse.json({ redirectTo: portalRoutes[user.role] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unexpected error while signing in" }, { status: 500 });
  }
}

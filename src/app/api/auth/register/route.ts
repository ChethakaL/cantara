import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
    }

    const { name, email, password, businessName, businessDescription } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: Role.CLIENT,
        clientProfile: {
          create: {
            businessName,
            businessDescription,
          },
        },
      },
      select: { id: true },
    });

    await createSession(user.id);

    return NextResponse.json({ redirectTo: "/client" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unexpected error while creating account" }, { status: 500 });
  }
}

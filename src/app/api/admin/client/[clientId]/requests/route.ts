import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRequestSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireUserForRoute(Role.ADMIN);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { clientId } = await params;
    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    await prisma.documentRequest.create({
      data: {
        clientId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        createdById: auth.user.id,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}

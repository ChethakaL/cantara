import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  question: z.string().min(1, "Question is required").max(2000),
});

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const admin = await requireUser(Role.ADMIN);
  const { clientId } = await params;

  const parsed = bodySchema.safeParse(await _request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await prisma.question.create({
    data: {
      clientId,
      askedById: admin.id,
      question: parsed.data.question,
    },
  });

  return NextResponse.json({ ok: true });
}

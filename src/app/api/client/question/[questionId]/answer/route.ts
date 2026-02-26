import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  answer: z.string().min(1, "Answer is required").max(5000),
});

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const user = await requireUser(Role.CLIENT);
  const { questionId } = await params;

  const parsed = bodySchema.safeParse(await _request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { client: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  if (question.client.userId !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.question.update({
    where: { id: questionId },
    data: {
      answer: parsed.data.answer,
      answeredAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

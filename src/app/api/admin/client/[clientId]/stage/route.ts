import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStageSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireUserForRoute(Role.ADMIN);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { clientId } = await params;
    const body = await request.json();
    const parsed = updateStageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid stage" }, { status: 400 });
    }

    await prisma.clientProfile.update({
      where: { id: clientId },
      data: {
        stage: parsed.data.stage,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 });
  }
}

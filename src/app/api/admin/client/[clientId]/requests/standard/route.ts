import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STANDARD_REQUESTS = [
  {
    title: "Business registration",
    description: "Upload your official registration/incorporation document.",
  },
  {
    title: "Business plan",
    description: "Upload your current strategic business plan and forecast assumptions.",
  },
];

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

export async function POST(_: Request, { params }: RouteContext) {
  const auth = await requireUserForRoute(Role.ADMIN);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { clientId } = await params;

    const existing = await prisma.documentRequest.findMany({
      where: {
        clientId,
      },
      select: {
        title: true,
      },
    });

    const existingTitles = new Set(existing.map((item) => item.title.toLowerCase().trim()));

    const requestsToCreate = STANDARD_REQUESTS.filter(
      (request) => !existingTitles.has(request.title.toLowerCase().trim()),
    );

    if (requestsToCreate.length > 0) {
      await prisma.documentRequest.createMany({
        data: requestsToCreate.map((request) => ({
          clientId,
          title: request.title,
          description: request.description,
          createdById: auth.user.id,
        })),
      });
    }

    return NextResponse.json({ success: true, created: requestsToCreate.length }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to add standard requests" }, { status: 500 });
  }
}

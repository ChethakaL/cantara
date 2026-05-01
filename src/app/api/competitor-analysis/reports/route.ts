import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return new Response("clientId is required", { status: 400 });
  }

  try {
    const reports = await prisma.competitorAnalysis.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reports);
  } catch (error: any) {
    // Handle missing table or column gracefully
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      return NextResponse.json([]);
    }
    console.error("Failed to fetch competitor reports:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, fileName, report, parsed } = body;

    if (!clientId || !fileName || !report) {
      return new Response("Missing required fields", { status: 400 });
    }

    const existing = await prisma.competitorAnalysis.findFirst({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    const saved = existing
      ? await prisma.competitorAnalysis.update({
          where: { id: existing.id },
          data: { fileName, report, parsed },
        })
      : await prisma.competitorAnalysis.create({
          data: { clientId, fileName, report, parsed },
        });

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save competitor report:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("id is required", { status: 400 });
  }

  try {
    await prisma.competitorAnalysis.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }
    console.error("Failed to delete competitor report:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("id is required", { status: 400 });
  }

  try {
    const body = await req.json();
    const { fileName, report, parsed } = body ?? {};

    const updated = await prisma.competitorAnalysis.update({
      where: { id },
      data: {
        ...(fileName ? { fileName } : {}),
        ...(typeof report === "string" ? { report } : {}),
        ...(parsed !== undefined ? { parsed } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update competitor report:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

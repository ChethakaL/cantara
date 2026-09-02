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
    const reports = await prisma.leaseAnalysis.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, fileName, report, parsed, aiProvider, aiModel } = body;

    if (!clientId || !fileName || !report) {
      return new Response("Missing required fields", { status: 400 });
    }

    const saved = await prisma.leaseAnalysis.create({
      data: {
        clientId,
        fileName,
        report,
        parsed,
        aiProvider: aiProvider || "bedrock",
        aiModel: aiModel || null,
      },
    });

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save report:", error);
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
    const updated = await prisma.leaseAnalysis.update({
      where: { id },
      data: {
        ...(body.report !== undefined ? { report: body.report } : {}),
        ...(body.parsed !== undefined ? { parsed: body.parsed } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update report:", error);
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
    await prisma.leaseAnalysis.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Make DELETE idempotent: if the record is already gone, treat as success.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }
    console.error("Failed to delete report:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { syncContractVendorsToDirectory } from "@/lib/contract-analysis/merge-vendors";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return new Response("clientId is required", { status: 400 });
  }

  try {
    const reports = await prisma.contractAnalysis.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error("Failed to fetch contract reports:", error);
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

    const saved = await prisma.contractAnalysis.create({
      data: {
        clientId,
        fileName,
        report,
        parsed,
        aiProvider: aiProvider || "bedrock",
        aiModel: aiModel || null,
      },
    });

    // Auto-populate / update Software & Vendors from parsed contract data
    if (parsed?.contractRiskCards?.length) {
      try {
        await syncContractVendorsToDirectory(clientId, parsed);
      } catch (e) {
        console.error("Failed to sync vendor directory:", e);
      }
    }

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save contract report:", error);
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
    const updated = await prisma.contractAnalysis.update({
      where: { id },
      data: {
        ...(body.report !== undefined ? { report: body.report } : {}),
        ...(body.parsed !== undefined ? { parsed: body.parsed } : {}),
      },
    });

    // Keep Software & Vendors in sync when the advisor updates/reanalyzes contracts.
    const parsed = body.parsed ?? updated.parsed;
    if (parsed?.contractRiskCards?.length && updated.clientId) {
      try {
        await syncContractVendorsToDirectory(updated.clientId, parsed);
      } catch (e) {
        console.error("Failed to sync vendor directory on contract update:", e);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update contract report:", error);
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
    await prisma.contractAnalysis.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }
    console.error("Failed to delete contract report:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

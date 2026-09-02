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

    // Auto-populate vendor directory from parsed contract data
    if (parsed?.contractRiskCards?.length) {
      try {
        await mergeContractVendors(clientId, parsed);
      } catch (e) {
        console.error("Failed to auto-populate vendor directory:", e);
      }
    }

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to save contract report:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

/**
 * Extract vendor entries from the contract analysis and merge them into
 * the client's vendor directory (sectionSubmissions.vendorDirectory).
 * Only adds new entries — never overwrites existing manually-entered ones.
 */
async function mergeContractVendors(clientId: string, parsed: any) {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  });
  if (!client) return;

  const existing = (client.sectionSubmissions as Record<string, any>) ?? {};
  const currentVendors: any[] = Array.isArray(existing.vendorDirectory) ? existing.vendorDirectory : [];
  const existingNames = new Set(currentVendors.map((v: any) => (v.name ?? '').toLowerCase().trim()));

  // Extract from contractRiskCards (each has contractName like "SOFTWARE SUBSCRIPTION — Gingr Inc.")
  const newVendors: any[] = [];
  for (const card of parsed.contractRiskCards ?? []) {
    // contractName format: "CONTRACT TYPE — COUNTERPARTY" or just the title
    const nameParts = (card.contractName ?? '').split(/\s*[—–-]\s*/);
    const counterparty = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : nameParts[0]?.trim();
    const contractType = nameParts.length > 1 ? nameParts[0].trim() : '';
    if (!counterparty || existingNames.has(counterparty.toLowerCase())) continue;

    // Try to find annual value from the snapshot table
    let annualCost = 0;
    let contractStatus = 'Active';
    for (const row of parsed.snapshotTable ?? []) {
      const finding = row.finding ?? '';
      if (finding.toLowerCase().includes(counterparty.toLowerCase())) {
        const valueMatch = finding.match(/Value:\s*\$?([\d,]+)/i);
        if (valueMatch) annualCost = Number(valueMatch[1].replace(/,/g, '')) || 0;
        const statusMatch = (row.sourceSection ?? '').match(/Status:\s*(\S+)/i);
        if (statusMatch) contractStatus = statusMatch[1];
        break;
      }
    }

    // Determine category from contract type
    const typeLower = contractType.toLowerCase();
    let category = 'Service';
    if (typeLower.includes('software') || typeLower.includes('subscription') || typeLower.includes('saas')) category = 'Software';
    else if (typeLower.includes('supply') || typeLower.includes('supplier')) category = 'Supplier';
    else if (typeLower.includes('equipment') || typeLower.includes('lease')) category = 'Equipment';
    else if (typeLower.includes('marketing') || typeLower.includes('advertising')) category = 'Marketing';
    else if (typeLower.includes('maintenance')) category = 'Maintenance';
    else if (typeLower.includes('staffing')) category = 'Staffing';

    existingNames.add(counterparty.toLowerCase());
    newVendors.push({
      id: crypto.randomUUID(),
      name: counterparty,
      vendor: counterparty,
      category,
      annualCost,
      contractStatus,
      transferable: 'unknown',
      loginAccess: '',
      notes: `Auto-extracted from contract analysis (${contractType || 'Material Contract'})`,
    });
  }

  if (newVendors.length === 0) return;

  const mergedVendors = [...currentVendors, ...newVendors];
  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...existing,
        vendorDirectory: mergedVendors,
      },
    },
  });
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

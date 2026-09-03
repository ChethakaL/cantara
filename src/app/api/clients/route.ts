import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { mapClientForFrontend, mapClientListItemForFrontend } from "@/lib/client-mappers";
import { applyAgentDocumentRequirements } from "@/lib/workstream-agent-mapping";
import { scheduleDailyDocumentDeadlineRemindersCheck } from "@/lib/document-deadline-reminder-scheduler";

function generatePassword() {
  return crypto.randomBytes(9).toString("base64url");
}

// GET /api/clients - Slim list for admin dashboard (full detail: GET /api/clients/[id])
export async function GET(_req: NextRequest) {
  try {
    scheduleDailyDocumentDeadlineRemindersCheck();

    const clients = await (prisma as any).clientProfile.findMany({
      select: {
        id: true,
        businessName: true,
        businessAddress: true,
        businessCategory: true,
        websiteUrl: true,
        email: true,
        phone: true,
        driveFolderId: true,
        workstream: true,
        customWorkstreamId: true,
        stage: true,
        businessType: true,
        valuationDocUploaded: true,
        createdAt: true,
        provisionedAt: true,
        lastLogin: true,
        User: {
          select: {
            name: true,
            email: true,
            mustChangePassword: true,
          },
        },
        TeamMembers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        ClientDocumentStatuses: {
          select: {
            documentId: true,
            hasDoc: true,
            unavailableDecision: true,
            assignedTo: true,
            uploadedAt: true,
            fileName: true,
            notApplicable: true,
            targetDeadline: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const clientIds = clients.map((c: { id: string }) => c.id);
    const unreadRows =
      clientIds.length === 0
        ? []
        : await prisma.chatMessage.groupBy({
            by: ["clientId"],
            where: {
              clientId: { in: clientIds },
              readByAdmin: false,
              senderRole: "CLIENT",
            },
            _count: { _all: true },
          });

    const unreadByClient = new Map(
      unreadRows.map((row) => [row.clientId, row._count._all]),
    );

    const mappedClients = clients.map((c: any) =>
      mapClientListItemForFrontend(c, unreadByClient.get(c.id) ?? 0),
    );

    return NextResponse.json(mappedClients);
  } catch (error) {
    console.error("GET Clients Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// POST /api/clients - Create a new client (Admin only)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const company = String(body.company || body.businessName || "").trim();
    const phone = String(body.phone || "").trim();
    const rawBusinessCategory = String(body.businessCategory || "").trim();
    const businessCategory = rawBusinessCategory;
    const propertyOwnership = body.propertyOwnership === 'lease' || body.propertyOwnership === 'owns'
      ? body.propertyOwnership
      : null;
    const realEstateRunLease = body.realEstateRunLease === true;
    const realEstateRunAppraisal = body.realEstateRunAppraisal !== false;

    if (!name || !email) {
      return new Response("Missing required fields", { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return new Response("An account with this email already exists", { status: 409 });
    }

    const password = String(body.password || "").trim() || generatePassword();
    const businessName = company || name;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: password,
        mustChangePassword: true,
        role: "CLIENT",
      },
    });

    const profile = await prisma.clientProfile.create({
      data: {
        userId: user.id,
        businessName,
        email,
        phone: phone || null,
        businessCategory: businessCategory || null,
        stage: "ONBOARDING",
        businessType: "SINGLE",
        sectionSubmissions: propertyOwnership ? {
          propertyOwnership,
          ...(propertyOwnership === 'owns' ? { realEstateRunLease, realEstateRunAppraisal } : {}),
        } : undefined,
      },
      include: { User: true },
    });

    const requirements = await (prisma as any).agentDocumentRequirement.findMany();
    return NextResponse.json(mapClientForFrontend(applyAgentDocumentRequirements(profile as any, requirements)));
  } catch (error) {
    console.error("POST Client Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

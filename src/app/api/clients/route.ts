import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapClientForFrontend } from "@/lib/client-mappers";
import { applyAgentDocumentRequirements } from "@/lib/workstream-agent-mapping";
import { scheduleDailyDocumentDeadlineRemindersCheck } from "@/lib/document-deadline-reminder-scheduler";

// GET /api/clients - Get all clients for admin dashboard
export async function GET(req: NextRequest) {
  try {
    scheduleDailyDocumentDeadlineRemindersCheck();

    const clients = await (prisma as any).clientProfile.findMany({
      include: {
        Branches: true,
        TeamMembers: true,
        AdvisorProfiles: true,
        customWorkstream: { include: { agents: true } },
        ClientWorkstreamAgents: true,
        ClientDocumentStatuses: true,
        ClientDocument: true,
        User: true,
        ChatMessages: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to match the frontend expected structure
    const requirements = await (prisma as any).agentDocumentRequirement.findMany();
    const mappedClients = await Promise.all(clients.map(async (c: any) => {
      const unreadCount = await prisma.chatMessage.count({
        where: {
          clientId: c.id,
          readByAdmin: false,
          senderRole: "CLIENT",
        },
      });

      return mapClientForFrontend(applyAgentDocumentRequirements(c, requirements), unreadCount);
    }));

    return NextResponse.json(mappedClients);
  } catch (error) {
    console.error("GET Clients Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// POST /api/clients - Create a new client (Admin only)
export async function POST(req: NextRequest) {
  try {
    const { name, email, company, password } = await req.json();

    if (!name || !email) {
      return new Response("Missing required fields", { status: 400 });
    }

    // 1. Create User account for client
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: password || "password123",
        role: "CLIENT",
      },
    });

    // 2. Create Client Profile
    const profile = await prisma.clientProfile.create({
      data: {
        userId: user.id,
        businessName: company || name,
        email: email,
        stage: "ONBOARDING",
        businessType: "SINGLE",
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("POST Client Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

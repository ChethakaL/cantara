import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/clients - Get all clients for admin dashboard
export async function GET(req: NextRequest) {
  try {
    const clients = await prisma.clientProfile.findMany({
      include: {
        Branches: true,
        User: true,
        ChatMessages: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to match the frontend expected structure
    const mappedClients = await Promise.all(clients.map(async (c) => {
      const unreadCount = await prisma.chatMessage.count({
        where: {
          clientId: c.id,
          readByAdmin: false,
          senderRole: "CLIENT",
        },
      });

      return {
        ...c,
        name: c.User?.name || 'Unknown Client',
        company: c.businessName,
        email: c.User?.email || c.email,
        workstream: c.workstream ? c.workstream.toLowerCase() : null,
        stage: c.stage ? c.stage.toLowerCase() : 'onboarding',
        businessType: c.businessType ? c.businessType.toLowerCase() : 'single',
        teamMembers: [], // Placeholder for team members if needed
        documentStatuses: {}, // Placeholder
        unreadCount,
      };
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
    const { name, email, company } = await req.json();

    if (!name || !email) {
      return new Response("Missing required fields", { status: 400 });
    }

    // 1. Create User account for client
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: "password123", // Default password for new clients
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

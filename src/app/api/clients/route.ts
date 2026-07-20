import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { mapClientForFrontend } from "@/lib/client-mappers";
import { applyAgentDocumentRequirements } from "@/lib/workstream-agent-mapping";
import { scheduleDailyDocumentDeadlineRemindersCheck } from "@/lib/document-deadline-reminder-scheduler";
import { sendEmailWithComposio } from "@/lib/composio";
import { buildClientPortalInviteEmail } from "@/lib/client-invite-email";

function generatePassword() {
  return crypto.randomBytes(9).toString("base64url");
}

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
    const advisorName = String(body.advisorName || process.env.CANTARA_ADVISOR_NAME || "Cantara Pet Advisors").trim();
    const sendInvite = body.sendInvite !== false;

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
        sectionSubmissions: propertyOwnership ? { propertyOwnership } : undefined,
      },
      include: { User: true },
    });

    if (sendInvite) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin;
      const loginUrl = `${baseUrl}/login/client`;
      const settingsUrl = `${baseUrl}/dashboard/settings`;
      const inviteSubject = `Welcome to the Cantara portal — ${businessName}`;
      try {
        await sendEmailWithComposio({
          to: email,
          displayName: name,
          subject: inviteSubject,
          body: buildClientPortalInviteEmail({
            businessName,
            contactName: name,
            email,
            password,
            loginUrl,
            settingsUrl,
            businessCategories: businessCategory,
            advisorName,
          }),
        });
      } catch (emailError) {
        console.error("CLIENT_INVITE_EMAIL_ERROR", { clientId: profile.id, email, error: emailError });
      }
    }

    const requirements = await (prisma as any).agentDocumentRequirement.findMany();
    return NextResponse.json(mapClientForFrontend(applyAgentDocumentRequirements(profile as any, requirements)));
  } catch (error) {
    console.error("POST Client Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

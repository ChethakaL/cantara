import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapClientForFrontend } from "@/lib/client-mappers";
import { applyAgentDocumentRequirements } from "@/lib/workstream-agent-mapping";

// GET /api/clients/[id] - Get single client detail
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const client = await (prisma as any).clientProfile.findUnique({
      where: { id },
      include: {
        Branches: true,
        TeamMembers: true,
        AdvisorProfiles: true,
        customWorkstream: { include: { agents: true } },
        ClientWorkstreamAgents: true,
        ClientDocumentStatuses: true,
        ClientDocument: true,
        User: true,
      },
    });

    if (!client) return new Response("Not Found", { status: 404 });

    const requirements = await (prisma as any).agentDocumentRequirement.findMany();
    return NextResponse.json(mapClientForFrontend(applyAgentDocumentRequirements(client, requirements)));
  } catch (error) {
    console.error("GET Client [id] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// PATCH /api/clients/[id] - Update client profile
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await req.json();
    
    const teamMembers = Array.isArray(body.teamMembers) ? body.teamMembers : undefined;
    const advisors = Array.isArray(body.advisors) ? body.advisors : undefined;
    const workstreamAgents = Array.isArray(body.workstreamAgents) ? body.workstreamAgents : undefined;
    const documentStatuses =
      body.documentStatuses && typeof body.documentStatuses === "object" ? body.documentStatuses : undefined;

    const updated = await (prisma as any).clientProfile.update({
      where: { id },
      data: {
        businessName: body.company,
        businessAddress: typeof body.businessAddress === "string" ? body.businessAddress : undefined,
        businessCategory: typeof body.businessCategory === "string" ? body.businessCategory : undefined,
        websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl : undefined,
        email: body.email,
        phone: body.phone,
        driveFolderId: typeof body.driveFolder === "string" ? body.driveFolder : undefined,
        workstream: body.workstream ? body.workstream.toUpperCase() : undefined,
        customWorkstreamId:
          typeof body.customWorkstreamId === "string" && body.customWorkstreamId
            ? body.customWorkstreamId
            : body.customWorkstreamId === null
              ? null
              : undefined,
        stage: body.stage ? body.stage.toUpperCase() : undefined,
        businessType: body.businessType ? body.businessType.toUpperCase() : undefined,
        notes: body.notes,
        sectionSubmissions:
          body.sectionSubmissions && typeof body.sectionSubmissions === "object"
            ? body.sectionSubmissions
            : undefined,
        sectionDeadlines:
          body.sectionDeadlines && typeof body.sectionDeadlines === "object"
            ? body.sectionDeadlines
            : undefined,
        valuationDocUploaded: body.valuationDocUploaded,
        updatedAt: new Date(),
      },
      include: { User: true, Branches: true, TeamMembers: true, AdvisorProfiles: true, customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true, ClientDocumentStatuses: true, ClientDocument: true }
    });
    
    // Update User name if provided
    if (body.name) {
      await prisma.user.update({
        where: { id: updated.userId },
        data: { name: body.name, email: body.email || undefined }
      });
    }

    if (Array.isArray(body.branches)) {
      await (prisma as any).branch.deleteMany({ where: { clientId: id } });
      const nextBranches = body.branches
        .filter((branch: { name?: string }) => branch?.name?.trim())
        .map((branch: { name: string }) => ({ clientId: id, name: branch.name.trim() }));
      if (nextBranches.length) {
        await (prisma as any).branch.createMany({ data: nextBranches });
      }
    }

    if (teamMembers) {
      await (prisma as any).teamMember.deleteMany({ where: { clientId: id } });
      const nextMembers = teamMembers
        .filter((member: { name?: string; email?: string }) => member?.name?.trim() && member?.email?.trim())
        .map((member: { name: string; email: string; role?: string }) => ({
          clientId: id,
          name: member.name.trim(),
          email: member.email.trim(),
          role: (member.role || "").trim(),
        }));
      if (nextMembers.length) {
        await (prisma as any).teamMember.createMany({ data: nextMembers });
      }
    }

    if (advisors) {
      await (prisma as any).advisorProfile.deleteMany({ where: { clientId: id } });
      const nextAdvisors = advisors
        .filter((advisor: { name?: string; imageUrl?: string }) => advisor?.name?.trim() && advisor?.imageUrl?.trim())
        .map((advisor: { name: string; imageUrl: string }) => ({
          clientId: id,
          name: advisor.name.trim(),
          imageUrl: advisor.imageUrl.trim(),
        }));
      if (nextAdvisors.length) {
        await (prisma as any).advisorProfile.createMany({ data: nextAdvisors });
      }
    }

    if (workstreamAgents) {
      await (prisma as any).clientWorkstreamAgent.deleteMany({ where: { clientId: id } });
      const nextAgents = workstreamAgents
        .filter((agent: { agentId?: string; agentName?: string }) => agent?.agentId?.trim() && agent?.agentName?.trim())
        .map((agent: { agentId: string; agentName: string; documentIds?: string[] }) => ({
          clientId: id,
          agentId: agent.agentId.trim(),
          agentName: agent.agentName.trim(),
          documentIds: Array.isArray(agent.documentIds) ? agent.documentIds : [],
        }));
      if (nextAgents.length) {
        await (prisma as any).clientWorkstreamAgent.createMany({ data: nextAgents });
      }
    }

    if (documentStatuses) {
      const entries = Object.entries(documentStatuses) as Array<[string, any]>;
      await (prisma as any).$transaction(
        entries.map(([documentId, status]) =>
          (prisma as any).clientDocumentStatus.upsert({
            where: { clientId_documentId: { clientId: id, documentId } },
            update: {
              hasDoc: status.hasDoc ?? null,
              assignedTo: status.assignedTo ?? null,
              uploadedAt: status.uploadedAt ? new Date(status.uploadedAt) : null,
              fileName: status.fileName ?? null,
              fileUrl: status.fileUrl ?? null,
              notApplicable: Boolean(status.notApplicable),
              targetDeadline:
                status.targetDeadline === null || status.targetDeadline === ''
                  ? null
                  : status.targetDeadline
                    ? new Date(status.targetDeadline)
                    : undefined,
            },
            create: {
              clientId: id,
              documentId,
              hasDoc: status.hasDoc ?? null,
              assignedTo: status.assignedTo ?? null,
              uploadedAt: status.uploadedAt ? new Date(status.uploadedAt) : null,
              fileName: status.fileName ?? null,
              fileUrl: status.fileUrl ?? null,
              notApplicable: Boolean(status.notApplicable),
              targetDeadline:
                status.targetDeadline && status.targetDeadline !== ''
                  ? new Date(status.targetDeadline)
                  : null,
            },
          }),
        ),
      );
    }

    const reloaded = await (prisma as any).clientProfile.findUnique({
      where: { id },
      include: { User: true, Branches: true, TeamMembers: true, AdvisorProfiles: true, customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true, ClientDocumentStatuses: true, ClientDocument: true },
    });
    const requirements = await (prisma as any).agentDocumentRequirement.findMany();

    return NextResponse.json(reloaded ? mapClientForFrontend(applyAgentDocumentRequirements(reloaded, requirements)) : updated);
  } catch (error) {
    console.error("PATCH Client Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

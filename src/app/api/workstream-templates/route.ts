import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyAgentDocumentRequirements } from "@/lib/workstream-agent-mapping";

const cleanAgents = (agents: unknown) => {
  if (!Array.isArray(agents)) return [];
  return agents
    .map((agent: any) => ({
      agentId: String(agent.agentId || "").trim(),
      agentName: String(agent.agentName || "").trim(),
      documentIds: [],
    }))
    .filter((agent) => agent.agentId && agent.agentName);
};

export async function GET() {
  try {
    const templates = await (prisma as any).workstreamTemplate.findMany({
      include: { agents: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    const requirements = await (prisma as any).agentDocumentRequirement.findMany();
    return NextResponse.json(templates.map((template: any) => applyAgentDocumentRequirements({ customWorkstream: template }, requirements).customWorkstream));
  } catch (error) {
    console.error("GET WorkstreamTemplates Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return new Response("Missing workstream name", { status: 400 });

    const template = await (prisma as any).workstreamTemplate.create({
      data: {
        name,
        description: String(body.description || "").trim() || null,
        agents: {
          create: cleanAgents(body.agents),
        },
      },
      include: { agents: true },
    });
    return NextResponse.json(template);
  } catch (error: any) {
    console.error("POST WorkstreamTemplates Error:", error);
    return new Response(error?.code === "P2002" ? "Workstream name already exists" : "Internal Server Error", {
      status: error?.code === "P2002" ? 409 : 500,
    });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    if (!id || !name) return new Response("Missing workstream id or name", { status: 400 });

    await (prisma as any).workstreamTemplateAgent.deleteMany({ where: { workstreamId: id } });
    const template = await (prisma as any).workstreamTemplate.update({
      where: { id },
      data: {
        name,
        description: String(body.description || "").trim() || null,
        agents: {
          create: cleanAgents(body.agents),
        },
      },
      include: { agents: true },
    });
    return NextResponse.json(template);
  } catch (error: any) {
    console.error("PATCH WorkstreamTemplates Error:", error);
    return new Response(error?.code === "P2002" ? "Workstream name already exists" : "Internal Server Error", {
      status: error?.code === "P2002" ? 409 : 500,
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return new Response("Missing workstream id", { status: 400 });
    await (prisma as any).workstreamTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE WorkstreamTemplates Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

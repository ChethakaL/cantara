import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/requirements - Get requirements for a client
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json([]);

  try {
    const requirements = await prisma.additionalRequirement.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    // Map to store-compatible type
    const mapped = requirements.map(r => ({
      ...r,
      priority: r.priority.toLowerCase(),
      status: r.status.toLowerCase(),
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("GET Requirements Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// POST /api/requirements - Create a new requirement
export async function POST(req: NextRequest) {
  try {
    const { clientId, title, description, priority } = await req.json();

    if (!clientId || !title) {
      return new Response("Missing required fields", { status: 400 });
    }

    const requirement = await prisma.additionalRequirement.create({
      data: {
        clientId,
        title,
        description,
        priority: priority ? priority.toUpperCase() : "MEDIUM",
        status: "OPEN",
      },
    });

    return NextResponse.json(requirement);
  } catch (error) {
    console.error("POST Requirement Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// PATCH /api/requirements/[id] - Update requirement
export async function PATCH(req: NextRequest) {
    // Note: In Next.js App Router, [id] routes usually have their own file.
    // For simplicity, I'll put the update logic in a separate route file or handle it here if it's a generic endpoint.
    // I'll create a separate file for [id] to follow conventions.
    return new Response("Use /api/requirements/[id]", { status: 405 });
}

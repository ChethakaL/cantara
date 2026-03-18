import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/clients/[id] - Get single client detail
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const client = await prisma.clientProfile.findUnique({
      where: { id },
      include: {
        Branches: true,
        User: true,
      },
    });

    if (!client) return new Response("Not Found", { status: 404 });

    // Map to store-compatible type
    const mapped = {
        id: client.id,
        name: client.User.name,
        email: client.User.email,
        company: client.businessName,
        phone: client.phone || '',
        workstream: client.workstream ? client.workstream.toLowerCase() : null,
        stage: client.stage ? client.stage.toLowerCase() : 'onboarding',
        businessType: client.businessType ? client.businessType.toLowerCase() : 'single',
        branches: client.Branches.map(b => ({ id: b.id, name: b.name })),
        teamMembers: [], // Placeholder
        documentStatuses: {}, // Placeholder
        driveFolder: client.driveFolderId,
        createdAt: client.createdAt.toISOString(),
        provisionedAt: client.provisionedAt?.toISOString() || null,
        lastLogin: client.lastLogin?.toISOString() || null,
        notes: client.notes || '',
        valuationDocUploaded: client.valuationDocUploaded,
    };

    return NextResponse.json(mapped);
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
    
    // Update ClientProfile first
    const updated = await prisma.clientProfile.update({
      where: { id },
      data: {
        businessName: body.company,
        phone: body.phone,
        workstream: body.workstream ? body.workstream.toUpperCase() : undefined,
        stage: body.stage ? body.stage.toUpperCase() : undefined,
        businessType: body.businessType ? body.businessType.toUpperCase() : undefined,
        notes: body.notes,
        valuationDocUploaded: body.valuationDocUploaded,
        updatedAt: new Date(),
      },
      include: { User: true }
    });
    
    // Update User name if provided
    if (body.name) {
      await prisma.user.update({
        where: { id: updated.userId },
        data: { name: body.name }
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH Client Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

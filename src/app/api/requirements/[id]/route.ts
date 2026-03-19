import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/requirements/[id] - Update a requirement
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await req.json();
    const updated = await prisma.additionalRequirement.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        question: body.question,
        requestUpload: typeof body.requestUpload === 'boolean' ? body.requestUpload : undefined,
        sourceDocumentId: body.sourceDocumentId,
        sourceDocumentName: body.sourceDocumentName,
        sourceUploadedFileName: body.sourceUploadedFileName,
        clientResponse: body.clientResponse,
        responseFileName: body.responseFileName,
        responseFileUrl: body.responseFileUrl,
        respondedAt: body.respondedAt ? new Date(body.respondedAt) : body.clientResponse || body.responseFileName ? new Date() : undefined,
        priority: body.priority ? body.priority.toUpperCase() : undefined,
        status: body.status ? body.status.toUpperCase() : undefined,
      },
    });

    return NextResponse.json({
      ...updated,
      priority: updated.priority.toLowerCase(),
      status: updated.status.toLowerCase(),
      createdAt: updated.createdAt.toISOString(),
      respondedAt: updated.respondedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("PATCH Requirement Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// DELETE /api/requirements/[id] - Delete a requirement
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    await prisma.additionalRequirement.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Requirement Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

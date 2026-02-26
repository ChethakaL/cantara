import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";
import { requireUserForRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { persistUpload } from "@/lib/storage";

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireUserForRoute(Role.CLIENT);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { requestId } = await params;

    const targetRequest = await prisma.documentRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        client: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!targetRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (targetRequest.client.userId !== auth.user.id) {
      return NextResponse.json({ error: "You cannot upload to this request" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const stored = await persistUpload({
      clientId: targetRequest.client.id,
      originalName: file.name,
      buffer,
    });

    const document = await prisma.clientDocument.create({
      data: {
        requestId: targetRequest.id,
        clientId: targetRequest.client.id,
        uploadedById: auth.user.id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        localPath: stored.relativePath,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({ success: true, documentId: document.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

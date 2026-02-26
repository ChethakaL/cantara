import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/auth";
import { uploadToClientDriveFolder } from "@/lib/drive";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/storage";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function POST(_: Request, { params }: RouteContext) {
  const auth = await requireUserForRoute(Role.ADMIN);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { documentId } = await params;

    const document = await prisma.clientDocument.findUnique({
      where: {
        id: documentId,
      },
      include: {
        client: {
          select: {
            id: true,
            businessName: true,
            driveFolderId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const file = await readStoredFile(document.localPath);

    const driveUpload = await uploadToClientDriveFolder({
      adminUserId: auth.user.id,
      clientName: document.client.businessName,
      existingFolderId: document.client.driveFolderId,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileBuffer: file,
    });

    await prisma.$transaction([
      prisma.clientDocument.update({
        where: { id: document.id },
        data: {
          googleDriveFileId: driveUpload.fileId,
        },
      }),
      prisma.clientProfile.update({
        where: { id: document.client.id },
        data: {
          driveFolderId: driveUpload.folderId,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      folderId: driveUpload.folderId,
      fileId: driveUpload.fileId,
      webViewLink: driveUpload.webViewLink,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload document to Google Drive",
      },
      { status: 500 },
    );
  }
}

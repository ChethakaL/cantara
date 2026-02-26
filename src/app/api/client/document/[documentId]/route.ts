import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function DELETE(_: Request, { params }: RouteContext) {
  const auth = await requireUserForRoute(Role.CLIENT);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { documentId } = await params;

    const document = await prisma.clientDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        uploadedById: true,
        localPath: true,
        client: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.client.userId !== auth.user.id || document.uploadedById !== auth.user.id) {
      return NextResponse.json({ error: "You cannot delete this document" }, { status: 403 });
    }

    await prisma.clientDocument.delete({ where: { id: document.id } });

    try {
      await deleteStoredFile(document.localPath);
    } catch (fileError) {
      if (!(fileError && typeof fileError === "object" && "code" in fileError && fileError.code === "ENOENT")) {
        console.error("Failed to remove stored file", fileError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}

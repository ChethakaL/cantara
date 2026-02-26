import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/storage";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const auth = await requireUserForRoute();

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
            userId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (auth.user.role === Role.CLIENT && document.client.userId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const content = await readStoredFile(document.localPath);

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}

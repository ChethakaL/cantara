import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserForRoute } from "@/lib/auth";
import { validateDriveFolderForAdmin } from "@/lib/drive";
import { prisma } from "@/lib/prisma";

const setLocationSchema = z.object({
  folderId: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireUserForRoute(Role.ADMIN);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = setLocationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid folder selection" }, { status: 400 });
    }

    const folder = await validateDriveFolderForAdmin(auth.user.id, parsed.data.folderId);

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        googleDriveRootFolderId: folder.id,
        googleDriveRootFolderName: folder.name,
      },
    });

    return NextResponse.json({ success: true, folderId: folder.id, folderName: folder.name });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save Google Drive location",
      },
      { status: 500 },
    );
  }
}

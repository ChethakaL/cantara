import { Role } from "@prisma/client";
import { AdminPortalContent } from "@/components/admin-portal-content";
import { PortalShell } from "@/components/portal-shell";
import { requireUser } from "@/lib/auth";
import { listDriveFoldersForAdmin } from "@/lib/drive";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPortalPage({ searchParams }: Props) {
  const admin = await requireUser(Role.ADMIN);
  await searchParams;

  const isDriveConnected = Boolean(admin.googleRefreshToken || admin.googleAccessToken);

  let driveFolders: Array<{ id: string; name: string }> = [];
  let driveFolderLoadError: string | null = null;

  if (isDriveConnected) {
    try {
      driveFolders = await listDriveFoldersForAdmin(admin.id);
    } catch (error) {
      driveFolderLoadError =
        error instanceof Error
          ? error.message
          : "Unable to load Google Drive folders right now.";
    }
  }

  const clients = await prisma.clientProfile.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          requests: true,
          documents: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <PortalShell
      heading="Admin Portal"
      subheading="Track acquisition candidates by stage, request diligence documents, and route uploads to Google Drive."
      userLabel={admin.name}
      roleLabel="Administrator"
    >
      <AdminPortalContent
        clients={clients}
        isDriveConnected={isDriveConnected}
        selectedFolderId={admin.googleDriveRootFolderId}
        selectedFolderName={admin.googleDriveRootFolderName}
        driveFolders={driveFolders}
        driveFolderLoadError={driveFolderLoadError}
      />
    </PortalShell>
  );
}

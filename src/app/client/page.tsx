import { Role } from "@prisma/client";
import { ClientPortalContent } from "@/components/client-portal-content";
import { PortalShell } from "@/components/portal-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ClientPortalPage() {
  const user = await requireUser(Role.CLIENT);
  const clientProfileId = user.clientProfile?.id;

  if (!clientProfileId) {
    return (
      <main className="px-4 py-10 sm:px-8">
        <p className="mx-auto max-w-xl rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Your client profile is missing. Please contact support.
        </p>
      </main>
    );
  }

  const [profile, questions] = await Promise.all([
    prisma.clientProfile.findUnique({
      where: { id: clientProfileId },
      include: {
        requests: {
          include: {
            documents: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.question.findMany({
      where: { clientId: clientProfileId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!profile) {
    return (
      <main className="px-4 py-10 sm:px-8">
        <p className="mx-auto max-w-xl rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Your client profile is missing. Please contact support.
        </p>
      </main>
    );
  }

  return (
    <PortalShell
      heading="Client Portal"
      subheading="Track requested diligence items and upload documents directly to your secure room."
      userLabel={user.name}
      roleLabel={profile.businessName}
    >
      <ClientPortalContent profile={{ ...profile, questions }} />
    </PortalShell>
  );
}

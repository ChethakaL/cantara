export function mapClientForFrontend(client: any, unreadCount = 0) {
  const documentStatuses = Object.fromEntries(
    (client.ClientDocumentStatuses ?? []).map((status) => [
      status.documentId,
      {
        id: status.documentId,
        hasDoc: status.hasDoc,
        assignedTo: status.assignedTo,
        uploadedAt: status.uploadedAt?.toISOString() ?? null,
        fileName: status.fileName ?? null,
        notApplicable: status.notApplicable,
      },
    ]),
  );

  return {
    id: client.id,
    name: client.User?.name || "Unknown Client",
    email: client.User?.email || client.email || "",
    company: client.businessName,
    phone: client.phone || "",
    workstream: client.workstream ? client.workstream.toLowerCase() : null,
    stage: client.stage ? client.stage.toLowerCase() : "onboarding",
    businessType: client.businessType ? client.businessType.toLowerCase() : "single",
    branches: client.Branches.map((branch) => ({ id: branch.id, name: branch.name })),
    teamMembers: (client.TeamMembers ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
    })),
    documentStatuses,
    driveFolder: client.driveFolderId,
    createdAt: client.createdAt.toISOString(),
    provisionedAt: client.provisionedAt?.toISOString() ?? null,
    lastLogin: client.lastLogin?.toISOString() ?? null,
    notes: client.notes || "",
    valuationDocUploaded: client.valuationDocUploaded,
    unreadCount,
  };
}

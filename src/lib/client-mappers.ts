export function mapClientForFrontend(client: any, unreadCount = 0) {
  const intake = (client.sectionSubmissions as Record<string, any> | null) ?? {};
  const combinedIntake = {
    ...(intake.intake ?? {}),
    ...(intake.business_profile ?? {}),
    ...(intake.employment ?? {}),
    ...(intake.workforce ?? {}),
  };

  const businessAddress = client.businessAddress || "";
  const derivedState =
    typeof combinedIntake.state === "string" && combinedIntake.state.trim()
      ? combinedIntake.state.trim()
      : extractStateFromAddress(businessAddress);

  const documentStatuses = Object.fromEntries(
    (client.ClientDocumentStatuses ?? []).map((status) => [
      status.documentId,
      {
        id: status.documentId,
        hasDoc: status.hasDoc,
        assignedTo: status.assignedTo,
        uploadedAt: status.uploadedAt?.toISOString() ?? null,
        fileName: status.fileName ?? null,
        fileUrl: status.fileUrl ?? null,
        notApplicable: status.notApplicable,
      },
    ]),
  );

  const uploadedDocuments = Object.fromEntries(
    (client.ClientDocument ?? [])
      .filter((doc: any) => doc.documentId)
      .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .filter((doc: any, index: number, arr: any[]) => arr.findIndex((item) => item.documentId === doc.documentId) === index)
      .map((doc: any) => [
        doc.documentId,
        {
          documentId: doc.documentId,
          fileName: doc.fileName,
          fileUrl: doc.googleDriveFileId ?? null,
          uploadedAt: doc.createdAt.toISOString(),
          aiReviewSummary: doc.aiReviewSummary ?? null,
          aiReviewStatus: doc.aiReviewStatus ?? null,
          aiDetectedType: doc.aiDetectedType ?? null,
          aiReviewFlags: doc.aiReviewFlags ?? [],
        },
      ]),
  );

  return {
    id: client.id,
    name: client.User?.name || "Unknown Client",
    email: client.User?.email || client.email || "",
    company: client.businessName,
    dba:
      typeof combinedIntake.dba === "string" && combinedIntake.dba.trim()
        ? combinedIntake.dba.trim()
        : "",
    phone: client.phone || "",
    businessAddress,
    state: derivedState,
    totalEmployeesSelfReported:
      combinedIntake.totalEmployeesSelfReported ??
      combinedIntake.totalEmployees ??
      combinedIntake.employeeCount ??
      null,
    employmentTypeBreakdown:
      typeof combinedIntake.employmentTypeBreakdown === "string" && combinedIntake.employmentTypeBreakdown.trim()
        ? combinedIntake.employmentTypeBreakdown.trim()
        : typeof combinedIntake.workforceMix === "string" && combinedIntake.workforceMix.trim()
          ? combinedIntake.workforceMix.trim()
          : null,
    businessCategory: client.businessCategory || "",
    websiteUrl: client.websiteUrl || "",
    workstream: client.workstream ? client.workstream.toLowerCase() : null,
    customWorkstreamId: client.customWorkstreamId ?? null,
    customWorkstream: client.customWorkstream
      ? {
          id: client.customWorkstream.id,
          name: client.customWorkstream.name,
          description: client.customWorkstream.description ?? null,
          isSystem: client.customWorkstream.isSystem,
          agents: (client.customWorkstream.agents ?? []).map((agent: any) => ({
            id: agent.id,
            agentId: agent.agentId,
            agentName: agent.agentName,
            documentIds: agent.documentIds ?? [],
          })),
        }
      : null,
    workstreamAgents: (client.ClientWorkstreamAgents ?? []).map((agent: any) => ({
      id: agent.id,
      agentId: agent.agentId,
      agentName: agent.agentName,
      documentIds: agent.documentIds ?? [],
    })),
    stage: client.stage ? client.stage.toLowerCase() : "onboarding",
    businessType: client.businessType ? client.businessType.toLowerCase() : "single",
    branches: client.Branches.map((branch) => ({ id: branch.id, name: branch.name })),
    teamMembers: (client.TeamMembers ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
    })),
    advisors: (client.AdvisorProfiles ?? []).map((advisor) => ({
      id: advisor.id,
      name: advisor.name,
      imageUrl: advisor.imageUrl,
    })),
    sectionSubmissions: (client.sectionSubmissions as Record<string, { submittedAt?: string }> | null) ?? {},
    documentStatuses,
    uploadedDocuments,
    driveFolder: client.driveFolderId,
    createdAt: client.createdAt.toISOString(),
    provisionedAt: client.provisionedAt?.toISOString() ?? null,
    lastLogin: client.lastLogin?.toISOString() ?? null,
    notes: client.notes || "",
    valuationDocUploaded: client.valuationDocUploaded,
    unreadCount,
  };
}

function extractStateFromAddress(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return "";
  const stateMatch = trimmed.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (stateMatch) return stateMatch[1];
  return "";
}

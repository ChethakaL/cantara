export function applyAgentDocumentRequirements<T extends { customWorkstream?: any }>(
  client: T,
  requirements: Array<{ agentId: string; documentIds: string[] }>,
): T {
  const requirementByAgent = new Map(requirements.map((req) => [req.agentId, req.documentIds ?? []]));
  const withClientAgents = {
    ...client,
    ClientWorkstreamAgents: (client as any).ClientWorkstreamAgents?.map((agent: any) => ({
      ...agent,
      documentIds: requirementByAgent.has(agent.agentId)
        ? requirementByAgent.get(agent.agentId) ?? []
        : agent.documentIds ?? [],
    })),
  };

  if (!withClientAgents.customWorkstream?.agents) return withClientAgents;

  return {
    ...withClientAgents,
    customWorkstream: {
      ...withClientAgents.customWorkstream,
      agents: withClientAgents.customWorkstream.agents.map((agent: any) => ({
        ...agent,
        documentIds: requirementByAgent.has(agent.agentId)
          ? requirementByAgent.get(agent.agentId) ?? []
          : agent.documentIds ?? [],
      })),
    },
  };
}

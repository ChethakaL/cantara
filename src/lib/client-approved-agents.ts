import { normalizeAgentStatusKey } from '@/lib/workstream-agents'

export function isClientPortalAgentApproved(
  approvals: Record<string, unknown>,
  agentId: string,
): boolean {
  const agentKey = normalizeAgentStatusKey(agentId)
  const entry = (approvals[agentId] ?? approvals[agentKey]) as { status?: string } | undefined
  return entry?.status === 'approved'
}

export function clientPortalApprovedAt(
  approvals: Record<string, unknown>,
  agentId: string,
): string | null {
  const agentKey = normalizeAgentStatusKey(agentId)
  const entry = (approvals[agentId] ?? approvals[agentKey]) as { approvedAt?: string } | undefined
  return typeof entry?.approvedAt === 'string' ? entry.approvedAt : null
}

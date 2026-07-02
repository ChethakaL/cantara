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

export function isClientPortalAgentReleased(
  releases: Record<string, unknown>,
  agentId: string,
): boolean {
  const agentKey = normalizeAgentStatusKey(agentId)
  const entry = (releases[agentId] ?? releases[agentKey]) as { released?: boolean } | undefined
  return entry?.released === true
}

export function clientPortalReleasedAt(
  releases: Record<string, unknown>,
  agentId: string,
): string | null {
  const agentKey = normalizeAgentStatusKey(agentId)
  const entry = (releases[agentId] ?? releases[agentKey]) as { releasedAt?: string } | undefined
  return typeof entry?.releasedAt === 'string' ? entry.releasedAt : null
}

import { agentLookupKeys } from '@/lib/workstream-agents'

function firstMatchingEntry<T extends Record<string, unknown>>(
  store: Record<string, unknown>,
  agentId: string,
): T | undefined {
  for (const key of agentLookupKeys(agentId)) {
    const entry = store[key]
    if (entry && typeof entry === 'object') return entry as T
  }
  return undefined
}

export function isClientPortalAgentApproved(
  approvals: Record<string, unknown>,
  agentId: string,
): boolean {
  return firstMatchingEntry<{ status?: string }>(approvals, agentId)?.status === 'approved'
}

export function clientPortalApprovedAt(
  approvals: Record<string, unknown>,
  agentId: string,
): string | null {
  const entry = firstMatchingEntry<{ approvedAt?: string }>(approvals, agentId)
  return typeof entry?.approvedAt === 'string' ? entry.approvedAt : null
}

export function isClientPortalAgentReleased(
  releases: Record<string, unknown>,
  agentId: string,
): boolean {
  return firstMatchingEntry<{ released?: boolean }>(releases, agentId)?.released === true
}

export function clientPortalReleasedAt(
  releases: Record<string, unknown>,
  agentId: string,
): string | null {
  const entry = firstMatchingEntry<{ releasedAt?: string }>(releases, agentId)
  return typeof entry?.releasedAt === 'string' ? entry.releasedAt : null
}

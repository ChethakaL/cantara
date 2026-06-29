import { ClientApprovedEmptyState } from '@/components/client-portal/AgentClientPortalFrame'

export function agentTabReadOnlyGate(
  readOnly: boolean,
  loading: boolean,
  hasOutput: boolean,
  agentName: string,
) {
  if (!readOnly) return null
  if (loading) {
    return (
      <div className="px-1 py-6 text-sm text-slate-400">Loading approved output…</div>
    )
  }
  if (!hasOutput) {
    return <ClientApprovedEmptyState agentName={agentName} />
  }
  return null
}

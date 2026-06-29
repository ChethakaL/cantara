'use client'

export function AdvisorActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-advisor-action className={className}>
      {children}
    </div>
  )
}

export function AgentClientPortalFrame({
  children,
  readOnly = false,
}: {
  children: React.ReactNode
  readOnly?: boolean
}) {
  if (!readOnly) return <>{children}</>
  return (
    <div className="agent-client-portal-view [&_[data-advisor-action]]:hidden [&_input[type=file]]:hidden">
      {children}
    </div>
  )
}

export function ClientApprovedEmptyState({ agentName }: { agentName: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      No approved {agentName} output is available yet.
    </div>
  )
}

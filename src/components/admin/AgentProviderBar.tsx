'use client'

import { AgentModelProviderSelect } from '@/components/admin/AgentModelProviderSelect'
import type { AgentAiProvider } from '@/lib/agent-model-provider'

export function AgentProviderBar({
  provider,
  onProviderChange,
  disabled,
  className,
  layout,
}: {
  provider: AgentAiProvider
  onProviderChange: (provider: AgentAiProvider) => void
  disabled?: boolean
  className?: string
  layout?: 'inline' | 'stacked'
}) {
  const resolvedLayout = layout ?? (className?.includes('mb-') || className?.includes('justify-center') ? 'stacked' : 'inline')
  return (
    <AgentModelProviderSelect
      value={provider}
      onChange={onProviderChange}
      disabled={disabled}
      className={className}
      layout={resolvedLayout}
    />
  )
}

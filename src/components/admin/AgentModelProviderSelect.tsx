'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/components/ui'
import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { AGENT_AI_PROVIDER_OPTIONS } from '@/lib/agent-model-provider'

type ProviderStatus = {
  bedrock: boolean
  openai: boolean
}

export function AgentModelProviderSelect({
  value,
  onChange,
  disabled,
  className,
  layout = 'inline',
}: {
  value: AgentAiProvider
  onChange: (value: AgentAiProvider) => void
  disabled?: boolean
  className?: string
  layout?: 'inline' | 'stacked'
}) {
  const [status, setStatus] = useState<ProviderStatus>({ bedrock: true, openai: false })

  useEffect(() => {
    void fetch('/api/admin/settings/openai-key', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          setStatus(prev => ({
            bedrock: true,
            openai: Boolean(data.configured),
          }))
        }
      })
  }, [])

  const selectedOption = AGENT_AI_PROVIDER_OPTIONS.find(option => option.id === value)

  if (layout === 'stacked') {
    return (
      <div className={className}>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
          AI Provider
        </label>
        <select
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value as AgentAiProvider)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
        >
          {AGENT_AI_PROVIDER_OPTIONS.map(option => (
            <option
              key={option.id}
              value={option.id}
              disabled={option.id === 'openai' && !status.openai}
            >
              {option.label}
              {option.id === 'openai' && !status.openai ? ' (configure in Settings)' : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          {selectedOption?.description}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-colors',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
      title={selectedOption?.description}
    >
      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      <span className="text-[11px] font-medium text-slate-400 shrink-0">Model:</span>
      <select
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value as AgentAiProvider)}
        className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1"
      >
        {AGENT_AI_PROVIDER_OPTIONS.map(option => (
          <option
            key={option.id}
            value={option.id}
            disabled={option.id === 'openai' && !status.openai}
          >
            {option.label}
            {option.id === 'openai' && !status.openai ? ' (configure in Settings)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

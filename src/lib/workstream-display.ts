import type { Client, Workstream } from '@/lib/store'

const WORKSTREAM_LABELS: Record<Exclude<Workstream, null>, string> = {
  ws1: 'Workstream 1 — Risk Mitigation',
  ws2: 'Workstream 2 — Profitability & Growth',
  both: 'Workstream 1 & 2',
  ma: 'M&A Advisory',
}

export function getWorkstreamPortalTitle(client: Pick<Client, 'workstream' | 'customWorkstream'>): string | null {
  if (client.customWorkstream?.name?.trim()) {
    return client.customWorkstream.name.trim()
  }
  if (!client.workstream) return null
  return WORKSTREAM_LABELS[client.workstream] ?? null
}

export function getWorkstreamPortalSubtitle(client: Pick<Client, 'workstream' | 'customWorkstream'>): string {
  if (client.customWorkstream?.name?.trim()) {
    return 'Custom workstream'
  }
  if (!client.workstream) return 'Awaiting workstream assignment'
  return WORKSTREAM_LABELS[client.workstream] ?? 'Client portal'
}

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { normalizeAgentStatusKey } from '@/lib/workstream-agents'

export type SourceFingerprintMap = Record<string, string>

function toIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

function hashContent(value: unknown): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return createHash('sha1').update(raw).digest('hex').slice(0, 16)
}

/** Prefer explicit timestamps; fall back to content hash so silent edits still invalidate. */
export function fingerprintFrom(value: unknown, updatedAt?: unknown): string {
  const ts = toIso(updatedAt) || pickTimestamp(value)
  if (ts) return `t:${ts}`
  return `h:${hashContent(value)}`
}

function pickTimestamp(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  for (const key of ['updatedAt', 'insightsUpdatedAt', 'aiReviewedAt', 'generatedAt', 'createdAt', 'aiReviewedAt']) {
    const ts = toIso(o[key])
    if (ts) return ts
  }
  // Nested common shapes
  for (const nestedKey of ['summary', 'report', 'parsed', 'searchResult', 'docResult']) {
    const nested = o[nestedKey]
    const ts = pickTimestamp(nested)
    if (ts) return ts
  }
  return null
}

async function latestTableFingerprint(
  delegate: any,
  clientId: string,
  contentFields: string[],
): Promise<string | null> {
  if (!delegate?.findFirst) return null
  const select: Record<string, boolean> = { createdAt: true, updatedAt: true }
  for (const field of contentFields) select[field] = true
  const row = await delegate.findFirst({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select,
  }).catch(() => null)
  if (!row) return null
  const content = contentFields.map((f) => row[f]).find((v) => v != null) ?? null
  return fingerprintFrom(content, row.updatedAt ?? row.createdAt)
}

function submissionFingerprint(submissions: Record<string, any>, key: string): string | null {
  const value = key === 'employeeComp' || key === 'employeeCompReport'
    ? submissions.employeeCompReport || submissions.employeeComp
    : key === 'ttm' || key === 'valuation'
      ? submissions.valuation
      : submissions[key]
  if (value == null) return null
  return fingerprintFrom(value)
}

/** Buyer-report source keys → current fingerprints. */
export async function collectBuyerSourceFingerprints(
  clientId: string,
  workstream: 'ws1' | 'ws2',
  submissions: Record<string, any>,
): Promise<SourceFingerprintMap> {
  const out: SourceFingerprintMap = {}

  const roadmap = submissions.salesReadinessRoadmap || submissions.ws1Roadmap || submissions.ws2Roadmap
  if (roadmap) out.roadmap = fingerprintFrom(roadmap)

  if (workstream === 'ws1') {
    const pairs: Array<[string, Promise<string | null>]> = [
      ['ttm', latestTableFingerprint((prisma as any).ttmAnalysis, clientId, ['reportMarkdown', 'summary'])],
      ['employee-obligations', latestTableFingerprint((prisma as any).employeeObligationsReport, clientId, ['markdown'])],
      ['lease', latestTableFingerprint((prisma as any).leaseAnalysis, clientId, ['report', 'parsed'])],
      ['contract', latestTableFingerprint((prisma as any).contractAnalysis, clientId, ['report', 'parsed'])],
      ['ownership-verification', latestTableFingerprint((prisma as any).ownershipVerificationReport, clientId, ['markdown'])],
      ['permits-zoning', latestTableFingerprint((prisma as any).permitsZoningReport, clientId, ['markdown'])],
      ['legal-entity-search', latestTableFingerprint((prisma as any).legalEntitySearchReport, clientId, ['markdown'])],
      ['tax-liability-review', latestTableFingerprint((prisma as any).taxLiabilityReport, clientId, ['markdown'])],
    ]
    const results = await Promise.all(pairs.map(async ([key, p]) => [key, await p] as const))
    for (const [key, fp] of results) if (fp) out[key] = fp

    const subKeys: Array<[string, string]> = [
      ['employee-comp', 'employeeCompReport'],
      ['insurance', 'insuranceReview'],
      ['litigation', 'litigationSearch'],
      ['org-chart', 'orgChart'],
      ['owner-gm-assessment', 'ownerGmAssessment'],
      ['advisors', 'professionalAdvisors'],
      ['vendor-directory', 'vendorDirectory'],
    ]
    for (const [sourceKey, subKey] of subKeys) {
      const fp = submissionFingerprint(submissions, subKey)
      if (fp) out[sourceKey] = fp
    }
  } else {
    const pairs: Array<[string, Promise<string | null>]> = [
      ['ttm', latestTableFingerprint((prisma as any).ttmAnalysis, clientId, ['reportMarkdown', 'summary'])],
      ['competitor', latestTableFingerprint((prisma as any).competitorAnalysis, clientId, ['report', 'parsed'])],
    ]
    const results = await Promise.all(pairs.map(async ([key, p]) => [key, await p] as const))
    for (const [key, fp] of results) if (fp) out[key] = fp

    const subKeys: Array<[string, string]> = [
      ['digital', 'digitalPresence'],
      ['facility-review', 'facilityReview'],
      ['pricing-analysis', 'pricingAnalysis'],
      ['pricing-vertical', 'pricingVertical'],
      ['sales-process-review', 'salesProcessReview'],
      ['client-location-map', 'clientLocationMap'],
    ]
    for (const [sourceKey, subKey] of subKeys) {
      const fp = submissionFingerprint(submissions, subKey)
      if (fp) out[sourceKey] = fp
    }
  }

  return out
}

/** Roadmap agentId → fingerprint (covers assigned diligence agents). */
export async function collectRoadmapSourceFingerprints(
  clientId: string,
  agentIds: string[],
  submissions: Record<string, any>,
): Promise<SourceFingerprintMap> {
  const out: SourceFingerprintMap = {}
  const unique = Array.from(new Set(agentIds.map(normalizeAgentStatusKey)))

  await Promise.all(
    unique.map(async (statusKey) => {
      const fp = await fingerprintForAgentStatusKey(clientId, statusKey, submissions)
      if (fp) out[statusKey] = fp
    }),
  )

  // Also index by raw agentId when UI uses snake_case keys
  for (const id of agentIds) {
    const statusKey = normalizeAgentStatusKey(id)
    if (out[statusKey] && !out[id]) out[id] = out[statusKey]
  }

  return out
}

async function fingerprintForAgentStatusKey(
  clientId: string,
  statusKey: string,
  submissions: Record<string, any>,
): Promise<string | null> {
  if (statusKey === 'ttm' || statusKey === 'ttmAnalysis') {
    return latestTableFingerprint((prisma as any).ttmAnalysis, clientId, ['reportMarkdown', 'summary'])
  }
  if (statusKey === 'lease') {
    return latestTableFingerprint((prisma as any).leaseAnalysis, clientId, ['report', 'parsed'])
  }
  if (statusKey === 'contract') {
    return latestTableFingerprint((prisma as any).contractAnalysis, clientId, ['report', 'parsed'])
  }
  if (statusKey === 'competitor') {
    return latestTableFingerprint((prisma as any).competitorAnalysis, clientId, ['report', 'parsed'])
  }
  if (statusKey === 'employeeObligations') {
    return latestTableFingerprint((prisma as any).employeeObligationsReport, clientId, ['markdown'])
  }
  if (statusKey === 'ownershipVerification') {
    return latestTableFingerprint((prisma as any).ownershipVerificationReport, clientId, ['markdown'])
  }
  if (statusKey === 'permitsZoning') {
    return latestTableFingerprint((prisma as any).permitsZoningReport, clientId, ['markdown'])
  }
  if (statusKey === 'legalEntitySearch') {
    return latestTableFingerprint((prisma as any).legalEntitySearchReport, clientId, ['markdown'])
  }
  if (statusKey === 'taxLiabilityReview') {
    return latestTableFingerprint((prisma as any).taxLiabilityReport, clientId, ['markdown'])
  }
  if (statusKey === 'realEstateAppraisal') {
    return latestTableFingerprint((prisma as any).realEstateAppraisalReport, clientId, ['markdown'])
  }

  const submissionKeyByStatus: Record<string, string> = {
    employeeComp: 'employeeCompReport',
    insuranceReview: 'insuranceReview',
    litigationSearch: 'litigationSearch',
    orgChart: 'orgChart',
    orgChartReview: 'orgChart',
    ownerGmAssessment: 'ownerGmAssessment',
    professionalAdvisors: 'professionalAdvisors',
    vendorDirectory: 'vendorDirectory',
    digitalPresence: 'digitalPresence',
    facilityReview: 'facilityReview',
    pricingAnalysis: 'pricingAnalysis',
    pricingVertical: 'pricingVertical',
    salesProcessReview: 'salesProcessReview',
    clientLocationMap: 'clientLocationMap',
    occupancyReview: 'occupancyReview',
  }
  const subKey = submissionKeyByStatus[statusKey]
  if (subKey) return submissionFingerprint(submissions, subKey)
  return submissionFingerprint(submissions, statusKey)
}

export function applySourceChangeFlags<T extends { key: string }>(
  sources: T[],
  current: SourceFingerprintMap,
  saved: SourceFingerprintMap | null | undefined,
  generatedAt?: string | null,
): Array<T & { changed: boolean; fingerprint?: string }> {
  const generatedTs = toIso(generatedAt)
  const hasSaved = Boolean(saved && Object.keys(saved).length > 0)

  return sources.map((s) => {
    const statusKey = normalizeAgentStatusKey(s.key)
    const now = current[s.key] || current[statusKey]
    const was = hasSaved ? (saved![s.key] || saved![statusKey]) : undefined

    let changed = false
    if (now && was) {
      // Precise: fingerprints captured at last generate/regenerate
      changed = now !== was
    } else if (now && generatedTs && now.startsWith('t:')) {
      // Fallback for reports created before fingerprints existed:
      // if the source was updated after the report was generated, treat as stale.
      changed = now.slice(2) > generatedTs
    }

    return { ...s, changed, fingerprint: now }
  })
}

export function hasChangedSources(sources: Array<{ changed?: boolean }>): boolean {
  return sources.some((s) => s.changed)
}

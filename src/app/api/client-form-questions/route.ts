import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type AgentSelection = { agentId: string; agentName?: string | null }
type FormQuestionRow = {
  id: string
  agentId: string
  agentName: string
  fieldKey: string
  label: string
  description: string | null
  inputType: string
  placeholder: string | null
  required: boolean
  options: unknown
  groupKey: string | null
  groupLabel: string | null
  sortOrder: number
}

const SYSTEM_WORKSTREAM_AGENTS: Record<string, AgentSelection[]> = {
  ws1: [
    { agentId: 'ttm', agentName: 'Valuation Agent' },
    { agentId: 'employee_obligations', agentName: 'Employee Obligations Agent' },
    { agentId: 'employee_comp', agentName: 'Employee Staffing & Compensation Agent' },
    { agentId: 'insurance_review', agentName: 'Insurance Review Agent' },
    { agentId: 'lease_analysis', agentName: 'Lease Analysis Agent' },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent' },
    { agentId: 'contract_analysis', agentName: 'Material Contracts Agent' },
    { agentId: 'org_chart_review', agentName: 'Org Chart Review Agent' },
    { agentId: 'owner_gm_assessment', agentName: 'Owner & GM Assessment Agent' },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent' },
    { agentId: 'permits_zoning', agentName: 'Permits & Zoning Agent' },
    { agentId: 'professional_advisors', agentName: 'Professional Advisors Agent' },
    { agentId: 'vendor_directory', agentName: 'Software & Vendors Agent' },
  ],
  ws2: [
    { agentId: 'ttm', agentName: 'Valuation Agent' },
    { agentId: 'competitor_analysis', agentName: 'Competitor Analysis Agent' },
    { agentId: 'digital_presence', agentName: 'Digital Presence Agent' },
    { agentId: 'facility_review', agentName: 'Facility Review Agent' },
    { agentId: 'pricing_analysis', agentName: 'Competitive Pricing Analysis Agent' },
    { agentId: 'pricing_vertical', agentName: 'Pricing by Vertical Agent' },
    { agentId: 'sales_process_review', agentName: 'Sales Process Review Agent' },
  ],
  ma: [
    { agentId: 'ttm', agentName: 'Valuation Agent' },
    { agentId: 'cim', agentName: 'CIM Generator Agent' },
    { agentId: 'teaser', agentName: 'Deal Teaser Generator Agent' },
    { agentId: 'net_proceeds', agentName: 'Net Proceeds Calculator Agent' },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent' },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent' },
  ],
}
SYSTEM_WORKSTREAM_AGENTS.both = [...SYSTEM_WORKSTREAM_AGENTS.ws1, ...SYSTEM_WORKSTREAM_AGENTS.ws2].filter(
  (agent, index, agents) => agents.findIndex(item => item.agentId === agent.agentId) === index,
)

function activeAgentIds(client: any): string[] {
  const customAgents = client.customWorkstream?.agents?.map((a: any) => ({ agentId: a.agentId, agentName: a.agentName })) ?? []
  const workstreamKey = String(client.workstream ?? '').toLowerCase()
  const systemAgents = customAgents.length ? customAgents : (SYSTEM_WORKSTREAM_AGENTS[workstreamKey] ?? [])
  const clientAgents = client.ClientWorkstreamAgents?.map((a: any) => ({ agentId: a.agentId, agentName: a.agentName })) ?? []
  return Array.from(new Set([...systemAgents, ...clientAgents].map(a => a.agentId).filter(id => id && id !== 'ttm')))
}

function dedupeQuestions(rows: FormQuestionRow[]): FormQuestionRow[] {
  const byField = new Map<string, FormQuestionRow>()
  for (const row of rows) {
    const existing = byField.get(row.fieldKey)
    if (!existing) {
      byField.set(row.fieldKey, row)
      continue
    }
    byField.set(row.fieldKey, {
      ...existing,
      required: existing.required || row.required,
      sortOrder: Math.min(existing.sortOrder, row.sortOrder),
      agentName: existing.agentName === row.agentName ? existing.agentName : `${existing.agentName}, ${row.agentName}`,
    })
  }
  return Array.from(byField.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
}

function normalizeResponses(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = typeof value === 'string' ? value.replace(/\\n/g, '\n').trim() : value == null ? '' : String(value).trim()
  }
  return out
}

function buildPrefillResponses(client: any, existing: Record<string, any>): Record<string, string> {
  const explicit = normalizeResponses(existing.agentFormResponses ?? {})
  const pricingCompetitors = Array.isArray(existing.competitorPricingInputs?.competitors)
    ? existing.competitorPricingInputs.competitors
    : []

  const competitorResponses = Array.from({ length: 5 }).reduce<Record<string, string>>((acc, _, index) => {
    const competitor = pricingCompetitors[index] ?? {}
    acc[`competitor${index + 1}Name`] = competitor.name ?? ''
    acc[`competitor${index + 1}Website`] = competitor.websiteUrl ?? ''
    return acc
  }, {})

  return {
    businessWebsite: existing.competitorPricingInputs?.sellerWebsiteUrl ?? client.websiteUrl ?? '',
    businessAddress: existing.facilityReviewInputs?.location ?? client.businessAddress ?? '',
    businessCategory: client.businessCategory ?? '',
    facilityReviewNotes: existing.facilityReviewInputs?.notes ?? '',
    professionalAdvisorsList: formatProfessionalAdvisors(existing.professionalAdvisors),
    vendorDirectoryList: formatVendorDirectory(existing.vendorDirectory),
    ...competitorResponses,
    ...explicit,
  }
}

function formatProfessionalAdvisors(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map((advisor: any) => [
    advisor.role ?? '',
    advisor.name ?? '',
    advisor.company ?? '',
    advisor.email ?? '',
    advisor.phone ?? '',
    advisor.willingToParticipate ?? 'unknown',
    advisor.notes ?? '',
  ].join(' | ')).join('\n')
}

function formatVendorDirectory(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map((item: any) => [
    item.name ?? '',
    item.vendor ?? '',
    item.category ?? '',
    item.annualCost ?? '',
    item.contractStatus ?? '',
    item.transferable ?? 'unknown',
    item.loginAccess ?? '',
    item.notes ?? '',
  ].join(' | ')).join('\n')
}

function compatibilitySections(client: any, existing: Record<string, any>, responses: Record<string, string>) {
  const merged = { ...existing.agentFormResponses, ...responses }

  const competitors = Array.from({ length: 5 }, (_, i) => ({
    name: merged[`competitor${i + 1}Name`] ?? '',
    websiteUrl: merged[`competitor${i + 1}Website`] ?? '',
  }))

  const next: Record<string, any> = {
    ...existing,
    agentFormResponses: merged,
    competitorPricingInputs: {
      ...(existing.competitorPricingInputs ?? {}),
      sellerWebsiteUrl: merged.businessWebsite ?? existing.competitorPricingInputs?.sellerWebsiteUrl ?? client.websiteUrl ?? '',
      competitors,
      updatedAt: new Date().toISOString(),
    },
    digitalPresenceForm: {
      ...(existing.digitalPresenceForm ?? {}),
      businessName: client.businessName ?? '',
      websiteUrl: merged.businessWebsite ?? client.websiteUrl ?? '',
      googleBusinessProfileUrl: merged.googleBusinessProfileUrl ?? '',
      googleBusinessLocations: merged.googleBusinessLocations ?? '',
      facebookHandle: merged.facebookHandle ?? '',
      instagramHandle: merged.instagramHandle ?? '',
      tiktokHandle: merged.tiktokHandle ?? '',
      bookingPlatformUrl: merged.bookingPlatformUrl ?? '',
      yelpUrl: merged.yelpUrl ?? '',
      nextdoorUrl: merged.nextdoorUrl ?? '',
      linkedinUrl: merged.linkedinUrl ?? '',
      glassdoorUrl: merged.glassdoorUrl ?? '',
      bbbUrl: merged.bbbUrl ?? '',
    },
  }

  if ('facilityReviewNotes' in responses || 'businessAddress' in responses) {
    next.facilityReviewInputs = {
      ...(existing.facilityReviewInputs ?? {}),
      location: merged.businessAddress ?? client.businessAddress ?? '',
      notes: merged.facilityReviewNotes ?? '',
    }
  }

  if ('professionalAdvisorsList' in responses) {
    next.professionalAdvisors = parseProfessionalAdvisors(merged.professionalAdvisorsList)
  }

  if ('vendorDirectoryList' in responses) {
    next.vendorDirectory = parseVendorDirectory(merged.vendorDirectoryList)
  }

  return next
}

function parseProfessionalAdvisors(raw: string | undefined) {
  return String(raw ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [role = '', name = '', company = '', email = '', phone = '', willing = 'unknown', notes = ''] = line.split('|').map(part => part.trim())
      return {
        id: crypto.randomUUID(),
        role,
        name: name || line,
        company,
        email,
        phone,
        willingToParticipate: ['yes', 'no'].includes(willing.toLowerCase()) ? willing.toLowerCase() : 'unknown',
        notes,
      }
    })
}

function parseVendorDirectory(raw: string | undefined) {
  return String(raw ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name = '', vendor = '', category = '', annualCost = '', contractStatus = '', transferable = 'unknown', loginAccess = '', notes = ''] = line.split('|').map(part => part.trim())
      return {
        id: crypto.randomUUID(),
        name: name || line,
        vendor,
        category,
        annualCost: Number(annualCost.replace(/[$,]/g, '')) || 0,
        contractStatus,
        transferable: ['yes', 'no'].includes(transferable.toLowerCase()) ? transferable.toLowerCase() : 'unknown',
        loginAccess,
        notes,
      }
    })
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      businessName: true,
      websiteUrl: true,
      businessAddress: true,
      businessCategory: true,
      workstream: true,
      sectionSubmissions: true,
      customWorkstream: { select: { agents: true } },
      ClientWorkstreamAgents: true,
    },
  })
  if (!client) return new Response('Not Found', { status: 404 })

  const agentIds = activeAgentIds(client).filter(id => /^[a-z0-9_]+$/.test(id))
  if (!agentIds.length) return NextResponse.json({ questions: [], responses: {} })

  const inList = agentIds.map(id => `'${id}'`).join(',')
  const rows = await (prisma as any).$queryRawUnsafe(`
    SELECT id, "agentId", "agentName", "fieldKey", label, description, "inputType", placeholder,
           required, options, "groupKey", "groupLabel", "sortOrder"
    FROM "AgentFormQuestion"
    WHERE "isActive" = true AND "agentId" IN (${inList})
    ORDER BY "sortOrder" ASC, label ASC
  `) as FormQuestionRow[]

  const existing = (client.sectionSubmissions as Record<string, any>) ?? {}
  const responses = buildPrefillResponses(client, existing)

  const questions = dedupeQuestions(rows).map(question => ({
    ...question,
    options: Array.isArray(question.options) ? question.options : null,
  }))

  return NextResponse.json({ questions, responses })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const clientId = String(body.clientId ?? '')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true, websiteUrl: true, businessAddress: true, businessCategory: true, sectionSubmissions: true },
  })
  if (!client) return new Response('Not Found', { status: 404 })

  const responses = normalizeResponses(body.responses)
  const existing = (client.sectionSubmissions as Record<string, any>) ?? {}
  const sectionSubmissions = compatibilitySections(client, existing, responses)
  const websiteUrl = responses.businessWebsite || client.websiteUrl || undefined

  await (prisma as any).clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions,
      websiteUrl,
      businessAddress: responses.businessAddress || client.businessAddress || undefined,
      businessCategory: responses.businessCategory || client.businessCategory || undefined,
    },
  })

  return NextResponse.json({ ok: true, responses: sectionSubmissions.agentFormResponses })
}

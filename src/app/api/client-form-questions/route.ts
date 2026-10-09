import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureCompetitorFormFields } from '@/lib/competitor-form-fields'
import { buildOccupancyReviewInputs, occupancyInputsToFormResponses, ensureOccupancyFormFields } from '@/lib/occupancy-form-fields'
import { syncStructuredToFormResponses, formatProfessionalAdvisors, formatVendorDirectory } from '@/lib/sync-form-responses'
import { normalizeOptionalFormValue } from '@/lib/client-form-na'

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
    { agentId: 'client_location_map', agentName: 'Client Location Map Agent' },
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
    { agentId: 'real_estate_appraisal', agentName: 'Real Estate Appraisal Agent' },
    { agentId: 'vendor_directory', agentName: 'Software & Vendors Agent' },
  ],
  ws2: [
    { agentId: 'ttm', agentName: 'Valuation Agent' },
    { agentId: 'client_location_map', agentName: 'Client Location Map Agent' },
    { agentId: 'pricing_analysis', agentName: 'Competitive Pricing Analysis Agent' },
    { agentId: 'competitor_analysis', agentName: 'Competitor Analysis Agent' },
    { agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent' },
    { agentId: 'facility_review', agentName: 'Facility Review Agent' },
    { agentId: 'occupancy_review', agentName: 'Occupancy Review Agent' },
    { agentId: 'pricing_vertical', agentName: 'Pricing by Vertical Agent' },
    { agentId: 'sales_process_review', agentName: 'Sales Process Review Agent' },
  ],
  ma: [
    { agentId: 'ttm', agentName: 'Valuation Agent' },
    { agentId: 'cim', agentName: 'CIM Generator Agent' },
    { agentId: 'teaser', agentName: 'Deal Teaser Generator Agent' },
    { agentId: 'litigation_search', agentName: 'Litigation & Liens Agent' },
    { agentId: 'net_proceeds', agentName: 'Net Proceeds Calculator Agent' },
    { agentId: 'ownership_verification', agentName: 'Ownership Verification Agent' },
    { agentId: 'professional_advisors', agentName: 'Professional Advisors Agent' },
  ],
}

const BUSINESS_OPERATIONS_QUESTIONS: FormQuestionRow[] = [
  {
    id: 'business-operations-24-hour-care', agentId: 'business_operations', agentName: 'Business Operations',
    fieldKey: 'businessOffers24HourCare', label: 'Does the facility offer 24-hour care?',
    description: 'This helps us understand overnight staffing and coverage needs.', inputType: 'select',
    placeholder: null, required: true, options: ['Yes', 'No'], groupKey: null, groupLabel: null, sortOrder: -2,
  },
  {
    id: 'business-operations-fiscal-year', agentId: 'business_operations', agentName: 'Business Operations',
    fieldKey: 'businessFiscalYearStartMonth', label: 'When does the business fiscal year end?',
    description: 'Choose the month; its last day is selected automatically. Adjust the day if needed.', inputType: 'fiscal-year-end',
    placeholder: null, required: true, options: [],
    groupKey: null, groupLabel: null, sortOrder: -1,
  },
]

// Marketing intake remains attached to the legacy digital_presence agent ID so
// existing assignments and saved submissions continue to work.
const MARKETING_AGENT_QUESTIONS: FormQuestionRow[] = [
  {
    id: 'marketing-agent-period', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingReportingPeriod', label: 'What period do these marketing figures cover?',
    description: 'Please use the last 12 months where possible and note the start/end dates. Monthly figures are most helpful.',
    inputType: 'text', placeholder: 'e.g. Oct 2025–Sep 2026', required: false, options: [],
    groupKey: 'marketing_performance', groupLabel: 'Marketing Spend & Performance', sortOrder: 200,
  },
  {
    id: 'marketing-agent-channels-spend', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingChannelsAndSpend', label: 'Which marketing channels do you use, and what do you spend on each?',
    description: 'Include monthly or annual spend for Google Ads, TikTok, directories, sponsorships, agencies, and other channels. Separate ad spend from agency/platform fees; estimates are okay.',
    inputType: 'marketing-rows', placeholder: null, required: false, options: [],
    groupKey: 'marketing_performance', groupLabel: 'Marketing Spend & Performance', sortOrder: 210,
  },
  {
    id: 'marketing-agent-results', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingChannelResults', label: 'What results do you track by marketing channel or customer source?',
    description: 'Add a row for each source you know. Include paid ads, organic search, veterinarian/referral sources, and repeat customers. Leave unknown numbers blank and choose “Not tracked” when appropriate.',
    inputType: 'marketing-rows', placeholder: null, required: false, options: [],
    groupKey: 'marketing_performance', groupLabel: 'Marketing Spend & Performance', sortOrder: 220,
  },
  {
    id: 'marketing-agent-email', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingEmailProgram', label: 'Do you use email or text marketing?',
    description: 'Add a row for each email or text platform. Enter only the metrics you know.',
    inputType: 'marketing-rows', placeholder: null, required: false, options: [],
    groupKey: 'marketing_operations', groupLabel: 'Marketing Operations & Transferability', sortOrder: 240,
  },
  {
    id: 'marketing-agent-booking', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingBookingFunnel', label: 'How do marketing inquiries turn into bookings?',
    description: 'Describe your booking platform and how you track website bookings, phone calls, inquiries, and missed/unconverted leads. Include any monthly totals you have.',
    inputType: 'textarea', placeholder: 'Booking system, tracking method, monthly inquiries/bookings, gaps', required: false, options: [],
    groupKey: 'marketing_performance', groupLabel: 'Marketing Spend & Performance', sortOrder: 250,
  },
  {
    id: 'marketing-agent-owners', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingPeopleAndVendors', label: 'Who manages marketing and what do they handle?',
    description: 'List owners, employees, agencies, and vendors; their responsibilities, approximate cost, and any work that depends on one specific person.',
    inputType: 'marketing-rows', placeholder: null, required: false, options: [],
    groupKey: 'marketing_operations', groupLabel: 'Marketing Operations & Transferability', sortOrder: 260,
  },
  {
    id: 'marketing-agent-accounts', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingAccountOwnership', label: 'Who owns and can access your marketing accounts and assets?',
    description: 'Include ad accounts, website/domain, analytics, social profiles, mailing lists, and creative files. Do not provide passwords or credentials.',
    inputType: 'marketing-rows', placeholder: null, required: false, options: [],
    groupKey: 'marketing_operations', groupLabel: 'Marketing Operations & Transferability', sortOrder: 270,
  },
  {
    id: 'marketing-agent-referral-partners', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingReferralPartners', label: 'Which veterinarians or referral partners send customers to you?',
    description: 'Add the key partners you rely on. Customer or revenue estimates are optional if you do not track them.',
    inputType: 'marketing-rows', placeholder: null, required: false, options: [],
    groupKey: 'marketing_performance', groupLabel: 'Marketing Spend & Performance', sortOrder: 235,
  },
  {
    id: 'marketing-agent-reviews', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingReviewManagement', label: 'Who monitors and responds to online reviews?',
    description: 'Briefly describe who owns review responses, how often profiles are checked, and how customer issues are followed up.',
    inputType: 'textarea', placeholder: 'e.g. Office manager checks Google reviews weekly and replies within two days', required: false, options: [],
    groupKey: 'marketing_operations', groupLabel: 'Marketing Operations & Transferability', sortOrder: 275,
  },
  {
    id: 'marketing-agent-plan', agentId: 'digital_presence', agentName: 'Marketing Spend & Performance Agent',
    fieldKey: 'marketingPlanAndBudget', label: 'Do you have a written marketing plan, budget, or goals?',
    description: 'Summarize annual goals, planned budget versus actual spend, key measures, and how often results are reviewed.',
    inputType: 'textarea', placeholder: 'Plan/goals, budget, actuals, KPIs, review cadence, or “not documented”', required: false, options: [],
    groupKey: 'marketing_operations', groupLabel: 'Marketing Operations & Transferability', sortOrder: 280,
  },
]
SYSTEM_WORKSTREAM_AGENTS.both = [...SYSTEM_WORKSTREAM_AGENTS.ws1, ...SYSTEM_WORKSTREAM_AGENTS.ws2].filter(
  (agent, index, agents) => agents.findIndex(item => item.agentId === agent.agentId) === index,
)

function activeAgentIds(client: any): string[] {
  const customAgents = client.customWorkstream?.agents?.map((a: any) => ({ agentId: a.agentId, agentName: a.agentName })) ?? []
  const workstreamKey = String(client.workstream ?? '').toLowerCase()
  const systemAgents = customAgents.length ? customAgents : (SYSTEM_WORKSTREAM_AGENTS[workstreamKey] ?? [])
  const clientAgents = client.ClientWorkstreamAgents?.map((a: any) => ({ agentId: a.agentId, agentName: a.agentName })) ?? []
  const ids = Array.from(new Set([...systemAgents, ...clientAgents].map(a => a.agentId).filter(id => id && id !== 'ttm')))
  if (workstreamKey === 'ma' || workstreamKey === 'both') {
    if (!ids.includes('professional_advisors')) ids.push('professional_advisors')
    return ids
  }
  return ids.filter(id => id !== 'professional_advisors')
}

function isAdvisorFacilityReviewMode(client: any): boolean {
  const submissions = (client.sectionSubmissions as Record<string, any>) ?? {}
  return submissions.facilityReviewMode === 'advisor'
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

function hasMeaningfulResponse(value: string | undefined): boolean {
  return String(value ?? '').trim().length > 0
}

function mergeDraftResponses(existingResponses: unknown, draftResponses: Record<string, string>): Record<string, string> {
  const existing = normalizeResponses(existingResponses)
  return Object.entries(draftResponses).reduce<Record<string, string>>((acc, [key, value]) => {
    if (hasMeaningfulResponse(value) || !hasMeaningfulResponse(acc[key])) {
      acc[key] = value
    }
    return acc
  }, { ...existing })
}

function buildCompetitorSlotResponses(existing: Record<string, any>, explicit: Record<string, string>): Record<string, string> {
  const fromAnalysis = Array.isArray(existing.competitorAnalysisForm?.manualCompetitors)
    ? existing.competitorAnalysisForm.manualCompetitors
    : []
  const fromPricing = Array.isArray(existing.competitorPricingInputs?.competitors)
    ? existing.competitorPricingInputs.competitors
    : []

  return Array.from({ length: 5 }).reduce<Record<string, string>>((acc, _, index) => {
    const slot = index + 1
    const analysisEntry = fromAnalysis[index] ?? {}
    const pricingEntry = fromPricing[index] ?? {}
    acc[`competitor${slot}Name`] =
      explicit[`competitor${slot}Name`]
      || analysisEntry.name
      || pricingEntry.name
      || ''
    acc[`competitor${slot}Website`] =
      explicit[`competitor${slot}Website`]
      || analysisEntry.websiteUrl
      || pricingEntry.websiteUrl
      || ''
    acc[`competitor${slot}Address`] =
      explicit[`competitor${slot}Address`]
      || analysisEntry.address
      || pricingEntry.address
      || ''
    acc[`competitor${slot}Category`] =
      explicit[`competitor${slot}Category`]
      || pricingEntry.category
      || ''
    return acc
  }, {})
}

function buildPrefillResponses(client: any, existing: Record<string, any>): Record<string, string> {
  const explicit = normalizeResponses(existing.agentFormResponses ?? {})
  const competitorResponses = buildCompetitorSlotResponses(existing, explicit)

  return {
    businessWebsite: existing.competitorPricingInputs?.sellerWebsiteUrl ?? client.websiteUrl ?? '',
    businessAddress: existing.facilityReviewInputs?.location ?? existing.competitorAnalysisForm?.businessAddress ?? client.businessAddress ?? '',
    businessCategory: existing.competitorAnalysisForm?.businessCategory ?? client.businessCategory ?? '',
    facilityReviewNotes: existing.facilityReviewInputs?.notes ?? '',
    ...occupancyInputsToFormResponses(existing.occupancyReviewInputs),
    professionalAdvisorsList: formatProfessionalAdvisors(existing.professionalAdvisors),
    vendorDirectoryList: formatVendorDirectory(existing.vendorDirectory),
    ...competitorResponses,
    ...explicit,
  }
}


function compatibilitySections(client: any, existing: Record<string, any>, responses: Record<string, string>) {
  const merged = { ...existing.agentFormResponses, ...responses }

  const competitors = Array.from({ length: 5 }, (_, i) => ({
    name: merged[`competitor${i + 1}Name`] ?? '',
    websiteUrl: merged[`competitor${i + 1}Website`] ?? '',
    address: merged[`competitor${i + 1}Address`] ?? '',
    category: merged[`competitor${i + 1}Category`] ?? '',
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
      websiteUrl: normalizeOptionalFormValue(merged.businessWebsite) || client.websiteUrl || '',
      googleBusinessProfileUrl: normalizeOptionalFormValue(merged.googleBusinessProfileUrl),
      googleBusinessLocations: normalizeOptionalFormValue(merged.googleBusinessLocations),
      facebookHandle: normalizeOptionalFormValue(merged.facebookHandle),
      instagramHandle: normalizeOptionalFormValue(merged.instagramHandle),
      tiktokHandle: normalizeOptionalFormValue(merged.tiktokHandle),
      bookingPlatformUrl: normalizeOptionalFormValue(merged.bookingPlatformUrl),
      yelpUrl: normalizeOptionalFormValue(merged.yelpUrl),
      nextdoorUrl: normalizeOptionalFormValue(merged.nextdoorUrl),
      linkedinUrl: normalizeOptionalFormValue(merged.linkedinUrl),
      glassdoorUrl: normalizeOptionalFormValue(merged.glassdoorUrl),
      bbbUrl: normalizeOptionalFormValue(merged.bbbUrl),
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

  if (
    'occupancyTotalDailyCapacity' in responses
    || 'occupancyBoardingRuns' in responses
    || 'occupancyDaycareSpots' in responses
    || 'occupancyGroomingStations' in responses
    || 'occupancyBathingStations' in responses
    || 'occupancyMonthlyData' in responses
  ) {
    next.occupancyReviewInputs = buildOccupancyReviewInputs(merged)
  }

  const filledCompetitors = competitors.filter(item => item.name || item.websiteUrl || item.address)
  if (filledCompetitors.length || 'businessAddress' in responses || 'businessCategory' in responses) {
    next.competitorAnalysisForm = {
      ...(existing.competitorAnalysisForm ?? {}),
      businessName: client.businessName ?? existing.competitorAnalysisForm?.businessName ?? '',
      businessAddress: merged.businessAddress ?? client.businessAddress ?? '',
      businessCategory: merged.businessCategory ?? client.businessCategory ?? '',
      websiteUrl: merged.businessWebsite ?? client.websiteUrl ?? '',
      manualCompetitors: competitors.map(item => ({
        name: item.name ?? '',
        address: item.address ?? '',
        websiteUrl: item.websiteUrl ?? '',
      })),
      updatedAt: new Date().toISOString(),
    }
  }

  return next
}

function parseProfessionalAdvisors(raw: string | undefined) {
  return String(raw ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [role = '', name = '', company = '', email = '', phone = '', notes = ''] = line.split('|').map(part => part.trim())
      return {
        id: crypto.randomUUID(),
        role,
        name: name || line,
        company,
        email,
        phone,
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

  const agentIds = activeAgentIds(client)
    .filter(id => !isAdvisorFacilityReviewMode(client) || id !== 'facility_review')
    .filter(id => /^[a-z0-9_]+$/.test(id))
  if (!agentIds.length) {
    const existing = (client.sectionSubmissions as Record<string, any>) ?? {}
    return NextResponse.json({ questions: BUSINESS_OPERATIONS_QUESTIONS, responses: existing.agentFormResponses ?? {} })
  }

  const inList = agentIds.map(id => `'${id}'`).join(',')
  const rows = await (prisma as any).$queryRawUnsafe(`
    SELECT id, "agentId", "agentName", "fieldKey", label, description, "inputType", placeholder,
           required, options, "groupKey", "groupLabel", "sortOrder"
    FROM "AgentFormQuestion"
    WHERE "isActive" = true AND "agentId" IN (${inList})
    ORDER BY "sortOrder" ASC, label ASC
  `) as FormQuestionRow[]

  const existing = (client.sectionSubmissions as Record<string, any>) ?? {}
  const responses = {
    ...buildPrefillResponses(client, existing),
    ...syncStructuredToFormResponses(existing, client),
  }

  const questions = dedupeQuestions([
    ...BUSINESS_OPERATIONS_QUESTIONS,
    ...MARKETING_AGENT_QUESTIONS.filter(question => agentIds.includes('digital_presence')),
    ...ensureOccupancyFormFields(
      ensureCompetitorFormFields(rows, agentIds),
      agentIds,
    ),
  ])
    // Commented out for now: Google Business locations
    .filter(q => q.fieldKey !== 'googleBusinessLocations')
    .map(question => ({
      ...question,
      agentName: question.agentId === 'digital_presence' ? 'Marketing Spend & Performance Agent' : question.agentName,
      options: Array.isArray(question.options) ? question.options : null,
    }))

  return NextResponse.json({ questions, responses })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const clientId = String(body.clientId ?? '')
  if (!clientId) return new Response('clientId required', { status: 400 })
  const saveMode = body.mode === 'draft' ? 'draft' : body.mode === 'partial' ? 'partial' : 'final'

  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: clientId },
    select: { id: true, businessName: true, websiteUrl: true, businessAddress: true, businessCategory: true, sectionSubmissions: true },
  })
  if (!client) return new Response('Not Found', { status: 404 })

  const existing = (client.sectionSubmissions as Record<string, any>) ?? {}
  const normalizedResponses = normalizeResponses(body.responses)
  const responses = saveMode === 'draft'
    ? mergeDraftResponses(existing.agentFormResponses, normalizedResponses)
    : saveMode === 'partial'
      ? { ...normalizeResponses(existing.agentFormResponses), ...normalizedResponses }
      : normalizedResponses
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

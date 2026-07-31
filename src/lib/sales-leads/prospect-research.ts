import { prisma } from '@/lib/prisma'
import { getAIClient, resolveModel } from '@/lib/ai-client'
import { buildSalesLeadEmailDraft } from '@/lib/sales-leads/email-provider'
import { getProjectEnv } from '@/lib/project-env'

function researchReportUrl(leadId: string) {
  const base = getProjectEnv('NEXT_PUBLIC_APP_URL') || getProjectEnv('APP_URL') || ''
  return `${(base || 'https://advisor.cantarapet.com').replace(/\/$/, '')}/research-report/${leadId}`
}

export async function generateProspectResearch(leadId: string) {
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
  if (!lead) throw new Error('Sales lead not found.')
  const ai = await getAIClient()
  if (!ai) throw new Error('AI provider is not configured.')

  const prompt = `You are an expert commercial real estate and M&A research analyst conducting deep background research on a pet resort business.
Business Name: "${lead.businessName}"
City: "${lead.city || 'Unknown'}"
State: "${lead.state || 'Unknown'}"
Website: "${lead.websiteUrl || 'N/A'}"
Owner Name: "${[lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') || 'Unknown'}"
Indoor SqFt: ${lead.sqftIndoor || 'N/A'}, Outdoor SqFt: ${lead.sqftOutdoor || 'N/A'}, Combined SqFt: ${lead.sqftCombined || 'N/A'}
Google Rating: ${lead.googleRating || 'N/A'} (${lead.reviewCount || 'N/A'} reviews)

Conduct a structured research analysis answering:
1. What year did the business start / open?
2. How long have the current owners owned the business?
3. Has the business been sold previously?
4. Rate the resort Tier 1, Tier 2, or Tier 3 based on facility scale, review volume, and business profile.

Return only valid JSON, with each value a concise plain-text string (never nested objects and never markdown):
{
  "yearStarted": "year and operating tenure",
  "ownershipTenure": "current-owner tenure",
  "priorSaleHistory": "prior sale history or no public record found",
  "tierRating": "Tier 1 | Tier 2 | Tier 3",
  "tierReasoning": "one-sentence justification",
  "businessProfileSummary": "concise 2-3 sentence executive profile"
}`
  const response = await ai.messages.create({
    model: resolveModel('claude-sonnet-4-20250514'),
    max_tokens: 1000,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  let report: any
  try {
    report = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim())
  } catch {
    report = { yearStarted: 'Not specified', ownershipTenure: 'Not specified', priorSaleHistory: 'No public sale records found', tierRating: lead.sqftCombined && lead.sqftCombined >= 15000 ? 'Tier 1' : 'Tier 2', tierReasoning: 'Based on facility scale and review profile.', businessProfileSummary: raw.slice(0, 500) }
  }
  const normalizedReport = Object.fromEntries(Object.entries(report).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim() : JSON.stringify(value),
  ]))
  return prisma.salesLead.update({ where: { id: leadId }, data: { aiResearchReport: normalizedReport, preCallBriefUrl: researchReportUrl(leadId) } })
}

export async function generateSalesLeadEmail1Draft(leadId: string) {
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
  if (!lead) throw new Error('Sales lead not found.')
  const draft = await buildSalesLeadEmailDraft(lead, 1)
  return prisma.salesLead.update({ where: { id: leadId }, data: { emailApprovalStatus: 'PENDING', pendingEmailTemplate: 1, emailDraftSubject: draft.subject, emailDraftBody: draft.body } })
}

export async function researchAndDraftEmail1(leadId: string) {
  await generateProspectResearch(leadId)
  const updated = await generateSalesLeadEmail1Draft(leadId)
  await prisma.$transaction([
    prisma.salesLeadActivity.create({ data: { leadId, type: 'research_and_email_1_draft_created', summary: 'Prospect research completed and Email 1 draft saved.' } }),
    ...(updated.mondayItemId && updated.mondayBoardId ? [prisma.salesLeadSyncEvent.create({ data: { leadId, direction: 'OUTBOUND_MONDAY', status: 'PENDING', payload: { reason: 'research_and_email_1_draft_completed' } } })] : []),
  ])
  return updated
}

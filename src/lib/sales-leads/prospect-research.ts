import { prisma } from '@/lib/prisma'
import { getAIClient, resolveModel } from '@/lib/ai-client'
import { buildSalesLeadEmailDraft } from '@/lib/sales-leads/email-provider'
import { getProjectEnv } from '@/lib/project-env'
import { createPublicEditableGoogleDoc } from '@/lib/composio'
import { getDriveParentFolder } from '@/lib/drive-settings'

function researchReportUrl(leadId: string) {
  const base = getProjectEnv('NEXT_PUBLIC_APP_URL') || getProjectEnv('APP_URL') || ''
  return `${(base || 'https://advisor.cantarapet.com').replace(/\/$/, '')}/research-report/${leadId}`
}

function briefValue(value: unknown) { return String(value ?? 'Not publicly verified').trim() || 'Not publicly verified' }
function escapeHtml(value: unknown) {
  return briefValue(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}
function section(title: string, value: unknown) {
  return `<h2>${escapeHtml(title)}</h2><div class="section-body">${escapeHtml(value).replace(/\n/g, '<br>')}</div>`
}

export async function saveProspectResearchToGoogleDoc(leadId: string) {
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
  if (!lead || !lead.aiResearchReport) throw new Error('Complete prospect research before creating the brief.')
  const folderUrl = await getDriveParentFolder()
  if (!folderUrl) throw new Error('Configure a Google Drive brief folder first.')
  const report = lead.aiResearchReport as Record<string, unknown>
  const location = [lead.city, lead.state].filter(Boolean).join(', ') || 'Not publicly verified'
  const owner = [lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') || 'Not publicly verified'
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#20263b;line-height:1.5;margin:42px;font-size:10.5pt}
  .eyebrow{color:#9a7946;font-weight:700;letter-spacing:1.8px;font-size:9pt;margin:0 0 8px}
  h1{font-family:Georgia,serif;color:#20263b;font-size:25pt;margin:0 0 4px;border-bottom:3px solid #caa15f;padding-bottom:12px}
  .lead{font-family:Georgia,serif;color:#9a7946;font-size:15pt;margin:12px 0 3px}
  .meta{color:#596176;margin:0 0 24px}.meta b{color:#20263b}
  h2{font-size:12pt;color:#20263b;background:#eef1f5;border-left:5px solid #caa15f;padding:8px 10px;margin:22px 0 7px}
  .section-body{white-space:normal;margin-left:15px}.footer{border-top:1px solid #caa15f;margin-top:28px;padding-top:10px;color:#777;font-size:9pt;font-style:italic}
  </style></head><body>
  <p class="eyebrow">CANTARA PET BUSINESS ADVISORS</p><h1>PRE-CALL BRIEF</h1>
  <div class="lead">${escapeHtml(lead.businessName)} — ${escapeHtml(location)}</div>
  <p class="meta"><b>Research date:</b> ${escapeHtml(new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }))}<br><b>Website:</b> ${escapeHtml(lead.websiteUrl || 'Not publicly verified')}<br><b>Lead owner:</b> ${escapeHtml(owner)}</p>
  ${section('1. Lead Qualification and Tier', `${briefValue(report.tierRating)} | ${briefValue(report.leadQualification)}\n${briefValue(report.tierReasoning)}`)}
  ${section('2. Ownership and Business History', `Year established: ${briefValue(report.yearStarted)}\nCurrent ownership and tenure: ${briefValue(report.ownershipHistory)}\nPrior sale history: ${briefValue(report.priorSaleHistory)}`)}
  ${section('3. Owner Intelligence and Relationship Profile', `${briefValue(report.ownerProfile)}\n\nCredentials and associations: ${briefValue(report.credentialsAndAssociations)}\n\nSocial and community profile: ${briefValue(report.socialAndCommunityProfile)}`)}
  ${section('Social Score and Footprint', `Google rating: ${briefValue(lead.googleRating)} | Google reviews: ${briefValue(lead.reviewCount)}\nOwner and business social links: ${briefValue(report.socialAndCommunityProfile)}`)}
  ${section('4. Facility and Operating Profile', `Lead-record facility data: indoor ${briefValue(lead.sqftIndoor)} sq ft; outdoor ${briefValue(lead.sqftOutdoor)} sq ft; combined ${briefValue(lead.sqftCombined)} sq ft.\n\n${briefValue(report.facilityAndOperatingProfile)}`)}
  ${section('5. Recent Business Developments', briefValue(report.recentBusinessDevelopments))}
  ${section('6. Outreach Preparation', briefValue(report.recommendedPersonalization))}
  ${section('Sources', briefValue(report.sources))}
  <p class="footer">Confidential — Cantara internal use. This brief contains public research and lead-record information. Items that could not be verified are explicitly identified.</p>
  </body></html>`
  const doc = await createPublicEditableGoogleDoc({
    folderUrl,
    fileName: `Pre-Call Brief - ${lead.businessName}`,
    html,
  })
  return prisma.salesLead.update({ where: { id: leadId }, data: { preCallBriefUrl: doc.webViewLink } })
}

export async function generateProspectResearch(leadId: string) {
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
  if (!lead) throw new Error('Sales lead not found.')
  const ai = await getAIClient()
  if (!ai) throw new Error('AI provider is not configured.')

  const prompt = `You are preparing a factual, pre-call intelligence brief for Cantara Pet Business Advisors.
Do not invent facts. Use only information you can verify from public sources and the supplied lead record. If a fact cannot be verified, write "Not publicly verified" and include no guessed number, date, owner, credential, software, or sale history. Distinguish clearly between verified fact and analysis. Include a short source URL or source name for every researched section when available.
Business Name: "${lead.businessName}"
City: "${lead.city || 'Unknown'}"
State: "${lead.state || 'Unknown'}"
Website: "${lead.websiteUrl || 'N/A'}"
Business Position: "${lead.businessPosition || 'N/A'}"
Office Phone Number: "${lead.officePhone || 'N/A'}"
Owner Name: "${[lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') || 'Unknown'}"
Indoor SqFt: ${lead.sqftIndoor || 'N/A'}, Outdoor SqFt: ${lead.sqftOutdoor || 'N/A'}, Combined SqFt: ${lead.sqftCombined || 'N/A'}
Google Rating: ${lead.googleRating || 'N/A'} (${lead.reviewCount || 'N/A'} reviews)

Conduct a structured research analysis answering:
1. What year did the business start / open?
2. How long have the current owners owned the business?
3. Has the business been sold previously?
4. Rate the resort Tier 1, Tier 2, or Tier 3 based on facility scale, review volume, and business profile.

Return only valid JSON. Every field must be a concise plain-text string; use "Not publicly verified" where necessary. Do not return markdown or nested objects:
{
  "leadQualification": "tier and confidence with factual reasoning",
  "yearStarted": "verified founding/opening year or Not publicly verified",
  "ownershipHistory": "current owner and verified tenure or Not publicly verified",
  "priorSaleHistory": "verified prior sale/acquisition evidence or Not publicly verified",
  "ownerProfile": "professional background and relevant public facts only",
  "credentialsAndAssociations": "verified industry credentials or associations only",
  "socialAndCommunityProfile": "verified public interests, community, or social presence only",
  "facilityAndOperatingProfile": "services, size, location, operating model, and software only when verified",
  "recentBusinessDevelopments": "recent verified developments, awards, hiring, expansion, or app/software changes",
  "recommendedPersonalization": "2-3 factual, non-invasive conversation points grounded in this brief",
  "sources": "source names and URLs separated by semicolons",
  "tierRating": "Tier 1 | Tier 2 | Tier 3 | Not publicly verified",
  "tierReasoning": "one-sentence evidence-based justification",
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
  await saveProspectResearchToGoogleDoc(leadId)
  const updated = await generateSalesLeadEmail1Draft(leadId)
  await prisma.$transaction([
    prisma.salesLeadActivity.create({ data: { leadId, type: 'research_and_email_1_draft_created', summary: 'Prospect research completed and Email 1 draft saved.' } }),
    ...(updated.mondayItemId && updated.mondayBoardId ? [prisma.salesLeadSyncEvent.create({ data: { leadId, direction: 'OUTBOUND_MONDAY', status: 'PENDING', payload: { reason: 'research_and_email_1_draft_completed' } } })] : []),
  ])
  return updated
}

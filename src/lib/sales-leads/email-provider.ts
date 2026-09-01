import { formatSalesLeadEmailBody } from '@/lib/composio/mail'
import { getProjectEnv } from '@/lib/project-env'
import { prisma } from '@/lib/prisma'
import { getAIClient, resolveModel } from '@/lib/ai-client'
import { getLoggedInAdvisor, sendAdvisorEmail } from '@/lib/advisor-mail'
import type { EmailLead, SalesLeadTemplateOptions, TemplateSender } from '@/lib/sales-leads/email-template'
import {
  buildSenderFooterFromUser,
  interpolateSalesLeadTemplate,
  salesLeadEmailTemplateKey,
  templateHasSenderFooterPlaceholder,
} from '@/lib/sales-leads/email-template'
import { parseEmailList, withoutEmail } from '@/lib/sales-leads/email-recipients'

export type SalesLeadEmailRecipients = {
  extraTo?: string[]
  cc?: string[]
}

export class SalesLeadEmailConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesLeadEmailConfigurationError'
  }
}

function interpolate(value: string, lead: EmailLead, sender?: TemplateSender, options?: SalesLeadTemplateOptions) {
  return interpolateSalesLeadTemplate(value, lead, sender, options)
}

async function resolveSalesLeadMailSenderUserId(lead: Pick<EmailLead, 'assignedCallerId'>) {
  try {
    const advisor = await getLoggedInAdvisor()
    if (advisor?.id) return advisor.id
  } catch {
    // Cron or non-request context: fall back to the assigned caller.
  }
  if (lead.assignedCallerId) return lead.assignedCallerId
  throw new SalesLeadEmailConfigurationError('Connect your Gmail in Settings before sending sales-lead emails.')
}

function buildConfiguredSalesLeadEmailDraft(lead: EmailLead, templateNum: 1 | 2) {
  const reputation = lead.googleRating && lead.reviewCount
    ? ` Maintaining a ${lead.googleRating}-star Google rating across ${lead.reviewCount} reviews is no small feat.`
    : ''
  const scale = lead.sqftCombined
    ? ` The facility's approximately ${lead.sqftCombined.toLocaleString()} square feet also caught my attention.`
    : ''
  const defaultBody = templateNum === 1
    ? `Hi ${lead.ownerFirstName || 'there'},\n\nI was researching independent pet resorts${lead.city ? ` in ${lead.city}` : ''} and was impressed by ${lead.businessName}.${reputation}${scale}\n\nCantara helps owners think through growth, succession, and exit strategies as they plan the next chapter of their business. There is no pressure or agenda to sell - I would simply enjoy learning about your vision for the next few years. Would you be open to a quick conversation?\n\nBest regards,\nCantara Pet Advisors`
    : `Hi ${lead.ownerFirstName || 'there'},\n\nI wanted to follow up on my note about ${lead.businessName}. We speak with independent pet resort owners about practical growth opportunities and longer-term succession or exit planning, often well before a decision has been made.\n\nIf that is relevant to what you are thinking about, would you be open to a brief introduction?\n\nBest regards,\nCantara Pet Advisors`
  return {
    subject: `Growth and succession planning for ${lead.businessName}`,
    body: interpolate(getProjectEnv(salesLeadEmailTemplateKey(templateNum, lead.emailType, 'BODY')) || defaultBody, lead),
  }
}

function buildResearchFallback(lead: EmailLead, templateNum: 1 | 2) {
  const location = [lead.city, lead.state].filter(Boolean).join(', ')
  const rating = lead.googleRating ? `${lead.googleRating}-star Google rating` : ''
  const reviews = lead.reviewCount ? `${lead.reviewCount} reviews` : ''
  const proofPoint = [rating, reviews].filter(Boolean).join(' and ')
  if (templateNum === 1) {
    return {
      subject: `Growth and succession planning for ${lead.businessName}`,
      body: `Hi ${lead.ownerFirstName || 'there'},\n\nI was researching strong pet resorts${location ? ` in ${lead.city}` : ''} and was impressed by ${lead.businessName}${proofPoint ? ` - maintaining a ${proofPoint} is no small feat` : ''}.\n\nCantara helps independent pet resort owners evaluate growth, succession, and exit strategies. There’s no pressure or agenda to sell; I’d simply enjoy introducing ourselves and hearing about your vision for the next few years.\n\nWould you be open to a quick chat?\n\nBest regards,\nCantara Pet Advisors`,
    }
  }
  return {
    subject: `Growth and succession planning for ${lead.businessName}`,
    body: `Hi ${lead.ownerFirstName || 'there'},\n\nJust following up on my note about ${lead.businessName}. We often speak with owners who are thinking about the next chapter - whether that means improving the business, preparing for a transition, or simply understanding their options.\n\nIf that’s relevant for you, would a 10-minute introduction be worthwhile?\n\nBest,\nCantara Pet Advisors`,
  }
}

function parseDraftJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const candidate = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned
  return JSON.parse(candidate) as { subject?: unknown; body?: unknown }
}

export async function buildSalesLeadEmailDraft(lead: EmailLead, templateNum: 1 | 2) {
  if (!lead.assignedCallerId) {
    throw new SalesLeadEmailConfigurationError('Assign a lead before generating an email draft so the correct sender assets can be used.')
  }
  const asset = await prisma.outreachAsset.findFirst({
    where: {
      touch: templateNum,
      assetType: 'EMAIL',
      contactType: lead.emailType,
      active: true,
      senderUserId: lead.assignedCallerId,
    },
    include: { senderUser: { select: { name: true, emailFooterName: true, emailFooterTitle: true, emailFooterPhone: true, emailFooterHtml: true } } },
    orderBy: [{ version: 'desc' }],
  })
  if (asset) {
    const senderFooter = buildSenderFooterFromUser(asset.senderUser)
    const options: SalesLeadTemplateOptions = {
      calendarUrl: asset.calendarUrl,
      senderPhone: asset.senderPhone,
      guideUrl: asset.guideUrl,
      senderFooter,
    }
    const sender = { name: asset.senderUser?.name || null }
    const renderedBody = interpolate(asset.body, lead, sender, options)
    // Templates should include [Footer] / {{senderFooter}}. Only append when the
    // asset has no footer placeholder — never stack a second signature under one
    // that was already baked into the template body.
    const body =
      senderFooter && !templateHasSenderFooterPlaceholder(asset.body)
        ? `${renderedBody.trim()}\n\n${senderFooter}`
        : renderedBody
    return {
      subject: interpolate(asset.subject || `Growth and succession planning for ${lead.businessName}`, lead, sender, options),
      body,
    }
  }
  const fallback = lead.aiResearchReport
    ? buildResearchFallback(lead, templateNum)
    : buildConfiguredSalesLeadEmailDraft(lead, templateNum)
  if (!lead.aiResearchReport) return fallback
  try {
    const ai = await getAIClient()
    if (!ai) return fallback
    const response = await ai.messages.create({
      model: resolveModel('claude-3-5-haiku-latest'),
      max_tokens: 700,
      temperature: 0.3,
      system: 'You are Cantara\'s senior M&A origination copywriter. Write credible, personalized cold outreach to an independent pet resort owner. The saved research is approved context and should be used openly: mention one or two accurate, positive specifics such as reputation, facility scale, longevity, or market position. Never invent or round up facts. Never make the email sound like an acquisition pitch, imply the owner wants to sell, or mention research or AI. Return valid JSON only with string fields subject and body.',
      messages: [{ role: 'user', content: `Create Email ${templateNum} in this style: open by saying you were researching strong/top pet resorts in the prospect\'s market; give a sincere compliment supported by one or two saved facts; explain that Cantara helps independent pet resort owners evaluate growth, succession, and exit strategies; acknowledge there is no pressure or agenda to sell; ask to hear about the owner\'s vision for the next few years and request a quick chat. Email 2 should use a different researched fact or angle while remaining a natural follow-up. Keep it 100-150 words, warm, direct, and conversational. Use this exact subject line: "Growth and succession planning for ${lead.businessName}". Sign as Cantara Pet Advisors.
Lead: ${JSON.stringify({ businessName: lead.businessName, ownerFirstName: lead.ownerFirstName, city: lead.city, state: lead.state })}
Saved prospect research (you must use at least one specific fact from this): ${JSON.stringify(lead.aiResearchReport)}` }],
    })
    const text = response.content.find(item => item.type === 'text')?.text || ''
    const parsed = parseDraftJson(text)
    if (typeof parsed.subject === 'string' && typeof parsed.body === 'string' && parsed.subject.trim() && parsed.body.trim()) {
      return { subject: `Growth and succession planning for ${lead.businessName}`, body: parsed.body.trim() }
    }
  } catch (error) {
    console.error('[sales-leads] AI email draft failed; using research-aware fallback.', error)
  }
  return fallback
}

export async function sendSalesLeadEmail(
  arg1: (EmailLead & { emailDraftSubject?: string | null; emailDraftBody?: string | null }) | { leadId: string; toEmail: string; emailType: 'EMAIL_1' | 'EMAIL_2' },
  arg2?: 1 | 2,
  recipients?: SalesLeadEmailRecipients,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    let lead: EmailLead & { emailDraftSubject?: string | null; emailDraftBody?: string | null } | null = null
    let templateNum: 1 | 2 = 1

    if ('leadId' in arg1) {
      const dbLead = await prisma.salesLead.findUnique({ where: { id: arg1.leadId } })
      if (!dbLead) throw new Error('Lead not found')
      lead = dbLead
      templateNum = arg1.emailType === 'EMAIL_1' ? 1 : 2
    } else {
      lead = arg1
      templateNum = arg2 || 1
    }

    if (!lead.ownerEmail) {
      throw new SalesLeadEmailConfigurationError('The lead does not have an email address.')
    }

    const extraTo = withoutEmail(parseEmailList(recipients?.extraTo), lead.ownerEmail)
    const cc = withoutEmail(parseEmailList(recipients?.cc), lead.ownerEmail)

    const savedSubject = lead.emailDraftSubject?.trim()
    const savedBody = lead.emailDraftBody?.trim()
    const draft = savedSubject && savedBody
      ? { subject: savedSubject, body: savedBody }
      : await buildSalesLeadEmailDraft(lead, templateNum)

    const senderUserId = await resolveSalesLeadMailSenderUserId(lead)
    const data = await sendAdvisorEmail({
      userId: senderUserId,
      to: lead.ownerEmail,
      extraTo,
      cc,
      displayName: [lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') || lead.businessName,
      subject: draft.subject,
      body: formatSalesLeadEmailBody(draft.body),
    })

    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send email from the connected Gmail account' }
  }
}

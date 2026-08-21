import type { SalesLead, SalesLeadContactType } from '@prisma/client'

export type EmailLead = Pick<
  SalesLead,
  'businessName' | 'ownerFirstName' | 'ownerLastName' | 'ownerEmail' | 'emailType' | 'city' | 'state' | 'googleRating' | 'reviewCount' | 'sqftCombined' | 'websiteUrl'
> & { businessPosition?: string | null; officePhone?: string | null; aiResearchReport?: SalesLead['aiResearchReport']; assignedCallerId?: string | null }

export type TemplateSender = { name?: string | null } | null | undefined

export type SalesLeadTemplateOptions = {
  calendarUrl?: string | null
  senderPhone?: string | null
  guideUrl?: string | null
}

export function senderLastNameFromDisplayName(name?: string | null) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2 ? parts.slice(1).join(' ') : ''
}

export function buildVerifiedCompliment(lead: Pick<EmailLead, 'googleRating' | 'reviewCount' | 'sqftCombined' | 'city'>) {
  if (lead.googleRating && lead.reviewCount) {
    return `Maintaining a ${lead.googleRating}-star Google rating across ${lead.reviewCount.toLocaleString()} reviews is an impressive accomplishment.`
  }
  if (lead.googleRating) {
    return `Maintaining a ${lead.googleRating}-star Google rating is an impressive accomplishment.`
  }
  if (lead.sqftCombined) {
    return `Operating approximately ${lead.sqftCombined.toLocaleString()} square feet of pet-care space is an impressive accomplishment.`
  }
  if (lead.city) {
    return `What you've built for pet owners in ${lead.city} is an impressive accomplishment.`
  }
  return 'What you\'ve built there is an impressive accomplishment.'
}

export function interpolateSalesLeadTemplate(
  value: string,
  lead: EmailLead,
  sender?: TemplateSender,
  options?: SalesLeadTemplateOptions,
) {
  const report = (lead.aiResearchReport && typeof lead.aiResearchReport === 'object' ? lead.aiResearchReport : {}) as Record<string, unknown>
  const footerName = String(sender?.name || '').trim()
  const senderLastName = senderLastNameFromDisplayName(footerName)
  const calendarUrl = String(options?.calendarUrl || '').trim()
  const senderPhone = String(options?.senderPhone || '').trim()
  const guideUrl = String(options?.guideUrl || '').trim()
  const replacements: Record<string, string> = {
    businessName: lead.businessName,
    ownerFirstName: lead.ownerFirstName || '',
    ownerLastName: lead.ownerLastName || '',
    city: lead.city || '',
    state: lead.state || '',
    facilityName: lead.businessName,
    website: lead.websiteUrl || '',
    phone: senderPhone,
    businessPosition: lead.businessPosition || '',
    officePhone: lead.officePhone || '',
    link: calendarUrl,
    calendarUrl,
    senderName: footerName,
    googleRating: lead.googleRating ? String(lead.googleRating) : '',
    reviewCount: lead.reviewCount ? String(lead.reviewCount) : '',
    sqftCombined: lead.sqftCombined ? lead.sqftCombined.toLocaleString() : '',
    facilityAndOperatingProfile: String(report.facilityAndOperatingProfile || ''),
    senderLastName,
    guideUrl,
  }
  return value
    .replace(/\{\{(\w+)\}\}/g, (_match, key) => replacements[key] ?? '')
    .replace(/\[Facility Name\]/gi, replacements.facilityName)
    .replace(/\[First Name\]/gi, replacements.ownerFirstName)
    .replace(/\[Sender Name\]/gi, footerName || '[Sender Name]')
    .replace(/\s*\[Last Name\]/gi, senderLastName ? ` ${senderLastName}` : '')
    .replace(/\[City\]/gi, replacements.city)
    .replace(/\[State\]/gi, replacements.state)
    .replace(/\[Business Position\]/gi, replacements.businessPosition)
    .replace(/\[Office Phone Number\]/gi, replacements.officePhone)
    .replace(/\[LINK\]/gi, calendarUrl || '[LINK]')
    .replace(/\[SELL ONE DAY GUIDE LINK\]/gi, guideUrl || '[SELL ONE DAY GUIDE LINK]')
    .replace(/\[phone\]/gi, senderPhone || '[phone]')
    .replace(/A\s*\[AI-generated[^\]]*\]\s*is an impressive accomplishment\.?/gi, buildVerifiedCompliment(lead))
    .replace(/\[AI-generated[^\]]*\]/gi, '')
}

export function salesLeadEmailTemplateKey(template: 1 | 2, contactType: SalesLeadContactType, part: 'SUBJECT' | 'BODY') {
  return `SALES_LEAD_EMAIL_${template}_${contactType}_${part}`
}

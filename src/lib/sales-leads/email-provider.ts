import { sendEmailWithComposio } from '@/lib/composio'
import { getProjectEnv } from '@/lib/project-env'
import { prisma } from '@/lib/prisma'
import type { SalesLead, SalesLeadContactType } from '@prisma/client'

type EmailLead = Pick<
  SalesLead,
  'businessName' | 'ownerFirstName' | 'ownerLastName' | 'ownerEmail' | 'emailType' | 'city' | 'state'
>

export class SalesLeadEmailConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesLeadEmailConfigurationError'
  }
}

function templateKey(template: 1 | 2, contactType: SalesLeadContactType, part: 'SUBJECT' | 'BODY') {
  return `SALES_LEAD_EMAIL_${template}_${contactType}_${part}`
}

function interpolate(value: string, lead: EmailLead) {
  const replacements: Record<string, string> = {
    businessName: lead.businessName,
    ownerFirstName: lead.ownerFirstName || '',
    ownerLastName: lead.ownerLastName || '',
    city: lead.city || '',
    state: lead.state || '',
  }
  return value.replace(/\{\{(\w+)\}\}/g, (_match, key) => replacements[key] ?? '')
}

export function buildSalesLeadEmailDraft(lead: EmailLead, templateNum: 1 | 2) {
  const defaultSubject = templateNum === 1
    ? `Inquiry regarding ${lead.businessName}`
    : `Following up: Cantara Pet Business Advisory & ${lead.businessName}`
  const defaultBody = templateNum === 1
    ? `Hello ${lead.ownerFirstName || 'there'},\n\nWe are reaching out from Cantara regarding ${lead.businessName}. We assist pet resort owners with confidential exit and growth readiness.\n\nBest regards,\nCantara Pet Advisors`
    : `Hello ${lead.ownerFirstName || 'there'},\n\nFollowing up on our previous note regarding ${lead.businessName}. We would love to share insights tailored for independent operators in ${lead.city || 'your area'}.\n\nBest regards,\nCantara Pet Advisors`
  return {
    subject: interpolate(getProjectEnv(templateKey(templateNum, lead.emailType, 'SUBJECT')) || defaultSubject, lead),
    body: interpolate(getProjectEnv(templateKey(templateNum, lead.emailType, 'BODY')) || defaultBody, lead),
  }
}

export async function sendSalesLeadEmail(
  arg1: EmailLead | { leadId: string; toEmail: string; emailType: 'EMAIL_1' | 'EMAIL_2' },
  arg2?: 1 | 2,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    let lead: EmailLead | null = null
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

    const { subject, body } = buildSalesLeadEmailDraft(lead, templateNum)

    const data = await sendEmailWithComposio({
      to: lead.ownerEmail,
      displayName: [lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') || lead.businessName,
      subject,
      body,
    })

    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to dispatch email via Composio' }
  }
}

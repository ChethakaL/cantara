import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getProjectEnv } from '@/lib/project-env'
import { SalesLeadStage } from '@prisma/client'
import { approveSalesLeadEmail, requestSalesLeadEmailApproval } from '@/lib/sales-leads/service'

export const dynamic = 'force-dynamic'

function interpolate(value: string, lead: any) {
  const replacements: Record<string, string> = {
    businessName: lead.businessName || '',
    ownerFirstName: lead.ownerFirstName || '',
    ownerLastName: lead.ownerLastName || '',
    city: lead.city || '',
    state: lead.state || '',
  }
  return value.replace(/\{\{(\w+)\}\}/g, (_match, key) => replacements[key] ?? '')
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await prisma.salesLead.findUnique({ where: { id: params.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const stage = lead.currentStage
    const templateNum = stage === SalesLeadStage.EMAIL_2_DUE || stage === SalesLeadStage.EMAIL_2_SENT ? 2 : 1
    const emailType = lead.emailType || 'GENERAL'

    const defaultSubject =
      templateNum === 1
        ? `Inquiry regarding ${lead.businessName}`
        : `Following up: Cantara Pet Business Advisory & ${lead.businessName}`

    const defaultBody =
      templateNum === 1
        ? `Hello ${lead.ownerFirstName || 'there'},\n\nWe are reaching out from Cantara regarding ${lead.businessName}. We assist pet resort owners with confidential exit and growth readiness.\n\nWould you be open to a brief 10-minute introductory call next week?\n\nBest regards,\nCantara Pet Advisors`
        : `Hello ${lead.ownerFirstName || 'there'},\n\nFollowing up on our previous note regarding ${lead.businessName}. We would love to share insights tailored for independent operators in ${lead.city || 'your area'}.\n\nLet us know if you'd like to review your business readiness assessment.\n\nBest regards,\nCantara Pet Advisors`

    const envSubject = getProjectEnv(`SALES_LEAD_EMAIL_${templateNum}_${emailType}_SUBJECT`)
    const envBody = getProjectEnv(`SALES_LEAD_EMAIL_${templateNum}_${emailType}_BODY`)

    const subject = interpolate(envSubject || defaultSubject, lead)
    const body = interpolate(envBody || defaultBody, lead)

    return NextResponse.json({
      leadId: lead.id,
      businessName: lead.businessName,
      templateNum,
      emailType,
      recipientEmail: lead.ownerEmail || null,
      recipientName: [lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') || lead.businessName,
      subject,
      body,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Draft generation failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { subject, bodyText } = body

    const lead = await prisma.salesLead.findUnique({ where: { id: params.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    if (!lead.ownerEmail) {
      return NextResponse.json({ error: 'Lead has no owner email address' }, { status: 400 })
    }

    const templateNum = lead.currentStage === SalesLeadStage.EMAIL_2_DUE ? 2 : 1

    await requestSalesLeadEmailApproval(lead.id, templateNum as 1 | 2)
    if (subject !== undefined || bodyText !== undefined) {
      await prisma.salesLead.update({
        where: { id: lead.id },
        data: {
          emailDraftSubject: subject === undefined ? undefined : String(subject),
          emailDraftBody: bodyText === undefined ? undefined : String(bodyText),
        },
      })
    }
    const updated = await approveSalesLeadEmail(lead.id, 'Admin')
    return NextResponse.json({ success: true, updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Email sending failed' }, { status: 500 })
  }
}

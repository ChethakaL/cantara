import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SalesLeadStage } from '@prisma/client'
import { approveSalesLeadEmail, requestSalesLeadEmailApproval } from '@/lib/sales-leads/service'
import { buildSalesLeadEmailDraft, SalesLeadEmailConfigurationError } from '@/lib/sales-leads/email-provider'
import { parseEmailList, withoutEmail } from '@/lib/sales-leads/email-recipients'
import { SalesLeadWorkflowError } from '@/lib/sales-leads/workflow'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await prisma.salesLead.findUnique({ where: { id: params.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const stage = lead.currentStage
    const templateNum = stage === SalesLeadStage.EMAIL_2_DUE || stage === SalesLeadStage.EMAIL_2_SENT ? 2 : 1
    const emailType = lead.emailType || 'GENERAL'

    // Re-resolve the asset on every open so changing the assigned lead cannot
    // leave a stale draft from another sender in the drawer.
    const draft = await buildSalesLeadEmailDraft(lead, templateNum)
    await prisma.salesLead.update({ where: { id: lead.id }, data: { emailDraftSubject: draft.subject, emailDraftBody: draft.body } })

    return NextResponse.json({
      leadId: lead.id,
      businessName: lead.businessName,
      templateNum,
      emailType,
      recipientEmail: lead.ownerEmail || null,
      recipientName: [lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ') || lead.businessName,
      subject: draft.subject,
      body: draft.body,
    })
  } catch (error: any) {
    const message = error?.message || 'Draft generation failed'
    console.error('[sales-leads/email-draft GET]', message)
    const status = error instanceof SalesLeadEmailConfigurationError ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { subject, bodyText, extraTo, cc } = body

    const lead = await prisma.salesLead.findUnique({ where: { id: params.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    if (!lead.ownerEmail) {
      return NextResponse.json({ error: 'Lead has no owner email address' }, { status: 400 })
    }

    const recipients = {
      extraTo: withoutEmail(parseEmailList(extraTo), lead.ownerEmail),
      cc: withoutEmail(parseEmailList(cc), lead.ownerEmail),
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
    const updated = await approveSalesLeadEmail(lead.id, 'Admin', recipients)
    return NextResponse.json({ success: true, updated, recipients })
  } catch (error: any) {
    const message = error.message || 'Email sending failed'
    if (error instanceof SalesLeadWorkflowError) {
      return NextResponse.json({ error: message, code: error.code }, { status: 409 })
    }
    console.error('[sales-leads/email-draft]', error)
    const status = /^Invalid email address/i.test(message) ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

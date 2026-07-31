import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SalesLeadStage } from '@prisma/client'
import { approveSalesLeadEmail, requestSalesLeadEmailApproval } from '@/lib/sales-leads/service'
import { buildSalesLeadEmailDraft } from '@/lib/sales-leads/email-provider'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await prisma.salesLead.findUnique({ where: { id: params.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const stage = lead.currentStage
    const templateNum = stage === SalesLeadStage.EMAIL_2_DUE || stage === SalesLeadStage.EMAIL_2_SENT ? 2 : 1
    const emailType = lead.emailType || 'GENERAL'

    // Reuse the saved draft. Opening the drawer must not spend tokens or
    // replace an already-created draft. Generate only when no draft exists.
    const draft = lead.emailDraftSubject && lead.emailDraftBody
      ? { subject: lead.emailDraftSubject, body: lead.emailDraftBody }
      : await buildSalesLeadEmailDraft(lead, templateNum)

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

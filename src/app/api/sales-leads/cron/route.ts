import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SalesLeadStage } from '@prisma/client'
import { requestSalesLeadEmailApproval } from '@/lib/sales-leads/service'
import { syncSalesLeadToMonday } from '@/lib/sales-leads/monday-sync'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
  }

  const now = new Date()
  let advancedCount = 0
  let emailsSent = 0
  let approvalsRequested = 0
  let errors: string[] = []

  try {
    // 1. Advance due email sent leads to due call stages
    const dueForCall1 = await prisma.salesLead.findMany({
      where: {
        currentStage: SalesLeadStage.EMAIL_1_SENT,
        nextActionDate: { lte: now },
      },
    })

    for (const lead of dueForCall1) {
      await prisma.salesLead.update({
        where: { id: lead.id },
        data: { currentStage: SalesLeadStage.CALL_1_DUE, nextActionDate: null },
      })
      await syncSalesLeadToMonday(lead.id).catch(() => {})
      advancedCount++
    }

    const dueForCall2 = await prisma.salesLead.findMany({
      where: {
        currentStage: SalesLeadStage.EMAIL_2_SENT,
        nextActionDate: { lte: now },
      },
    })

    for (const lead of dueForCall2) {
      await prisma.salesLead.update({
        where: { id: lead.id },
        data: { currentStage: SalesLeadStage.CALL_2_DUE, nextActionDate: null },
      })
      await syncSalesLeadToMonday(lead.id).catch(() => {})
      advancedCount++
    }

    // 2. Prepare pending emails for human approval. This endpoint never sends email.
    const pendingEmail1 = await prisma.salesLead.findMany({
      where: { currentStage: SalesLeadStage.EMAIL_1_DUE },
    })

    for (const lead of pendingEmail1) {
      if (lead.ownerEmail) {
        try { await requestSalesLeadEmailApproval(lead.id, 1); approvalsRequested++ }
        catch (error) { errors.push(`Email 1 draft failed for ${lead.businessName}: ${error instanceof Error ? error.message : 'Unknown error'}`) }
      }
    }

    const pendingEmail2 = await prisma.salesLead.findMany({
      where: { currentStage: SalesLeadStage.EMAIL_2_DUE },
    })

    for (const lead of pendingEmail2) {
      if (lead.ownerEmail) {
        try { await requestSalesLeadEmailApproval(lead.id, 2); approvalsRequested++ }
        catch (error) { errors.push(`Email 2 draft failed for ${lead.businessName}: ${error instanceof Error ? error.message : 'Unknown error'}`) }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      advancedCount,
      emailsSent,
      approvalsRequested,
      errorsCount: errors.length,
      errors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Cron execution failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const checks: Record<string, boolean> = {}

  // TTM Analysis — has its own table
  try { checks.ttmAnalysis = !!(await prisma.ttmAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.ttmAnalysis = false }

  // Lease Analysis — has its own table
  try { checks.lease = !!(await prisma.leaseAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.lease = false }

  // Competitor Analysis — has its own table
  try { checks.competitor = !!(await prisma.competitorAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.competitor = false }

  // Employee Obligations — has its own table
  try { checks.employeeObligations = !!(await prisma.employeeObligationsReport.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.employeeObligations = false }

  // Digital Presence — stored in sectionSubmissions (NO dedicated table)
  try {
    const client = await prisma.clientProfile.findFirst({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })
    const submissions = client?.sectionSubmissions as Record<string, unknown> | null
    checks.digitalPresence = Boolean(submissions?.digitalPresence)
  } catch { checks.digitalPresence = false }

  // Org Chart — stored in sectionSubmissions
  try {
    const client = await prisma.clientProfile.findFirst({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })
    const submissions = client?.sectionSubmissions as Record<string, unknown> | null
    checks.orgChart = Boolean(submissions?.orgChart)
  } catch { checks.orgChart = false }

  return NextResponse.json(checks)
}

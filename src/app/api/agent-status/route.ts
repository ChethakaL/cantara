import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const checks: Record<string, boolean> = {}

  try { checks.ttmAnalysis = !!(await (prisma as any).ttmAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.ttmAnalysis = false }
  try { checks.lease = !!(await prisma.leaseAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.lease = false }
  try { checks.competitor = !!(await (prisma as any).competitorAnalysis.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.competitor = false }
  try { checks.employeeObligations = !!(await (prisma as any).employeeObligationsReport.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.employeeObligations = false }
  try { checks.digitalPresence = !!(await (prisma as any).digitalPresenceReport?.findFirst({ where: { clientId }, select: { id: true } })) } catch { checks.digitalPresence = false }
  try { checks.orgChart = !!(await prisma.clientProfile.findFirst({ where: { id: clientId, sectionSubmissions: { not: null } }, select: { sectionSubmissions: true } }).then(r => (r?.sectionSubmissions as any)?.orgChart)) } catch { checks.orgChart = false }

  return NextResponse.json(checks)
}

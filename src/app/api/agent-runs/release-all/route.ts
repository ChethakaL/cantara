import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientWorkstreamAgents, normalizeAgentStatusKey } from '@/lib/workstream-agents'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const fullClient = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { customWorkstream: { include: { agents: true } }, ClientWorkstreamAgents: true },
  })
  if (!fullClient) return new Response('Client not found', { status: 404 })

  const assignedAgents = getClientWorkstreamAgents({
    workstream: (fullClient.workstream?.toLowerCase() as any) ?? null,
    customWorkstream: fullClient.customWorkstream as any,
    workstreamAgents: fullClient.ClientWorkstreamAgents as any,
    propertyOwnership:
      (fullClient.sectionSubmissions as Record<string, unknown> | null)?.propertyOwnership === 'lease' ||
      (fullClient.sectionSubmissions as Record<string, unknown> | null)?.propertyOwnership === 'owns'
        ? ((fullClient.sectionSubmissions as Record<string, unknown>).propertyOwnership as 'lease' | 'owns')
        : '',
    sectionSubmissions: fullClient.sectionSubmissions as any,
  })

  const submissions = (fullClient.sectionSubmissions as Record<string, unknown>) ?? {}
  const approvals = (submissions.agentApprovals as Record<string, unknown>) ?? {}
  const releases = { ...((fullClient.clientRelease as Record<string, unknown>) ?? {}) }

  let releasedCount = 0

  for (const agent of assignedAgents) {
    const agentKey = normalizeAgentStatusKey(agent.agentId)
    const approval = (approvals[agent.agentId] ?? approvals[agentKey]) as { status?: string } | undefined
    const isApproved = approval?.status === 'approved'
    const existingRelease = (releases[agent.agentId] ?? releases[agentKey]) as { released?: boolean } | undefined
    const isAlreadyReleased = existingRelease?.released === true

    if (isApproved && !isAlreadyReleased) {
      const priorSource = existingRelease && ['agent', 'external', 'external_original'].includes(String((existingRelease as any).releaseSource))
        ? (existingRelease as any).releaseSource
        : 'agent'
      let externalReportId = typeof (existingRelease as any)?.externalReportId === 'string'
        ? (existingRelease as any).externalReportId
        : null
      if ((agentKey === 'ttmAnalysis' || agentKey === 'ttm') && priorSource !== 'agent') {
        const report = await (prisma as any).externalValuationReport.findFirst({
          where: { clientId, ...(externalReportId ? { id: externalReportId } : {}) },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
        if (!report) continue
        externalReportId = report.id
      }
      const releaseEntry = {
        ...existingRelease,
        released: true,
        releasedAt: new Date().toISOString(),
        ...(agentKey === 'ttmAnalysis' || agentKey === 'ttm' ? { releaseSource: priorSource, externalReportId } : {}),
      }
      releases[agent.agentId] = releaseEntry
      releases[agentKey] = releaseEntry
      releasedCount++
    }
  }

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: { clientRelease: releases as any },
  })

  return NextResponse.json({ ok: true, releasedCount })
}

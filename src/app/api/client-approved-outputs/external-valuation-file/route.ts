import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isClientPortalAgentReleased } from '@/lib/client-approved-agents'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const reportId = req.nextUrl.searchParams.get('reportId')
  if (!clientId || !reportId) return new Response('clientId and reportId are required', { status: 400 })
  try {
    const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { clientRelease: true } })
    const releases = (client?.clientRelease as Record<string, any>) || {}
    const release = releases.ttmAnalysis ?? releases.ttm
    if (!client || !isClientPortalAgentReleased(releases, 'ttm') || release?.releaseSource !== 'external' || release?.externalReportId !== reportId) {
      return new Response('Report is not available in the client portal', { status: 404 })
    }
    const report = await (prisma as any).externalValuationReport.findFirst({ where: { id: reportId, clientId }, select: { fileName: true, mimeType: true, storageKey: true } })
    if (!report) return new Response('Report file not found', { status: 404 })
    assertS3Configured()
    const object = await s3Client.send(new GetObjectCommand({ Bucket: s3BucketName, Key: report.storageKey }))
    if (!object.Body) return new Response('Report file is empty', { status: 404 })
    const bytes = Buffer.from(await object.Body.transformToByteArray())
    const disposition = req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'
    return new Response(bytes, { headers: { 'Content-Type': report.mimeType, 'Content-Length': String(bytes.length), 'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(report.fileName)}`, 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('[client-approved-outputs/external-valuation-file]', error)
    return new Response('Unable to load report file', { status: 500 })
  }
}

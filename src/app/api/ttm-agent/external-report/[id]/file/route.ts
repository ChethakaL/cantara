import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId is required', { status: 400 })
  try {
    assertS3Configured()
    const report = await prisma.externalValuationReport.findFirst({ where: { id: params.id, clientId }, select: { fileName: true, mimeType: true, storageKey: true } })
    if (!report) return new Response('Report file not found', { status: 404 })
    const object = await s3Client.send(new GetObjectCommand({ Bucket: s3BucketName, Key: report.storageKey }))
    if (!object.Body) return new Response('Report file is empty', { status: 404 })
    const bytes = Buffer.from(await object.Body.transformToByteArray())
    const disposition = req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'
    return new Response(bytes, { headers: { 'Content-Type': report.mimeType, 'Content-Length': String(bytes.length), 'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(report.fileName)}`, 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('[ttm-agent/external-report/file]', error)
    return new Response('Unable to load report file', { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return new Response('clientId is required', { status: 400 })
    }

    const rows = await (prisma as any).clientDocument.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentId: true,
        fileName: true,
        mimeType: true,
        googleDriveFileId: true,
        createdAt: true,
      },
    })

    const byDocumentId: Record<
      string,
      Array<{
        id: string
        fileName: string
        mimeType: string | null
        fileUrl: string | null
        uploadedAt: string
      }>
    > = {}

    for (const row of rows) {
      if (!row.documentId) continue
      const bucket = byDocumentId[row.documentId] ?? (byDocumentId[row.documentId] = [])
      if (bucket.length >= 50) continue
      bucket.push({
        id: row.id,
        fileName: row.fileName,
        mimeType: row.mimeType ?? null,
        fileUrl: row.googleDriveFileId ?? null,
        uploadedAt: row.createdAt.toISOString(),
      })
    }

    return NextResponse.json({ byDocumentId })
  } catch (error) {
    console.error('[client-documents/batch] Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

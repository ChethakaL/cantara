import { NextRequest, NextResponse } from 'next/server'
import { syncClientUploadsDriveStructure } from '@/lib/composio'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function extractDriveFolderId(value: unknown) {
  if (typeof value !== 'string') return null
  const folderMatch = value.match(/\/folders\/([^/?#]+)/)
  if (folderMatch?.[1]) return folderMatch[1]
  return /^[a-zA-Z0-9_-]{10,}$/.test(value.trim()) ? value.trim() : null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        businessName: true,
        driveFolderId: true,
        ClientDocument: {
          select: {
            id: true,
            documentId: true,
            fileName: true,
            mimeType: true,
            localPath: true,
            googleDriveFileId: true,
          },
          orderBy: [{ documentId: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const folderId = extractDriveFolderId(client.driveFolderId)
    if (!folderId) {
      return NextResponse.json(
        { error: 'This client has no Google Drive folder assigned. Create or link a folder in Client Management first.' },
        { status: 400 },
      )
    }

    const documents = (client.ClientDocument ?? []).filter(
      (doc: { localPath?: string | null; googleDriveFileId?: string | null; fileName?: string | null }) =>
        Boolean(doc.fileName && (doc.localPath || doc.googleDriveFileId)),
    )

    const result = await syncClientUploadsDriveStructure({
      clientFolderId: folderId,
      documents,
      scaffoldAllFolders: true,
    })

    return NextResponse.json({
      ok: true,
      clientId,
      documentCount: documents.length,
      ...result,
    })
  } catch (error) {
    console.error('[drive/sync-client-documents]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync client documents to Google Drive' },
      { status: 500 },
    )
  }
}

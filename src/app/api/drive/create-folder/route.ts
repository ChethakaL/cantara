import { NextRequest, NextResponse } from 'next/server'
import { ensureClientDriveFolder } from '@/lib/composio'

function extractDriveFolderId(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const folderMatch = trimmed.match(/\/folders\/([^/?#]+)/)
  if (folderMatch?.[1]) return folderMatch[1]
  const idMatch = trimmed.match(/^[a-zA-Z0-9_-]{10,}$/)
  return idMatch ? trimmed : null
}

export async function POST(req: NextRequest) {
  const { clientName, clientId, parentFolder } = await req.json()
  const folderName = typeof clientName === 'string' ? clientName.trim() : ''
  const parentFolderId = extractDriveFolderId(parentFolder)

  if (!folderName || !clientId || !parentFolderId) {
    return NextResponse.json({ error: 'clientName, clientId, and parentFolder are required' }, { status: 400 })
  }

  try {
    const folder = await ensureClientDriveFolder({ clientName: folderName, clientId, parentFolderId })
    return NextResponse.json({ folderUrl: folder.url, folderId: folder.id })
  } catch (err) {
    console.error('Drive folder creation error:', err)
    return NextResponse.json({ error: 'Google Drive is not connected or folder creation failed' }, { status: 409 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { ensureClientDriveFolder } from '@/lib/composio'

export async function POST(req: NextRequest) {
  const { clientName, clientId } = await req.json()

  if (!clientName || !clientId) {
    return NextResponse.json({ error: 'clientName and clientId are required' }, { status: 400 })
  }

  try {
    const folder = await ensureClientDriveFolder({ clientName, clientId })
    return NextResponse.json({ folderUrl: folder.url, folderId: folder.id })
  } catch (err) {
    console.error('Drive folder creation error:', err)
    return NextResponse.json({ error: 'Google Drive is not connected or folder creation failed' }, { status: 409 })
  }
}

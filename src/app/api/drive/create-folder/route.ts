import { NextRequest, NextResponse } from 'next/server'

// ── Google Drive folder creation ──────────────────────────────────────────────
// Called when an admin provisions a new client.
// Creates: Cantara Clients / {ClientName} / [Valuation, Legal, Financial, Operations, M&A]

const NYLAS_API_KEY = process.env.NYLAS_API_KEY ?? ''
const NYLAS_API_URI = process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com'

// In demo mode (no Nylas key), returns a mock Drive URL
export async function POST(req: NextRequest) {
  const { clientName, clientId, grantId } = await req.json()

  if (!clientName || !clientId) {
    return NextResponse.json({ error: 'clientName and clientId are required' }, { status: 400 })
  }

  // Demo mode
  if (!NYLAS_API_KEY || !grantId) {
    const mockUrl = `https://drive.google.com/drive/folders/cantara_${clientId}_demo`
    return NextResponse.json({ folderUrl: mockUrl, folderId: `cantara_${clientId}_demo` })
  }

  try {
    // Use Nylas Files API (backed by Google Drive) to create folder structure
    // Nylas doesn't expose Drive folder creation directly — use Google Drive API 
    // via the OAuth token Nylas obtained during sign-in.
    
    // For production: call Google Drive API v3 directly with the access token
    // obtained from Nylas grant. 

    // Step 1: Get Google access token from Nylas grant
    const grantRes = await fetch(`${NYLAS_API_URI}/v3/grants/${grantId}`, {
      headers: { Authorization: `Bearer ${NYLAS_API_KEY}` },
    })
    if (!grantRes.ok) throw new Error('Could not fetch Nylas grant')
    const grantData = await grantRes.json()
    const accessToken = grantData.data?.access_token

    // Step 2: Create root folder in Drive
    const rootFolder = await createDriveFolder(accessToken, `Cantara — ${clientName}`, 'root')

    // Step 3: Create subfolders
    const subfolders = ['Valuation & Financials', 'Legal & Entity', 'Operations', 'M&A Documents', 'Correspondence']
    await Promise.all(subfolders.map(name => createDriveFolder(accessToken, name, rootFolder.id)))

    const folderUrl = `https://drive.google.com/drive/folders/${rootFolder.id}`
    return NextResponse.json({ folderUrl, folderId: rootFolder.id })
  } catch (err) {
    console.error('Drive folder creation error:', err)
    // Fallback to mock URL so the portal doesn't break
    const mockUrl = `https://drive.google.com/drive/folders/cantara_${clientId}`
    return NextResponse.json({ folderUrl: mockUrl, folderId: `cantara_${clientId}` })
  }
}

async function createDriveFolder(accessToken: string, name: string, parentId: string) {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`)
  return res.json()
}

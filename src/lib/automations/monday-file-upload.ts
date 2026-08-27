import { getMondayAuthHeader } from '@/lib/composio/monday-api'

/**
 * Upload a file into a Monday file column (add_file_to_column).
 * Uses direct Monday API multipart — not Composio proxy.
 */
export async function uploadFileToMondayColumn(args: {
  itemId: string
  columnId: string
  fileName: string
  bytes: Buffer
  mimeType?: string
}): Promise<{ ok: boolean; assetId?: string; error?: string }> {
  const authHeader = await getMondayAuthHeader()
  if (!authHeader) {
    return { ok: false, error: 'No Monday access token available from Composio connection' }
  }

  const query = `mutation ($file: File!) {
    add_file_to_column (item_id: ${JSON.stringify(String(args.itemId))}, column_id: ${JSON.stringify(String(args.columnId))}, file: $file) {
      id
    }
  }`

  const form = new FormData()
  form.append('query', query)
  form.append('map', JSON.stringify({ file: 'variables.file' }))
  // Node 18+: File is available globally; fall back to Blob.
  const filePart =
    typeof File !== 'undefined'
      ? new File([args.bytes], args.fileName, { type: args.mimeType || 'application/pdf' })
      : new Blob([args.bytes], { type: args.mimeType || 'application/pdf' })
  form.append('file', filePart, args.fileName)

  const res = await fetch('https://api.monday.com/v2/file', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'API-Version': '2024-01',
    },
    body: form,
    cache: 'no-store',
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || (Array.isArray(json?.errors) && json.errors.length)) {
    return {
      ok: false,
      error: JSON.stringify(json?.errors || json || { status: res.status }),
    }
  }

  const assetId = json?.data?.add_file_to_column?.id
  return { ok: true, assetId: assetId ? String(assetId) : undefined }
}

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { assertS3Configured, buildPublicFileUrl, s3BucketName, s3Client } from '@/lib/s3'

const MAX_DOCUMENTS = 8
const MAX_BYTES = 15 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    assertS3Configured()
    const form = await req.formData()
    const clientId = String(form.get('clientId') || '').trim()
    const files = form.getAll('files').filter((value): value is File => value instanceof File && value.size > 0)
    if (!clientId || !files.length) return new Response('Client and supporting files are required', { status: 400 })
    if (files.length > MAX_DOCUMENTS) return new Response(`Maximum ${MAX_DOCUMENTS} supporting documents`, { status: 400 })

    const uploaded = []
    for (const file of files) {
      if (file.size > MAX_BYTES) return new Response(`${file.name} exceeds the 15 MB limit`, { status: 400 })
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const key = `clients/${clientId}/facility-review/supporting-documents/${Date.now()}-${safeName}`
      await s3Client.send(new PutObjectCommand({
        Bucket: s3BucketName,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type || 'application/octet-stream',
      }))
      uploaded.push({ fileName: file.name, fileUrl: buildPublicFileUrl(key), key, uploadedAt: new Date().toISOString() })
    }
    return NextResponse.json({ files: uploaded })
  } catch (error) {
    console.error('[facility-review/supporting-documents] upload error:', error)
    return new Response('Unable to save supporting documents', { status: 500 })
  }
}

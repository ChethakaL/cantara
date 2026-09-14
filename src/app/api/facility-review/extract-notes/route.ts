import { NextRequest, NextResponse } from 'next/server'
import { extractTranscriptText } from '@/lib/sales-review/analyze'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_FILE_BYTES = 15 * 1024 * 1024

function isAllowedNotesFile(file: File) {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return (
    name.endsWith('.pdf')
    || name.endsWith('.docx')
    || name.endsWith('.txt')
    || type === 'application/pdf'
    || type.includes('wordprocessingml')
    || type.startsWith('text/')
  )
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return new Response('Upload a meeting notes file (PDF, DOCX, or TXT)', { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return new Response('Meeting notes file exceeds 15 MB limit', { status: 400 })
    }
    if (!isAllowedNotesFile(file)) {
      return new Response('Unsupported file type. Upload PDF, DOCX, or TXT.', { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = (await extractTranscriptText(buffer, file.type || '', file.name)).trim()
    if (!text) {
      return new Response('Could not extract any text from that file', { status: 400 })
    }

    return NextResponse.json({
      fileName: file.name,
      text,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to extract meeting notes'
    console.error('[facility-review/extract-notes] error:', error)
    return new Response(message, { status: 500 })
  }
}

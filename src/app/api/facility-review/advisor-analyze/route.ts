import { NextRequest, NextResponse } from 'next/server'
import { analyzeAdvisorFacilityReview } from '@/lib/facility-review/analyze'
import { extractTranscriptText } from '@/lib/sales-review/analyze'
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider'

export const maxDuration = 180

const MAX_IMAGES = 20
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_NOTES_FILE_BYTES = 15 * 1024 * 1024
const MAX_SUPPORTING_DOCS = 8
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type AttachedDocument = {
  fileName: string
  base64: string
  mediaType: 'application/pdf' | 'text/plain'
}

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

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isTxt(file: File) {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return name.endsWith('.txt') || type === 'text/plain' || (type.startsWith('text/') && !name.endsWith('.docx'))
}

function isDocx(file: File) {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return name.endsWith('.docx') || type.includes('wordprocessingml')
}

/** Claude/Bedrock document blocks accept PDF and plain text natively — always attach files that way. */
async function toAttachedDocument(file: File): Promise<AttachedDocument> {
  const buffer = Buffer.from(await file.arrayBuffer())

  if (isPdf(file)) {
    return {
      fileName: file.name,
      mediaType: 'application/pdf',
      base64: buffer.toString('base64'),
    }
  }

  if (isTxt(file)) {
    return {
      fileName: file.name,
      mediaType: 'text/plain',
      base64: buffer.toString('base64'),
    }
  }

  if (isDocx(file)) {
    // DOCX is not a native Claude document media type — convert once to a text/plain document attachment.
    let extracted = ''
    try {
      extracted = (await extractTranscriptText(buffer, file.type || '', file.name)).trim()
    } catch (err) {
      console.warn('[facility-review/advisor-analyze] docx convert failed:', file.name, err)
    }
    if (!extracted) {
      throw new Error(
        `Could not read DOCX "${file.name}" for AI attachment. Re-save as PDF or TXT, then upload again.`,
      )
    }
    return {
      fileName: `${file.name}.txt`,
      mediaType: 'text/plain',
      base64: Buffer.from(extracted, 'utf8').toString('base64'),
    }
  }

  throw new Error(`${file.name}: unsupported type. Upload PDF, DOCX, or TXT.`)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const businessName = String(formData.get('businessName') || '').trim()
    const location = String(formData.get('location') || '').trim()
    let meetingNotes = String(formData.get('meetingNotes') || '').trim()
    const notesFileRaw = formData.get('meetingNotesFile')
    const notesFile = notesFileRaw instanceof File && notesFileRaw.size > 0 ? notesFileRaw : null
    const files = formData.getAll('images').filter((item): item is File => item instanceof File)
    const supportingFiles = formData
      .getAll('supportingDocuments')
      .filter((item): item is File => item instanceof File && item.size > 0)

    if (!businessName) return new Response('Business name is required', { status: 400 })
    if (!meetingNotes && !notesFile) {
      return new Response('Paste meeting notes or upload a meeting notes document', { status: 400 })
    }
    if (files.length > MAX_IMAGES) return new Response(`Maximum ${MAX_IMAGES} images per run`, { status: 400 })
    if (supportingFiles.length > MAX_SUPPORTING_DOCS) {
      return new Response(`Maximum ${MAX_SUPPORTING_DOCS} supporting documents per run`, { status: 400 })
    }

    let notesDocument: AttachedDocument | undefined
    const supportingDocuments: AttachedDocument[] = []

    if (notesFile) {
      if (notesFile.size > MAX_NOTES_FILE_BYTES) {
        return new Response('Meeting notes file exceeds 15 MB limit', { status: 400 })
      }
      if (!isAllowedNotesFile(notesFile)) {
        return new Response('Unsupported meeting notes file type. Upload PDF, DOCX, or TXT.', { status: 400 })
      }

      const buffer = Buffer.from(await notesFile.arrayBuffer())
      let extracted = ''
      try {
        extracted = (await extractTranscriptText(buffer, notesFile.type || '', notesFile.name)).trim()
      } catch (err) {
        console.warn('[facility-review/advisor-analyze] notes extract failed:', err)
      }

      if (extracted) {
        meetingNotes = meetingNotes
          ? `${meetingNotes}\n\n---\nUploaded meeting notes (${notesFile.name}):\n${extracted}`
          : extracted
      }

      // Always attach meeting-notes PDF/TXT as a native document when possible.
      if (isPdf(notesFile)) {
        notesDocument = {
          fileName: notesFile.name,
          mediaType: 'application/pdf',
          base64: buffer.toString('base64'),
        }
        if (!meetingNotes) {
          meetingNotes = `Uploaded meeting notes document attached: ${notesFile.name}. Read the attached PDF and use it as the advisor visit notes.`
        }
      } else if (isTxt(notesFile)) {
        notesDocument = {
          fileName: notesFile.name,
          mediaType: 'text/plain',
          base64: buffer.toString('base64'),
        }
        if (!meetingNotes) {
          meetingNotes = `Uploaded meeting notes document attached: ${notesFile.name}. Read the attached text document and use it as the advisor visit notes.`
        }
      } else if (!meetingNotes) {
        return new Response(
          'Could not read text from the uploaded meeting notes file. Please paste the notes into the text area, or upload a text-based PDF/DOCX/TXT.',
          { status: 400 },
        )
      }
    }

    for (const file of supportingFiles) {
      if (file.size > MAX_NOTES_FILE_BYTES) {
        return new Response(`${file.name}: supporting document exceeds 15 MB limit`, { status: 400 })
      }
      if (!isAllowedNotesFile(file)) {
        return new Response(`${file.name}: unsupported type. Upload PDF, DOCX, or TXT.`, { status: 400 })
      }
      supportingDocuments.push(await toAttachedDocument(file))
    }

    const images = await Promise.all(files.map(async (file) => {
      if (!ALLOWED_TYPES.has(file.type)) throw new Error(`${file.name}: unsupported image type`)
      if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: image exceeds 5 MB limit`)
      const buffer = Buffer.from(await file.arrayBuffer())
      return {
        fileName: file.name,
        mediaType: file.type,
        base64: buffer.toString('base64'),
      }
    }))

    const provider = parseAnalyzeProvider(formData.get('provider'))
    const modelId = resolveAnalyzeModelId(provider, formData.get('modelId'))
    if (provider === 'openai') {
      const gate = await assertOpenAiConfiguredForAnalyze()
      if (gate) return gate
    }

    const report = await analyzeAdvisorFacilityReview({
      businessName,
      location,
      meetingNotes,
      images,
      notesDocument,
      supportingDocuments: supportingDocuments.length ? supportingDocuments : undefined,
      provider,
      modelId,
    })
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[facility-review/advisor-analyze] error:', error)
    return new Response(error?.message || 'Internal Server Error', { status: 500 })
  }
}

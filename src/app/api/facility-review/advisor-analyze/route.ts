import { NextRequest, NextResponse } from 'next/server'
import { analyzeAdvisorFacilityReview } from '@/lib/facility-review/analyze'
import { extractTranscriptText } from '@/lib/sales-review/analyze'

export const maxDuration = 180

const MAX_IMAGES = 20
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_NOTES_FILE_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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
    const businessName = String(formData.get('businessName') || '').trim()
    const location = String(formData.get('location') || '').trim()
    let meetingNotes = String(formData.get('meetingNotes') || '').trim()
    const notesFileRaw = formData.get('meetingNotesFile')
    const notesFile = notesFileRaw instanceof File && notesFileRaw.size > 0 ? notesFileRaw : null
    const files = formData.getAll('images').filter((item): item is File => item instanceof File)

    if (!businessName) return new Response('Business name is required', { status: 400 })
    if (!meetingNotes && !notesFile) {
      return new Response('Paste meeting notes or upload a meeting notes document', { status: 400 })
    }
    if (files.length > MAX_IMAGES) return new Response(`Maximum ${MAX_IMAGES} images per run`, { status: 400 })

    let notesDocument: { fileName: string; base64: string; mediaType: 'application/pdf' } | undefined

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
      } else if (
        notesFile.type === 'application/pdf'
        || notesFile.name.toLowerCase().endsWith('.pdf')
      ) {
        // Scanned / image-based PDFs often have no extractable text — send the PDF to the model.
        notesDocument = {
          fileName: notesFile.name,
          mediaType: 'application/pdf',
          base64: buffer.toString('base64'),
        }
        if (!meetingNotes) {
          meetingNotes = `Uploaded meeting notes document attached: ${notesFile.name}. Extract text/content from the attached PDF and use it as the advisor visit notes.`
        }
      } else if (!meetingNotes) {
        return new Response(
          'Could not read text from the uploaded meeting notes file. Please paste the notes into the text area, or upload a text-based PDF/DOCX/TXT.',
          { status: 400 },
        )
      }
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

    const report = await analyzeAdvisorFacilityReview({
      businessName,
      location,
      meetingNotes,
      images,
      notesDocument,
    })
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[facility-review/advisor-analyze] error:', error)
    return new Response(error?.message || 'Internal Server Error', { status: 500 })
  }
}

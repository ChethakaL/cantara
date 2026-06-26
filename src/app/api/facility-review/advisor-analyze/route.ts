import { NextRequest, NextResponse } from 'next/server'
import { analyzeAdvisorFacilityReview } from '@/lib/facility-review/analyze'

export const maxDuration = 180

const MAX_IMAGES = 20
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const businessName = String(formData.get('businessName') || '').trim()
    const location = String(formData.get('location') || '').trim()
    const meetingNotes = String(formData.get('meetingNotes') || '').trim()
    const files = formData.getAll('images').filter((item): item is File => item instanceof File)

    if (!businessName) return new Response('Business name is required', { status: 400 })
    if (!meetingNotes) {
      return new Response('Meeting notes / visit observations are required', { status: 400 })
    }
    if (files.length > MAX_IMAGES) return new Response(`Maximum ${MAX_IMAGES} images per run`, { status: 400 })

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

    const report = await analyzeAdvisorFacilityReview({ businessName, location, meetingNotes, images })
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[facility-review/advisor-analyze] error:', error)
    return new Response(error?.message || 'Internal Server Error', { status: 500 })
  }
}

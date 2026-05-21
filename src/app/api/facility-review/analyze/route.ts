import { NextRequest, NextResponse } from 'next/server'
import { analyzeFacilityImages } from '@/lib/facility-review/analyze'

export const maxDuration = 180

const MAX_IMAGES = 30
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const businessName = String(formData.get('businessName') || '').trim()
    const location = String(formData.get('location') || '').trim()
    const notes = String(formData.get('notes') || '').trim()
    const files = formData.getAll('images').filter((item): item is File => item instanceof File)
    const imageSections = formData.getAll('imageSections').map(section => String(section || '').trim())

    if (!businessName) return new Response('Business name is required', { status: 400 })
    if (files.length > MAX_IMAGES) return new Response(`Maximum ${MAX_IMAGES} images per run`, { status: 400 })

    const images = await Promise.all(files.map(async (file, index) => {
      if (!ALLOWED_TYPES.has(file.type)) throw new Error(`${file.name}: unsupported image type`)
      if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: image exceeds 5 MB limit`)
      const buffer = Buffer.from(await file.arrayBuffer())
      const section = imageSections[index] || 'Uncategorized facility image'
      return {
        fileName: `${section}: ${file.name}`,
        mediaType: file.type,
        base64: buffer.toString('base64'),
      }
    }))

    const report = await analyzeFacilityImages({ businessName, location, notes, images })
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('[facility-review] analysis error:', error)
    return new Response(error?.message || 'Internal Server Error', { status: 500 })
  }
}

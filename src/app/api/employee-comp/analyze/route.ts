import { NextRequest, NextResponse } from 'next/server'
import { analyzePayrollDocument } from '@/lib/employee-comp/analyze'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    // JSON body — free-text mode
    if (contentType.includes('application/json')) {
      const { freeText } = await req.json()
      if (!freeText || typeof freeText !== 'string') {
        return new Response('freeText is required', { status: 400 })
      }
      const result = await analyzePayrollDocument({ freeText })
      return NextResponse.json(result)
    }

    // FormData — file upload mode
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return new Response('No file provided', { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mediaType = file.type || 'application/octet-stream'

    const result = await analyzePayrollDocument({
      fileName: file.name,
      base64,
      mediaType,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Employee comp analysis error:', error)
    return new Response(error?.message || 'Internal Server Error', { status: 500 })
  }
}

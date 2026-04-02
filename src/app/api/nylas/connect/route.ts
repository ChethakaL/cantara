import { NextRequest, NextResponse } from 'next/server'
import { buildNylasAuthUrl, isNylasConfigured } from '@/lib/nylas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isNylasConfigured()) {
    return NextResponse.json({ error: 'Nylas is not configured.' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider') || undefined
  const returnTo = searchParams.get('returnTo') || '/admin'
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url')

  return NextResponse.json({
    url: buildNylasAuthUrl({ provider: provider || undefined, state }),
  })
}

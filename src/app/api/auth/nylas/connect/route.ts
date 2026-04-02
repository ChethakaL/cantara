import { NextRequest, NextResponse } from 'next/server'
import { getProjectEnv } from '@/lib/project-env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Nylas OAuth flow for admin Google sign-in ──────────────────────────────
// Production flow:
// 1. Admin clicks "Continue with Google"
// 2. This endpoint builds the Nylas hosted auth URL
// 3. Admin grants Google access → Nylas callback at /api/auth/nylas/callback
// 4. Nylas stores Google OAuth tokens → we use them for Drive operations

const NYLAS_CLIENT_ID = getProjectEnv('NYLAS_CLIENT_ID') ?? ''
const NYLAS_API_URI = getProjectEnv('NYLAS_API_URI') ?? 'https://api.us.nylas.com'
const APP_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

export async function GET(req: NextRequest) {
  if (!NYLAS_CLIENT_ID) {
    // Dev/demo mode: skip OAuth, set session directly
    const res = NextResponse.redirect(new URL('/admin', req.url))
    res.cookies.set('cantara_role', 'admin', { httpOnly: true, sameSite: 'lax' })
    return res
  }

  // Build Nylas hosted auth URL
  const params = new URLSearchParams({
    client_id: NYLAS_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/auth/nylas/callback`,
    response_type: 'code',
    access_type: 'offline',
    // Request Google Drive scope via Nylas
    provider: 'google',
    scopes: 'openid email profile https://www.googleapis.com/auth/drive',
  })

  const authUrl = `${NYLAS_API_URI}/v3/connect/auth?${params.toString()}`
  return NextResponse.redirect(authUrl)
}

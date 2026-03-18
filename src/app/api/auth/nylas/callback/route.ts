import { NextRequest, NextResponse } from 'next/server'

const NYLAS_CLIENT_ID = process.env.NYLAS_CLIENT_ID ?? ''
const NYLAS_CLIENT_SECRET = process.env.NYLAS_CLIENT_SECRET ?? ''
const NYLAS_API_KEY = process.env.NYLAS_API_KEY ?? ''
const NYLAS_API_URI = process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com'
const APP_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/login/admin?error=oauth_failed', req.url))
  }

  try {
    // Exchange code for Nylas grant (which contains Google OAuth tokens)
    const tokenRes = await fetch(`${NYLAS_API_URI}/v3/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: NYLAS_CLIENT_ID,
        client_secret: NYLAS_CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/auth/nylas/callback`,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error('Token exchange failed')
    }

    const { grant_id, email } = await tokenRes.json()

    // Get user info from Nylas
    const meRes = await fetch(`${NYLAS_API_URI}/v3/grants/${grant_id}/calendar`, {
      headers: { Authorization: `Bearer ${NYLAS_API_KEY}` },
    })

    // Set session cookie
    const res = NextResponse.redirect(new URL('/admin', req.url))
    res.cookies.set('cantara_role', 'admin', { httpOnly: true, sameSite: 'lax', secure: true })
    res.cookies.set('cantara_nylas_grant', grant_id, { httpOnly: true, sameSite: 'lax', secure: true })
    res.cookies.set('cantara_admin_email', email ?? '', { httpOnly: false, sameSite: 'lax' })

    return res
  } catch (err) {
    console.error('Nylas callback error:', err)
    return NextResponse.redirect(new URL('/login/admin?error=callback_failed', req.url))
  }
}

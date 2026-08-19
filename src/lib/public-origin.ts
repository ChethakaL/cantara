import type { NextRequest } from 'next/server'

function isPrivateHost(host: string) {
  const hostname = host.split(':')[0].toLowerCase()
  return hostname === '0.0.0.0' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function envOrigin() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXTAUTH_URL || ''
  return raw.replace(/\/$/, '')
}

export function publicAppOrigin(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  if (forwardedHost && !isPrivateHost(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`
  }

  const originHeader = req.headers.get('origin')?.trim()
  if (originHeader) {
    try {
      const parsed = new URL(originHeader)
      if (!isPrivateHost(parsed.host)) return parsed.origin
    } catch {
      // ignore invalid Origin
    }
  }

  const requestHost = req.headers.get('host')?.split(',')[0]?.trim()
  if (requestHost && !isPrivateHost(requestHost)) {
    return `${forwardedProto}://${requestHost}`
  }

  const configured = envOrigin()
  if (configured) {
    try {
      if (!isPrivateHost(new URL(configured).host)) return configured
    } catch {
      // ignore invalid APP_URL / NEXTAUTH_URL
    }
  }

  return new URL(req.url).origin
}

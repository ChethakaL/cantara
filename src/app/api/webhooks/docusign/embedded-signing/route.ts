import { NextRequest, NextResponse } from 'next/server'
import { runEmbeddedSigning } from '@/lib/automations/docusign/embedded-signing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Make: When user clicks “Review & Signing NDA” in Gmail → embedded DocuSign.
 *
 *   GET /api/webhooks/docusign/embedded-signing
 *     ?envelope=...
 *     &itemId=...
 *     &boardId=...
 *     &role=Client|CEO
 *
 * Dry-run default: returns JSON plan (no DocuSign redirect).
 * Live: 302 Location = DocuSign recipient view URL.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const envelopeId = (searchParams.get('envelope') || searchParams.get('envelopeId') || '').trim()
  const itemId = (searchParams.get('itemId') || '').trim() || null
  const boardId = (searchParams.get('boardId') || '').trim() || null
  const role = (searchParams.get('role') || 'Client').trim() || 'Client'
  const forceLive = searchParams.get('forceLive') === '1' || searchParams.get('live') === '1'

  const result = await runEmbeddedSigning({
    envelopeId,
    itemId,
    boardId,
    role,
    forceLive,
  })

  // Dry-run: never redirect — return plan for inspection.
  if (result.dryRun) {
    return NextResponse.json({
      ok: result.ok,
      dryRun: true,
      message:
        'Dry-run: would fetch recipients, pick signer by role, create recipient view, and 302 redirect. Set AUTOMATIONS_EMBEDDED_SIGNING_DRY_RUN=false (or ?forceLive=1) for live redirect.',
      query: { envelope: envelopeId || null, itemId, boardId, role },
      planned: result.planned,
      error: result.error || null,
    })
  }

  if (!result.ok || !result.signingUrl) {
    // Prefer a simple HTML error page for browser clicks (not raw JSON).
    const body = `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
      <h1>Signing link unavailable</h1>
      <p>${escapeHtml(result.error || 'Could not create DocuSign signing URL.')}</p>
      <p style="color:#64748b;font-size:14px">envelope=${escapeHtml(envelopeId)} · role=${escapeHtml(role)}</p>
      ${result.mondayErrorLogged ? '<p>Monday status was set to Error - See Update.</p>' : ''}
    </body></html>`
    return new NextResponse(body, {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return NextResponse.redirect(result.signingUrl, 302)
}

export async function POST(req: NextRequest) {
  // Allow same query via POST body for test harnesses.
  const body = await req.json().catch(() => ({}))
  const url = req.nextUrl.clone()
  if (body.envelope || body.envelopeId) {
    url.searchParams.set('envelope', String(body.envelope || body.envelopeId))
  }
  if (body.itemId) url.searchParams.set('itemId', String(body.itemId))
  if (body.boardId) url.searchParams.set('boardId', String(body.boardId))
  if (body.role) url.searchParams.set('role', String(body.role))
  if (body.forceLive) url.searchParams.set('forceLive', '1')
  return GET(new NextRequest(url, { method: 'GET' }))
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

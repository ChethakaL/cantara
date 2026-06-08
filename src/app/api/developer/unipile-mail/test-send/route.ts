import { NextRequest, NextResponse } from 'next/server'
import { requireDeveloperSecret } from '@/lib/developer-auth'
import { getComposioMailConnection, sendEmailWithComposio } from '@/lib/composio'
import { getStoredComposioMailConnectedAccountId } from '@/lib/secure-settings'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get('x-developer-secret'))
  if (!auth.ok) return new Response(auth.message, { status: auth.status })

  try {
    const { to } = await req.json() as { to?: string }
    if (!to?.includes('@')) {
      return new Response('Provide a valid "to" email in the JSON body.', { status: 400 })
    }

    const accountId = await getStoredComposioMailConnectedAccountId()
    if (!accountId) {
      return new Response('No connected mailbox. Connect sender first.', { status: 400 })
    }

    const account = await getComposioMailConnection(accountId).catch(error => ({
      error: error instanceof Error ? error.message : 'Account lookup failed',
    }))

    await sendEmailWithComposio({
      to,
      displayName: to,
      subject: 'Cantara mail test',
      body: '<p>This is a test email from Cantara. If you received this, Composio mail is working.</p>',
    })

    return NextResponse.json({
      ok: true,
      message: `Test email sent to ${to}`,
      account,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Test send failed',
      },
      { status: 502 },
    )
  }
}

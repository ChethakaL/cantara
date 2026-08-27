import { NextResponse } from 'next/server'
import { listCatalogAutomations } from '@/lib/automations/catalog'
import { publicAppOrigin } from '@/lib/public-origin'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const origin = publicAppOrigin(req)
  const items = listCatalogAutomations().map(a => ({
    ...a,
    webhookUrl: `${origin}/api/webhooks/${a.webhookSlug}`,
  }))
  return NextResponse.json({ automations: items })
}

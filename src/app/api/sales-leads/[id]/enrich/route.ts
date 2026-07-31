import { NextRequest, NextResponse } from 'next/server'
import { generateProspectResearch } from '@/lib/sales-leads/prospect-research'

export const dynamic = 'force-dynamic'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updated = await generateProspectResearch(params.id)
    return NextResponse.json({ success: true, report: updated.aiResearchReport })
  } catch (error: any) {
    console.error('[sales-leads/enrich] Error:', error)
    return NextResponse.json({ error: error.message || 'AI Prospect Research failed' }, { status: 500 })
  }
}

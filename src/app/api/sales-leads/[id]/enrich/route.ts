import { NextRequest, NextResponse } from 'next/server'
import { generateProspectResearch, saveProspectResearchToGoogleDoc } from '@/lib/sales-leads/prospect-research'

export const dynamic = 'force-dynamic'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updated = await generateProspectResearch(params.id)
    const saved = await saveProspectResearchToGoogleDoc(params.id)
    return NextResponse.json({ success: true, report: saved.aiResearchReport, preCallBriefUrl: saved.preCallBriefUrl })
  } catch (error: any) {
    console.error('[sales-leads/enrich] Error:', error)
    return NextResponse.json({ error: error.message || 'AI Prospect Research failed' }, { status: 500 })
  }
}

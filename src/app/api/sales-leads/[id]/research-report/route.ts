import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveProspectResearchToGoogleDoc } from '@/lib/sales-leads/prospect-research'

export const dynamic = 'force-dynamic'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const updated = await saveProspectResearchToGoogleDoc(params.id)
    return NextResponse.json({ success: true, preCallBriefUrl: updated.preCallBriefUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not recreate Google Doc.' }, { status: 500 })
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const lead = await prisma.salesLead.findUnique({ where: { id: params.id }, select: { businessName: true, aiResearchReport: true, updatedAt: true } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  const report = (lead.aiResearchReport || {}) as Record<string, unknown>
  const escape = (value: unknown) => String(value ?? 'Not specified').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char] || char))
  const rows = Object.entries(report).map(([key, value]) => `<section><h2>${escape(key.replace(/[A-Z]/g, letter => ` ${letter}`).replace(/^./, letter => letter.toUpperCase()))}</h2><p>${escape(value)}</p></section>`).join('')
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Prospect Research — ${escape(lead.businessName)}</title><style>body{font-family:system-ui;max-width:850px;margin:40px auto;padding:0 24px;color:#20243a;background:#f7f7fb}main{background:white;padding:32px;border-radius:16px;box-shadow:0 4px 20px #0001}h1{margin-top:0}h2{font-size:14px;text-transform:capitalize;color:#68708a;margin-bottom:6px}p{white-space:pre-wrap;line-height:1.55;margin-top:0}</style></head><body><main><h1>${escape(lead.businessName)} — Prospect Research</h1><p>Updated ${escape(lead.updatedAt.toISOString())}</p>${rows}</main></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

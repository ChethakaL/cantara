import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function label(key: string) {
  return key.replace(/[A-Z]/g, letter => ` ${letter}`).replace(/^./, letter => letter.toUpperCase())
}

export default async function ResearchReportPage({ params }: { params: { leadId: string } }) {
  const lead = await prisma.salesLead.findUnique({
    where: { id: params.leadId },
    select: { businessName: true, city: true, state: true, websiteUrl: true, aiResearchReport: true, updatedAt: true },
  })
  if (!lead || !lead.aiResearchReport) notFound()
  const report = lead.aiResearchReport as Record<string, unknown>

  return (
    <main className="min-h-screen bg-[#f5f6f8] px-5 py-10 text-[#20263b]">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_18px_60px_rgba(32,38,59,0.12)]">
        <header className="bg-[#20263b] px-8 py-10 text-white md:px-12">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d2ad70]">Cantara Pet Advisors</div>
            <div className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70">Confidential</div>
          </div>
          <p className="mb-3 text-sm font-medium text-[#d2ad70]">Prospect intelligence brief</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{lead.businessName}</h1>
          <p className="mt-4 text-sm text-white/70">{[lead.city, lead.state].filter(Boolean).join(', ') || 'Location not specified'}{lead.websiteUrl ? ` · ${lead.websiteUrl}` : ''}</p>
        </header>
        <section className="px-8 py-10 md:px-12">
          <div className="mb-8 border-b border-slate-200 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Research summary</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">Prepared for Cantara’s sales outreach workflow. Use this brief as background context for the first conversation.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {Object.entries(report).map(([key, value]) => (
              <section key={key} className={`${key === 'businessProfileSummary' || key === 'tierReasoning' ? 'md:col-span-2' : ''} rounded-2xl border border-slate-200 bg-slate-50/70 p-5`}>
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7946]">{label(key)}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{String(value ?? 'Not specified')}</p>
              </section>
            ))}
          </div>
          <p className="mt-8 text-xs text-slate-400">Last updated {lead.updatedAt.toISOString()}</p>
        </section>
      </article>
    </main>
  )
}

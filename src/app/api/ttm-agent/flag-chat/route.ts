import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTtmAnalysis, actionWs2RecastFlag } from '@/lib/ttm-agent/orchestrator'
import { llmContextFromStoredAnalysis, runWithAgentLlmContext } from '@/lib/agent-llm-context'
import { createAgentMessage } from '@/lib/llm-completion'

export const maxDuration = 120

const SYSTEM = `You are Cantara's valuation review assistant. Answer questions about one valuation flag using only the supplied analysis context. Explain the source, reasoning, and impact plainly. If the user asks to correct the result, propose one safe structured action. Never invent source data. Return JSON only with this shape: {"answer": string, "canApply": boolean, "action": "RESOLVE"|"ESCALATE_CLIENT"|"OVERRIDE"|null, "overrideAmount": number|null, "payloadPatch": object, "notes": string}. Use RESOLVE to keep the item, ESCALATE_CLIENT to remove/escalate it, and OVERRIDE only when a replacement numeric amount is explicitly supported.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const analysis = await getTtmAnalysis(String(body.analysisId || ''))
    const flagId = String(body.flagId || '')
    const question = String(body.question || '').trim()
    if (!analysis || !flagId || !question) return new Response('analysisId, flagId and question are required', { status: 400 })

    const recast = analysis.recastAnalyses?.find((item) => item.id === body.recastAnalysisId) ?? analysis.recastAnalyses?.[0]
    const flag = recast?.flags.find((item) => item.id === flagId) ?? analysis.flags.find((item) => item.id === flagId)
    if (!flag) return new Response('Valuation flag not found', { status: 404 })

    const context = JSON.stringify({
      flag: { id: flag.id, title: flag.title, description: flag.description, payload: flag.payload, status: flag.resolutionStatus, overrideAmount: (flag as any).overrideAmount ?? null },
      assumptions: recast?.assumptions,
      parsedReport: recast?.parsedReport,
      valuation: { normalizedEbitda: recast?.normalizedEbitda, low: recast?.valuationLow, mid: recast?.valuationMid, high: recast?.valuationHigh },
      sourceDocuments: analysis.inputSnapshot,
    })
    const raw = body.mode === 'apply' && body.suggestion
      ? JSON.stringify(body.suggestion)
      : await runWithAgentLlmContext(llmContextFromStoredAnalysis(analysis), () => createAgentMessage({
      system: SYSTEM,
      content: `Analysis context:\n${context}\n\nUser request:\n${question}`,
      maxTokens: 1800,
      temperature: 0,
    }))
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim())
    if (body.mode === 'apply') {
      if (!parsed.canApply || !parsed.action) return NextResponse.json({ ...parsed, applied: false })
      if (!recast) return NextResponse.json({ ...parsed, applied: false, note: 'Step 1 flags require the existing GL mapping controls to apply changes.' })
      const updated = await actionWs2RecastFlag({
        recastAnalysisId: recast.id,
        flagId,
        action: parsed.action,
        overrideAmount: typeof parsed.overrideAmount === 'number' ? parsed.overrideAmount : undefined,
        payloadPatch: parsed.payloadPatch && typeof parsed.payloadPatch === 'object' ? parsed.payloadPatch : undefined,
        notes: parsed.notes || parsed.answer,
        actorName: String(body.actorName || 'Admin'),
      })
      return NextResponse.json({ ...parsed, applied: true, analysis: updated })
    }
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('TTM flag chat error:', error)
    return new Response('Unable to answer this valuation question', { status: 500 })
  }
}

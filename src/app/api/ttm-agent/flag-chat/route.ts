import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTtmAnalysis, actionTtmFlag, actionWs2RecastFlag } from '@/lib/ttm-agent/orchestrator'
import { llmContextFromStoredAnalysis, runWithAgentLlmContext } from '@/lib/agent-llm-context'
import { createAgentMessage } from '@/lib/llm-completion'

export const maxDuration = 120

const SYSTEM = `You are Cantara's valuation review assistant for a non-technical advisor. Answer plainly and conversationally. Never mention JSON, payloads, fields, schemas, models, prompts, or developer terminology in the answer. Explain what was found, why it matters, and what the advisor can do next. If the user asks to correct the result, propose one safe structured action internally. Before the advisor clicks the Apply this change button, never say the item has been resolved, changed, updated, or applied; say it is a proposed change awaiting confirmation. For a GL reclassification, include the selected Cantara code in payloadPatch as assignedCantaraCode. If the advisor says an expense is a legitimate business expense and not personal, do not retain an owner/personal code: for Dining w Clients or client meals use OPX-MEALS (Meals & Entertainment (Business)), not OPX-MEALS-OWNER. Never invent source data. Return JSON only with this shape: {"answer": string, "canApply": boolean, "action": "RESOLVE"|"ESCALATE_CLIENT"|"OVERRIDE"|null, "overrideAmount": number|null, "payloadPatch": object, "notes": string}. The JSON is internal and must not be discussed in answer. Use RESOLVE to keep the item, ESCALATE_CLIENT to remove/escalate it, and OVERRIDE only when a replacement numeric amount is explicitly supported.`

function parseAssistantResponse(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(cleaned) }
  catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { /* use plain text below */ }
    }
    return { answer: cleaned || 'I could not generate an answer.', canApply: false, action: null, overrideAmount: null, payloadPatch: {}, notes: '' }
  }
}

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
    const parsed = parseAssistantResponse(raw)
    if (body.mode === 'apply') {
      if (!parsed.canApply || !parsed.action) return NextResponse.json({ ...parsed, applied: false })
      if (!recast) {
        const updated = await actionTtmFlag({
          analysisId: analysis.id,
          flagId,
          action: parsed.action,
          payloadPatch: parsed.payloadPatch && typeof parsed.payloadPatch === 'object' ? parsed.payloadPatch : undefined,
          notes: parsed.notes || parsed.answer,
          actorName: String(body.actorName || 'Admin'),
        })
        return NextResponse.json({ ...parsed, applied: true, analysis: updated })
      }
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

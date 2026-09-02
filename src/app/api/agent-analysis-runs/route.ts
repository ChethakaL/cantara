import { NextRequest, NextResponse } from 'next/server'
import {
  deleteAgentAnalysisRun,
  listAgentAnalysisRuns,
  saveAgentAnalysisRun,
} from '@/lib/agent-analysis-runs'
import type { AgentRunKey } from '@/lib/agent-run-keys'
import { parseAgentAiProvider } from '@/lib/agent-model-provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    const agentKey = req.nextUrl.searchParams.get('agentKey')
    if (!clientId || !agentKey) {
      return new Response('clientId and agentKey are required', { status: 400 })
    }

    const reports = await listAgentAnalysisRuns(clientId, agentKey as AgentRunKey)
    return NextResponse.json({ reports })
  } catch (error) {
    console.error('[agent-analysis-runs] GET error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      clientId,
      agentKey,
      fileName,
      report,
      markdown,
      documentNames,
      metadata,
      aiProvider: rawProvider,
      aiModel,
    } = body as {
      clientId?: string
      agentKey?: string
      fileName?: string
      report?: unknown
      markdown?: string
      documentNames?: string[]
      metadata?: unknown
      aiProvider?: string
      aiModel?: string | null
    }

    if (!clientId || !agentKey) {
      return new Response('clientId and agentKey are required', { status: 400 })
    }

    const saved = await saveAgentAnalysisRun({
      clientId,
      agentKey: agentKey as AgentRunKey,
      fileName: fileName ?? null,
      report,
      markdown: markdown ?? null,
      documentNames,
      metadata,
      aiProvider: parseAgentAiProvider(rawProvider),
      aiModel: aiModel ?? null,
    })

    return NextResponse.json({ report: saved })
  } catch (error) {
    console.error('[agent-analysis-runs] POST error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return new Response('id is required', { status: 400 })
    const result = await deleteAgentAnalysisRun(id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[agent-analysis-runs] DELETE error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { LEGACY_SUBMISSION_KEYS, type AgentRunKey } from '@/lib/agent-run-keys'

export type AgentAnalysisRunRecord = {
  id: string
  clientId: string
  agentKey: string
  fileName: string | null
  report: unknown
  markdown: string | null
  documentNames: string[]
  metadata: unknown
  aiProvider: string
  aiModel: string | null
  version: number
  createdAt: Date
  updatedAt: Date
}

function getDelegate() {
  return prisma.agentAnalysisRun
}

function mapRun(row: AgentAnalysisRunRecord) {
  return {
    id: row.id,
    clientId: row.clientId,
    agentKey: row.agentKey,
    fileName: row.fileName,
    report: row.report,
    markdown: row.markdown,
    documentNames: row.documentNames ?? [],
    metadata: row.metadata,
    aiProvider: row.aiProvider,
    aiModel: row.aiModel,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function legacyRunFromSubmission(clientId: string, agentKey: AgentRunKey) {
  const submissionKey = LEGACY_SUBMISSION_KEYS[agentKey]
  if (!submissionKey) return null

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  const stored = (client?.sectionSubmissions as Record<string, unknown> | null)?.[submissionKey]
  if (!stored || typeof stored !== 'object') return null

  const payload = stored as Record<string, unknown>
  const markdown = typeof payload.markdown === 'string' ? payload.markdown : null
  const hasReport = payload.report != null || markdown || payload.overallScore != null || payload.businessName != null
  if (!hasReport) return null

  const createdAt =
    typeof payload.generatedAt === 'string'
      ? payload.generatedAt
      : typeof payload.createdAt === 'string'
        ? payload.createdAt
        : new Date().toISOString()

  return {
    id: `legacy-${agentKey}-${clientId}`,
    clientId,
    agentKey,
    fileName: typeof payload.fileName === 'string' ? payload.fileName : `Legacy run`,
    report: payload.report ?? payload,
    markdown,
    documentNames: Array.isArray(payload.documentNames) ? (payload.documentNames as string[]) : [],
    metadata: payload.metadata ?? null,
    aiProvider: typeof payload.aiProvider === 'string' ? payload.aiProvider : 'bedrock',
    aiModel: typeof payload.aiModel === 'string' ? payload.aiModel : typeof payload.model === 'string' ? payload.model : null,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    legacy: true,
  }
}

export async function listAgentAnalysisRuns(clientId: string, agentKey: AgentRunKey) {
  const delegate = getDelegate()

  const rows = await delegate.findMany({
    where: { clientId, agentKey },
    orderBy: { createdAt: 'desc' },
  })

  if (rows.length > 0) {
    return rows.map(mapRun)
  }

  const legacy = await legacyRunFromSubmission(clientId, agentKey)
  return legacy ? [legacy] : []
}

export async function saveAgentAnalysisRun(args: {
  clientId: string
  agentKey: AgentRunKey
  fileName?: string | null
  report?: unknown
  markdown?: string | null
  documentNames?: string[]
  metadata?: unknown
  aiProvider?: string
  aiModel?: string | null
}) {
  const delegate = getDelegate()

  const existingCount = await delegate.count({ where: { clientId: args.clientId, agentKey: args.agentKey } })
  const version = existingCount + 1

  const row = await delegate.create({
    data: {
      clientId: args.clientId,
      agentKey: args.agentKey,
      fileName: args.fileName ?? `Run v${version}`,
      report: (args.report ?? {}) as Prisma.InputJsonValue,
      markdown: args.markdown ?? null,
      documentNames: args.documentNames ?? [],
      metadata: (args.metadata ?? null) as Prisma.InputJsonValue | typeof Prisma.DbNull,
      aiProvider: args.aiProvider ?? 'bedrock',
      aiModel: args.aiModel ?? null,
      version,
    },
  })

  return mapRun(row)
}

export async function deleteAgentAnalysisRun(id: string) {
  const delegate = getDelegate()
  if (id.startsWith('legacy-')) return { success: true, alreadyDeleted: true }
  await delegate.delete({ where: { id } })
  return { success: true }
}

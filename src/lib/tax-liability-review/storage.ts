import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type TaxLiabilityReportRecord = {
  id: string
  clientId: string
  markdown: string
  documentNames: string[]
  metadata?: unknown
  aiProvider?: string
  aiModel?: string | null
  createdAt: Date | string
  updatedAt?: Date | string
}

const SECTION_KEY = 'taxLiabilityReview'

function getDelegate() {
  return (prisma as any).taxLiabilityReport as
    | {
        findFirst: (args: unknown) => Promise<TaxLiabilityReportRecord | null>
        findMany: (args: unknown) => Promise<TaxLiabilityReportRecord[]>
        create: (args: unknown) => Promise<TaxLiabilityReportRecord>
        update: (args: unknown) => Promise<TaxLiabilityReportRecord>
        deleteMany: (args: unknown) => Promise<unknown>
      }
    | undefined
}

function fromSectionSubmission(clientId: string, stored: Record<string, unknown>): TaxLiabilityReportRecord | null {
  if (typeof stored.markdown !== 'string' || !stored.markdown.trim()) return null
  return {
    id: typeof stored.id === 'string' ? stored.id : `submissions-${clientId}`,
    clientId,
    markdown: stored.markdown,
    documentNames: Array.isArray(stored.documentNames) ? (stored.documentNames as string[]) : [],
    metadata: stored.metadata,
    createdAt: typeof stored.createdAt === 'string' ? stored.createdAt : new Date().toISOString(),
    updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : undefined,
  }
}

async function readSectionSubmission(clientId: string): Promise<TaxLiabilityReportRecord | null> {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  const submissions = (client?.sectionSubmissions ?? {}) as Record<string, unknown>
  const stored = submissions[SECTION_KEY]
  if (!stored || typeof stored !== 'object') return null
  return fromSectionSubmission(clientId, stored as Record<string, unknown>)
}

async function writeSectionSubmission(
  clientId: string,
  data: {
    markdown: string
    documentNames: string[]
    metadata?: unknown
    id?: string
    createdAt?: Date | string
  },
): Promise<TaxLiabilityReportRecord> {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) throw new Error('Client not found')

  const submissions = (client.sectionSubmissions ?? {}) as Record<string, unknown>
  const existing = submissions[SECTION_KEY] as Record<string, unknown> | undefined
  const now = new Date().toISOString()
  const next: TaxLiabilityReportRecord = {
    id: data.id ?? (typeof existing?.id === 'string' ? existing.id : `submissions-${clientId}`),
    clientId,
    markdown: data.markdown,
    documentNames: data.documentNames,
    metadata: data.metadata,
    createdAt: typeof data.createdAt === 'string'
      ? data.createdAt
      : typeof existing?.createdAt === 'string'
        ? existing.createdAt
        : now,
    updatedAt: now,
  }

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...submissions,
        [SECTION_KEY]: next,
      } as Prisma.InputJsonValue,
    },
  })

  return next
}

async function deleteSectionSubmission(clientId: string) {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return

  const submissions = { ...((client.sectionSubmissions ?? {}) as Record<string, unknown>) }
  delete submissions[SECTION_KEY]
  await prisma.clientProfile.update({
    where: { id: clientId },
    data: { sectionSubmissions: submissions as Prisma.InputJsonValue },
  })
}

export async function listTaxLiabilityReports(clientId: string): Promise<TaxLiabilityReportRecord[]> {
  const delegate = getDelegate()
  if (delegate) {
    try {
      const reports = await delegate.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      })
      if (reports.length > 0) return reports
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code
      if (code !== 'P2021') throw error
    }
  }

  const fallback = await readSectionSubmission(clientId)
  return fallback ? [fallback] : []
}

export async function getLatestTaxLiabilityReport(clientId: string): Promise<TaxLiabilityReportRecord | null> {
  const reports = await listTaxLiabilityReports(clientId)
  return reports[0] ?? null
}

export async function saveTaxLiabilityReport(args: {
  clientId: string
  markdown: string
  documentNames?: string[]
  metadata?: unknown
  aiProvider?: string
  aiModel?: string | null
}): Promise<TaxLiabilityReportRecord> {
  const delegate = getDelegate()
  if (delegate) {
    try {
      return await delegate.create({
        data: {
          clientId: args.clientId,
          markdown: args.markdown,
          documentNames: args.documentNames ?? [],
          metadata: args.metadata ?? undefined,
          aiProvider: args.aiProvider || 'bedrock',
          aiModel: args.aiModel || null,
          createdAt: new Date(),
        },
      })
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code
      if (code !== 'P2021') throw error
    }
  }

  return writeSectionSubmission(args.clientId, {
    markdown: args.markdown,
    documentNames: args.documentNames ?? [],
    metadata: args.metadata,
  })
}

export async function updateLatestTaxLiabilityReport(
  clientId: string,
  data: { metadata?: unknown; markdown?: string },
): Promise<TaxLiabilityReportRecord | null> {
  const delegate = getDelegate()
  if (delegate) {
    try {
      const latest = await delegate.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      })
      if (latest) {
        return await delegate.update({
          where: { id: latest.id },
          data: {
            ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
            ...(typeof data.markdown === 'string' ? { markdown: data.markdown } : {}),
          },
        })
      }
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code
      if (code !== 'P2021') throw error
    }
  }

  const existing = await readSectionSubmission(clientId)
  if (!existing) return null
  return writeSectionSubmission(clientId, {
    markdown: typeof data.markdown === 'string' ? data.markdown : existing.markdown,
    documentNames: existing.documentNames,
    metadata: data.metadata !== undefined ? data.metadata : existing.metadata,
    id: existing.id,
    createdAt: existing.createdAt,
  })
}

export async function deleteTaxLiabilityReports(clientId: string) {
  const delegate = getDelegate()
  if (delegate) {
    try {
      await delegate.deleteMany({ where: { clientId } })
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code
      if (code !== 'P2021') throw error
    }
  }

  await deleteSectionSubmission(clientId)
}

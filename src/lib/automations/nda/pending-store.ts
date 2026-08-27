import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Make Data Store `transactions_boards_ids` replacement.
 * Call when an NDA envelope is sent so recipient-completed / envelope-completed
 * can resolve Monday boardId + itemId from envelopeId alone.
 */
export async function registerBuyerNdaPending(args: {
  envelopeId: string
  boardId: string
  itemId: string
  fileColumnId?: string | null
  statusColumnId?: string | null
  meta?: Record<string, unknown>
}) {
  const envelopeId = String(args.envelopeId || '').trim()
  const boardId = String(args.boardId || '').trim()
  const itemId = String(args.itemId || '').trim()
  if (!envelopeId || !boardId || !itemId) {
    throw new Error('registerBuyerNdaPending requires envelopeId, boardId, and itemId')
  }

  const meta = (args.meta ?? undefined) as Prisma.InputJsonValue | undefined

  return prisma.automationBuyerNdaPending.upsert({
    where: { envelopeId },
    create: {
      envelopeId,
      boardId,
      itemId,
      fileColumnId: args.fileColumnId || null,
      statusColumnId: args.statusColumnId || null,
      meta,
    },
    update: {
      boardId,
      itemId,
      fileColumnId: args.fileColumnId || null,
      statusColumnId: args.statusColumnId || null,
      meta,
      consumedAt: null,
    },
  })
}

export async function getBuyerNdaPending(envelopeId: string) {
  return prisma.automationBuyerNdaPending.findUnique({
    where: { envelopeId: String(envelopeId || '').trim() },
  })
}

export async function markBuyerNdaPendingConsumed(envelopeId: string) {
  return prisma.automationBuyerNdaPending.updateMany({
    where: { envelopeId: String(envelopeId || '').trim(), consumedAt: null },
    data: { consumedAt: new Date() },
  })
}

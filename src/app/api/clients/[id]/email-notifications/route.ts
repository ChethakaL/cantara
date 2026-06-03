import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await prisma.clientEmailNotification.findMany({
      where: { clientId: params.id },
      orderBy: { sentAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(
      rows.map(row => ({
        id: row.id,
        type: row.type,
        recipientEmail: row.recipientEmail,
        reminderDaysBefore: row.reminderDaysBefore,
        documentId: row.documentId,
        targetDeadline: row.targetDeadline?.toISOString() ?? null,
        subject: row.subject,
        payload: row.payload,
        status: row.status,
        errorMessage: row.errorMessage,
        sentAt: row.sentAt.toISOString(),
      })),
    )
  } catch (error) {
    console.error('GET client email notifications error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

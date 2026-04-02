import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refreshMeetingAssistant } from '@/lib/meeting-assistant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_: Request, { params }: { params: { id: string; meetingId: string } }) {
  try {
    const meeting = await (prisma as any).meeting.findFirst({
      where: { id: params.meetingId, clientId: params.id },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    }

    if (!meeting.nylasNotetakerId || !meeting.nylasConnectionId) {
      return NextResponse.json({ error: 'No meeting assistant is linked to this meeting.' }, { status: 400 })
    }

    const connection = await (prisma as any).nylasConnection.findUnique({
      where: { id: meeting.nylasConnectionId },
    })

    if (!connection?.grantId) {
      return NextResponse.json({ error: 'No active calendar grant is linked to this meeting.' }, { status: 400 })
    }

    const result = await refreshMeetingAssistant({
      meetingId: meeting.id,
      grantId: connection.grantId,
      notetakerId: meeting.nylasNotetakerId,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('MEETING_ASSISTANT_REFRESH_ERROR', {
      meetingId: params.meetingId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Could not refresh meeting assistant status.' }, { status: 500 })
  }
}

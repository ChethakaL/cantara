import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateMeetingReport } from '@/lib/meetings'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(_: Request, { params }: { params: { id: string; meetingId: string } }) {
  const meeting = await (prisma as any).meeting.findFirst({
    where: { id: params.meetingId, clientId: params.id },
    include: { client: true },
  })

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
  }

  if (!meeting.notesText?.trim()) {
    return NextResponse.json({ error: 'Upload or paste meeting notes before running the report.' }, { status: 400 })
  }

  try {
    await (prisma as any).meeting.update({
      where: { id: meeting.id },
      data: { reportStatus: 'RUNNING', reportStartedAt: new Date() },
    })

    const result = await generateMeetingReport({
      clientName: meeting.client.businessName,
      title: meeting.title,
      startAt: meeting.startAt,
      agenda: meeting.agenda || '',
      agendaTags: meeting.agendaTags || [],
      meetingUrl: meeting.meetingUrl,
      notesText: meeting.notesText,
    })

    await (prisma as any).meetingReport.create({
      data: {
        meetingId: meeting.id,
        report: result.report,
        metadata: result.metadata,
      },
    })

    const item = await (prisma as any).meeting.update({
      where: { id: meeting.id },
      data: {
        reportStatus: 'COMPLETE',
        reportStartedAt: null,
        lastReportedAt: new Date(),
      },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('MEETING_REPORT_ERROR', error)

    await (prisma as any).meeting.update({
      where: { id: meeting.id },
      data: { reportStatus: 'FAILED', reportStartedAt: null },
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not generate report.' },
      { status: 500 }
    )
  }
}

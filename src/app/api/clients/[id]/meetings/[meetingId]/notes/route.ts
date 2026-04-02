import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractMeetingNotesText } from '@/lib/meetings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string; meetingId: string } }) {
  try {
    const existing = await (prisma as any).meeting.findFirst({
      where: { id: params.meetingId, clientId: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required.' }, { status: 400 })
    }

    const notesText = await extractMeetingNotesText(file)
    if (!notesText) {
      return NextResponse.json({ error: 'No readable text was found in the uploaded notes.' }, { status: 400 })
    }

    const item = await (prisma as any).meeting.update({
      where: { id: params.meetingId },
      data: {
        notesText,
        notesFileName: file.name,
        notesUploadedAt: new Date(),
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
    console.error('MEETING_NOTES_UPLOAD_ERROR', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not upload meeting notes.' },
      { status: 500 }
    )
  }
}

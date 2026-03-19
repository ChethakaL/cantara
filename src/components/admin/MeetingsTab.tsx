'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, MapPin, Video, Plus, Sparkles, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge, Button, Input, Textarea } from '@/components/ui'

type Meeting = {
  id: string
  title: string
  dateLabel: string
  timeLabel: string
  location: string
  mode: 'zoom' | 'in-person'
  status: 'upcoming' | 'completed'
  agenda?: string[]
  summary?: string
  highlights?: string[]
  todos?: Array<{ id: string; label: string; done: boolean }>
}

const INITIAL_UPCOMING: Meeting[] = [
  {
    id: 'upcoming_1',
    title: 'Phase 2 Review Call',
    dateLabel: 'Monday, March 23, 2026',
    timeLabel: '10:00 AM – 11:00 AM',
    location: 'Zoom',
    mode: 'zoom',
    status: 'upcoming',
    agenda: [
      'Review uploaded financial and tax documents',
      'Confirm owner interview timing',
      'Outline remaining collection priorities',
    ],
  },
  {
    id: 'upcoming_2',
    title: 'Owner / GM Interview',
    dateLabel: 'Thursday, March 26, 2026',
    timeLabel: '2:00 PM – 3:30 PM',
    location: 'Client HQ – 1420 Harbor Blvd',
    mode: 'in-person',
    status: 'upcoming',
    agenda: [
      'Business history and transition goals',
      'Staffing and key-person dependency review',
      'Operational handover discussion',
    ],
  },
]

const INITIAL_PREVIOUS: Meeting[] = [
  {
    id: 'previous_1',
    title: 'Kick-off / Intro Meeting',
    dateLabel: 'Wednesday, March 5, 2026',
    timeLabel: '10:00 AM',
    location: 'Zoom',
    mode: 'zoom',
    status: 'completed',
    summary:
      'Introduced the diligence process, aligned on the first collection milestones, and identified two early attention areas for the advisor team to track.',
    highlights: ['Lease expiring in 18 months', 'Prior litigation matter (settled)'],
    todos: [
      { id: 'todo_1', label: 'Client to upload settled litigation documents', done: true },
      { id: 'todo_2', label: 'Advisor to send document checklist by EOD March 6', done: true },
      { id: 'todo_3', label: 'Schedule Phase 2 review call for next week', done: true },
      { id: 'todo_4', label: 'Confirm lease renewal intent in writing', done: false },
    ],
  },
]

export default function MeetingsTab({ clientName }: { clientName: string }) {
  const [upcomingMeetings, setUpcomingMeetings] = useState(INITIAL_UPCOMING)
  const [previousMeetings] = useState(INITIAL_PREVIOUS)
  const [expandedMeetingId, setExpandedMeetingId] = useState(previousMeetings[0]?.id ?? null)
  const [draftMeeting, setDraftMeeting] = useState({
    title: '',
    dateLabel: '',
    timeLabel: '',
    location: '',
    mode: 'zoom' as 'zoom' | 'in-person',
    agenda: '',
  })

  const upcomingCount = upcomingMeetings.length
  const completedCount = previousMeetings.length

  const canSchedule = useMemo(() => {
    return Boolean(
      draftMeeting.title.trim() &&
        draftMeeting.dateLabel.trim() &&
        draftMeeting.timeLabel.trim() &&
        draftMeeting.location.trim(),
    )
  }, [draftMeeting])

  const scheduleMeeting = () => {
    if (!canSchedule) return
    setUpcomingMeetings((prev) => [
      {
        id: `meeting_${Date.now()}`,
        title: draftMeeting.title.trim(),
        dateLabel: draftMeeting.dateLabel.trim(),
        timeLabel: draftMeeting.timeLabel.trim(),
        location: draftMeeting.location.trim(),
        mode: draftMeeting.mode,
        status: 'upcoming',
        agenda: draftMeeting.agenda
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      },
      ...prev,
    ])
    setDraftMeeting({
      title: '',
      dateLabel: '',
      timeLabel: '',
      location: '',
      mode: 'zoom',
      agenda: '',
    })
  }

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Meeting Hub</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900 cantara-serif">Meetings for {clientName}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="blue">{upcomingCount} upcoming</Badge>
              <Badge color="slate">{completedCount} previous</Badge>
            </div>
          </div>
          <div className="px-6 py-5 bg-gradient-to-r from-slate-50 via-white to-amber-50/60">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Next Meeting</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{upcomingMeetings[0]?.title ?? 'No meeting scheduled'}</p>
                <p className="mt-1 text-sm text-slate-500">{upcomingMeetings[0]?.dateLabel ?? 'Schedule the next advisor touchpoint'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Format</p>
                <p className="mt-2 text-base font-semibold text-slate-900 capitalize">{upcomingMeetings[0]?.mode ?? 'TBD'}</p>
                <p className="mt-1 text-sm text-slate-500">{upcomingMeetings[0]?.location ?? 'Location pending'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Focus</p>
                <p className="mt-2 text-base font-semibold text-slate-900">Advisor coordination</p>
                <p className="mt-1 text-sm text-slate-500">Track meetings, agendas, and follow-ups in one place.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Plus className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Schedule Meeting</p>
              <p className="text-xs text-slate-400">Dummy UI for now, but it should feel real.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Meeting title"
              value={draftMeeting.title}
              onChange={(e) => setDraftMeeting((prev) => ({ ...prev, title: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Date"
                value={draftMeeting.dateLabel}
                onChange={(e) => setDraftMeeting((prev) => ({ ...prev, dateLabel: e.target.value }))}
              />
              <Input
                placeholder="Time"
                value={draftMeeting.timeLabel}
                onChange={(e) => setDraftMeeting((prev) => ({ ...prev, timeLabel: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Location or meeting link"
              value={draftMeeting.location}
              onChange={(e) => setDraftMeeting((prev) => ({ ...prev, location: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDraftMeeting((prev) => ({ ...prev, mode: 'zoom' }))}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                  draftMeeting.mode === 'zoom'
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Zoom / Virtual
              </button>
              <button
                type="button"
                onClick={() => setDraftMeeting((prev) => ({ ...prev, mode: 'in-person' }))}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                  draftMeeting.mode === 'in-person'
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                In Person
              </button>
            </div>
            <Textarea
              rows={4}
              placeholder="Agenda items, one per line"
              value={draftMeeting.agenda}
              onChange={(e) => setDraftMeeting((prev) => ({ ...prev, agenda: e.target.value }))}
            />
            <Button onClick={scheduleMeeting} disabled={!canSchedule} className="w-full">
              Schedule Meeting
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-blue-500" />
          <h3 className="text-lg font-semibold text-slate-900">Upcoming Meetings</h3>
        </div>
        <div className="space-y-4">
          {upcomingMeetings.map((meeting) => (
            <div key={meeting.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-6 py-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {meeting.mode === 'zoom' ? (
                      <Video className="w-4 h-4 text-blue-500" />
                    ) : (
                      <MapPin className="w-4 h-4 text-amber-500" />
                    )}
                    <p className="text-2xl font-semibold text-slate-900 cantara-serif">{meeting.title}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {meeting.dateLabel}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> {meeting.timeLabel}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{meeting.location}</p>
                </div>
                <Badge color="blue">Upcoming</Badge>
              </div>
              {meeting.agenda && meeting.agenda.length > 0 && (
                <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Agenda</p>
                  <div className="mt-3 space-y-2">
                    {meeting.agenda.map((item) => (
                      <div key={item} className="text-sm text-slate-700 flex items-start gap-2">
                        <span className="mt-[7px] w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-900">Previous Meetings</h3>
        </div>
        <div className="space-y-4">
          {previousMeetings.map((meeting) => {
            const expanded = expandedMeetingId === meeting.id
            const doneCount = meeting.todos?.filter((todo) => todo.done).length ?? 0
            const totalTodos = meeting.todos?.length ?? 0

            return (
              <div key={meeting.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedMeetingId(expanded ? null : meeting.id)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-slate-900 cantara-serif">{meeting.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{meeting.dateLabel} · {meeting.timeLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">{doneCount}/{totalTodos} to-dos done</span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {expanded && (
                  <div className="px-6 pb-6">
                    <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">AI Meeting Summary</p>
                      </div>
                      <p className="text-base leading-7 text-slate-700">{meeting.summary}</p>
                      {meeting.highlights && meeting.highlights.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {meeting.highlights.map((highlight) => (
                            <span key={highlight} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-500">
                              {highlight}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {meeting.todos && meeting.todos.length > 0 && (
                      <div className="mt-5">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                          <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Action Items</p>
                        </div>
                        <div className="space-y-3">
                          {meeting.todos.map((todo) => (
                            <div key={todo.id} className="flex items-center gap-3 text-sm text-slate-700">
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                todo.done ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-300 text-slate-300'
                              }`}>
                                {todo.done ? '✓' : ''}
                              </span>
                              <span className={todo.done ? 'line-through text-slate-400' : ''}>{todo.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

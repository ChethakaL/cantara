'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, FileText, Loader2, Pencil, UploadCloud } from 'lucide-react'
import { Button, Card, Modal, Textarea } from '@/components/ui'

type TimelineStage = {
  key: string
  label: string
  description: string
  notes: boolean
  completed: boolean
  autoCompleted: boolean
  status: string
  notesText?: string | null
  notesFileName?: string | null
  missingDocuments?: { id: string; name: string }[]
}

const CALL_GROUP_KEYS = ['facility-review-call', 'owner-involvement-call', 'sales-process-call'] as const

type TimelineDisplayItem =
  | { kind: 'stage'; stage: TimelineStage }
  | { kind: 'calls'; stages: TimelineStage[]; completed: boolean; completedCount: number }

function buildDisplayItems(stages: TimelineStage[]): TimelineDisplayItem[] {
  const callKeySet = new Set<string>(CALL_GROUP_KEYS)
  const items: TimelineDisplayItem[] = []
  let callGroupInserted = false

  for (const stage of stages) {
    if (callKeySet.has(stage.key)) {
      if (!callGroupInserted) {
        const callStages = CALL_GROUP_KEYS
          .map((key) => stages.find((item) => item.key === key))
          .filter((item): item is TimelineStage => Boolean(item))
        const completedCount = callStages.filter((item) => item.completed).length
        items.push({
          kind: 'calls',
          stages: callStages,
          completed: callStages.length > 0 && completedCount === callStages.length,
          completedCount,
        })
        callGroupInserted = true
      }
      continue
    }
    items.push({ kind: 'stage', stage })
  }

  return items
}

export default function ClientTimeline({ clientId }: { clientId: string }) {
  const [stages, setStages] = useState<TimelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [callsOpen, setCallsOpen] = useState(true)
  const [notesStage, setNotesStage] = useState<TimelineStage | null>(null)
  const [notesText, setNotesText] = useState('')
  const [notesFile, setNotesFile] = useState<File | null>(null)
  const [missingDocuments, setMissingDocuments] = useState<{ id: string; name: string }[] | null>(null)

  const displayItems = useMemo(() => buildDisplayItems(stages), [stages])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/timeline`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load timeline.')
      setStages(data.stages || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [clientId])

  const toggle = async (stage: TimelineStage) => {
    setSaving(stage.key)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/timeline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageKey: stage.key, completed: !stage.completed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update stage.')
      setStages(data.timeline.stages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update stage.')
    } finally {
      setSaving(null)
    }
  }

  const openNotes = (stage: TimelineStage) => {
    setNotesStage(stage)
    setNotesText(stage.notesText || '')
    setNotesFile(null)
    setError(null)
  }

  const saveNotes = async () => {
    if (!notesStage) return
    setSaving(notesStage.key)
    setError(null)
    try {
      const form = new FormData()
      form.set('stageKey', notesStage.key)
      if (notesFile) form.set('file', notesFile)
      else form.set('notesText', notesText)
      const res = await fetch(`/api/clients/${clientId}/timeline`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save notes.')
      setStages(data.timeline.stages)
      setNotesStage(null)
      setNotesFile(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save notes.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <Card className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </Card>
    )
  }

  const completedCount = displayItems.filter((item) =>
    item.kind === 'stage' ? item.stage.completed : item.completed,
  ).length
  const progress = displayItems.length ? Math.round((completedCount / displayItems.length) * 100) : 0
  const currentItem = displayItems.find((item) =>
    item.kind === 'stage' ? !item.stage.completed : !item.completed,
  )
  const currentLabel =
    currentItem?.kind === 'stage'
      ? currentItem.stage.label
      : currentItem?.kind === 'calls'
        ? 'Calls'
        : null

  const renderStageActions = (stage: TimelineStage) => (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800">{stage.label}</h3>
          <p className="mt-1 text-sm text-slate-500">{stage.description}</p>
          {stage.autoCompleted && (
            <p className="mt-2 text-xs font-medium text-emerald-700">Automatically detected as complete</p>
          )}
          {stage.notesFileName && (
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              {stage.notesFileName}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant={stage.completed ? 'outline' : 'primary'}
          onClick={() => void toggle(stage)}
          disabled={saving === stage.key}
        >
          <Pencil className="h-3.5 w-3.5" />
          {saving === stage.key ? 'Saving…' : stage.completed ? 'Mark incomplete' : 'Mark done'}
        </Button>
      </div>
      {stage.notes && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openNotes(stage)}>
            <UploadCloud className="h-4 w-4 text-amber-600" />
            {stage.notesText || stage.notesFileName ? 'View / edit notes' : 'Add call notes'}
          </Button>
          {stage.notesFileName && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              {stage.notesFileName}
            </span>
          )}
        </div>
      )}
      {stage.key === 'client-documents' && (
        <button
          type="button"
          className="mt-4 inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          onClick={() => setMissingDocuments(stage.missingDocuments || [])}
        >
          {stage.missingDocuments?.length || 0} documents not yet uploaded
        </button>
      )}
    </>
  )

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-[#fffbf0] to-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8922a]">Client journey</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Onboarding timeline</h2>
            <p className="mt-1 text-sm text-slate-500">Track progress from setup through agent execution.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
            <Button size="sm" variant="primary" onClick={() => setExpanded((value) => !value)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? 'Collapse' : 'Open timeline'}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>
            {completedCount} of {displayItems.length} milestones complete
          </span>
          <span className="text-[#b8922a]">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#b8922a] to-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-5 flex items-start justify-between gap-1">
          {displayItems.map((item) => {
            const label = item.kind === 'stage' ? item.stage.label : 'Calls'
            const completed = item.kind === 'stage' ? item.stage.completed : item.completed
            const isCurrent = item === currentItem
            return (
              <div key={item.kind === 'stage' ? item.stage.key : 'calls'} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={label}>
                <div
                  className={`h-3 w-3 rounded-full border-2 ${
                    completed
                      ? 'border-emerald-500 bg-emerald-500'
                      : isCurrent
                        ? 'border-[#b8922a] bg-[#fff8df]'
                        : 'border-slate-300 bg-white'
                  }`}
                />
                <span
                  className={`hidden truncate text-center text-[10px] sm:block ${
                    completed ? 'text-emerald-700' : isCurrent ? 'font-semibold text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{currentLabel ? 'Current phase:' : 'Journey complete:'}</span>{' '}
          {currentLabel || 'All onboarding milestones are complete.'}
        </div>
      </div>
      {error && (
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}
      {expanded && (
        <div className="px-5 py-6">
          <div className="relative space-y-0">
            <div className="absolute bottom-8 left-[19px] top-8 w-px bg-slate-200" />
            {displayItems.map((item, index) => {
              if (item.kind === 'stage') {
                const stage = item.stage
                return (
                  <div key={stage.key} className="relative flex gap-4 pb-6 last:pb-0">
                    <div
                      className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                        stage.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      {stage.completed ? <Check className="h-5 w-5" /> : <span className="text-sm font-bold">{index + 1}</span>}
                    </div>
                    <div
                      className={`min-w-0 flex-1 rounded-xl border p-4 ${
                        stage.completed ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-200 bg-white'
                      }`}
                    >
                      {renderStageActions(stage)}
                    </div>
                  </div>
                )
              }

              return (
                <div key="calls" className="relative flex gap-4 pb-6 last:pb-0">
                  <div
                    className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                      item.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {item.completed ? <Check className="h-5 w-5" /> : <span className="text-sm font-bold">{index + 1}</span>}
                  </div>
                  <div
                    className={`min-w-0 flex-1 rounded-xl border ${
                      item.completed ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 p-4 text-left"
                      onClick={() => setCallsOpen((value) => !value)}
                      aria-expanded={callsOpen}
                    >
                      <div>
                        <h3 className="font-semibold text-slate-800">Calls</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Complete facility, owner involvement, and sales process calls — add notes or upload transcripts for each.
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          {item.completedCount} of {item.stages.length} calls complete
                        </p>
                      </div>
                      {callsOpen ? (
                        <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                      )}
                    </button>
                    {callsOpen && (
                      <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
                        {item.stages.map((stage) => (
                          <div
                            key={stage.key}
                            className={`rounded-lg border p-4 ${
                              stage.completed ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60'
                            }`}
                          >
                            {renderStageActions(stage)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <Modal
        open={Boolean(notesStage)}
        onClose={() => setNotesStage(null)}
        title={notesStage ? `${notesStage.label} notes` : 'Call notes'}
        sizeClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Paste your notes below or upload a PDF/TXT file. You can reopen this editor anytime to update them.
          </p>
          <Textarea
            label="Notes"
            value={notesText}
            onChange={(event) => {
              setNotesText(event.target.value)
              setNotesFile(null)
            }}
            placeholder="Paste call notes here…"
            className="min-h-[260px]"
          />
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Or upload a file</p>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <UploadCloud className="h-4 w-4 text-amber-600" />
              {notesFile?.name || 'Choose PDF or TXT'}
              <input
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    setNotesFile(file)
                    setNotesText('')
                  }
                }}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => setNotesStage(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void saveNotes()}
              disabled={saving === notesStage?.key || (!notesText.trim() && !notesFile)}
            >
              {saving === notesStage?.key ? 'Saving…' : 'Save notes'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={missingDocuments !== null} onClose={() => setMissingDocuments(null)} title="Client documents still needed">
        <div className="space-y-4">
          {missingDocuments?.length ? (
            <>
              <p className="text-sm text-slate-500">These required documents have not been uploaded or marked unavailable yet.</p>
              <ul className="space-y-2">
                {missingDocuments.map((document) => (
                  <li key={document.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {document.name}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">All required client documents have been added.</p>
          )}
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => setMissingDocuments(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

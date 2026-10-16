'use client'

import { useEffect, useState } from 'react'
import { FileText, Loader2, UploadCloud } from 'lucide-react'
import { Button, Card, Textarea } from '@/components/ui'

type MeetingCallStage = {
  notesText?: string | null
  notesFileName?: string | null
}

export default function RequiredInfoMeetingCall({ clientId }: { clientId: string }) {
  const [stage, setStage] = useState<MeetingCallStage | null>(null)
  const [notesText, setNotesText] = useState('')
  const [notesFile, setNotesFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/clients/${clientId}/timeline`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load meeting call notes.')
      const call = (data.stages || []).find((item: { key: string }) => item.key === 'onboarding-call') as MeetingCallStage | undefined
      setStage(call || {})
      setNotesText(call?.notesText || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load meeting call notes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [clientId])

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const form = new FormData()
      form.set('stageKey', 'onboarding-call')
      if (notesFile) form.set('file', notesFile)
      else form.set('notesText', notesText)
      const response = await fetch(`/api/clients/${clientId}/timeline`, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save meeting call notes.')
      const call = (data.timeline?.stages || []).find((item: { key: string }) => item.key === 'onboarding-call') as MeetingCallStage | undefined
      setStage(call || {})
      setNotesText(call?.notesText || '')
      setNotesFile(null)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save meeting call notes.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Card className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></Card>
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Meeting Call</h3>
        <p className="mt-1 text-sm text-slate-500">Add or update notes from the client onboarding meeting.</p>
        {stage?.notesFileName && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <FileText className="h-3.5 w-3.5" /> {stage.notesFileName}
          </p>
        )}
      </div>
      <Textarea
        label="Meeting notes"
        value={notesText}
        onChange={event => { setNotesText(event.target.value); setNotesFile(null); setSaved(false) }}
        placeholder="Add notes from the meeting call…"
        className="min-h-[220px]"
      />
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <UploadCloud className="h-4 w-4 text-amber-600" />
        {notesFile?.name || 'Upload notes (PDF, DOCX, or TXT)'}
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) { setNotesFile(file); setNotesText(''); setSaved(false) }
            event.target.value = ''
          }}
        />
      </label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
        <Button onClick={() => void save()} disabled={saving || (!notesText.trim() && !notesFile)}>
          {saving ? 'Saving…' : 'Save Meeting Notes'}
        </Button>
        {saved && <span className="text-xs font-medium text-emerald-600">Saved</span>}
      </div>
    </Card>
  )
}
